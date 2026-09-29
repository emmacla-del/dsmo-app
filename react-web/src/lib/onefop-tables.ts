// src/lib/onefop-tables.ts
//
// Fixed row/column labels and row-key lists for the classic (non-VT) grid
// templates — ported from lib/core/focus/renderers/table_spec_builder.dart
// (the file that actually renders these grids — confirmed authoritative
// this session over lib/core/focus/compiler/form_schema_compiler.dart's
// GridSchema, which is keyboard-navigation-only and, for several
// templates, uses different cell IDs than what's actually on screen).
// Neither the AST nor FieldSchema carries this as data (see
// onefop.schema.json's per-table "limitation" note), so this is a
// faithful, verified port — not invented — but it is a second place this
// data now lives; if the AST ever gains it as real data, this file should
// be replaced by reading it, not kept in parallel.
import type { LocalizedText, OnefopField } from "./onefop-schema";

export const CSP_ROW_LABELS: Record<string, LocalizedText> = {
  cadres: { fr: "Cadres", en: "Executives" },
  foremen: { fr: "Agents de Maîtrise", en: "Foremen" },
  workers: { fr: "Agents d'exécution", en: "Field workers" },
  // SFP variant rows (Administration/CTD-style) — same table shape.
  fonctionnaire: { fr: "Fonctionnaire", en: "Civil servant" },
  decisionnaire: { fr: "Décisionnaire", en: "Decision-maker" },
  contractuelle: { fr: "Contractuelle", en: "Contractual" },
};

/** Sex as a column GROUP spanning age-band columns (Homme / Femme / TOTAL). */
export const GENDER_LABELS: LocalizedText[] = [
  { fr: "Homme", en: "Male" },
  { fr: "Femme", en: "Female" },
  { fr: "TOTAL", en: "TOTAL" },
];

export const AGE_BAND_LABELS: LocalizedText[] = [
  { fr: "15 à 24", en: "15 to 24" },
  { fr: "25 à 34", en: "25 to 34" },
  { fr: "35 et +", en: "35 and above" },
  { fr: "Total", en: "Total" },
];

// first_time_workers_table's two row-BLOCK labels (Permanent/Temporaire) —
// distinct from STATUS_GENDER_GROUP_LABELS below, which has a 3rd "Total"
// entry for the status_gender-shaped tables' column groups.
export const STATUS_LABELS: LocalizedText[] = [
  { fr: "Permanent", en: "Permanent" },
  { fr: "Temporaire", en: "Temporary" },
];

// csp_status_gender_table / vulnerable_named_rows_table column-group
// labels — table_spec_builder.dart's _statusGenderHeaders renders THREE
// groups (Permanent/Temporaire/Total), not two.
export const STATUS_GENDER_GROUP_LABELS: LocalizedText[] = [
  { fr: "Permanent", en: "Permanent" },
  { fr: "Temporaire", en: "Temporary" },
  { fr: "Total", en: "Total" },
];

/**
 * SINGLE SOURCE for sex as a column header (leaf level): Homme / Femme /
 * Total. Every table that has a sex column — classic grids, Modern Jobs
 * grids, VT tables — must use these, never its own strings, so the wording
 * is identical everywhere. (Sex as a column GROUP spanning age bands is
 * GENDER_LABELS above: Homme / Femme / TOTAL — same words.)
 */
export const SEX_COLUMN_LABELS = {
  male: { fr: "Homme", en: "Male" },
  female: { fr: "Femme", en: "Female" },
  total: { fr: "Total", en: "Total" },
} as const satisfies Record<string, LocalizedText>;

// Sub-columns under each status/type group — Male/Female/Total (no age bands).
export const MFT_LABELS: LocalizedText[] = [
  SEX_COLUMN_LABELS.male,
  SEX_COLUMN_LABELS.female,
  SEX_COLUMN_LABELS.total,
];

export function rowLabel(rowKey: string): LocalizedText {
  return CSP_ROW_LABELS[rowKey] ?? { fr: rowKey, en: rowKey };
}

// departure_table (S3Q01) — table_spec_builder.dart's typeLabelsI18n.
export const DEPARTURE_TYPE_LABELS: LocalizedText[] = [
  { fr: "Licenciements", en: "Dismissal" },
  { fr: "Démissions", en: "Resignation" },
  { fr: "Départ à la retraite", en: "Retirement" },
  { fr: "Autres départs", en: "Other departures" },
  { fr: "Ensemble", en: "Total" },
];

// dismissal_unemployment_table (S3Q03).
export const DISMISSAL_TYPE_LABELS: LocalizedText[] = [
  { fr: "Licenciement", en: "Dismissal" },
  { fr: "Chômage technique", en: "Technical unemployment" },
  { fr: "Total", en: "Total" },
];

// internship_table (S4Q01) — table_spec_builder.dart's _buildInternship.
export const INTERNSHIP_ROW_KEYS = ["vacation", "academic", "professional", "pre_employment"];
export const INTERNSHIP_ROW_LABELS: LocalizedText[] = [
  { fr: "Stage de vacance", en: "Holiday jobs" },
  { fr: "Stage académique", en: "Academic internship" },
  { fr: "Stage professionnel", en: "Professional internship" },
  { fr: "Stage pré-emploi", en: "Pre-employment internship" },
];

// diploma_gender_age_table (S22Q03) — table_spec_builder.dart's
// _buildDiploma. Corrects an earlier version of this codebase that derived
// row keys from FormSchemaCompiler's GridSchema matrix instead (that
// matrix uses a different, sanitized-display-string key scheme —
// e.g. "cep__cepe__fslc" — that doesn't match what's actually rendered).
export const DIPLOMA_ROW_KEYS = [
  "cep", "bepc", "probatoire", "bac", "bts", "licence",
  "maitrise", "master", "dqp", "cqp", "autres", "sans_diplome",
];
export const DIPLOMA_ROW_LABELS: LocalizedText[] = [
  { fr: "CEP / CEPE / FSLC", en: "CEP / CEPE / FSLC" },
  { fr: "BEPC / CAP / GCE-OL", en: "BEPC / CAP / GCE-OL" },
  { fr: "Probatoire", en: "Lower sixth" },
  { fr: "BAC / GCE-AL", en: "BAC / GCE-AL" },
  { fr: "BTS / DUT / HND", en: "BTS / DUT / HND" },
  { fr: "Licence (Bac+3)", en: "Bachelor" },
  { fr: "Maîtrise (Bac+4)", en: "Master 1" },
  { fr: "Master (Bac+5)", en: "Master 2" },
  { fr: "DQP / PQD", en: "DQP / PQD" },
  { fr: "CQP / CPQ", en: "CQP / CPQ" },
  { fr: "Autres", en: "Others" },
  { fr: "Sans diplôme", en: "Without diploma" },
];

// vulnerable_named_rows_table (S22Q05) — table_spec_builder.dart's
// _buildVulnerableNamedRows.
export const VULNERABLE_ROW_KEYS = ["deplaces_internes", "refugies", "orphelins"];
export const VULNERABLE_ROW_LABELS: LocalizedText[] = [
  { fr: "Déplacés internes", en: "Internal displaced" },
  { fr: "Réfugiés", en: "Refugees" },
  { fr: "Orphelins", en: "Orphans" },
];

// reasons_table (S3Q02) / skills_table (S4Q02) / training_table (S4Q03) —
// table_spec_builder.dart's _buildReasons/_buildSkills/_buildTraining.
// Each row's free-text label (the reason / domain) is typed in the grid's
// first column, but it is bound to the AST's own ordinary text fields
// (S3Q02_REASON_1_TEXT etc. — see EMBEDDED_ROW_TEXT below), NOT to a new
// in-grid id, so there is still exactly one stored value per label.
// SectionRenderer hides those text fields' standalone inputs once the
// table shows them, so they are never rendered twice.
export const REASONS_ROW_KEYS = ["reason_1", "reason_2", "reason_3"];
export const REASONS_ROW_LABELS: LocalizedText[] = [
  { fr: "Motif 1", en: "Reason 1" },
  { fr: "Motif 2", en: "Reason 2" },
  { fr: "Motif 3", en: "Reason 3" },
];

export const SKILLS_ROW_KEYS = ["skill_1", "skill_2", "skill_3"];
export const SKILLS_ROW_LABELS: LocalizedText[] = [
  { fr: "Compétence 1", en: "Skill 1" },
  { fr: "Compétence 2", en: "Skill 2" },
  { fr: "Compétence 3", en: "Skill 3" },
];

export const TRAINING_ROW_KEYS = ["domain_1", "domain_2", "domain_3"];
export const TRAINING_ROW_LABELS: LocalizedText[] = [
  { fr: "Domaine 1", en: "Domain 1" },
  { fr: "Domaine 2", en: "Domain 2" },
  { fr: "Domaine 3", en: "Domain 3" },
];

/**
 * Tables whose first column is an editable text label bound to the AST's
 * existing per-row text fields: `${TABLE_ID}_${kind}_${n}_TEXT` (n = 1..3),
 * e.g. S3Q02_REASON_1_TEXT, S4Q02_DOMAIN_2_TEXT, S4Q03_DOMAIN_3_TEXT.
 * Header/placeholder wording mirrors those fields' AST label/hint.
 */
export const EMBEDDED_ROW_TEXT: Record<
  string,
  { kind: "REASON" | "DOMAIN"; header: LocalizedText; placeholder: LocalizedText }
> = {
  reasons_table: {
    kind: "REASON",
    header: { fr: "Motif de licenciement", en: "Dismissal reason" },
    placeholder: { fr: "Décrivez le motif de licenciement", en: "Describe the reason for dismissal" },
  },
  skills_table: {
    kind: "DOMAIN",
    header: { fr: "Domaine de compétence", en: "Skill domain" },
    placeholder: {
      fr: "Ex: Gestion, Comptabilité, Marketing, RH, Technique...",
      en: "E.g. Management, Accounting, Marketing, HR, Technical...",
    },
  },
  training_table: {
    kind: "DOMAIN",
    header: { fr: "Domaine de formation", en: "Training domain" },
    placeholder: {
      fr: "Ex: Leadership, Techniques de vente, Gestion de projet...",
      en: "E.g. Leadership, Sales techniques, Project management...",
    },
  },
};

/** The AST text field id holding row `rowNumber` (1-based) of an embedded-text table. */
export function embeddedRowTextFieldId(tableId: string, template: string, rowNumber: number): string | undefined {
  const cfg = EMBEDDED_ROW_TEXT[template];
  if (!cfg) return undefined;
  return `${tableId.toUpperCase()}_${cfg.kind}_${rowNumber}_TEXT`;
}

/**
 * True when `fieldId` is one of those per-row text fields AND the same
 * section actually contains the table that now renders it in-grid (so the
 * standalone input can be hidden without losing the field).
 */
export function isRowTextEmbeddedInTable(
  fieldId: string,
  sectionFields: Pick<OnefopField, "table">[],
): boolean {
  const m = /^([A-Z0-9]+)_(REASON|DOMAIN)_(\d+)_TEXT$/.exec(fieldId);
  if (!m) return false;
  const [, tablePrefix, kind] = m;
  return sectionFields.some((f) => {
    const template = f.table?.template;
    if (!template || !f.table?.id) return false;
    const cfg = EMBEDDED_ROW_TEXT[template];
    return !!cfg && cfg.kind === kind && f.table.id.toUpperCase() === tablePrefix;
  });
}

// kpi_period_table (Project/Program PP_S3_OUTCOMES) — table_spec_builder
// .dart's _buildKpiPeriod. No gender/age breakdown and — per that
// function's own comment, confirmed — no computed total row or column at
// all (the paper form has none): every cell here is plain user input.
export const KPI_ROW_KEYS = ["employed", "self_employed", "jobs_created", "trained"];
export const KPI_ROW_LABELS: LocalizedText[] = [
  {
    fr: "Nombre de bénéficiaires insérés comme employés",
    en: "Number of beneficiaries inserted as employees",
  },
  {
    fr: "Nombre de bénéficiaires insérés en auto emploi",
    en: "Number of beneficiaries inserted in self-employment",
  },
  {
    fr: "Nombre d'emplois créés par les bénéficiaires employeurs",
    en: "Number of jobs created by beneficiary employers",
  },
  {
    fr: "Nombre de bénéficiaires formés dans les domaines divers",
    en: "Number of beneficiaries trained in various fields",
  },
];
export const KPI_PERIOD_LABELS: LocalizedText[] = [
  { fr: "Du 1er Janvier 2026 à ce jour", en: "From 1st January 2026 to date" },
  { fr: "Perspectives au 31/12/2026", en: "Outlook at 31/12/2026" },
  { fr: "Perspectives au 30/06/2026", en: "Outlook at 30/06/2026" },
];
export const KPI_PERIODS = ["current", "outlook_dec", "outlook_june"];
