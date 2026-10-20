// src/lib/onefop-validation.ts
//
// Authoritative client-side validation engine for CAM-LEAP ONEFOP questionnaires:
//  - Scalar field required checks (honoring kOptionalOverrides)
//  - Cameroon phone convention (exactly 9 digits starting with 2 or 6)
//  - RFC-compliant email validation
//  - 4-digit calendar year validation
//  - Table-level validation: non-negative values, required table presence,
//    and required table cell checks across active rows.

import { bilingual, isFieldVisible, isVtSectionWaived, localized, type FormData, type OnefopEntity, type OnefopField, type OnefopSection } from "./onefop-schema";
import { validateCameroonGeography, type LocationRegion } from "./territory";
import { isCompanionHiddenByGateway } from "@/components/modern-jobs/conditional/gateway-catalog";
import {
  getModernJobsTableDefinition,
  getGuidedOnlyTableDefinition,
} from "@/components/onefop/tables/definitions/modernJobsTableDefinitions";
import {
  quizGovernsEntry,
  missingQuizFieldKeys,
  isEnteredValue,
} from "@/components/onefop/tables/quizRequired";
import { incompleteQuizQuestions, readQuizScope, withQuizDerivedStatuses } from "@/components/modern-jobs/scope/QuizSemantics";
import { isVtCentreClosed, isVtQuizComplete, missingVtTableCells, readVtQuiz, vtQuizQuestionForTable, vtTableStatus } from "./vt-quiz";
import type { PrimaryQuestionId, ScopeState } from "@/components/modern-jobs/scope/ScopeTypes";
import { vtCrossTableIssues } from "./vt-cross-table";
import { vt53Issue } from "./vt-infrastructure-check";
import {
  ACTIVITIES_TABLE_FIELDS,
  ACTIVITIES_ROW_CAPACITY,
  ACTIVITY_START_DATE_PATTERN,
  type ActivitiesField,
} from "./onefop-activities";
import { KPI_PERIODS, KPI_ROW_KEYS, KPI_ROW_LABELS } from "./onefop-tables";

export interface ValidationIssue {
  fieldId: string;
  message: string;
  cleanMessage?: string;
}

/**
 * Extracts a concise error message by stripping redundant question labels or paper code prefixes.
 * If the issue has cleanMessage or starts with "${label} : " / "${label}: ", returns only the clean instruction.
 */
export function extractCleanErrorMessage(message?: string): string {
  if (!message) return "";
  const colonIdx = message.indexOf(" : ");
  if (colonIdx !== -1 && colonIdx < 160) {
    return message.slice(colonIdx + 3).trim();
  }
  const altColonIdx = message.indexOf(": ");
  if (altColonIdx !== -1 && altColonIdx < 160) {
    return message.slice(altColonIdx + 2).trim();
  }
  return message;
}

// IDs the AST marks required: true but Flutter treats as optional anyway
// (secondary phone numbers) — kOptionalOverrides in field_validator.dart.
export const OPTIONAL_OVERRIDES = new Set([
  "S0Q03_TEL2",
  "S1Q05_TEL2",
  "COOP_S1Q06_TEL2",
  "CTD_S1Q06_TEL2",
  "ONG_S1Q06_TEL2",
  // Dismissal reasons 2 and 3 are marked requiredField in onefop_ast.dart,
  // but a respondent may have only one reason: the S3Q02 grid already
  // requires a reason's text only once its row has a count
  // (quizRequired.missingQuizFieldKeys). Kept optional here so the schema
  // regeneration of 2026-09-28 (which picked up the AST's `required: true`)
  // does not newly block single-reason declarations. Domain decision
  // pending — see docs/onefop-cross-form-hybrid-table-audit.md §K.
  "S3Q02_REASON_2_TEXT",
  "S3Q02_REASON_3_TEXT",
  // PP_S1Q01: entity designation chosen at registration (comp.projectNature)
  // and autofilled; omitted from Section 1 rendering so it does not block
  // completion if somehow missing on a legacy record.
  "PP_S1Q01",
]);

/**
 * True when a respondent may leave the question blank: the schema does not
 * mark it required, or OPTIONAL_OVERRIDES does. The same rule the validator
 * applies to an empty answer (validateField), shared with the wizards'
 * "(facultatif)" label suffix and their "questions left" counts.
 */
export function isOptionalField(field: Pick<OnefopField, "id" | "required">): boolean {
  return !field.required || OPTIONAL_OVERRIDES.has(field.id);
}

// kYearFieldIds in field_validator.dart, plus the training-centre year of
// establishment (VT1_14) and year of last authorization (VT2_15), whose ids
// carry no "year" for isYearField to find.
const YEAR_FIELD_IDS = new Set(["COOP_S1Q03", "CTD_S1Q03", "ONG_S1Q03", "VT1_14", "VT2_15"]);

/**
 * Scalar `number` fields that are counts (people, posts, sites, projects,
 * manuals, devices) and so must hold a whole number. Listed explicitly from
 * public/schemas/onefop.schema.json rather than guessed from the type: a
 * number field that is not certainly a count (VT3_4, a closure length in
 * weeks) is left out and keeps the plain numeric check. Years have their own
 * check (isYearField).
 */
export const COUNT_FIELD_IDS = new Set([
  // Permanent workers / vacancies (enterprise, cooperative, CTD, NGO, project)
  "S1Q10", "S1Q11",
  "COOP_S1Q11", "COOP_S1Q12",
  "CTD_S1Q09", "CTD_S1Q10",
  "ONG_S1Q10", "ONG_S1Q11",
  "PP_S1Q15", "PP_S1Q16",
  // Administration: number of projects / supervised structures
  "ADMIN_S1Q10", "ADMIN_S1Q12",
  // Training centre: sites, trainers, trainees, devices, manuals
  "VT2_3", "VT2_7", "VT2_8",
  "VT2_19", "VT2_20", "VT2_21", "VT2_22",
  "VT2_44", "VT2_45", "VT2_47", "VT2_48",
  "VT3_13", "VT3_14", "VT3_16", "VT3_17", "VT3_19", "VT3_20",
  "VT3_22", "VT3_23", "VT3_25", "VT3_26",
  "VT5_2", "VT5_4",
  "VT8_5_VP_M", "VT8_5_VP_F", "VT8_5_VNP_M", "VT8_5_VNP_F", "VT8_5_PERM_M", "VT8_5_PERM_F",
]);

const WHOLE_COUNT_RE = /^\d+$/;

/** True for a whole, non-negative number written with digits only ("0", "12"). */
export function isWholeCount(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  return WHOLE_COUNT_RE.test(String(value).trim());
}

/**
 * Reading of what a respondent typed into a count input. Nothing is ever
 * rewritten into a different number: "2.5", "12abc" or "-3" are `invalid`
 * (the caller refuses them and says why), never 25, 12 or 3.
 */
export type CountInput =
  | { kind: "empty" }
  | { kind: "count"; text: string; value: number }
  | { kind: "invalid" };

export function parseCountInput(raw: string): CountInput {
  const text = raw.trim();
  if (text === "") return { kind: "empty" };
  if (!WHOLE_COUNT_RE.test(text)) return { kind: "invalid" };
  return { kind: "count", text, value: parseInt(text, 10) };
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) {
    return value.length === 0 || value.every((item) => String(item ?? "").trim() === "");
  }
  return false;
}

function isYearField(field: OnefopField): boolean {
  return YEAR_FIELD_IDS.has(field.id) || (field.type === "number" && field.id.toLowerCase().includes("year"));
}

// Cameroon phone convention: exactly 9 digits, landline (2) or mobile (6)
function isValidPhone(v: string): boolean {
  return v.length === 9 && (v[0] === "2" || v[0] === "6");
}

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v);
}

/**
 * 2.1.13 "Date de l'arrêté d'accréditation" (VT2_17): a text answer stored as
 * DD/MM/YYYY ("15/03/2019"). The format is checked, the storage unchanged.
 */
export const VT_DATE_FIELD_ID = "VT2_17";
const DMY_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** A real calendar date written DD/MM/YYYY, from 1900 to today. */
export function isValidDayMonthYear(v: string, today: Date = new Date()): boolean {
  const m = DMY_RE.exec(v);
  if (!m) return false;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false;
  return year >= 1900 && date.getTime() <= today.getTime();
}

/** The one wording of the whole-number error, for fields, cells and inputs. */
const WHOLE_NUMBER_FR = "Saisissez un nombre entier";
const WHOLE_NUMBER_EN = "Enter a whole number";

/** Shown when a count input is refused (decimal, sign, letters). */
export function wholeNumberMessage(locale?: ValidationLocale): string {
  return msg(`${WHOLE_NUMBER_FR} (ex. 12)`, `${WHOLE_NUMBER_EN} (e.g. 12)`, locale);
}

function fieldIssue(field: OnefopField, message: string, cleanMessage?: string): ValidationIssue {
  return { fieldId: field.id, message, cleanMessage };
}

/**
 * Message language. When omitted, messages stay bilingual ("FR/ EN") as in
 * Flutter's field_validator.dart; when a locale is given (the React wizards
 * pass the active one), only that language is used.
 */
export type ValidationLocale = "fr" | "en" | undefined;

function msg(fr: string, en: string, locale: ValidationLocale, sep = "/ "): string {
  if (locale === "fr") return fr;
  if (locale === "en") return en;
  return `${fr}${sep}${en}`;
}

/** "Label : message" (French spacing) or "Label: message" in English. */
function labelled(label: string, fr: string, en: string, locale: ValidationLocale, sep?: string): string {
  return `${label}${locale === "en" ? ": " : " : "}${msg(fr, en, locale, sep)}`;
}

function textIn(text: Parameters<typeof bilingual>[0], locale: ValidationLocale): string {
  return locale ? localized(text, locale) : bilingual(text);
}

function fieldLabel(field: OnefopField, locale?: ValidationLocale): string {
  return textIn(field.label, locale) || field.id;
}

/** One field's format/required error, or null if it passes */
function validateField(
  field: OnefopField,
  data: FormData,
  locale?: ValidationLocale,
  territoryTree?: LocationRegion[],
): ValidationIssue | null {
  if (!isFieldVisible(field, data)) return null;

  const raw = data[field.id];
  const v = raw === undefined || raw === null ? "" : String(raw).trim();

  // Required-ness only decides whether an EMPTY answer is an error. Any value
  // that is given — on an optional field too (Téléphone 2, VT2_12 e-mail) —
  // must pass the same format checks below.
  const empty = field.id === "VT9_4" && Array.isArray(raw)
    ? String(raw[0] ?? "").trim() === ""
    : isEmpty(raw !== undefined && raw !== null && typeof raw === "object" ? raw : v);

  if (empty) {
    if (!field.required || OPTIONAL_OVERRIDES.has(field.id)) return null;
    const cleanMsg = msg("Champ obligatoire", "Required field", locale);
    return fieldIssue(field, labelled(fieldLabel(field, locale), "Champ obligatoire", "Required field", locale), cleanMsg);
  }

  if (field.type === "tel" && !isValidPhone(v)) {
    const cleanMsg = v.length !== 9
      ? msg("Le numéro doit contenir exactement 9 chiffres", "Number must be exactly 9 digits", locale)
      : msg("Le numéro doit commencer par 2 (fixe) ou 6 (mobile)", "Number must start with 2 (landline) or 6 (mobile)", locale);
    return fieldIssue(
      field,
      v.length !== 9
        ? labelled(fieldLabel(field, locale), "Le numéro doit contenir exactement 9 chiffres", "Number must be exactly 9 digits", locale)
        : labelled(fieldLabel(field, locale), "Le numéro doit commencer par 2 (fixe) ou 6 (mobile)", "Number must start with 2 (landline) or 6 (mobile)", locale),
      cleanMsg,
    );
  }

  if (field.type === "email" && !isValidEmail(v)) {
    const cleanMsg = msg("Veuillez entrer une adresse e-mail valide", "Please enter a valid email address", locale);
    return fieldIssue(
      field,
      labelled(fieldLabel(field, locale), "Veuillez entrer une adresse e-mail valide", "Please enter a valid email address", locale),
      cleanMsg,
    );
  }

  if (field.id === VT_DATE_FIELD_ID && !isValidDayMonthYear(v)) {
    const fr = "Saisissez une date réelle au format JJ/MM/AAAA, pas dans le futur (ex. 15/03/2019)";
    const en = "Enter a real date as DD/MM/YYYY, not in the future (e.g. 15/03/2019)";
    return fieldIssue(field, labelled(fieldLabel(field, locale), fr, en, locale), msg(fr, en, locale));
  }

  if (field.type === "number" && isYearField(field)) {
    const year = Number(v);
    if (!Number.isInteger(year)) {
      const cleanMsg = msg("Veuillez entrer une année valide", "Please enter a valid year", locale);
      return fieldIssue(field, labelled(fieldLabel(field, locale), "Veuillez entrer une année valide", "Please enter a valid year", locale), cleanMsg);
    }
    if (year < 1900) {
      const cleanMsg = msg("L'année doit être ≥ 1900", "Year must be ≥ 1900", locale);
      return fieldIssue(field, labelled(fieldLabel(field, locale), "L'année doit être ≥ 1900", "Year must be ≥ 1900", locale), cleanMsg);
    }
    const currentYear = new Date().getFullYear();
    if (year > currentYear) {
      const cleanMsg = msg(`L'année doit être ≤ ${currentYear}`, `Year must be ≤ ${currentYear}`, locale);
      return fieldIssue(field, labelled(fieldLabel(field, locale), `L'année doit être ≤ ${currentYear}`, `Year must be ≤ ${currentYear}`, locale), cleanMsg);
    }
  }

  // V3 fix: non-year numeric fields must contain a valid number so that
  // strings like "N/A", "abc", or comma-formatted "1,000" never reach the
  // SPSS payload as non-numeric values.
  if (field.type === "number" && !isYearField(field) && v !== "") {
    const num = Number(v.replace(/\s/g, ""));
    if (Number.isNaN(num)) {
      const cleanMsg = msg("Veuillez entrer une valeur numérique", "Please enter a numeric value", locale);
      return fieldIssue(field, labelled(fieldLabel(field, locale), "Veuillez entrer une valeur numérique", "Please enter a numeric value", locale), cleanMsg);
    }
    if (num < 0) {
      const cleanMsg = msg("La valeur doit être ≥ 0", "Value must be ≥ 0", locale);
      return fieldIssue(field, labelled(fieldLabel(field, locale), "La valeur doit être ≥ 0", "Value must be ≥ 0", locale), cleanMsg);
    }
    if (COUNT_FIELD_IDS.has(field.id) && !isWholeCount(v.replace(/\s/g, ""))) {
      const cleanMsg = msg(WHOLE_NUMBER_FR, WHOLE_NUMBER_EN, locale);
      return fieldIssue(field, labelled(fieldLabel(field, locale), WHOLE_NUMBER_FR, WHOLE_NUMBER_EN, locale), cleanMsg);
    }
  }

  // Cameroon administrative geography hierarchical consistency
  if (field.id.endsWith("_DEPT")) {
    const prefix = field.id.replace(/_DEPT$/, "");
    const regionKey = `${prefix}_REGION`;
    const regionVal = data[regionKey] ? String(data[regionKey]).trim() : "";
    if (regionVal && v && territoryTree) {
      const geoCheck = validateCameroonGeography(territoryTree, regionVal, v);
      if (!geoCheck.valid && geoCheck.errorField === "department" && geoCheck.errorMessage) {
        const cleanMsg = msg(geoCheck.errorMessage.fr, geoCheck.errorMessage.en, locale, " / ");
        return fieldIssue(
          field,
          labelled(fieldLabel(field, locale), geoCheck.errorMessage.fr, geoCheck.errorMessage.en, locale, " / "),
          cleanMsg,
        );
      }
    }
  }

  if (field.id.endsWith("_SUBDIV")) {
    const prefix = field.id.replace(/_SUBDIV$/, "");
    const regionKey = `${prefix}_REGION`;
    const deptKey = `${prefix}_DEPT`;
    const regionVal = data[regionKey] ? String(data[regionKey]).trim() : "";
    const deptVal = data[deptKey] ? String(data[deptKey]).trim() : "";
    if (deptVal && v && territoryTree) {
      const geoCheck = validateCameroonGeography(territoryTree, regionVal || undefined, deptVal, v);
      if (!geoCheck.valid && geoCheck.errorField === "subdivision" && geoCheck.errorMessage) {
        const cleanMsg = msg(geoCheck.errorMessage.fr, geoCheck.errorMessage.en, locale, " / ");
        return fieldIssue(
          field,
          labelled(fieldLabel(field, locale), geoCheck.errorMessage.fr, geoCheck.errorMessage.en, locale, " / "),
          cleanMsg,
        );
      }
    }
  }

  // Legacy VT geography fields
  if (field.id === "VT1_5") {
    const regionVal = data.VT1_4 ? String(data.VT1_4).trim() : "";
    if (regionVal && v && territoryTree) {
      const geoCheck = validateCameroonGeography(territoryTree, regionVal, v);
      if (!geoCheck.valid && geoCheck.errorField === "department" && geoCheck.errorMessage) {
        const cleanMsg = msg(geoCheck.errorMessage.fr, geoCheck.errorMessage.en, locale, " / ");
        return fieldIssue(
          field,
          labelled(fieldLabel(field, locale), geoCheck.errorMessage.fr, geoCheck.errorMessage.en, locale, " / "),
          cleanMsg,
        );
      }
    }
  }

  if (field.id === "VT1_6") {
    const regionVal = data.VT1_4 ? String(data.VT1_4).trim() : "";
    const deptVal = data.VT1_5 ? String(data.VT1_5).trim() : "";
    if (deptVal && v && territoryTree) {
      const geoCheck = validateCameroonGeography(territoryTree, regionVal || undefined, deptVal, v);
      if (!geoCheck.valid && geoCheck.errorField === "subdivision" && geoCheck.errorMessage) {
        const cleanMsg = msg(geoCheck.errorMessage.fr, geoCheck.errorMessage.en, locale, " / ");
        return fieldIssue(
          field,
          labelled(fieldLabel(field, locale), geoCheck.errorMessage.fr, geoCheck.errorMessage.en, locale, " / "),
          cleanMsg,
        );
      }
    }
  }

  return null;
}

/** A cell of a started activities line that is still blank. */
export interface MissingActivitiesCell {
  /** Row slot, 1…rowCapacity (the id's own number, not its position on screen). */
  row: number;
  /** Column definition, for the name to put in the message. */
  field: ActivitiesField;
  cellId: string;
}

/**
 * The cells the activities table (project Section 2) still owes: a line counts
 * as started once any of its cells holds something, and a started line must be
 * complete. One rule, two readers — the validator below for its messages and
 * ActivitiesTableRenderer to mark the boxes, so what the summary names and what
 * the grid highlights cannot drift apart.
 */
export function missingActivitiesCells(field: OnefopField, data: FormData): MissingActivitiesCell[] {
  const prefix = field.table?.id ?? field.id;
  const rowCount = field.table?.rowCapacity ?? ACTIVITIES_ROW_CAPACITY;
  const missing: MissingActivitiesCell[] = [];

  for (let n = 1; n <= rowCount; n++) {
    const rowCells = ACTIVITIES_TABLE_FIELDS.map((f) => {
      const cellId = `${prefix}_row${n}_${f.key}`;
      const val = data[cellId];
      return { field: f, cellId, isEntered: isEnteredValue(val) && String(val).trim() !== "" };
    });
    if (!rowCells.some((c) => c.isEntered)) continue;
    for (const cell of rowCells) {
      if (!cell.isEntered) missing.push({ row: n, field: cell.field, cellId: cell.cellId });
    }
  }

  return missing;
}

/**
 * Validates a table-shaped field:
 *  1. Non-negative values across all numeric cells
 *  2. Required table presence (e.g. S21Q01 workforce or mandatory VT tables)
 *  3. Required cells within active rows
 */
function validateActivitiesTable(
  field: OnefopField,
  data: FormData,
  locale?: ValidationLocale,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const prefix = field.table?.id ?? field.id;
  const rowCount = field.table?.rowCapacity ?? ACTIVITIES_ROW_CAPACITY;
  const label = fieldLabel(field, locale);

  for (const cell of missingActivitiesCells(field, data)) {
    const fieldName = textIn(cell.field.label, locale);
    issues.push({
      fieldId: cell.cellId,
      message: labelled(
        label,
        `Ligne ${cell.row} : le champ « ${fieldName} » est requis`,
        `Row ${cell.row}: the field "${fieldName}" is required`,
        locale,
      ),
    });
  }

  for (let n = 1; n <= rowCount; n++) {
    const cellId = `${prefix}_row${n}_duration`;
    const val = data[cellId];
    if (!(isEnteredValue(val) && String(val).trim() !== "")) continue;
    const num = Number(val);
    if (Number.isNaN(num) || num < 0) {
      issues.push({
        fieldId: cellId,
        message: labelled(
          label,
          `Ligne ${n} : la durée doit être un nombre ≥ 0`,
          `Row ${n}: duration must be a number ≥ 0`,
          locale,
        ),
      });
    }
  }

  // The start date is free text with an MM/AAAA hint and nothing checking it,
  // so « l'an dernier » or « 12-24 » reached PP_S2_ACT_nn_START as typed. The
  // month is 01–12 and the year has four digits; a year is not guessed at or
  // bounded — a project may have begun long before the platform did.
  for (let n = 1; n <= rowCount; n++) {
    const cellId = `${prefix}_row${n}_startDate`;
    const val = data[cellId];
    if (!(isEnteredValue(val) && String(val).trim() !== "")) continue;
    if (!ACTIVITY_START_DATE_PATTERN.test(String(val).trim())) {
      issues.push({
        fieldId: cellId,
        message: labelled(
          label,
          `Ligne ${n} : la date de début s'écrit MM/AAAA (ex. 03/2026)`,
          `Row ${n}: the start date is written MM/YYYY (e.g. 03/2026)`,
          locale,
        ),
      });
    }
  }

  return issues;
}

/**
 * The project's Section 3 outcomes table (kpi_period_table) is the one table
 * nothing used to check. It carries no response status of its own — the paper
 * form has no selector for it — so `isReported` below was never true, the
 * untemplated fallback never ran, and the server's own completeness check,
 * which walks the REPORTED tables, never saw it either. A project could tick
 * « Demandeurs d'emploi insérés en emploi salarié » in the preliminary
 * questionnaire and file Section 3 blank.
 *
 * What it owes is what the quiz says happened: the « Réalisations » figure of
 * every outcome ticked there. A row that was not ticked already holds the 0
 * the quiz wrote for it, and « aucun bénéficiaire » zeroes all four.
 *
 * The two outlook columns are NOT required. They are forecasts, and which
 * December and which June they mean is still ONEFOP's to say (E2E 2026-10-19):
 * a column whose reference period is undecided cannot be demanded of a
 * respondent. They stay blank until that is settled.
 */
export function missingOutcomeCells(field: OnefopField, data: FormData): string[] {
  if (field.table?.template !== "kpi_period_table") return [];
  const prefix = field.table.id ?? field.id;
  const scope = (data._scopeConfig as Record<string, unknown> | undefined)?.projectProgram as
    | { completedAt?: string; noOutcomes?: boolean; outcomes?: string[] }
    | undefined;
  // An unfinished quiz is reported once, by validateEntityData; until it is
  // answered there is nothing to say this table owes.
  if (!scope?.completedAt || scope.noOutcomes) return [];
  const ticked = Array.isArray(scope.outcomes) ? scope.outcomes : [];
  return KPI_ROW_KEYS
    .filter((row) => ticked.includes(row))
    .map((row) => `${prefix}_${row}_current`)
    .filter((cellId) => !isEnteredValue(data[cellId]));
}

function validateOutcomesTable(
  field: OnefopField,
  data: FormData,
  locale?: ValidationLocale,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const prefix = field.table?.id ?? field.id;
  const label = fieldLabel(field, locale);

  for (const row of KPI_ROW_KEYS) {
    for (const period of KPI_PERIODS) {
      const cellId = `${prefix}_${row}_${period}`;
      const val = data[cellId];
      if (!isEnteredValue(val)) continue;
      const num = Number(val);
      if (Number.isNaN(num) || num < 0) {
        issues.push({
          fieldId: cellId,
          message: labelled(label, "La valeur ne peut pas être négative", "Value cannot be negative", locale),
          cleanMessage: msg("La valeur ne peut pas être négative", "Value cannot be negative", locale),
        });
      } else if (!isWholeCount(val)) {
        issues.push({
          fieldId: cellId,
          message: labelled(label, WHOLE_NUMBER_FR, WHOLE_NUMBER_EN, locale),
          cleanMessage: msg(WHOLE_NUMBER_FR, WHOLE_NUMBER_EN, locale),
        });
      }
    }
  }

  const missing = missingOutcomeCells(field, data);
  if (missing.length > 0) {
    // The rows by name, not a cell count: there are four of them and the
    // respondent named them in the quiz a screen ago.
    const names = missing
      .map((cellId) => KPI_ROW_KEYS.findIndex((row) => cellId.endsWith(`_${row}_current`)))
      .filter((i) => i >= 0)
      .map((i) => textIn(KPI_ROW_LABELS[i], locale).toLowerCase());
    const list = names.join(locale === "en" ? ", " : ", ");
    issues.push({
      fieldId: field.id,
      message:
        locale === "en"
          ? `${label}: enter the achievements for the period (${list}). Enter 0 where there was nothing.`
          : `${label} : indiquez les réalisations de la période (${list}). Saisissez 0 lorsqu'il n'y a rien à déclarer.`,
      cleanMessage:
        locale === "en"
          ? `Enter the achievements for the period (${list}). Enter 0 where there was nothing.`
          : `Indiquez les réalisations de la période (${list}). Saisissez 0 lorsqu'il n'y a rien à déclarer.`,
    });
  }

  return issues;
}

function validateTableField(field: OnefopField, data: FormData, locale?: ValidationLocale): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isFieldVisible(field, data)) return issues;

  if (field.table?.template === "activities_table") {
    return validateActivitiesTable(field, data, locale);
  }

  if (field.table?.template === "kpi_period_table") {
    return validateOutcomesTable(field, data, locale);
  }

  const prefix = field.table?.id ?? field.id;
  const label = fieldLabel(field, locale);

  // Training-centre tables: the preliminary quiz (vt-quiz.ts) decides which
  // apply. Only a REPORTED one is checked — its number cells must not be
  // negative and missingVtTableCells lists what is left to fill. A table
  // whose quiz question is unanswered is not flagged here: the unanswered
  // quiz is reported once, by validateEntityData.
  const vt = field.table?.vt;
  if (vt && field.table?.matrix) {
    if (vtTableStatus(field.id, data) !== "REPORTED") return issues;
    field.table.matrix.forEach((rowIds) =>
      rowIds.forEach((cellId, c) => {
        if (vt.cells[c]?.kind !== "number" || !isEnteredValue(data[cellId])) return;
        const num = Number(data[cellId]);
        if (Number.isNaN(num) || num < 0) {
          issues.push({
            fieldId: cellId,
            message: labelled(label, "La valeur doit être un nombre ≥ 0", "Value must be a number ≥ 0", locale),
          });
        } else if (!isWholeCount(data[cellId])) {
          // Every number cell of the training-centre tables is a headcount or
          // a count of rooms / furniture / places: a whole number.
          issues.push({
            fieldId: cellId,
            message: labelled(label, WHOLE_NUMBER_FR, WHOLE_NUMBER_EN, locale),
          });
        }
      }),
    );
    const missing = missingVtTableCells(field, data);
    if (missing.length === 1 && missing[0] === field.id) {
      // Only a quiz-gated table owes its row to a "Oui": an always-applicable
      // one (8.8, 5.2…) must not cite a quiz answer the respondent never gave.
      const gated = vtQuizQuestionForTable(field.id) !== undefined;
      issues.push({
        fieldId: field.id,
        message: labelled(
          label,
          gated
            ? "Ajoutez au moins une ligne (réponse « Oui » au questionnaire préliminaire)"
            : "Ajoutez au moins une ligne",
          gated
            ? "Add at least one row (you answered Yes in the preliminary questionnaire)"
            : "Add at least one row",
          locale,
        ),
      });
    } else if (missing.length > 0) {
      // What is missing decides what to advise (audit R6): "enter 0" means
      // nothing for a specialty to type or a Yes/No to pick, and told a
      // respondent of 5.2 or 8.8 to do something impossible.
      const kindOf = new Map<string, string | undefined>();
      field.table.matrix.forEach((rowIds) => rowIds.forEach((id, c) => kindOf.set(id, vt.cells[c]?.kind)));
      const counts = missing.filter((id) => kindOf.get(id) === "number").length;
      // Real plurals, not "answer(s)": "1 answer still to fill", "2 cells".
      const n = missing.length;
      const answersLeft = locale === "en"
        ? `${n} ${n === 1 ? "answer" : "answers"} still to fill.`
        : `${n} ${n === 1 ? "réponse reste" : "réponses restent"} à renseigner.`;
      const cellsLeft = locale === "en"
        ? `${n} ${n === 1 ? "cell" : "cells"} still to fill.`
        : `${n} ${n === 1 ? "cellule reste" : "cellules restent"} à renseigner.`;
      issues.push({
        fieldId: field.id,
        message:
          counts === 0
            ? `${label}${locale === "en" ? ":" : " :"} ${answersLeft}`
            : counts === missing.length
              ? locale === "en"
                ? `${label}: ${cellsLeft} Enter 0 where nothing occurred.`
                : `${label} : ${cellsLeft} Saisissez 0 lorsqu'il n'y a rien à déclarer.`
              : locale === "en"
                ? `${label}: ${cellsLeft} Enter 0 in the counts where nothing occurred.`
                : `${label} : ${cellsLeft} Saisissez 0 dans les effectifs lorsqu'il n'y a rien à déclarer.`,
      });
    }
    return issues;
  }

  // A table the quiz answered "Non" (NONE) is inactive and not a required
  // validation target. "NOT_APPLICABLE" is no longer an answer: one left in an
  // old draft counts as no status at all.
  const cleanId = field.id.replace(/_ENTERPRISE|_OTHER/i, "");
  const rawStatus =
    data[`${field.id}_RESPONSE_STATUS`] ??
    data[`${field.id.toUpperCase()}_RESPONSE_STATUS`] ??
    data[`${field.id.toLowerCase()}_RESPONSE_STATUS`] ??
    (field.paperCode ? data[`${field.paperCode}_RESPONSE_STATUS`] : undefined) ??
    (field.paperCode ? data[`${field.paperCode.toUpperCase()}_RESPONSE_STATUS`] : undefined) ??
    data[`${cleanId}_RESPONSE_STATUS`] ??
    data[`${cleanId.toUpperCase()}_RESPONSE_STATUS`];
  const responseStatus = rawStatus === "NOT_APPLICABLE" ? undefined : rawStatus;

  if (responseStatus === "NONE") {
    return issues;
  }

  let hasAnyData = false;

  // Check all data keys belonging to this table
  for (const [key, val] of Object.entries(data)) {
    if (key.startsWith(prefix) && isEnteredValue(val)) {
      hasAnyData = true;
      const num = Number(val);
      if (Number.isNaN(num) || num < 0) {
        issues.push({
          fieldId: key,
          message: labelled(
            label,
            "La valeur ne peut pas être négative",
            "Value cannot be negative",
            locale,
          ),
          cleanMessage: msg(
            "La valeur ne peut pas être négative",
            "Value cannot be negative",
            locale,
          ),
        });
      }
    }
  }

  // A table with REPORTED status must have EVERY applicable cell explicitly completed.
  // 0 is valid; blank/null/undefined is invalid.
  const isReported = responseStatus === "REPORTED" || (!responseStatus && field.required);
  if (isReported) {
    const definition = getModernJobsTableDefinition(field, data) ?? getGuidedOnlyTableDefinition(field, data);
    if (definition) {
      const missingKeys = missingQuizFieldKeys(definition, data);
      const cellMissingKeys = missingKeys.filter((k) => !k.endsWith("_TEXT"));
      if (cellMissingKeys.length > 0) {
        const cleanMsg = locale === "en"
          ? `${cellMissingKeys.length} ${cellMissingKeys.length === 1 ? "cell" : "cells"} still to fill. Enter 0 where there was nothing.`
          : `${cellMissingKeys.length} ${cellMissingKeys.length === 1 ? "cellule reste" : "cellules restent"} à renseigner. Saisissez 0 lorsqu'il n'y a rien à déclarer.`;
        issues.push({
          fieldId: field.id,
          // Real plurals and a shorter sentence: what is missing, then what to do.
          message: locale === "en" ? `${label}: ${cleanMsg}` : `${label} : ${cleanMsg}`,
          cleanMessage: cleanMsg,
        });
      }
      return issues;
    }

    // Untemplated fallback: if table is required/reported and completely empty
    if (!hasAnyData) {
      issues.push({
        fieldId: field.id,
        message: labelled(
          label,
          "Tableau obligatoire — veuillez renseigner les données requises",
          "Required table — please fill required entries",
          locale,
        ),
        cleanMessage: msg(
          "Tableau obligatoire — veuillez renseigner les données requises",
          "Required table — please fill required entries",
          locale,
        ),
      });
    }
  }

  return issues;
}

function validateFields(
  fields: OnefopField[],
  data: FormData,
  locale?: ValidationLocale,
  territoryTree?: LocationRegion[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const field of fields) {
    if (isCompanionHiddenByGateway(field, data, fields)) continue;
    if (field.table) {
      issues.push(...validateTableField(field, data, locale));
    } else {
      const issue = validateField(field, data, locale, territoryTree);
      if (issue) issues.push(issue);
    }
  }
  return issues;
}

const QUIZ_QUESTION_LABELS: Record<PrimaryQuestionId, { fr: string; en: string }> = {
  applications: { fr: "Demandes d'emploi", en: "Job applications" },
  recruitment: { fr: "Recrutements", en: "Recruitment" },
  primo_seekers: { fr: "Primo-demandeurs d'emploi", en: "First-time job seekers" },
  primo_workers: { fr: "Primo-recrutements", en: "First-time recruitments" },
  departures: { fr: "Départs", en: "Departures" },
  interns: { fr: "Stagiaires", en: "Interns" },
  skills: { fr: "Besoins en compétences", en: "Skills needs" },
  training: { fr: "Besoins en formation", en: "Training needs" },
};

/** Field id carried by quiz issues, so "Corriger" can route to the quiz. */
export const QUIZ_ISSUE_FIELD_ID = "_scopeConfig";

/**
 * Every applicable Preliminary Declaration Quiz question — and its required
 * follow-ups — must be answered before final submission. An unanswered
 * question is never read as "No" (see QuizSemantics).
 */
function validateQuiz(entity: OnefopEntity, data: FormData, locale?: ValidationLocale): ValidationIssue[] {
  return incompleteQuizQuestions(entity, data).map((qId) => {
    const name = QUIZ_QUESTION_LABELS[qId];
    return {
      fieldId: QUIZ_ISSUE_FIELD_ID,
      message: labelled(
        `${msg("Questionnaire préliminaire", "Preliminary questionnaire", locale)} — ${locale ? name[locale] : `${name.fr}/ ${name.en}`}`,
        "question sans réponse ou précisions manquantes",
        "question unanswered or follow-up details missing",
        locale,
      ),
    };
  });
}

/**
 * Validates all fields in an entity questionnaire.
 */
export function validateEntityData(
  entity: OnefopEntity,
  data: FormData,
  locale?: ValidationLocale,
  territoryTree?: LocationRegion[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [...validateQuiz(entity, data, locale)];

  // PP quiz completeness: the ProjectProgram scope quiz must be completed
  // (completedAt present) before final submission. Without it the PP quiz
  // semantics function cannot derive _RESPONSE_STATUS values, leaving every
  // table ungated and potentially full of phantom zeros from earlier
  // navigation. The regular quiz path (validateQuiz → incompleteQuizQuestions)
  // does not cover PP because PP is in QUIZ_SEMANTICS_EXCLUDED_ENTITIES.
  if (entity.entityType === "vocationalTraining" && !isVtCentreClosed(data) && !isVtQuizComplete(readVtQuiz(data))) {
    issues.push({
      fieldId: QUIZ_ISSUE_FIELD_ID,
      message: msg(
        "Questionnaire préliminaire — à compléter avant la soumission finale : il détermine les tableaux à renseigner.",
        "Preliminary questionnaire — must be completed before final submission: it decides which tables to fill.",
        locale,
        " / ",
      ),
    });
  }

  if (entity.entityType === "projectProgram") {
    const scopeRaw = (data._scopeConfig as Record<string, unknown> | undefined);
    const ppCfg = scopeRaw && (scopeRaw.projectProgram as { completedAt?: string } | undefined);
    if (!ppCfg?.completedAt) {
      issues.push({
        fieldId: QUIZ_ISSUE_FIELD_ID,
        message: locale === "en"
          ? "Project/Programme preliminary questionnaire — must be completed before final submission."
          : locale === "fr"
            ? "Questionnaire préliminaire Projet/Programme — doit être complété avant la soumission finale."
            : "Questionnaire préliminaire Projet/Programme — doit être complété avant la soumission finale. / Project/Programme preliminary questionnaire — must be completed before final submission.",
      });
    }
  }

  // Tables are checked as the submission will treat them: status from the
  // quiz wherever the form holds none (or a leftover "NOT_APPLICABLE").
  const tableView = withQuizDerivedStatuses(entity, data);
  for (const section of entity.sections) {
    if (isVtSectionWaived(section.id, data)) continue;
    issues.push(...validateFields(section.fields, tableView, locale, territoryTree));
  }

  // Training centres: breakdowns of the same learners / trainers must agree
  // (vt-cross-table.ts). Blocking, like the section-level check.
  if (entity.entityType === "vocationalTraining") {
    const allFields = entity.sections.flatMap((sec) => sec.fields);
    issues.push(...crossTableIssues(allFields, data, locale));
    issues.push(...vtSubsetIssues(allFields, data, locale));
  }

  for (const section of entity.sections) {
    if (isVtSectionWaived(section.id, data)) continue;
    issues.push(...companionTableIssues(section.fields, tableView, locale));
  }

  return issues;
}

export interface CompanionTableSpec {
  tableCode: string;
  tablePrefix: string;
  isGated: (scope: ScopeState | null, data: FormData) => boolean;
  slots: Array<{
    slot: number;
    textKey: string;
    rowKey: string;
    missingTextMsg: { fr: string; en: string };
    missingCountsMsg: { fr: string; en: string };
  }>;
}

export const COMPANION_TABLE_SPECS: CompanionTableSpec[] = [
  {
    tableCode: "S3Q02",
    tablePrefix: "s3q02",
    isGated: (scope, data) => {
      const status = (data.S3Q02_RESPONSE_STATUS ?? data.s3q02_RESPONSE_STATUS) as string | undefined;
      if (status === "NONE") return true;
      if (status === "REPORTED") return false;
      if (!scope) return false;
      return scope.departures === false || (Array.isArray(scope.departure_reasons) && !scope.departure_reasons.includes("licenciement"));
    },
    slots: [
      {
        slot: 2,
        textKey: "S3Q02_REASON_2_TEXT",
        rowKey: "reason_2",
        missingTextMsg: {
          fr: "La description du motif est obligatoire lorsqu'un effectif est saisi pour cette ligne.",
          en: "Dismissal reason description is required when a count is entered for this row.",
        },
        missingCountsMsg: {
          fr: "Les effectifs sont obligatoires pour ce motif de licenciement.",
          en: "Headcounts are required for this dismissal reason.",
        },
      },
      {
        slot: 3,
        textKey: "S3Q02_REASON_3_TEXT",
        rowKey: "reason_3",
        missingTextMsg: {
          fr: "La description du motif est obligatoire lorsqu'un effectif est saisi pour cette ligne.",
          en: "Dismissal reason description is required when a count is entered for this row.",
        },
        missingCountsMsg: {
          fr: "Les effectifs sont obligatoires pour ce motif de licenciement.",
          en: "Headcounts are required for this dismissal reason.",
        },
      },
    ],
  },
  {
    tableCode: "S4Q02",
    tablePrefix: "s4q02",
    isGated: (scope, data) => {
      const status = (data.S4Q02_RESPONSE_STATUS ?? data.s4q02_RESPONSE_STATUS) as string | undefined;
      if (status === "NONE") return true;
      if (status === "REPORTED") return false;
      if (!scope) return false;
      return scope.skills_needs === false;
    },
    slots: [
      {
        slot: 2,
        textKey: "S4Q02_DOMAIN_2_TEXT",
        rowKey: "skill_2",
        missingTextMsg: {
          fr: "Le domaine de compétence est obligatoire lorsqu'un effectif est saisi pour cette ligne.",
          en: "Skill domain description is required when a count is entered for this row.",
        },
        missingCountsMsg: {
          fr: "Les effectifs sont obligatoires pour ce domaine de compétence.",
          en: "Headcounts are required for this skill domain.",
        },
      },
      {
        slot: 3,
        textKey: "S4Q02_DOMAIN_3_TEXT",
        rowKey: "skill_3",
        missingTextMsg: {
          fr: "Le domaine de compétence est obligatoire lorsqu'un effectif est saisi pour cette ligne.",
          en: "Skill domain description is required when a count is entered for this row.",
        },
        missingCountsMsg: {
          fr: "Les effectifs sont obligatoires pour ce domaine de compétence.",
          en: "Headcounts are required for this skill domain.",
        },
      },
    ],
  },
  {
    tableCode: "S4Q03",
    tablePrefix: "s4q03",
    isGated: (scope, data) => {
      const status = (data.S4Q03_RESPONSE_STATUS ?? data.s4q03_RESPONSE_STATUS) as string | undefined;
      if (status === "NONE") return true;
      if (status === "REPORTED") return false;
      if (!scope) return false;
      return scope.training_needs === false;
    },
    slots: [
      {
        slot: 2,
        textKey: "S4Q03_DOMAIN_2_TEXT",
        rowKey: "domain_2",
        missingTextMsg: {
          fr: "Le domaine de formation est obligatoire lorsqu'un effectif est saisi pour cette ligne.",
          en: "Training domain description is required when a count is entered for this row.",
        },
        missingCountsMsg: {
          fr: "Les effectifs sont obligatoires pour ce domaine de formation.",
          en: "Headcounts are required for this training domain.",
        },
      },
      {
        slot: 3,
        textKey: "S4Q03_DOMAIN_3_TEXT",
        rowKey: "domain_3",
        missingTextMsg: {
          fr: "Le domaine de formation est obligatoire lorsqu'un effectif est saisi pour cette ligne.",
          en: "Training domain description is required when a count is entered for this row.",
        },
        missingCountsMsg: {
          fr: "Les effectifs sont obligatoires pour ce domaine de formation.",
          en: "Headcounts are required for this training domain.",
        },
      },
    ],
  },
];

export function companionTableIssues(
  fields: OnefopField[],
  data: FormData,
  locale?: ValidationLocale,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const scope = readQuizScope(data);

  for (const spec of COMPANION_TABLE_SPECS) {
    const hasTable = fields.some(
      (f) => f.id.toUpperCase() === spec.tableCode || f.paperCode?.toUpperCase() === spec.tableCode,
    );
    if (!hasTable) continue;
    if (spec.isGated(scope, data)) continue;

    for (const slot of spec.slots) {
      const textRaw = data[slot.textKey];
      const hasText = textRaw !== undefined && textRaw !== null && String(textRaw).trim().length > 0;

      const prefix = `${spec.tablePrefix}_${slot.rowKey}_`;
      const hasPositiveCount = Object.entries(data).some(([k, v]) => {
        const lk = k.toLowerCase();
        if (!lk.startsWith(prefix) || lk === slot.textKey.toLowerCase()) return false;
        const n = typeof v === "number" ? v : Number(v);
        return !Number.isNaN(n) && n > 0;
      });

      if (hasPositiveCount && !hasText) {
        issues.push({
          fieldId: slot.textKey,
          message: locale === "en" ? slot.missingTextMsg.en : slot.missingTextMsg.fr,
        });
      }

      if (hasText && !hasPositiveCount) {
        const maleKey = `${spec.tablePrefix}_${slot.rowKey}_male`;
        const femaleKey = `${spec.tablePrefix}_${slot.rowKey}_female`;
        const maleEntered = isEnteredValue(data[maleKey]) && !Number.isNaN(Number(data[maleKey]));
        const femaleEntered = isEnteredValue(data[femaleKey]) && !Number.isNaN(Number(data[femaleKey]));
        const targetId = !maleEntered ? maleKey : !femaleEntered ? femaleKey : slot.textKey;
        issues.push({
          fieldId: targetId,
          message: locale === "en" ? slot.missingCountsMsg.en : slot.missingCountsMsg.fr,
        });
      }
    }
  }

  return issues;
}

/**
 * Scoped validation for a single section.
 */
export function validateSectionData(
  section: OnefopSection,
  data: FormData,
  locale?: ValidationLocale,
  territoryTree?: LocationRegion[],
): ValidationIssue[] {
  if (isVtSectionWaived(section.id, data)) return [];
  return [
    ...validateFields(section.fields, data, locale, territoryTree),
    ...crossTableIssues(section.fields, data, locale),
    ...companionTableIssues(section.fields, data, locale),
    ...vtSubsetIssues(section.fields, data, locale),
  ];
}

/**
 * Impossible "of which" (dont) values where a subset exceeds its total
 * (e.g. female specialized teachers > total specialized teachers).
 * Warns on entry, blocks on submit (Defect 5).
 */
export function vtSubsetIssues(
  fields: OnefopField[],
  data: FormData,
  locale?: ValidationLocale,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const hasField = (id: string) => fields.some((f) => f.id === id);

  // 1. Rule 2.1.7: VT2_8 (dont femmes) <= VT2_7 (Total formateurs spécialisés)
  if (hasField("VT2_8") && isEnteredValue(data.VT2_7) && isEnteredValue(data.VT2_8)) {
    const tot = Number(data.VT2_7);
    const sub = Number(data.VT2_8);
    if (!Number.isNaN(tot) && !Number.isNaN(sub) && sub > tot) {
      issues.push({
        fieldId: "VT2_8",
        message: msg(
          `Le nombre de femmes (${sub}) ne peut pas dépasser le total des formateurs spécialisés (${tot}).`,
          `Number of women (${sub}) cannot exceed total specialized trainers (${tot}).`,
          locale,
        ),
      });
    }
  }

  // 2. Rule 2.1.15 / 2.1.16: VT2_21 + VT2_22 <= VT2_19 (Total apprenants)
  if ((hasField("VT2_21") || hasField("VT2_22")) && isEnteredValue(data.VT2_19)) {
    const tot = Number(data.VT2_19);
    const sub1 = isEnteredValue(data.VT2_21) ? Number(data.VT2_21) : 0;
    const sub2 = isEnteredValue(data.VT2_22) ? Number(data.VT2_22) : 0;
    if (!Number.isNaN(tot) && (isEnteredValue(data.VT2_21) || isEnteredValue(data.VT2_22))) {
      const sum = sub1 + sub2;
      if (sum > tot) {
        const targetId = hasField("VT2_22") && isEnteredValue(data.VT2_22) ? "VT2_22" : "VT2_21";
        issues.push({
          fieldId: targetId,
          message: msg(
            `La somme des apprenants venant du secondaire (${sum}) ne peut pas dépasser l'effectif total d'apprenants (${tot}).`,
            `Trainees from secondary education (${sum}) cannot exceed total trainees (${tot}).`,
            locale,
          ),
        });
      }
    }
  }

  // 3. Rule 2.2.15: VT2_48 (dont femmes) <= VT2_47 (Total formateurs formés TIC)
  if (hasField("VT2_48") && isEnteredValue(data.VT2_47) && isEnteredValue(data.VT2_48)) {
    const tot = Number(data.VT2_47);
    const sub = Number(data.VT2_48);
    if (!Number.isNaN(tot) && !Number.isNaN(sub) && sub > tot) {
      issues.push({
        fieldId: "VT2_48",
        message: msg(
          `Le nombre de femmes (${sub}) ne peut pas dépasser le total des formateurs formés (${tot}).`,
          `Number of women (${sub}) cannot exceed total trained trainers (${tot}).`,
          locale,
        ),
      });
    }
  }

  // 4. Section 3 trained teachers vs VT2_20 (Total formateurs)
  const sec3Pairs = [
    { m: "VT3_13", f: "VT3_14", code: "3.5" },
    { m: "VT3_16", f: "VT3_17", code: "3.6" },
    { m: "VT3_19", f: "VT3_20", code: "3.7" },
    { m: "VT3_22", f: "VT3_23", code: "3.8" },
    { m: "VT3_25", f: "VT3_26", code: "3.9" },
  ];
  if (isEnteredValue(data.VT2_20)) {
    const totTrainers = Number(data.VT2_20);
    if (!Number.isNaN(totTrainers)) {
      for (const p of sec3Pairs) {
        if (hasField(p.f) || hasField(p.m)) {
          const mVal = isEnteredValue(data[p.m]) ? Number(data[p.m]) : 0;
          const fVal = isEnteredValue(data[p.f]) ? Number(data[p.f]) : 0;
          if (isEnteredValue(data[p.m]) || isEnteredValue(data[p.f])) {
            const sum = mVal + fVal;
            if (sum > totTrainers) {
              const targetId = hasField(p.f) && isEnteredValue(data[p.f]) ? p.f : p.m;
              issues.push({
                fieldId: targetId,
                message: msg(
                  `Le nombre de formateurs formés (${p.code} : ${sum}) ne peut pas dépasser l'effectif total des formateurs (2.1.15 : ${totTrainers}).`,
                  `Trained trainers (${p.code}: ${sum}) cannot exceed total trainers (2.1.15: ${totTrainers}).`,
                  locale,
                ),
              });
            }
          }
        }
      }
    }
  }

  // 5. Table 6.3 (VT6_13, prefix s6q3) placed leavers vs Table 4.10 (VT4_10, prefix s4q10) leavers
  if (hasField("VT6_13")) {
    const leaversBySpec = new Map<string, { male: number; female: number; total: number }>();
    let totalLeavers = 0;
    let hasAny410 = false;
    for (let j = 1; j <= 12; j++) {
      const text = data[`s4q10_row${j}_specialtyText`];
      const m = isEnteredValue(data[`s4q10_row${j}_male`]) ? Number(data[`s4q10_row${j}_male`]) : 0;
      const f = isEnteredValue(data[`s4q10_row${j}_female`]) ? Number(data[`s4q10_row${j}_female`]) : 0;
      if (text !== undefined && text !== null && String(text).trim().length > 0) {
        const key = String(text).trim().toLowerCase();
        leaversBySpec.set(key, { male: m, female: f, total: m + f });
        totalLeavers += m + f;
        hasAny410 = true;
      }
    }

    let totalPlaced = 0;
    let hasAnyPlaced = false;
    for (let i = 1; i <= 10; i++) {
      const text = data[`s6q3_row${i}_specialtyText`];
      const m = isEnteredValue(data[`s6q3_row${i}_male`]) ? Number(data[`s6q3_row${i}_male`]) : 0;
      const f = isEnteredValue(data[`s6q3_row${i}_female`]) ? Number(data[`s6q3_row${i}_female`]) : 0;
      if (text !== undefined && text !== null && String(text).trim().length > 0) {
        hasAnyPlaced = true;
        totalPlaced += m + f;
        const key = String(text).trim().toLowerCase();
        const leavers = leaversBySpec.get(key);
        if (leavers) {
          if (isEnteredValue(data[`s6q3_row${i}_female`]) && f > leavers.female) {
            issues.push({
              fieldId: "VT6_13",
              message: msg(
                `Spécialité « ${String(text).trim()} » (6.3) : l'effectif des femmes insérées (${f}) ne peut pas dépasser les sortantes (4.10 : ${leavers.female}).`,
                `Specialty "${String(text).trim()}" (6.3): placed women (${f}) cannot exceed leavers (4.10: ${leavers.female}).`,
                locale,
              ),
            });
          }
          if (isEnteredValue(data[`s6q3_row${i}_male`]) && m > leavers.male) {
            issues.push({
              fieldId: "VT6_13",
              message: msg(
                `Spécialité « ${String(text).trim()} » (6.3) : l'effectif des hommes insérés (${m}) ne peut pas dépasser les sortants (4.10 : ${leavers.male}).`,
                `Specialty "${String(text).trim()}" (6.3): placed men (${m}) cannot exceed leavers (4.10: ${leavers.male}).`,
                locale,
              ),
            });
          }
        }
      }
    }
    if (hasAny410 && hasAnyPlaced && totalPlaced > totalLeavers) {
      issues.push({
        fieldId: "VT6_13",
        message: msg(
          `Le total des sortants insérés (6.3 : ${totalPlaced}) ne peut pas dépasser le total des sortants (4.10 : ${totalLeavers}).`,
          `Total placed leavers (6.3: ${totalPlaced}) cannot exceed total leavers (4.10: ${totalLeavers}).`,
          locale,
        ),
      });
    }
  }

  return issues;
}

/**
 * VT totals that must agree, as blocking validation issues (a no-op for other
 * entities): the cross-table checks, and 5.3's total against its three
 * conditions (constitution §7).
 */
function crossTableIssues(fields: OnefopField[], data: FormData, locale?: ValidationLocale): ValidationIssue[] {
  const issue53 = vt53Issue(fields, data);
  return [...vtCrossTableIssues(fields, data), ...(issue53 ? [issue53] : [])].map((i) => ({
    fieldId: i.fieldId,
    message: msg(i.fr, i.en, locale, " / "),
  }));
}
