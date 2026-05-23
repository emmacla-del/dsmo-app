"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapEnterpriseData = mapEnterpriseData;
exports.mapCooperativeData = mapCooperativeData;
exports.mapCtdData = mapCtdData;
exports.mapOngData = mapOngData;
exports.diagnoseMappingKeys = diagnoseMappingKeys;
function int(f, key) {
    const v = f[key];
    if (typeof v === 'number')
        return v;
    if (v === undefined || v === null || v === '')
        return 0;
    const n = parseInt(String(v), 10);
    return isNaN(n) ? 0 : n;
}
function str(f, key) {
    const v = f[key];
    return v !== undefined && v !== null ? String(v) : '';
}
const CSP_ROWS = ['cadres', 'foremen', 'workers'];
const CSP_LABELS = {
    cadres: 'Cadres / Managers',
    foremen: 'Agents de maîtrise / Foremen',
    workers: 'Ouvriers / Workers',
};
const DIPLOMA_MAP = [
    ['cep', 'CEP / FSLC'],
    ['bepc', 'BEPC / CAP / GCE-OL'],
    ['probatoire', 'Probatoire / Lower Sixth'],
    ['bac', 'Baccalauréat / GCE-AL'],
    ['bts', 'BTS / DUT / HND'],
    ['licence', 'Licence / Bachelor'],
    ['maitrise', 'Maîtrise / Master 1'],
    ['master', 'Master / Master 2'],
    ['dqp', 'DQP / PQD'],
    ['cqp', 'CQP / CPQ'],
    ['autres', 'Autres / Others'],
    ['sans_diplome', 'Sans diplôme / Without diploma'],
];
const INTERNSHIP_MAP = [
    ['vacation', 'Stage de vacance / Vacation internship'],
    ['academic', 'Stage académique / Academic internship'],
    ['professional', 'Stage professionnel / Professional internship'],
    ['pre_employment', 'Stage pré-emploi / Pre-employment internship'],
];
const VULNERABLE_ENT_ROWS = ['deplaces_internes', 'refugies', 'orphelins'];
const VULNERABLE_ENT_LABELS = {
    deplaces_internes: 'Déplacés internes / Internal displaced',
    refugies: 'Réfugiés / Refugees',
    orphelins: 'Orphelins / Orphans',
};
function ageBlock(f, prefix) {
    return {
        age15_24: int(f, `${prefix}_15_24`),
        age25_34: int(f, `${prefix}_25_34`),
        age35plus: int(f, `${prefix}_35_plus`),
        total: int(f, `${prefix}_total`),
    };
}
function buildCspAgeRows(f, prefix) {
    return CSP_ROWS.map((row) => ({
        label: CSP_LABELS[row] ?? row,
        male: ageBlock(f, `${prefix}_${row}_male`),
        female: ageBlock(f, `${prefix}_${row}_female`),
        total: ageBlock(f, `${prefix}_${row}_total`),
    }));
}
function buildCspAgeTotals(f, prefix) {
    return {
        label: 'TOTAL',
        male: ageBlock(f, `${prefix}_total_male`),
        female: ageBlock(f, `${prefix}_total_female`),
        total: ageBlock(f, `${prefix}_total_total`),
    };
}
function buildDiplomaRows(f, prefix) {
    return DIPLOMA_MAP.map(([slug, label]) => ({
        label,
        male: ageBlock(f, `${prefix}_${slug}_male`),
        female: ageBlock(f, `${prefix}_${slug}_female`),
        total: ageBlock(f, `${prefix}_${slug}_total`),
    }));
}
function buildDiplomaTotals(f, prefix) {
    return buildCspAgeTotals(f, prefix);
}
function mft(f, prefix) {
    return {
        male: int(f, `${prefix}_male`),
        female: int(f, `${prefix}_female`),
        total: int(f, `${prefix}_total`),
    };
}
function buildPermTempRows(f, prefix, rows, labels) {
    return rows.map((row) => ({
        label: labels[row] ?? row,
        permanent: mft(f, `${prefix}_${row}_permanent`),
        temporary: mft(f, `${prefix}_${row}_temporary`),
        total: mft(f, `${prefix}_${row}_total`),
    }));
}
function buildPermTempTotals(f, prefix) {
    return {
        label: 'TOTAL',
        permanent: mft(f, `${prefix}_total_permanent`),
        temporary: mft(f, `${prefix}_total_temporary`),
        total: mft(f, `${prefix}_total_total`),
    };
}
function buildDepartureRows(f, prefix) {
    return CSP_ROWS.map((row) => ({
        label: CSP_LABELS[row] ?? row,
        dismissals: mft(f, `${prefix}_${row}_dismissal`),
        resignations: mft(f, `${prefix}_${row}_resignation`),
        retirements: mft(f, `${prefix}_${row}_retirement`),
        others: mft(f, `${prefix}_${row}_other`),
        ensemble: mft(f, `${prefix}_${row}_ensemble`),
    }));
}
function buildDepartureTotals(f, prefix) {
    return {
        label: 'TOTAL',
        dismissals: mft(f, `${prefix}_total_dismissal`),
        resignations: mft(f, `${prefix}_total_resignation`),
        retirements: mft(f, `${prefix}_total_retirement`),
        others: mft(f, `${prefix}_total_other`),
        ensemble: mft(f, `${prefix}_total_ensemble`),
    };
}
function buildDismissalReasons(f, prefix) {
    return [1, 2, 3].map((i) => ({
        index: i,
        text: str(f, `${prefix}_reason_${i}_label`) || str(f, `${prefix}_reason_${i}_text`),
        male: int(f, `${prefix}_reason_${i}_male`),
        female: int(f, `${prefix}_reason_${i}_female`),
        total: int(f, `${prefix}_reason_${i}_total`),
    }));
}
function buildDismissalReasonsTotals(f, prefix) {
    return {
        label: 'TOTAL',
        male: int(f, `${prefix}_total_male`),
        female: int(f, `${prefix}_total_female`),
        total: int(f, `${prefix}_total_total`),
    };
}
function buildDismissalTechRows(f, prefix) {
    return CSP_ROWS.map((row) => ({
        label: CSP_LABELS[row] ?? row,
        dismissal: mft(f, `${prefix}_${row}_dismissal`),
        technicalUnemployment: mft(f, `${prefix}_${row}_technical_unemployment`),
        total: mft(f, `${prefix}_${row}_total`),
    }));
}
function buildDismissalTechTotals(f, prefix) {
    return {
        label: 'TOTAL',
        dismissal: mft(f, `${prefix}_total_dismissal`),
        technicalUnemployment: mft(f, `${prefix}_total_technical_unemployment`),
        total: mft(f, `${prefix}_total_total`),
    };
}
function buildInternshipRows(f, prefix) {
    return INTERNSHIP_MAP.map(([slug, label]) => ({
        label,
        male: int(f, `${prefix}_${slug}_male`),
        female: int(f, `${prefix}_${slug}_female`),
        total: int(f, `${prefix}_${slug}_total`),
    }));
}
function buildInternshipTotals(f, prefix) {
    return {
        label: 'TOTAL',
        male: int(f, `${prefix}_total_male`),
        female: int(f, `${prefix}_total_female`),
        total: int(f, `${prefix}_total_total`),
    };
}
function buildSkills(f, prefix) {
    return [1, 2, 3].map((i) => ({
        index: i,
        description: str(f, `${prefix}_skill_${i}_label`) || str(f, `${prefix}_skill_${i}_text`),
        male: int(f, `${prefix}_skill_${i}_male`),
        female: int(f, `${prefix}_skill_${i}_female`),
        total: int(f, `${prefix}_skill_${i}_total`),
    }));
}
function buildSkillsTotals(f, prefix) {
    return {
        label: 'TOTAL',
        male: int(f, `${prefix}_total_male`),
        female: int(f, `${prefix}_total_female`),
        total: int(f, `${prefix}_total_total`),
    };
}
function buildTrainingNeeds(f, prefix) {
    return [1, 2, 3].map((i) => ({
        index: i,
        domain: str(f, `${prefix}_domain_${i}_label`) || str(f, `${prefix}_domain_${i}_text`),
        male: int(f, `${prefix}_domain_${i}_male`),
        female: int(f, `${prefix}_domain_${i}_female`),
        total: int(f, `${prefix}_domain_${i}_total`),
    }));
}
function buildTrainingTotals(f, prefix) {
    return {
        label: 'TOTAL',
        male: int(f, `${prefix}_total_male`),
        female: int(f, `${prefix}_total_female`),
        total: int(f, `${prefix}_total_total`),
    };
}
function buildS23Q02(f) {
    const prefix = 's23q02';
    const buildContractRows = (contract) => CSP_ROWS.map((row) => ({
        label: CSP_LABELS[row] ?? row,
        male: ageBlock(f, `${prefix}_${contract}_${row}_male`),
        female: ageBlock(f, `${prefix}_${contract}_${row}_female`),
        total: ageBlock(f, `${prefix}_${contract}_${row}_total`),
    }));
    const buildContractTotals = (contract) => ({
        label: 'TOTAL',
        male: ageBlock(f, `${prefix}_${contract}_subtotal_male`),
        female: ageBlock(f, `${prefix}_${contract}_subtotal_female`),
        total: ageBlock(f, `${prefix}_${contract}_subtotal_total`),
    });
    return {
        permanent: buildContractRows('permanent'),
        permanentTotals: buildContractTotals('permanent'),
        temporary: buildContractRows('temporary'),
        temporaryTotals: buildContractTotals('temporary'),
        grandTotals: {
            label: 'TOTAL GÉNÉRAL',
            male: ageBlock(f, `${prefix}_grandtotal_male`),
            female: ageBlock(f, `${prefix}_grandtotal_female`),
            total: ageBlock(f, `${prefix}_grandtotal_total`),
        },
    };
}
function mapArea(v) {
    if (typeof v === 'number')
        return v;
    if (!v)
        return 0;
    const s = String(v).toLowerCase();
    if (s.includes('urbain') || s.includes('urban'))
        return 1;
    if (s.includes('rural'))
        return 2;
    return 0;
}
function mapSector(v) {
    if (typeof v === 'number')
        return v;
    if (!v)
        return 0;
    const s = String(v).toLowerCase();
    if (s === '1' || s.includes('primaire') || s.includes('primary'))
        return 1;
    if (s === '2' || s.includes('secondaire') || s.includes('secondary'))
        return 2;
    if (s === '3' || s.includes('tertiaire') || s.includes('tertiary'))
        return 3;
    return 0;
}
function mapLegalStatus(v) {
    if (typeof v === 'number')
        return v;
    if (!v)
        return 0;
    const s = String(v);
    if (s.includes('unipersonnelle'))
        return 1;
    if (s.includes('SARL'))
        return 2;
    if (s.includes('SA'))
        return 3;
    if (s.includes('Autres'))
        return 4;
    return 0;
}
function mapSize(v) {
    if (typeof v === 'number')
        return v;
    if (!v)
        return 0;
    const s = String(v);
    if (s.includes('TPE'))
        return 1;
    if (s.includes('GE'))
        return 4;
    if (s.includes('ME'))
        return 3;
    if (s.includes('PE'))
        return 2;
    return 0;
}
function mapCooperativeType(v) {
    if (typeof v === 'number')
        return v;
    if (!v)
        return 0;
    const s = String(v);
    if (s === '1' || s.includes('simplifiée'))
        return 1;
    if (s === '2' || s.includes("conseil d'administration"))
        return 2;
    if (s === '3' || s.includes('Autre'))
        return 3;
    return 0;
}
function mapCtdType(v) {
    if (typeof v === 'number')
        return v;
    if (!v)
        return 0;
    const s = String(v);
    if (s.includes('Région'))
        return 1;
    if (s.includes('Commune'))
        return 2;
    return 0;
}
function mapCouncilType(v) {
    if (typeof v === 'number')
        return v;
    if (!v)
        return 0;
    const s = String(v);
    if (s.includes('Arrondissement'))
        return 1;
    if (s.includes('Urbaine'))
        return 2;
    return 0;
}
function buildVulnerableRows(f, entityType) {
    const prefix = entityType === 'enterprise' ? 's22q05_ent' : 's22q05_oth';
    return buildPermTempRows(f, prefix, VULNERABLE_ENT_ROWS, VULNERABLE_ENT_LABELS);
}
function buildVulnerableTotals(f, entityType) {
    const prefix = entityType === 'enterprise' ? 's22q05_ent' : 's22q05_oth';
    return buildPermTempTotals(f, prefix);
}
function buildS2S4(f, entityType) {
    return {
        jobApplicationsRows: buildCspAgeRows(f, 's21q01'),
        jobApplicationsTotals: buildCspAgeTotals(f, 's21q01'),
        recruitmentsPermanentRows: buildCspAgeRows(f, 's22q01'),
        recruitmentsPermanentTotals: buildCspAgeTotals(f, 's22q01'),
        recruitmentsTemporaryRows: buildCspAgeRows(f, 's22q02'),
        recruitmentsTemporaryTotals: buildCspAgeTotals(f, 's22q02'),
        recruitmentsByDiplomaRows: buildDiplomaRows(f, 's22q03'),
        recruitmentsByDiplomaTotals: buildDiplomaTotals(f, 's22q03'),
        disabledRecruitmentsRows: buildPermTempRows(f, 's22q04', CSP_ROWS, CSP_LABELS),
        disabledRecruitmentsTotals: buildPermTempTotals(f, 's22q04'),
        vulnerableRecruitmentsRows: buildVulnerableRows(f, entityType),
        vulnerableRecruitmentsTotals: buildVulnerableTotals(f, entityType),
        firstTimeJobSeekerRows: buildCspAgeRows(f, 's23q01'),
        firstTimeJobSeekerTotals: buildCspAgeTotals(f, 's23q01'),
        s23q02: buildS23Q02(f),
        departuresRows: buildDepartureRows(f, 's3q01'),
        departuresTotals: buildDepartureTotals(f, 's3q01'),
        dismissalReasons: buildDismissalReasons(f, 's3q02'),
        dismissalReasonsTotals: buildDismissalReasonsTotals(f, 's3q02'),
        dismissalTechUnemploymentRows: buildDismissalTechRows(f, 's3q03'),
        dismissalTechUnemploymentTotals: buildDismissalTechTotals(f, 's3q03'),
        internshipsRows: buildInternshipRows(f, 's4q01'),
        internshipsTotals: buildInternshipTotals(f, 's4q01'),
        skills: buildSkills(f, 's4q02'),
        skillsTotals: buildSkillsTotals(f, 's4q02'),
        trainingNeeds: buildTrainingNeeds(f, 's4q03'),
        trainingNeedsTotals: buildTrainingTotals(f, 's4q03'),
    };
}
function mapEnterpriseData(f) {
    return {
        respondentName: str(f, 'S0Q01'),
        respondentFunction: str(f, 'S0Q02'),
        respondentPhone1: str(f, 'S0Q03_TEL1'),
        respondentPhone2: str(f, 'S0Q03_TEL2'),
        respondentEmail: str(f, 'S0Q03_EMAIL'),
        legalStatus: mapLegalStatus(f['S1Q01']),
        companyName: str(f, 'S1Q02'),
        area: mapArea(f['S1Q03']),
        region: str(f, 'S1Q04_REGION'),
        department: str(f, 'S1Q04_DEPT'),
        subdivision: str(f, 'S1Q04_SUBDIV'),
        locality: str(f, 'S1Q04_LOCALITY'),
        phone1: str(f, 'S1Q05_TEL1'),
        phone2: str(f, 'S1Q05_TEL2'),
        poBox: str(f, 'S1Q05_BP'),
        businessSector: mapSector(f['S1Q06']),
        branchActivity: str(f, 'S1Q07'),
        mainActivity: str(f, 'S1Q08'),
        headOffice: str(f, 'S1Q09'),
        permanentWorkers: f['S1Q10'] != null ? String(f['S1Q10']) : '',
        vacancies: f['S1Q11'] != null ? String(f['S1Q11']) : '',
        enterpriseSize: mapSize(f['S1Q12']),
        ...buildS2S4(f, 'enterprise'),
        surveyYear: f['surveyYear'] ?? new Date().getFullYear(),
        copy: 'Original',
    };
}
function mapCooperativeData(f) {
    return {
        respondentName: str(f, 'S0Q01'),
        respondentFunction: str(f, 'S0Q02'),
        respondentPhone1: str(f, 'S0Q03_TEL1'),
        respondentPhone2: str(f, 'S0Q03_TEL2'),
        respondentEmail: str(f, 'S0Q03_EMAIL'),
        cooperativeName: str(f, 'COOP_S1Q01'),
        cooperativeHeadOffice: str(f, 'COOP_S1Q02'),
        yearOfCreation: str(f, 'COOP_S1Q03'),
        area: mapArea(f['COOP_S1Q04']),
        region: str(f, 'COOP_S1Q05_REGION'),
        department: str(f, 'COOP_S1Q05_DEPT'),
        subdivision: str(f, 'COOP_S1Q05_SUBDIV'),
        locality: str(f, 'COOP_S1Q05_LOCALITY'),
        phone1: str(f, 'COOP_S1Q06_TEL1'),
        phone2: str(f, 'COOP_S1Q06_TEL2'),
        poBox: str(f, 'COOP_S1Q06_BP'),
        businessSector: mapSector(f['COOP_S1Q07']),
        branchActivity: str(f, 'COOP_S1Q08'),
        cooperativeMainActivity: str(f, 'COOP_S1Q09'),
        cooperativeType: mapCooperativeType(f['COOP_S1Q10']),
        cooperativeTypeOther: str(f, 'COOP_S1Q10_OTHER'),
        permanentWorkers: f['COOP_S1Q11'] != null ? String(f['COOP_S1Q11']) : '',
        vacancies: f['COOP_S1Q12'] != null ? String(f['COOP_S1Q12']) : '',
        ...buildS2S4(f, 'cooperative'),
        surveyYear: f['surveyYear'] ?? new Date().getFullYear(),
        copy: 'Original',
    };
}
function mapCtdData(f) {
    return {
        respondentName: str(f, 'S0Q01'),
        respondentFunction: str(f, 'S0Q02'),
        respondentPhone1: str(f, 'S0Q03_TEL1'),
        respondentPhone2: str(f, 'S0Q03_TEL2'),
        respondentEmail: str(f, 'S0Q03_EMAIL'),
        ctdType: mapCtdType(f['CTD_S1Q01']),
        councilType: mapCouncilType(f['CTD_S1Q02']),
        yearOfCreation: str(f, 'CTD_S1Q03'),
        area: mapArea(f['CTD_S1Q04']),
        region: str(f, 'CTD_S1Q05_REGION'),
        department: str(f, 'CTD_S1Q05_DEPT'),
        subdivision: str(f, 'CTD_S1Q05_SUBDIV'),
        locality: str(f, 'CTD_S1Q05_LOCALITY'),
        phone1: str(f, 'CTD_S1Q06_TEL1'),
        phone2: str(f, 'CTD_S1Q06_TEL2'),
        poBox: str(f, 'CTD_S1Q06_BP'),
        businessSector: mapSector(f['CTD_S1Q07']),
        branchActivity: str(f, 'CTD_S1Q08'),
        permanentWorkers: f['CTD_S1Q09'] != null ? String(f['CTD_S1Q09']) : '',
        vacancies: f['CTD_S1Q10'] != null ? String(f['CTD_S1Q10']) : '',
        ...buildS2S4(f, 'ctd'),
        surveyYear: f['surveyYear'] ?? new Date().getFullYear(),
        copy: 'Original',
    };
}
function mapOngData(f) {
    return {
        respondentName: str(f, 'S0Q01'),
        respondentFunction: str(f, 'S0Q02'),
        respondentPhone1: str(f, 'S0Q03_TEL1'),
        respondentPhone2: str(f, 'S0Q03_TEL2'),
        respondentEmail: str(f, 'S0Q03_EMAIL'),
        ongName: str(f, 'ONG_S1Q01'),
        headOffice: str(f, 'ONG_S1Q02'),
        yearOfCreation: str(f, 'ONG_S1Q03'),
        area: mapArea(f['ONG_S1Q04']),
        region: str(f, 'ONG_S1Q05_REGION'),
        department: str(f, 'ONG_S1Q05_DEPT'),
        subdivision: str(f, 'ONG_S1Q05_SUBDIV'),
        locality: str(f, 'ONG_S1Q05_LOCALITY'),
        phone1: str(f, 'ONG_S1Q06_TEL1'),
        phone2: str(f, 'ONG_S1Q06_TEL2'),
        poBox: str(f, 'ONG_S1Q06_BP'),
        businessSector: mapSector(f['ONG_S1Q07']),
        branchActivity: str(f, 'ONG_S1Q08'),
        mainMission: str(f, 'ONG_S1Q09'),
        permanentWorkers: f['ONG_S1Q10'] != null ? String(f['ONG_S1Q10']) : '',
        vacancies: f['ONG_S1Q11'] != null ? String(f['ONG_S1Q11']) : '',
        ...buildS2S4(f, 'ong'),
        surveyYear: f['surveyYear'] ?? new Date().getFullYear(),
        copy: 'Original',
    };
}
const ENTITY_EXPECTED_KEYS = {
    enterprise: [
        'S1Q01', 'S1Q02', 'S1Q03', 'S1Q04_REGION', 'S1Q04_DEPT', 'S1Q04_SUBDIV', 'S1Q04_LOCALITY',
        'S1Q05_TEL1', 'S1Q05_TEL2', 'S1Q05_BP', 'S1Q06', 'S1Q07', 'S1Q08', 'S1Q09', 'S1Q10', 'S1Q11', 'S1Q12',
    ],
    cooperative: [
        'COOP_S1Q01', 'COOP_S1Q02', 'COOP_S1Q03', 'COOP_S1Q04',
        'COOP_S1Q05_REGION', 'COOP_S1Q05_DEPT', 'COOP_S1Q05_SUBDIV', 'COOP_S1Q05_LOCALITY',
        'COOP_S1Q06_TEL1', 'COOP_S1Q06_TEL2', 'COOP_S1Q06_BP',
        'COOP_S1Q07', 'COOP_S1Q08', 'COOP_S1Q09', 'COOP_S1Q10', 'COOP_S1Q10_OTHER',
        'COOP_S1Q11', 'COOP_S1Q12',
    ],
    ctd: [
        'CTD_S1Q01', 'CTD_S1Q02', 'CTD_S1Q03', 'CTD_S1Q04',
        'CTD_S1Q05_REGION', 'CTD_S1Q05_DEPT', 'CTD_S1Q05_SUBDIV', 'CTD_S1Q05_LOCALITY',
        'CTD_S1Q06_TEL1', 'CTD_S1Q06_TEL2', 'CTD_S1Q06_BP',
        'CTD_S1Q07', 'CTD_S1Q08', 'CTD_S1Q09', 'CTD_S1Q10',
    ],
    ong: [
        'ONG_S1Q01', 'ONG_S1Q02', 'ONG_S1Q03', 'ONG_S1Q04',
        'ONG_S1Q05_REGION', 'ONG_S1Q05_DEPT', 'ONG_S1Q05_SUBDIV', 'ONG_S1Q05_LOCALITY',
        'ONG_S1Q06_TEL1', 'ONG_S1Q06_TEL2', 'ONG_S1Q06_BP',
        'ONG_S1Q07', 'ONG_S1Q08', 'ONG_S1Q09', 'ONG_S1Q10', 'ONG_S1Q11',
    ],
};
const BASE_EXPECTED_KEYS = [
    'S0Q01', 'S0Q02', 'S0Q03_TEL1', 'S0Q03_TEL2', 'S0Q03_EMAIL',
];
function diagnoseMappingKeys(f, entityType = 'cooperative') {
    const keys = new Set(Object.keys(f));
    const expected = [...BASE_EXPECTED_KEYS, ...ENTITY_EXPECTED_KEYS[entityType]];
    const missing = expected.filter(k => !keys.has(k));
    console.log('\n🔍 ===== KEY DIAGNOSTIC =====');
    console.log(`Entity type : ${entityType}`);
    if (missing.length === 0) {
        console.log('✅ All expected S0/S1 keys present');
    }
    else {
        console.log(`❌ ${missing.length} keys MISSING:`);
        missing.forEach(k => console.log(`   ❌ ${k}`));
    }
    console.log('🔍 ===========================\n');
}
exports.default = {};
//# sourceMappingURL=pdf-data-mapper.service.js.map