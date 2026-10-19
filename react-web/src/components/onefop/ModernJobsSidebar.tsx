"use client";

import { WizardRail } from "@/components/wizard/WizardRail";
import { WizardStepList, type WizardStep, type WizardStepState } from "@/components/wizard/WizardStepList";
import { useLocale, useTranslations } from "next-intl";
import type { FormData, OnefopEntity, OnefopField, OnefopSection } from "@/lib/onefop-schema";
import { localized, isFieldVisible, sectionChunkStarterIds } from "@/lib/onefop-schema";
import type { ValidationIssue } from "@/lib/onefop-validation";
import { isCompanionHiddenByGateway, resolveTableStatusFieldId } from "@/components/modern-jobs/conditional/gateway-catalog";
import {
  getModernJobsTableDefinition,
  getGuidedOnlyTableDefinition,
} from "./tables/definitions/modernJobsTableDefinitions";
import {
  quizGovernsEntry,
  missingQuizFieldKeys,
} from "./tables/quizRequired";
import { fieldOwnsIssue, preliminaryQuizSlot } from "@/lib/wizard-navigation";

interface ModernJobsSidebarProps {
  entity: OnefopEntity;
  data: FormData;
  currentSectionIndex: number;
  onSelectSection: (index: number) => void;
  /** N2: why a section cannot be opened from the rail yet, or null. A locked
   *  item stays readable and focusable but does nothing (aria-disabled). */
  sectionLockReason?: (index: number) => string | null;
  /** N2: why the preliminary quiz cannot be opened yet, or null. */
  scopeLockReason?: string | null;
  issues?: ValidationIssue[];
  isValidationStage?: boolean;
  onGoToValidation?: () => void;
  isScopeStage?: boolean;
  onSelectScope?: () => void;
  activeTableId?: string;
  onSelectTable?: (fieldId: string) => void;
}

export type SectionStatus = "not-started" | "in-progress" | "complete" | "has-errors";

function isTableField(f: OnefopField): boolean {
  return f.type === "table" || f.type === "repeating_table" || !!f.table;
}

// Whether any cell of a table field holds a value. Cells are keyed by the
// table id ("s2_row1_description", "s3kpi_employed_current",
// "pp_s4q01_cadres_male_15_24"), which differs from the field id
// (PP_S2_ACTIVITIES) and the paper code (S4Q01); older tables used those.
function hasTableCell(f: OnefopField, data: FormData): boolean {
  const prefixes = [f.table?.id, f.paperCode, f.id]
    .filter((p): p is string => !!p)
    .map((p) => p.toLowerCase() + "_");
  return Object.keys(data).some((k) => {
    const v = data[k];
    if (v === undefined || v === null || v === "") return false;
    const key = k.toLowerCase();
    return prefixes.some((p) => key.startsWith(p));
  });
}

function isTableNoneOrNa(f: OnefopField, data: FormData): boolean {
  if (!isTableField(f)) return false;
  const statusFieldId = resolveTableStatusFieldId(f, data);
  return data[statusFieldId] === "NONE";
}

export function getSectionStatus(
  section: OnefopSection,
  data: FormData,
  issues: ValidationIssue[] = [],
  includeUnansweredAsError: boolean = false
): SectionStatus {
  // Check if any issue on this section is an actual format/value error on an entered field
  // Same ownership rule as Continue (fieldOwnsIssue), which also knows the
  // table id: a PP_S2_ACTIVITIES issue is keyed "s2_row1_…".
  const isSectionIssue = (issue: ValidationIssue) =>
    section.fields.some((f) => fieldOwnsIssue(f, issue.fieldId));
  const hasFormatErrors = issues.some((issue) => {
    if (!isSectionIssue(issue)) return false;
    // An entered value that violates validation format (e.g. invalid phone/email, negative count) is an immediate error
    const val = data[issue.fieldId];
    return val !== undefined && val !== null && String(val).trim() !== "";
  });

  const hasAnyErrors = issues.some(isSectionIssue);

  const visibleFields = section.fields.filter(
    (f) => isFieldVisible(f, data) && !isCompanionHiddenByGateway(f, data, section.fields)
  );
  if (visibleFields.length === 0) return "complete";

  const isFieldAnswered = (f: typeof section.fields[0]) => {
    if (isTableNoneOrNa(f, data)) return true;
    if (isTableField(f)) {
      const statusFieldId = resolveTableStatusFieldId(f, data);
      // REPORTED means the table is expected to be filled, NOT that it is already complete.
      // When the preliminary quiz governs entry, every retained cell/option must be entered.
      if (data[statusFieldId] === "REPORTED") {
        if (quizGovernsEntry(data)) {
          const def = getModernJobsTableDefinition(f, data) ?? getGuidedOnlyTableDefinition(f, data);
          if (def) {
            return missingQuizFieldKeys(def, data).length === 0;
          }
        }
        const tableVal = data[f.id];
        if (tableVal !== undefined && tableVal !== null && tableVal !== "") {
          if (Array.isArray(tableVal) && tableVal.length === 0) return false;
          if (typeof tableVal === "object" && Object.keys(tableVal as object).length === 0) return false;
          return true;
        }
        return hasTableCell(f, data);
      }
      // A table with no response-status field (Project/Programme's
      // PP_S2_ACTIVITIES and PP_S3_OUTCOMES) is answered once a cell is.
      if (data[f.id] === undefined && hasTableCell(f, data)) return true;
    }
    const val = data[f.id];
    return val !== undefined && val !== null && String(val).trim() !== "";
  };

  const requiredFields = visibleFields.filter((f) => f.required && !isTableNoneOrNa(f, data));
  const answeredCount = visibleFields.filter(isFieldAnswered).length;

  if (answeredCount === 0) return "not-started";
  // If user entered invalid data in a field, show error immediately
  if (hasFormatErrors) return "has-errors";
  // In review stage or when explicitly checking all required errors, unanswered required fields also count as errors
  if (includeUnansweredAsError && hasAnyErrors) return "has-errors";

  const allRequiredAnswered = requiredFields.length > 0
    ? requiredFields.every(isFieldAnswered)
    : answeredCount > 0;

  if (allRequiredAnswered && !hasAnyErrors) return "complete";
  return "in-progress";
}

export function formatSidebarSectionTitle(rawTitle: string, index: number): string {
  if (!rawTitle) {
    return `Section ${index}`;
  }

  // Strip existing "SECTION X." or "Section X." or "SECTION X :" or "Section X -" prefix
  let cleaned = rawTitle.replace(/^section\s+\d+\s*[\.\:\-]?\s*/i, "").trim();
  if (!cleaned) {
    cleaned = rawTitle;
  }

  // Convert to sentence case / lowercase
  cleaned = cleaned.toLowerCase();
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Preserve well-known acronyms / abbreviations
  cleaned = cleaned
    .replace(/\bctd\b/gi, "CTD")
    .replace(/\bong\b/gi, "ONG")
    .replace(/\bngos?\b/gi, (m) => m.toUpperCase().replace(/S$/, "s"))
    .replace(/\bminefop\b/gi, "MINEFOP")
    .replace(/\bonefop\b/gi, "ONEFOP")
    .replace(/\bdsmo\b/gi, "DSMO");

  return `Section ${index}. ${cleaned}`;
}

/**
 * The Modern Jobs wizard's side navigation (all non-VT entities): the shared
 * WizardRail and WizardStepList, so it looks and behaves like the
 * registration and VT wizards. `sheet` renders it inside the phone drawer.
 */
export function ModernJobsSidebar({
  entity,
  data,
  currentSectionIndex,
  onSelectSection,
  sectionLockReason,
  scopeLockReason = null,
  issues = [],
  isValidationStage = false,
  onGoToValidation,
  isScopeStage = false,
  onSelectScope,
  activeTableId,
  sheet = false,
}: ModernJobsSidebarProps & { sheet?: boolean }) {
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const t = useTranslations("wizardRail");
  const tNav = useTranslations("modernJobs.sidebar");
  const sections = entity.sections;
  // The preliminary quiz sits right after Section 1 (same rule as the wizard).
  const quizSlot = preliminaryQuizSlot(sections);

  const statuses = sections.map((sec) => getSectionStatus(sec, data, issues, isValidationStage));
  const completedCount = statuses.filter((st) => st === "complete").length;

  // Sidebar titles without the "Section N." prefix -- the number sits in the circle.
  const stepTitle = (rawTitle: string, idx: number) =>
    formatSidebarSectionTitle(rawTitle, idx).replace(/^Section\s+\d+\.\s*/, "");

  const stateLabel = (state: WizardStepState) =>
    t(
      state === "done"
        ? "stateDone"
        : state === "current" || state === "currentComplete"
          ? "stateCurrent"
          : state === "inProgress"
            ? "stateInProgress"
            : state === "error"
              ? "stateError"
              : state === "locked"
                ? "stateLocked"
                : "stateTodo",
    );

  // "Tableau 1 sur 2" under the section in hand when it holds several tables.
  const tableProgress = (section: OnefopSection): string | undefined => {
    // The same rule the renderer cuts the section with, so the rail counts
    // the screens the respondent actually walks through — including the
    // sections the paper form gives no subsections (Project/Programme
    // Section 4 and its six tables).
    const starters = sectionChunkStarterIds(section);
    const tableFields = section.fields.filter(
      (f) => starters.has(f.id) && !isTableNoneOrNa(f, data) && !isCompanionHiddenByGateway(f, data, section.fields)
    );
    if (tableFields.length <= 1) return undefined;
    const active = activeTableId
      ? tableFields.findIndex(
          (f) =>
            f.id.toLowerCase() === activeTableId.toLowerCase() ||
            (f.paperCode && f.paperCode.toLowerCase() === activeTableId.toLowerCase())
        )
      : -1;
    return t("tableProgress", { current: active >= 0 ? active + 1 : 1, total: tableFields.length });
  };

  const steps: WizardStep[] = [];
  sections.forEach((section, idx) => {
    const isCurrent = !isValidationStage && !isScopeStage && idx === currentSectionIndex;
    const status = statuses[idx];
    const lockReason = sectionLockReason?.(idx) ?? null;
    const state: WizardStepState =
      status === "has-errors"
        ? "error"
        : isCurrent
          ? status === "complete" ? "currentComplete" : "current"
          : lockReason
            ? "locked"
            : status === "complete"
              ? "done"
              : status === "in-progress"
                ? "inProgress"
                : "todo";
    steps.push({
      key: section.id,
      // Modern Jobs numbers its sections from 0, as the paper form does.
      marker: idx,
      name: stepTitle(localized(section.title, locale), idx),
      state,
      stateLabel: stateLabel(state),
      detail: state === "error" ? t("stateError") : isCurrent ? tableProgress(section) : undefined,
      lockReason,
      onSelect: lockReason ? undefined : () => onSelectSection(idx),
    });

    if (idx === quizSlot?.previousSectionIndex && onSelectScope) {
      const configured = Boolean(data._scopeConfig);
      const quizState: WizardStepState = isScopeStage
        ? configured ? "currentComplete" : "current"
        : scopeLockReason
          ? "locked"
          : configured
            ? "done"
            : "todo";
      steps.push({
        key: "scope-configuration",
        marker: "?",
        name: t("quiz"),
        state: quizState,
        stateLabel: stateLabel(quizState),
        lockReason: scopeLockReason,
        onSelect: scopeLockReason ? undefined : onSelectScope,
      });
    }
  });

  if (onGoToValidation) {
    const reviewState: WizardStepState = isValidationStage ? "current" : "todo";
    steps.push({
      key: "validation",
      marker: sections.length,
      name: t("review"),
      state: reviewState,
      stateLabel: stateLabel(reviewState),
      onSelect: onGoToValidation,
    });
  }

  return (
    <WizardRail
      sheet={sheet}
      progress={{ done: completedCount, total: sections.length }}
    >
      {/* No per-step "Edit" word — see VtWizardSidebar. */}
      <WizardStepList label={tNav("ariaLabel")} steps={steps} />
    </WizardRail>
  );
}
