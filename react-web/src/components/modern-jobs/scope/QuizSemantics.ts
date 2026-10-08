// Preliminary Declaration Quiz → statistical-table semantics.
//
// The quiz (ScopeConfigurationWizard) is the respondent's declaration of
// which events occurred during the period. This module is the single place
// that turns its answers (`data._scopeConfig`) into table meaning:
//
//   quiz answer "No"  (event or follow-up category did not occur)
//       → table _RESPONSE_STATUS = NONE, every applicable cell = 0
//   quiz answer "Yes"
//       → table _RESPONSE_STATUS = REPORTED, respondent values kept;
//         cells for CSP / age / type categories the quiz de-selected = 0
//   question unanswered
//       → nothing is derived; final submission is blocked instead
//   NOT_APPLICABLE left in an old draft → overridden: it is no longer an
//       answer anyone can give, and the server refuses it
//   table absent from the entity's schema → untouched
//
// An empty table is never evidence of NONE. The derived zeros exist only in
// the submission payload (prepareSubmissionData in lib/onefop-submission.ts),
// never in the respondent's working form state, so changing No → Yes cannot
// leave stale zeros behind.
//
// Project/Programme and Vocational Training are deliberately excluded: PP's
// tables reuse the S4Q0x paper codes with different meanings (census and
// recruitment tables, not internships/skills/training), so applying the
// enterprise quiz mapping to them would be wrong. PP gets its own quiz
// analysis separately.
import type { FormData, OnefopEntity, OnefopField } from "@/lib/onefop-schema";
import { canonicalGatewayId, resolveTableStatusFieldId } from "../conditional/gateway-catalog";
import {
  getGuidedOnlyTableDefinition,
  getModernJobsTableDefinition,
} from "@/components/onefop/tables/definitions/modernJobsTableDefinitions";
import type { FixedMatrixDefinition, StatisticalRowDefinition } from "@/components/onefop/tables/StatisticalTableDefinition";
import { DEFAULT_SCOPE, type PrimaryQuestionId, type ScopeState } from "./ScopeTypes";
import { EVENT_TABLE_MAPPING, isTableReported } from "./ScopeDataManagement";
import { isVtCentreClosed, vtStatusKey, vtTableStatus } from "@/lib/vt-quiz";

/** Entities whose tables are not governed by this quiz mapping. */
export const QUIZ_SEMANTICS_EXCLUDED_ENTITIES = new Set(["projectProgram", "vocationalTraining"]);

export type QuizTableStatus = "REPORTED" | "NONE";

/** Section 2–4 tables of an entity, indexed by paper code and by field id (as the wizard does). */
export function buildEntityTableIndex(entity: OnefopEntity): Map<string, OnefopField> {
  const map = new Map<string, OnefopField>();
  for (const sec of entity.sections) {
    if (sec.id === "section0" || sec.id.startsWith("section1_")) continue;
    for (const f of sec.fields) {
      if (f.type === "table" || f.type === "repeating_table" || f.table) {
        const code = (f.paperCode || canonicalGatewayId(f.id)).toUpperCase();
        map.set(code, f);
        map.set(f.id.toUpperCase(), f);
      }
    }
  }
  return map;
}

/**
 * Administration's Section 2 (S21Q01 census, S21Q02 recruitment, S21Q03
 * disability, S21Q04 vulnerable). S21Q02 exists only there, so it marks the
 * Administration layout: its S21Q01 is a staff census, not job applications.
 */
export function isAdministrationLayout(hasTable: (code: string) => boolean): boolean {
  return hasTable("S21Q02");
}

/** Recruitment follow-up tables, across both layouts. */
export function hasDisabilityTable(hasTable: (code: string) => boolean): boolean {
  return hasTable("S22Q04") || hasTable("S21Q03");
}
export function hasVulnerableTable(hasTable: (code: string) => boolean): boolean {
  return hasTable("S22Q05") || hasTable("S22Q05_ENTERPRISE") || hasTable("S22Q05_OTHER") || hasTable("S21Q04");
}

/** Quiz questions offered for an entity — the order the wizard asks them. */
export function quizQuestionsFor(hasTable: (code: string) => boolean): PrimaryQuestionId[] {
  const list: PrimaryQuestionId[] = [];
  // Administration's S21Q01 census stays outside the quiz (its own gateway).
  if (hasTable("S21Q01") && !isAdministrationLayout(hasTable)) list.push("applications");
  if (
    hasTable("S21Q02") ||
    hasTable("S22Q01") ||
    hasTable("S22Q02") ||
    hasTable("S22Q03") ||
    hasTable("S22Q04") ||
    hasTable("S22Q05") ||
    hasTable("S22Q05_ENTERPRISE") ||
    hasTable("S22Q05_OTHER")
  ) {
    list.push("recruitment");
  }
  if (hasTable("S23Q01")) list.push("primo_seekers");
  if (hasTable("S23Q02")) list.push("primo_workers");
  if (hasTable("S3Q01")) list.push("departures");
  if (hasTable("S4Q01")) list.push("interns");
  if (hasTable("S4Q02")) list.push("skills");
  if (hasTable("S4Q03")) list.push("training");
  return list;
}

/**
 * Whether a quiz question and all of its required follow-ups are answered.
 * An unanswered question is never read as "No".
 */
export function isQuizQuestionComplete(
  qId: PrimaryQuestionId,
  s: ScopeState,
  hasTable: (code: string) => boolean,
): boolean {
  switch (qId) {
    case "applications":
      if (s.applications === null) return false;
      if (s.applications === false) return true;
      return s.application_csp.length > 0 && s.application_age.length > 0;
    case "recruitment":
      if (s.recruit === null) return false;
      if (s.recruit === false) return true;
      if (hasTable("S22Q02") && s.recruit_types.length === 0) return false;
      // The CSP chips (cadres / maîtrise / exécution) do not describe
      // Administration's civil-service categories, so they are not asked there.
      if (!isAdministrationLayout(hasTable) && s.recruit_csp.length === 0) return false;
      if (s.recruit_age.length === 0) return false;
      if (hasTable("S22Q03") && s.recruit_diploma.length === 0) return false;
      if (hasDisabilityTable(hasTable) && s.disability === null) return false;
      if (hasVulnerableTable(hasTable) && s.vulnerable === null) return false;
      return true;
    case "primo_seekers":
      if (s.primo_seekers === null) return false;
      if (s.primo_seekers === false) return true;
      return s.primo_seekers_csp.length > 0 && s.primo_seekers_age.length > 0;
    case "primo_workers":
      if (s.primo_workers === null) return false;
      if (s.primo_workers === false) return true;
      return s.primo_workers_types.length > 0 && s.primo_workers_csp.length > 0 && s.primo_workers_age.length > 0;
    case "departures":
      if (s.departures === null) return false;
      if (s.departures === false) return true;
      if (s.departure_reasons.length === 0) return false;
      if (hasTable("S3Q03") && s.departure_reasons.includes("licenciement") && s.dismissal_technical === null) {
        return false;
      }
      return true;
    case "interns":
      if (s.interns === null) return false;
      if (s.interns === false) return true;
      return s.intern_types.length > 0;
    case "skills":
      return s.skills_needs !== null;
    case "training":
      return s.training_needs !== null;
    default:
      return false;
  }
}

/** The quiz question that governs a table code (per EVENT_TABLE_MAPPING), if any. */
export function quizQuestionForTable(tableCode: string): PrimaryQuestionId | null {
  const code = tableCode.toUpperCase();
  for (const [qId, mapping] of Object.entries(EVENT_TABLE_MAPPING)) {
    if (mapping.tableCodes.includes(code)) return qId as PrimaryQuestionId;
  }
  return null;
}

/**
 * Table status established by the quiz, or null while the governing question
 * (or one of its follow-ups) is unanswered.
 */
export function deriveQuizTableStatus(
  tableCode: string,
  scope: ScopeState,
  hasTable: (code: string) => boolean,
): QuizTableStatus | null {
  const qId = quizQuestionForTable(tableCode);
  if (!qId || !isQuizQuestionComplete(qId, scope, hasTable)) return null;
  return isTableReported(tableCode, scope) ? "REPORTED" : "NONE";
}

export function readQuizScope(data: FormData): ScopeState | null {
  const raw = data._scopeConfig;
  if (!raw || typeof raw !== "object") return null;
  return { ...DEFAULT_SCOPE, ...(raw as Partial<ScopeState>) };
}

export function isQuizGovernedEntity(entity: OnefopEntity): boolean {
  if (QUIZ_SEMANTICS_EXCLUDED_ENTITIES.has(entity.entityType)) return false;
  const index = buildEntityTableIndex(entity);
  return quizQuestionsFor((code) => index.has(code.toUpperCase())).length > 0;
}

/** Quiz questions still unanswered (or with unanswered follow-ups) for final submission. */
export function incompleteQuizQuestions(entity: OnefopEntity, data: FormData): PrimaryQuestionId[] {
  if (!isQuizGovernedEntity(entity)) return [];
  const index = buildEntityTableIndex(entity);
  const hasTable = (code: string) => index.has(code.toUpperCase());
  const scope = readQuizScope(data) ?? DEFAULT_SCOPE;
  return quizQuestionsFor(hasTable).filter((qId) => !isQuizQuestionComplete(qId, scope, hasTable));
}

// ── Applicable cells, from the existing table definitions ─────────────────

function definitionRows(definition: FixedMatrixDefinition): StatisticalRowDefinition[] {
  if (definition.cspSlices?.length && definition.buildRowsForCsp) {
    return definition.cspSlices.flatMap((csp) => definition.buildRowsForCsp!(csp));
  }
  return definition.rows;
}

function withoutQuizScope(data: FormData): FormData {
  const copy = { ...data };
  delete copy._scopeConfig;
  delete copy._scopeCsp;
  delete copy._scopeAge;
  return copy;
}

/**
 * Numeric statistical cells (entered and computed) of a table. Unscoped =
 * every category the entity's table defines; scoped = only the categories
 * the quiz kept. Falls back to the schema's own cell grid for a table with
 * no Modern Jobs definition.
 */
export function tableNumericCellKeys(field: OnefopField, data: FormData, scoped: boolean): string[] {
  const source = scoped ? data : withoutQuizScope(data);
  const definition = getModernJobsTableDefinition(field, source) ?? getGuidedOnlyTableDefinition(field, source);
  if (!definition) return (field.table?.matrix ?? []).flat();
  const keys = new Set<string>();
  for (const row of definitionRows(definition)) {
    for (const cell of Object.values(row.cells)) {
      if (cell.kind === "number" || cell.kind === "computed") keys.add(cell.fieldKey);
    }
  }
  return [...keys];
}

// ── Project/Programme quiz semantics ─────────────────────────────────────────

interface PpScopeConfig {
  completedAt?: string;
  noOutcomes?: boolean;
  outcomes?: string[];
  hasPermanentStaff?: boolean | null;
  hasTemporaryStaff?: boolean | null;
  hasRecruitment?: boolean | null;
  recruitmentTypes?: string[];
}

/**
 * Applies PP quiz choices to the submission payload at build time.
 *
 * Mirrors what ProjectProgramScopeQuiz.commitScopeData() does on the live
 * form, but runs unconditionally during prepareSubmissionData so that any
 * navigation-bypass or partial-commit cannot leave phantom non-zero cells in
 * a table the respondent declared as NONE.
 *
 * Returns data unchanged when the PP quiz has never been completed
 * (no `completedAt`). Final-submit validation will block the attempt.
 */
export function applyProjectProgramQuizSemantics(entity: OnefopEntity, data: FormData): FormData {
  const raw = data._scopeConfig;
  if (!raw || typeof raw !== "object") return withoutQuizScope({ ...data });
  const ppRaw = (raw as Record<string, unknown>).projectProgram;
  if (!ppRaw || typeof ppRaw !== "object") return withoutQuizScope({ ...data });
  const cfg = ppRaw as PpScopeConfig;
  if (!cfg.completedAt) return withoutQuizScope({ ...data });

  const out: FormData = { ...data };
  const index = buildEntityTableIndex(entity);

  const zeroTable = (tableCode: string) => {
    const upper = tableCode.toUpperCase();
    // PP fields are indexed under both "S4Q0x" (paperCode) and "PP_S4Q0x" (id).
    const field = index.get(upper) ?? index.get(`PP_${upper}`);
    if (!field) return;
    const allCells = tableNumericCellKeys(field, data, false);
    for (const key of allCells) out[key] = 0;
    for (const key of (field.table?.matrix ?? []).flat()) out[key] = 0;
  };

  // Section 3 outcomes — zero rows for unselected categories
  const activeOutcomes = cfg.noOutcomes ? [] : (cfg.outcomes ?? []);
  for (const ok of ["employed", "self_employed", "jobs_created", "trained"]) {
    if (!activeOutcomes.includes(ok)) out[`s3kpi_${ok}_current`] = 0;
  }

  // Section 4: S4Q01–S4Q06 — write both plain and PP-prefixed status keys
  // so the backend sees them regardless of which prefix it normalises to.
  const s4q01 = cfg.hasPermanentStaff ? "REPORTED" : "NONE";
  out["S4Q01_RESPONSE_STATUS"] = s4q01;
  out["PP_S4Q01_RESPONSE_STATUS"] = s4q01;
  if (s4q01 === "NONE") zeroTable("S4Q01");

  const s4q02 = cfg.hasTemporaryStaff ? "REPORTED" : "NONE";
  out["S4Q02_RESPONSE_STATUS"] = s4q02;
  out["PP_S4Q02_RESPONSE_STATUS"] = s4q02;
  if (s4q02 === "NONE") zeroTable("S4Q02");

  const recTypes = cfg.recruitmentTypes ?? [];

  const s4q03 = cfg.hasRecruitment && recTypes.includes("permanent") ? "REPORTED" : "NONE";
  out["S4Q03_RESPONSE_STATUS"] = s4q03;
  out["PP_S4Q03_RESPONSE_STATUS"] = s4q03;
  if (s4q03 === "NONE") zeroTable("S4Q03");

  const s4q04 = cfg.hasRecruitment && recTypes.includes("temporary") ? "REPORTED" : "NONE";
  out["S4Q04_RESPONSE_STATUS"] = s4q04;
  out["PP_S4Q04_RESPONSE_STATUS"] = s4q04;
  if (s4q04 === "NONE") zeroTable("S4Q04");

  const s4q05 = cfg.hasRecruitment && recTypes.includes("disability") ? "REPORTED" : "NONE";
  out["S4Q05_RESPONSE_STATUS"] = s4q05;
  out["PP_S4Q05_RESPONSE_STATUS"] = s4q05;
  if (s4q05 === "NONE") zeroTable("S4Q05");

  const s4q06 = cfg.hasRecruitment && recTypes.includes("vulnerable") ? "REPORTED" : "NONE";
  out["S4Q06_RESPONSE_STATUS"] = s4q06;
  out["PP_S4Q06_RESPONSE_STATUS"] = s4q06;
  if (s4q06 === "NONE") zeroTable("S4Q06");

  // Strip quiz meta-keys — they have no SPSS variable counterpart and must
  // not appear in the submission payload or the backend's variable mapper.
  delete out._scopeConfig;
  delete out._scopeCsp;
  delete out._scopeAge;
  return out;
}

// ── Vocational Training semantics ─────────────────────────────────────────────

/**
 * Training centres: each table's status comes from the training-centre quiz
 * (vt-quiz.ts — Oui → REPORTED, Non → NONE; 4.6 from 2.1.14; every other
 * table REPORTED). A NONE table of fixed rows is recorded as zeros; a NONE
 * row-by-row table (specialties, staff list) as no rows at all — its status
 * is what records "nothing to report". A table whose quiz question is still
 * unanswered gets no status (validation blocks the submission). A centre
 * declared non-functional or closed answers Section 1 only: no statuses.
 * The quiz meta-keys are stripped from the payload as for other entities.
 */
export function applyVocationalTrainingSemantics(entity: OnefopEntity, data: FormData): FormData {
  const out: FormData = withoutQuizScope({ ...data });
  if (isVtCentreClosed(data)) return out;

  for (const section of entity.sections) {
    for (const field of section.fields) {
      const vt = field.table?.vt;
      const matrix = field.table?.matrix;
      if (!vt || !matrix) continue;
      const status = vtTableStatus(field.id, data);
      if (!status) continue;
      out[vtStatusKey(field.id)] = status;
      if (status !== "NONE") continue;
      const rowByRow = vt.progressiveRows || vt.isRoster;
      for (const rowIds of matrix) {
        rowIds.forEach((cellId, c) => {
          const kind = vt.cells[c]?.kind;
          if (!rowByRow && (kind === "number" || kind === "computed")) out[cellId] = 0;
          else delete out[cellId];
        });
      }
    }
  }
  return out;
}

// ── Generic quiz semantics (all governed entities) ────────────────────────────

/**
 * The working form data with each quiz-governed table's status taken from the
 * quiz answers wherever the stored status is missing or a leftover
 * "NOT_APPLICABLE" — statuses only, no zero-filling. Lets validation check
 * a table exactly as the submission will treat it, even when the quiz was
 * answered before its statuses were written into the form.
 */
export function withQuizDerivedStatuses(entity: OnefopEntity, data: FormData): FormData {
  if (!isQuizGovernedEntity(entity)) return data;
  const scope = readQuizScope(data);
  if (!scope) return data;
  const index = buildEntityTableIndex(entity);
  const hasTable = (code: string) => index.has(code.toUpperCase());
  let out: FormData | null = null;
  for (const field of new Set(index.values())) {
    const codes = [field.id.toUpperCase(), (field.paperCode ?? "").toUpperCase()].filter(Boolean);
    const tableCode = codes.find((c) => quizQuestionForTable(c) !== null);
    if (!tableCode) continue;
    const statusKey = resolveTableStatusFieldId(field, data);
    const stored = data[statusKey];
    if (stored === "REPORTED" || stored === "NONE") continue;
    const status = deriveQuizTableStatus(tableCode, scope, hasTable);
    if (!status) continue;
    out = out ?? { ...data };
    out[statusKey] = status;
  }
  return out ?? data;
}

/**
 * Applies the quiz's meaning to a copy of the form data for submission.
 * The input object is not modified.
 */
export function applyQuizDerivedTableSemantics(entity: OnefopEntity, data: FormData): FormData {
  const out: FormData = { ...data };
  if (!isQuizGovernedEntity(entity)) {
    if (entity.entityType === "projectProgram") {
      return applyProjectProgramQuizSemantics(entity, data);
    }
    if (entity.entityType === "vocationalTraining") {
      return applyVocationalTrainingSemantics(entity, data);
    }
    return out;
  }
  const scope = readQuizScope(data);
  if (!scope) return out;

  const index = buildEntityTableIndex(entity);
  const hasTable = (code: string) => index.has(code.toUpperCase());
  const seen = new Set<OnefopField>();

  for (const field of index.values()) {
    if (seen.has(field)) continue;
    seen.add(field);

    const codes = [field.id.toUpperCase(), (field.paperCode ?? "").toUpperCase()].filter(Boolean);
    const tableCode = codes.find((c) => quizQuestionForTable(c) !== null);
    if (!tableCode) continue; // not governed by the quiz — no manufactured status

    const statusKey = resolveTableStatusFieldId(field, data);
    const status = deriveQuizTableStatus(tableCode, scope, hasTable);
    if (!status) continue; // unanswered — final validation blocks the submission

    out[statusKey] = status;
    const allCells = tableNumericCellKeys(field, data, false);
    if (status === "NONE") {
      // Confirmed absence: every cell of the table is 0 — the keys React's
      // grid writes and the canonical schema's own cells for this table
      // (which differ for a few tables, e.g. S23Q02 subtotals, S22Q03's
      // CSP × diploma grid), so the zero reaches every downstream reader.
      for (const key of allCells) out[key] = 0;
      for (const key of (field.table?.matrix ?? []).flat()) out[key] = 0;
    } else {
      const kept = new Set(tableNumericCellKeys(field, data, true));
      for (const key of allCells) {
        if (!kept.has(key)) out[key] = 0;
      }
    }
  }

  // Administration's S21Q01 census is not quiz-governed (its own gateway), but
  // any submitted Administration declaration implies the census was filled.
  // Override whatever the quiz loop may have derived from the `applications`
  // scope field (which is irrelevant to Administration and must never produce NONE).
  if (isAdministrationLayout(hasTable)) {
    const censusField = index.get("S21Q01");
    if (censusField) {
      const censusStatusKey = resolveTableStatusFieldId(censusField, data);
      out[censusStatusKey] = "REPORTED";
    }
  }

  delete out._scopeConfig;
  delete out._scopeCsp;
  delete out._scopeAge;
  return out;
}

export interface ZeroedTableInfo {
  code: string;
  tableId?: string;
  nameFr: string;
  nameEn: string;
  title?: { fr: string; en: string };
  reason: "QUIZ_DECLARED_NONE" | "CATEGORY_DESELECTED";
}

/**
 * Lists the statistical tables that the Preliminary Quiz
 * marked as NONE (certified zeros for statistical reporting).
 * Used by review screens and pre-submission modals for respondent transparency (D10).
 */
export function getZeroedTablesList(entity: OnefopEntity, data: FormData): ZeroedTableInfo[] {
  if (!isQuizGovernedEntity(entity)) return [];
  const scope = readQuizScope(data);
  if (!scope) return [];

  const index = buildEntityTableIndex(entity);
  const hasTable = (code: string) => index.has(code.toUpperCase());
  const seen = new Set<string>();
  const list: ZeroedTableInfo[] = [];

  for (const field of index.values()) {
    const code = (field.paperCode || field.id).toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);

    const qId = quizQuestionForTable(code);
    if (!qId) continue;

    const status = deriveQuizTableStatus(code, scope, hasTable);
    if (status === "NONE") {
      const fr = field.label?.fr || code;
      const en = field.label?.en || code;
      list.push({
        code,
        tableId: code,
        nameFr: fr,
        nameEn: en,
        title: { fr, en },
        reason: "QUIZ_DECLARED_NONE",
      });
    }
  }

  return list;
}

