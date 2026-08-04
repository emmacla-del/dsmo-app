// src/questionnaires/questionnaires.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OnefopSubmissionDto } from '../dto/onefop-submission.dto';
import { OnefopResponseDto } from '../dto/onefop-response.dto';
import {
  AnyQuestionnaireDto,
  EnterpriseQuestionnaireDto,
  CooperativeQuestionnaireDto,
  CtdQuestionnaireDto,
  OngQuestionnaireDto,
} from '../dto/onefop-questionnaire.dto';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { randomUUID } from 'crypto';
import {
  normalizeFlatKeys,
  buildNestedDto,
} from '../common/normalizers/flat-key-normalizer';

type FlatFormData = Record<string, string | number>;
type TxClient = any;

const FINAL_REQUIRED_FIELDS: Record<string, string[]> = {
  respondent: ['name', 'function', 'phone1'],
  enterprise: [
    'name', 'legalStatus', 'area', 'region', 'department',
    'subdivision', 'phone1', 'sector', 'mainActivity',
    'permanentWorkers', 'size',
  ],
  cooperative: ['name'],
  ctd: ['type'],
  ong: ['name'],
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
  'cooperative.name': 'Nom de la coopérative / Cooperative name',
  'ctd.type': 'Type de CTD / Local authority type',
  'ong.name': "Nom de l'ONG / NGO name",
};

// ============================================================
// NORMALIZATION HELPER - Converts any entity type to uppercase
// ============================================================
function normalizeEntityType(type: string): string {
  const upper = type?.toUpperCase() || '';
  if (upper === 'ENTERPRISE' || upper === 'ENTREPRISE') return 'ENTREPRISE';
  if (upper === 'COOPERATIVE') return 'COOPERATIVE';
  if (upper === 'CTD') return 'CTD';
  if (upper === 'ONG') return 'ONG';
  return 'ENTREPRISE';
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
      console.log('companyId  :', dto.companyId);
      console.log('establishmentId:', dto.establishmentId);
      console.log('formId     :', dto.formId);
      console.log('data keys  :', Object.keys(dto.data).length);
      debugLog('📥 Raw dto.data (first 2000 chars):', dto.data);
    }

    const normalized = normalizeFlatKeys(dto.data, normalizedEntityType.toLowerCase());

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

    const nestedData = buildNestedDto(normalized, normalizedEntityType.toLowerCase());

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
    } else {
      console.log('\n── ✅ Validation passed ───────────────────────────\n');
    }

    if (!isDraft) {
      this.enforceFinalRequiredFields(questionnaireData, normalizedEntityType.toLowerCase());
    }

    const flat = normalized as unknown as FlatFormData;

    // Resolve geo + sector IDs before transaction
    const entityForGeo = (questionnaireData as any);
    const geoRegion =
      entityForGeo.enterprise?.region ??
      entityForGeo.cooperative?.region ??
      entityForGeo.ctd?.region ??
      entityForGeo.ong?.region ?? null;
    const geoDept =
      entityForGeo.enterprise?.department ??
      entityForGeo.cooperative?.department ??
      entityForGeo.ctd?.department ??
      entityForGeo.ong?.department ?? null;
    const geoSubdiv =
      entityForGeo.enterprise?.subdivision ??
      entityForGeo.cooperative?.subdivision ??
      entityForGeo.ctd?.subdivision ??
      entityForGeo.ong?.subdivision ?? null;
    const geoSector =
      entityForGeo.enterprise?.sector ??
      entityForGeo.cooperative?.sector ??
      entityForGeo.ctd?.sector ??
      entityForGeo.ong?.sector ?? null;
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
    // declared the form final.
    const coherenceFlags = isDraft
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
    }

    // The four csp/gender/age prefixes previously ran as four separate
    // createMany round trips against the same table — they only differ by
    // the `tableName` discriminator column, so one combined createMany call
    // produces identical rows.
    const cspGenderAgeRows = this.buildCspGenderAgeRows(flat, [
      { prefix: 's21q01', tableName: 's21q01' },
      { prefix: 's22q01', tableName: 's22q01' },
      { prefix: 's22q02', tableName: 's22q02' },
      { prefix: 's23q01', tableName: 's23q01' },
    ]);
    const diplomaRows = this.buildDiplomaRows(flat);
    const disabilityRows = this.buildDisabilityRows(flat, 's22q04');
    const vulnerableRows = normalizedEntityType === 'ENTREPRISE'
      ? this.buildVulnerableEnterpriseRows(flat)
      : this.buildVulnerableOtherRows(flat);
    const firstTimeWorkerRows = this.buildFirstTimeWorkerRows(flat);
    const jobApplicationRows = this.buildJobApplicationRows(flat);
    const registeredSeekerRows = this.buildRegisteredSeekerRows(flat);
    const departureRows = this.buildDepartureRows(flat);
    const dismissalReasonRows = this.buildDismissalReasonRows(flat);
    const dismissalUnemploymentRows = this.buildDismissalUnemploymentRows(flat);
    const internshipRows = this.buildInternshipRows(flat);
    const skillNeedRows = this.buildSkillNeedRows(flat);
    const trainingNeedRows = this.buildTrainingNeedRows(flat);

    let result: { submissionId: string };
    try {
      result = await this.prisma.onefopSubmission.create({
        data: {
          submissionId: dto.formId || randomUUID(),
          formType: normalizedEntityType,
          rawData: dto.data as any,
          surveyYear: questionnaireData.surveyYear ?? new Date().getFullYear(),
          submissionDate: new Date(),
          establishmentId: dto.establishmentId,
          quarterCode: dto.quarterCode ?? this.getCurrentQuarter(),
          region: geoRegion,
          department: geoDept,
          subdivision: geoSubdiv,
          status: isDraft ? 'DRAFT' : 'PENDING_REVIEW',
          flags: coherenceFlags.length ? (coherenceFlags as any) : undefined,
          user: dto.userId ? { connect: { id: dto.userId } } : undefined,
          company: dto.companyId ? { connect: { id: dto.companyId } } : undefined,
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

    // Dismissals appear in three different tables — the departures table
    // (S3Q01, "dismissal" column), the dismissal-reasons table (S3Q02), and
    // the dismissal/technical-unemployment table (S3Q03, "dismissal"
    // column) — all three describe the same dismissals and should agree.
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

  private enforceFinalRequiredFields(data: AnyQuestionnaireDto, entityType: string): void {
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

  private buildCspGenderAgeRows(flat: FlatFormData, prefixes: { prefix: string; tableName: string }[]): object[] {
    const cspRows = ['cadres', 'foremen', 'workers'];
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

  private buildDepartureRows(flat: FlatFormData): object[] {
    const prefix = 's3q01';
    const cspRows = ['cadres', 'foremen', 'workers', 'total'];
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

  private buildJobApplicationRows(flat: FlatFormData): object[] {
    const prefix = 's21q01';
    const cspRows = ['cadres', 'foremen', 'workers', 'total'];
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
      include: { respondent: true, enterpriseDetail: true, cooperativeDetail: true, ctdDetail: true, ongDetail: true },
    });
  }

  async getQuestionnaireById(id: string) {
    return (this.prisma as any).onefopSubmission.findUnique({
      where: { id },
      include: { respondent: true, enterpriseDetail: true, cooperativeDetail: true, ctdDetail: true, ongDetail: true, cspGenderAge: true, diplomaData: true, disabilityData: true, vulnerableData: true, firstTimeWorkers: true, departureData: true, dismissalReasons: true, dismissalUnemployment: true, internshipData: true, skillNeeds: true, trainingNeeds: true },
    });
  }

  async listByStatus(status: string, limit: number, offset: number) {
    return (this.prisma as any).onefopSubmission.findMany({
      where: { status }, orderBy: { createdAt: 'desc' }, take: limit, skip: offset,
      include: { respondent: true, enterpriseDetail: true, cooperativeDetail: true, ctdDetail: true, ongDetail: true },
    });
  }

  async getById(id: string) {
    const submission = await (this.prisma as any).onefopSubmission.findUnique({
      where: { id },
      include: { respondent: true, enterpriseDetail: true, cooperativeDetail: true, ctdDetail: true, ongDetail: true, cspGenderAge: true, diplomaData: true, disabilityData: true, vulnerableData: true, firstTimeWorkers: true, departureData: true, dismissalReasons: true, dismissalUnemployment: true, internshipData: true, skillNeeds: true, trainingNeeds: true },
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

