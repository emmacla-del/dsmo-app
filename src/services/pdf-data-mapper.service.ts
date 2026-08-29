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
type EntityType = 'enterprise' | 'cooperative' | 'ctd' | 'ong' | 'administration' | 'projectProgram';
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