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

  async submitQuestionnaire(dto: OnefopSubmissionDto): Promise<OnefopResponseDto> {
    const isDraft = dto.isDraft ?? false;
    // Normalize entityType to uppercase
    const normalizedEntityType = normalizeEntityType(dto.entityType);

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

    const normalized = normalizeFlatKeys(dto.data, normalizedEntityType.toLowerCase());

    debugLog('🔄 Normalized keys sample (S0/S1):', {
      S0Q01: normalized['S0Q01'],
      S0Q02: normalized['S0Q02'],
      COOP_S1Q01: normalized['COOP_S1Q01'],
      COOP_S1Q10: normalized['COOP_S1Q10'],
      COOP_S1Q11: normalized['COOP_S1Q11'],
      COOP_S1Q12: normalized['COOP_S1Q12'],
    });

    const nestedData = buildNestedDto(normalized, normalizedEntityType.toLowerCase());

    debugLog('🔄 respondent :', nestedData['respondent']);
    debugLog('🔄 cooperative:', nestedData['cooperative']);
    debugLog('🔄 enterprise :', nestedData['enterprise']);
    debugLog('🔄 ctd        :', nestedData['ctd']);
    debugLog('🔄 ong        :', nestedData['ong']);

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

    const result = await (this.prisma as any).$transaction(async (tx: TxClient) => {
      const respondent = questionnaireData.respondent;

      let entityRegion: string | null = null;
      let entityDepartment: string | null = null;
      let entitySubdivision: string | null = null;

      if ('enterprise' in questionnaireData && questionnaireData.enterprise) {
        entityRegion = questionnaireData.enterprise.region ?? null;
        entityDepartment = questionnaireData.enterprise.department ?? null;
        entitySubdivision = questionnaireData.enterprise.subdivision ?? null;
      } else if ('cooperative' in questionnaireData && questionnaireData.cooperative) {
        entityRegion = questionnaireData.cooperative.region ?? null;
        entityDepartment = questionnaireData.cooperative.department ?? null;
        entitySubdivision = questionnaireData.cooperative.subdivision ?? null;
      } else if ('ctd' in questionnaireData && questionnaireData.ctd) {
        entityRegion = questionnaireData.ctd.region ?? null;
        entityDepartment = questionnaireData.ctd.department ?? null;
        entitySubdivision = questionnaireData.ctd.subdivision ?? null;
      } else if ('ong' in questionnaireData && questionnaireData.ong) {
        entityRegion = questionnaireData.ong.region ?? null;
        entityDepartment = questionnaireData.ong.department ?? null;
        entitySubdivision = questionnaireData.ong.subdivision ?? null;
      }

      const submission = await tx.onefopSubmission.create({
        data: {
          submissionId: randomUUID(),
          formType: normalizedEntityType,
          rawData: dto.data as any,
          surveyYear: questionnaireData.surveyYear ?? new Date().getFullYear(),
          submittedBy: dto.userId ?? null,
          companyId: dto.companyId,
          establishmentId: dto.establishmentId,
          region: entityRegion,
          department: entityDepartment,
          subdivision: entitySubdivision,
          status: isDraft ? 'DRAFT' : 'PENDING_REVIEW',
        },
      });
      const sid: string = submission.id;

      if (respondent) {
        await tx.onefopRespondent.create({
          data: {
            submissionId: sid,
            respondentName: respondent.name ?? '',
            respondentFunction: respondent.function ?? '',
            phone1: respondent.phone1 ?? '',
            phone2: respondent.phone2 ?? null,
            email: respondent.email ?? null,
          },
        });
      }

      if (normalizedEntityType === 'ENTREPRISE' && 'enterprise' in questionnaireData && questionnaireData.enterprise) {
        const e = questionnaireData.enterprise;
        await tx.onefopEnterpriseDetail.create({
          data: {
            submissionId: sid,
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
            branch: e.branch ?? null,
            mainActivity: e.mainActivity ?? '',
            headOffice: e.headOffice ?? null,
            permanentWorkers: e.permanentWorkers ?? 0,
            vacancies: e.vacancies ?? 0,
            enterpriseSize: this.mapCompanySize(e.size as 1 | 2 | 3 | 4),
          },
        });
      }

      if (normalizedEntityType === 'COOPERATIVE' && 'cooperative' in questionnaireData && questionnaireData.cooperative) {
        const c = questionnaireData.cooperative;
        await tx.onefopCooperativeDetail.create({
          data: {
            submissionId: sid,
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
            branch: c.branch ?? null,
            mainActivity: c.mainActivity ?? null,
            cooperativeType: this.mapCooperativeType(c.type as 1 | 2 | 3),
            cooperativeTypeOther: c.typeOther ?? null,
            permanentWorkers: c.permanentWorkers ?? null,
            vacancies: c.vacancies ?? null,
          },
        });
      }

      if (normalizedEntityType === 'CTD' && 'ctd' in questionnaireData && questionnaireData.ctd) {
        const ct = questionnaireData.ctd;
        await tx.onefopCtdDetail.create({
          data: {
            submissionId: sid,
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
            branch: ct.branch ?? null,
            permanentWorkers: ct.permanentWorkers ?? null,
            vacancies: ct.vacancies ?? null,
          },
        });
      }

      if (normalizedEntityType === 'ONG' && 'ong' in questionnaireData && questionnaireData.ong) {
        const o = questionnaireData.ong;
        await tx.onefopOngDetail.create({
          data: {
            submissionId: sid,
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
            branch: o.branch ?? null,
            mainMission: o.mainMission ?? null,
            permanentWorkers: o.permanentWorkers ?? null,
            vacancies: o.vacancies ?? null,
          },
        });
      }

      for (const t of [
        { prefix: 's21q01' },
        { prefix: 's22q01' },
        { prefix: 's22q02' },
        { prefix: 's23q01' },
      ]) {
        await this.saveCspGenderAgeFlat(tx, sid, flat, t.prefix, t.prefix);
      }

      await this.saveDiplomaFlat(tx, sid, flat);
      await this.saveDisabilityFlat(tx, sid, flat, 's22q04');

      if (normalizedEntityType === 'ENTREPRISE') {
        await this.saveVulnerableEnterpriseFlat(tx, sid, flat);
      } else {
        await this.saveVulnerableOtherFlat(tx, sid, flat);
      }

      await this.saveFirstTimeWorkersFlat(tx, sid, flat);
      await this.saveDepartureFlat(tx, sid, flat);
      await this.saveDismissalReasonsFlat(tx, sid, flat);
      await this.saveDismissalUnemploymentFlat(tx, sid, flat);
      await this.saveInternshipFlat(tx, sid, flat);
      await this.saveSkillsFlat(tx, sid, flat);
      await this.saveTrainingFlat(tx, sid, flat);

      return submission;
    });

    return {
      success: true,
      submissionId: result.submissionId as string,
      message: isDraft
        ? 'Brouillon sauvegardé avec succès'
        : 'Formulaire soumis avec succès',
    };
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
      throw new BadRequestException(
        `Champs obligatoires manquants pour la soumission finale: ${missingFields.join(', ')}`,
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

  private async saveCspGenderAgeFlat(tx: TxClient, submissionId: string, flat: FlatFormData, prefix: string, tableName: string): Promise<void> {
    const cspRows = ['cadres', 'foremen', 'workers'];
    const genders = ['male', 'female', 'total'];
    const ageBandKeys = ['15_24', '25_34', '35_plus', 'total'];
    const rows: object[] = [];

    for (const csp of cspRows) {
      for (const gender of genders) {
        for (const ageKey of ageBandKeys) {
          const value = this.flatInt(flat, `${prefix}_${csp}_${gender}_${ageKey}`);
          if (value !== 0) {
            rows.push({
              submissionId,
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
            submissionId,
            tableName,
            cspCategory: 'TOTAL',
            gender: this.up(gender),
            ageBand: this.mapAgeBand(ageKey),
            value
          });
        }
      }
    }

    if (rows.length > 0) {
      await tx.onefopCspGenderAge.createMany({ data: rows, skipDuplicates: true });
    }
  }

  private async saveDiplomaFlat(tx: TxClient, submissionId: string, flat: FlatFormData): Promise<void> {
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
              submissionId,
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
            submissionId,
            diploma: 'TOTAL',
            gender: this.up(gender),
            ageBand: this.mapAgeBand(ageKey),
            value
          });
        }
      }
    }

    if (rows.length > 0) {
      await tx.onefopDiplomaData.createMany({ data: rows, skipDuplicates: true });
    }
  }

  private async saveDisabilityFlat(tx: TxClient, submissionId: string, flat: FlatFormData, prefix: string): Promise<void> {
    const rows = ['cadres', 'foremen', 'workers', 'total'];
    const statuses = ['permanent', 'temporary', 'total'];
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];
    for (const row of rows) {
      for (const status of statuses) {
        for (const gender of genders) {
          const value = this.flatInt(flat, `${prefix}_${row}_${status}_${gender}`);
          if (value !== 0) records.push({ submissionId, cspCategory: this.up(row), status: this.up(status), gender: this.up(gender), value });
        }
      }
    }
    if (records.length > 0) await tx.onefopDisabilityData.createMany({ data: records, skipDuplicates: true });
  }

  private async saveVulnerableEnterpriseFlat(tx: TxClient, submissionId: string, flat: FlatFormData): Promise<void> {
    const prefix = 's22q05_ent';
    const vulnerableRows = ['deplaces_internes', 'refugies', 'orphelins', 'total'];
    const statuses = ['permanent', 'temporary', 'total'];
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];
    for (const vRow of vulnerableRows) {
      for (const status of statuses) {
        for (const gender of genders) {
          const value = this.flatInt(flat, `${prefix}_${vRow}_${status}_${gender}`);
          if (value !== 0) records.push({ submissionId, vulnerableType: this.up(vRow), status: this.up(status), gender: this.up(gender), value });
        }
      }
    }
    if (records.length > 0) await tx.onefopVulnerableData.createMany({ data: records, skipDuplicates: true });
  }

  private async saveVulnerableOtherFlat(tx: TxClient, submissionId: string, flat: FlatFormData): Promise<void> {
    const prefix = 's22q05_oth';
    const cspRows = ['cadres', 'foremen', 'workers', 'total'];
    const statuses = ['permanent', 'temporary', 'total'];
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];
    for (const row of cspRows) {
      for (const status of statuses) {
        for (const gender of genders) {
          const value = this.flatInt(flat, `${prefix}_${row}_${status}_${gender}`);
          if (value !== 0) records.push({ submissionId, vulnerableType: this.up(row), status: this.up(status), gender: this.up(gender), value });
        }
      }
    }
    if (records.length > 0) await tx.onefopVulnerableData.createMany({ data: records, skipDuplicates: true });
  }

  private async saveFirstTimeWorkersFlat(tx: TxClient, submissionId: string, flat: FlatFormData): Promise<void> {
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
                submissionId,
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
      // TODO: uncomment when SUBTOTAL is added to CspCategory enum
      // for (const gender of genders) {
      //   for (const ageKey of ageBandKeys) {
      //     const value = this.flatInt(flat, `${prefix}_${contract}_subtotal_${gender}_${ageKey}`);
      //     if (value !== 0) {
      //       records.push({
      //         submissionId,
      //         contractType: this.up(contract),
      //         cspCategory: 'SUBTOTAL',
      //         gender: this.up(gender),
      //         ageBand: this.mapAgeBand(ageKey),
      //         value
      //       });
      //     }
      //   }
      // }

      for (const gender of genders) {
        for (const ageKey of ageBandKeys) {
          const value = this.flatInt(flat, `${prefix}_total_${gender}_${ageKey}`);
          if (value !== 0) {
            records.push({
              submissionId,
              contractType: 'TOTAL',
              cspCategory: 'TOTAL',
              gender: this.up(gender),
              ageBand: this.mapAgeBand(ageKey),
              value
            });
          }
        }
      }

      if (records.length > 0) {
        await tx.onefopFirstTimeWorker.createMany({ data: records, skipDuplicates: true });
      }
    }
  }

  private async saveDepartureFlat(tx: TxClient, submissionId: string, flat: FlatFormData): Promise<void> {
    const prefix = 's3q01';
    const cspRows = ['cadres', 'foremen', 'workers', 'total'];
    const departureTypes = ['dismissal', 'resignation', 'retirement', 'other', 'ensemble'];
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];
    for (const csp of cspRows) {
      for (const type of departureTypes) {
        for (const gender of genders) {
          const value = this.flatInt(flat, `${prefix}_${csp}_${type}_${gender}`);
          if (value !== 0) records.push({ submissionId, cspCategory: this.up(csp), departureType: this.up(type), gender: this.up(gender), value });
        }
      }
    }
    if (records.length > 0) await tx.onefopDepartureData.createMany({ data: records, skipDuplicates: true });
  }

  private async saveDismissalReasonsFlat(tx: TxClient, submissionId: string, flat: FlatFormData): Promise<void> {
    const records: object[] = [];
    for (let i = 1; i <= 3; i++) {
      const reasonText = this.flatStr(flat, `s3q02_reason_${i}_text`);
      const male = this.flatInt(flat, `s3q02_reason_${i}_male`);
      const female = this.flatInt(flat, `s3q02_reason_${i}_female`);
      const total = this.flatInt(flat, `s3q02_reason_${i}_total`);
      if (reasonText || male !== 0 || female !== 0) {
        records.push({ submissionId, reasonIndex: i, reasonText, maleCount: male, femaleCount: female, totalCount: total > 0 ? total : male + female });
      }
    }
    if (records.length > 0) await tx.onefopDismissalReason.createMany({ data: records, skipDuplicates: true });
  }

  private async saveDismissalUnemploymentFlat(tx: TxClient, submissionId: string, flat: FlatFormData): Promise<void> {
    const prefix = 's3q03';
    const cspRows = ['cadres', 'foremen', 'workers', 'total'];
    const types = ['dismissal', 'technical_unemployment', 'total'];
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];
    for (const csp of cspRows) {
      for (const type of types) {
        for (const gender of genders) {
          const value = this.flatInt(flat, `${prefix}_${csp}_${type}_${gender}`);
          if (value !== 0) records.push({ submissionId, cspCategory: this.up(csp), type: this.up(type), gender: this.up(gender), value });
        }
      }
    }
    if (records.length > 0) await tx.onefopDismissalUnemployment.createMany({ data: records, skipDuplicates: true });
  }

  private async saveInternshipFlat(tx: TxClient, submissionId: string, flat: FlatFormData): Promise<void> {
    const prefix = 's4q01';
    const internshipTypes = ['vacation', 'academic', 'professional', 'pre_employment', 'total'];
    const genders = ['male', 'female', 'total'];
    const records: object[] = [];
    for (const type of internshipTypes) {
      for (const gender of genders) {
        const value = this.flatInt(flat, `${prefix}_${type}_${gender}`);
        if (value !== 0) records.push({ submissionId, internshipType: this.up(type), gender: this.up(gender), value });
      }
    }
    if (records.length > 0) await tx.onefopInternshipData.createMany({ data: records, skipDuplicates: true });
  }

  private async saveSkillsFlat(tx: TxClient, submissionId: string, flat: FlatFormData): Promise<void> {
    const records: object[] = [];
    for (let i = 1; i <= 3; i++) {
      const description = this.flatStr(flat, `s4q02_skill_${i}_text`);
      const male = this.flatInt(flat, `s4q02_skill_${i}_male`);
      const female = this.flatInt(flat, `s4q02_skill_${i}_female`);
      const total = this.flatInt(flat, `s4q02_skill_${i}_total`);
      if (description || male !== 0 || female !== 0) {
        records.push({ submissionId, skillIndex: i, skillDescription: description, maleCount: male, femaleCount: female, totalCount: total > 0 ? total : male + female });
      }
    }
    if (records.length > 0) await tx.onefopSkillNeed.createMany({ data: records, skipDuplicates: true });
  }

  private async saveTrainingFlat(tx: TxClient, submissionId: string, flat: FlatFormData): Promise<void> {
    const records: object[] = [];
    for (let i = 1; i <= 3; i++) {
      const domain = this.flatStr(flat, `s4q03_domain_${i}_text`);
      const male = this.flatInt(flat, `s4q03_domain_${i}_male`);
      const female = this.flatInt(flat, `s4q03_domain_${i}_female`);
      const total = this.flatInt(flat, `s4q03_domain_${i}_total`);
      if (domain || male !== 0 || female !== 0) {
        records.push({ submissionId, domainIndex: i, trainingDomain: domain, maleCount: male, femaleCount: female, totalCount: total > 0 ? total : male + female });
      }
    }
    if (records.length > 0) await tx.onefopTrainingNeed.createMany({ data: records, skipDuplicates: true });
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