// src/questionnaires/questionnaires.service.ts
import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EligibilityEngineService } from './eligibility-engine.service';
import { OnefopSubmissionDto } from '../dto/onefop-submission.dto';
import { OnefopResponseDto } from '../dto/onefop-response.dto';
import {
  AnyQuestionnaireDto,
  EnterpriseQuestionnaireDto,
  CooperativeQuestionnaireDto,
  CtdQuestionnaireDto,
  OngQuestionnaireDto,
  AdministrationQuestionnaireDto,
  ProjectProgramQuestionnaireDto,
  VocationalTrainingQuestionnaireDto,
} from '../dto/onefop-questionnaire.dto';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { randomUUID } from 'crypto';
import {
  normalizeFlatKeys,
  buildNestedDto,
} from '../common/normalizers/flat-key-normalizer';
import { surveyYearFromQuarterCode } from '../services/pdf-data-mapper.service';
import { OnefopShadowValidatorService } from '../onefop-schema-validation/onefop-shadow-validator.service';
import { OnefopSchemaLoaderService } from '../onefop-schema-validation/onefop-schema-loader.service';
import { Territory, territoryWhere } from '../auth/territory';
import { AdminListFilters, buildAdminListWhere } from './admin-list-filter';
import { syncCampaignSubmissionOnReview } from './campaign-review-sync';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';

type FlatFormData = Record<string, string | number>;
type TxClient = any;

// Must stay aligned with the identification DTOs and AST requiredField
// flags. Drafts skip class-validator missing properties; this list is
// the final-submit gate so an API client cannot persist an empty
// cooperative / CTD / NGO as PENDING_REVIEW.
const FINAL_REQUIRED_FIELDS: Record<string, string[]> = {
  respondent: ['name', 'function', 'phone1', 'email'],
  enterprise: [
    'name', 'legalStatus', 'area', 'region', 'department',
    'subdivision', 'locality', 'phone1', 'poBox', 'sector', 'branch',
    'mainActivity', 'headOffice', 'permanentWorkers', 'vacancies', 'size',
  ],
  cooperative: [
    'name', 'headOffice', 'yearCreated', 'area', 'region', 'department',
    'subdivision', 'locality', 'phone1', 'poBox', 'sector', 'branch',
    'mainActivity', 'type', 'permanentWorkers', 'vacancies',
  ],
  ctd: [
    'type', 'yearCreated', 'area', 'region', 'department', 'subdivision',
    'locality', 'phone1', 'poBox', 'sector', 'branch', 'permanentWorkers',
    'vacancies',
  ],
  ong: [
    'name', 'headOffice', 'yearCreated', 'area', 'region', 'department',
    'subdivision', 'locality', 'phone1', 'poBox', 'sector', 'branch',
    'mainMission', 'permanentWorkers', 'vacancies',
  ],
  administration: [
    'name', 'area', 'region', 'department', 'subdivision', 'locality',
    'phone1', 'sector', 'mainMission', 'hasProject', 'hasSupervisedStructures',
  ],
  projectProgram: [
    'nature', 'name', 'personInCharge', 'area', 'region', 'department',
    'subdivision', 'locality', 'phone1', 'poBox', 'sector', 'branch',
    'mainMission', 'headOffice', 'supervisingMinistry', 'status',
    'permanentWorkers', 'vacancies',
  ],
  // VT final-submit fix (VT-8). Derived from three sources per the task
  // spec, and deliberately narrower than the six entities above:
  //  - Prisma OnefopVocationalTrainingDetail: only `name` is NOT NULL;
  //    every other column (including all six below) is nullable.
  //  - Frontend AST (onefop_ast.dart, section1VocationalTraining): no VT
  //    field anywhere sets requiredField:true — an explicit, commented
  //    VT-2 decision ("no blanket-required policy... 1.1 stays optional,
  //    as does every field in later sections"), unlike the six entities
  //    above (~76% requiredField:true, which is what their own lists
  //    mirror). So "frontend required flags" contributes zero fields here.
  //  - identification DTO: VocationalTrainingIdentificationDto only
  //    marks `name` @IsNotEmpty(), already enforced independently by the
  //    class-validator pass above this method's call site.
  // With all three sources silent beyond `name`, this list instead
  // mirrors the one convention every one of the six lists above already
  // agrees on unanimously: region/department/subdivision/locality/area
  // identify *which* entity submitted, and every existing entity type
  // requires that whole group. VT's own §1 has the exact same fields
  // under the same "Identification and Location" heading, so requiring
  // them here is the narrowest fix that actually stops an all-blank VT
  // Detail (the reported bug) from reaching PENDING_REVIEW, without
  // inventing requiredness the other two sources don't support.
  //
  // Deliberately left optional (not required here), each for a reason
  // beyond "not required elsewhere":
  //  - structureCode (1.1): Prisma comment marks it admin-assigned, not
  //    respondent-supplied.
  //  - sigle (1.3), commune (1.7): no cross-entity analog exists to
  //    generalize from (commune is a VT-only geo concept with no
  //    established convention); inventing one would guess.
  //  - educationSystem/cfpType/functionalStatus/nonFunctionalReason
  //    (1.10-1.13): the AST comment says these render as free text
  //    specifically because "this pass has no confirmed printed option
  //    wording" — the valid values for these fields are not even
  //    settled yet, so requiring them would demand respondents fill in
  //    content the design note itself has not confirmed.
  //  - yearOfEstablishment (1.14): has a cross-entity analog
  //    (yearCreated, required for cooperative/ctd/ong) but no Prisma or
  //    frontend signal of its own; left optional rather than extending
  //    that analogy without a second confirming source.
  //  - respondentSex/promoter* (1.15b/1.16): the promoter is a distinct,
  //    optional stakeholder role from `respondent`; no source marks it
  //    required.
  //  - all 11 repeating tables (diplomaData, traineeAgeFlow, trainerAge,
  //    educationLevelFlow, traineeVulnerable, trainerDisability,
  //    scholarship, specialtyRows, curriculum, infrastructure, furniture,
  //    trainerRoster): unlike the six entities above, VT has no
  //    SxxQxx_RESPONSE_STATUS-style "table is empty/N-A/reported"
  //    companion field for any of them (see the now-empty
  //    FINAL_TABLE_RESPONSE_FIELDS_BY_ENTITY.vocationalTraining below) —
  //    there is no way to tell "legitimately zero rows" (e.g. a center
  //    with no trainees with disabilities) from "respondent skipped this
  //    table" without that signal. Requiring any of them non-empty would
  //    risk blocking real, valid submissions. Omitted per the task's
  //    explicit "if ambiguous, omit and report — do not guess" instruction.
  vocationalTraining: ['name', 'region', 'department', 'subdivision', 'locality', 'area'],
};

// Human-readable, bilingual labels for the dotted `entity.field` paths
// enforceFinalRequiredFields() collects — shown to end users instead of
// the raw internal path (e.g. "enterprise.mainActivity").
const REQUIRED_FIELD_LABELS: Record<string, string> = {
  'respondent.name': 'Nom du répondant / Respondent name',
  'respondent.function': 'Fonction du répondant / Respondent role',
  'respondent.phone1': 'Téléphone du répondant / Respondent phone',
  'enterprise.name': "Nom de l'entreprise / Company name",
  'enterprise.legalStatus': 'Statut juridique / Legal status',
  'enterprise.area': 'Milieu de résidence / Area',
  'enterprise.region': 'Région / Region',
  'enterprise.department': 'Département / Department',
  'enterprise.subdivision': 'Arrondissement / Subdivision',
  'enterprise.phone1': "Téléphone de l'entreprise / Company phone",
  'enterprise.sector': "Secteur d'activité / Business sector",
  'enterprise.mainActivity': 'Activité principale / Main activity',
  'enterprise.permanentWorkers': 'Employés permanents / Permanent workers',
  'enterprise.size': "Taille de l'entreprise / Company size",
  'respondent.email': 'E-mail du répondant / Respondent email',
  'enterprise.locality': 'Localité / Locality',
  'enterprise.poBox': 'Boîte postale / PO Box',
  'enterprise.branch': "Branche d'activité / Branch of activity",
  'enterprise.headOffice': 'Siège social / Head office',
  'enterprise.vacancies': 'Postes vacants / Vacancies',
  'cooperative.name': 'Nom de la coopérative / Cooperative name',
  'cooperative.headOffice': 'Siège social / Head office',
  'cooperative.yearCreated': 'Année de création / Year of creation',
  'cooperative.area': 'Milieu de résidence / Area',
  'cooperative.region': 'Région / Region',
  'cooperative.department': 'Département / Department',
  'cooperative.subdivision': 'Arrondissement / Subdivision',
  'cooperative.locality': 'Localité / Locality',
  'cooperative.phone1': 'Téléphone / Phone',
  'cooperative.poBox': 'Boîte postale / PO Box',
  'cooperative.sector': "Secteur d'activité / Business sector",
  'cooperative.branch': "Branche d'activité / Branch of activity",
  'cooperative.mainActivity': 'Activité principale / Main activity',
  'cooperative.type': 'Type de coopérative / Cooperative type',
  'cooperative.typeOther': 'Précisez le type / Specify cooperative type',
  'cooperative.permanentWorkers': 'Employés permanents / Permanent workers',
  'cooperative.vacancies': 'Postes vacants / Vacancies',
  'ctd.type': 'Type de CTD / Local authority type',
  'ctd.councilType': 'Type de commune / Council type',
  'ctd.yearCreated': 'Année de création / Year of creation',
  'ctd.area': 'Milieu de résidence / Area',
  'ctd.region': 'Région / Region',
  'ctd.department': 'Département / Department',
  'ctd.subdivision': 'Arrondissement / Subdivision',
  'ctd.locality': 'Localité / Locality',
  'ctd.phone1': 'Téléphone / Phone',
  'ctd.poBox': 'Boîte postale / PO Box',
  'ctd.sector': "Secteur d'activité / Business sector",
  'ctd.branch': "Branche d'activité / Branch of activity",
  'ctd.permanentWorkers': 'Employés permanents / Permanent workers',
  'ctd.vacancies': 'Postes vacants / Vacancies',
  'ong.name': "Nom de l'ONG / NGO name",
  'ong.headOffice': 'Siège social / Head office',
  'ong.yearCreated': 'Année de création / Year of creation',
  'ong.area': 'Milieu de résidence / Area',
  'ong.region': 'Région / Region',
  'ong.department': 'Département / Department',
  'ong.subdivision': 'Arrondissement / Subdivision',
  'ong.locality': 'Localité / Locality',
  'ong.phone1': 'Téléphone / Phone',
  'ong.poBox': 'Boîte postale / PO Box',
  'ong.sector': "Secteur d'activité / Business sector",
  'ong.branch': "Branche d'activité / Branch of activity",
  'ong.mainMission': 'Mission principale / Main mission',
  'ong.permanentWorkers': 'Employés permanents / Permanent workers',
  'ong.vacancies': 'Postes vacants / Vacancies',
  'administration.name': "Nom de l'administration / Administration name",
  'administration.area': 'Milieu de résidence / Area',
  'administration.region': 'Région / Region',
  'administration.department': 'Département / Department',
  'administration.subdivision': 'Arrondissement / Subdivision',
  'administration.locality': 'Localité / Locality',
  'administration.phone1': 'Téléphone / Phone',
  'administration.sector': "Secteur d'activité / Business sector",
  'administration.mainMission': 'Mission principale / Main mission',
  'administration.hasProject': 'Existence de projet / Existence of a project',
  'administration.hasSupervisedStructures':
    'Existence de structures sous tutelle / Existence of supervised structures',
  'projectProgram.nature': 'Nature de la structure / Nature of the structure',
  'projectProgram.name': 'Nom / Name',
  'projectProgram.personInCharge': 'Nom du Responsable / Name of the person in charge',
  'projectProgram.area': 'Milieu de résidence / Area',
  'projectProgram.region': 'Région / Region',
  'projectProgram.department': 'Département / Department',
  'projectProgram.subdivision': 'Arrondissement / Subdivision',
  'projectProgram.locality': 'Localité / Locality',
  'projectProgram.phone1': 'Téléphone / Phone',
  'projectProgram.poBox': 'Boîte postale / PO Box',
  'projectProgram.sector': "Secteur d'activité / Business sector",
  'projectProgram.branch': "Branche d'activité / Branch of activity",
  'projectProgram.mainMission': 'Objectif ou mission principale / Objective or main mission',
  'projectProgram.headOffice': 'Siège social / Head office',
  'projectProgram.supervisingMinistry': 'Ministère tutelle / Supervising ministry',
  'projectProgram.status': 'Situation du Projet / Programme / Project / Programme Status',
  'projectProgram.permanentWorkers': 'Employés permanents / Permanent workers',
  'projectProgram.vacancies': 'Postes vacants / Vacancies',
  'S21Q01_RESPONSE_STATUS': 'Demandes d\'emploi — statut / Job applications — status',
  'S22Q01_RESPONSE_STATUS': 'Recrutements permanents — statut / Permanent recruitments — status',
  'S22Q02_RESPONSE_STATUS': 'Recrutements temporaires — statut / Temporary recruitments — status',
  'S22Q03_RESPONSE_STATUS': 'Recrutements par diplôme — statut / Recruitments by diploma — status',
  'S22Q04_RESPONSE_STATUS': 'Recrutements de personnes handicapées — statut / Disability recruitments — status',
  'S22Q05_RESPONSE_STATUS': 'Recrutements de personnes vulnérables — statut / Vulnerable recruitments — status',
  'S23Q01_RESPONSE_STATUS': 'Primo-demandeurs — statut / First-time job seekers — status',
  'S23Q02_RESPONSE_STATUS': 'Primo-recrutements — statut / First-time recruitments — status',
  'S3Q01_RESPONSE_STATUS': 'Départs — statut / Departures — status',
  'S3Q02_RESPONSE_STATUS': 'Motifs de licenciement — statut / Dismissal reasons — status',
  'S3Q03_RESPONSE_STATUS': 'Licenciement / chômage technique — statut / Dismissal / technical unemployment — status',
  'S4Q01_RESPONSE_STATUS': 'Stages — statut / Internships — status',
  'S4Q02_RESPONSE_STATUS': 'Besoins en compétences — statut / Skills needs — status',
  'S4Q03_RESPONSE_STATUS': 'Besoins en formation — statut / Training needs — status',
  'vocationalTraining.name': 'Nom du centre / Center name',
  'vocationalTraining.region': 'Région / Region',
  'vocationalTraining.department': 'Département / Department',
  'vocationalTraining.subdivision': 'Arrondissement / Subdivision',
  'vocationalTraining.locality': 'Localité / Locality',
  'vocationalTraining.area': 'Milieu de résidence / Area',
};

const FINAL_TABLE_RESPONSE_FIELDS = [
  'S21Q01_RESPONSE_STATUS',
  'S22Q01_RESPONSE_STATUS', 'S22Q02_RESPONSE_STATUS',
  'S22Q03_RESPONSE_STATUS', 'S22Q04_RESPONSE_STATUS',
  'S22Q05_RESPONSE_STATUS', 'S23Q01_RESPONSE_STATUS',
  'S23Q02_RESPONSE_STATUS', 'S3Q01_RESPONSE_STATUS',
  'S3Q02_RESPONSE_STATUS', 'S3Q03_RESPONSE_STATUS',
  'S4Q01_RESPONSE_STATUS', 'S4Q02_RESPONSE_STATUS',
  'S4Q03_RESPONSE_STATUS',
] as const;

// Which of the 14 Enterprise-family response-status fields actually exist
// in each entity's compiled AST schema (lib/core/focus/compiler/
// onefop_ast.dart) — enforceFinalRequiredFields() below must only require
// a field for entities whose questionnaire actually renders it, otherwise
// final submission is permanently impossible for any entity whose Section
// 2/3/4 differs from the shared Enterprise/Cooperative/CTD/ONG shape.
//
// Enterprise/Cooperative/CTD/ONG share the full 14-field shape (their
// tableResponseStatus() entries in onefop_ast.dart are either unrestricted
// or explicitly list all four) — unchanged from before this fix.
//
// Administration's AST excludes S22Q02/S22Q03/S23Q01/S23Q02/S3Q03/S4Q03
// (those questions don't exist in the Administration questionnaire), so
// their response-status companions never exist in an Administration
// submission's flat data either — confirmed in onefop_ast.dart's
// tableResponseStatus() calls, each restricted away from "administration".
//
// Projects & Programs has its own, structurally disjoint Sections 2-4
// (PP_S2_ACTIVITIES, PP_S3_OUTCOMES, PP_S4Q01-06) — it has none of
// S21Q01/S22Q01-05/S23Q01-02/S3Q01-03. Its own S4Q01/S4Q02/S4Q03
// response-status wrappers (entityTypes: ["projectProgram"]) happen to be
// registered under the same paper codes as the Enterprise-family ones
// (disjoint entityTypes, no id collision — see onefop_ast.dart), so those
// three are legitimately present and stay required; the rest are not.
const FULL_ENTERPRISE_FAMILY_TABLE_RESPONSE_FIELDS: readonly string[] = FINAL_TABLE_RESPONSE_FIELDS;

const FINAL_TABLE_RESPONSE_FIELDS_BY_ENTITY: Record<string, readonly string[]> = {
  enterprise: FULL_ENTERPRISE_FAMILY_TABLE_RESPONSE_FIELDS,
  cooperative: FULL_ENTERPRISE_FAMILY_TABLE_RESPONSE_FIELDS,
  ctd: FULL_ENTERPRISE_FAMILY_TABLE_RESPONSE_FIELDS,
  ong: FULL_ENTERPRISE_FAMILY_TABLE_RESPONSE_FIELDS,
  // Administration Section 2 is S21Q01–S21Q04 in chronological order since
  // the 2026-09-28 renumbering (census, recruitment, disability,
  // vulnerable) — it has no S22Q0x tables any more.
  administration: [
    'S21Q01_RESPONSE_STATUS',
    'S21Q02_RESPONSE_STATUS',
    'S21Q03_RESPONSE_STATUS',
    'S21Q04_RESPONSE_STATUS',
    'S3Q01_RESPONSE_STATUS',
    'S3Q02_RESPONSE_STATUS',
    'S4Q01_RESPONSE_STATUS',
    'S4Q02_RESPONSE_STATUS',
  ],
  projectProgram: [
    'S4Q01_RESPONSE_STATUS',
    'S4Q02_RESPONSE_STATUS',
    'S4Q03_RESPONSE_STATUS',
    'S4Q04_RESPONSE_STATUS',
    'S4Q05_RESPONSE_STATUS',
    'S4Q06_RESPONSE_STATUS',
  ],
  // VT-8: explicitly empty, not just "absent" — VT's 11 repeating tables
  // have no SxxQxx_RESPONSE_STATUS-style companion field at all (grep of
  // onefop_ast.dart's tableResponseStatus() registrations confirms none
  // target "vocationalTraining"), so there is nothing applicable to
  // require here. Listing it explicitly (rather than leaving it out) is
  // what keeps enforceFinalRequiredFields's `?? FINAL_TABLE_RESPONSE_
  // FIELDS` fallback from firing for VT — that fallback would otherwise
  // silently demand all 14 Enterprise-family status fields, which no VT
  // submission can ever produce, permanently blocking every VT final
  // submission. This is the exact hole the old VT-5 bypass comment
  // (now removed below) warned about.
  vocationalTraining: [],
};

const TABLE_RESPONSE_STATUSES = new Set(['REPORTED', 'NONE', 'NOT_APPLICABLE']);

// ============================================================
// NORMALIZATION HELPER - Converts any entity type to uppercase
// ============================================================
// PROJECT_PROGRAM's mechanical .toLowerCase() would keep the underscore
// ('project_program'), unlike every other entity type (single word, no
// separator). Every lowercase-keyed lookup in this file (FINAL_REQUIRED_
// FIELDS, the DTO's nested property name, flat-key-normalizer's entity
// switch) uses 'projectProgram' instead — matching the frontend's own
// entityTypeForSchema() convention — so this is the one call site that
// needs a special case rather than a plain .toLowerCase().
function toLowerEntityType(normalizedEntityType: string): string {
  if (normalizedEntityType === 'PROJECT_PROGRAM') return 'projectProgram';
  // Same underscore problem as PROJECT_PROGRAM above — a plain
  // .toLowerCase() would keep 'vocational_training', not the camelCase
  // 'vocationalTraining' every lowercase-keyed lookup in this file (and
  // the AST's entityTypes filter, flat-key-normalizer's entity switch)
  // actually uses.
  if (normalizedEntityType === 'VOCATIONAL_TRAINING') return 'vocationalTraining';
  return normalizedEntityType.toLowerCase();
}

function normalizeEntityType(type: string): string {
  const upper = type?.toUpperCase()?.replace(/[\s-]+/g, '_') || '';
  if (upper === 'ENTERPRISE' || upper === 'ENTREPRISE') return 'ENTREPRISE';
  if (upper === 'COOPERATIVE' || upper === 'COOPÉRATIVE') return 'COOPERATIVE';
  if (upper === 'CTD') return 'CTD';
  if (upper === 'ONG' || upper === 'NGO') return 'ONG';
  if (upper === 'ADMINISTRATION') return 'ADMINISTRATION';
  if (upper === 'PROJECT_PROGRAM' || upper === 'PROJECTPROGRAM' || upper === 'PROJECT') return 'PROJECT_PROGRAM';
  if (upper === 'VOCATIONAL_TRAINING' || upper === 'VOCATIONALTRAINING' || upper === 'VT' || upper === 'VTC') return 'VOCATIONAL_TRAINING';
  // Previously fell back to ENTREPRISE — an unrecognized/unsupported
  // entity type must not be silently miscategorized as a company.
  throw new BadRequestException(`Unsupported entity type: ${type}`);
}

function debugLog(label: string, value: any, maxChars = 2000): void {
  try {
    if (value === undefined || value === null) {
      console.log(`\n${label}\n(no data)`);
      return;
    }
    let str: string;
    if (typeof value === 'string') {
      str = value;
    } else {
      try { str = JSON.stringify(value, null, 2); } catch { str = String(value); }
    }
    if (str && str.length > 0) {
      console.log(`\n${label}\n${str.substring(0, maxChars)}${str.length > maxChars ? '\n… (truncated)' : ''}`);
    } else {
      console.log(`\n${label}\n(empty)`);
    }
  } catch (error) {
    console.log(`\n${label}\n(debug error: ${error})`);
  }
}

@Injectable()
export class QuestionnairesService {
  private readonly logger = new Logger(QuestionnairesService.name);

  // Optional with a default so every existing `new QuestionnairesService(prisma)`
  // in *.spec.ts keeps compiling unchanged; NestJS DI (questionnaires.module.ts)
  // passes the real shared instance instead of this fallback.
  constructor(
    private prisma: PrismaService,
    private shadowValidator: OnefopShadowValidatorService = new OnefopShadowValidatorService(
      new OnefopSchemaLoaderService(),
    ),
    @Optional() private eligibilityEngine?: EligibilityEngineService,
  ) {
    if (!this.eligibilityEngine) {
      this.eligibilityEngine = new EligibilityEngineService(this.prisma);
    }
  }

  /**
   * Mirrors DsmoService.getActivePeriod() / OnefopService.getActiveQuarter()
   * but inline here since QuestionnairesModule doesn't import OnefopModule.
   * No open SubmissionRound for ONEFOP means no campaign window is
   * currently collecting final submissions.
   *
   * The `deadline` check matters on its own, not just `status`: a round only
   * gets flipped to CLOSED by a daily cron (CampaignSchedulerService, 6am),
   * which can miss its firing entirely if the service was asleep (Render
   * free-tier idle spin-down). Without this, a campaign whose deadline has
   * passed — and which has already disappeared from every "active
   * campaign" UI — could still silently accept submissions until the cron
   * next happens to run.
   */
  private async assertOnefopRoundOpen(): Promise<void> {
    const round = await this.prisma.submissionRound.findFirst({
      where: {
        module: 'ONEFOP',
        status: { in: ['OPEN', 'EXTENDED'] },
        deadline: { gte: new Date() },
      },
      orderBy: { openedAt: 'desc' },
    });
    if (!round) {
      // Testing bypass: allow submission even if the application period is not open
      console.warn(
        '⚠️ [TESTING MODE] Submission accepted while no ONEFOP submission round is currently open/within deadline.',
      );
      return;
    }
  }

  // Picks the submitting entity's region/department/subdivision/sector out
  // of whichever one of the six per-entity DTO branches is actually present
  // on `questionnaireData`. Extracted to its own method (rather than left
  // inline in submitQuestionnaire) so it's unit-testable in isolation —
  // this is the exact chain a P1 audit finding was raised against for
  // silently omitting PROJECT_PROGRAM, leaving every one of its submissions
  // without a region/department on OnefopSubmission and therefore invisible
  // to REGIONAL/DIVISIONAL reviewer queues.
  private resolveGeoFields(entityForGeo: any): {
    region: string | null;
    department: string | null;
    subdivision: string | null;
    sector: string | null;
  } {
    return {
      region:
        entityForGeo.enterprise?.region ??
        entityForGeo.cooperative?.region ??
        entityForGeo.ctd?.region ??
        entityForGeo.ong?.region ??
        entityForGeo.administration?.region ??
        entityForGeo.projectProgram?.region ??
        entityForGeo.vocationalTraining?.region ?? null,
      department:
        entityForGeo.enterprise?.department ??
        entityForGeo.cooperative?.department ??
        entityForGeo.ctd?.department ??
        entityForGeo.ong?.department ??
        entityForGeo.administration?.department ??
        entityForGeo.projectProgram?.department ??
        entityForGeo.vocationalTraining?.department ?? null,
      subdivision:
        entityForGeo.enterprise?.subdivision ??
        entityForGeo.cooperative?.subdivision ??
        entityForGeo.ctd?.subdivision ??
        entityForGeo.ong?.subdivision ??
        entityForGeo.administration?.subdivision ??
        entityForGeo.projectProgram?.subdivision ??
        entityForGeo.vocationalTraining?.subdivision ?? null,
      // No vocationalTraining fallback here — VT has no economic-sector
      // concept (design note §2, frozen); sector correctly stays null for VT.
      sector:
        entityForGeo.enterprise?.sector ??
        entityForGeo.cooperative?.sector ??
        entityForGeo.ctd?.sector ??
        entityForGeo.ong?.sector ??
        entityForGeo.administration?.sector ??
        entityForGeo.projectProgram?.sector ?? null,
    };
  }

  async submitQuestionnaire(dto: OnefopSubmissionDto): Promise<OnefopResponseDto> {
    const isDraft = dto.isDraft ?? false;

    // Idempotency: the Flutter client generates `formId` once per submit
    // attempt and resends the exact same payload (same formId) if the
    // original request reached the server but timed out before the client
    // saw the response — see SyncQueueService/onefop_form_controller.dart.
    // Without this check, that automatic retry would create a second,
    // duplicate OnefopSubmission row for data that was already saved.
    if (!isDraft && dto.formId) {
      const existing = await this.prisma.onefopSubmission.findUnique({
        where: { submissionId: dto.formId },
      });
      if (existing) {
        return {
          success: true,
          submissionId: existing.submissionId,
          message: 'Formulaire soumis avec succès',
        };
      }
    }

    // Drafts are just in-progress personal scratch data — only the final
    // submission needs an admin-opened campaign window.
    if (!isDraft) {
      await this.assertOnefopRoundOpen();
    }

    // dto.companyId / dto.establishmentId are client-supplied and must
    // never be trusted for attribution — the controller only overrides
    // dto.userId from req.user.id, so without this a caller could edit the
    // request body to attach their submission to a rival company's ID.
    // dto.userId itself IS trustworthy (server-set), so the caller's own
    // Company row — resolved from it — is the only valid source for both
    // fields. Mirrors the same lookup already used by
    // OnefopService.submitForm.
    if (!dto.userId) {
      throw new ForbiddenException('Authentification requise.');
    }
    const submittingCompany = await this.prisma.company.findFirst({
      where: { userId: dto.userId },
    });
    if (!submittingCompany) {
      throw new ForbiddenException("Aucun profil d'entreprise associé à ce compte.");
    }
    const resolvedCompanyId = submittingCompany.id;
    const resolvedEstablishmentId = submittingCompany.establishmentId;

    // Normalize entityType to uppercase
    const normalizedEntityType = normalizeEntityType(dto.entityType);

    // Verbose per-submission dumps (several JSON.stringify calls over full
    // nested payloads) are dev-only: Node writes console.log synchronously
    // when stdout is piped rather than a TTY, which is exactly how Render
    // captures logs — so this was blocking the event loop on every single
    // submission in production for output nobody was reading.
    const debugSubmit = process.env.NODE_ENV !== 'production';
    if (debugSubmit) {
      console.log('\n╔══════════════════════════════════════════════════╗');
      console.log('║         ONEFOP SUBMIT — DEBUG                    ║');
      console.log('╚══════════════════════════════════════════════════╝');
      console.log('entityType (original) :', dto.entityType);
      console.log('entityType (normalized):', normalizedEntityType);
      console.log('isDraft    :', isDraft);
      console.log('userId     :', dto.userId);
      console.log('companyId (resolved):', resolvedCompanyId);
      console.log('establishmentId (resolved):', resolvedEstablishmentId);
      console.log('formId     :', dto.formId);
      console.log('data keys  :', Object.keys(dto.data).length);
      debugLog('📥 Raw dto.data (first 2000 chars):', dto.data);
    }

    const normalized = normalizeFlatKeys(dto.data, toLowerEntityType(normalizedEntityType));

    // Phase 2.7 shadow mode: log-only, never affects acceptance. Final
    // submissions only — drafts are legitimately sparse (skipMissingProperties
    // above) and would just drown the log in required-field noise. Never
    // awaited/blocking: validateAndLog is pure CPU work wrapped in its own
    // try/catch, so a defect in this new validator can't affect a real
    // submission.
    if (!isDraft) {
      this.shadowValidator.validateAndLog(
        toLowerEntityType(normalizedEntityType),
        normalized as Record<string, unknown>,
        dto.formId,
      );
    }

    if (debugSubmit) {
      debugLog('🔄 Normalized keys sample (S0/S1):', {
        S0Q01: normalized['S0Q01'],
        S0Q02: normalized['S0Q02'],
        COOP_S1Q01: normalized['COOP_S1Q01'],
        COOP_S1Q10: normalized['COOP_S1Q10'],
        COOP_S1Q11: normalized['COOP_S1Q11'],
        COOP_S1Q12: normalized['COOP_S1Q12'],
      });
    }

    const nestedData = buildNestedDto(normalized, toLowerEntityType(normalizedEntityType));

    if (debugSubmit) {
      debugLog('🔄 respondent :', nestedData['respondent']);
      debugLog('🔄 cooperative:', nestedData['cooperative']);
      debugLog('🔄 enterprise :', nestedData['enterprise']);
      debugLog('🔄 ctd        :', nestedData['ctd']);
      debugLog('🔄 ong        :', nestedData['ong']);
    }

    let questionnaireData: AnyQuestionnaireDto;
    switch (normalizedEntityType) {
      case 'ENTREPRISE':
        questionnaireData = plainToClass(EnterpriseQuestionnaireDto, nestedData);
        break;
      case 'COOPERATIVE':
        questionnaireData = plainToClass(CooperativeQuestionnaireDto, nestedData);
        break;
      case 'CTD':
        questionnaireData = plainToClass(CtdQuestionnaireDto, nestedData);
        break;
      case 'ONG':
        questionnaireData = plainToClass(OngQuestionnaireDto, nestedData);
        break;
      case 'ADMINISTRATION':
        questionnaireData = plainToClass(AdministrationQuestionnaireDto, nestedData);
        break;
      case 'PROJECT_PROGRAM':
        questionnaireData = plainToClass(ProjectProgramQuestionnaireDto, nestedData);
        break;
      case 'VOCATIONAL_TRAINING':
        questionnaireData = plainToClass(VocationalTrainingQuestionnaireDto, nestedData);
        break;
      default:
        throw new BadRequestException('Invalid entity type');
    }

    const dataErrors = await validate(questionnaireData as object, {
      skipMissingProperties: isDraft,
    });

    if (dataErrors.length > 0) {
      console.log('\n── ❌ Validation errors ────────────────────────────');
      dataErrors.forEach((err, i) => {
        console.log(`  [${i + 1}] property: ${err.property}`);
        console.log(`       value   : ${JSON.stringify(err.value)}`);
        console.log(`       constraints: ${JSON.stringify(err.constraints)}`);
        if (err.children?.length) {
          console.log(`       children: ${JSON.stringify(err.children, null, 2).substring(0, 500)}`);
        }
      });
      console.log('────────────────────────────────────────────────────\n');
      throw new BadRequestException(dataErrors);
    } else if (debugSubmit) {
      // Gated like the other debug output above — Node's console.log is
      // synchronous when stdout is piped (Render's log capture), so an
      // ungated line here was blocking the event loop on every single
      // successful submission in production, not just failed ones.
      console.log('\n── ✅ Validation passed ───────────────────────────\n');
    }

    // VT-8: enforceFinalRequiredFields now runs for VOCATIONAL_TRAINING too
    // (previously bypassed entirely — VT-5's comment here explained that
    // FINAL_TABLE_RESPONSE_FIELDS_BY_ENTITY had no 'vocationalTraining'
    // entry, so its `??` fallback would have wrongly demanded all 14
    // Enterprise-family xxx_RESPONSE_STATUS fields from VT and permanently
    // blocked every VT final submission). That entry is now explicitly `[]`
    // (see FINAL_TABLE_RESPONSE_FIELDS_BY_ENTITY.vocationalTraining above),
    // and FINAL_REQUIRED_FIELDS.vocationalTraining now carries VT's own
    // required identification fields (see that map's comment for how the
    // list was derived), so the bypass is no longer needed for any entity.
    if (!isDraft) {
      this.enforceFinalRequiredFields(
        questionnaireData,
        normalized as Record<string, unknown>,
        toLowerEntityType(normalizedEntityType),
      );
    }

    const flat = normalized as unknown as FlatFormData;

    // Resolve geo + sector IDs before transaction
    const entityForGeo = (questionnaireData as any);
    const { region: geoRegion, department: geoDept, subdivision: geoSubdiv, sector: geoSector } =
      this.resolveGeoFields(entityForGeo);
    // Administration has no permanentWorkers/vacancies equivalent (its S1
    // asks about projects/supervised structures instead) — headline
    // worker/vacancy figures are correctly null for this entity type.
    const headlineWorkers =
      entityForGeo.enterprise?.permanentWorkers ??
      entityForGeo.cooperative?.permanentWorkers ??
      entityForGeo.ctd?.permanentWorkers ??
      entityForGeo.ong?.permanentWorkers ?? null;
    const headlineVacancies =
      entityForGeo.enterprise?.vacancies ??
      entityForGeo.cooperative?.vacancies ??
      entityForGeo.ctd?.vacancies ??
      entityForGeo.ong?.vacancies ?? null;

    // Coherence flags are non-blocking and are only computed for final
    // submissions. VT uses its own numeric cross-table rules from design
    // note §10; the other entities use the shared S22/S3 checks.
    const coherenceFlags = isDraft
      ? []
      : normalizedEntityType === 'VOCATIONAL_TRAINING'
        ? this.checkVtCoherence(flat)
        : this.checkCoherence(flat, normalizedEntityType, headlineWorkers, headlineVacancies);

    const { regionId, departmentId, subdivisionId, sectorId } =
      await this.resolveGeoAndSector(
        this.prisma,
        geoRegion,
        geoDept,
        geoSubdiv,
        geoSector,
      );

    // Every child table below is written via a single nested Prisma `create`
    // call (one round trip to the query engine) instead of ~19 sequential
    // awaits inside an interactive transaction. Prisma binds an interactive
    // transaction to one connection, so those awaits can't run concurrently
    // anyway (Promise.all on the same `tx` risks "transaction already
    // closed" errors) — a nested write is the supported way to cut both the
    // round-trip count and how long the pooled connection is checked out.
    const respondent = questionnaireData.respondent;

    let entityDetailRelation: Record<string, any> = {};
    // Projects & Programs' Section 2 activities — populated only when
    // normalizedEntityType === 'PROJECT_PROGRAM' below; a real child
    // record per filled-in row, wired into the createMany block further
    // down alongside the other fact-row tables.
    let projectProgramActivityRows: Record<string, any>[] = [];
    // Vocational Training's 12 child-row arrays (VT-5) — populated only
    // when normalizedEntityType === 'VOCATIONAL_TRAINING' below. Unlike
    // the six existing entities' shared fact tables (diplomaRows,
    // cspGenderAgeRows, etc. — re-derived from `flat` via buildXxxRows()
    // further down), these come directly from buildNestedDto's own VT-4
    // arrays on `questionnaireData` — VT-4 already produced Prisma-ready
    // rows from the flat keys inside the normalizer, so re-parsing them
    // again here would duplicate that frozen logic. Read-only pass-through
    // (same pattern as projectProgramActivityRows above, VT's closest
    // sibling: its own entity-specific child table, not a shared one).
    let vtDiplomaDataRows: Record<string, any>[] = [];
    let vtTraineeAgeFlowRows: Record<string, any>[] = [];
    let vtTrainerAgeRows: Record<string, any>[] = [];
    let vtEducationLevelFlowRows: Record<string, any>[] = [];
    let vtTraineeVulnerableRows: Record<string, any>[] = [];
    let vtTrainerDisabilityRows: Record<string, any>[] = [];
    let vtScholarshipRows: Record<string, any>[] = [];
    let vtSpecialtyRows: Record<string, any>[] = [];
    let vtCurriculaRows: Record<string, any>[] = [];
    let vtInfrastructureRows: Record<string, any>[] = [];
    let vtFurnitureRows: Record<string, any>[] = [];
    let vtTrainerRosterRows: Record<string, any>[] = [];
    if (normalizedEntityType === 'ENTREPRISE' && 'enterprise' in questionnaireData && questionnaireData.enterprise) {
      const e = questionnaireData.enterprise;
      entityDetailRelation = {
        enterpriseDetail: {
          create: {
            legalStatus: this.mapLegalStatus(e.legalStatus as 1 | 2 | 3 | 4),
            companyName: e.name ?? '',
            area: this.mapArea(e.area as 1 | 2),
            region: e.region ?? '',
            department: e.department ?? '',
            subdivision: e.subdivision ?? '',
            locality: e.locality ?? null,
            phone1: e.phone1 ?? '',
            phone2: e.phone2 ?? null,
            poBox: e.poBox ?? null,
            sector: this.mapSector(e.sector as 1 | 2 | 3),
            sectorId,
            branch: e.branch ?? null,
            mainActivity: e.mainActivity ?? '',
            headOffice: e.headOffice ?? null,
            permanentWorkers: e.permanentWorkers ?? 0,
            vacancies: e.vacancies ?? 0,
            enterpriseSize: this.mapCompanySize(e.size as 1 | 2 | 3 | 4),
          },
        },
      };
    } else if (normalizedEntityType === 'COOPERATIVE' && 'cooperative' in questionnaireData && questionnaireData.cooperative) {
      const c = questionnaireData.cooperative;
      entityDetailRelation = {
        cooperativeDetail: {
          create: {
            cooperativeName: c.name ?? '',
            headOffice: c.headOffice ?? null,
            yearCreated: c.yearCreated ?? null,
            area: this.mapArea(c.area as 1 | 2),
            region: c.region ?? null,
            department: c.department ?? null,
            subdivision: c.subdivision ?? null,
            locality: c.locality ?? null,
            phone1: c.phone1 ?? null,
            phone2: c.phone2 ?? null,
            poBox: c.poBox ?? null,
            sector: this.mapSector(c.sector as 1 | 2 | 3),
            sectorId,
            branch: c.branch ?? null,
            mainActivity: c.mainActivity ?? null,
            cooperativeType: this.mapCooperativeType(c.type as 1 | 2 | 3),
            cooperativeTypeOther: c.typeOther ?? null,
            permanentWorkers: c.permanentWorkers ?? null,
            vacancies: c.vacancies ?? null,
          },
        },
      };
    } else if (normalizedEntityType === 'CTD' && 'ctd' in questionnaireData && questionnaireData.ctd) {
      const ct = questionnaireData.ctd;
      entityDetailRelation = {
        ctdDetail: {
          create: {
            ctdType: this.mapCtdType(ct.type as 1 | 2),
            councilType: ct.councilType ? this.mapCouncilType(ct.councilType as 1 | 2) : null,
            yearCreated: ct.yearCreated ?? null,
            area: this.mapArea(ct.area as 1 | 2),
            region: ct.region ?? null,
            department: ct.department ?? null,
            subdivision: ct.subdivision ?? null,
            locality: ct.locality ?? null,
            phone1: ct.phone1 ?? null,
            phone2: ct.phone2 ?? null,
            poBox: ct.poBox ?? null,
            sector: this.mapSector(ct.sector as 1 | 2 | 3),
            sectorId,
            branch: ct.branch ?? null,
            permanentWorkers: ct.permanentWorkers ?? null,
            vacancies: ct.vacancies ?? null,
          },
        },
      };
    } else if (normalizedEntityType === 'ONG' && 'ong' in questionnaireData && questionnaireData.ong) {
      const o = questionnaireData.ong;
      entityDetailRelation = {
        ongDetail: {
          create: {
            ongName: o.name ?? '',
            headOffice: o.headOffice ?? null,
            yearCreated: o.yearCreated ?? null,
            area: this.mapArea(o.area as 1 | 2),
            region: o.region ?? null,
            department: o.department ?? null,
            subdivision: o.subdivision ?? null,
            locality: o.locality ?? null,
            phone1: o.phone1 ?? null,
            phone2: o.phone2 ?? null,
            poBox: o.poBox ?? null,
            sector: this.mapSector(o.sector as 1 | 2 | 3),
            sectorId,
            branch: o.branch ?? null,
            mainMission: o.mainMission ?? null,
            permanentWorkers: o.permanentWorkers ?? null,
            vacancies: o.vacancies ?? null,
          },
        },
      };
    } else if (normalizedEntityType === 'ADMINISTRATION' && 'administration' in questionnaireData && questionnaireData.administration) {
      const a = questionnaireData.administration;
      entityDetailRelation = {
        administrationDetail: {
          create: {
            name: a.name ?? '',
            sigle: a.sigle ?? null,
            area: this.mapArea(a.area as 1 | 2),
            region: a.region ?? '',
            department: a.department ?? '',
            subdivision: a.subdivision ?? '',
            locality: a.locality ?? null,
            phone1: a.phone1 ?? '',
            phone2: a.phone2 ?? null,
            poBox: a.poBox ?? null,
            sector: this.mapSector(a.sector as 1 | 2 | 3),
            sectorId,
            branch: a.branch ?? null,
            mainMission: a.mainMission ?? '',
            hasProject: a.hasProject === 1,
            projectCount: a.projectCount ?? null,
            hasSupervisedStructures: a.hasSupervisedStructures === 1,
            supervisedStructureCount: a.supervisedStructureCount ?? null,
          },
        },
      };
    } else if (normalizedEntityType === 'PROJECT_PROGRAM' && 'projectProgram' in questionnaireData && questionnaireData.projectProgram) {
      const p = questionnaireData.projectProgram;
      const outcomes = (questionnaireData as any).outcomes ?? {};
      entityDetailRelation = {
        projectProgramDetail: {
          create: {
            nature: String(p.nature ?? ''),
            name: p.name ?? '',
            sigle: p.sigle ?? null,
            personInCharge: p.personInCharge ?? '',
            area: this.mapArea(p.area as 1 | 2),
            region: p.region ?? '',
            department: p.department ?? '',
            subdivision: p.subdivision ?? '',
            locality: p.locality ?? null,
            phone1: p.phone1 ?? '',
            phone2: p.phone2 ?? null,
            poBox: p.poBox ?? null,
            sector: this.mapSector(p.sector as 1 | 2 | 3),
            sectorId,
            branch: p.branch ?? null,
            mainMission: p.mainMission ?? '',
            headOffice: p.headOffice ?? null,
            supervisingMinistry: p.supervisingMinistry ?? null,
            status: String(p.status ?? ''),
            stopReason: p.stopReason != null ? String(p.stopReason) : null,
            permanentWorkers: p.permanentWorkers ?? 0,
            vacancies: p.vacancies ?? null,
            employedCurrent: outcomes.employed?.current ?? null,
            employedOutlookDec: outcomes.employed?.outlookDec ?? null,
            employedOutlookJune: outcomes.employed?.outlookJune ?? null,
            selfEmployedCurrent: outcomes.selfEmployed?.current ?? null,
            selfEmployedOutlookDec: outcomes.selfEmployed?.outlookDec ?? null,
            selfEmployedOutlookJune: outcomes.selfEmployed?.outlookJune ?? null,
            jobsCreatedCurrent: outcomes.jobsCreated?.current ?? null,
            jobsCreatedOutlookDec: outcomes.jobsCreated?.outlookDec ?? null,
            jobsCreatedOutlookJune: outcomes.jobsCreated?.outlookJune ?? null,
            trainedCurrent: outcomes.trained?.current ?? null,
            trainedOutlookDec: outcomes.trained?.outlookDec ?? null,
            trainedOutlookJune: outcomes.trained?.outlookJune ?? null,
          },
        },
      };
      // Section 2's activities — a real child record per filled-in row
      // (see prisma/schema.prisma's ProjectProgramActivity), not the
      // generic createMany-of-fact-rows pattern the CSP tables below use.
      const activities = (questionnaireData as any).activities as
        | Array<Record<string, unknown>>
        | undefined;
      if (activities && activities.length > 0) {
        projectProgramActivityRows = activities.map((row, i) => ({
          rowIndex: i + 1,
          description: (row.description as string) ?? null,
          targetPopulation: (row.targetPopulation as string) ?? null,
          supportType: (row.supportType as string) ?? null,
          scope: (row.scope as string) ?? null,
          startDate: (row.startDate as string) ?? null,
          duration: (row.duration as string) ?? null,
        }));
      }
    } else if (normalizedEntityType === 'VOCATIONAL_TRAINING' && 'vocationalTraining' in questionnaireData && questionnaireData.vocationalTraining) {
      // VT-5. Field names/nullability match VocationalTrainingIdentificationDto
      // (VT-3) / OnefopVocationalTrainingDetail (VT-1) exactly — no remapping
      // or reinterpretation. `name` is the DTO/Prisma's one required field
      // (`?? ''` mirrors every sibling's own required-name fallback);
      // everything else is `?? null` (or `?? []` for the 18 array columns,
      // already guaranteed [] by the normalizer's setStrArray, never
      // undefined — the `?? []` here is redundant-but-harmless, matching
      // this block's own "don't trust upstream silently" style). No
      // sectorId — VT has no economic-sector concept (design note §2).
      const v = questionnaireData.vocationalTraining;
      entityDetailRelation = {
        vocationalTrainingDetail: {
          create: {
            structureCode: v.structureCode ?? null,
            name: v.name ?? '',
            sigle: v.sigle ?? null,
            region: v.region ?? null,
            department: v.department ?? null,
            subdivision: v.subdivision ?? null,
            commune: v.commune ?? null,
            locality: v.locality ?? null,
            area: v.area ?? null,
            educationSystem: v.educationSystem ?? null,
            cfpType: v.cfpType ?? null,
            functionalStatus: v.functionalStatus ?? null,
            nonFunctionalReason: v.nonFunctionalReason ?? null,
            nonFunctionalReasonOther: v.nonFunctionalReasonOther ?? null,
            yearOfEstablishment: v.yearOfEstablishment ?? null,
            respondentSex: v.respondentSex ?? null,
            promoterName: v.promoterName ?? null,
            promoterSex: v.promoterSex ?? null,
            promoterPhone1: v.promoterPhone1 ?? null,
            promoterPhone2: v.promoterPhone2 ?? null,
            promoterEmail: v.promoterEmail ?? null,

            hasStateAgreement: v.hasStateAgreement ?? null,
            agreementTypes: v.agreementTypes ?? [],
            siteCount: v.siteCount ?? null,
            sharesInfrastructure: v.sharesInfrastructure ?? null,
            sharedWithSchoolName: v.sharedWithSchoolName ?? null,
            hasSpecialNeedsTrainers: v.hasSpecialNeedsTrainers ?? null,
            specialNeedsTrainerTotal: v.specialNeedsTrainerTotal ?? null,
            specialNeedsTrainerFemale: v.specialNeedsTrainerFemale ?? null,
            hasAccessRamps: v.hasAccessRamps ?? null,
            hasDirectorOffice: v.hasDirectorOffice ?? null,
            poBox: v.poBox ?? null,
            email: v.email ?? null,
            website: v.website ?? null,
            isAccredited: v.isAccredited ?? null,
            lastAccreditationYear: v.lastAccreditationYear ?? null,
            accreditationOrderNumber: v.accreditationOrderNumber ?? null,
            accreditationOrderDate: v.accreditationOrderDate ?? null,
            trainingTypesOffered: v.trainingTypesOffered ?? [],
            totalTraineesDeclared: v.totalTraineesDeclared ?? null,
            totalTrainersDeclared: v.totalTrainersDeclared ?? null,
            traineesFromLowerSecondary: v.traineesFromLowerSecondary ?? null,
            traineesFromUpperSecondary: v.traineesFromUpperSecondary ?? null,
            hasEnergySource: v.hasEnergySource ?? null,
            isEnergySourceFunctional: v.isEnergySourceFunctional ?? null,
            energySourceTypes: v.energySourceTypes ?? [],
            hasWaterSource: v.hasWaterSource ?? null,
            waterSourceTypes: v.waterSourceTypes ?? [],
            hasHandwashingDevice: v.hasHandwashingDevice ?? null,
            hasReceivedHealthCampaign: v.hasReceivedHealthCampaign ?? null,
            hasFirstAidBox: v.hasFirstAidBox ?? null,
            hasDispensary: v.hasDispensary ?? null,
            hasFunctionalLibrary: v.hasFunctionalLibrary ?? null,
            fenceStatus: v.fenceStatus ?? null,
            hasSchoolCouncil: v.hasSchoolCouncil ?? null,
            hasLevelCouncil: v.hasLevelCouncil ?? null,
            hasDisciplinaryCouncil: v.hasDisciplinaryCouncil ?? null,
            hasFunctionalLatrines: v.hasFunctionalLatrines ?? null,
            latrineTypes: v.latrineTypes ?? [],
            latrinesSeparateByGender: v.latrinesSeparateByGender ?? null,
            latrinesSeparateFromStaff: v.latrinesSeparateFromStaff ?? null,
            latrineCabinTotalCount: v.latrineCabinTotalCount ?? null,
            latrineCabinGirlsCount: v.latrineCabinGirlsCount ?? null,
            hasPlayground: v.hasPlayground ?? null,
            playgroundTypes: v.playgroundTypes ?? [],
            hasIctTools: v.hasIctTools ?? null,
            ictToolsForTrainersCount: v.ictToolsForTrainersCount ?? null,
            ictToolsInternetCount: v.ictToolsInternetCount ?? null,
            trainersIctTrained: v.trainersIctTrained ?? null,
            trainersIctTrainedTotal: v.trainersIctTrainedTotal ?? null,
            trainersIctTrainedFemale: v.trainersIctTrainedFemale ?? null,
            trainersViolenceTraining: v.trainersViolenceTraining ?? null,
            trainersPssTraining: v.trainersPssTraining ?? null,
            hasBoarding: v.hasBoarding ?? null,
            hasGbvMechanism: v.hasGbvMechanism ?? null,
            hasCanteen: v.hasCanteen ?? null,

            facedCrisis: v.facedCrisis ?? null,
            crisisTypes: v.crisisTypes ?? [],
            crisisClosedCenter: v.crisisClosedCenter ?? null,
            closureDurationWeeks: v.closureDurationWeeks ?? null,
            siteRelocated: v.siteRelocated ?? null,
            relocationLocality: v.relocationLocality ?? null,
            traineesReassigned: v.traineesReassigned ?? null,
            reassignedTo: v.reassignedTo ?? null,
            hasEarlyWarningSystem: v.hasEarlyWarningSystem ?? null,
            earlyWarningDescription: v.earlyWarningDescription ?? null,
            earlyWarningFunctional: v.earlyWarningFunctional ?? null,
            trainersInnovativePedagogyTrained: v.trainersInnovativePedagogyTrained ?? null,
            trainersInnovativePedagogyMale: v.trainersInnovativePedagogyMale ?? null,
            trainersInnovativePedagogyFemale: v.trainersInnovativePedagogyFemale ?? null,
            trainersCrisisPedagogyTrained: v.trainersCrisisPedagogyTrained ?? null,
            trainersCrisisPedagogyMale: v.trainersCrisisPedagogyMale ?? null,
            trainersCrisisPedagogyFemale: v.trainersCrisisPedagogyFemale ?? null,
            trainersDrrmTrained: v.trainersDrrmTrained ?? null,
            trainersDrrmMale: v.trainersDrrmMale ?? null,
            trainersDrrmFemale: v.trainersDrrmFemale ?? null,
            trainersEvacuationDrillTrained: v.trainersEvacuationDrillTrained ?? null,
            trainersEvacuationDrillMale: v.trainersEvacuationDrillMale ?? null,
            trainersEvacuationDrillFemale: v.trainersEvacuationDrillFemale ?? null,
            trainersOtherEmergencyTrained: v.trainersOtherEmergencyTrained ?? null,
            trainersOtherEmergencyMale: v.trainersOtherEmergencyMale ?? null,
            trainersOtherEmergencyFemale: v.trainersOtherEmergencyFemale ?? null,
            hasStudentRecordsSecurity: v.hasStudentRecordsSecurity ?? null,
            hasTextbookSecurity: v.hasTextbookSecurity ?? null,
            hasContingencyPlan: v.hasContingencyPlan ?? null,
            traineesTrainedOnProtection: v.traineesTrainedOnProtection ?? null,

            hasTraineeStudyGuides: v.hasTraineeStudyGuides ?? null,
            traineeStudyGuideCount: v.traineeStudyGuideCount ?? null,
            hasTrainerStudyGuides: v.hasTrainerStudyGuides ?? null,
            trainerStudyGuideCount: v.trainerStudyGuideCount ?? null,

            hasCareerGuidanceService: v.hasCareerGuidanceService ?? null,
            careerGuidanceTimings: v.careerGuidanceTimings ?? [],
            traineesChooseWithSupport: v.traineesChooseWithSupport ?? null,
            collaboratesWithCiopCosup: v.collaboratesWithCiopCosup ?? null,
            guidanceSupportTypes: v.guidanceSupportTypes ?? [],
            guidanceSupportOther: v.guidanceSupportOther ?? null,
            hasPostTrainingFollowUp: v.hasPostTrainingFollowUp ?? null,
            followUpMechanisms: v.followUpMechanisms ?? [],
            followUpMechanismOther: v.followUpMechanismOther ?? null,
            hasInsertionSupportUnit: v.hasInsertionSupportUnit ?? null,
            hasTraineeDatabaseTool: v.hasTraineeDatabaseTool ?? null,
            hasJobSearchSupportTool: v.hasJobSearchSupportTool ?? null,
            insertedFormalSectorCount: v.insertedFormalSectorCount ?? null,
            insertedInformalSectorCount: v.insertedInformalSectorCount ?? null,
            seekingEmploymentCount: v.seekingEmploymentCount ?? null,

            hasHivAidsRules: v.hasHivAidsRules ?? null,
            hivRulesCoverSafety: v.hivRulesCoverSafety ?? null,
            hivRulesCoverStigmaHiv: v.hivRulesCoverStigmaHiv ?? null,
            hivRulesCoverStigmaOther: v.hivRulesCoverStigmaOther ?? null,
            hivRulesCoverHarassment: v.hivRulesCoverHarassment ?? null,
            hasDisciplinaryProcedures: v.hasDisciplinaryProcedures ?? null,
            pupilsCommsChannels: v.pupilsCommsChannels ?? [],
            teachingStaffCommsChannels: v.teachingStaffCommsChannels ?? [],
            nonTeachingStaffCommsChannels: v.nonTeachingStaffCommsChannels ?? [],
            parentsCommsChannels: v.parentsCommsChannels ?? [],
            schoolCouncilCommsChannels: v.schoolCouncilCommsChannels ?? [],
            addressesIstIssues: v.addressesIstIssues ?? null,
            traineesReceivedFullSexEd: v.traineesReceivedFullSexEd ?? null,
            genericLifeSkillsInSyllabus: v.genericLifeSkillsInSyllabus ?? null,
            genericLifeSkillsExtracurricular: v.genericLifeSkillsExtracurricular ?? null,
            reproHealthEdInSyllabus: v.reproHealthEdInSyllabus ?? null,
            reproHealthEdExtracurricular: v.reproHealthEdExtracurricular ?? null,
            hivTransmissionEdInSyllabus: v.hivTransmissionEdInSyllabus ?? null,
            hivTransmissionEdExtracurricular: v.hivTransmissionEdExtracurricular ?? null,
            trainersDeliveredSexEd: v.trainersDeliveredSexEd ?? null,
            trainersPassedOnToStudents: v.trainersPassedOnToStudents ?? null,
            heldParentOrientationSessions: v.heldParentOrientationSessions ?? null,

            vacataireProfMale: v.vacataireProfMale ?? null,
            vacataireProfFemale: v.vacataireProfFemale ?? null,
            vacataireNonProfMale: v.vacataireNonProfMale ?? null,
            vacataireNonProfFemale: v.vacataireNonProfFemale ?? null,
            permanentMale: v.permanentMale ?? null,
            permanentFemale: v.permanentFemale ?? null,
            contractualMale: v.contractualMale ?? null,
            contractualFemale: v.contractualFemale ?? null,

            facesDifficulties: v.facesDifficulties ?? null,
            difficultyTypes: v.difficultyTypes ?? [],
            difficultyOtherTexts: v.difficultyOtherTexts ?? [],
            perspectives: v.perspectives ?? [],
          },
        },
      };

      // 12 child arrays — pass-through from questionnaireData (already
      // Prisma-shaped by VT-4's normalizer), not re-derived from `flat`.
      // Undefined -> [] only; no field remapping, no reinterpretation.
      const qd = questionnaireData as any;
      vtDiplomaDataRows = qd.diplomaData ?? [];
      vtTraineeAgeFlowRows = qd.traineeAgeFlow ?? [];
      vtTrainerAgeRows = qd.trainerAge ?? [];
      vtEducationLevelFlowRows = qd.educationLevelFlow ?? [];
      vtTraineeVulnerableRows = qd.traineeVulnerable ?? [];
      vtTrainerDisabilityRows = qd.trainerDisability ?? [];
      vtScholarshipRows = qd.scholarship ?? [];
      vtSpecialtyRows = qd.specialtyRows ?? [];
      vtCurriculaRows = qd.curriculum ?? [];
      vtInfrastructureRows = qd.infrastructure ?? [];
      vtFurnitureRows = qd.furniture ?? [];
      vtTrainerRosterRows = qd.trainerRoster ?? [];
    }

    // Administration's S21Q01/S22Q01/S3Q01 use SFP status categories
    // (Fonctionnaire/Décisionnaire/Contractuelle) instead of the CSP
    // categories the other four entity types use — mirrors the same
    // row-key parameterization applied to the frontend compiler and
    // flat-key-normalizer.ts. Prefixes that don't apply to Administration
    // (s22q02, s23q01/02) find no matching flat keys either way, so
    // passing them the same category list is harmless.
    const factRowCspCategories = normalizedEntityType === 'ADMINISTRATION'
      ? ['fonctionnaire', 'decisionnaire', 'contractuelle']
      : ['cadres', 'foremen', 'workers'];
    const factRowCspCategoriesWithTotal = [...factRowCspCategories, 'total'];

    // The four csp/gender/age prefixes previously ran as four separate
    // createMany round trips against the same table — they only differ by
    // the `tableName` discriminator column, so one combined createMany call
    // produces identical rows. Projects & Programs has its own 4 CSP
    // gender/age tables (S4Q01-04: counted/recruited x permanent/
    // temporary) instead of s21q01/s22q01/s22q02/s23q01 — always standard
    // CSP rows, never Administration's SFP substitution.
    const cspGenderAgeRows = normalizedEntityType === 'PROJECT_PROGRAM'
      ? this.buildCspGenderAgeRows(flat, [
          { prefix: 'pp_s4q01', tableName: 'pp_s4q01' },
          { prefix: 'pp_s4q02', tableName: 'pp_s4q02' },
          { prefix: 'pp_s4q03', tableName: 'pp_s4q03' },
          { prefix: 'pp_s4q04', tableName: 'pp_s4q04' },
        ], ['cadres', 'foremen', 'workers'])
      : normalizedEntityType === 'ADMINISTRATION'
      // Administration (renumbered 2026-09-28): S21Q01 census, S21Q02
      // recruitment. S21Q02 keeps the 's22q01' tableName — the recruitment
      // discriminator its predecessor (Administration S22Q01) was stored
      // under — so analytics and exports read one recruitment series
      // across declarations filed before and after the renumbering.
      ? this.buildCspGenderAgeRows(flat, [
          { prefix: 's21q01', tableName: 's21q01' },
          { prefix: 's21q02', tableName: 's22q01' },
        ], factRowCspCategories)
      : this.buildCspGenderAgeRows(flat, [
          { prefix: 's21q01', tableName: 's21q01' },
          { prefix: 's22q01', tableName: 's22q01' },
          { prefix: 's22q02', tableName: 's22q02' },
          { prefix: 's23q01', tableName: 's23q01' },
        ], factRowCspCategories);
    const diplomaRows = this.buildDiplomaRows(flat);
    // Projects & Programs' S4Q05 (disability) is the same csp_status_
    // gender_table shape as S22Q04, just under its own prefix — reused
    // directly, no new table/enum needed (CADRES/FOREMEN/WORKERS were
    // already valid CspCategory values before this phase).
    // Administration's S21Q03 / S21Q04 have no permanent/temporary status
    // (category × sex, nature × sex); their rows are stored with status
    // TOTAL, an existing DisabilityStatus value — no schema change.
    const disabilityRows = normalizedEntityType === 'PROJECT_PROGRAM'
      ? this.buildDisabilityRows(flat, 'pp_s4q05')
      : normalizedEntityType === 'ADMINISTRATION'
        ? this.buildStatuslessDisabilityRows(flat, 's21q03', factRowCspCategoriesWithTotal)
        : this.buildDisabilityRows(flat, 's22q04', factRowCspCategoriesWithTotal);
    // S4Q06 (vulnerable) is ALSO csp_status_gender_table-shaped for this
    // entity, unlike the other four entities' named-vulnerability-type
    // S22Q05 — VulnerableType already has CADRES_VULN/FOREMEN_VULN/
    // WORKERS_VULN/TOTAL_VULN (unused until now), so no schema change is
    // needed; see buildCspVulnerableRows below.
    const vulnerableRows = normalizedEntityType === 'PROJECT_PROGRAM'
      ? this.buildCspVulnerableRows(flat, 'pp_s4q06')
      : normalizedEntityType === 'ENTREPRISE'
        ? this.buildVulnerableEnterpriseRows(flat)
        : normalizedEntityType === 'ADMINISTRATION'
          ? this.buildStatuslessVulnerableRows(flat, 's21q04')
          : this.buildVulnerableOtherRows(flat);
    const firstTimeWorkerRows = this.buildFirstTimeWorkerRows(flat);
    const jobApplicationRows = this.buildJobApplicationRows(flat, factRowCspCategoriesWithTotal);
    const registeredSeekerRows = this.buildRegisteredSeekerRows(flat);
    const departureRows = this.buildDepartureRows(flat, factRowCspCategoriesWithTotal);
    const dismissalReasonRows = this.buildDismissalReasonRows(flat);
    const dismissalUnemploymentRows = this.buildDismissalUnemploymentRows(flat);
    const internshipRows = this.buildInternshipRows(flat);
    const skillNeedRows = this.buildSkillNeedRows(flat);
    const trainingNeedRows = this.buildTrainingNeedRows(flat);

    // Resolved once so surveyYear and quarterCode agree with each other —
    // surveyYear is the reporting period's own year (parsed from the
    // quarter, e.g. "2025-T1" → 2025), not the machine's current date,
    // which would drift wrong for anything filed after its period ends.
    const resolvedQuarterCode = dto.quarterCode ?? this.getCurrentQuarter();

    // Finding #3: a company can't have two live (non-draft) submissions
    // for the same quarter. "Live" = PENDING_REVIEW or APPROVED — DRAFT
    // rows are excluded (this whole block is skipped for isDraft below),
    // and REJECTED/CORRECTION_REQUESTED are excluded because the review
    // flow (approve/reject/requestCorrection) only ever updates the
    // existing row in place; it never frees it any other way, and the
    // client always mints a new formId on resubmit, so a corrected
    // declaration must be allowed to land as a new row once the old one
    // is rejected. The formId exclusion below lets a retry of the same
    // in-flight submission (offline queue, double-tap racing the same
    // request) through — that's not a second submission, it's the same
    // one. See prisma/migrations/20260909100000_add_onefop_submission_duplicate_guard
    // for the matching partial unique index (belt-and-suspenders against
    // a concurrent race this pre-check alone can't close).
    if (!isDraft) {
      const conflicting = await this.prisma.onefopSubmission.findFirst({
        where: {
          companyId: resolvedCompanyId,
          quarterCode: resolvedQuarterCode,
          status: { in: ['PENDING_REVIEW', 'APPROVED'] },
          ...(dto.formId ? { submissionId: { not: dto.formId } } : {}),
        },
      });
      if (conflicting) {
        throw new ConflictException(
          'Une déclaration est déjà en cours pour ce trimestre. / ' +
          'A declaration already exists for this quarter.',
        );
      }
    }

    let result: { submissionId: string };
    try {
      result = await this.prisma.onefopSubmission.create({
        data: {
          submissionId: dto.formId || randomUUID(),
          formType: normalizedEntityType,
          rawData: dto.data as any,
          surveyYear: questionnaireData.surveyYear ?? surveyYearFromQuarterCode(resolvedQuarterCode),
          submissionDate: new Date(),
          establishmentId: resolvedEstablishmentId,
          quarterCode: resolvedQuarterCode,
          region: geoRegion,
          department: geoDept,
          subdivision: geoSubdiv,
          status: isDraft ? 'DRAFT' : 'PENDING_REVIEW',
          flags: coherenceFlags.length ? (coherenceFlags as any) : undefined,
          user: { connect: { id: dto.userId } },
          company: { connect: { id: resolvedCompanyId } },
          regionRef: regionId ? { connect: { id: regionId } } : undefined,
          departmentRef: departmentId ? { connect: { id: departmentId } } : undefined,
          subdivisionRef: subdivisionId ? { connect: { id: subdivisionId } } : undefined,
          respondent: respondent ? {
            create: {
              respondentName: respondent.name ?? '',
              respondentFunction: respondent.function ?? '',
              phone1: respondent.phone1 ?? '',
              phone2: respondent.phone2 ?? null,
              email: respondent.email ?? null,
            },
          } : undefined,
          ...entityDetailRelation,
          cspGenderAge: cspGenderAgeRows.length ? { createMany: { data: cspGenderAgeRows as any, skipDuplicates: true } } : undefined,
          diplomaData: diplomaRows.length ? { createMany: { data: diplomaRows as any, skipDuplicates: true } } : undefined,
          disabilityData: disabilityRows.length ? { createMany: { data: disabilityRows as any, skipDuplicates: true } } : undefined,
          vulnerableData: vulnerableRows.length ? { createMany: { data: vulnerableRows as any, skipDuplicates: true } } : undefined,
          firstTimeWorkers: firstTimeWorkerRows.length ? { createMany: { data: firstTimeWorkerRows as any, skipDuplicates: true } } : undefined,
          jobApplicationData: jobApplicationRows.length ? { createMany: { data: jobApplicationRows as any, skipDuplicates: true } } : undefined,
          registeredSeekers: registeredSeekerRows.length ? { createMany: { data: registeredSeekerRows as any, skipDuplicates: true } } : undefined,
          departureData: departureRows.length ? { createMany: { data: departureRows as any, skipDuplicates: true } } : undefined,
          dismissalReasons: dismissalReasonRows.length ? { createMany: { data: dismissalReasonRows as any, skipDuplicates: true } } : undefined,
          dismissalUnemployment: dismissalUnemploymentRows.length ? { createMany: { data: dismissalUnemploymentRows as any, skipDuplicates: true } } : undefined,
          internshipData: internshipRows.length ? { createMany: { data: internshipRows as any, skipDuplicates: true } } : undefined,
          skillNeeds: skillNeedRows.length ? { createMany: { data: skillNeedRows as any, skipDuplicates: true } } : undefined,
          trainingNeeds: trainingNeedRows.length ? { createMany: { data: trainingNeedRows as any, skipDuplicates: true } } : undefined,
          projectProgramActivities: projectProgramActivityRows.length
            ? { createMany: { data: projectProgramActivityRows as any, skipDuplicates: true } }
            : undefined,
          // VT-5: the 12 Vocational Training child relations — writes
          // skipped when empty (design note: sparse VT drafts must save;
          // no placeholder rows). Relation names verified against
          // prisma/schema.prisma's OnefopSubmission model, not guessed.
          vtDiplomaData: vtDiplomaDataRows.length
            ? { createMany: { data: vtDiplomaDataRows as any, skipDuplicates: true } } : undefined,
          vtTraineeAgeFlow: vtTraineeAgeFlowRows.length
            ? { createMany: { data: vtTraineeAgeFlowRows as any, skipDuplicates: true } } : undefined,
          vtTrainerAge: vtTrainerAgeRows.length
            ? { createMany: { data: vtTrainerAgeRows as any, skipDuplicates: true } } : undefined,
          vtEducationLevelFlow: vtEducationLevelFlowRows.length
            ? { createMany: { data: vtEducationLevelFlowRows as any, skipDuplicates: true } } : undefined,
          vtTraineeVulnerable: vtTraineeVulnerableRows.length
            ? { createMany: { data: vtTraineeVulnerableRows as any, skipDuplicates: true } } : undefined,
          vtTrainerDisability: vtTrainerDisabilityRows.length
            ? { createMany: { data: vtTrainerDisabilityRows as any, skipDuplicates: true } } : undefined,
          vtScholarship: vtScholarshipRows.length
            ? { createMany: { data: vtScholarshipRows as any, skipDuplicates: true } } : undefined,
          vtSpecialtyRows: vtSpecialtyRows.length
            ? { createMany: { data: vtSpecialtyRows as any, skipDuplicates: true } } : undefined,
          vtCurricula: vtCurriculaRows.length
            ? { createMany: { data: vtCurriculaRows as any, skipDuplicates: true } } : undefined,
          vtInfrastructure: vtInfrastructureRows.length
            ? { createMany: { data: vtInfrastructureRows as any, skipDuplicates: true } } : undefined,
          vtFurniture: vtFurnitureRows.length
            ? { createMany: { data: vtFurnitureRows as any, skipDuplicates: true } } : undefined,
          vtTrainerRoster: vtTrainerRosterRows.length
            ? { createMany: { data: vtTrainerRosterRows as any, skipDuplicates: true } } : undefined,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002' && dto.formId) {
        // A concurrent retry with the same formId won the race and inserted
        // first — treat this as the same successful submission rather than
        // surfacing a duplicate-key error for data that was already saved.
        const existing = await this.prisma.onefopSubmission.findUnique({
          where: { submissionId: dto.formId },
        });
        if (existing) {
          return {
            success: true,
            submissionId: existing.submissionId,
            message: 'Formulaire soumis avec succès',
          };
        }
      }
      // Same conflict as the pre-check above, just lost the race instead
      // of being caught by the findFirst — two different formIds inserting
      // for the same (companyId, quarterCode) at the same instant. The
      // partial unique index (not declared in schema.prisma — see the
      // OnefopSubmission doc comment) reports its own name as err.meta.target
      // rather than field names, since Prisma doesn't recognize an index it
      // didn't generate.
      if (err.code === 'P2002') {
        const target = err.meta?.target;
        const targetText = Array.isArray(target) ? target.join(',') : String(target ?? '');
        if (targetText.includes('onefop_submissions_company_quarter_live_uidx')) {
          throw new ConflictException(
            'Une déclaration est déjà en cours pour ce trimestre. / ' +
            'A declaration already exists for this quarter.',
          );
        }
      }
      throw err;
    }

    // Campaign progress, phase B2 (docs/deferred.md, "CampaignSubmission is
    // never updated"). A final submission is attributed to the campaign whose
    // SubmissionRound carries this quarterCode, and that campaign's
    // CampaignSubmission row for the company moves to SUBMITTED. Drafts are
    // never counted. No round, a round without a campaign, or no
    // CampaignSubmission row for this company (not targeted at activation)
    // is skipped silently — a row is never created here. Best-effort: the
    // OnefopSubmission is already saved, so a failure is logged, not thrown.
    if (!isDraft) {
      try {
        const round = await this.prisma.submissionRound.findFirst({
          // module filter: a ONEFOP submit must never mark progress on a DSMO campaign's round.
          where: { quarterCode: resolvedQuarterCode, module: 'ONEFOP' },
          select: { campaignId: true },
        });
        if (round?.campaignId) {
          // One transaction: both writes apply or neither does. updateMany
          // (not update) so a missing CampaignSubmission row updates nothing
          // and the transaction still commits.
          await this.prisma.$transaction([
            this.prisma.onefopSubmission.update({
              where: { submissionId: result.submissionId },
              data: { campaignId: round.campaignId },
            }),
            // No status condition, deliberately: EXEMPT becomes SUBMITTED too.
            // Exemption reflects whether the establishment was required to
            // submit, not whether a submission counts. Nothing in src/
            // creates EXEMPT rows today.
            this.prisma.campaignSubmission.updateMany({
              where: { campaignId: round.campaignId, companyId: resolvedCompanyId },
              data: { status: 'SUBMITTED', submittedAt: new Date() },
            }),
          ]);
        }
      } catch (err: any) {
        this.logger.error(
          `Campaign progress update failed for ONEFOP submission ${result.submissionId} ` +
          `(company ${resolvedCompanyId}, quarter ${resolvedQuarterCode})`,
          err?.stack,
        );
      }
    }

    return {
      success: true,
      submissionId: result.submissionId as string,
      message: isDraft
        ? 'Brouillon sauvegardé avec succès'
        : 'Formulaire soumis avec succès',
      data: coherenceFlags.length ? { flags: coherenceFlags } : undefined,
    };
  }

  /**
   * Cross-question coherence checks — flags (never blocks) cases where the
   * same underlying count is declared twice, cross-tabulated two different
   * ways, and the totals disagree. Stored on OnefopSubmission.flags for the
   * reviewer to see during approval.
   */
  private checkCoherence(
    flat: FlatFormData,
    entityType: string,
    headlineWorkers: number | null,
    headlineVacancies: number | null,
  ): { code: string; message: string }[] {
    const flags: { code: string; message: string }[] = [];
    const n = (key: string) => this.flatInt(flat, key);

    // Recruitments (S22Q01 permanent + S22Q02 temporary) re-partitioned by
    // diploma instead of age in S22Q03 — same recruited population, the
    // grand totals must agree, overall and per gender.
    //
    // ADMINISTRATION has no S22Q02/S22Q03 in its schema (see onefop_ast.dart)
    // — flat[...] reads 0 for both while S22Q01 can carry real data, which
    // would otherwise spuriously flag every administration submission that
    // reports any recruitment at all. The Flutter live-hint checker
    // (lib/screens/onefop/onefop_coherence_checker.dart) already guards this
    // for exactly that reason; this backend copy hadn't matched it — ported
    // over during the React migration's coherence-checker port when the
    // discrepancy surfaced.
    if (entityType !== 'ADMINISTRATION') {
      const byAge = {
        male: n('s22q01_total_male_total') + n('s22q02_total_male_total'),
        female: n('s22q01_total_female_total') + n('s22q02_total_female_total'),
        total: n('s22q01_total_total_total') + n('s22q02_total_total_total'),
      };
      const byDiploma = {
        male: n('s22q03_total_male_total'),
        female: n('s22q03_total_female_total'),
        total: n('s22q03_total_total_total'),
      };
      (['male', 'female', 'total'] as const).forEach((gender) => {
        if (byAge[gender] !== byDiploma[gender] && (byAge[gender] > 0 || byDiploma[gender] > 0)) {
          flags.push({
            code: 'S22Q03_DIPLOMA_MISMATCH',
            message: `Répartition des recrutements par diplôme (S22Q03: ${byDiploma[gender]}, ${gender}) ` +
              `ne correspond pas au total des recrutements permanents + temporaires ` +
              `(S22Q01+S22Q02: ${byAge[gender]}, ${gender}).`,
          });
        }
      });
    }

    // Dismissals appear in three different tables — the departures table
    // (S3Q01, "dismissal" column), the dismissal-reasons table (S3Q02), and
    // the dismissal/technical-unemployment table (S3Q03, "dismissal"
    // column) — all three describe the same dismissals and should agree.
    //
    // ADMINISTRATION has no S3Q03 (deliberately unimplemented pending visual
    // PDF verification — see onefop_ast.dart), so the same false-positive
    // risk applies here; guarded for the same reason as the S22Q03 check
    // above.
    if (entityType !== 'ADMINISTRATION') {
      (['male', 'female'] as const).forEach((gender) => {
        const departures = n(`s3q01_total_dismissal_${gender}`);
        const reasons = n(`s3q02_total_${gender}`);
        const dismissalUnemployment = n(`s3q03_total_dismissal_${gender}`);
        const values = [departures, reasons, dismissalUnemployment];
        if (new Set(values).size > 1 && values.some((v) => v > 0)) {
          flags.push({
            code: 'S3_DISMISSAL_MISMATCH',
            message: `Le nombre de licenciements (${gender}) diffère entre S3Q01 (${departures}), ` +
              `S3Q02 (${reasons}) et S3Q03 (${dismissalUnemployment}).`,
          });
        }
      });
    }

    // Disability/vulnerable/first-time recruits are each a subset of total
    // recruits, and S22Q04/S22Q05/S23Q02 all share the same permanent-vs-
    // temporary split as S22Q01/S22Q02 — so the check can be tightened to
    // per-status rather than just the combined total, catching e.g. a
    // company reporting more disabled PERMANENT recruits than permanent
    // recruits overall even if it's offset by fewer on the temporary side.
    const vulnPrefix = entityType === 'ENTREPRISE' ? 's22q05_ent' : 's22q05_oth';
    (['male', 'female'] as const).forEach((gender) => {
      const permanentRecruits = n(`s22q01_total_${gender}_total`);
      const temporaryRecruits = n(`s22q02_total_${gender}_total`);

      const disabilityPermanent = n(`s22q04_total_permanent_${gender}`);
      const disabilityTemporary = n(`s22q04_total_temporary_${gender}`);
      if (disabilityPermanent > permanentRecruits) {
        flags.push({
          code: 'S22Q04_PERMANENT_EXCEEDS_TOTAL',
          message: `Recrutements permanents de personnes en situation de handicap (S22Q04: ${disabilityPermanent}, ${gender}) ` +
            `supérieurs au total des recrutements permanents (S22Q01: ${permanentRecruits}, ${gender}).`,
        });
      }
      if (disabilityTemporary > temporaryRecruits) {
        flags.push({
          code: 'S22Q04_TEMPORARY_EXCEEDS_TOTAL',
          message: `Recrutements temporaires de personnes en situation de handicap (S22Q04: ${disabilityTemporary}, ${gender}) ` +
            `supérieurs au total des recrutements temporaires (S22Q02: ${temporaryRecruits}, ${gender}).`,
        });
      }

      const vulnerablePermanent = n(`${vulnPrefix}_total_permanent_${gender}`);
      const vulnerableTemporary = n(`${vulnPrefix}_total_temporary_${gender}`);
      if (vulnerablePermanent > permanentRecruits) {
        flags.push({
          code: 'S22Q05_PERMANENT_EXCEEDS_TOTAL',
          message: `Recrutements permanents de personnes vulnérables (S22Q05: ${vulnerablePermanent}, ${gender}) ` +
            `supérieurs au total des recrutements permanents (S22Q01: ${permanentRecruits}, ${gender}).`,
        });
      }
      if (vulnerableTemporary > temporaryRecruits) {
        flags.push({
          code: 'S22Q05_TEMPORARY_EXCEEDS_TOTAL',
          message: `Recrutements temporaires de personnes vulnérables (S22Q05: ${vulnerableTemporary}, ${gender}) ` +
            `supérieurs au total des recrutements temporaires (S22Q02: ${temporaryRecruits}, ${gender}).`,
        });
      }

      // S23Q02 "first-time workers recruited" is, by definition, a subset
      // of all recruits — can't recruit a first-time permanent worker
      // without it counting as a permanent recruit in S22Q01, same for
      // temporary/S22Q02.
      const firstTimePermanent = n(`s23q02_permanent_subtotal_${gender}_total`);
      const firstTimeTemporary = n(`s23q02_temporary_subtotal_${gender}_total`);
      if (firstTimePermanent > permanentRecruits) {
        flags.push({
          code: 'S23Q02_PERMANENT_EXCEEDS_TOTAL',
          message: `Primo-demandeurs recrutés en permanent (S23Q02: ${firstTimePermanent}, ${gender}) ` +
            `supérieurs au total des recrutements permanents (S22Q01: ${permanentRecruits}, ${gender}).`,
        });
      }
      if (firstTimeTemporary > temporaryRecruits) {
        flags.push({
          code: 'S23Q02_TEMPORARY_EXCEEDS_TOTAL',
          message: `Primo-demandeurs recrutés en temporaire (S23Q02: ${firstTimeTemporary}, ${gender}) ` +
            `supérieurs au total des recrutements temporaires (S22Q02: ${temporaryRecruits}, ${gender}).`,
        });
      }
    });

    // Headline sanity ceiling — catches a stray extra digit typo.
    if (headlineWorkers != null && headlineWorkers > 50000) {
      flags.push({
        code: 'PERMANENT_WORKERS_IMPLAUSIBLE',
        message: `Effectif permanent déclaré très élevé (${headlineWorkers}) — merci de vérifier.`,
      });
    }
    if (headlineVacancies != null && headlineVacancies > 50000) {
      flags.push({
        code: 'VACANCIES_IMPLAUSIBLE',
        message: `Nombre de postes vacants déclaré très élevé (${headlineVacancies}) — merci de vérifier.`,
      });
    }

    return flags;
  }

  private checkVtCoherence(flat: FlatFormData): { code: string; message: string }[] {
    const flags: { code: string; message: string }[] = [];
    const n = (key: string) => this.flatInt(flat, key);

    const academicDiplomaRows = [
      'doctorat', 'master2', 'maitrise', 'licence', 'deug_dut', 'bacc_general',
      'bacc_technique', 'probatoire', 'bepc', 'cep', 'sans_diplome_academique',
    ];
    const proDiplomaRows = [
      'dipleg_dipes2', 'ingenieur_master_pro', 'dipceg_dipes1', 'licence_pro',
      'bts_hnd', 'bep_bp_bacpro', 'capieg', 'capiaeg', 'cap', 'dqp', 'cqp',
      'autres_pro', 'sans_diplome_professionnel',
    ];
    const ageBandRows = [
      'under_14', 'age_14', 'age_15', 'age_16', 'age_17', 'age_18', 'age_19',
      'age_20', 'age_21', 'age_22', 'age_23', 'age_24', 'age_25', 'age_26',
      'age_27', 'age_28', 'age_29', 'age_30', 'age_31', 'age_32', 'age_33',
      'age_34', 'age_35', 'above_35',
    ];
    const trainerAgeBandRows = ['age_18_24', 'age_25_39', 'age_40_59', 'age_60_plus'];
    const eduLevelRows = [
      'non_alphabetise', 'primaire', 'premier_cycle_general',
      'premier_cycle_technique', 'second_cycle_general',
      'second_cycle_technique', 'enseignement_normal', 'enseignement_superieur',
    ];

    // Rule 1: 4.1 total = 4.2 total (male, female)
    const t41 = {
      male: academicDiplomaRows.reduce((acc, d) => acc + n(`s4q1_${d}_male`), 0),
      female: academicDiplomaRows.reduce((acc, d) => acc + n(`s4q1_${d}_female`), 0),
    };
    const t42 = {
      male: proDiplomaRows.reduce((acc, d) => acc + n(`s4q2_${d}_male`), 0),
      female: proDiplomaRows.reduce((acc, d) => acc + n(`s4q2_${d}_female`), 0),
    };
    (['male', 'female'] as const).forEach((gender) => {
      const gLabel = gender === 'male' ? 'hommes' : 'femmes';
      if (t41[gender] !== t42[gender] && (t41[gender] > 0 || t42[gender] > 0)) {
        flags.push({
          code: 'VT_DIPLOMA_ACADEMIC_PRO_MISMATCH',
          message: `Effectif total des apprenants par diplôme académique (4.1: ${t41[gender]}, ${gLabel}) ` +
            `ne correspond pas au total par diplôme professionnel (4.2: ${t42[gender]}, ${gLabel}).`,
        });
      }
    });

    // Rule 2: 4.2 total = Σ 4.5 (male, female)
    let s45_m = 0;
    let s45_f = 0;
    let s45_fi_m = 0;
    let s45_fi_f = 0;
    for (let i = 1; i <= 12; i++) {
      const fiM = n(`s4q5_row${i}_fiMale`);
      const fiF = n(`s4q5_row${i}_fiFemale`);
      const fcM = n(`s4q5_row${i}_fcMale`);
      const fcF = n(`s4q5_row${i}_fcFemale`);
      s45_m += fiM + fcM;
      s45_f += fiF + fcF;
      s45_fi_m += fiM;
      s45_fi_f += fiF;
    }
    const s45 = { male: s45_m, female: s45_f };
    (['male', 'female'] as const).forEach((gender) => {
      const gLabel = gender === 'male' ? 'hommes' : 'femmes';
      if (t42[gender] !== s45[gender] && (t42[gender] > 0 || s45[gender] > 0)) {
        flags.push({
          code: 'VT_TRAINEE_SPECIALTY_TOTAL_MISMATCH',
          message: `Effectif total des apprenants par diplôme professionnel (4.2: ${t42[gender]}, ${gLabel}) ` +
            `ne correspond pas à la somme des effectifs par spécialité (4.5: ${s45[gender]}, ${gLabel}).`,
        });
      }
    });

    // Rule 3: Σ 4.5[FI only] = Σ 4.6 (male, female)
    let s46_m = 0;
    let s46_f = 0;
    for (let i = 1; i <= 12; i++) {
      s46_m += n(`s4q6_row${i}_year1Male`) + n(`s4q6_row${i}_year2Male`);
      s46_f += n(`s4q6_row${i}_year1Female`) + n(`s4q6_row${i}_year2Female`);
    }
    const s45_fi = { male: s45_fi_m, female: s45_fi_f };
    const s46 = { male: s46_m, female: s46_f };
    (['male', 'female'] as const).forEach((gender) => {
      const gLabel = gender === 'male' ? 'hommes' : 'femmes';
      if (s45_fi[gender] !== s46[gender] && (s45_fi[gender] > 0 || s46[gender] > 0)) {
        flags.push({
          code: 'VT_TRAINEE_INITIAL_TRAINING_YEAR_MISMATCH',
          message: `Effectif des apprenants en formation initiale par spécialité (4.5 FI: ${s45_fi[gender]}, ${gLabel}) ` +
            `ne correspond pas au total par année d'études (4.6: ${s46[gender]}, ${gLabel}).`,
        });
      }
    });

    // Rule 4: 4.2 total = Σ 4.7[ENTRANT] (male, female)
    const s47_ent = {
      male: ageBandRows.reduce((acc, a) => acc + n(`s4q7_${a}_entrant_male`), 0),
      female: ageBandRows.reduce((acc, a) => acc + n(`s4q7_${a}_entrant_female`), 0),
    };
    (['male', 'female'] as const).forEach((gender) => {
      const gLabel = gender === 'male' ? 'hommes' : 'femmes';
      if (t42[gender] !== s47_ent[gender] && (t42[gender] > 0 || s47_ent[gender] > 0)) {
        flags.push({
          code: 'VT_TRAINEE_AGE_ENTRANT_MISMATCH',
          message: `Effectif total des apprenants par diplôme professionnel (4.2: ${t42[gender]}, ${gLabel}) ` +
            `ne correspond pas à la somme des entrants par tranche d'âge (4.7 entrants: ${s47_ent[gender]}, ${gLabel}).`,
        });
      }
    });

    // Rule 5: 4.2 total = Σ 4.8[ENTRANT] (male, female)
    const s48_ent = {
      male: eduLevelRows.reduce((acc, l) => acc + n(`s4q8_${l}_entrant_male`), 0),
      female: eduLevelRows.reduce((acc, l) => acc + n(`s4q8_${l}_entrant_female`), 0),
    };
    (['male', 'female'] as const).forEach((gender) => {
      const gLabel = gender === 'male' ? 'hommes' : 'femmes';
      if (t42[gender] !== s48_ent[gender] && (t42[gender] > 0 || s48_ent[gender] > 0)) {
        flags.push({
          code: 'VT_TRAINEE_EDU_LEVEL_ENTRANT_MISMATCH',
          message: `Effectif total des apprenants par diplôme professionnel (4.2: ${t42[gender]}, ${gLabel}) ` +
            `ne correspond pas à la somme des entrants par niveau d'études (4.8 entrants: ${s48_ent[gender]}, ${gLabel}).`,
        });
      }
    });

    // Rule 6: Σ 4.7[SORTANT] = Σ 4.10 (male, female)
    const s47_sort = {
      male: ageBandRows.reduce((acc, a) => acc + n(`s4q7_${a}_sortant_male`), 0),
      female: ageBandRows.reduce((acc, a) => acc + n(`s4q7_${a}_sortant_female`), 0),
    };
    let s410_m = 0;
    let s410_f = 0;
    for (let i = 1; i <= 10; i++) {
      s410_m += n(`s4q10_row${i}_male`);
      s410_f += n(`s4q10_row${i}_female`);
    }
    const s410 = { male: s410_m, female: s410_f };
    (['male', 'female'] as const).forEach((gender) => {
      const gLabel = gender === 'male' ? 'hommes' : 'femmes';
      if (s47_sort[gender] !== s410[gender] && (s47_sort[gender] > 0 || s410[gender] > 0)) {
        flags.push({
          code: 'VT_TRAINEE_OUTGOING_SPECIALTY_MISMATCH',
          message: `Effectif des sortants par âge (4.7 sortants: ${s47_sort[gender]}, ${gLabel}) ` +
            `ne correspond pas au total des sortants par spécialité (4.10: ${s410[gender]}, ${gLabel}).`,
        });
      }
    });

    // Rule 7: 8.1 total = 8.2 total (male, female)
    const t81 = {
      male: academicDiplomaRows.reduce((acc, d) => acc + n(`s8q1_${d}_male`), 0),
      female: academicDiplomaRows.reduce((acc, d) => acc + n(`s8q1_${d}_female`), 0),
    };
    const t82 = {
      male: proDiplomaRows.reduce((acc, d) => acc + n(`s8q2_${d}_male`), 0),
      female: proDiplomaRows.reduce((acc, d) => acc + n(`s8q2_${d}_female`), 0),
    };
    (['male', 'female'] as const).forEach((gender) => {
      const gLabel = gender === 'male' ? 'hommes' : 'femmes';
      if (t81[gender] !== t82[gender] && (t81[gender] > 0 || t82[gender] > 0)) {
        flags.push({
          code: 'VT_TRAINER_DIPLOMA_ACADEMIC_PRO_MISMATCH',
          message: `Effectif des formateurs par diplôme académique (8.1: ${t81[gender]}, ${gLabel}) ` +
            `ne correspond pas au total par diplôme professionnel (8.2: ${t82[gender]}, ${gLabel}).`,
        });
      }
    });

    // Rule 8: 8.2 total = Σ 8.3 (male, female)
    const s83 = {
      male: trainerAgeBandRows.reduce((acc, a) => acc + n(`s8q3_${a}_male`), 0),
      female: trainerAgeBandRows.reduce((acc, a) => acc + n(`s8q3_${a}_female`), 0),
    };
    (['male', 'female'] as const).forEach((gender) => {
      const gLabel = gender === 'male' ? 'hommes' : 'femmes';
      if (t82[gender] !== s83[gender] && (t82[gender] > 0 || s83[gender] > 0)) {
        flags.push({
          code: 'VT_TRAINER_AGE_MISMATCH',
          message: `Effectif des formateurs par diplôme professionnel (8.2: ${t82[gender]}, ${gLabel}) ` +
            `ne correspond pas au total par tranche d'âge (8.3: ${s83[gender]}, ${gLabel}).`,
        });
      }
    });

    // Rule 9: 8.2 total = 8.5 total (male, female)
    const t85 = {
      male: n('VT8_5_VP_M') + n('VT8_5_VNP_M') + n('VT8_5_PERM_M') + n('VT8_5_CONTRACT_M'),
      female: n('VT8_5_VP_F') + n('VT8_5_VNP_F') + n('VT8_5_PERM_F') + n('VT8_5_CONTRACT_F'),
    };
    (['male', 'female'] as const).forEach((gender) => {
      const gLabel = gender === 'male' ? 'hommes' : 'femmes';
      if (t82[gender] !== t85[gender] && (t82[gender] > 0 || t85[gender] > 0)) {
        flags.push({
          code: 'VT_TRAINER_STATUS_MISMATCH',
          message: `Effectif des formateurs par diplôme professionnel (8.2: ${t82[gender]}, ${gLabel}) ` +
            `ne correspond pas au total par statut professionnel (8.5: ${t85[gender]}, ${gLabel}).`,
        });
      }
    });

    return flags;
  }

  private enforceFinalRequiredFields(
    data: AnyQuestionnaireDto,
    flat: Record<string, unknown>,
    entityType: string,
  ): void {
    const missingFields: string[] = [];
    const respondentRequired = FINAL_REQUIRED_FIELDS['respondent'] ?? [];
    for (const field of respondentRequired) {
      if (!data.respondent || !data.respondent[field as keyof typeof data.respondent]) {
        missingFields.push(`respondent.${field}`);
      }
    }
    const entityRequired = FINAL_REQUIRED_FIELDS[entityType] ?? [];
    const entityData = (data as any)[entityType];
    for (const field of entityRequired) {
      if (!entityData || entityData[field] === undefined || entityData[field] === null || entityData[field] === '') {
        missingFields.push(`${entityType}.${field}`);
      }
    }
    if (entityType === 'ctd' && entityData?.type === 2 && !entityData?.councilType) {
      missingFields.push('ctd.councilType');
    }
    if (entityType === 'cooperative' && entityData?.type === 3 && !entityData?.typeOther) {
      missingFields.push('cooperative.typeOther');
    }
    // Only require the response-status fields that actually exist in this
    // entity's compiled schema — see FINAL_TABLE_RESPONSE_FIELDS_BY_ENTITY.
    // entityType is already one of the six known values by this point
    // (normalizeEntityType/the DTO-class switch upstream reject anything
    // else before this method is ever called), so the fallback to the
    // full 14-field list is unreachable defensive code, not a live path.
    const applicableTableResponseFields =
      FINAL_TABLE_RESPONSE_FIELDS_BY_ENTITY[entityType] ?? FINAL_TABLE_RESPONSE_FIELDS;
    for (const field of applicableTableResponseFields) {
      const status = flat[field];
      if (typeof status !== 'string' || !TABLE_RESPONSE_STATUSES.has(status)) {
        missingFields.push(field);
      }
    }
    if (missingFields.length > 0) {
      const labels = missingFields.map((f) => REQUIRED_FIELD_LABELS[f] ?? f);
      const summary = labels.length <= 3
        ? labels.join(', ')
        : `${labels.slice(0, 3).join(', ')}, +${labels.length - 3}`;
      // missingFields carries the raw dotted field ids (e.g.
      // 'vocationalTraining.region') alongside the human-readable summary
      // message, so an API client can highlight the specific offending
      // fields instead of parsing the bilingual sentence.
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message:
          `Informations obligatoires manquantes : ${summary}. Veuillez compléter le formulaire avant de soumettre. / ` +
          `Missing required information: ${summary}. Please complete the form before submitting.`,
        missingFields,
      });
    }

    // Validate cell completeness for every table declared as REPORTED.
    // 0 is valid; blank/null/undefined is invalid.
    this.enforceReportedMatrixCompleteness(flat, entityType, applicableTableResponseFields);
  }

  /**
   * Enforces that every applicable cell inside a REPORTED table contains an explicit
   * value (0 or positive). Blank, null, or undefined cells trigger a BadRequestException.
   * Tables marked NONE or NOT_APPLICABLE are completely exempt.
   */
  private enforceReportedMatrixCompleteness(
    flat: Record<string, unknown>,
    entityType: string,
    applicableTableResponseFields: readonly string[],
  ): void {
    const missingMatrixCells: string[] = [];

    for (const statusField of applicableTableResponseFields) {
      const status = flat[statusField];
      if (status === 'REPORTED') {
        const expectedKeys = this.getExpectedMatrixCellKeys(statusField, flat, entityType);
        for (const cellKey of expectedKeys) {
          const val = this.findCellValue(flat, cellKey);
          if (!this.isEnteredMatrixValue(val)) {
            missingMatrixCells.push(cellKey);
          } else if (
            !cellKey.includes('_desc') &&
            !cellKey.includes('_text') &&
            !cellKey.includes('_domain')
          ) {
            const num = Number(val);
            if (Number.isNaN(num) || num < 0) {
              missingMatrixCells.push(cellKey);
            }
          }
        }
      }
    }

    if (missingMatrixCells.length > 0) {
      const summary = missingMatrixCells.length <= 3
        ? missingMatrixCells.join(', ')
        : `${missingMatrixCells.slice(0, 3).join(', ')}, +${missingMatrixCells.length - 3}`;
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message:
          `Le formulaire contient des tableaux déclarés « renseignés » avec des cellules manquantes ou non valides (${missingMatrixCells.length} cellule(s) : ${summary}). Chaque cellule obligatoire doit être renseignée (saisissez 0 lorsqu'il n'y a eu aucune occurrence). / ` +
          `Questionnaire contains REPORTED tables with missing or invalid cells (${missingMatrixCells.length} cell(s): ${summary}). Every required cell must be explicitly completed (enter 0 if no occurrences).`,
        missingMatrixCells,
      });
    }
  }

  private isEnteredMatrixValue(val: unknown): boolean {
    return val !== undefined && val !== null && val !== '';
  }

  private findCellValue(flat: Record<string, unknown>, key: string): unknown {
    if (flat[key] !== undefined) return flat[key];
    const lower = key.toLowerCase();
    if (flat[lower] !== undefined) return flat[lower];
    const upper = key.toUpperCase();
    if (flat[upper] !== undefined) return flat[upper];

    for (const [k, v] of Object.entries(flat)) {
      if (k.toLowerCase() === lower) return v;
    }

    // Aliases for Slot 1, 2, 3 free-text and counts
    const slotDescMatch = lower.match(/slot([1-3])_desc/);
    if (slotDescMatch) {
      const n = slotDescMatch[1];
      const alias1 = lower.replace(`slot${n}_desc`, `reason_${n}_text`);
      const alias2 = lower.replace(`slot${n}_desc`, `skill_${n}_desc`);
      const alias3 = lower.replace(`slot${n}_desc`, `training_${n}_domain`);
      const alias4 = lower.replace(`slot${n}_desc`, `besoin_${n}_desc`);
      const alias5 = lower.replace(`slot${n}_desc`, `domain_${n}_text`);
      for (const [k, v] of Object.entries(flat)) {
        const kl = k.toLowerCase();
        if (kl === alias1 || kl === alias2 || kl === alias3 || kl === alias4 || kl === alias5) return v;
      }
    }
    const slotMaleMatch = lower.match(/slot([1-3])_male/);
    if (slotMaleMatch) {
      const n = slotMaleMatch[1];
      const alias1 = lower.replace(`slot${n}_male`, `reason_${n}_male`);
      const alias2 = lower.replace(`slot${n}_male`, `training_${n}_male`);
      for (const [k, v] of Object.entries(flat)) {
        const kl = k.toLowerCase();
        if (kl === alias1 || kl === alias2) return v;
      }
    }
    const slotFemaleMatch = lower.match(/slot([1-3])_female/);
    if (slotFemaleMatch) {
      const n = slotFemaleMatch[1];
      const alias1 = lower.replace(`slot${n}_female`, `reason_${n}_female`);
      const alias2 = lower.replace(`slot${n}_female`, `training_${n}_female`);
      for (const [k, v] of Object.entries(flat)) {
        const kl = k.toLowerCase();
        if (kl === alias1 || kl === alias2) return v;
      }
    }
    const slotTotalMatch = lower.match(/slot([1-3])_total/);
    if (slotTotalMatch) {
      const n = slotTotalMatch[1];
      const alias1 = lower.replace(`slot${n}_total`, `reason_${n}_total`);
      const alias2 = lower.replace(`slot${n}_total`, `skill_${n}_total`);
      const alias3 = lower.replace(`slot${n}_total`, `training_${n}_total`);
      for (const [k, v] of Object.entries(flat)) {
        const kl = k.toLowerCase();
        if (kl === alias1 || kl === alias2 || kl === alias3) return v;
      }
    }
    // S22Q05 enterprise alias
    if (lower.startsWith('s22q05_') && !lower.startsWith('s22q05_ent_')) {
      const entKey = lower.replace('s22q05_', 's22q05_ent_');
      for (const [k, v] of Object.entries(flat)) {
        if (k.toLowerCase() === entKey) return v;
      }
    }
    // S3Q03 type/csp flip alias
    if (lower.startsWith('s3q03_')) {
      const parts = lower.split('_');
      if (parts.length >= 5) {
        const flipped = `s3q03_${parts.slice(2, parts.length - 1).join('_')}_${parts[1]}_${parts[parts.length - 1]}`;
        for (const [k, v] of Object.entries(flat)) {
          if (k.toLowerCase() === flipped) return v;
        }
      }
    }

    return undefined;
  }

  private getExpectedMatrixCellKeys(tableStatusField: string, flat: Record<string, unknown>, entityType: string): string[] {
    const scopeConfig = (flat._scopeConfig as Record<string, any>) ?? {};
    let tableId = tableStatusField.replace(/_RESPONSE_STATUS$/i, '').toLowerCase();
    if (entityType === 'projectProgram' && tableId.startsWith('s4q')) {
      tableId = `pp_${tableId}`;
    }

    // 1. S21Q01 and PP_S4Q01..PP_S4Q04 (CSP Gender Age tables)
    if (tableId === 's21q01' || ['pp_s4q01', 'pp_s4q02', 'pp_s4q03', 'pp_s4q04'].includes(tableId)) {
      const prefix = tableId;
      const isAdm = entityType === 'administration';
      const csps = isAdm
        ? ['fonctionnaire', 'decisionnaire', 'contractuelle']
        : (tableId.startsWith('pp_')
            ? ['cadres', 'foremen', 'workers']
            : (scopeConfig.application_csp && scopeConfig.application_csp.length > 0
                ? scopeConfig.application_csp
                : ['cadres', 'foremen', 'workers']));
      const ages = scopeConfig.application_age && scopeConfig.application_age.length > 0 && !tableId.startsWith('pp_')
        ? scopeConfig.application_age
        : ['15_24', '25_34', '35_plus'];
      const genders = ['male', 'female'];
      const keys: string[] = [];
      for (const c of csps) {
        for (const g of genders) {
          for (const a of ages) {
            keys.push(`${prefix}_${c}_${g}_${a}`);
          }
        }
      }
      return keys;
    }

    // Administration S21Q02–S21Q04 (chronological renumbering of 2026-09-28).
    // Categories are the civil-service ones; S21Q03/S21Q04 have no
    // permanent/temporary status (keys `${prefix}_${row}_${gender}`).
    if (tableId === 's21q02') {
      const ages = scopeConfig.recruit_age && scopeConfig.recruit_age.length > 0
        ? scopeConfig.recruit_age
        : ['15_24', '25_34', '35_plus'];
      const keys: string[] = [];
      for (const c of ['fonctionnaire', 'decisionnaire', 'contractuelle']) {
        for (const g of ['male', 'female']) {
          for (const a of ages) keys.push(`s21q02_${c}_${g}_${a}`);
        }
      }
      return keys;
    }
    if (tableId === 's21q03' || tableId === 's21q04') {
      const rows = tableId === 's21q03'
        ? ['fonctionnaire', 'decisionnaire', 'contractuelle']
        : ['deplaces_internes', 'refugies', 'orphelins'];
      return rows.flatMap((r) => ['male', 'female'].map((g) => `${tableId}_${r}_${g}`));
    }

    // 2. S22Q01
    if (tableId === 's22q01') {
      const prefix = 's22q01';
      const isAdm = entityType === 'administration';
      const csps = isAdm
        ? ['fonctionnaire', 'decisionnaire', 'contractuelle']
        : (scopeConfig.recruit_csp && scopeConfig.recruit_csp.length > 0
            ? scopeConfig.recruit_csp
            : ['cadres', 'foremen', 'workers']);
      const ages = scopeConfig.recruit_age && scopeConfig.recruit_age.length > 0
        ? scopeConfig.recruit_age
        : ['15_24', '25_34', '35_plus'];
      const genders = ['male', 'female'];
      const keys: string[] = [];
      for (const c of csps) {
        for (const g of genders) {
          for (const a of ages) {
            keys.push(`${prefix}_${c}_${g}_${a}`);
          }
        }
      }
      return keys;
    }

    // 3. S22Q02
    if (tableId === 's22q02') {
      const prefix = 's22q02';
      const csps = scopeConfig.recruit_csp && scopeConfig.recruit_csp.length > 0
        ? scopeConfig.recruit_csp
        : ['cadres', 'foremen', 'workers'];
      const ages = scopeConfig.recruit_age && scopeConfig.recruit_age.length > 0
        ? scopeConfig.recruit_age
        : ['15_24', '25_34', '35_plus'];
      const genders = ['male', 'female'];
      const keys: string[] = [];
      for (const c of csps) {
        for (const g of genders) {
          for (const a of ages) {
            keys.push(`${prefix}_${c}_${g}_${a}`);
          }
        }
      }
      return keys;
    }

    // 4. S22Q03 (Diplomas)
    if (tableId === 's22q03') {
      const prefix = 's22q03';
      const diplomas = ['cep', 'bepc', 'probatoire', 'bac', 'bts', 'licence', 'maitrise', 'master', 'dqp', 'cqp', 'autres', 'sans_diplome'];
      const ages = scopeConfig.recruit_age && scopeConfig.recruit_age.length > 0
        ? scopeConfig.recruit_age
        : ['15_24', '25_34', '35_plus'];
      const genders = ['male', 'female'];
      const has4D = Object.keys(flat).some((k) =>
        k.toLowerCase().startsWith('s22q03_cadres_') ||
        k.toLowerCase().startsWith('s22q03_foremen_') ||
        k.toLowerCase().startsWith('s22q03_workers_')
      );
      const keys: string[] = [];
      if (has4D) {
        const csps = scopeConfig.recruit_csp && scopeConfig.recruit_csp.length > 0
          ? scopeConfig.recruit_csp
          : ['cadres', 'foremen', 'workers'];
        for (const c of csps) {
          for (const d of diplomas) {
            for (const g of genders) {
              for (const a of ages) {
                keys.push(`${prefix}_${c}_${d}_${g}_${a}`);
              }
            }
          }
        }
      } else {
        for (const d of diplomas) {
          for (const g of genders) {
            for (const a of ages) {
              keys.push(`${prefix}_${d}_${g}_${a}`);
            }
          }
        }
      }
      return keys;
    }

    // 5. S22Q04 (Disability) / PP_S4Q05 (Disability) / PP_S4Q06 (Vulnerable)
    if (tableId === 's22q04' || tableId === 'pp_s4q05' || tableId === 'pp_s4q06') {
      const prefix = tableId;
      const csps = scopeConfig.recruit_csp && scopeConfig.recruit_csp.length > 0 && tableId === 's22q04'
        ? scopeConfig.recruit_csp
        : ['cadres', 'foremen', 'workers'];
      const statuses = ['permanent', 'temporary'];
      const genders = ['male', 'female'];
      const keys: string[] = [];
      for (const c of csps) {
        for (const s of statuses) {
          for (const g of genders) {
            keys.push(`${prefix}_${c}_${s}_${g}`);
          }
        }
      }
      return keys;
    }

    // 6. S22Q05 (Vulnerable)
    if (tableId.startsWith('s22q05')) {
      const prefix = tableId;
      const types = ['deplaces_internes', 'refugies', 'orphelins'];
      const statuses = ['permanent', 'temporary'];
      const genders = ['male', 'female'];
      const keys: string[] = [];
      for (const t of types) {
        for (const s of statuses) {
          for (const g of genders) {
            keys.push(`${prefix}_${t}_${s}_${g}`);
          }
        }
      }
      return keys;
    }

    // 7. S23Q01 (First-time job seekers)
    if (tableId === 's23q01') {
      const prefix = 's23q01';
      const csps = scopeConfig.primo_seekers_csp && scopeConfig.primo_seekers_csp.length > 0
        ? scopeConfig.primo_seekers_csp
        : ['cadres', 'foremen', 'workers'];
      const ages = scopeConfig.primo_seekers_age && scopeConfig.primo_seekers_age.length > 0
        ? scopeConfig.primo_seekers_age
        : ['15_24', '25_34', '35_plus'];
      const genders = ['male', 'female'];
      const keys: string[] = [];
      for (const c of csps) {
        for (const g of genders) {
          for (const a of ages) {
            keys.push(`${prefix}_${c}_${g}_${a}`);
          }
        }
      }
      return keys;
    }

    // 8. S23Q02 (First-time workers)
    if (tableId === 's23q02') {
      const prefix = 's23q02';
      const contracts = ['permanent', 'temporary'];
      const csps = scopeConfig.primo_workers_csp && scopeConfig.primo_workers_csp.length > 0
        ? scopeConfig.primo_workers_csp
        : ['cadres', 'foremen', 'workers'];
      const ages = scopeConfig.primo_workers_age && scopeConfig.primo_workers_age.length > 0
        ? scopeConfig.primo_workers_age
        : ['15_24', '25_34', '35_plus'];
      const genders = ['male', 'female'];
      const keys: string[] = [];
      for (const k of contracts) {
        for (const c of csps) {
          for (const g of genders) {
            for (const a of ages) {
              keys.push(`${prefix}_${k}_${c}_${g}_${a}`);
            }
          }
        }
      }
      return keys;
    }

    // 9. S3Q01 (Departures)
    if (tableId === 's3q01') {
      const prefix = 's3q01';
      const isAdm = entityType === 'administration';
      const csps = isAdm
        ? ['fonctionnaire', 'decisionnaire', 'contractuelle']
        : ['cadres', 'foremen', 'workers'];
      const reasons = ['licenciement', 'demission', 'retraite', 'deces', 'fin_contrat', 'autres'];
      const genders = ['male', 'female'];
      const keys: string[] = [];
      for (const c of csps) {
        for (const r of reasons) {
          for (const g of genders) {
            keys.push(`${prefix}_${c}_${r}_${g}`);
          }
        }
      }
      return keys;
    }

    // 10. S3Q02 (Dismissals) - Slot 1 required, Slots 2 & 3 dynamic
    if (tableId === 's3q02') {
      const keys = ['s3q02_slot1_desc', 's3q02_slot1_male', 's3q02_slot1_female'];
      const slot2Keys = ['s3q02_slot2_desc', 's3q02_slot2_male', 's3q02_slot2_female'];
      const slot3Keys = ['s3q02_slot3_desc', 's3q02_slot3_male', 's3q02_slot3_female'];
      if (slot2Keys.some((k) => this.isEnteredMatrixValue(this.findCellValue(flat, k)))) {
        keys.push(...slot2Keys);
      }
      if (slot3Keys.some((k) => this.isEnteredMatrixValue(this.findCellValue(flat, k)))) {
        keys.push(...slot3Keys);
      }
      return keys;
    }

    // 11. S3Q03 (Technical unemployment)
    if (tableId === 's3q03') {
      const prefix = 's3q03';
      const types = ['licenciement_economique', 'chomage_technique'];
      const csps = ['cadres', 'foremen', 'workers'];
      const genders = ['male', 'female'];
      const keys: string[] = [];
      for (const t of types) {
        for (const c of csps) {
          for (const g of genders) {
            keys.push(`${prefix}_${c}_${t}_${g}`);
          }
        }
      }
      return keys;
    }

    // 12. S4Q01 (Internships)
    if (tableId === 's4q01') {
      const prefix = tableId;
      const types = ['academique', 'professionnel', 'pre_emploi', 'vacances'];
      const genders = ['male', 'female'];
      const keys: string[] = [];
      for (const t of types) {
        for (const g of genders) {
          keys.push(`${prefix}_${t}_${g}`);
        }
      }
      return keys;
    }

    // 13. S4Q02 (Skills) - Slot 1 required, Slots 2 & 3 dynamic
    if (tableId === 's4q02') {
      const keys = ['s4q02_slot1_desc', 's4q02_slot1_total'];
      const slot2Keys = ['s4q02_slot2_desc', 's4q02_slot2_total'];
      const slot3Keys = ['s4q02_slot3_desc', 's4q02_slot3_total'];
      if (slot2Keys.some((k) => this.isEnteredMatrixValue(this.findCellValue(flat, k)))) {
        keys.push(...slot2Keys);
      }
      if (slot3Keys.some((k) => this.isEnteredMatrixValue(this.findCellValue(flat, k)))) {
        keys.push(...slot3Keys);
      }
      return keys;
    }

    // 14. S4Q03 (Training) - Slot 1 required, Slots 2 & 3 dynamic
    if (tableId === 's4q03') {
      const keys = ['s4q03_slot1_desc', 's4q03_slot1_male', 's4q03_slot1_female'];
      const slot2Keys = ['s4q03_slot2_desc', 's4q03_slot2_male', 's4q03_slot2_female'];
      const slot3Keys = ['s4q03_slot3_desc', 's4q03_slot3_male', 's4q03_slot3_female'];
      if (slot2Keys.some((k) => this.isEnteredMatrixValue(this.findCellValue(flat, k)))) {
        keys.push(...slot2Keys);
      }
      if (slot3Keys.some((k) => this.isEnteredMatrixValue(this.findCellValue(flat, k)))) {
        keys.push(...slot3Keys);
      }
      return keys;
    }

    return [];
  }

  private flatInt(flat: FlatFormData, key: string): number {
    const v = flat[key];
    if (v === undefined || v === null || v === '') return 0;
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    return isNaN(n) ? 0 : n;
  }

  private flatStr(flat: FlatFormData, key: string): string {
    const v = flat[key];
    return v !== undefined && v !== null ? String(v) : '';
  }

  // ── Uppercase helper for Prisma enums ─────────────────────────
  private up(v: string): string {
    return v.toUpperCase();
  }

  // Age band mapping helper - converts flat keys to enum values
  private mapAgeBand(ageKey: string): string {
    const ageBandMap: Record<string, string> = {
      '15_24': 'AGE_15_24',
      '25_34': 'AGE_25_34',
      '35_plus': 'AGE_35_PLUS',
      'total': 'TOTAL',
    };
    return ageBandMap[ageKey] || ageKey;
  }

  // The methods below build row arrays for nested `createMany` writes (see
  // submitQuestionnaire) instead of executing their own createMany against a
  // `tx` — same field mappings as before, just no `submissionId` column
  // since Prisma sets that FK itself from the parent create.

  // cspRows defaults to the CSP category set used by Enterprise/Cooperative/
  // CTD/ONG. Administration's S21Q01/S22Q01 use SFP status categories
  // instead (Fonctionnaire/Décisionnaire/Contractuelle) — see the
  // entityType-aware call site below. Prefixes that don't apply to a given
  // entity type (e.g. s22q02/s23q01 for Administration) simply find no
  // matching flat keys and contribute zero rows, regardless of which
  // category labels are passed.
  private buildCspGenderAgeRows(
    flat: FlatFormData,
    prefixes: { prefix: string; tableName: string }[],
    cspRows: string[] = ['cadres', 'foremen', 'workers'],
  ): object[] {
    const genders = ['male', 'female', 'total'];
    const ageBandKeys = ['15_24', '25_34', '35_plus', 'total'];
    const rows: object[] = [];

    for (const { prefix, tableName } of prefixes) {
      // Skip tables whose gateway is NONE or NOT_APPLICABLE.  For quiz-governed
      // entities applyQuizDerivedTableSemantics already zeros the cells, but
      // Project/Programme and Vocational Training are excluded from that path
      // so this is the primary phantom-data guard for those entity types.
      const statusKey = `${prefix.toUpperCase()}_RESPONSE_STATUS`;
      const statusVal = (flat[statusKey] ?? flat[`${prefix}_RESPONSE_STATUS`]) as string | undefined;
      if (statusVal === 'NONE' || statusVal === 'NOT_APPLICABLE') continue;

      for (const csp of cspRows) {
        for (const gender of genders) {
          for (const ageKey of ageBandKeys) {
            const value = this.flatInt(flat, `${prefix}_${csp}_${gender}_${ageKey}`);
            if (value !== 0) {
              rows.push({
                tableName,
                cspCategory: this.up(csp),
                gender: this.up(gender),
                ageBand: this.mapAgeBand(ageKey),
                value
              });
            }
          }
        }
      }

      for (const gender of genders) {
        for (const ageKey of ageBandKeys) {
          const value = this.flatInt(flat, `${prefix}_total_${gender}_${ageKey}`);
          if (value !== 0) {
            rows.push({
              tableName,
              cspCategory: 'TOTAL',
              gender: this.up(gender),
              ageBand: this.mapAgeBand(ageKey),
              value
            });
          }
        }
      }
    }

    return rows;
  }

  private buildDiplomaRows(flat: FlatFormData): object[] {
    const diplomas = ['cep', 'bepc', 'probatoire', 'bac', 'bts', 'licence', 'maitrise', 'master', 'dqp', 'cqp', 'autres', 'sans_diplome'];
    const genders = ['male', 'female', 'total'];
    const ageBandKeys = ['15_24', '25_34', '35_plus', 'total'];
    const csps = ['cadres', 'foremen', 'workers'];
    const prefix = 's22q03';
    const rows: object[] = [];

    const has4D = Object.keys(flat).some((k) =>
      k.startsWith(`${prefix}_cadres_`) ||
      k.startsWith(`${prefix}_foremen_`) ||
      k.startsWith(`${prefix}_workers_`)
    );

    if (has4D) {
      for (const csp of csps) {
        for (const diploma of diplomas) {
          for (const gender of genders) {
            for (const ageKey of ageBandKeys) {
              const value = this.flatInt(flat, `${prefix}_${csp}_${diploma}_${gender}_${ageKey}`);
              if (value !== 0) {
                rows.push({
                  cspCategory: this.up(csp),
                  diploma: this.up(diploma),
                  gender: this.up(gender),
                  ageBand: this.mapAgeBand(ageKey),
                  value
                });
              }
            }
          }
        }

        for (const gender of genders) {
          for (const ageKey of ageBandKeys) {
            const value = this.flatInt(flat, `${prefix}_${csp}_total_${gender}_${ageKey}`);
            if (value !== 0) {
              rows.push({
                cspCategory: this.up(csp),
                diploma: 'TOTAL',
                gender: this.up(gender),
                ageBand: this.mapAgeBand(ageKey),
                value
              });
            }
          }
        }
      }
    } else {
      for (const diploma of diplomas) {
        for (const gender of genders) {
          for (const ageKey of ageBandKeys) {
            const value = this.flatInt(flat, `${prefix}_${diploma}_${gender}_${ageKey}`);
            if (value !== 0) {
              rows.push({
                cspCategory: null,
                diploma: this.up(diploma),
                gender: this.up(gender),
                ageBand: this.mapAgeBand(ageKey),
                value
              });
            }
          }
        }
      }

      for (const gender of genders) {
        for (const ageKey of ageBandKeys) {
          const value = this.flatInt(flat, `${prefix}_total_${gender}_${ageKey}`);
          if (value !== 0) {
            rows.push({
              cspCategory: null,
              diploma: 'TOTAL',
              gender: this.up(gender),
              ageBand: this.mapAgeBand(ageKey),
              value
            });
          }
        }
      }
    }

    return rows;
  }

  private buildDisabilityRows(flat: FlatFormData, prefix: string, rowCategories: string[] = ['cadres', 'foremen', 'workers', 'total']): object[] {
    // Gateway guard: skip entirely if the table is absent or not reported.
    const statusKey = `${prefix.toUpperCase()}_RESPONSE_STATUS`;
    const statusVal = (flat[statusKey] ?? flat[`${prefix}_RESPONSE_STATUS`]) as string | undefined;
    if (statusVal === 'NONE' || statusVal === 'NOT_APPLICABLE') return [];

    const statuses = ['permanent', 'temporary', 'total'];
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];
    for (const row of rowCategories) {
      for (const status of statuses) {
        for (const gender of genders) {
          const value = this.flatInt(flat, `${prefix}_${row}_${status}_${gender}`);
          if (value !== 0) records.push({ cspCategory: this.up(row), status: this.up(status), gender: this.up(gender), value });
        }
      }
    }
    return records;
  }

  // Administration S21Q03: catégorie × sexe, no status dimension
  // (flat keys `${prefix}_${row}_${gender}`) — stored with status TOTAL.
  private buildStatuslessDisabilityRows(flat: FlatFormData, prefix: string, rowCategories: string[]): object[] {
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];
    for (const row of rowCategories) {
      for (const gender of genders) {
        const value = this.flatInt(flat, `${prefix}_${row}_${gender}`);
        if (value !== 0) records.push({ cspCategory: this.up(row), status: 'TOTAL', gender: this.up(gender), value });
      }
    }
    return records;
  }

  // Administration S21Q04: nature de la vulnérabilité × sexe, no status
  // dimension — stored with status TOTAL.
  private buildStatuslessVulnerableRows(flat: FlatFormData, prefix: string): object[] {
    const vulnerableRows = ['deplaces_internes', 'refugies', 'orphelins', 'total'];
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];
    for (const vRow of vulnerableRows) {
      for (const gender of genders) {
        const value = this.flatInt(flat, `${prefix}_${vRow}_${gender}`);
        if (value !== 0) {
          records.push({
            vulnerableType: vRow === 'total' ? 'TOTAL_VULN' : this.up(vRow),
            status: 'TOTAL',
            gender: this.up(gender),
            value,
          });
        }
      }
    }
    return records;
  }

  // Projects & Programs' S4Q06 — csp_status_gender_table shaped (unlike
  // the other four entities' named-vulnerability-type S22Q05), so this
  // mirrors buildDisabilityRows's loop exactly but writes into
  // OnefopVulnerableData's vulnerableType column using its existing
  // CADRES_VULN/FOREMEN_VULN/WORKERS_VULN/TOTAL_VULN values.
  private buildCspVulnerableRows(flat: FlatFormData, prefix: string): object[] {
    // Gateway guard: skip entirely if the table is absent or not reported.
    const statusKey = `${prefix.toUpperCase()}_RESPONSE_STATUS`;
    const statusVal = (flat[statusKey] ?? flat[`${prefix}_RESPONSE_STATUS`]) as string | undefined;
    if (statusVal === 'NONE' || statusVal === 'NOT_APPLICABLE') return [];

    const rows = ['cadres', 'foremen', 'workers', 'total'];
    const vulnerableTypeMap: Record<string, string> = {
      cadres: 'CADRES_VULN',
      foremen: 'FOREMEN_VULN',
      workers: 'WORKERS_VULN',
      total: 'TOTAL_VULN',
    };
    const statuses = ['permanent', 'temporary', 'total'];
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];
    for (const row of rows) {
      for (const status of statuses) {
        for (const gender of genders) {
          const value = this.flatInt(flat, `${prefix}_${row}_${status}_${gender}`);
          if (value !== 0) {
            records.push({
              vulnerableType: vulnerableTypeMap[row],
              status: this.up(status),
              gender: this.up(gender),
              value,
            });
          }
        }
      }
    }
    return records;
  }

  private buildVulnerableEnterpriseRows(flat: FlatFormData): object[] {
    const prefix = 's22q05_ent';
    const vulnerableRows = ['deplaces_internes', 'refugies', 'orphelins', 'total'];
    const statuses = ['permanent', 'temporary', 'total'];
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];

    for (const vRow of vulnerableRows) {
      for (const status of statuses) {
        for (const gender of genders) {
          const value = this.flatInt(flat, `${prefix}_${vRow}_${status}_${gender}`);
          if (value !== 0) {
            // Map 'total' to 'TOTAL_VULN' instead of 'TOTAL'
            let vulnerableType = this.up(vRow);
            if (vulnerableType === 'TOTAL') {
              vulnerableType = 'TOTAL_VULN';
            }

            records.push({
              vulnerableType: vulnerableType,
              status: this.up(status),
              gender: this.up(gender),
              value
            });
          }
        }
      }
    }

    return records;
  }

  private buildVulnerableOtherRows(flat: FlatFormData): object[] {
    const prefix = 's22q05_oth';
    const vulnerableRows = ['deplaces_internes', 'refugies', 'orphelins', 'total'];
    const statuses = ['permanent', 'temporary', 'total'];
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];

    for (const vRow of vulnerableRows) {
      for (const status of statuses) {
        for (const gender of genders) {
          const value = this.flatInt(flat, `${prefix}_${vRow}_${status}_${gender}`);
          if (value !== 0) {
            records.push({
              vulnerableType: vRow === 'total' ? 'TOTAL_VULN' : this.up(vRow),
              status: this.up(status),
              gender: this.up(gender),
              value,
            });
          }
        }
      }
    }

    return records;
  }

  private buildFirstTimeWorkerRows(flat: FlatFormData): object[] {
    const prefix = 's23q02';
    const contracts = ['permanent', 'temporary'];
    const cspRows = ['cadres', 'foremen', 'workers'];
    const genders = ['male', 'female', 'total'];
    const ageBandKeys = ['15_24', '25_34', '35_plus', 'total'];
    const records: object[] = [];

    for (const contract of contracts) {
      for (const csp of cspRows) {
        for (const gender of genders) {
          for (const ageKey of ageBandKeys) {
            const value = this.flatInt(flat, `${prefix}_${contract}_${csp}_${gender}_${ageKey}`);
            if (value !== 0) {
              records.push({
                contractType: this.up(contract),
                cspCategory: this.up(csp),
                gender: this.up(gender),
                ageBand: this.mapAgeBand(ageKey),
                value
              });
            }
          }
        }
      }
      // Per-contract subtotal (sum across CSP categories): CspCategory has no
      // 'SUBTOTAL' member, but 'TOTAL' is unused for a specific (non-TOTAL)
      // contractType elsewhere in this table, so it uniquely represents
      // "all CSP categories, this one contract type" without colliding with
      // the per-CSP rows above or the grand-total rows below.
      for (const gender of genders) {
        for (const ageKey of ageBandKeys) {
          const value = this.flatInt(flat, `${prefix}_${contract}_subtotal_${gender}_${ageKey}`);
          if (value !== 0) {
            records.push({
              contractType: this.up(contract),
              cspCategory: 'TOTAL',
              gender: this.up(gender),
              ageBand: this.mapAgeBand(ageKey),
              value
            });
          }
        }
      }
    } // ← contract loop ends here

    // grand total — runs once after both contracts are collected
    for (const gender of genders) {
      for (const ageKey of ageBandKeys) {
        const value = this.flatInt(flat, `${prefix}_total_${gender}_${ageKey}`);
        if (value !== 0) {
          records.push({
            contractType: 'TOTAL',
            cspCategory: 'TOTAL',
            gender: this.up(gender),
            ageBand: this.mapAgeBand(ageKey),
            value
          });
        }
      }
    }

    return records;
  }

  // cspRows defaults to the CSP category set; Administration's S3Q01 uses
  // SFP status categories instead — see the entityType-aware call site.
  private buildDepartureRows(
    flat: FlatFormData,
    cspRows: string[] = ['cadres', 'foremen', 'workers', 'total'],
  ): object[] {
    const prefix = 's3q01';
    const departureTypes = ['dismissal', 'resignation', 'retirement', 'other', 'ensemble'];
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];
    for (const csp of cspRows) {
      for (const type of departureTypes) {
        for (const gender of genders) {
          const value = this.flatInt(flat, `${prefix}_${csp}_${type}_${gender}`);
          if (value !== 0) records.push({ cspCategory: this.up(csp), departureType: this.up(type), gender: this.up(gender), value });
        }
      }
    }
    return records;
  }

  private buildDismissalReasonRows(flat: FlatFormData): object[] {
    const records: object[] = [];
    for (let i = 1; i <= 3; i++) {
      const reasonText = this.flatStr(flat, `s3q02_reason_${i}_text`);
      const male = this.flatInt(flat, `s3q02_reason_${i}_male`);
      const female = this.flatInt(flat, `s3q02_reason_${i}_female`);
      const total = this.flatInt(flat, `s3q02_reason_${i}_total`);
      if (reasonText || male !== 0 || female !== 0) {
        records.push({ reasonIndex: i, reasonText, maleCount: male, femaleCount: female, totalCount: total > 0 ? total : male + female });
      }
    }
    return records;
  }

  private buildDismissalUnemploymentRows(flat: FlatFormData): object[] {
    const prefix = 's3q03';
    const cspRows = ['cadres', 'foremen', 'workers', 'total'];
    const types = ['dismissal', 'technical_unemployment', 'total'];
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];
    for (const csp of cspRows) {
      for (const type of types) {
        for (const gender of genders) {
          const value = this.flatInt(flat, `${prefix}_${csp}_${type}_${gender}`);
          if (value !== 0) records.push({ cspCategory: this.up(csp), type: this.up(type), gender: this.up(gender), value });
        }
      }
    }
    return records;
  }

  private buildInternshipRows(flat: FlatFormData): object[] {
    const prefix = 's4q01';
    const internshipTypes = ['vacation', 'academic', 'professional', 'pre_employment', 'total'];
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];
    for (const type of internshipTypes) {
      for (const gender of genders) {
        const value = this.flatInt(flat, `${prefix}_${type}_${gender}`);
        if (value !== 0) records.push({ internshipType: this.up(type), gender: this.up(gender), value });
      }
    }
    return records;
  }

  private buildSkillNeedRows(flat: FlatFormData): object[] {
    const records: object[] = [];
    for (let i = 1; i <= 3; i++) {
      const description = this.flatStr(flat, `s4q02_skill_${i}_text`);
      const male = this.flatInt(flat, `s4q02_skill_${i}_male`);
      const female = this.flatInt(flat, `s4q02_skill_${i}_female`);
      const total = this.flatInt(flat, `s4q02_skill_${i}_total`);
      if (description || male !== 0 || female !== 0) {
        records.push({ skillIndex: i, skillDescription: description, maleCount: male, femaleCount: female, totalCount: total > 0 ? total : male + female });
      }
    }
    return records;
  }

  private buildTrainingNeedRows(flat: FlatFormData): object[] {
    const records: object[] = [];
    for (let i = 1; i <= 3; i++) {
      const domain = this.flatStr(flat, `s4q03_domain_${i}_text`);
      const male = this.flatInt(flat, `s4q03_domain_${i}_male`);
      const female = this.flatInt(flat, `s4q03_domain_${i}_female`);
      const total = this.flatInt(flat, `s4q03_domain_${i}_total`);
      if (domain || male !== 0 || female !== 0) {
        records.push({ domainIndex: i, trainingDomain: domain, maleCount: male, femaleCount: female, totalCount: total > 0 ? total : male + female });
      }
    }
    return records;
  }

  // cspRows defaults to the CSP category set; Administration's S21Q01 uses
  // SFP status categories instead — see the entityType-aware call site.
  private buildJobApplicationRows(
    flat: FlatFormData,
    cspRows: string[] = ['cadres', 'foremen', 'workers', 'total'],
  ): object[] {
    const prefix = 's21q01';
    const genders = ['male', 'female', 'total'];
    const ageBandKeys = ['15_24', '25_34', '35_plus', 'total'];
    const rows: object[] = [];
    const now = new Date();

    for (const csp of cspRows) {
      for (const gender of genders) {
        for (const ageKey of ageBandKeys) {
          const value = this.flatInt(flat, `${prefix}_${csp}_${gender}_${ageKey}`);
          if (value !== 0) {
            rows.push({
              id: randomUUID(),
              cspCategory: this.up(csp),
              gender: this.up(gender),
              ageBand: this.mapAgeBand(ageKey),
              value,
              createdAt: now,
            });
          }
        }
      }
    }

    return rows;
  }

  private buildRegisteredSeekerRows(flat: FlatFormData): object[] {
    // S23Q01 has no contract-type dimension in the form (only S23Q02 does) --
    // the flat keys are `s23q01_${csp}_${gender}_${ageKey}`, with 'total' used
    // as a real csp value for the CSP-total row, mirroring buildCspGenderAgeRows.
    // contractType is set to the constant 'TOTAL' since this table's schema
    // requires a value but the section was never broken down by contract.
    const prefix = 's23q01';
    const cspRows = ['cadres', 'foremen', 'workers'];
    const genders = ['male', 'female', 'total'];
    const ageBandKeys = ['15_24', '25_34', '35_plus', 'total'];
    const rows: object[] = [];
    const now = new Date();

    for (const csp of cspRows) {
      for (const gender of genders) {
        for (const ageKey of ageBandKeys) {
          const value = this.flatInt(flat, `${prefix}_${csp}_${gender}_${ageKey}`);
          if (value !== 0) {
            rows.push({
              id: randomUUID(),
              contractType: 'TOTAL',
              cspCategory: this.up(csp),
              gender: this.up(gender),
              ageBand: this.mapAgeBand(ageKey),
              value,
              createdAt: now,
            });
          }
        }
      }
    }

    for (const gender of genders) {
      for (const ageKey of ageBandKeys) {
        const value = this.flatInt(flat, `${prefix}_total_${gender}_${ageKey}`);
        if (value !== 0) {
          rows.push({
            id: randomUUID(),
            contractType: 'TOTAL',
            cspCategory: 'TOTAL',
            gender: this.up(gender),
            ageBand: this.mapAgeBand(ageKey),
            value,
            createdAt: now,
          });
        }
      }
    }

    return rows;
  }
  private mapLegalStatus(value?: 1 | 2 | 3 | 4): string {
    const map: Record<number, string> = { 1: 'Société unipersonnelle/ Single-member company', 2: 'SARL/ LLC', 3: 'SA/ PLC', 4: 'Autres/ Others' };
    return value ? (map[value] ?? '') : '';
  }
  private mapArea(value?: 1 | 2): string {
    return value === 1 ? 'Urbain/ Urban' : value === 2 ? 'Rural/ Rural' : '';
  }
  private mapSector(value?: 1 | 2 | 3): string {
    const map: Record<number, string> = { 1: 'Primaire/ Primary', 2: 'Secondaire/ Secondary', 3: 'Tertiaire/ Tertiary' };
    return value ? (map[value] ?? '') : '';
  }
  private mapCompanySize(value?: 1 | 2 | 3 | 4): string {
    const map: Record<number, string> = { 1: 'TPE/ Very small enterprise', 2: 'PE/ Small enterprise', 3: 'ME/ Medium-sized enterprise', 4: 'GE/ Large enterprise' };
    return value ? (map[value] ?? '') : '';
  }
  private mapCooperativeType(value?: 1 | 2 | 3): string {
    const map: Record<number, string> = { 1: "Coopérative à comptabilité simplifiée", 2: "Coopérative avec conseil d'administration", 3: 'Autre (à préciser)/ Other (specify)' };
    return value ? (map[value] ?? '') : '';
  }
  private mapCtdType(value?: 1 | 2): string {
    const map: Record<number, string> = { 1: 'Région/ Region', 2: 'Commune/ Council' };
    return value ? (map[value] ?? '') : '';
  }
  private mapCouncilType(value?: 1 | 2): string {
    const map: Record<number, string> = { 1: "Commune d'Arrondissement/ Local Council", 2: 'Communauté Urbaine/ Urban Council' };
    return value ? (map[value] ?? '') : '';
  }

  // ... existing methods above ...

  private async resolveGeoAndSector(
    tx: TxClient,
    regionName: string | null | undefined,
    departmentName: string | null | undefined,
    subdivisionName: string | null | undefined,
    sectorValue: string | null | undefined,
  ): Promise<{
    regionId: string | null;
    departmentId: string | null;
    subdivisionId: string | null;
    sectorId: string | null;
  }> {
    let regionId: string | null = null;
    let departmentId: string | null = null;
    let subdivisionId: string | null = null;
    let sectorId: string | null = null;

    if (subdivisionName && departmentName && regionName) {
      const subdiv = await tx.subdivision.findFirst({
        where: {
          name: { equals: subdivisionName, mode: 'insensitive' },
          department: {
            name: { equals: departmentName, mode: 'insensitive' },
            region: {
              name: { equals: regionName, mode: 'insensitive' },
            },
          },
        },
        include: {
          department: {
            include: { region: true },
          },
        },
      });
      if (subdiv) {
        subdivisionId = subdiv.id;
        departmentId = subdiv.department.id;
        regionId = subdiv.department.region.id;
      }
    } else if (departmentName && regionName) {
      const dept = await tx.department.findFirst({
        where: {
          name: { equals: departmentName, mode: 'insensitive' },
          region: {
            name: { equals: regionName, mode: 'insensitive' },
          },
        },
        include: { region: true },
      });
      if (dept) {
        departmentId = dept.id;
        regionId = dept.region.id;
      }
    } else if (regionName) {
      const reg = await tx.region.findFirst({
        where: { name: { equals: regionName, mode: 'insensitive' } },
      });
      if (reg) regionId = reg.id;
    }

    if (sectorValue !== undefined && sectorValue !== null) {
      const categoryMap: Record<string, string> = {
        'primaire': 'Primary',
        'primary': 'Primary',
        'secondaire': 'Secondary',
        'secondary': 'Secondary',
        'tertiaire': 'Tertiary',
        'tertiary': 'Tertiary',
      };
      const numericCategoryMap: Record<string, string> = {
        '1': 'Primary',
        '2': 'Secondary',
        '3': 'Tertiary',
      };
      const normalizedSector = String(sectorValue).trim();
      const lower = normalizedSector.toLowerCase();
      const category =
        (numericCategoryMap[lower] ||
          Object.entries(categoryMap).find(([k]) => lower.includes(k))?.[1]) ??
        null;

      if (category) {
        const sector = await tx.sector.findFirst({
          where: { category },
        });
        if (sector) sectorId = sector.id;
      }
    }

    return { regionId, departmentId, subdivisionId, sectorId };
  }

  private getCurrentQuarter(): string {
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    return `${year}-T${quarter}`;
  }

  async getQuestionnaireById(id: string, territory?: Territory) {
    return (this.prisma as any).onefopSubmission.findFirst({
      where: { id, ...territoryWhere(territory) },
      include: { respondent: true, enterpriseDetail: true, cooperativeDetail: true, ctdDetail: true, ongDetail: true, administrationDetail: true, projectProgramDetail: true, projectProgramActivities: true, cspGenderAge: true, diplomaData: true, disabilityData: true, vulnerableData: true, firstTimeWorkers: true, departureData: true, dismissalReasons: true, dismissalUnemployment: true, internshipData: true, skillNeeds: true, trainingNeeds: true, vocationalTrainingDetail: true, vtDiplomaData: true, vtTraineeAgeFlow: true, vtTrainerAge: true, vtEducationLevelFlow: true, vtTraineeVulnerable: true, vtTrainerDisability: true, vtScholarship: true, vtSpecialtyRows: true, vtCurricula: true, vtInfrastructure: true, vtFurniture: true, vtTrainerRoster: true },
    });
  }

  /**
   * One page of the admin dossier list plus `total`, the count of the SAME
   * filtered query (built by buildAdminListWhere: territory + draft exclusion
   * + status + type + region + period + search), so "sur N" always matches
   * what the filters produce.
   */
  async listForAdmin(
    filters: AdminListFilters & { limit: number; offset: number },
    territory?: Territory,
  ): Promise<{ items: any[]; total: number }> {
    const where = buildAdminListWhere(filters, territory);

    const [items, total] = await Promise.all([
      (this.prisma as any).onefopSubmission.findMany({
        where,
        // id breaks createdAt ties so offset paging never repeats or skips rows.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: filters.limit,
        skip: filters.offset,
        include: {
          respondent: true,
          enterpriseDetail: true,
          cooperativeDetail: true,
          ctdDetail: true,
          ongDetail: true,
          administrationDetail: true,
          projectProgramDetail: true,
          vocationalTrainingDetail: true,
          anomalies: true,
        },
      }),
      (this.prisma as any).onefopSubmission.count({ where }),
    ]);
    return { items, total };
  }

  async listByStatus(status: string, limit: number, offset: number, territory?: Territory) {
    return (this.prisma as any).onefopSubmission.findMany({
      where: { status, ...territoryWhere(territory) }, orderBy: { createdAt: 'desc' }, take: limit, skip: offset,
      include: {
        respondent: true,
        enterpriseDetail: true,
        cooperativeDetail: true,
        ctdDetail: true,
        ongDetail: true,
        administrationDetail: true,
        projectProgramDetail: true,
        vocationalTrainingDetail: true,
        anomalies: true,
      },
    });
  }

  async getById(id: string, territory?: Territory) {
    // Out-of-territory rows are reported as not found (no existence leak).
    const submission = await (this.prisma as any).onefopSubmission.findFirst({
      where: { id, ...territoryWhere(territory) },
      include: { respondent: true, enterpriseDetail: true, cooperativeDetail: true, ctdDetail: true, ongDetail: true, administrationDetail: true, projectProgramDetail: true, projectProgramActivities: true, cspGenderAge: true, diplomaData: true, disabilityData: true, vulnerableData: true, firstTimeWorkers: true, departureData: true, dismissalReasons: true, dismissalUnemployment: true, internshipData: true, skillNeeds: true, trainingNeeds: true, vocationalTrainingDetail: true, vtDiplomaData: true, vtTraineeAgeFlow: true, vtTrainerAge: true, vtEducationLevelFlow: true, vtTraineeVulnerable: true, vtTrainerDisability: true, vtScholarship: true, vtSpecialtyRows: true, vtCurricula: true, vtInfrastructure: true, vtFurniture: true, vtTrainerRoster: true },
    });
    if (!submission) throw new NotFoundException(`Questionnaire with id ${id} not found`);
    return submission;
  }

  async approve(id: string, reviewedBy?: string, territory?: Territory) {
    const submission = await this.getById(id, territory);
    if (submission.status !== 'PENDING_REVIEW') {
      throw new BadRequestException(`Impossible d'approuver un dossier au statut ${submission.status}.`);
    }
    await this.eligibilityEngine!.assertCanApprove(id);
    const updated = await (this.prisma as any).onefopSubmission.update({ where: { id }, data: { status: 'APPROVED', reviewedBy: reviewedBy ?? null, reviewedAt: new Date() } });
    // Campaign progress B4: best-effort, never fails the approval.
    await syncCampaignSubmissionOnReview(this.prisma, this.logger, submission, 'VALIDATED');
    return updated;
  }

  async reject(id: string, reason: string, reviewedBy?: string, territory?: Territory) {
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException('La justification du rejet doit comporter au moins 10 caractères.');
    }
    const submission = await this.getById(id, territory);
    if (submission.status !== 'PENDING_REVIEW' && submission.status !== 'CORRECTION_REQUESTED') {
      throw new BadRequestException(`Impossible de rejeter un dossier au statut ${submission.status}.`);
    }
    if (reviewedBy) {
      await (this.prisma as any).auditLog.create({
        data: {
          userId: reviewedBy,
          action: 'AUDIT_REJECT',
          resourceType: 'OnefopSubmission',
          resourceId: id,
          details: { reason },
        },
      });
    }
    const updated = await (this.prisma as any).onefopSubmission.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: reason, reviewedBy: reviewedBy ?? null, reviewedAt: new Date() } });
    // Campaign progress B4: best-effort, never fails the rejection.
    await syncCampaignSubmissionOnReview(this.prisma, this.logger, submission, 'PENDING');
    return updated;
  }

  async requestCorrection(id: string, comments: string, certified: boolean, reviewedBy?: string, territory?: Territory) {
    if (certified !== true) {
      throw new BadRequestException('La certification est requise pour confirmer la demande de correction.');
    }
    if (!comments || comments.trim().length < 10) {
      throw new BadRequestException('La justification de la demande de correction doit comporter au moins 10 caractères.');
    }
    const submission = await this.getById(id, territory);
    if (submission.status !== 'PENDING_REVIEW') {
      throw new BadRequestException(`Impossible de demander une correction sur un dossier au statut ${submission.status}.`);
    }
    if (reviewedBy) {
      await (this.prisma as any).auditLog.create({
        data: {
          userId: reviewedBy,
          action: 'AUDIT_CORRECTION',
          resourceType: 'OnefopSubmission',
          resourceId: id,
          details: { comments, previousStatus: submission.status, certified: true },
        },
      });
    }
    const updated = await (this.prisma as any).onefopSubmission.update({ where: { id }, data: { status: 'CORRECTION_REQUESTED', rejectionReason: comments, reviewedBy: reviewedBy ?? null, reviewedAt: new Date() } });
    // Campaign progress B4: best-effort, never fails the correction request.
    await syncCampaignSubmissionOnReview(this.prisma, this.logger, submission, 'PENDING');
    return updated;
  }

  // ── Dossier list export helpers ─────────────────────────────────────────────

  private csvSemicolonRow(fields: unknown[]): string {
    const cells = fields.map((f) => {
      if (f === null || f === undefined) return '';
      const s = f instanceof Date ? f.toISOString().slice(0, 10) : String(f);
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return /[;"'\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    });
    return cells.join(';') + '\r\n';
  }

  private exportEntityName(row: any): string {
    return (
      row.enterpriseDetail?.companyName ||
      row.cooperativeDetail?.cooperativeName ||
      row.ongDetail?.ongName ||
      row.administrationDetail?.name ||
      row.projectProgramDetail?.name ||
      row.vocationalTrainingDetail?.name ||
      `Dossier ${row.submissionId}`
    );
  }

  private exportStatusLabel(status: string): string {
    switch (status) {
      case 'APPROVED': return 'Visé';
      case 'PENDING_REVIEW': return 'En instance';
      case 'REJECTED': return 'Rejeté';
      default: return 'Correction demandée';
    }
  }

  private exportQualityLabel(row: any): string {
    const blockingCount = row.anomalies?.filter((a: any) => a.isBlocking && a.status === 'OPEN').length ?? 0;
    const warningCount = row.anomalies?.filter((a: any) => !a.isBlocking && a.status === 'OPEN').length ?? 0;
    if (blockingCount > 0) return `Anomalies (${blockingCount})`;
    if (warningCount > 0) return `Avertissements (${warningCount})`;
    return 'Conforme';
  }

  private exportEligibilityLabel(row: any): string {
    const blockingCount = row.anomalies?.filter((a: any) => a.isBlocking && a.status === 'OPEN').length ?? 0;
    return row.status === 'APPROVED' && blockingCount === 0 ? 'Diffusable' : 'Exclu';
  }

  async streamDossiersExport(
    filters: AdminListFilters,
    format: 'csv' | 'xlsx',
    territory: Territory | undefined,
    userId: string | undefined,
    res: Response,
  ): Promise<void> {
    const EXPORT_MAX_ROWS = 50_000;
    const BATCH_SIZE = 500;
    const where = buildAdminListWhere(filters, territory);

    const count: number = await (this.prisma as any).onefopSubmission.count({ where });
    if (count > EXPORT_MAX_ROWS) {
      res.status(400).json({
        statusCode: 400,
        message: `L'export est limité à ${EXPORT_MAX_ROWS.toLocaleString()} lignes. Affinez les filtres pour réduire la sélection (${count} dossiers trouvés).`,
      });
      return;
    }

    const columns = [
      'ID soumission', 'Entité', 'Type', 'Région', 'Période',
      'Statut', 'Qualité', 'Diffusabilité', 'Date de soumission', 'Répondant',
    ];
    const date = new Date().toISOString().slice(0, 10);

    const include = {
      respondent: true,
      enterpriseDetail: true,
      cooperativeDetail: true,
      ctdDetail: true,
      ongDetail: true,
      administrationDetail: true,
      projectProgramDetail: true,
      vocationalTrainingDetail: true,
      anomalies: { select: { isBlocking: true, status: true } },
    };

    const rowFields = (row: any): unknown[] => [
      row.submissionId,
      this.exportEntityName(row),
      row.formType ?? '',
      row.region ?? '',
      row.period ?? '',
      this.exportStatusLabel(row.status),
      this.exportQualityLabel(row),
      this.exportEligibilityLabel(row),
      row.submittedAt,
      row.respondent?.name ?? '',
    ];

    try {
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="dossiers_${date}.csv"`);
        res.write('﻿' + this.csvSemicolonRow(columns));

        let cursor: string | undefined;
        try {
          for (;;) {
            const batch: any[] = await (this.prisma as any).onefopSubmission.findMany({
              where,
              orderBy: { id: 'asc' },
              take: BATCH_SIZE,
              ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
              include,
            });
            if (batch.length === 0) break;
            let chunk = '';
            for (const row of batch) chunk += this.csvSemicolonRow(rowFields(row));
            if (!res.write(chunk)) {
              await new Promise<void>((resolve) => res.once('drain', resolve));
            }
            cursor = batch[batch.length - 1].id;
            if (batch.length < BATCH_SIZE) break;
          }
        } catch (err) {
          console.error('❌ Dossiers CSV export failed mid-stream:', err);
        }
        res.end();
      } else {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="dossiers_${date}.xlsx"`);
        const workbookWriter = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
        workbookWriter.creator = 'MINEFOP';
        workbookWriter.created = new Date();
        const sheet = workbookWriter.addWorksheet('Dossiers');
        (sheet.addRow(columns) as any).commit();

        let cursor: string | undefined;
        try {
          for (;;) {
            const batch: any[] = await (this.prisma as any).onefopSubmission.findMany({
              where,
              orderBy: { id: 'asc' },
              take: BATCH_SIZE,
              ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
              include,
            });
            if (batch.length === 0) break;
            for (const row of batch) (sheet.addRow(rowFields(row)) as any).commit();
            cursor = batch[batch.length - 1].id;
            if (batch.length < BATCH_SIZE) break;
          }
        } catch (err) {
          console.error('❌ Dossiers Excel export failed mid-stream:', err);
        }
        (sheet as any).commit();
        await workbookWriter.commit();
      }
    } finally {
      if (userId) {
        try {
          await (this.prisma as any).auditLog.create({
            data: {
              userId,
              action: 'AUDIT_LIST_EXPORT',
              resourceType: 'OnefopSubmission',
              // resourceId is a required column: a list export has no single
              // row, so use a sentinel, as bulk visa does with BULK_<timestamp>.
              resourceId: `EXPORT_${Date.now()}`,
              details: { format, filters, count },
            },
          });
        } catch (auditErr) {
          // An export without its audit row must not pass unnoticed. The file
          // is already sent; Nest's exception filter only ends the response
          // (headers sent) and logs the rethrown error again.
          this.logger.error(
            `AUDIT_LIST_EXPORT audit write failed (user ${userId}, ${format}, ${count} rows)`,
            auditErr instanceof Error ? auditErr.stack : String(auditErr),
          );
          throw auditErr;
        }
      }
    }
  }
}

