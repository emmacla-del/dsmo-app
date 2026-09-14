// src/questionnaires/questionnaires.service.ts
import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  administration: [
    'S21Q01_RESPONSE_STATUS',
    'S22Q01_RESPONSE_STATUS',
    'S22Q04_RESPONSE_STATUS',
    'S22Q05_RESPONSE_STATUS',
    'S3Q01_RESPONSE_STATUS',
    'S3Q02_RESPONSE_STATUS',
    'S4Q01_RESPONSE_STATUS',
    'S4Q02_RESPONSE_STATUS',
  ],
  projectProgram: [
    'S4Q01_RESPONSE_STATUS',
    'S4Q02_RESPONSE_STATUS',
    'S4Q03_RESPONSE_STATUS',
  ],
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
  const upper = type?.toUpperCase() || '';
  if (upper === 'ENTERPRISE' || upper === 'ENTREPRISE') return 'ENTREPRISE';
  if (upper === 'COOPERATIVE') return 'COOPERATIVE';
  if (upper === 'CTD') return 'CTD';
  if (upper === 'ONG') return 'ONG';
  if (upper === 'ADMINISTRATION') return 'ADMINISTRATION';
  if (upper === 'PROJECT_PROGRAM') return 'PROJECT_PROGRAM';
  if (upper === 'VOCATIONAL_TRAINING') return 'VOCATIONAL_TRAINING';
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
  constructor(private prisma: PrismaService) { }

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
      throw new BadRequestException(
        "Aucune période de soumission ONEFOP n'est actuellement ouverte.",
      );
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

    // VT-5: enforceFinalRequiredFields is deliberately not applied to
    // VOCATIONAL_TRAINING. FINAL_REQUIRED_FIELDS has no 'vocationalTraining'
    // entry (so the entity-specific list is harmlessly empty either way),
    // but FINAL_TABLE_RESPONSE_FIELDS_BY_ENTITY also has none — its `??`
    // fallback would silently apply the full 14-field enterprise-family
    // xxx_RESPONSE_STATUS list (a fallback the comment above that map notes
    // is normally unreachable for the six known entities) to VT, which has
    // none of those AST fields at all, permanently blocking every VT final
    // submission. Skipping the call entirely — the smallest existing
    // entity-aware bypass — avoids reopening that map or its fallback
    // behavior for the six existing entities.
    if (!isDraft && normalizedEntityType !== 'VOCATIONAL_TRAINING') {
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

    // Coherence flags don't block submission — a draft is legitimately
    // incomplete, so these checks only make sense once the respondent has
    // declared the form final. VT-5: checkCoherence is not invoked for
    // VOCATIONAL_TRAINING — its own coherence rules (design note §10) are a
    // later, still-frozen phase; checkCoherence's own logic only reads
    // enterprise-family s22q0x/s3q0x flat keys, which no VT submission ever
    // produces, so this gate is a deliberate scope boundary, not a
    // workaround for a real collision.
    const coherenceFlags = isDraft || normalizedEntityType === 'VOCATIONAL_TRAINING'
      ? []
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
    const disabilityRows = normalizedEntityType === 'PROJECT_PROGRAM'
      ? this.buildDisabilityRows(flat, 'pp_s4q05')
      : this.buildDisabilityRows(flat, 's22q04');
    // S4Q06 (vulnerable) is ALSO csp_status_gender_table-shaped for this
    // entity, unlike the other four entities' named-vulnerability-type
    // S22Q05 — VulnerableType already has CADRES_VULN/FOREMEN_VULN/
    // WORKERS_VULN/TOTAL_VULN (unused until now), so no schema change is
    // needed; see buildCspVulnerableRows below.
    const vulnerableRows = normalizedEntityType === 'PROJECT_PROGRAM'
      ? this.buildCspVulnerableRows(flat, 'pp_s4q06')
      : normalizedEntityType === 'ENTREPRISE'
        ? this.buildVulnerableEnterpriseRows(flat)
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
      throw err;
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
      throw new BadRequestException(
        `Informations obligatoires manquantes : ${summary}. Veuillez compléter le formulaire avant de soumettre. / ` +
        `Missing required information: ${summary}. Please complete the form before submitting.`,
      );
    }
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
    const prefix = 's22q03';
    const rows: object[] = [];

    for (const diploma of diplomas) {
      for (const gender of genders) {
        for (const ageKey of ageBandKeys) {
          const value = this.flatInt(flat, `${prefix}_${diploma}_${gender}_${ageKey}`);
          if (value !== 0) {
            rows.push({
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
            diploma: 'TOTAL',
            gender: this.up(gender),
            ageBand: this.mapAgeBand(ageKey),
            value
          });
        }
      }
    }

    return rows;
  }

  private buildDisabilityRows(flat: FlatFormData, prefix: string): object[] {
    const rows = ['cadres', 'foremen', 'workers', 'total'];
    const statuses = ['permanent', 'temporary', 'total'];
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];
    for (const row of rows) {
      for (const status of statuses) {
        for (const gender of genders) {
          const value = this.flatInt(flat, `${prefix}_${row}_${status}_${gender}`);
          if (value !== 0) records.push({ cspCategory: this.up(row), status: this.up(status), gender: this.up(gender), value });
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

  async getAllQuestionnaires() {
    return (this.prisma as any).onefopSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      include: { respondent: true, enterpriseDetail: true, cooperativeDetail: true, ctdDetail: true, ongDetail: true, administrationDetail: true, projectProgramDetail: true, vocationalTrainingDetail: true },
    });
  }

  async getQuestionnaireById(id: string) {
    return (this.prisma as any).onefopSubmission.findUnique({
      where: { id },
      include: { respondent: true, enterpriseDetail: true, cooperativeDetail: true, ctdDetail: true, ongDetail: true, administrationDetail: true, projectProgramDetail: true, projectProgramActivities: true, cspGenderAge: true, diplomaData: true, disabilityData: true, vulnerableData: true, firstTimeWorkers: true, departureData: true, dismissalReasons: true, dismissalUnemployment: true, internshipData: true, skillNeeds: true, trainingNeeds: true, vocationalTrainingDetail: true, vtDiplomaData: true, vtTraineeAgeFlow: true, vtTrainerAge: true, vtEducationLevelFlow: true, vtTraineeVulnerable: true, vtTrainerDisability: true, vtScholarship: true, vtSpecialtyRows: true, vtCurricula: true, vtInfrastructure: true, vtFurniture: true, vtTrainerRoster: true },
    });
  }

  async listByStatus(status: string, limit: number, offset: number) {
    return (this.prisma as any).onefopSubmission.findMany({
      where: { status }, orderBy: { createdAt: 'desc' }, take: limit, skip: offset,
      include: { respondent: true, enterpriseDetail: true, cooperativeDetail: true, ctdDetail: true, ongDetail: true, administrationDetail: true, projectProgramDetail: true, vocationalTrainingDetail: true },
    });
  }

  async getById(id: string) {
    const submission = await (this.prisma as any).onefopSubmission.findUnique({
      where: { id },
      include: { respondent: true, enterpriseDetail: true, cooperativeDetail: true, ctdDetail: true, ongDetail: true, administrationDetail: true, projectProgramDetail: true, projectProgramActivities: true, cspGenderAge: true, diplomaData: true, disabilityData: true, vulnerableData: true, firstTimeWorkers: true, departureData: true, dismissalReasons: true, dismissalUnemployment: true, internshipData: true, skillNeeds: true, trainingNeeds: true, vocationalTrainingDetail: true, vtDiplomaData: true, vtTraineeAgeFlow: true, vtTrainerAge: true, vtEducationLevelFlow: true, vtTraineeVulnerable: true, vtTrainerDisability: true, vtScholarship: true, vtSpecialtyRows: true, vtCurricula: true, vtInfrastructure: true, vtFurniture: true, vtTrainerRoster: true },
    });
    if (!submission) throw new NotFoundException(`Questionnaire with id ${id} not found`);
    return submission;
  }

  async approve(id: string, reviewedBy?: string) {
    await this.getById(id);
    return (this.prisma as any).onefopSubmission.update({ where: { id }, data: { status: 'APPROVED', reviewedBy: reviewedBy ?? null, reviewedAt: new Date() } });
  }

  async reject(id: string, reason: string, reviewedBy?: string) {
    await this.getById(id);
    return (this.prisma as any).onefopSubmission.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: reason, reviewedBy: reviewedBy ?? null, reviewedAt: new Date() } });
  }

  async requestCorrection(id: string, comments: string, reviewedBy?: string) {
    await this.getById(id);
    return (this.prisma as any).onefopSubmission.update({ where: { id }, data: { status: 'CORRECTION_REQUESTED', rejectionReason: comments, reviewedBy: reviewedBy ?? null, reviewedAt: new Date() } });
  }
}

