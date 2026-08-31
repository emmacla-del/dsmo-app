// pdf-data-mapper.service.ts
// Fully typed — no implicit any, no index-signature errors

import {
    parseCampaignCode,
    collectionPeriodFromQuarterCode,
    computeCollectionPeriod,
    formatCollectionPeriodFr,
    formatCollectionPeriodEn,
} from '../campaign/campaign-period.helper';

// ─────────────────────────────────────────────
// SHARED TYPES
// ─────────────────────────────────────────────

type FlatData = Record<string, unknown>;
type EntityType = 'enterprise' | 'cooperative' | 'ctd' | 'ong' | 'administration' | 'projectProgram' | 'vocationalTraining';
type LabelMap = Record<string, string>;

// The reporting year printed all over the form ("...du 1er Janvier
// {{surveyYear}} à ce jour...") is the year of the campaign/round the
// submission was filed under — parsed from its quarterCode via
// parseCampaignCode() (e.g. "QUARTERLY_2026_T1_001" -> 2026) — never the
// machine's current date. Falling back to `now` meant a submission
// previewed, filed, or PDF'd after its own reporting period had ended (e.g.
// a Q4-2025 form opened/regenerated in January 2026) silently printed the
// wrong year on every page.
export function surveyYearFromQuarterCode(quarterCode?: string | null): number {
    return parseCampaignCode(quarterCode)?.year ?? new Date().getFullYear();
}

// {{collectionPeriodFr}}/{{collectionPeriodEn}} — the data-collection period
// (S21Q01 and its sibling questions; see the .hbs templates and
// OnefopFormController.kPeriodBasedQuestionIds on the Flutter side), derived
// the same way as surveyYear: from the submission's own quarterCode, not a
// live DB round lookup, so a PDF regenerated long after its campaign closed
// still prints the correct period. Falls back to today's calendar quarter
// only for the no-quarterCode preview path (never for a filed submission).
function collectionPeriodStrings(quarterCode?: string | null): {
    collectionPeriodFr: string;
    collectionPeriodEn: string;
} {
    const period =
        collectionPeriodFromQuarterCode(quarterCode) ?? computeCollectionPeriod('QUARTERLY', new Date());
    return {
        collectionPeriodFr: formatCollectionPeriodFr(period),
        collectionPeriodEn: formatCollectionPeriodEn(period),
    };
}

interface AgeBreakdown {
    age15_24: number;
    age25_34: number;
    age35plus: number;
    total: number;
}

interface GenderAgeBreakdown {
    male: AgeBreakdown;
    female: AgeBreakdown;
    total: AgeBreakdown;
}

interface CspAgeRow {
    label: string;
    male: AgeBreakdown;
    female: AgeBreakdown;
    total: AgeBreakdown;
}

interface MFT {
    male: number;
    female: number;
    total: number;
}

interface PermTempRow {
    label: string;
    permanent: MFT;
    temporary: MFT;
    total: MFT;
}

interface PermTempTotals {
    label: string;
    permanent: MFT;
    temporary: MFT;
    total: MFT;
}

interface DepartureRow {
    label: string;
    dismissals: MFT;
    resignations: MFT;
    retirements: MFT;
    others: MFT;
    ensemble: MFT;
}

interface DepartureTotals {
    label: string;
    dismissals: MFT;
    resignations: MFT;
    retirements: MFT;
    others: MFT;
    ensemble: MFT;
}

interface DismissalTechRow {
    label: string;
    dismissal: MFT;
    technicalUnemployment: MFT;
    total: MFT;
}

interface DismissalTechTotals {
    label: string;
    dismissal: MFT;
    technicalUnemployment: MFT;
    total: MFT;
}

interface DismissalReason {
    index: number;
    text: string;
    male: number;
    female: number;
    total: number;
}

interface ListTotals {
    label: string;
    male: number;
    female: number;
    total: number;
}

interface InternshipRow {
    label: string;
    male: number;
    female: number;
    total: number;
}

interface SkillRow {
    index: number;
    description: string;
    male: number;
    female: number;
    total: number;
}

interface TrainingRow {
    index: number;
    domain: string;
    male: number;
    female: number;
    total: number;
}

interface ContractBlock {
    rows: CspAgeRow[];
    totals: CspAgeRow;     // shares same shape (label + gender/age breakdown)
}

interface S23Q02Result {
    permanent: CspAgeRow[];
    permanentTotals: CspAgeRow;
    temporary: CspAgeRow[];
    temporaryTotals: CspAgeRow;
    grandTotals: CspAgeRow;
}

// ─────────────────────────────────────────────
// PRIMITIVE HELPERS
// ─────────────────────────────────────────────

function int(f: FlatData, key: string): number {
    const v = f[key];
    if (typeof v === 'number') return v;
    if (v === undefined || v === null || v === '') return 0;
    const n = parseInt(String(v), 10);
    return isNaN(n) ? 0 : n;
}

function str(f: FlatData, key: string): string {
    const v = f[key];
    return v !== undefined && v !== null ? String(v) : '';
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const CSP_ROWS: string[] = ['cadres', 'foremen', 'workers'];

const CSP_LABELS: LabelMap = {
    cadres: 'Cadres / Managers',
    foremen: 'Agents de maîtrise / Foremen',
    workers: 'Ouvriers / Workers',
};

// Administration's S21Q01/S22Q01/S3Q01 use SFP status rows instead of CSP
// rows — see mapAdministrationData below.
const SFP_ROWS: string[] = ['fonctionnaire', 'decisionnaire', 'contractuelle'];

const SFP_LABELS: LabelMap = {
    fonctionnaire: 'Fonctionnaire / Civil servant',
    decisionnaire: 'Décisionnaire / Decision-maker',
    contractuelle: 'Contractuelle / Contractual',
};

const DIPLOMA_MAP: [string, string][] = [
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

const INTERNSHIP_MAP: [string, string][] = [
    ['vacation', 'Stage de vacance / Vacation internship'],
    ['academic', 'Stage académique / Academic internship'],
    ['professional', 'Stage professionnel / Professional internship'],
    ['pre_employment', 'Stage pré-emploi / Pre-employment internship'],
];

const VULNERABLE_ENT_ROWS: string[] = ['deplaces_internes', 'refugies', 'orphelins'];

const VULNERABLE_ENT_LABELS: LabelMap = {
    deplaces_internes: 'Déplacés internes / Internal displaced',
    refugies: 'Réfugiés / Refugees',
    orphelins: 'Orphelins / Orphans',
};

// ─────────────────────────────────────────────
// AGE BREAKDOWN BUILDER
// ─────────────────────────────────────────────

function ageBlock(f: FlatData, prefix: string): AgeBreakdown {
    return {
        age15_24: int(f, `${prefix}_15_24`),
        age25_34: int(f, `${prefix}_25_34`),
        age35plus: int(f, `${prefix}_35_plus`),
        total: int(f, `${prefix}_total`),
    };
}

// ─────────────────────────────────────────────
// CSP × AGE TABLES
// ─────────────────────────────────────────────

function buildCspAgeRows(
    f: FlatData,
    prefix: string,
    rows: string[] = CSP_ROWS,
    labels: LabelMap = CSP_LABELS,
): CspAgeRow[] {
    return rows.map((row): CspAgeRow => ({
        label: labels[row] ?? row,
        male: ageBlock(f, `${prefix}_${row}_male`),
        female: ageBlock(f, `${prefix}_${row}_female`),
        total: ageBlock(f, `${prefix}_${row}_total`),
    }));
}

function buildCspAgeTotals(f: FlatData, prefix: string): CspAgeRow {
    return {
        label: 'TOTAL',
        male: ageBlock(f, `${prefix}_total_male`),
        female: ageBlock(f, `${prefix}_total_female`),
        total: ageBlock(f, `${prefix}_total_total`),
    };
}

// ─────────────────────────────────────────────
// DIPLOMA TABLE
// ─────────────────────────────────────────────

function buildDiplomaRows(f: FlatData, prefix: string): CspAgeRow[] {
    return DIPLOMA_MAP.map(([slug, label]): CspAgeRow => ({
        label,
        male: ageBlock(f, `${prefix}_${slug}_male`),
        female: ageBlock(f, `${prefix}_${slug}_female`),
        total: ageBlock(f, `${prefix}_${slug}_total`),
    }));
}

function buildDiplomaTotals(f: FlatData, prefix: string): CspAgeRow {
    // same key pattern as CSP totals
    return buildCspAgeTotals(f, prefix);
}

// ─────────────────────────────────────────────
// PERMANENT / TEMPORARY TABLE
// ─────────────────────────────────────────────

function mft(f: FlatData, prefix: string): MFT {
    return {
        male: int(f, `${prefix}_male`),
        female: int(f, `${prefix}_female`),
        total: int(f, `${prefix}_total`),
    };
}

function buildPermTempRows(
    f: FlatData,
    prefix: string,
    rows: string[],
    labels: LabelMap,
): PermTempRow[] {
    return rows.map((row): PermTempRow => ({
        label: labels[row] ?? row,
        permanent: mft(f, `${prefix}_${row}_permanent`),
        temporary: mft(f, `${prefix}_${row}_temporary`),
        total: mft(f, `${prefix}_${row}_total`),
    }));
}

function buildPermTempTotals(f: FlatData, prefix: string): PermTempTotals {
    return {
        label: 'TOTAL',
        permanent: mft(f, `${prefix}_total_permanent`),
        temporary: mft(f, `${prefix}_total_temporary`),
        total: mft(f, `${prefix}_total_total`),
    };
}

// ─────────────────────────────────────────────
// DEPARTURES TABLE
// ─────────────────────────────────────────────

function buildDepartureRows(
    f: FlatData,
    prefix: string,
    rows: string[] = CSP_ROWS,
    labels: LabelMap = CSP_LABELS,
): DepartureRow[] {
    return rows.map((row): DepartureRow => ({
        label: labels[row] ?? row,
        dismissals: mft(f, `${prefix}_${row}_dismissal`),
        resignations: mft(f, `${prefix}_${row}_resignation`),
        retirements: mft(f, `${prefix}_${row}_retirement`),
        others: mft(f, `${prefix}_${row}_other`),
        ensemble: mft(f, `${prefix}_${row}_ensemble`),
    }));
}

function buildDepartureTotals(f: FlatData, prefix: string): DepartureTotals {
    return {
        label: 'TOTAL',
        dismissals: mft(f, `${prefix}_total_dismissal`),
        resignations: mft(f, `${prefix}_total_resignation`),
        retirements: mft(f, `${prefix}_total_retirement`),
        others: mft(f, `${prefix}_total_other`),
        ensemble: mft(f, `${prefix}_total_ensemble`),
    };
}

// ─────────────────────────────────────────────
// DISMISSAL REASONS  (always 3 rows — no silent skip)
// ─────────────────────────────────────────────

function buildDismissalReasons(f: FlatData, prefix: string): DismissalReason[] {
    return ([1, 2, 3] as const).map((i): DismissalReason => ({
        index: i,
        // ← READ _label FIRST, fallback to _text for legacy
        text: str(f, `${prefix}_reason_${i}_label`) || str(f, `${prefix}_reason_${i}_text`),
        male: int(f, `${prefix}_reason_${i}_male`),
        female: int(f, `${prefix}_reason_${i}_female`),
        total: int(f, `${prefix}_reason_${i}_total`),
    }));
}

function buildDismissalReasonsTotals(f: FlatData, prefix: string): ListTotals {
    return {
        label: 'TOTAL',
        male: int(f, `${prefix}_total_male`),
        female: int(f, `${prefix}_total_female`),
        total: int(f, `${prefix}_total_total`),
    };
}

// ─────────────────────────────────────────────
// DISMISSAL + TECHNICAL UNEMPLOYMENT TABLE
// ─────────────────────────────────────────────

function buildDismissalTechRows(f: FlatData, prefix: string): DismissalTechRow[] {
    return CSP_ROWS.map((row): DismissalTechRow => ({
        label: CSP_LABELS[row] ?? row,
        dismissal: mft(f, `${prefix}_${row}_dismissal`),
        technicalUnemployment: mft(f, `${prefix}_${row}_technical_unemployment`),
        total: mft(f, `${prefix}_${row}_total`),
    }));
}

function buildDismissalTechTotals(f: FlatData, prefix: string): DismissalTechTotals {
    return {
        label: 'TOTAL',
        dismissal: mft(f, `${prefix}_total_dismissal`),
        technicalUnemployment: mft(f, `${prefix}_total_technical_unemployment`),
        total: mft(f, `${prefix}_total_total`),
    };
}

// ─────────────────────────────────────────────
// INTERNSHIPS  (always 4 rows + totals with label)
// ─────────────────────────────────────────────

function buildInternshipRows(f: FlatData, prefix: string): InternshipRow[] {
    return INTERNSHIP_MAP.map(([slug, label]): InternshipRow => ({
        label,
        male: int(f, `${prefix}_${slug}_male`),
        female: int(f, `${prefix}_${slug}_female`),
        total: int(f, `${prefix}_${slug}_total`),
    }));
}

function buildInternshipTotals(f: FlatData, prefix: string): ListTotals {
    return {
        label: 'TOTAL',
        male: int(f, `${prefix}_total_male`),
        female: int(f, `${prefix}_total_female`),
        total: int(f, `${prefix}_total_total`),
    };
}

// ─────────────────────────────────────────────
// SKILLS NEEDS  (always 3 rows — no silent skip)
// ─────────────────────────────────────────────

function buildSkills(f: FlatData, prefix: string): SkillRow[] {
    return ([1, 2, 3] as const).map((i): SkillRow => ({
        index: i,
        // ← READ _label FIRST, fallback to _description for legacy
        description: str(f, `${prefix}_skill_${i}_label`) || str(f, `${prefix}_skill_${i}_text`),
        male: int(f, `${prefix}_skill_${i}_male`),
        female: int(f, `${prefix}_skill_${i}_female`),
        total: int(f, `${prefix}_skill_${i}_total`),
    }));
}

function buildSkillsTotals(f: FlatData, prefix: string): ListTotals {
    return {
        label: 'TOTAL',
        male: int(f, `${prefix}_total_male`),
        female: int(f, `${prefix}_total_female`),
        total: int(f, `${prefix}_total_total`),
    };
}

// ─────────────────────────────────────────────
// TRAINING NEEDS  (always 3 rows — no silent skip)
// ─────────────────────────────────────────────

function buildTrainingNeeds(f: FlatData, prefix: string): TrainingRow[] {
    return ([1, 2, 3] as const).map((i): TrainingRow => ({
        index: i,
        // ← READ _label FIRST, fallback to _domain for legacy
        domain: str(f, `${prefix}_domain_${i}_label`) || str(f, `${prefix}_domain_${i}_text`),
        male: int(f, `${prefix}_domain_${i}_male`),
        female: int(f, `${prefix}_domain_${i}_female`),
        total: int(f, `${prefix}_domain_${i}_total`),
    }));
}

function buildTrainingTotals(f: FlatData, prefix: string): ListTotals {
    return {
        label: 'TOTAL',
        male: int(f, `${prefix}_total_male`),
        female: int(f, `${prefix}_total_female`),
        total: int(f, `${prefix}_total_total`),
    };
}

// ─────────────────────────────────────────────
// S23Q02 — FIRST-TIME RECRUITMENTS
// ─────────────────────────────────────────────

function buildS23Q02(f: FlatData): S23Q02Result {
    const prefix = 's23q02';

    const buildContractRows = (contract: string): CspAgeRow[] =>
        CSP_ROWS.map((row): CspAgeRow => ({
            label: CSP_LABELS[row] ?? row,
            male: ageBlock(f, `${prefix}_${contract}_${row}_male`),
            female: ageBlock(f, `${prefix}_${contract}_${row}_female`),
            total: ageBlock(f, `${prefix}_${contract}_${row}_total`),
        }));

    const buildContractTotals = (contract: string): CspAgeRow => ({
        label: 'TOTAL',
        male: ageBlock(f, `${prefix}_${contract}_subtotal_male`),
        female: ageBlock(f, `${prefix}_${contract}_subtotal_female`),
        total: ageBlock(f, `${prefix}_${contract}_subtotal_total`),
    })

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

// ─────────────────────────────────────────────
// ENUM MAPPERS
// ─────────────────────────────────────────────

function mapArea(v: unknown): number {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const s = String(v).toLowerCase();
    if (s.includes('urbain') || s.includes('urban')) return 1;
    if (s.includes('rural')) return 2;
    return 0;
}

// Administration's S1Q09/S1Q11 (Oui/Non) — 1=Oui, 2=Non, same convention
// as mapArea/mapSector below.
function mapYesNo(v: unknown): number {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const s = String(v).toLowerCase();
    if (s.includes('oui') || s.includes('yes')) return 1;
    if (s.includes('non') || s.includes('no')) return 2;
    return 0;
}

function mapSector(v: unknown): number {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const s = String(v).toLowerCase();
    if (s === '1' || s.includes('primaire') || s.includes('primary')) return 1;
    if (s === '2' || s.includes('secondaire') || s.includes('secondary')) return 2;
    if (s === '3' || s.includes('tertiaire') || s.includes('tertiary')) return 3;
    return 0;
}

function mapLegalStatus(v: unknown): number {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const s = String(v);
    if (s.includes('unipersonnelle')) return 1;
    if (s.includes('SARL')) return 2;
    if (s.includes('SA')) return 3;
    if (s.includes('Autres')) return 4;
    return 0;
}

function mapSize(v: unknown): number {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const s = String(v);
    // GE before PE/ME to avoid substring collision
    if (s.includes('TPE')) return 1;
    if (s.includes('GE')) return 4;
    if (s.includes('ME')) return 3;
    if (s.includes('PE')) return 2;
    return 0;
}

function mapCooperativeType(v: unknown): number {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const s = String(v);
    if (s === '1' || s.includes('simplifiée')) return 1;
    if (s === '2' || s.includes("conseil d'administration")) return 2;
    if (s === '3' || s.includes('Autre')) return 3;
    return 0;
}

function mapCtdType(v: unknown): number {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const s = String(v);
    if (s.includes('Région')) return 1;
    if (s.includes('Commune')) return 2;
    return 0;
}

function mapCouncilType(v: unknown): number {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const s = String(v);
    if (s.includes('Arrondissement')) return 1;
    if (s.includes('Urbaine')) return 2;
    return 0;
}

// ─────────────────────────────────────────────
// VULNERABLE RECRUITMENTS  (entity-type-aware)
// ─────────────────────────────────────────────

function buildVulnerableRows(f: FlatData, entityType: EntityType): PermTempRow[] {
    // Both enterprise (s22q05_ent) and all others (s22q05_oth) use the same
    // vulnerability-type row keys — confirmed by TableCellEngine.dispatch()
    // which passes ['deplaces_internes','refugies','orphelins'] for both prefixes.
    const prefix = entityType === 'enterprise' ? 's22q05_ent' : 's22q05_oth';
    return buildPermTempRows(f, prefix, VULNERABLE_ENT_ROWS, VULNERABLE_ENT_LABELS);
}

function buildVulnerableTotals(f: FlatData, entityType: EntityType): PermTempTotals {
    const prefix = entityType === 'enterprise' ? 's22q05_ent' : 's22q05_oth';
    return buildPermTempTotals(f, prefix);
}

// ─────────────────────────────────────────────
// COMBINED S2–S4 BUILDER
// ─────────────────────────────────────────────

function buildS2S4(f: FlatData, entityType: EntityType) {
    return {
        // S2.1
        jobApplicationsRows: buildCspAgeRows(f, 's21q01'),
        jobApplicationsTotals: buildCspAgeTotals(f, 's21q01'),
        // S2.2 permanent
        recruitmentsPermanentRows: buildCspAgeRows(f, 's22q01'),
        recruitmentsPermanentTotals: buildCspAgeTotals(f, 's22q01'),
        // S2.2 temporary
        recruitmentsTemporaryRows: buildCspAgeRows(f, 's22q02'),
        recruitmentsTemporaryTotals: buildCspAgeTotals(f, 's22q02'),
        // S2.2 by diploma
        recruitmentsByDiplomaRows: buildDiplomaRows(f, 's22q03'),
        recruitmentsByDiplomaTotals: buildDiplomaTotals(f, 's22q03'),
        // S2.2 disabled
        disabledRecruitmentsRows: buildPermTempRows(f, 's22q04', CSP_ROWS, CSP_LABELS),
        disabledRecruitmentsTotals: buildPermTempTotals(f, 's22q04'),
        // S2.2 vulnerable
        vulnerableRecruitmentsRows: buildVulnerableRows(f, entityType),
        vulnerableRecruitmentsTotals: buildVulnerableTotals(f, entityType),
        // S2.3 first-time job seekers
        firstTimeJobSeekerRows: buildCspAgeRows(f, 's23q01'),
        firstTimeJobSeekerTotals: buildCspAgeTotals(f, 's23q01'),
        // S2.3 first-time recruitments
        s23q02: buildS23Q02(f),
        // S3
        departuresRows: buildDepartureRows(f, 's3q01'),
        departuresTotals: buildDepartureTotals(f, 's3q01'),
        dismissalReasons: buildDismissalReasons(f, 's3q02'),
        dismissalReasonsTotals: buildDismissalReasonsTotals(f, 's3q02'),
        dismissalTechUnemploymentRows: buildDismissalTechRows(f, 's3q03'),
        dismissalTechUnemploymentTotals: buildDismissalTechTotals(f, 's3q03'),
        // S4
        internshipsRows: buildInternshipRows(f, 's4q01'),
        internshipsTotals: buildInternshipTotals(f, 's4q01'),
        skills: buildSkills(f, 's4q02'),
        skillsTotals: buildSkillsTotals(f, 's4q02'),
        trainingNeeds: buildTrainingNeeds(f, 's4q03'),
        trainingNeedsTotals: buildTrainingTotals(f, 's4q03'),
    };
}

// Administration's Section 2/3/4 is structurally narrower than the other
// four entity types: S21Q01/S22Q01-equivalent use SFP status rows instead
// of CSP rows and there's no permanent/temporary split (S22Q02),
// no diploma breakdown (S22Q03), no "Primo demandeur" (S23Q01/S23Q02),
// and no training-domain-needs question (S4Q03). S3Q03 (dismissal/
// technical unemployment) is also not included — its row labels could not
// be visually confirmed against the authoritative PDF (see the Phase 1
// audit) and administration.hbs does not reference it. Deliberately a
// separate builder rather than reusing buildS2S4, since the two shapes
// diverge in exactly which sections exist, not just which row labels
// they use.
function buildS2S4Administration(f: FlatData) {
    return {
        // 2.1 — census (S21Q01, SFP rows)
        jobApplicationsRows: buildCspAgeRows(f, 's21q01', SFP_ROWS, SFP_LABELS),
        jobApplicationsTotals: buildCspAgeTotals(f, 's21q01'),
        // 2.2 — recruitment (S22Q01-equivalent, SFP rows)
        recruitmentsPermanentRows: buildCspAgeRows(f, 's22q01', SFP_ROWS, SFP_LABELS),
        recruitmentsPermanentTotals: buildCspAgeTotals(f, 's22q01'),
        // 2.2 — disabled (S22Q04, CSP rows — preserved as-is, see audit)
        disabledRecruitmentsRows: buildPermTempRows(f, 's22q04', CSP_ROWS, CSP_LABELS),
        disabledRecruitmentsTotals: buildPermTempTotals(f, 's22q04'),
        // 2.2 — vulnerable (S22Q05, reuses the cooperative/ctd/ong prefix)
        vulnerableRecruitmentsRows: buildVulnerableRows(f, 'administration'),
        vulnerableRecruitmentsTotals: buildVulnerableTotals(f, 'administration'),
        // S3 — departures (S3Q01, SFP rows) + dismissal reasons (S3Q02)
        departuresRows: buildDepartureRows(f, 's3q01', SFP_ROWS, SFP_LABELS),
        departuresTotals: buildDepartureTotals(f, 's3q01'),
        dismissalReasons: buildDismissalReasons(f, 's3q02'),
        dismissalReasonsTotals: buildDismissalReasonsTotals(f, 's3q02'),
        // S4 — internship (S4Q01) + skills needs (S4Q02)
        internshipsRows: buildInternshipRows(f, 's4q01'),
        internshipsTotals: buildInternshipTotals(f, 's4q01'),
        skills: buildSkills(f, 's4q02'),
        skillsTotals: buildSkillsTotals(f, 's4q02'),
    };
}

// Projects & Programs — Section 2's activities table (variable-count
// repeating rows, up to 13 — see AstFieldType.repeatingTable) and
// Section 3's outcomes/perspectives KPI grid (4 fixed rows x 3 period
// columns). Neither shape existed before this entity — Section 2's
// coded fields (targetPopulation/supportType/scope) are displayed as
// "code — label" for the PDF, matching the source instrument's legend,
// not the raw stored code.
const PP_TARGET_POPULATION_LABELS: LabelMap = {
    '1': 'Jeune non diplômé / Non-graduate youth',
    '2': 'Jeune diplômé / Graduate youth',
    '3': 'Femme / Women',
    '4': 'Monde rural / Rural',
    '5': 'Population urbaine / Urban population',
    '6': 'Autre / Other',
};

const PP_SUPPORT_TYPE_LABELS: LabelMap = {
    '1': 'Gratuit / Free',
    '2': 'Tarifé / Fee-based',
    '3': 'Aide financière remboursable / Reimbursable financial assistance',
    '4': 'Aide financière non remboursable / Non-reimbursable financial assistance',
    '5': 'Autre / Other',
};

const PP_SCOPE_LABELS: LabelMap = {
    '1': 'National / National',
    '2': 'Régional / Regional',
    '3': 'Local / Local',
    '4': 'Autre / Other',
};

interface ActivityRow {
    index: number;
    description: string;
    targetPopulation: string;
    supportType: string;
    scope: string;
    startDate: string;
    duration: string;
}

function buildActivityRows(f: FlatData): ActivityRow[] {
    const rows: ActivityRow[] = [];
    for (let i = 1; i <= 13; i++) {
        const description = str(f, `s2_row${i}_description`);
        const targetPopulation = str(f, `s2_row${i}_targetPopulation`);
        const supportType = str(f, `s2_row${i}_supportType`);
        const scope = str(f, `s2_row${i}_scope`);
        const startDate = str(f, `s2_row${i}_startDate`);
        const duration = str(f, `s2_row${i}_duration`);
        if (!description && !targetPopulation && !supportType && !scope && !startDate && !duration) {
            continue;
        }
        rows.push({
            index: i,
            description,
            targetPopulation: PP_TARGET_POPULATION_LABELS[targetPopulation] ?? targetPopulation,
            supportType: PP_SUPPORT_TYPE_LABELS[supportType] ?? supportType,
            scope: PP_SCOPE_LABELS[scope] ?? scope,
            startDate,
            duration,
        });
    }
    return rows;
}

interface OutcomeRow {
    label: string;
    current: number;
    outlookDec: number;
    outlookJune: number;
}

function buildOutcomeRows(f: FlatData): OutcomeRow[] {
    const rows: [string, string][] = [
        ['employed', 'Bénéficiaires insérés comme employés / Beneficiaries inserted as employees'],
        ['self_employed', 'Bénéficiaires insérés en auto emploi / Beneficiaries inserted in self-employment'],
        ['jobs_created', 'Emplois créés par les bénéficiaires employeurs / Jobs created by beneficiary employers'],
        ['trained', 'Bénéficiaires formés / Beneficiaries trained'],
    ];
    return rows.map(([slug, label]): OutcomeRow => ({
        label,
        current: int(f, `s3kpi_${slug}_current`),
        outlookDec: int(f, `s3kpi_${slug}_outlook_dec`),
        outlookJune: int(f, `s3kpi_${slug}_outlook_june`),
    }));
}

function buildS2S4ProjectProgram(f: FlatData) {
    return {
        activitiesRows: buildActivityRows(f),
        outcomesRows: buildOutcomeRows(f),
        // S4Q01/S4Q02 — counted (recensé) permanent/temporary
        countedPermanentRows: buildCspAgeRows(f, 'pp_s4q01', CSP_ROWS, CSP_LABELS),
        countedPermanentTotals: buildCspAgeTotals(f, 'pp_s4q01'),
        countedTemporaryRows: buildCspAgeRows(f, 'pp_s4q02', CSP_ROWS, CSP_LABELS),
        countedTemporaryTotals: buildCspAgeTotals(f, 'pp_s4q02'),
        // S4Q03/S4Q04 — recruited (recruté) permanent/temporary
        recruitedPermanentRows: buildCspAgeRows(f, 'pp_s4q03', CSP_ROWS, CSP_LABELS),
        recruitedPermanentTotals: buildCspAgeTotals(f, 'pp_s4q03'),
        recruitedTemporaryRows: buildCspAgeRows(f, 'pp_s4q04', CSP_ROWS, CSP_LABELS),
        recruitedTemporaryTotals: buildCspAgeTotals(f, 'pp_s4q04'),
        // S4Q05 — disability, S4Q06 — vulnerable (both csp_status_gender_
        // table shaped for this entity, unlike the other four entities)
        disabledRecruitmentsRows: buildPermTempRows(f, 'pp_s4q05', CSP_ROWS, CSP_LABELS),
        disabledRecruitmentsTotals: buildPermTempTotals(f, 'pp_s4q05'),
        vulnerableRecruitmentsRows: buildPermTempRows(f, 'pp_s4q06', CSP_ROWS, CSP_LABELS),
        vulnerableRecruitmentsTotals: buildPermTempTotals(f, 'pp_s4q06'),
    };
}

// ─────────────────────────────────────────────
// PUBLIC ENTITY MAPPERS
// ─────────────────────────────────────────────

export function mapEnterpriseData(f: FlatData, quarterCode?: string | null) {
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
        surveyYear: (f['surveyYear'] as number | undefined) ?? surveyYearFromQuarterCode(quarterCode),
        ...collectionPeriodStrings(quarterCode),
        copy: 'Original',
    };
}

export function mapCooperativeData(f: FlatData, quarterCode?: string | null) {
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
        surveyYear: (f['surveyYear'] as number | undefined) ?? surveyYearFromQuarterCode(quarterCode),
        ...collectionPeriodStrings(quarterCode),
        copy: 'Original',
    };
}

export function mapCtdData(f: FlatData, quarterCode?: string | null) {
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
        surveyYear: (f['surveyYear'] as number | undefined) ?? surveyYearFromQuarterCode(quarterCode),
        ...collectionPeriodStrings(quarterCode),
        copy: 'Original',
    };
}

export function mapOngData(f: FlatData, quarterCode?: string | null) {
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
        surveyYear: (f['surveyYear'] as number | undefined) ?? surveyYearFromQuarterCode(quarterCode),
        ...collectionPeriodStrings(quarterCode),
        copy: 'Original',
    };
}

// DOCUMENTED ASSUMPTIONS (unresolved wording discrepancies between the two
// source drafts — see Phase 1 audit): S21Q01's "à ce jour" date clause and
// S4Q02's "de votre administration" vs "des administrations" wording. Not
// silently invented — see onefop_ast.dart's s21q01Administration and
// s4q02Administration for the same documented choices on the frontend
// side; this PDF mapper doesn't hardcode question wording itself (that
// lives in administration.hbs), only the S1 field values.
export function mapAdministrationData(f: FlatData, quarterCode?: string | null) {
    return {
        respondentName: str(f, 'S0Q01'),
        respondentFunction: str(f, 'S0Q02'),
        respondentPhone1: str(f, 'S0Q03_TEL1'),
        respondentPhone2: str(f, 'S0Q03_TEL2'),
        respondentEmail: str(f, 'S0Q03_EMAIL'),
        administrationName: str(f, 'ADMIN_S1Q01'),
        sigle: str(f, 'ADMIN_S1Q02'),
        area: mapArea(f['ADMIN_S1Q03']),
        region: str(f, 'ADMIN_S1Q04_REGION'),
        department: str(f, 'ADMIN_S1Q04_DEPT'),
        subdivision: str(f, 'ADMIN_S1Q04_SUBDIV'),
        locality: str(f, 'ADMIN_S1Q04_LOCALITY'),
        phone1: str(f, 'ADMIN_S1Q05_TEL1'),
        phone2: str(f, 'ADMIN_S1Q05_TEL2'),
        poBox: str(f, 'ADMIN_S1Q05_BP'),
        businessSector: mapSector(f['ADMIN_S1Q06']),
        branchActivity: str(f, 'ADMIN_S1Q07'),
        mainMission: str(f, 'ADMIN_S1Q08'),
        hasProject: mapYesNo(f['ADMIN_S1Q09']),
        projectCount: f['ADMIN_S1Q10'] != null ? String(f['ADMIN_S1Q10']) : '',
        hasSupervisedStructures: mapYesNo(f['ADMIN_S1Q11']),
        supervisedStructureCount: f['ADMIN_S1Q12'] != null ? String(f['ADMIN_S1Q12']) : '',
        ...buildS2S4Administration(f),
        surveyYear: (f['surveyYear'] as number | undefined) ?? surveyYearFromQuarterCode(quarterCode),
        ...collectionPeriodStrings(quarterCode),
        copy: 'Original',
    };
}

// Structural implementation only — bindings are complete (every
// PP_S1Q01-16 field and Section 2/3/4 table has a mapper output and a
// projet-program.hbs reference), but visual fidelity against the source
// PDF (Questionnaire_Projet_et_Programmes.pdf) has not been verified,
// matching the same deferred-visual-QA status Administration's mapper
// carried after its own Phase 1.
export function mapProjectProgramData(f: FlatData, quarterCode?: string | null) {
    return {
        respondentName: str(f, 'S0Q01'),
        respondentFunction: str(f, 'S0Q02'),
        respondentPhone1: str(f, 'S0Q03_TEL1'),
        respondentPhone2: str(f, 'S0Q03_TEL2'),
        respondentEmail: str(f, 'S0Q03_EMAIL'),
        nature: str(f, 'PP_S1Q01'),
        projectProgramName: str(f, 'PP_S1Q02'),
        sigle: str(f, 'PP_S1Q03'),
        personInCharge: str(f, 'PP_S1Q04'),
        area: mapArea(f['PP_S1Q05']),
        region: str(f, 'PP_S1Q06_REGION'),
        department: str(f, 'PP_S1Q06_DEPT'),
        subdivision: str(f, 'PP_S1Q06_SUBDIV'),
        locality: str(f, 'PP_S1Q06_LOCALITY'),
        phone1: str(f, 'PP_S1Q07_TEL1'),
        phone2: str(f, 'PP_S1Q07_TEL2'),
        poBox: str(f, 'PP_S1Q07_BP'),
        businessSector: mapSector(f['PP_S1Q08']),
        branchActivity: str(f, 'PP_S1Q09'),
        mainMission: str(f, 'PP_S1Q10'),
        headOffice: str(f, 'PP_S1Q11'),
        supervisingMinistry: str(f, 'PP_S1Q12'),
        status: str(f, 'PP_S1Q13'),
        stopReason: str(f, 'PP_S1Q14'),
        permanentWorkers: f['PP_S1Q15'] != null ? String(f['PP_S1Q15']) : '',
        vacancies: f['PP_S1Q16'] != null ? String(f['PP_S1Q16']) : '',
        ...buildS2S4ProjectProgram(f),
        surveyYear: (f['surveyYear'] as number | undefined) ?? surveyYearFromQuarterCode(quarterCode),
        ...collectionPeriodStrings(quarterCode),
        copy: 'Original',
    };
}

// ─────────────────────────────────────────────
// VOCATIONAL TRAINING — reads the same flat keys the VT-4 normalizer
// already produces (VT1_1…VT9_4 pass through unchanged; s4q1_licence_male,
// s4q3_row1_specialtyText, s8q8_row1_lastName, etc. are the flat-key
// formats flat-key-normalizer.ts's buildVt*Rows functions already assume
// exist) and shapes them into vocationalTraining.hbs's nested structure.
//
// Row labels, option lists, and diploma/age/education/vulnerable/
// disability/scholarship/infrastructure/furniture row counts below are
// copied verbatim from "QUESTIONNAIIRE FORMATION PROFESSIONNELLE
// 2025_2026.pdf" (read directly, page by page, via pdftotext — not
// invented, not carried over from the design note's prose). Unlike the
// persistence-layer normalizer (which only emits rows/cells the client
// actually sent), every table here always emits its full fixed row set —
// a print-form replica should show blank boxes for unanswered rows, not
// silently omit them.
//
// Three fields (1.10 educationSystem, 1.11 cfpType, 1.13
// nonFunctionalReason) are plain free text in the frozen VT-1 schema —
// VT-2 deliberately did not make them radio/select because no confirmed
// option wording existed at the time. The PDF's option lists are known
// now, but the underlying data is still whatever free text a respondent
// typed, not a constrained value — so these three are rendered as plain
// text in the template (see the "texte libre" fallback there), not
// matched against the option lists that appear here for structural
// completeness only. 1.9 (area) and 1.12 (functionalStatus) get a
// best-effort classifier below since their possible answers are a small,
// guessable set (Urbain/Rural; Fonctionnelle/Non-fonctionnelle/Fermée) —
// still a heuristic on free text, not a real constraint.
// ─────────────────────────────────────────────

function vtBool(f: FlatData, key: string): boolean | undefined {
    const v = f[key];
    if (typeof v === 'boolean') return v;
    if (typeof v !== 'string') return undefined;
    const lv = v.toLowerCase();
    if (lv.includes('oui') || lv.includes('yes')) return true;
    if (lv.includes('non') || lv.includes('no')) return false;
    return undefined;
}

function vtArr(f: FlatData, key: string): string[] {
    const v = f[key];
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === 'string' && v.trim() !== '') return [v];
    return [];
}

function vtAreaKey(f: FlatData, key: string): string {
    const v = f[key];
    if (typeof v !== 'string') return '';
    const lv = v.toLowerCase();
    if (lv.includes('urbain') || lv.includes('urban')) return 'urbain';
    if (lv.includes('rural')) return 'rural';
    return '';
}

function vtSituationKey(f: FlatData, key: string): string {
    const v = f[key];
    if (typeof v !== 'string') return '';
    const lv = v.toLowerCase();
    if (lv.includes('non') && lv.includes('fonc')) return 'non-fonctionnelle';
    if (lv.includes('ferm')) return 'fermee';
    if (lv.includes('fonc')) return 'fonctionnelle';
    return '';
}

function vtClotureKey(f: FlatData, key: string): string {
    const v = f[key];
    if (typeof v !== 'string') return '';
    const lv = v.toLowerCase();
    if (lv.includes('entier')) return 'entierement';
    if (lv.includes('partiel')) return 'partiellement';
    if (lv.includes('non')) return 'non';
    return '';
}

function vtSexKey(f: FlatData, key: string): 'M' | 'F' | '' {
    const v = f[key];
    if (typeof v !== 'string') return '';
    const lv = v.toLowerCase();
    if (lv.startsWith('m') || lv.includes('masculin') || lv.includes('homme')) return 'M';
    if (lv.startsWith('f') || lv.includes('féminin') || lv.includes('feminin') || lv.includes('femme')) return 'F';
    return '';
}

interface VtHF { hommes: string; femmes: string }
interface VtHFT extends VtHF { total: string }

function vtHF(f: FlatData, prefix: string, dim: string): VtHF {
    return { hommes: str(f, `${prefix}_${dim}_male`), femmes: str(f, `${prefix}_${dim}_female`) };
}

function vtWithTotal(hf: VtHF): VtHFT {
    const h = parseInt(hf.hommes, 10) || 0;
    const w = parseInt(hf.femmes, 10) || 0;
    return { ...hf, total: String(h + w) };
}

function vtSumHF(rows: VtHF[]): VtHF {
    let h = 0, w = 0;
    for (const r of rows) { h += parseInt(r.hommes, 10) || 0; w += parseInt(r.femmes, 10) || 0; }
    return { hommes: String(h), femmes: String(w) };
}

// 4.1/4.2/8.1/8.2 diploma tables (fixed rows, PDF-verified labels).
const VT_ACADEMIC_DIPLOMA_ROWS: { key: string; label: string }[] = [
    { key: 'doctorat', label: 'DOCTORAT/PhD' },
    { key: 'master2', label: 'MASTER II/DEA/DESS' },
    { key: 'maitrise', label: 'MAITRISE/MASTER I' },
    { key: 'licence', label: 'LICENCE/ Bachelor' },
    { key: 'deug_dut', label: "DEUG/DUT/ General University Studies Diploma/University Technology Diploma" },
    { key: 'bacc_general', label: 'BACC Général/ General G.C.E "A" LEVEL' },
    { key: 'bacc_technique', label: 'BACC Technique / Technical G.C.E "A" LEVEL' },
    { key: 'probatoire', label: 'PROBATOIRE/ Form 6' },
    { key: 'bepc', label: 'BEPC/G.C.E "O" LEVEL' },
    { key: 'cep', label: 'CEP OU CEPE / F.S.L.C' },
    { key: 'sans_diplome_academique', label: 'Sans diplôme académique/ No Academic qualification' },
];
const VT_PROFESSIONAL_DIPLOMA_ROWS: { key: string; label: string }[] = [
    { key: 'dipleg_dipes2', label: 'DIPLEG, DIPES II/DIPES, CAPES, DIPLET, DIPET II, DIPCO, DIPENI' },
    { key: 'ingenieur_master_pro', label: 'INGENIEUR/MASTER PRO' },
    { key: 'dipceg_dipes1', label: 'DIPCEG, DIPES I/DIPCEG, DIPCET, DIPET I, CAPCEG, DIPENIA, ING TRAVAUX' },
    { key: 'licence_pro', label: "LICENCE PRO / Professionnal Bachelor's degree" },
    { key: 'bts_hnd', label: 'BTS/ HND' },
    { key: 'bep_bp_bacpro', label: 'BEP, BP, BACC PRO, BT/ Professional GCE-A' },
    { key: 'capieg', label: 'CAPIEG, CAPIEMP, CAPI, CAPIET OU EQUIVALENT/ or equivalent certificate' },
    { key: 'capiaeg', label: 'CAPIAEG, CAPIA, CAPIAET OU EQUIVALENT/ or equivalent certificate' },
    { key: 'cap', label: 'CAP/ certificate of professional competence' },
    { key: 'dqp', label: 'DQP/ VQD' },
    { key: 'cqp', label: 'CQP/ VQC' },
    { key: 'autres_pro', label: 'Autres / Others' },
    { key: 'sans_diplome_professionnel', label: 'Sans diplôme professionnel/ No Vocational Qualification' },
];
// 8.8 roster: the PDF's own numeric shorthand for the same 11/12 diploma
// concepts (paper form asks for a written code, not the DB's string
// enum) — "Autres" and "Sans diplôme professionnel" are both printed as
// "12" in the professional list; mapped here by meaning, not by their
// shared printed number (matches the VT-3 constraint given for this).
const VT_ACADEMIC_DIPLOMA_ROSTER_CODE: Record<string, number> = {
    DOCTORAT: 1, MASTER2: 2, MAITRISE: 3, LICENCE: 4, DEUG_DUT: 5, BACC_GENERAL: 6,
    BACC_TECHNIQUE: 7, PROBATOIRE: 8, BEPC: 9, CEP: 10, SANS_DIPLOME_ACADEMIQUE: 11,
};
const VT_PROFESSIONAL_DIPLOMA_ROSTER_CODE: Record<string, number> = {
    DIPLEG_DIPES2: 1, INGENIEUR_MASTER_PRO: 2, DIPCEG_DIPES1: 3, LICENCE_PRO: 4, BTS_HND: 5,
    BEP_BP_BACPRO: 6, CAPIEG: 7, CAPIAEG: 8, CAP: 9, DQP: 10, CQP: 11,
    AUTRES_PRO: 12, SANS_DIPLOME_PROFESSIONNEL: 12,
};
// A printed roster of bare numeric codes is unreadable without the key
// that goes with it on the same page — every other coded field in this
// template prints its own key inline (e.g. "1 = Urbain / Urban"). Built
// from the same *_ROWS label arrays the confirmed 4.1/4.2/8.1/8.2 tables
// already use (so the legend can never drift from those labels) rather
// than a second hardcoded copy of the diploma names.
function vtRosterCodeLegend(
    rows: { key: string; label: string }[],
    codeByEnumKey: Record<string, number>,
): { code: number; label: string }[] {
    const labelsByCode = new Map<number, string[]>();
    for (const r of rows) {
        const code = codeByEnumKey[r.key.toUpperCase()];
        if (code === undefined) continue;
        if (!labelsByCode.has(code)) labelsByCode.set(code, []);
        labelsByCode.get(code)!.push(r.label);
    }
    return Array.from(labelsByCode.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([code, labels]) => ({ code, label: labels.join(' ; ') }));
}
// 8.8's Statut column legend, verified verbatim against table 8.8 of the
// source PDF (p.18): "1=Formateurs vacataires professionnels/Part-time
// vocational trainers", "2=Formateurs vacataires non professionnels/
// Part-time non vocational trainers", "3=FormateursPermanents/Permanent
// trainers" — same order as the confirmed §8.5 three-category breakdown
// (formateursParStatut below), not a separately-invented vocabulary.
const VT_ROSTER_STATUT_LEGEND = [
    { code: 1, label: 'Formateurs vacataires professionnels' },
    { code: 2, label: 'Formateurs vacataires non professionnels' },
    { code: 3, label: 'Formateurs Permanents' },
];

function vtDiplomaTableRows(f: FlatData, prefix: string, rows: { key: string; label: string }[]) {
    return rows.map((r) => ({ label: r.label, ...vtHF(f, prefix, r.key) }));
}

// 4.7 age table (24 rows).
const VT_AGE_BAND_ROWS: { key: string; label: string }[] = [
    { key: 'under_14', label: 'Moins de 14 ans/Less than 14 years old' },
    ...Array.from({ length: 22 }, (_, i) => {
        const age = i + 14;
        return { key: `age_${age}`, label: `${age} ans/years old` };
    }),
    { key: 'above_35', label: 'Supérieur à 35 ans / above 35 years old' },
];
// 8.3 trainer age table (4 rows).
const VT_TRAINER_AGE_BAND_ROWS: { key: string; label: string }[] = [
    { key: 'age_18_24', label: 'De 18 à 24 ans/ From 18 to 24 years' },
    { key: 'age_25_39', label: 'De 25 à 39 ans/ From 25 to 39 years' },
    { key: 'age_40_59', label: 'De 40 à 59 ans/ From 40 to 59 years' },
    { key: 'age_60_plus', label: '60 ans et plus/ 60 years and above' },
];
// 4.8 education level table (8 rows).
const VT_EDUCATION_LEVEL_ROWS: { key: string; label: string }[] = [
    { key: 'non_alphabetise', label: 'Non alphabétisé / Illiterate' },
    { key: 'primaire', label: 'Education primaire/ Primary education' },
    { key: 'premier_cycle_general', label: "Premier cycle de l'enseignement secondaire général/ Lower general secondary education" },
    { key: 'premier_cycle_technique', label: "Premier cycle de l'enseignement secondaire technique/ Lower technical secondary education" },
    { key: 'second_cycle_general', label: "Second cycle de l'enseignement secondaire général/ Upper general secondary education" },
    { key: 'second_cycle_technique', label: "Second cycle de l'enseignement secondaire technique/ Upper technical secondary education" },
    { key: 'enseignement_normal', label: 'Enseignement normal' },
    { key: 'enseignement_superieur', label: 'Enseignement supérieur/ Higher education' },
];
// 4.9 vulnerable-trainee table (11 rows). 8.6 trainer disability table (4 rows).
const VT_VULNERABLE_CATEGORY_ROWS: { key: string; label: string }[] = [
    { key: 'moteur', label: 'Moteur (ou physique) / Mobility (physical) impairment' },
    { key: 'visuel', label: 'Visuel/ Visual impairment' },
    { key: 'auditif', label: 'Auditif/ Hearing impairment' },
    { key: 'polyhandicapes', label: 'Polyhandicapés/ Polyhandicapped' },
    { key: 'refugies', label: 'Refugiés/ Refugees' },
    { key: 'orphelins_vulnerables', label: 'Enfants Orphelins Vulnérables/ Vulnerable orphaned children' },
    { key: 'deplaces_internes', label: 'Déplacés Internes/ Internally displaced people' },
    { key: 'retournes', label: 'Apprenants RETOURNES' },
    { key: 'bororo', label: 'Population autochtone BORORO' },
    { key: 'baka', label: 'Population autochtone BAKA' },
    { key: 'baguieli', label: 'Population autochtone BAGUIELI' },
];
const VT_TRAINER_DISABILITY_ROWS: { key: string; label: string }[] = [
    { key: 'moteur', label: 'Handicap Moteur (ou physique)/ Mobility (physical) impairment' },
    { key: 'visuel', label: 'Handicap Visuel/ Visual impairment' },
    { key: 'auditif', label: 'Handicap Auditif/ Hearing impairment' },
    { key: 'polyhandicapes', label: 'Polyhandicapés/ Polyhandicapped' },
];
// 4.11 scholarship table (2 categories).
const VT_SCHOLARSHIP_ROWS: { key: string; label: string }[] = [
    { key: 'other_admin', label: 'Bourses offertes par autres administrations/ Scholarships offered by other administrations' },
    { key: 'international', label: 'Bourses internationales/ International scholarship' },
];
// 5.3 infrastructure table (9 rows).
const VT_INFRASTRUCTURE_ROWS: { key: string; label: string }[] = [
    { key: 'salle_classe', label: 'Salle de classe/ Classrooms' },
    { key: 'ateliers_pratiques', label: 'Ateliers de pratiques équipés/ Equipped practice workshops' },
    { key: 'laboratoires', label: 'Laboratoires de formation équipés/ Equipped training laboratories' },
    { key: 'blocs_administratifs', label: 'Blocs administratifs/ Administrative blocks' },
    { key: 'salle_reunion', label: 'Salle de réunion/ Meeting halls' },
    { key: 'salle_formateurs', label: "Salle de formateurs/ Trainers' rooms" },
    { key: 'bureaux', label: 'Bureaux/ Offices' },
    { key: 'magasin', label: 'Magasin/ Warehouses' },
    { key: 'espaces_temporaires', label: 'Espaces temporaires/ Temporary spaces' },
];
// 5.4 furniture table — tables-bancs sub-rows (4).
const VT_TABLES_BANCS_ROWS: { key: string; places: string }[] = [
    { key: 'banc_1_place', places: '1 place/ one-seater' },
    { key: 'banc_2_places', places: '2 places/ Two-seaters' },
    { key: 'banc_3_places', places: '3 places/ Three-seaters' },
    { key: 'banc_4_places_plus', places: '4 places et + / For-seaters and more' },
];

// Specialty-row tables sharing OnefopVtSpecialtyRow (4.3/4.4/4.5/8.4:
// FI/FC × gender; 4.10/6.3: male/female/total). Every row 1..N is always
// emitted (blank if unanswered) — a print form shows all printed row
// slots, not just filled ones.
function vtSpecialtyFiFcRows(f: FlatData, prefix: string, count: number) {
    return Array.from({ length: count }, (_, i) => {
        const idx = i + 1;
        return {
            specialite: str(f, `${prefix}_row${idx}_specialtyText`),
            fi: { hommes: str(f, `${prefix}_row${idx}_fiMale`), femmes: str(f, `${prefix}_row${idx}_fiFemale`) },
            fc: { hommes: str(f, `${prefix}_row${idx}_fcMale`), femmes: str(f, `${prefix}_row${idx}_fcFemale`) },
        };
    });
}
function vtSpecialtyGenderTotalRows(f: FlatData, prefix: string, count: number) {
    return Array.from({ length: count }, (_, i) => {
        const idx = i + 1;
        return {
            specialite: str(f, `${prefix}_row${idx}_specialtyText`),
            hommes: str(f, `${prefix}_row${idx}_male`),
            femmes: str(f, `${prefix}_row${idx}_female`),
            total: str(f, `${prefix}_row${idx}_total`),
        };
    });
}

export function mapVocationalTrainingData(f: FlatData, quarterCode?: string | null) {
    const surveyYear = (f['surveyYear'] as number | undefined) ?? surveyYearFromQuarterCode(quarterCode);
    // Best-effort "previous academic year" label for the 4.7/4.10/6.3
    // column headers (PDF prints e.g. "(2024-2025)" alongside a
    // "2025-2026" survey year) — surveyYear is treated as the survey's
    // ending calendar year.
    const previousYearLabel = `${surveyYear - 2}-${surveyYear - 1}`;

    // §4.7 age-flow grid, §4.8 education-level-flow grid, §4.9 vulnerable
    // grid all share the same entrant/sortant/abandon × gender shape.
    const apprenantsParAge = VT_AGE_BAND_ROWS.map((r) => ({
        trancheAge: r.label,
        entrants: vtHF(f, 's4q7', `${r.key}_entrant`),
        sortants: vtHF(f, 's4q7', `${r.key}_sortant`),
        abandons: vtHF(f, 's4q7', `${r.key}_abandon`),
    }));
    const apprenantsParNiveauEtude = VT_EDUCATION_LEVEL_ROWS.map((r) => ({
        niveau: r.label,
        entrants: vtWithTotal(vtHF(f, 's4q8', `${r.key}_entrant`)),
        sortants: vtWithTotal(vtHF(f, 's4q8', `${r.key}_sortant`)),
        abandons: vtWithTotal(vtHF(f, 's4q8', `${r.key}_abandon`)),
    }));
    const apprenantsVulnerabilites = VT_VULNERABLE_CATEGORY_ROWS.map((r) => ({
        type: r.label,
        entrants: vtWithTotal(vtHF(f, 's4q9', `${r.key}_entrant`)),
        sortants: vtWithTotal(vtHF(f, 's4q9', `${r.key}_sortant`)),
        abandons: vtWithTotal(vtHF(f, 's4q9', `${r.key}_abandon`)),
    }));

    const apprenantsParDiplomeAcademique = vtDiplomaTableRows(f, 's4q1', VT_ACADEMIC_DIPLOMA_ROWS);
    const apprenantsParDiplomeProfessionnel = vtDiplomaTableRows(f, 's4q2', VT_PROFESSIONAL_DIPLOMA_ROWS);
    const formateursParDiplomeAcademique = vtDiplomaTableRows(f, 's8q1', VT_ACADEMIC_DIPLOMA_ROWS);
    const formateursParDiplomeProfessionnel = vtDiplomaTableRows(f, 's8q2', VT_PROFESSIONAL_DIPLOMA_ROWS);

    const apprenantsParAnneeEtude = Array.from({ length: 12 }, (_, i) => {
        const idx = i + 1;
        return {
            specialite: str(f, `s4q6_row${idx}_specialtyText`),
            annee1: { hommes: str(f, `s4q6_row${idx}_year1Male`), femmes: str(f, `s4q6_row${idx}_year1Female`) },
            annee2: { hommes: str(f, `s4q6_row${idx}_year2Male`), femmes: str(f, `s4q6_row${idx}_year2Female`) },
        };
    });

    const formateursParTrancheAge = VT_TRAINER_AGE_BAND_ROWS.map((r) => ({ tranche: r.label, ...vtHF(f, 's8q3', r.key) }));

    // §8.5 is six embedded Detail integers (design note: "embedded, not
    // normalized"), not a grid — no s8q5_* flat keys exist for it.
    const vp = { statut: 'Formateurs vacataires professionnels/ Part-time vocational trainers', ...vtHF(f, 'VT8_5_VP', '').hommes !== undefined ? { hommes: str(f, 'VT8_5_VP_M'), femmes: str(f, 'VT8_5_VP_F') } : { hommes: '', femmes: '' } };
    const vnp = { statut: 'Formateurs vacataires non professionnels/ Part-time non vocational trainers', hommes: str(f, 'VT8_5_VNP_M'), femmes: str(f, 'VT8_5_VNP_F') };
    const perm = { statut: 'Formateurs Permanents/ Permanent trainers', hommes: str(f, 'VT8_5_PERM_M'), femmes: str(f, 'VT8_5_PERM_F') };
    const statutTotalH = (parseInt(vp.hommes, 10) || 0) + (parseInt(vnp.hommes, 10) || 0) + (parseInt(perm.hommes, 10) || 0);
    const statutTotalF = (parseInt(vp.femmes, 10) || 0) + (parseInt(vnp.femmes, 10) || 0) + (parseInt(perm.femmes, 10) || 0);
    const formateursParStatut = [
        { ...vp, total: String((parseInt(vp.hommes, 10) || 0) + (parseInt(vp.femmes, 10) || 0)) },
        { ...vnp, total: String((parseInt(vnp.hommes, 10) || 0) + (parseInt(vnp.femmes, 10) || 0)) },
        { ...perm, total: String((parseInt(perm.hommes, 10) || 0) + (parseInt(perm.femmes, 10) || 0)) },
        { statut: 'Total/ Total', hommes: String(statutTotalH), femmes: String(statutTotalF), total: String(statutTotalH + statutTotalF) },
    ];

    const formateursParHandicap = VT_TRAINER_DISABILITY_ROWS.map((r) => {
        const hf = vtHF(f, 's8q6', r.key);
        return { type: r.label, ...vtWithTotal(hf) };
    });

    const apprenantsBourses = VT_SCHOLARSHIP_ROWS.map((r) => ({
        type: r.label,
        octroyee: vtWithTotal(vtHF(f, 's4q11', `${r.key}_granted`)),
        beneficiee: vtWithTotal(vtHF(f, 's4q11', `${r.key}_received`)),
    }));

    const manuelsInfrastructures = VT_INFRASTRUCTURE_ROWS.map((r) => ({
        type: r.label,
        total: str(f, `s5q3_${r.key}_totalCount`),
        bonEtat: str(f, `s5q3_${r.key}_permanentGoodCount`),
        mauvaisEtat: str(f, `s5q3_${r.key}_permanentBadCount`),
        provisoire: str(f, `s5q3_${r.key}_temporaryCount`),
    }));

    const manuelsReferentiels = Array.from({ length: 15 }, (_, i) => {
        const idx = i + 1;
        return {
            specialite: str(f, `s5q2_row${idx}_specialtyText`),
            existe: vtBool(f, `s5q2_row${idx}_hasCurriculum`) === true,
            homologue: vtBool(f, `s5q2_row${idx}_isApproved`) === true,
        };
    });

    // 8.8 roster — 14 rows always emitted; empty-row skipping already
    // happened upstream (VT-4 normalizer / persistence), this is a print
    // replica of whatever rows exist in the raw flat data, same as every
    // other VT table on this page.
    const formateursPersonnel = Array.from({ length: 14 }, (_, i) => {
        const idx = i + 1;
        const academic = str(f, `s8q8_row${idx}_academicDiploma`).toUpperCase();
        const professional = str(f, `s8q8_row${idx}_professionalDiploma`).toUpperCase();
        return {
            id: idx,
            nom: str(f, `s8q8_row${idx}_lastName`),
            prenom: str(f, `s8q8_row${idx}_firstName`),
            sexe: vtSexKey(f, `s8q8_row${idx}_sex`),
            statutCode: str(f, `s8q8_row${idx}_trainerStatus`),
            personnelAdministratif: vtBool(f, `s8q8_row${idx}_isAdminPersonnel`) === true,
            diplomeAcademiqueCode: VT_ACADEMIC_DIPLOMA_ROSTER_CODE[academic] ?? '',
            diplomeProfessionnelCode: VT_PROFESSIONAL_DIPLOMA_ROSTER_CODE[professional] ?? '',
        };
    });

    return {
        surveyYear,
        previousYearLabel,
        ...collectionPeriodStrings(quarterCode),
        copy: 'Original',

        identification: {
            structureCode: str(f, 'VT1_1'),
            nomCFP: str(f, 'VT1_2'),
            sigle: str(f, 'VT1_3'),
            region: { name: str(f, 'VT1_4'), code: '' },
            departement: { name: str(f, 'VT1_5'), code: '' },
            arrondissement: { name: str(f, 'VT1_6'), code: '' },
            commune: str(f, 'VT1_7'),
            villageQuartier: str(f, 'VT1_8'),
            milieu: vtAreaKey(f, 'VT1_9'),
            ordreEnseignement: str(f, 'VT1_10'),
            typeCFP: str(f, 'VT1_11'),
            situation: vtSituationKey(f, 'VT1_12'),
            raisonNonFonctionnelle: str(f, 'VT1_13'),
            raisonAutrePrecision: str(f, 'VT1_13_OTHER'),
            anneeOuverture: str(f, 'VT1_14'),
            respondent: {
                qualite: str(f, 'S0Q02'),
                nomPrenoms: str(f, 'S0Q01'),
                sexe: vtSexKey(f, 'VT1_15_SEX'),
                telephone1: str(f, 'S0Q03_TEL1'),
                telephone2: str(f, 'S0Q03_TEL2'),
            },
            promoteur: {
                nomPrenoms: str(f, 'VT1_16_NAME'),
                sexe: vtSexKey(f, 'VT1_16_SEX'),
                telephone1: str(f, 'VT1_16_TEL1'),
                telephone2: str(f, 'VT1_16_TEL2'),
                email: str(f, 'VT1_16_EMAIL'),
            },
        },
        // Structural only for 1.10/1.11/1.13 — see the block comment above
        // this section; the template shows the raw free text for these,
        // not a checkbox match against these lists.
        ordreEnseignementOptions: [
            { value: 'public', label: '1. Public/ Public' },
            { value: 'prive_laic', label: '2. Privé laïc/ Lay private' },
            { value: 'prive_confessionnel', label: '3. Privé confessionnel/ Private denominational' },
        ],
        typeCFPOptions: [
            { value: 'sar_sm', label: '1. SAR/SM/ RA/HECs' },
            { value: 'cfpr', label: '2. Centre de Formation Professionnelle Rapide (CFPR)/ Intensive Vocational Training Centre (IVTC)' },
            { value: 'cfpp', label: '3. Centre de Formation Professionnelle Privé (CFPP)/ Private Vocational Training Centre (PVTC)' },
            { value: 'cfm', label: '4. Centre de Formation aux Métiers (CFM)/ Trades Training Centre (TTC)' },
            { value: 'cfpe', label: "5. Centre de Formation Professionnelle d'Excellence (CFPE)/ Advanced Vocational Training Centre (AVTC)" },
            { value: 'cfps', label: '6. Centre de Formation Professionnelle Sectorielles (CFPS)/ Sectoral Vocational Training Centre (SVTC)' },
            { value: 'cnffdp', label: '7. Centre National de Formation des Formateurs et de Développement des Programmes (CNFFDP)/ National Institute of Vocational Trainers and Programme Development (NIVTPD)' },
        ],
        raisonNonFonctionnelleOptions: [
            { value: 'manque_apprenants', label: "1. Manque d'apprenants/Lack of trainees" },
            { value: 'manque_formateur', label: '2. Manque de formateur/Lack of trainers' },
            { value: 'insecurite', label: "3. Raison d'insécurité / Insecurity" },
            { value: 'agrement_invalide', label: '4. Agrément non valide/ Invalid accreditation' },
            { value: 'autres', label: '5. Autres (à préciser) / Others (specify)' },
        ],

        general: {
            conventionEtat: vtBool(f, 'VT2_1'),
            conventionTypes: vtArr(f, 'VT2_2'),
            nombreSites: str(f, 'VT2_3'),
            infrastructureCommune: vtBool(f, 'VT2_4'),
            etablissementPartageNom: str(f, 'VT2_5'),
            formateursBesoinsSpeciaux: vtBool(f, 'VT2_6'),
            effectifFormateursSpeciaux: { total: str(f, 'VT2_7'), femmes: str(f, 'VT2_8') },
            rampesAcces: vtBool(f, 'VT2_9'),
            bureauDirecteur: vtBool(f, 'VT2_10'),
            boitePostale: str(f, 'VT2_11'),
            ville: '',
            email: str(f, 'VT2_12'),
            siteWeb: str(f, 'VT2_13'),
            agree: vtBool(f, 'VT2_14'),
            anneeAgrement: str(f, 'VT2_15'),
            arreteNumero: str(f, 'VT2_16'),
            arreteDate: str(f, 'VT2_17'),
            typesFormation: vtArr(f, 'VT2_18'),
            totalApprenants: str(f, 'VT2_19'),
            totalFormateurs: str(f, 'VT2_20'),
            apprenantsPremierCycle: str(f, 'VT2_21'),
            apprenantsSecondCycle: str(f, 'VT2_22'),
            energie: { disponible: vtBool(f, 'VT2_23'), fonctionnelle: vtBool(f, 'VT2_24'), sources: vtArr(f, 'VT2_25') },
            eau: { disponible: vtBool(f, 'VT2_26'), sources: vtArr(f, 'VT2_27') },
            lavageMains: vtBool(f, 'VT2_28'),
            campagneSante: vtBool(f, 'VT2_29'),
            boitePharmacie: vtBool(f, 'VT2_30'),
            infirmerie: vtBool(f, 'VT2_31'),
            bibliotheque: vtBool(f, 'VT2_32'),
            cloture: vtClotureKey(f, 'VT2_33'),
            conseilEtablissement: vtBool(f, 'VT2_34'),
            conseilNiveau: vtBool(f, 'VT2_35'),
            conseilDiscipline: vtBool(f, 'VT2_36'),
            latrines: {
                fonctionnelles: vtBool(f, 'VT2_37'),
                types: vtArr(f, 'VT2_38'),
                blocFillesDistinct: vtBool(f, 'VT2_39'),
                elevesFormateursSepares: vtBool(f, 'VT2_40'),
            },
            airesJeux: { disponible: vtBool(f, 'VT2_41'), types: vtArr(f, 'VT2_42') },
            ict: { disponible: vtBool(f, 'VT2_43'), nombre: str(f, 'VT2_44'), nombreConnecte: str(f, 'VT2_45') },
            formationTIC: { recue: vtBool(f, 'VT2_46'), total: str(f, 'VT2_47'), femmes: str(f, 'VT2_48') },
            formationViolences: vtBool(f, 'VT2_49'),
            formationPSS: vtBool(f, 'VT2_50'),
            internat: vtBool(f, 'VT2_51'),
            dispositifVBG: vtBool(f, 'VT2_52'),
            cantine: vtBool(f, 'VT2_53'),
        },
        conventionTypeOptions: [
            { value: 'stage_academique', label: '1. Stage académique/ academic internship' },
            { value: 'stage_professionnel', label: '2. Stage professionnel/ work placement' },
            { value: 'stage_pre_emploi', label: '3. Stage pré emploi/ pre-employment internship' },
            { value: 'insertion', label: '4. Insertion/ Insertion' },
        ],
        energieSourceOptions: [
            { value: 'eneo', label: 'ENEO' },
            { value: 'groupe_electrogene', label: 'Groupe électrogène / Generator' },
            { value: 'solaire', label: 'Solaire / Solar' },
        ],
        eauSourceOptions: [
            { value: 'camwater', label: 'CAMWATER / Tap Water' },
            { value: 'puits', label: 'Puits / Well' },
            { value: 'forage', label: 'Forage / Bore-hole' },
            { value: 'source_amenagee', label: 'Source aménagée / Spring' },
            { value: 'marigot', label: 'Marigot / Pool' },
        ],
        latrineTypeOptions: [
            { value: 'wc_chasse', label: "WC avec chasse d'eau / Flushing toilet" },
            { value: 'latrines_amenagees', label: 'Latrines aménagées / Equipped toilets' },
            { value: 'latrines_non_amenagees', label: 'Latrines non aménagées / Unequipped toilets' },
        ],
        aireJeuxTypeOptions: [
            { value: 'football', label: 'Terrain de football / Football' },
            { value: 'handball', label: 'Terrain de handball / Handball' },
            { value: 'saut_hauteur', label: 'Plateau de saut en hauteur / High jump' },
            { value: 'basketball', label: 'Terrain de basketball / Basketball' },
            { value: 'volleyball', label: 'Terrain de volleyball / Volleyball' },
        ],

        urgence: {
            crise: {
                subie: vtBool(f, 'VT3_1'),
                types: vtArr(f, 'VT3_2'),
                fermetureProvisoire: vtBool(f, 'VT3_3'),
                dureeFermetureSemaines: str(f, 'VT3_4'),
            },
            siteDeplace: { deplace: vtBool(f, 'VT3_5'), localite: str(f, 'VT3_6') },
            reaffectation: { effectuee: vtBool(f, 'VT3_7'), lesquels: str(f, 'VT3_8') },
            alertePrecoce: { existe: vtBool(f, 'VT3_9'), description: str(f, 'VT3_10'), aJour: vtBool(f, 'VT3_11') },
            securisation: { dossiersApprenants: vtBool(f, 'VT3_27'), manuelsScolaires: vtBool(f, 'VT3_28') },
            planContingence: vtBool(f, 'VT3_29'),
            apprenantsFormesProtection: vtBool(f, 'VT3_30'),
        },
        typeCriseOptions: [
            { value: 'attaque_etablissement', label: "Attaque contre l'établissement/Attack on the School" },
            { value: 'attaque_eleves_personnel', label: 'Attaque contre des élèves et personnels / Attack on students and staff' },
            { value: 'utilisation_militaire', label: "Utilisation militaire de l'établissement/Military use of the school" },
            { value: 'mouvements_sociaux', label: 'Mouvements sociaux/ Social movements' },
            { value: 'endemie_epidemie', label: 'Endémie/épidémie/pandémie/Endemic/epidemic/pandemic' },
            { value: 'inondation', label: 'Inondation/Flood' },
            { value: 'secheresse', label: 'Sécheresse / Drought' },
            { value: 'tempetes', label: 'Tempêtes /Storms' },
            { value: 'glissement_terrain', label: 'Glissement de Terrain / Landslide' },
            { value: 'incendies', label: 'Incendies /Fires' },
        ],
        // §3.5-3.9 — five fixed Detail booleans+counts (design note),
        // not a grid; the printed capacities/labels below are copied from
        // the PDF, not invented.
        formationUrgenceRows: [
            {
                code: '3.5',
                label: 'Formateurs formés aux approches pédagogiques innovantes / trainers trained in innovative teaching approaches',
                formee: vtBool(f, 'VT3_12'), hommes: str(f, 'VT3_13'), femmes: str(f, 'VT3_14'),
            },
            {
                code: '3.6',
                label: 'Formateurs formés aux approches pédagogiques adaptées aux crises / trained on educational approaches adapted to crises',
                formee: vtBool(f, 'VT3_15'), hommes: str(f, 'VT3_16'), femmes: str(f, 'VT3_17'),
            },
            {
                code: '3.7',
                label: 'Formateurs formés sur la réduction et gestion des risques de catastrophe / Disaster Risk Reduction and Management (DRRM)',
                formee: vtBool(f, 'VT3_18'), hommes: str(f, 'VT3_19'), femmes: str(f, 'VT3_20'),
            },
            {
                code: '3.8',
                label: "Formateurs formés sur la réalisation des simulations et exercices pratiques d'évacuation",
                formee: vtBool(f, 'VT3_21'), hommes: str(f, 'VT3_22'), femmes: str(f, 'VT3_23'),
            },
            {
                code: '3.9',
                label: "Formateurs formés sur d'autres aspects d'éducation en situation d'urgence",
                formee: vtBool(f, 'VT3_24'), hommes: str(f, 'VT3_25'), femmes: str(f, 'VT3_26'),
            },
        ],

        apprenants: {
            parDiplomeAcademique: apprenantsParDiplomeAcademique,
            parDiplomeAcademiqueTotal: vtSumHF(apprenantsParDiplomeAcademique),
            parDiplomeProfessionnel: apprenantsParDiplomeProfessionnel,
            parDiplomeProfessionnelTotal: vtSumHF(apprenantsParDiplomeProfessionnel),
            nonOccupesParSpecialite: vtSpecialtyFiFcRows(f, 's4q3', 12),
            secteurInformelParSpecialite: vtSpecialtyFiFcRows(f, 's4q4', 12),
            parSpecialite: vtSpecialtyFiFcRows(f, 's4q5', 12),
            parAnneeEtude: apprenantsParAnneeEtude,
            parAnneeEtudeTotal: {
                annee1: vtSumHF(apprenantsParAnneeEtude.map((r) => r.annee1)),
                annee2: vtSumHF(apprenantsParAnneeEtude.map((r) => r.annee2)),
            },
            parAge: apprenantsParAge,
            parAgeTotal: {
                entrants: vtSumHF(apprenantsParAge.map((r) => r.entrants)),
                sortants: vtSumHF(apprenantsParAge.map((r) => r.sortants)),
                abandons: vtSumHF(apprenantsParAge.map((r) => r.abandons)),
            },
            parNiveauEtude: apprenantsParNiveauEtude,
            vulnerabilites: apprenantsVulnerabilites,
            sortantsParSpecialite: vtSpecialtyGenderTotalRows(f, 's4q10', 10),
            bourses: apprenantsBourses,
        },

        manuels: {
            pourApprenants: { disponible: vtBool(f, 'VT5_1'), nombre: str(f, 'VT5_2') },
            pourFormateurs: { disponible: vtBool(f, 'VT5_3'), nombre: str(f, 'VT5_4') },
            referentiels: manuelsReferentiels,
            infrastructures: manuelsInfrastructures,
            mobilier: {
                tablesBancs: VT_TABLES_BANCS_ROWS.map((r) => ({
                    places: r.places,
                    bonEtat: str(f, `s5q4_${r.key}_goodCount`),
                    mauvaisEtat: str(f, `s5q4_${r.key}_badCount`),
                })),
                chaisesFormateurs: { bonEtat: str(f, 's5q4_chaises_formateurs_goodCount'), mauvaisEtat: str(f, 's5q4_chaises_formateurs_badCount') },
                tablesFormateurs: { bonEtat: str(f, 's5q4_tables_formateurs_goodCount'), mauvaisEtat: str(f, 's5q4_tables_formateurs_badCount') },
                armoires: { bonEtat: str(f, 's5q4_armoires_goodCount'), mauvaisEtat: str(f, 's5q4_armoires_badCount') },
                tableaux: { bonEtat: str(f, 's5q4_tableaux_goodCount'), mauvaisEtat: str(f, 's5q4_tableaux_badCount') },
            },
        },

        orientation: {
            serviceExiste: vtBool(f, 'VT6_1'),
            moments: vtArr(f, 'VT6_2'),
            // 6.1.2 — two Detail booleans sharing one printed code (design
            // note Decision 4, frozen).
            choixAvecService: vtBool(f, 'VT6_3'),
            collaborationCIOP: vtBool(f, 'VT6_4'),
            accompagnements: vtArr(f, 'VT6_5'),
            accompagnementAutrePrecision: str(f, 'VT6_6'),
            suiviPostFormation: { effectue: vtBool(f, 'VT6_7'), mecanismes: vtArr(f, 'VT6_8') },
            celluleInsertion: vtBool(f, 'VT6_10'),
            outilGestionBDD: vtBool(f, 'VT6_11'),
            outilAccompagnementEmploi: vtBool(f, 'VT6_12'),
            sortantsInseresParSpecialite: vtSpecialtyGenderTotalRows(f, 's6q3', 10),
        },
        momentOrientationOptions: [
            { value: 'avant', label: '1. Avant la formation/ Before training' },
            { value: 'pendant', label: '2. Pendant la formation/ During the training' },
            { value: 'apres', label: '3. Après la formation/ After the training' },
        ],
        accompagnementOptions: [
            { value: 'impregnation', label: "1. Orientation d'imprégnation/ impregnation orientation" },
            { value: 'consolidation', label: '2. Orientation de consolidation/ Consolidation orientation' },
            { value: 'insertion', label: "3. Orientation d'insertion/ Insertion orientation" },
            { value: 'suivi_post_formation', label: '4. Suivi post-formation/ Post-training follow-up' },
            { value: 'autres', label: '5. Autres / Others' },
        ],
        mecanismeSuiviOptions: [
            { value: 'telephonique', label: '1. Téléphonique/ Telephone' },
            { value: 'email', label: '2. Email/ Email address' },
            { value: 'contact_direct', label: '3. Contact direct/ Direct contact' },
            { value: 'autres', label: '4. Autres / Others' },
        ],

        transversal: {
            reglementVIH: {
                integre: vtBool(f, 'VT7_1'),
                securitePhysique: vtBool(f, 'VT7_2'),
                stigmatisationVIH: vtBool(f, 'VT7_3'),
                stigmatisationAutre: vtBool(f, 'VT7_4'),
                harcelement: vtBool(f, 'VT7_5'),
            },
            proceduresDisciplinaires: vtBool(f, 'VT7_6'),
            partiesPrenantesInformees: [
                { categorie: 'Élèves / Pupils', informee: vtArr(f, 'VT7_7').length > 0, modeCommunication: vtArr(f, 'VT7_7').join(', ') },
                { categorie: 'Personnel Enseignant / Teaching staff', informee: vtArr(f, 'VT7_8').length > 0, modeCommunication: vtArr(f, 'VT7_8').join(', ') },
                { categorie: 'Personnel Non Enseignant / Non teaching staff', informee: vtArr(f, 'VT7_9').length > 0, modeCommunication: vtArr(f, 'VT7_9').join(', ') },
                { categorie: 'Parents/Tuteurs / Parents/Guardians', informee: vtArr(f, 'VT7_10').length > 0, modeCommunication: vtArr(f, 'VT7_10').join(', ') },
                { categorie: "Conseil d'établissement/ School council", informee: vtArr(f, 'VT7_11').length > 0, modeCommunication: vtArr(f, 'VT7_11').join(', ') },
            ],
            priseEnCompteIST: vtBool(f, 'VT7_12'),
            // No 7.3 anywhere — the printed instrument's own numbering
            // jumps 7.2 → 7.4 (design note Decision 4, confirmed against
            // the PDF directly this session).
            educationSexuelleVIH: {
                dispensee: vtBool(f, 'VT7_13'),
                themes: [
                    {
                        theme: 'Enseignement des compétences génériques pour la vie courante / Development of everyday generic skills',
                        programmeOfficiel: vtBool(f, 'VT7_14') === true,
                        activitesPeriscolaires: vtBool(f, 'VT7_15') === true,
                    },
                    {
                        theme: 'Éducation à la santé reproductive et sexuelle / Health and reproduction education',
                        programmeOfficiel: vtBool(f, 'VT7_16') === true,
                        activitesPeriscolaires: vtBool(f, 'VT7_17') === true,
                    },
                    {
                        theme: 'Enseignement relatif à la transmission et à la prévention du VIH / Classes on HIV transmission and prevention',
                        programmeOfficiel: vtBool(f, 'VT7_18') === true,
                        activitesPeriscolaires: vtBool(f, 'VT7_19') === true,
                    },
                ],
            },
            formateursFormesEtDispensent: vtBool(f, 'VT7_20'),
            enseignementRetransmis: vtBool(f, 'VT7_21'),
            sessionsParents: vtBool(f, 'VT7_22'),
        },

        formateurs: {
            parDiplomeAcademique: formateursParDiplomeAcademique,
            parDiplomeAcademiqueTotal: vtSumHF(formateursParDiplomeAcademique),
            parDiplomeProfessionnel: formateursParDiplomeProfessionnel,
            parDiplomeProfessionnelTotal: vtSumHF(formateursParDiplomeProfessionnel),
            parTrancheAge: formateursParTrancheAge,
            parTrancheAgeTotal: vtSumHF(formateursParTrancheAge),
            parSpecialite: vtSpecialtyFiFcRows(f, 's8q4', 10),
            parStatut: formateursParStatut,
            parHandicap: formateursParHandicap,
            capaciteAccueil: Array.from({ length: 10 }, (_, i) => {
                const idx = i + 1;
                return {
                    specialite: str(f, `s8q7_row${idx}_specialtyText`),
                    fi: str(f, `s8q7_row${idx}_fiCount`),
                    fc: str(f, `s8q7_row${idx}_fcCount`),
                };
            }),
            personnel: formateursPersonnel,
            legendeStatut: VT_ROSTER_STATUT_LEGEND,
            legendeDiplomeAcademique: vtRosterCodeLegend(VT_ACADEMIC_DIPLOMA_ROWS, VT_ACADEMIC_DIPLOMA_ROSTER_CODE),
            legendeDiplomeProfessionnel: vtRosterCodeLegend(VT_PROFESSIONAL_DIPLOMA_ROWS, VT_PROFESSIONAL_DIPLOMA_ROSTER_CODE),
        },

        difficultes: {
            rencontrees: vtBool(f, 'VT9_1'),
            types: vtArr(f, 'VT9_2'),
            autresPrecisions: vtArr(f, 'VT9_3'),
            perspectives: vtArr(f, 'VT9_4'),
        },
        difficulteOptions: [
            { value: 'insuffisance_equipements', label: '1. Insuffisances d\'équipements de formation / Insufficient number of training equipment' },
            { value: 'cout_formation', label: '2. Coût de la formation / Training cost' },
            { value: 'difficultes_stage', label: '3. Difficultés de stage pour les apprenants / Internship difficulties faced by trainees' },
            { value: 'insuffisance_personnel', label: '4. Insuffisance du personnel enseignant / Insufficient number of trainers' },
            { value: 'faible_effectif', label: "5. Faible effectif d'apprenants / Insufficient number of trainees" },
            { value: 'insecurite', label: '6. Insécurité/ Insecurty' },
        ],
    };
}

// ─────────────────────────────────────────────
// DIAGNOSTIC HELPER  (dev / debug only)
// ─────────────────────────────────────────────

const ENTITY_EXPECTED_KEYS: Record<EntityType, string[]> = {
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
    administration: [
        'ADMIN_S1Q01', 'ADMIN_S1Q02', 'ADMIN_S1Q03',
        'ADMIN_S1Q04_REGION', 'ADMIN_S1Q04_DEPT', 'ADMIN_S1Q04_SUBDIV', 'ADMIN_S1Q04_LOCALITY',
        'ADMIN_S1Q05_TEL1', 'ADMIN_S1Q05_TEL2', 'ADMIN_S1Q05_BP',
        'ADMIN_S1Q06', 'ADMIN_S1Q07', 'ADMIN_S1Q08', 'ADMIN_S1Q09', 'ADMIN_S1Q10',
        'ADMIN_S1Q11', 'ADMIN_S1Q12',
    ],
    projectProgram: [
        'PP_S1Q01', 'PP_S1Q02', 'PP_S1Q03', 'PP_S1Q04', 'PP_S1Q05',
        'PP_S1Q06_REGION', 'PP_S1Q06_DEPT', 'PP_S1Q06_SUBDIV', 'PP_S1Q06_LOCALITY',
        'PP_S1Q07_TEL1', 'PP_S1Q07_TEL2', 'PP_S1Q07_BP',
        'PP_S1Q08', 'PP_S1Q09', 'PP_S1Q10', 'PP_S1Q11', 'PP_S1Q12',
        'PP_S1Q13', 'PP_S1Q14', 'PP_S1Q15', 'PP_S1Q16',
    ],
    vocationalTraining: [
        'VT1_1', 'VT1_2', 'VT1_3', 'VT1_4', 'VT1_5', 'VT1_6', 'VT1_7', 'VT1_8',
        'VT1_9', 'VT1_10', 'VT1_11', 'VT1_12', 'VT1_14',
        'VT1_15_NAME', 'VT1_15_FUNCTION',
    ],
};

const BASE_EXPECTED_KEYS: string[] = [
    'S0Q01', 'S0Q02', 'S0Q03_TEL1', 'S0Q03_TEL2', 'S0Q03_EMAIL',
];

export function diagnoseMappingKeys(f: FlatData, entityType: EntityType = 'cooperative'): void {
    const keys = new Set(Object.keys(f));
    const expected = [...BASE_EXPECTED_KEYS, ...ENTITY_EXPECTED_KEYS[entityType]];
    const missing = expected.filter(k => !keys.has(k));

    console.log('\n🔍 ===== KEY DIAGNOSTIC =====');
    console.log(`Entity type : ${entityType}`);
    if (missing.length === 0) {
        console.log('✅ All expected S0/S1 keys present');
    } else {
        console.log(`❌ ${missing.length} keys MISSING:`);
        missing.forEach(k => console.log(`   ❌ ${k}`));
    }
    console.log('🔍 ===========================\n');
}

export default {};