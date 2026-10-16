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
import type { PrimaryQuestionId } from "@/components/modern-jobs/scope/ScopeTypes";
import { vtCrossTableIssues } from "./vt-cross-table";
import { vt53Issue } from "./vt-infrastructure-check";
import { ACTIVITIES_TABLE_FIELDS, ACTIVITIES_ROW_CAPACITY } from "./onefop-activities";

export interface ValidationIssue {
  fieldId: string;
  message: string;
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

/** The one wording of the whole-number error, for fields, cells and inputs. */
const WHOLE_NUMBER_FR = "Saisissez un nombre entier";
const WHOLE_NUMBER_EN = "Enter a whole number";

/** Shown when a count input is refused (decimal, sign, letters). */
export function wholeNumberMessage(locale?: ValidationLocale): string {
  return msg(`${WHOLE_NUMBER_FR} (ex. 12)`, `${WHOLE_NUMBER_EN} (e.g. 12)`, locale);
}

function fieldIssue(field: OnefopField, message: string): ValidationIssue {
  return { fieldId: field.id, message };
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
    return fieldIssue(field, labelled(fieldLabel(field, locale), "Champ obligatoire", "Required field", locale));
  }

  if (field.type === "tel" && !isValidPhone(v)) {
    return fieldIssue(
      field,
      v.length !== 9
        ? labelled(fieldLabel(field, locale), "Le numéro doit contenir exactement 9 chiffres", "Number must be exactly 9 digits", locale)
        : labelled(fieldLabel(field, locale), "Le numéro doit commencer par 2 (fixe) ou 6 (mobile)", "Number must start with 2 (landline) or 6 (mobile)", locale),
    );
  }

  if (field.type === "email" && !isValidEmail(v)) {
    return fieldIssue(
      field,
      labelled(fieldLabel(field, locale), "Veuillez entrer une adresse e-mail valide", "Please enter a valid email address", locale),
    );
  }

  if (field.type === "number" && isYearField(field)) {
    const year = Number(v);
    if (!Number.isInteger(year)) {
      return fieldIssue(field, labelled(fieldLabel(field, locale), "Veuillez entrer une année valide", "Please enter a valid year", locale));
    }
    if (year < 1900) {
      return fieldIssue(field, labelled(fieldLabel(field, locale), "L'année doit être ≥ 1900", "Year must be ≥ 1900", locale));
    }
    const currentYear = new Date().getFullYear();
    if (year > currentYear) {
      return fieldIssue(field, labelled(fieldLabel(field, locale), `L'année doit être ≤ ${currentYear}`, `Year must be ≤ ${currentYear}`, locale));
    }
  }

  // V3 fix: non-year numeric fields must contain a valid number so that
  // strings like "N/A", "abc", or comma-formatted "1,000" never reach the
  // SPSS payload as non-numeric values.
  if (field.type === "number" && !isYearField(field) && v !== "") {
    const num = Number(v.replace(/\s/g, ""));
    if (Number.isNaN(num)) {
      return fieldIssue(field, labelled(fieldLabel(field, locale), "Veuillez entrer une valeur numérique", "Please enter a numeric value", locale));
    }
    if (num < 0) {
      return fieldIssue(field, labelled(fieldLabel(field, locale), "La valeur doit être ≥ 0", "Value must be ≥ 0", locale));
    }
    if (COUNT_FIELD_IDS.has(field.id) && !isWholeCount(v.replace(/\s/g, ""))) {
      return fieldIssue(field, labelled(fieldLabel(field, locale), WHOLE_NUMBER_FR, WHOLE_NUMBER_EN, locale));
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
        return fieldIssue(
          field,
          labelled(fieldLabel(field, locale), geoCheck.errorMessage.fr, geoCheck.errorMessage.en, locale, " / "),
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
        return fieldIssue(
          field,
          labelled(fieldLabel(field, locale), geoCheck.errorMessage.fr, geoCheck.errorMessage.en, locale, " / "),
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
        return fieldIssue(
          field,
          labelled(fieldLabel(field, locale), geoCheck.errorMessage.fr, geoCheck.errorMessage.en, locale, " / "),
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
        return fieldIssue(
          field,
          labelled(fieldLabel(field, locale), geoCheck.errorMessage.fr, geoCheck.errorMessage.en, locale, " / "),
        );
      }
    }
  }

  return null;
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

  for (let n = 1; n <= rowCount; n++) {
    const rowCells = ACTIVITIES_TABLE_FIELDS.map((f) => {
      const cellId = `${prefix}_row${n}_${f.key}`;
      const val = data[cellId];
      const isEntered = isEnteredValue(val) && String(val).trim() !== "";
      return { field: f, cellId, val, isEntered };
    });

    const hasAny = rowCells.some((c) => c.isEntered);
    if (!hasAny) continue;

    for (const cell of rowCells) {
      if (!cell.isEntered) {
        const fieldName = textIn(cell.field.label, locale);
        issues.push({
          fieldId: cell.cellId,
          message: labelled(
            label,
            `Ligne ${n} : le champ « ${fieldName} » est requis`,
            `Row ${n}: the field "${fieldName}" is required`,
            locale,
          ),
        });
      } else if (cell.field.key === "duration") {
        const num = Number(cell.val);
        if (Number.isNaN(num) || num < 0) {
          issues.push({
            fieldId: cell.cellId,
            message: labelled(
              label,
              `Ligne ${n} : la durée doit être un nombre ≥ 0`,
              `Row ${n}: duration must be a number ≥ 0`,
              locale,
            ),
          });
        }
      }
    }
  }

  return issues;
}

function validateTableField(field: OnefopField, data: FormData, locale?: ValidationLocale): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isFieldVisible(field, data)) return issues;

  if (field.table?.template === "activities_table") {
    return validateActivitiesTable(field, data, locale);
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
            `La cellule (${key}) ne peut pas être négative`,
            "Cell cannot be negative",
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
      if (missingKeys.length > 0) {
        issues.push({
          fieldId: field.id,
          // Real plurals and a shorter sentence: what is missing, then what to do.
          message: locale === "en"
            ? `${label}: ${missingKeys.length} ${missingKeys.length === 1 ? "cell" : "cells"} still to fill. Enter 0 where there was nothing.`
            : `${label} : ${missingKeys.length} ${missingKeys.length === 1 ? "cellule reste" : "cellules restent"} à renseigner. Saisissez 0 lorsqu'il n'y a rien à déclarer.`,
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
    issues.push(...crossTableIssues(entity.sections.flatMap((sec) => sec.fields), data, locale));
  }

  // V1: S3Q02 reason rows 2 and 3 — text field required when any count in
  // that row is non-zero. These fields are in OPTIONAL_OVERRIDES to allow
  // single-reason declarations (where rows 2/3 have zero counts). The table-
  // level mechanism (missingQuizFieldKeys) handles this for modern-jobs
  // tables but S3Q02 is a hybrid reasons table not registered there. This
  // targeted check fills that gap. Skip entirely when the quiz says no
  // departures occurred — the table is NONE/gated and stale draft values
  // must not produce false errors.
  const scope = readQuizScope(data);
  const departuresCouldBeReported = scope === null || scope.departures !== false;
  if (departuresCouldBeReported) {
    for (const { textKey, prefix } of [
      { textKey: "S3Q02_REASON_2_TEXT", prefix: "S3Q02_REASON_2_" },
      { textKey: "S3Q02_REASON_3_TEXT", prefix: "S3Q02_REASON_3_" },
    ] as const) {
      const textValue = data[textKey];
      if (textValue !== undefined && textValue !== null && textValue !== "") continue;
      const rowHasCount = Object.entries(data).some(([k, v]) => {
        if (!k.startsWith(prefix) || k === textKey) return false;
        const n = typeof v === "number" ? v : Number(v);
        return !Number.isNaN(n) && n > 0;
      });
      if (rowHasCount) {
        issues.push({
          fieldId: textKey,
          message: locale === "en"
            ? "Dismissal reason description is required when a count is entered for this row."
            : "La description du motif est obligatoire lorsqu'un effectif est saisi pour cette ligne.",
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
  ];
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
