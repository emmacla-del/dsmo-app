"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionnairesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const onefop_questionnaire_dto_1 = require("../dto/onefop-questionnaire.dto");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const crypto_1 = require("crypto");
const flat_key_normalizer_1 = require("../common/normalizers/flat-key-normalizer");
const FINAL_REQUIRED_FIELDS = {
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
function debugLog(label, value, maxChars = 2000) {
    try {
        if (value === undefined || value === null) {
            console.log(`\n${label}\n(no data)`);
            return;
        }
        let str;
        if (typeof value === 'string') {
            str = value;
        }
        else {
            try {
                str = JSON.stringify(value, null, 2);
            }
            catch {
                str = String(value);
            }
        }
        if (str && str.length > 0) {
            console.log(`\n${label}\n${str.substring(0, maxChars)}${str.length > maxChars ? '\n… (truncated)' : ''}`);
        }
        else {
            console.log(`\n${label}\n(empty)`);
        }
    }
    catch (error) {
        console.log(`\n${label}\n(debug error: ${error})`);
    }
}
let QuestionnairesService = class QuestionnairesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async submitQuestionnaire(dto) {
        const isDraft = dto.isDraft ?? false;
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║         ONEFOP SUBMIT — DEBUG                    ║');
        console.log('╚══════════════════════════════════════════════════╝');
        console.log('entityType :', dto.entityType);
        console.log('isDraft    :', isDraft);
        console.log('userId     :', dto.userId);
        console.log('formId     :', dto.formId);
        console.log('data keys  :', Object.keys(dto.data).length);
        debugLog('📥 Raw dto.data (first 2000 chars):', dto.data);
        const normalized = (0, flat_key_normalizer_1.normalizeFlatKeys)(dto.data, dto.entityType);
        debugLog('🔄 Normalized keys sample (S0/S1):', {
            S0Q01: normalized['S0Q01'],
            S0Q02: normalized['S0Q02'],
            COOP_S1Q01: normalized['COOP_S1Q01'],
            COOP_S1Q10: normalized['COOP_S1Q10'],
            COOP_S1Q11: normalized['COOP_S1Q11'],
            COOP_S1Q12: normalized['COOP_S1Q12'],
        });
        const nestedData = (0, flat_key_normalizer_1.buildNestedDto)(normalized, dto.entityType);
        debugLog('🔄 respondent :', nestedData['respondent']);
        debugLog('🔄 cooperative:', nestedData['cooperative']);
        debugLog('🔄 enterprise :', nestedData['enterprise']);
        debugLog('🔄 ctd        :', nestedData['ctd']);
        debugLog('🔄 ong        :', nestedData['ong']);
        let questionnaireData;
        switch (dto.entityType) {
            case 'enterprise':
                questionnaireData = (0, class_transformer_1.plainToClass)(onefop_questionnaire_dto_1.EnterpriseQuestionnaireDto, nestedData);
                break;
            case 'cooperative':
                questionnaireData = (0, class_transformer_1.plainToClass)(onefop_questionnaire_dto_1.CooperativeQuestionnaireDto, nestedData);
                break;
            case 'ctd':
                questionnaireData = (0, class_transformer_1.plainToClass)(onefop_questionnaire_dto_1.CtdQuestionnaireDto, nestedData);
                break;
            case 'ong':
                questionnaireData = (0, class_transformer_1.plainToClass)(onefop_questionnaire_dto_1.OngQuestionnaireDto, nestedData);
                break;
            default:
                throw new common_1.BadRequestException('Invalid entity type');
        }
        const dataErrors = await (0, class_validator_1.validate)(questionnaireData, {
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
            throw new common_1.BadRequestException(dataErrors);
        }
        else {
            console.log('\n── ✅ Validation passed ───────────────────────────\n');
        }
        if (!isDraft) {
            this.enforceFinalRequiredFields(questionnaireData, dto.entityType);
        }
        const flat = normalized;
        const result = await this.prisma.$transaction(async (tx) => {
            const respondent = questionnaireData.respondent;
            let entityRegion = null;
            let entityDepartment = null;
            let entitySubdivision = null;
            if ('enterprise' in questionnaireData && questionnaireData.enterprise) {
                entityRegion = questionnaireData.enterprise.region ?? null;
                entityDepartment = questionnaireData.enterprise.department ?? null;
                entitySubdivision = questionnaireData.enterprise.subdivision ?? null;
            }
            else if ('cooperative' in questionnaireData && questionnaireData.cooperative) {
                entityRegion = questionnaireData.cooperative.region ?? null;
                entityDepartment = questionnaireData.cooperative.department ?? null;
                entitySubdivision = questionnaireData.cooperative.subdivision ?? null;
            }
            else if ('ctd' in questionnaireData && questionnaireData.ctd) {
                entityRegion = questionnaireData.ctd.region ?? null;
                entityDepartment = questionnaireData.ctd.department ?? null;
                entitySubdivision = questionnaireData.ctd.subdivision ?? null;
            }
            else if ('ong' in questionnaireData && questionnaireData.ong) {
                entityRegion = questionnaireData.ong.region ?? null;
                entityDepartment = questionnaireData.ong.department ?? null;
                entitySubdivision = questionnaireData.ong.subdivision ?? null;
            }
            const submission = await tx.onefopSubmission.create({
                data: {
                    submissionId: (0, crypto_1.randomUUID)(),
                    formType: dto.entityType.toUpperCase(),
                    rawData: dto.data,
                    surveyYear: questionnaireData.surveyYear ?? new Date().getFullYear(),
                    submittedBy: dto.userId,
                    region: entityRegion,
                    department: entityDepartment,
                    subdivision: entitySubdivision,
                    status: isDraft ? 'DRAFT' : 'PENDING_REVIEW',
                },
            });
            const sid = submission.id;
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
            if (dto.entityType === 'enterprise' && 'enterprise' in questionnaireData && questionnaireData.enterprise) {
                const e = questionnaireData.enterprise;
                await tx.onefopEnterpriseDetail.create({
                    data: {
                        submissionId: sid,
                        legalStatus: this.mapLegalStatus(e.legalStatus),
                        companyName: e.name ?? '',
                        area: this.mapArea(e.area),
                        region: e.region ?? '',
                        department: e.department ?? '',
                        subdivision: e.subdivision ?? '',
                        locality: e.locality ?? null,
                        phone1: e.phone1 ?? '',
                        phone2: e.phone2 ?? null,
                        poBox: e.poBox ?? null,
                        sector: this.mapSector(e.sector),
                        branch: e.branch ?? null,
                        mainActivity: e.mainActivity ?? '',
                        headOffice: e.headOffice ?? null,
                        permanentWorkers: e.permanentWorkers ?? 0,
                        vacancies: e.vacancies ?? 0,
                        enterpriseSize: this.mapCompanySize(e.size),
                    },
                });
            }
            if (dto.entityType === 'cooperative' && 'cooperative' in questionnaireData && questionnaireData.cooperative) {
                const c = questionnaireData.cooperative;
                await tx.onefopCooperativeDetail.create({
                    data: {
                        submissionId: sid,
                        cooperativeName: c.name ?? '',
                        headOffice: c.headOffice ?? null,
                        yearCreated: c.yearCreated ?? null,
                        area: this.mapArea(c.area),
                        region: c.region ?? null,
                        department: c.department ?? null,
                        subdivision: c.subdivision ?? null,
                        locality: c.locality ?? null,
                        phone1: c.phone1 ?? null,
                        phone2: c.phone2 ?? null,
                        poBox: c.poBox ?? null,
                        sector: this.mapSector(c.sector),
                        branch: c.branch ?? null,
                        mainActivity: c.mainActivity ?? null,
                        cooperativeType: this.mapCooperativeType(c.type),
                        cooperativeTypeOther: c.typeOther ?? null,
                        permanentWorkers: c.permanentWorkers ?? null,
                        vacancies: c.vacancies ?? null,
                    },
                });
            }
            if (dto.entityType === 'ctd' && 'ctd' in questionnaireData && questionnaireData.ctd) {
                const ct = questionnaireData.ctd;
                await tx.onefopCtdDetail.create({
                    data: {
                        submissionId: sid,
                        ctdType: this.mapCtdType(ct.type),
                        councilType: ct.councilType ? this.mapCouncilType(ct.councilType) : null,
                        yearCreated: ct.yearCreated ?? null,
                        area: this.mapArea(ct.area),
                        region: ct.region ?? null,
                        department: ct.department ?? null,
                        subdivision: ct.subdivision ?? null,
                        locality: ct.locality ?? null,
                        phone1: ct.phone1 ?? null,
                        phone2: ct.phone2 ?? null,
                        poBox: ct.poBox ?? null,
                        sector: this.mapSector(ct.sector),
                        branch: ct.branch ?? null,
                        permanentWorkers: ct.permanentWorkers ?? null,
                        vacancies: ct.vacancies ?? null,
                    },
                });
            }
            if (dto.entityType === 'ong' && 'ong' in questionnaireData && questionnaireData.ong) {
                const o = questionnaireData.ong;
                await tx.onefopOngDetail.create({
                    data: {
                        submissionId: sid,
                        ongName: o.name ?? '',
                        headOffice: o.headOffice ?? null,
                        yearCreated: o.yearCreated ?? null,
                        area: this.mapArea(o.area),
                        region: o.region ?? null,
                        department: o.department ?? null,
                        subdivision: o.subdivision ?? null,
                        locality: o.locality ?? null,
                        phone1: o.phone1 ?? null,
                        phone2: o.phone2 ?? null,
                        poBox: o.poBox ?? null,
                        sector: this.mapSector(o.sector),
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
            if (dto.entityType === 'enterprise') {
                await this.saveVulnerableEnterpriseFlat(tx, sid, flat);
            }
            else {
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
            submissionId: result.submissionId,
            message: isDraft
                ? 'Brouillon sauvegardé avec succès'
                : 'Formulaire soumis avec succès',
        };
    }
    enforceFinalRequiredFields(data, entityType) {
        const missingFields = [];
        const respondentRequired = FINAL_REQUIRED_FIELDS['respondent'] ?? [];
        for (const field of respondentRequired) {
            if (!data.respondent || !data.respondent[field]) {
                missingFields.push(`respondent.${field}`);
            }
        }
        const entityRequired = FINAL_REQUIRED_FIELDS[entityType] ?? [];
        const entityData = data[entityType];
        for (const field of entityRequired) {
            if (!entityData || entityData[field] === undefined || entityData[field] === null || entityData[field] === '') {
                missingFields.push(`${entityType}.${field}`);
            }
        }
        if (missingFields.length > 0) {
            throw new common_1.BadRequestException(`Champs obligatoires manquants pour la soumission finale: ${missingFields.join(', ')}`);
        }
    }
    flatInt(flat, key) {
        const v = flat[key];
        if (v === undefined || v === null || v === '')
            return 0;
        const n = typeof v === 'number' ? v : parseInt(String(v), 10);
        return isNaN(n) ? 0 : n;
    }
    flatStr(flat, key) {
        const v = flat[key];
        return v !== undefined && v !== null ? String(v) : '';
    }
    async saveCspGenderAgeFlat(tx, submissionId, flat, prefix, tableName) {
        const cspRows = ['cadres', 'foremen', 'workers'];
        const genders = ['male', 'female', 'total'];
        const ageBands = ['15_24', '25_34', '35_plus', 'total'];
        const rows = [];
        for (const csp of cspRows) {
            for (const gender of genders) {
                for (const age of ageBands) {
                    const value = this.flatInt(flat, `${prefix}_${csp}_${gender}_${age}`);
                    if (value !== 0)
                        rows.push({ submissionId, tableName, cspCategory: csp, gender, ageBand: age, value });
                }
            }
        }
        for (const gender of genders) {
            for (const age of ageBands) {
                const value = this.flatInt(flat, `${prefix}_total_${gender}_${age}`);
                if (value !== 0)
                    rows.push({ submissionId, tableName, cspCategory: 'total', gender, ageBand: age, value });
            }
        }
        if (rows.length > 0)
            await tx.onefopCspGenderAge.createMany({ data: rows, skipDuplicates: true });
    }
    async saveDiplomaFlat(tx, submissionId, flat) {
        const diplomas = ['cep', 'bepc', 'probatoire', 'bac', 'bts', 'licence', 'maitrise', 'master', 'dqp', 'cqp', 'autres', 'sans_diplome'];
        const genders = ['male', 'female', 'total'];
        const ageBands = ['15_24', '25_34', '35_plus', 'total'];
        const prefix = 's22q03';
        const rows = [];
        for (const diploma of diplomas) {
            for (const gender of genders) {
                for (const age of ageBands) {
                    const value = this.flatInt(flat, `${prefix}_${diploma}_${gender}_${age}`);
                    if (value !== 0)
                        rows.push({ submissionId, diploma, gender, ageBand: age, value });
                }
            }
        }
        for (const gender of genders) {
            for (const age of ageBands) {
                const value = this.flatInt(flat, `${prefix}_total_${gender}_${age}`);
                if (value !== 0)
                    rows.push({ submissionId, diploma: 'total', gender, ageBand: age, value });
            }
        }
        if (rows.length > 0)
            await tx.onefopDiplomaData.createMany({ data: rows, skipDuplicates: true });
    }
    async saveDisabilityFlat(tx, submissionId, flat, prefix) {
        const rows = ['cadres', 'foremen', 'workers', 'total'];
        const statuses = ['permanent', 'temporary', 'total'];
        const genders = ['male', 'female', 'total'];
        const records = [];
        for (const row of rows) {
            for (const status of statuses) {
                for (const gender of genders) {
                    const value = this.flatInt(flat, `${prefix}_${row}_${status}_${gender}`);
                    if (value !== 0)
                        records.push({ submissionId, cspCategory: row, status, gender, value });
                }
            }
        }
        if (records.length > 0)
            await tx.onefopDisabilityData.createMany({ data: records, skipDuplicates: true });
    }
    async saveVulnerableEnterpriseFlat(tx, submissionId, flat) {
        const prefix = 's22q05_ent';
        const vulnerableRows = ['deplaces_internes', 'refugies', 'orphelins', 'total'];
        const statuses = ['permanent', 'temporary', 'total'];
        const genders = ['male', 'female', 'total'];
        const records = [];
        for (const vRow of vulnerableRows) {
            for (const status of statuses) {
                for (const gender of genders) {
                    const value = this.flatInt(flat, `${prefix}_${vRow}_${status}_${gender}`);
                    if (value !== 0)
                        records.push({ submissionId, vulnerableType: vRow, status, gender, value });
                }
            }
        }
        if (records.length > 0)
            await tx.onefopVulnerableData.createMany({ data: records, skipDuplicates: true });
    }
    async saveVulnerableOtherFlat(tx, submissionId, flat) {
        const prefix = 's22q05_oth';
        const cspRows = ['cadres', 'foremen', 'workers', 'total'];
        const statuses = ['permanent', 'temporary', 'total'];
        const genders = ['male', 'female', 'total'];
        const records = [];
        for (const row of cspRows) {
            for (const status of statuses) {
                for (const gender of genders) {
                    const value = this.flatInt(flat, `${prefix}_${row}_${status}_${gender}`);
                    if (value !== 0)
                        records.push({ submissionId, vulnerableType: row, status, gender, value });
                }
            }
        }
        if (records.length > 0)
            await tx.onefopVulnerableData.createMany({ data: records, skipDuplicates: true });
    }
    async saveFirstTimeWorkersFlat(tx, submissionId, flat) {
        const prefix = 's23q02';
        const contracts = ['permanent', 'temporary'];
        const cspRows = ['cadres', 'foremen', 'workers'];
        const genders = ['male', 'female', 'total'];
        const ageBands = ['15_24', '25_34', '35_plus', 'total'];
        const records = [];
        for (const contract of contracts) {
            for (const csp of cspRows) {
                for (const gender of genders) {
                    for (const age of ageBands) {
                        const value = this.flatInt(flat, `${prefix}_${contract}_${csp}_${gender}_${age}`);
                        if (value !== 0)
                            records.push({ submissionId, contractType: contract, cspCategory: csp, gender, ageBand: age, value });
                    }
                }
            }
            for (const gender of genders) {
                for (const age of ageBands) {
                    const value = this.flatInt(flat, `${prefix}_${contract}_subtotal_${gender}_${age}`);
                    if (value !== 0)
                        records.push({ submissionId, contractType: contract, cspCategory: 'subtotal', gender, ageBand: age, value });
                }
            }
        }
        for (const gender of genders) {
            for (const age of ageBands) {
                const value = this.flatInt(flat, `${prefix}_total_${gender}_${age}`);
                if (value !== 0)
                    records.push({ submissionId, contractType: 'total', cspCategory: 'total', gender, ageBand: age, value });
            }
        }
        if (records.length > 0)
            await tx.onefopFirstTimeWorker.createMany({ data: records, skipDuplicates: true });
    }
    async saveDepartureFlat(tx, submissionId, flat) {
        const prefix = 's3q01';
        const cspRows = ['cadres', 'foremen', 'workers', 'total'];
        const departureTypes = ['dismissal', 'resignation', 'retirement', 'other', 'ensemble'];
        const genders = ['male', 'female', 'total'];
        const records = [];
        for (const csp of cspRows) {
            for (const type of departureTypes) {
                for (const gender of genders) {
                    const value = this.flatInt(flat, `${prefix}_${csp}_${type}_${gender}`);
                    if (value !== 0)
                        records.push({ submissionId, cspCategory: csp, departureType: type, gender, value });
                }
            }
        }
        if (records.length > 0)
            await tx.onefopDepartureData.createMany({ data: records, skipDuplicates: true });
    }
    async saveDismissalReasonsFlat(tx, submissionId, flat) {
        const records = [];
        for (let i = 1; i <= 3; i++) {
            const reasonText = this.flatStr(flat, `s3q02_reason_${i}_text`);
            const male = this.flatInt(flat, `s3q02_reason_${i}_male`);
            const female = this.flatInt(flat, `s3q02_reason_${i}_female`);
            const total = this.flatInt(flat, `s3q02_reason_${i}_total`);
            if (reasonText || male !== 0 || female !== 0) {
                records.push({ submissionId, reasonIndex: i, reasonText, maleCount: male, femaleCount: female, totalCount: total > 0 ? total : male + female });
            }
        }
        if (records.length > 0)
            await tx.onefopDismissalReason.createMany({ data: records, skipDuplicates: true });
    }
    async saveDismissalUnemploymentFlat(tx, submissionId, flat) {
        const prefix = 's3q03';
        const cspRows = ['cadres', 'foremen', 'workers', 'total'];
        const types = ['dismissal', 'technical_unemployment', 'total'];
        const genders = ['male', 'female', 'total'];
        const records = [];
        for (const csp of cspRows) {
            for (const type of types) {
                for (const gender of genders) {
                    const value = this.flatInt(flat, `${prefix}_${csp}_${type}_${gender}`);
                    if (value !== 0)
                        records.push({ submissionId, cspCategory: csp, type, gender, value });
                }
            }
        }
        if (records.length > 0)
            await tx.onefopDismissalUnemployment.createMany({ data: records, skipDuplicates: true });
    }
    async saveInternshipFlat(tx, submissionId, flat) {
        const prefix = 's4q01';
        const internshipTypes = ['vacation', 'academic', 'professional', 'pre_employment', 'total'];
        const genders = ['male', 'female', 'total'];
        const records = [];
        for (const type of internshipTypes) {
            for (const gender of genders) {
                const value = this.flatInt(flat, `${prefix}_${type}_${gender}`);
                if (value !== 0)
                    records.push({ submissionId, internshipType: type, gender, value });
            }
        }
        if (records.length > 0)
            await tx.onefopInternshipData.createMany({ data: records, skipDuplicates: true });
    }
    async saveSkillsFlat(tx, submissionId, flat) {
        const records = [];
        for (let i = 1; i <= 3; i++) {
            const description = this.flatStr(flat, `s4q02_skill_${i}_text`);
            const male = this.flatInt(flat, `s4q02_skill_${i}_male`);
            const female = this.flatInt(flat, `s4q02_skill_${i}_female`);
            const total = this.flatInt(flat, `s4q02_skill_${i}_total`);
            if (description || male !== 0 || female !== 0) {
                records.push({ submissionId, skillIndex: i, skillDescription: description, maleCount: male, femaleCount: female, totalCount: total > 0 ? total : male + female });
            }
        }
        if (records.length > 0)
            await tx.onefopSkillNeed.createMany({ data: records, skipDuplicates: true });
    }
    async saveTrainingFlat(tx, submissionId, flat) {
        const records = [];
        for (let i = 1; i <= 3; i++) {
            const domain = this.flatStr(flat, `s4q03_domain_${i}_text`);
            const male = this.flatInt(flat, `s4q03_domain_${i}_male`);
            const female = this.flatInt(flat, `s4q03_domain_${i}_female`);
            const total = this.flatInt(flat, `s4q03_domain_${i}_total`);
            if (domain || male !== 0 || female !== 0) {
                records.push({ submissionId, domainIndex: i, trainingDomain: domain, maleCount: male, femaleCount: female, totalCount: total > 0 ? total : male + female });
            }
        }
        if (records.length > 0)
            await tx.onefopTrainingNeed.createMany({ data: records, skipDuplicates: true });
    }
    mapLegalStatus(value) {
        const map = { 1: 'Société unipersonnelle/ Single-member company', 2: 'SARL/ LLC', 3: 'SA/ PLC', 4: 'Autres/ Others' };
        return value ? (map[value] ?? '') : '';
    }
    mapArea(value) {
        return value === 1 ? 'Urbain/ Urban' : value === 2 ? 'Rural/ Rural' : '';
    }
    mapSector(value) {
        const map = { 1: 'Primaire/ Primary', 2: 'Secondaire/ Secondary', 3: 'Tertiaire/ Tertiary' };
        return value ? (map[value] ?? '') : '';
    }
    mapCompanySize(value) {
        const map = { 1: 'TPE/ Very small enterprise', 2: 'PE/ Small enterprise', 3: 'ME/ Medium-sized enterprise', 4: 'GE/ Large enterprise' };
        return value ? (map[value] ?? '') : '';
    }
    mapCooperativeType(value) {
        const map = { 1: "Coopérative à comptabilité simplifiée", 2: "Coopérative avec conseil d'administration", 3: 'Autre (à préciser)/ Other (specify)' };
        return value ? (map[value] ?? '') : '';
    }
    mapCtdType(value) {
        const map = { 1: 'Région/ Region', 2: 'Commune/ Council' };
        return value ? (map[value] ?? '') : '';
    }
    mapCouncilType(value) {
        const map = { 1: "Commune d'Arrondissement/ Local Council", 2: 'Communauté Urbaine/ Urban Council' };
        return value ? (map[value] ?? '') : '';
    }
    async getAllQuestionnaires() {
        return this.prisma.onefopSubmission.findMany({
            orderBy: { createdAt: 'desc' },
            include: { respondent: true, enterpriseDetail: true, cooperativeDetail: true, ctdDetail: true, ongDetail: true },
        });
    }
    async getQuestionnaireById(id) {
        return this.prisma.onefopSubmission.findUnique({
            where: { id },
            include: { respondent: true, enterpriseDetail: true, cooperativeDetail: true, ctdDetail: true, ongDetail: true, cspGenderAge: true, diplomaData: true, disabilityData: true, vulnerableData: true, firstTimeWorkers: true, departureData: true, dismissalReasons: true, dismissalUnemployment: true, internshipData: true, skillNeeds: true, trainingNeeds: true },
        });
    }
    async listByStatus(status, limit, offset) {
        return this.prisma.onefopSubmission.findMany({
            where: { status }, orderBy: { createdAt: 'desc' }, take: limit, skip: offset,
            include: { respondent: true, enterpriseDetail: true, cooperativeDetail: true, ctdDetail: true, ongDetail: true },
        });
    }
    async getById(id) {
        const submission = await this.prisma.onefopSubmission.findUnique({
            where: { id },
            include: { respondent: true, enterpriseDetail: true, cooperativeDetail: true, ctdDetail: true, ongDetail: true, cspGenderAge: true, diplomaData: true, disabilityData: true, vulnerableData: true, firstTimeWorkers: true, departureData: true, dismissalReasons: true, dismissalUnemployment: true, internshipData: true, skillNeeds: true, trainingNeeds: true },
        });
        if (!submission)
            throw new common_1.NotFoundException(`Questionnaire with id ${id} not found`);
        return submission;
    }
    async approve(id, reviewedBy) {
        await this.getById(id);
        return this.prisma.onefopSubmission.update({ where: { id }, data: { status: 'APPROVED', reviewedBy: reviewedBy ?? null, reviewedAt: new Date() } });
    }
    async reject(id, reason, reviewedBy) {
        await this.getById(id);
        return this.prisma.onefopSubmission.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: reason, reviewedBy: reviewedBy ?? null, reviewedAt: new Date() } });
    }
    async requestCorrection(id, comments, reviewedBy) {
        await this.getById(id);
        return this.prisma.onefopSubmission.update({ where: { id }, data: { status: 'CORRECTION_REQUESTED', rejectionReason: comments, reviewedBy: reviewedBy ?? null, reviewedAt: new Date() } });
    }
};
exports.QuestionnairesService = QuestionnairesService;
exports.QuestionnairesService = QuestionnairesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], QuestionnairesService);
//# sourceMappingURL=questionnaires.service.js.map