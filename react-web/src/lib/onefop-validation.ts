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
import { incompleteQuizQuestions, readQuizScope } from "@/components/modern-jobs/scope/QuizSemantics";
import type { PrimaryQuestionId } from "@/components/modern-jobs/scope/ScopeTypes";

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

// kYearFieldIds in field_validator.dart.
const YEAR_FIELD_IDS = new Set(["COOP_S1Q03", "CTD_S1Q03", "ONG_S1Q03"]);

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
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
  if (!field.required || OPTIONAL_OVERRIDES.has(field.id)) return null;
  if (!isFieldVisible(field, data)) return null;

  const raw = data[field.id];
  const v = raw === undefined || raw === null ? "" : String(raw).trim();

  if (isEmpty(v)) {
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
function validateTableField(field: OnefopField, data: FormData, locale?: ValidationLocale): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isFieldVisible(field, data)) return issues;

  const prefix = field.table?.id ?? field.id;
  const label = fieldLabel(field, locale);

  // If table is gated by a response status and respondent declared NONE or NOT_APPLICABLE,
  // the table is inactive and not an active required validation target.
  const cleanId = field.id.replace(/_ENTERPRISE|_OTHER/i, "");
  const responseStatus =
    data[`${field.id}_RESPONSE_STATUS`] ??
    data[`${field.id.toUpperCase()}_RESPONSE_STATUS`] ??
    data[`${field.id.toLowerCase()}_RESPONSE_STATUS`] ??
    (field.paperCode ? data[`${field.paperCode}_RESPONSE_STATUS`] : undefined) ??
    (field.paperCode ? data[`${field.paperCode.toUpperCase()}_RESPONSE_STATUS`] : undefined) ??
    data[`${cleanId}_RESPONSE_STATUS`] ??
    data[`${cleanId.toUpperCase()}_RESPONSE_STATUS`];

  if (responseStatus === "NONE" || responseStatus === "NOT_APPLICABLE") {
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
          message: locale === "en"
            ? `${label}: Table is reported but contains ${missingKeys.length} missing required cell(s). Every cell must contain an explicit value. Enter 0 if there were no occurrences.`
            : `${label} : Le tableau est déclaré renseigné mais comporte ${missingKeys.length} cellule(s) ou option(s) obligatoire(s) non renseignée(s). Chaque cellule doit contenir une valeur explicite. Saisissez 0 s'il n'y a eu aucune occurrence.`,
        });
      }
      return issues;
    }

    // VT specific required cell checks
    const vt = field.table?.vt;
    if (vt && field.table?.matrix) {
      const isRoster = Boolean(vt.isRoster);
      for (let r = 0; r < field.table.matrix.length; r++) {
        const rowIds = field.table.matrix[r];
        const rowHasData = rowIds.some((cid) => isEnteredValue(data[cid]));
        // In a REPORTED table, all fixed matrix rows are active. In rosters, only rows with data are active.
        const rowIsActive = !isRoster || rowHasData;
        if (rowIsActive) {
          for (let c = 0; c < vt.cells.length; c++) {
            const cellDef = vt.cells[c];
            if (cellDef.required || !isRoster) {
              const cid = rowIds[c];
              const val = data[cid];
              if (!isEnteredValue(val)) {
                issues.push({
                  fieldId: cid,
                  message: locale === "en"
                    ? `${label} [Row ${r + 1}]: "${textIn(cellDef.label, locale)}" is required. Enter 0 if no occurrences.`
                    : `${label} [Ligne ${r + 1}] : La cellule « ${textIn(cellDef.label, locale)} » est obligatoire. Saisissez 0 si aucune occurrence.`,
                });
              }
            }
          }
        }
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

  for (const section of entity.sections) {
    if (isVtSectionWaived(section.id, data)) continue;
    issues.push(...validateFields(section.fields, data, locale, territoryTree));
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
  return validateFields(section.fields, data, locale, territoryTree);
}
