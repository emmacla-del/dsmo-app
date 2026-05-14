/**
 * ONEFOP Schema Registry — Single Source of Truth
 *
 * TableSpec is a discriminated union of 4 explicit kinds.
 * Each kind has exactly the fields it needs — no optionals, no runtime guessing.
 *
 * The builder does:  switch (spec.kind) { case 'matrix': ... }
 * Never:  if (spec.contracts) ... if (spec.count) ...
 *
 * ─── 4 Table Kinds ────────────────────────────────────────────────────────
 *
 *  matrix         rows × axes
 *                 → S21Q01, S22Q01-03, S22Q04-05, S23Q01, S4Q01
 *
 *  contract_matrix  contracts × (rows × axes + subtotal) + grandtotal
 *                 → S23Q02
 *
 *  typed_matrix   rows × types × axes
 *                 → S3Q01, S3Q03
 *
 *  indexed_list   count numbered rows, each with textField + leaf axes
 *                 → S3Q02, S4Q02, S4Q03
 */

// ─── Shared primitives ────────────────────────────────────────────────────

export type MapperKey =
    | 'area' | 'sector' | 'legalStatus' | 'size'
    | 'cooperativeType' | 'ctdType' | 'councilType';

export interface ScalarField {
    flat: string;
    map?: MapperKey;
    type?: 'number';
}

export interface RowDef { flatKey: string; dtoKey: string }
export type AxisType = 'age' | 'status' | 'gender';

// ─── Axis column definitions ──────────────────────────────────────────────

export const AXIS_COLS: Record<AxisType, RowDef[]> = {
    age: [
        { flatKey: '15_24', dtoKey: 'age15_24' },
        { flatKey: '25_34', dtoKey: 'age25_34' },
        { flatKey: '35_plus', dtoKey: 'age35plus' },
        { flatKey: 'total', dtoKey: 'total' },
    ],
    status: [
        { flatKey: 'permanent', dtoKey: 'permanent' },
        { flatKey: 'temporary', dtoKey: 'temporary' },
        { flatKey: 'total', dtoKey: 'total' },
    ],
    gender: [
        { flatKey: 'male', dtoKey: 'male' },
        { flatKey: 'female', dtoKey: 'female' },
        { flatKey: 'total', dtoKey: 'total' },
    ],
};

// ─── TableSpec discriminated union ────────────────────────────────────────

/** rows × axes  (most tables) */
export interface MatrixSpec {
    kind: 'matrix';
    prefix: string;
    dtoPath: string;
    rows: RowDef[];
    axes: AxisType[];
}

/** contracts × (rows × axes + subtotal) + grandtotal  (S23Q02) */
export interface ContractMatrixSpec {
    kind: 'contract_matrix';
    prefix: string;
    dtoPath: string;
    contracts: string[];
    rows: RowDef[];
    axes: AxisType[];
}

/** rows × types × axes  (S3Q01, S3Q03) */
export interface TypedMatrixSpec {
    kind: 'typed_matrix';
    prefix: string;
    dtoPath: string;
    rows: RowDef[];
    types: RowDef[];
    axes: AxisType[];
}

/** N numbered rows, each: textField + leaf-axis columns  (S3Q02, S4Q02, S4Q03) */
export interface IndexedListSpec {
    kind: 'indexed_list';
    prefix: string;
    dtoPath: string;
    count: number;
    textField: string;    // flat key segment:  prefix_textField_N_text
    textDtoField: string; // dto property:      dtoPath[N-1].textDtoField
    axes: AxisType[];
}

export type TableSpec =
    | MatrixSpec
    | ContractMatrixSpec
    | TypedMatrixSpec
    | IndexedListSpec;

// ─── Shared row constants ─────────────────────────────────────────────────

const CSP: RowDef[] = [
    { flatKey: 'cadres', dtoKey: 'executives' },
    { flatKey: 'foremen', dtoKey: 'foremen' },
    { flatKey: 'workers', dtoKey: 'fieldWorkers' },
];
const CSP_TOTAL: RowDef[] = [...CSP, { flatKey: 'total', dtoKey: 'total' }];

// ─── SCALAR SCHEMA ────────────────────────────────────────────────────────

export const SCALAR_SCHEMA: Record<string, ScalarField> = {
    // Section 0
    'respondent.name': { flat: 'S0Q01' },
    'respondent.function': { flat: 'S0Q02' },
    'respondent.phone1': { flat: 'S0Q03_TEL1' },
    'respondent.phone2': { flat: 'S0Q03_TEL2' },
    'respondent.email': { flat: 'S0Q03_EMAIL' },

    // Enterprise
    'enterprise.legalStatus': { flat: 'S1Q01', map: 'legalStatus' },
    'enterprise.name': { flat: 'S1Q02' },
    'enterprise.area': { flat: 'S1Q03', map: 'area' },
    'enterprise.region': { flat: 'S1Q04_REGION' },
    'enterprise.department': { flat: 'S1Q04_DEPT' },
    'enterprise.subdivision': { flat: 'S1Q04_SUBDIV' },
    'enterprise.locality': { flat: 'S1Q04_LOCALITY' },
    'enterprise.phone1': { flat: 'S1Q05_TEL1' },
    'enterprise.phone2': { flat: 'S1Q05_TEL2' },
    'enterprise.poBox': { flat: 'S1Q05_BP' },
    'enterprise.sector': { flat: 'S1Q06', map: 'sector' },
    'enterprise.branch': { flat: 'S1Q07' },
    'enterprise.mainActivity': { flat: 'S1Q08' },
    'enterprise.headOffice': { flat: 'S1Q09' },
    'enterprise.permanentWorkers': { flat: 'S1Q10', type: 'number' },
    'enterprise.vacancies': { flat: 'S1Q11', type: 'number' },
    'enterprise.size': { flat: 'S1Q12', map: 'size' },

    // Cooperative
    'cooperative.name': { flat: 'COOP_S1Q01' },
    'cooperative.headOffice': { flat: 'COOP_S1Q02' },
    'cooperative.yearCreated': { flat: 'COOP_S1Q03', type: 'number' },
    'cooperative.area': { flat: 'COOP_S1Q04', map: 'area' },
    'cooperative.region': { flat: 'COOP_S1Q05_REGION' },
    'cooperative.department': { flat: 'COOP_S1Q05_DEPT' },
    'cooperative.subdivision': { flat: 'COOP_S1Q05_SUBDIV' },
    'cooperative.locality': { flat: 'COOP_S1Q05_LOCALITY' },
    'cooperative.phone1': { flat: 'COOP_S1Q06_TEL1' },
    'cooperative.phone2': { flat: 'COOP_S1Q06_TEL2' },
    'cooperative.poBox': { flat: 'COOP_S1Q06_BP' },
    'cooperative.sector': { flat: 'COOP_S1Q07', map: 'sector' },
    'cooperative.branch': { flat: 'COOP_S1Q08' },
    'cooperative.mainActivity': { flat: 'COOP_S1Q09' },
    'cooperative.type': { flat: 'COOP_S1Q10', map: 'cooperativeType' },
    'cooperative.typeOther': { flat: 'COOP_S1Q10_OTHER' },
    'cooperative.permanentWorkers': { flat: 'COOP_S1Q11', type: 'number' },
    'cooperative.vacancies': { flat: 'COOP_S1Q12', type: 'number' },

    // CTD
    'ctd.type': { flat: 'CTD_S1Q01', map: 'ctdType' },
    'ctd.councilType': { flat: 'CTD_S1Q02', map: 'councilType' },
    'ctd.yearCreated': { flat: 'CTD_S1Q03', type: 'number' },
    'ctd.area': { flat: 'CTD_S1Q04', map: 'area' },
    'ctd.region': { flat: 'CTD_S1Q05_REGION' },
    'ctd.department': { flat: 'CTD_S1Q05_DEPT' },
    'ctd.subdivision': { flat: 'CTD_S1Q05_SUBDIV' },
    'ctd.locality': { flat: 'CTD_S1Q05_LOCALITY' },
    'ctd.phone1': { flat: 'CTD_S1Q06_TEL1' },
    'ctd.phone2': { flat: 'CTD_S1Q06_TEL2' },
    'ctd.poBox': { flat: 'CTD_S1Q06_BP' },
    'ctd.sector': { flat: 'CTD_S1Q07', map: 'sector' },
    'ctd.branch': { flat: 'CTD_S1Q08' },
    'ctd.permanentWorkers': { flat: 'CTD_S1Q09', type: 'number' },
    'ctd.vacancies': { flat: 'CTD_S1Q10', type: 'number' },

    // ONG
    'ong.name': { flat: 'ONG_S1Q01' },
    'ong.headOffice': { flat: 'ONG_S1Q02' },
    'ong.yearCreated': { flat: 'ONG_S1Q03', type: 'number' },
    'ong.area': { flat: 'ONG_S1Q04', map: 'area' },
    'ong.region': { flat: 'ONG_S1Q05_REGION' },
    'ong.department': { flat: 'ONG_S1Q05_DEPT' },
    'ong.subdivision': { flat: 'ONG_S1Q05_SUBDIV' },
    'ong.locality': { flat: 'ONG_S1Q05_LOCALITY' },
    'ong.phone1': { flat: 'ONG_S1Q06_TEL1' },
    'ong.phone2': { flat: 'ONG_S1Q06_TEL2' },
    'ong.poBox': { flat: 'ONG_S1Q06_BP' },
    'ong.sector': { flat: 'ONG_S1Q07', map: 'sector' },
    'ong.branch': { flat: 'ONG_S1Q08' },
    'ong.mainMission': { flat: 'ONG_S1Q09' },
    'ong.permanentWorkers': { flat: 'ONG_S1Q10', type: 'number' },
    'ong.vacancies': { flat: 'ONG_S1Q11', type: 'number' },
};

// ─── TABLE SCHEMA ─────────────────────────────────────────────────────────

export const TABLE_SCHEMA: TableSpec[] = [

    // ── matrix: rows × axes ───────────────────────────────────────────────────

    { kind: 'matrix', prefix: 's21q01', dtoPath: 'jobApplications', rows: CSP, axes: ['gender', 'age'] },
    { kind: 'matrix', prefix: 's22q01', dtoPath: 'recruitmentsPermanent', rows: CSP, axes: ['gender', 'age'] },
    { kind: 'matrix', prefix: 's22q02', dtoPath: 'recruitmentsTemporary', rows: CSP, axes: ['gender', 'age'] },
    { kind: 'matrix', prefix: 's22q04', dtoPath: 'disabledRecruitments', rows: CSP_TOTAL, axes: ['status', 'gender'] },
    { kind: 'matrix', prefix: 's22q05_oth', dtoPath: 'vulnerableRecruitments', rows: CSP_TOTAL, axes: ['status', 'gender'] },
    { kind: 'matrix', prefix: 's23q01', dtoPath: 'firstTimeJobSeekers', rows: CSP, axes: ['gender', 'age'] },
    {
        kind: 'matrix',
        prefix: 's4q01',
        dtoPath: 'internships',
        axes: ['gender'],
        rows: [
            { flatKey: 'vacation', dtoKey: 'holiday' },
            { flatKey: 'academic', dtoKey: 'academic' },
            { flatKey: 'professional', dtoKey: 'professional' },
            { flatKey: 'pre_employment', dtoKey: 'preWork' },
            { flatKey: 'total', dtoKey: 'total' },
        ],
    },
    {
        kind: 'matrix',
        prefix: 's22q03',
        dtoPath: 'recruitmentsByDiploma',
        axes: ['gender', 'age'],
        rows: [
            { flatKey: 'cep', dtoKey: 'cepCepe' },
            { flatKey: 'probatoire', dtoKey: 'probatoire' },
            { flatKey: 'bac', dtoKey: 'bac' },
            { flatKey: 'bts', dtoKey: 'btsDut' },
            { flatKey: 'licence', dtoKey: 'licence' },
            { flatKey: 'maitrise', dtoKey: 'maitrise' },
            { flatKey: 'master', dtoKey: 'master' },
            { flatKey: 'dqp', dtoKey: 'dqp' },
            { flatKey: 'cqp', dtoKey: 'cqp' },
            { flatKey: 'autres', dtoKey: 'autres' },
            { flatKey: 'sans_diplome', dtoKey: 'sansDiplome' },
            { flatKey: 'total', dtoKey: 'total' },
        ],
    },
    {
        kind: 'matrix',
        prefix: 's22q05_ent',
        dtoPath: 'vulnerableRecruitments',
        axes: ['status', 'gender'],
        rows: [
            { flatKey: 'deplaces_internes', dtoKey: 'internalDisplaced' },
            { flatKey: 'refugies', dtoKey: 'refugees' },
            { flatKey: 'orphelins', dtoKey: 'orphans' },
            { flatKey: 'total', dtoKey: 'total' },
        ],
    },

    // ── contract_matrix: contracts × (rows × axes + subtotal) + grandtotal ───

    {
        kind: 'contract_matrix',
        prefix: 's23q02',
        dtoPath: 'firstTimeRecruitments',
        contracts: ['permanent', 'temporary'],
        rows: CSP,
        axes: ['gender', 'age'],
    },

    // ── typed_matrix: rows × types × axes ────────────────────────────────────

    {
        kind: 'typed_matrix',
        prefix: 's3q01',
        dtoPath: 'departures',
        rows: CSP_TOTAL,
        types: [
            { flatKey: 'dismissal', dtoKey: 'dismissals' },
            { flatKey: 'resignation', dtoKey: 'resignations' },
            { flatKey: 'retirement', dtoKey: 'retirements' },
            { flatKey: 'other', dtoKey: 'others' },
            { flatKey: 'ensemble', dtoKey: 'ensemble' },
        ],
        axes: ['gender'],
    },
    {
        kind: 'typed_matrix',
        prefix: 's3q03',
        dtoPath: 'dismissalTechUnemployment',
        rows: CSP_TOTAL,
        types: [
            { flatKey: 'dismissal', dtoKey: 'dismissal' },
            { flatKey: 'technical_unemployment', dtoKey: 'technicalUnemployment' },
            { flatKey: 'total', dtoKey: 'total' },
        ],
        axes: ['gender'],
    },

    // ── indexed_list: N numbered rows, text + leaf-axis columns ──────────────

    { kind: 'indexed_list', prefix: 's3q02', dtoPath: 'dismissalReasons', count: 3, textField: 'reason', textDtoField: 'text', axes: ['gender'] },
    { kind: 'indexed_list', prefix: 's4q02', dtoPath: 'skillsNeeds', count: 3, textField: 'skill', textDtoField: 'description', axes: ['gender'] },
    { kind: 'indexed_list', prefix: 's4q03', dtoPath: 'trainingNeeds', count: 3, textField: 'domain', textDtoField: 'domain', axes: ['gender'] },
];