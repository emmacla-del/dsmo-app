// src/services/pdf-data-mapper.service.ts
//
// ─── REFACTOR NOTES ───────────────────────────────────────────────────────────
//
// This version contains ZERO computation.
// Flutter's TableCalculator already computed every row total, column total,
// and grand total before sending. This mapper's only job is to reshape the
// flat key-value payload into the nested/array structure that Handlebars needs.
//
// Every value is a direct read from a flat key. Nothing is summed or derived.
//
// Key pattern reference (from TableCalculator):
//
//   CSP × Age:
//     cell        → <prefix>_<row>_<gender>_<age>        e.g. s21q01_cadres_male_15_24
//     row total   → <prefix>_<row>_<gender>_total        e.g. s21q01_cadres_male_total
//     total col   → <prefix>_<row>_total_<age>           e.g. s21q01_cadres_total_15_24
//     row grand   → <prefix>_<row>_total_total           e.g. s21q01_cadres_total_total
//     col total   → <prefix>_total_<gender>_<age>        e.g. s21q01_total_male_15_24
//     col g.total → <prefix>_total_<gender>_total        e.g. s21q01_total_male_total
//     grand col   → <prefix>_total_total_<age>           e.g. s21q01_total_total_15_24
//     grand total → <prefix>_total_total_total           e.g. s21q01_total_total_total
//
//   CSP × Status × Gender:
//     cell        → <prefix>_<row>_<status>_<gender>     e.g. s22q04_cadres_permanent_male
//     row s.total → <prefix>_<row>_<status>_total        e.g. s22q04_cadres_permanent_total
//     row total   → <prefix>_<row>_total_<gender>        e.g. s22q04_cadres_total_male
//     col total   → <prefix>_total_<status>_<gender>     e.g. s22q04_total_permanent_male
//     grand total → <prefix>_total_total_<gender>        e.g. s22q04_total_total_male
//
//   Departure:
//     cell        → <prefix>_<row>_<type>_<gender>       e.g. s3q01_cadres_dismissal_male
//     row total   → <prefix>_<row>_<type>_total          e.g. s3q01_cadres_dismissal_total
//     ensemble    → <prefix>_<row>_ensemble_<gender>     e.g. s3q01_cadres_ensemble_male
//     col total   → <prefix>_total_<type>_<gender>       e.g. s3q01_total_dismissal_male
//
//   Internship:
//     cell        → <prefix>_<row>_<gender>              e.g. s4q01_vacation_male
//     row total   → <prefix>_<row>_total                 e.g. s4q01_vacation_total
//     col total   → <prefix>_total_<gender>              e.g. s4q01_total_male
//
//   Skills / Training / Reasons:
//     cell        → <prefix>_<row>_<gender>              e.g. s4q02_skill_1_male
//     row total   → <prefix>_<row>_total                 e.g. s4q02_skill_1_total
//     col total   → <prefix>_total_<gender>              e.g. s4q02_total_male
//
//   First-time workers (S23Q02):
//     cell        → <prefix>_<contract>_<row>_<gender>_<age>
//     row total   → <prefix>_<contract>_<row>_<gender>_total
//     total col   → <prefix>_<contract>_<row>_total_<age>
//     row grand   → <prefix>_<contract>_<row>_total_total
//     subtotal    → <prefix>_<contract>_subtotal_<gender>_<age>
//     sub total   → <prefix>_<contract>_subtotal_<gender>_total
//     sub g.col   → <prefix>_<contract>_subtotal_total_<age>
//     sub grand   → <prefix>_<contract>_subtotal_total_total

// ─── Types ────────────────────────────────────────────────────────────────────

type F = Record<string, unknown>;

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Read an integer from the flat payload, defaulting to 0. */
function int(f: F, key: string): number {
    const v = f[key];
    if (typeof v === 'number') return v;
    if (v === undefined || v === null || v === '') return 0;
    const n = parseInt(String(v), 10);
    return isNaN(n) ? 0 : n;
}

/** Read a string from the flat payload, defaulting to ''. */
function str(f: F, key: string): string {
    const v = f[key];
    return v !== undefined && v !== null ? String(v) : '';
}

// ─── CSP × Age builders ───────────────────────────────────────────────────────

const CSP_ROWS = ['cadres', 'foremen', 'workers'] as const;
const AGE_BANDS = ['15_24', '25_34', '35_plus'] as const;
const AGE_KEYS = ['age15_24', 'age25_34', 'age35plus'] as const;

const CSP_LABELS: Record<string, string> = {
    cadres: 'Cadres / Managers',
    foremen: 'Agents de maîtrise / Foremen',
    workers: 'Ouvriers / Workers',
};

function buildCspAgeRows(f: F, prefix: string): any[] {
    return CSP_ROWS.map(row => ({
        label: CSP_LABELS[row],
        male: {
            age15_24: int(f, `${prefix}_${row}_male_15_24`),
            age25_34: int(f, `${prefix}_${row}_male_25_34`),
            age35plus: int(f, `${prefix}_${row}_male_35_plus`),
            total: int(f, `${prefix}_${row}_male_total`),
        },
        female: {
            age15_24: int(f, `${prefix}_${row}_female_15_24`),
            age25_34: int(f, `${prefix}_${row}_female_25_34`),
            age35plus: int(f, `${prefix}_${row}_female_35_plus`),
            total: int(f, `${prefix}_${row}_female_total`),
        },
        total: {
            age15_24: int(f, `${prefix}_${row}_total_15_24`),
            age25_34: int(f, `${prefix}_${row}_total_25_34`),
            age35plus: int(f, `${prefix}_${row}_total_35_plus`),
            total: int(f, `${prefix}_${row}_total_total`),
        },
    }));
}

function buildCspAgeTotals(f: F, prefix: string): any {
    // DEBUG
    console.log(`\n🔍 buildCspAgeTotals(${prefix}):`);
    console.log(`   ${prefix}_total_total_total =`, f[`${prefix}_total_total_total`]);
    console.log(`   ${prefix}_total_male_total =`, f[`${prefix}_total_male_total`]);
    const matchingKeys = Object.keys(f).filter(k => k.startsWith(`${prefix}_total`));
    console.log(`   Matching keys (${matchingKeys.length}):`, matchingKeys);

    return {
        label: 'TOTAL',
        male: {
            age15_24: int(f, `${prefix}_total_male_15_24`),
            age25_34: int(f, `${prefix}_total_male_25_34`),
            age35plus: int(f, `${prefix}_total_male_35_plus`),
            total: int(f, `${prefix}_total_male_total`),
        },
        female: {
            age15_24: int(f, `${prefix}_total_female_15_24`),
            age25_34: int(f, `${prefix}_total_female_25_34`),
            age35plus: int(f, `${prefix}_total_female_35_plus`),
            total: int(f, `${prefix}_total_female_total`),
        },
        total: {
            age15_24: int(f, `${prefix}_total_total_15_24`),
            age25_34: int(f, `${prefix}_total_total_25_34`),
            age35plus: int(f, `${prefix}_total_total_35_plus`),
            total: int(f, `${prefix}_total_total_total`),
        },
    };
}

// ─── Diploma builder ──────────────────────────────────────────────────────────

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

function buildDiplomaRows(f: F, prefix: string): any[] {
    return DIPLOMA_MAP.map(([slug, label]) => ({
        label,
        male: {
            age15_24: int(f, `${prefix}_${slug}_male_15_24`),
            age25_34: int(f, `${prefix}_${slug}_male_25_34`),
            age35plus: int(f, `${prefix}_${slug}_male_35_plus`),
            total: int(f, `${prefix}_${slug}_male_total`),
        },
        female: {
            age15_24: int(f, `${prefix}_${slug}_female_15_24`),
            age25_34: int(f, `${prefix}_${slug}_female_25_34`),
            age35plus: int(f, `${prefix}_${slug}_female_35_plus`),
            total: int(f, `${prefix}_${slug}_female_total`),
        },
        total: {
            age15_24: int(f, `${prefix}_${slug}_total_15_24`),
            age25_34: int(f, `${prefix}_${slug}_total_25_34`),
            age35plus: int(f, `${prefix}_${slug}_total_35_plus`),
            total: int(f, `${prefix}_${slug}_total_total`),
        },
    }));
}

// Diploma totals reuse the same key pattern as CSP age totals
function buildDiplomaTotals(f: F, prefix: string): any {
    return buildCspAgeTotals(f, prefix);
}

// ─── Perm/Temp × CSP builder ──────────────────────────────────────────────────

function buildPermTempRows(f: F, prefix: string, rows: string[], labels: Record<string, string>): any[] {
    return rows.map(row => ({
        label: labels[row] ?? row,
        permanent: {
            male: int(f, `${prefix}_${row}_permanent_male`),
            female: int(f, `${prefix}_${row}_permanent_female`),
            total: int(f, `${prefix}_${row}_permanent_total`),
        },
        temporary: {
            male: int(f, `${prefix}_${row}_temporary_male`),
            female: int(f, `${prefix}_${row}_temporary_female`),
            total: int(f, `${prefix}_${row}_temporary_total`),
        },
        total: {
            male: int(f, `${prefix}_${row}_total_male`),
            female: int(f, `${prefix}_${row}_total_female`),
            total: int(f, `${prefix}_${row}_total_total`),
        },
    }));
}

function buildPermTempTotals(f: F, prefix: string): any {
    return {
        label: 'TOTAL',
        permanent: {
            male: int(f, `${prefix}_total_permanent_male`),
            female: int(f, `${prefix}_total_permanent_female`),
            total: int(f, `${prefix}_total_permanent_total`),
        },
        temporary: {
            male: int(f, `${prefix}_total_temporary_male`),
            female: int(f, `${prefix}_total_temporary_female`),
            total: int(f, `${prefix}_total_temporary_total`),
        },
        total: {
            male: int(f, `${prefix}_total_total_male`),
            female: int(f, `${prefix}_total_total_female`),
            total: int(f, `${prefix}_total_total_total`),
        },
    };
}

// ─── Departure builder ────────────────────────────────────────────────────────

const DEPARTURE_TYPES = ['dismissal', 'resignation', 'retirement', 'other', 'ensemble'] as const;
const DEPARTURE_KEYS = ['dismissals', 'resignations', 'retirements', 'others', 'ensemble'] as const;

function buildDepartureRows(f: F, prefix: string): any[] {
    return CSP_ROWS.map(row => ({
        label: CSP_LABELS[row],
        dismissals: { male: int(f, `${prefix}_${row}_dismissal_male`), female: int(f, `${prefix}_${row}_dismissal_female`), total: int(f, `${prefix}_${row}_dismissal_total`) },
        resignations: { male: int(f, `${prefix}_${row}_resignation_male`), female: int(f, `${prefix}_${row}_resignation_female`), total: int(f, `${prefix}_${row}_resignation_total`) },
        retirements: { male: int(f, `${prefix}_${row}_retirement_male`), female: int(f, `${prefix}_${row}_retirement_female`), total: int(f, `${prefix}_${row}_retirement_total`) },
        others: { male: int(f, `${prefix}_${row}_other_male`), female: int(f, `${prefix}_${row}_other_female`), total: int(f, `${prefix}_${row}_other_total`) },
        ensemble: { male: int(f, `${prefix}_${row}_ensemble_male`), female: int(f, `${prefix}_${row}_ensemble_female`), total: int(f, `${prefix}_${row}_ensemble_total`) },
    }));
}

function buildDepartureTotals(f: F, prefix: string): any {
    return {
        label: 'Total',
        dismissals: { male: int(f, `${prefix}_total_dismissal_male`), female: int(f, `${prefix}_total_dismissal_female`), total: int(f, `${prefix}_total_dismissal_total`) },
        resignations: { male: int(f, `${prefix}_total_resignation_male`), female: int(f, `${prefix}_total_resignation_female`), total: int(f, `${prefix}_total_resignation_total`) },
        retirements: { male: int(f, `${prefix}_total_retirement_male`), female: int(f, `${prefix}_total_retirement_female`), total: int(f, `${prefix}_total_retirement_total`) },
        others: { male: int(f, `${prefix}_total_other_male`), female: int(f, `${prefix}_total_other_female`), total: int(f, `${prefix}_total_other_total`) },
        ensemble: { male: int(f, `${prefix}_total_ensemble_male`), female: int(f, `${prefix}_total_ensemble_female`), total: int(f, `${prefix}_total_ensemble_total`) },
    };
}

// ─── Dismissal tech unemployment builder ─────────────────────────────────────

function buildDismissalTechRows(f: F, prefix: string): any[] {
    return CSP_ROWS.map(row => ({
        label: CSP_LABELS[row],
        dismissal: {
            male: int(f, `${prefix}_${row}_dismissal_male`),
            female: int(f, `${prefix}_${row}_dismissal_female`),
            total: int(f, `${prefix}_${row}_dismissal_total`),
        },
        technicalUnemployment: {
            male: int(f, `${prefix}_${row}_technical_unemployment_male`),
            female: int(f, `${prefix}_${row}_technical_unemployment_female`),
            total: int(f, `${prefix}_${row}_technical_unemployment_total`),
        },
        total: {
            male: int(f, `${prefix}_${row}_total_male`),
            female: int(f, `${prefix}_${row}_total_female`),
            total: int(f, `${prefix}_${row}_total_total`),
        },
    }));
}

function buildDismissalTechTotals(f: F, prefix: string): any {
    return {
        label: 'TOTAL',
        dismissal: {
            male: int(f, `${prefix}_total_dismissal_male`),
            female: int(f, `${prefix}_total_dismissal_female`),
            total: int(f, `${prefix}_total_dismissal_total`),
        },
        technicalUnemployment: {
            male: int(f, `${prefix}_total_technical_unemployment_male`),
            female: int(f, `${prefix}_total_technical_unemployment_female`),
            total: int(f, `${prefix}_total_technical_unemployment_total`),
        },
        total: {
            male: int(f, `${prefix}_total_total_male`),
            female: int(f, `${prefix}_total_total_female`),
            total: int(f, `${prefix}_total_total_total`),
        },
    };
}

// ─── Dismissal reasons builder ────────────────────────────────────────────────

function buildDismissalReasons(f: F, prefix: string): any[] {
    return [1, 2, 3].map(i => ({
        index: i,
        text: str(f, `${prefix}_reason_${i}_text`),
        male: int(f, `${prefix}_reason_${i}_male`),
        female: int(f, `${prefix}_reason_${i}_female`),
        total: int(f, `${prefix}_reason_${i}_total`),
    }));
}

function buildDismissalReasonsTotals(f: F, prefix: string): any {
    return {
        male: int(f, `${prefix}_total_male`),
        female: int(f, `${prefix}_total_female`),
        total: int(f, `${prefix}_total_total`),
    };
}

// ─── Internship builder ───────────────────────────────────────────────────────

const INTERNSHIP_MAP: [string, string][] = [
    ['vacation', 'Stage de vacance / Vacation internship'],
    ['academic', 'Stage académique / Academic internship'],
    ['professional', 'Stage professionnel / Professional internship'],
    ['pre_employment', 'Stage pré-emploi / Pre-employment internship'],
];

function buildInternshipRows(f: F, prefix: string): any[] {
    return INTERNSHIP_MAP.map(([slug, label]) => ({
        label,
        male: int(f, `${prefix}_${slug}_male`),
        female: int(f, `${prefix}_${slug}_female`),
        total: int(f, `${prefix}_${slug}_total`),
    }));
}

function buildInternshipTotals(f: F, prefix: string): any {
    return {
        male: int(f, `${prefix}_total_male`),
        female: int(f, `${prefix}_total_female`),
        total: int(f, `${prefix}_total_total`),
    };
}

// ─── Skills builder ───────────────────────────────────────────────────────────

function buildSkills(f: F, prefix: string): any[] {
    return [1, 2, 3].map(i => ({
        index: i,
        description: str(f, `${prefix}_skill_${i}_text`),
        male: int(f, `${prefix}_skill_${i}_male`),
        female: int(f, `${prefix}_skill_${i}_female`),
        total: int(f, `${prefix}_skill_${i}_total`),
    }));
}

function buildSkillsTotals(f: F, prefix: string): any {
    return {
        male: int(f, `${prefix}_total_male`),
        female: int(f, `${prefix}_total_female`),
        total: int(f, `${prefix}_total_total`),
    };
}

// ─── Training builder ─────────────────────────────────────────────────────────

function buildTrainingNeeds(f: F, prefix: string): any[] {
    return [1, 2, 3].map(i => ({
        index: i,
        domain: str(f, `${prefix}_domain_${i}_text`),
        male: int(f, `${prefix}_domain_${i}_male`),
        female: int(f, `${prefix}_domain_${i}_female`),
        total: int(f, `${prefix}_domain_${i}_total`),
    }));
}

function buildTrainingTotals(f: F, prefix: string): any {
    return {
        male: int(f, `${prefix}_total_male`),
        female: int(f, `${prefix}_total_female`),
        total: int(f, `${prefix}_total_total`),
    };
}

// ─── S23Q02 first-time workers builder ───────────────────────────────────────

function buildS23Q02(f: F): any {
    const prefix = 's23q02';

    const buildContractRows = (contract: string) =>
        CSP_ROWS.map(row => ({
            label: CSP_LABELS[row],
            male: {
                age15_24: int(f, `${prefix}_${contract}_${row}_male_15_24`),
                age25_34: int(f, `${prefix}_${contract}_${row}_male_25_34`),
                age35plus: int(f, `${prefix}_${contract}_${row}_male_35_plus`),
                total: int(f, `${prefix}_${contract}_${row}_male_total`),
            },
            female: {
                age15_24: int(f, `${prefix}_${contract}_${row}_female_15_24`),
                age25_34: int(f, `${prefix}_${contract}_${row}_female_25_34`),
                age35plus: int(f, `${prefix}_${contract}_${row}_female_35_plus`),
                total: int(f, `${prefix}_${contract}_${row}_female_total`),
            },
            total: {
                age15_24: int(f, `${prefix}_${contract}_${row}_total_15_24`),
                age25_34: int(f, `${prefix}_${contract}_${row}_total_25_34`),
                age35plus: int(f, `${prefix}_${contract}_${row}_total_35_plus`),
                total: int(f, `${prefix}_${contract}_${row}_total_total`),
            },
        }));

    const buildContractTotals = (contract: string) => ({
        label: 'TOTAL',
        male: {
            age15_24: int(f, `${prefix}_${contract}_subtotal_male_15_24`),
            age25_34: int(f, `${prefix}_${contract}_subtotal_male_25_34`),
            age35plus: int(f, `${prefix}_${contract}_subtotal_male_35_plus`),
            total: int(f, `${prefix}_${contract}_subtotal_male_total`),
        },
        female: {
            age15_24: int(f, `${prefix}_${contract}_subtotal_female_15_24`),
            age25_34: int(f, `${prefix}_${contract}_subtotal_female_25_34`),
            age35plus: int(f, `${prefix}_${contract}_subtotal_female_35_plus`),
            total: int(f, `${prefix}_${contract}_subtotal_female_total`),
        },
        total: {
            age15_24: int(f, `${prefix}_${contract}_subtotal_total_15_24`),
            age25_34: int(f, `${prefix}_${contract}_subtotal_total_25_34`),
            age35plus: int(f, `${prefix}_${contract}_subtotal_total_35_plus`),
            total: int(f, `${prefix}_${contract}_subtotal_total_total`),
        },
    });

    return {
        permanent: buildContractRows('permanent'),
        permanentTotals: buildContractTotals('permanent'),
        temporary: buildContractRows('temporary'),
        temporaryTotals: buildContractTotals('temporary'),
        grandTotals: {
            label: 'TOTAL GÉNÉRAL',
            male: {
                age15_24: int(f, `${prefix}_grandtotal_male_15_24`),
                age25_34: int(f, `${prefix}_grandtotal_male_25_34`),
                age35plus: int(f, `${prefix}_grandtotal_male_35_plus`),
                total: int(f, `${prefix}_grandtotal_male_total`),
            },
            female: {
                age15_24: int(f, `${prefix}_grandtotal_female_15_24`),
                age25_34: int(f, `${prefix}_grandtotal_female_25_34`),
                age35plus: int(f, `${prefix}_grandtotal_female_35_plus`),
                total: int(f, `${prefix}_grandtotal_female_total`),
            },
            total: {
                age15_24: int(f, `${prefix}_grandtotal_total_15_24`),
                age25_34: int(f, `${prefix}_grandtotal_total_25_34`),
                age35plus: int(f, `${prefix}_grandtotal_total_35_plus`),
                total: int(f, `${prefix}_grandtotal_total_total`),
            },
        },
    };
}

// ─── S1 enum mappers (string label → int for Handlebars eq helper) ────────────
// These are the only "transforms" in this file — they are not computations,
// just type coercions so the template's {{#if (eq area 1)}} helpers work.

function mapArea(v: unknown): number {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const s = String(v).toLowerCase();
    if (s.includes('urbain') || s.includes('urban')) return 1;
    if (s.includes('rural')) return 2;
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

function mapCooperativeType(v: unknown): number {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const s = String(v);
    if (s === '1' || s.includes('simplifiée')) return 1;
    if (s === '2' || s.includes("conseil d'administration")) return 2;
    if (s === '3' || s.includes('Autre')) return 3;
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
    if (s.includes('TPE')) return 1;
    if (s.includes('PE')) return 2;
    if (s.includes('ME')) return 3;
    if (s.includes('GE')) return 4;
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

// ─── Shared S2–S4 block builder ───────────────────────────────────────────────
// All four entity mappers share identical S2–S4 structure.

function buildS2S4(f: F, entityType: string): any {
    const vulnerablePrefix = entityType === 'enterprise' ? 's22q05_ent' : 's22q05_oth';
    const vulnerableRows = ['deplaces_internes', 'refugies', 'orphelins'];
    const vulnerableLabels: Record<string, string> = {
        deplaces_internes: 'Déplacés internes / Internal displaced',
        refugies: 'Réfugiés / Refugees',
        orphelins: 'Orphelins / Orphans',
    };

    return {
        jobApplicationsRows: buildCspAgeRows(f, 's21q01'),
        jobApplicationsTotals: buildCspAgeTotals(f, 's21q01'),

        recruitmentsPermanentRows: buildCspAgeRows(f, 's22q01'),
        recruitmentsPermanentTotals: buildCspAgeTotals(f, 's22q01'),

        recruitmentsTemporaryRows: buildCspAgeRows(f, 's22q02'),
        recruitmentsTemporaryTotals: buildCspAgeTotals(f, 's22q02'),

        recruitmentsByDiplomaRows: buildDiplomaRows(f, 's22q03'),
        recruitmentsByDiplomaTotals: buildDiplomaTotals(f, 's22q03'),

        disabledRecruitmentsRows: buildPermTempRows(f, 's22q04', ['cadres', 'foremen', 'workers'], CSP_LABELS),
        disabledRecruitmentsTotals: buildPermTempTotals(f, 's22q04'),

        vulnerableRecruitmentsRows: buildPermTempRows(f, vulnerablePrefix, vulnerableRows, vulnerableLabels),
        vulnerableRecruitmentsTotals: buildPermTempTotals(f, vulnerablePrefix),

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

// ─── Entity mappers ───────────────────────────────────────────────────────────

export function mapCooperativeData(f: F): any {
    return {
        // S0
        respondentName: str(f, 'S0Q01'),
        respondentFunction: str(f, 'S0Q02'),
        respondentPhone1: str(f, 'S0Q03_TEL1'),
        respondentPhone2: str(f, 'S0Q03_TEL2'),
        respondentEmail: str(f, 'S0Q03_EMAIL'),

        // S1
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
        permanentWorkers: f['COOP_S1Q11'] !== undefined && f['COOP_S1Q11'] !== null ? String(f['COOP_S1Q11']) : '',
        vacancies: f['COOP_S1Q12'] !== undefined && f['COOP_S1Q12'] !== null ? String(f['COOP_S1Q12']) : '',

        // S2–S4
        ...buildS2S4(f, 'cooperative'),

        surveyYear: f['surveyYear'] ?? new Date().getFullYear(),
        copy: 'Original',
    };
}

export function mapEnterpriseData(f: F): any {
    return {
        // S0
        respondentName: str(f, 'S0Q01'),
        respondentFunction: str(f, 'S0Q02'),
        respondentPhone1: str(f, 'S0Q03_TEL1'),
        respondentPhone2: str(f, 'S0Q03_TEL2'),
        respondentEmail: str(f, 'S0Q03_EMAIL'),

        // S1
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
        permanentWorkers: f['S1Q10'] !== undefined && f['S1Q10'] !== null ? String(f['S1Q10']) : '',
        vacancies: f['S1Q11'] !== undefined && f['S1Q11'] !== null ? String(f['S1Q11']) : '',
        enterpriseSize: mapSize(f['S1Q12']),

        // S2–S4
        ...buildS2S4(f, 'enterprise'),

        surveyYear: f['surveyYear'] ?? new Date().getFullYear(),
        copy: 'Original',
    };
}

export function mapCtdData(f: F): any {
    return {
        // S0
        respondentName: str(f, 'S0Q01'),
        respondentFunction: str(f, 'S0Q02'),
        respondentPhone1: str(f, 'S0Q03_TEL1'),
        respondentPhone2: str(f, 'S0Q03_TEL2'),
        respondentEmail: str(f, 'S0Q03_EMAIL'),

        // S1
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
        permanentWorkers: f['CTD_S1Q09'] !== undefined && f['CTD_S1Q09'] !== null ? String(f['CTD_S1Q09']) : '',
        vacancies: f['CTD_S1Q10'] !== undefined && f['CTD_S1Q10'] !== null ? String(f['CTD_S1Q10']) : '',

        // S2–S4
        ...buildS2S4(f, 'ctd'),

        surveyYear: f['surveyYear'] ?? new Date().getFullYear(),
        copy: 'Original',
    };
}

export function mapOngData(f: F): any {
    return {
        // S0
        respondentName: str(f, 'S0Q01'),
        respondentFunction: str(f, 'S0Q02'),
        respondentPhone1: str(f, 'S0Q03_TEL1'),
        respondentPhone2: str(f, 'S0Q03_TEL2'),
        respondentEmail: str(f, 'S0Q03_EMAIL'),

        // S1
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
        permanentWorkers: f['ONG_S1Q10'] !== undefined && f['ONG_S1Q10'] !== null ? String(f['ONG_S1Q10']) : '',
        vacancies: f['ONG_S1Q11'] !== undefined && f['ONG_S1Q11'] !== null ? String(f['ONG_S1Q11']) : '',

        // S2–S4
        ...buildS2S4(f, 'ong'),

        surveyYear: f['surveyYear'] ?? new Date().getFullYear(),
        copy: 'Original',
    };
}

// ─── Diagnostic ───────────────────────────────────────────────────────────────
// Checks that all expected registry keys are present in the payload.
// Called by the controller in non-production environments.

export function diagnoseMappingKeys(f: F): void {
    const keys = new Set(Object.keys(f));
    const expected: string[] = [
        'S0Q01', 'S0Q02', 'S0Q03_TEL1', 'S0Q03_TEL2', 'S0Q03_EMAIL',
        'COOP_S1Q01', 'COOP_S1Q02', 'COOP_S1Q03', 'COOP_S1Q04',
        'COOP_S1Q05_REGION', 'COOP_S1Q05_DEPT', 'COOP_S1Q05_SUBDIV', 'COOP_S1Q05_LOCALITY',
        'COOP_S1Q06_TEL1', 'COOP_S1Q06_TEL2', 'COOP_S1Q06_BP',
        'COOP_S1Q07', 'COOP_S1Q08', 'COOP_S1Q09', 'COOP_S1Q10', 'COOP_S1Q10_OTHER',
        'COOP_S1Q11', 'COOP_S1Q12',
    ];
    const missing = expected.filter(k => !keys.has(k));
    console.log('\n🔍 ===== KEY DIAGNOSTIC =====');
    if (missing.length === 0) {
        console.log('✅ All expected S0/S1 keys present');
    } else {
        console.log(`❌ ${missing.length} keys MISSING:`);
        missing.forEach(k => console.log(`   ❌ ${k}`));
    }
    console.log('🔍 ===========================\n');
}

export default {};