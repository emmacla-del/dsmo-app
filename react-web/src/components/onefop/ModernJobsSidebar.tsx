"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData, OnefopEntity, OnefopField, OnefopSection } from "@/lib/onefop-schema";
import { localized, computeSubsectionLayout, isFieldVisible } from "@/lib/onefop-schema";
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

interface ModernJobsSidebarProps {
  entity: OnefopEntity;
  data: FormData;
  currentSectionIndex: number;
  onSelectSection: (index: number) => void;
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

function isTableNoneOrNa(f: OnefopField, data: FormData): boolean {
  if (!isTableField(f)) return false;
  const statusFieldId = resolveTableStatusFieldId(f, data);
  const st = data[statusFieldId];
  return st === "NONE" || st === "NOT_APPLICABLE";
}

export function getSectionStatus(
  section: OnefopSection,
  data: FormData,
  issues: ValidationIssue[] = []
): SectionStatus {
  const hasErrors = issues.some((issue) =>
    section.fields.some(
      (f) =>
        f.id === issue.fieldId ||
        (f.paperCode && f.paperCode === issue.fieldId) ||
        issue.fieldId.toLowerCase().startsWith(f.id.toLowerCase() + "_") ||
        (f.paperCode && issue.fieldId.toLowerCase().startsWith(f.paperCode.toLowerCase() + "_"))
    )
  );

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
        const prefix = (f.paperCode || f.id).toLowerCase() + "_";
        const hasCell = Object.keys(data).some(
          (k) => k.toLowerCase().startsWith(prefix) && data[k] !== undefined && data[k] !== null && data[k] !== ""
        );
        return hasCell;
      }
    }
    const val = data[f.id];
    return val !== undefined && val !== null && String(val).trim() !== "";
  };

  const requiredFields = visibleFields.filter((f) => f.required && !isTableNoneOrNa(f, data));
  const answeredCount = visibleFields.filter(isFieldAnswered).length;

  if (answeredCount === 0) return "not-started";
  if (hasErrors) return "has-errors";

  const allRequiredAnswered = requiredFields.length > 0
    ? requiredFields.every(isFieldAnswered)
    : answeredCount > 0;

  if (allRequiredAnswered && !hasErrors) return "complete";
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
 * Responsive Sidebar for the Modern Jobs Wizard (all non-VT entities).
 * Displays section list, progress bar, real-time completion status chips,
 * and direct subsection jump anchors.
 */
export function ModernJobsSidebar({
  entity,
  data,
  currentSectionIndex,
  onSelectSection,
  issues = [],
  isValidationStage = false,
  onGoToValidation,
  isScopeStage = false,
  onSelectScope,
  activeTableId,
  onSelectTable,
}: ModernJobsSidebarProps) {
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const t = useTranslations("modernJobs.sidebar");
  const sections = entity.sections;

  const completedCount = sections.filter(
    (sec) => getSectionStatus(sec, data, issues) === "complete"
  ).length;
  const progressPercent = Math.round((completedCount / sections.length) * 100);

  const activeSection = !isScopeStage && !isValidationStage ? sections[currentSectionIndex] : null;
  const { startsHeadingFieldIds, headingByFieldId } = activeSection
    ? computeSubsectionLayout(activeSection, locale)
    : { startsHeadingFieldIds: new Set<string>(), headingByFieldId: new Map<string, string>() };

  const activeSubsections: { id: string; title: string }[] = [];
  if (activeSection) {
    for (const field of activeSection.fields) {
      if (startsHeadingFieldIds.has(field.id)) {
        // Filter out tables that are NONE or NOT_APPLICABLE
        if (!isTableNoneOrNa(field, data) && !isCompanionHiddenByGateway(field, data, activeSection.fields)) {
          const title = headingByFieldId.get(field.id);
          if (title) {
            activeSubsections.push({ id: field.id, title });
          }
        }
      }
    }
  }

  const scrollToSubsection = (fieldId: string) => {
    const el = document.getElementById(`subsection-${fieldId}`) ?? document.getElementById(fieldId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // "Section X sur Y": numbering matches the step dots (section0 = 0).
  const lastSectionNumber = Math.max(0, sections.length - 1);
  const progressLabel = isScopeStage
    ? t("progressQuiz")
    : isValidationStage
      ? t("progressReview")
      : t("progressSection", { current: currentSectionIndex, total: lastSectionNumber });

  // Sidebar titles without the "Section N." prefix — the number sits in the dot.
  const stepTitle = (rawTitle: string, idx: number) =>
    formatSidebarSectionTitle(rawTitle, idx).replace(/^Section\s+\d+\.\s*/, "");

  type StepState = "done" | "active" | "error" | "todo";

  const renderStep = (opts: {
    key: string;
    state: StepState;
    dot: string;
    title: string;
    detail?: string;
    onClick?: () => void;
    current: boolean;
  }) => {
    const { state, dot, title, detail, onClick, current } = opts;
    const dotStyle: React.CSSProperties =
      state === "done"
        ? { background: "var(--cam-green)", color: "#ffffff", border: "1px solid var(--cam-green)" }
        : state === "active"
          ? { background: "var(--cam-green)", color: "#ffffff", border: "1px solid var(--cam-green)" }
          : state === "error"
            ? { background: "var(--cam-error-bg)", color: "var(--cam-error)", border: "1px solid var(--cam-error-border)" }
            : { background: "var(--cam-surface)", color: "var(--cam-text-muted)", border: "1px solid var(--cam-border-strong)" };
    return (
      <button
        key={opts.key}
        type="button"
        onClick={onClick}
        aria-current={current ? "step" : undefined}
        className="cam-hoverable"
        style={{
          width: "100%",
          textAlign: "left",
          background: current ? "var(--cam-success-bg)" : "transparent",
          border: "none",
          borderRadius: "var(--cam-radius-control, 6px)",
          padding: "10px 8px",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          fontFamily: "var(--cam-font-sans)",
          cursor: onClick ? "pointer" : "default",
          transition: "background 0.15s ease",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 25,
            height: 25,
            borderRadius: "var(--cam-radius-full, 9999px)",
            display: "grid",
            placeItems: "center",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
            ...dotStyle,
          }}
        >
          {dot}
        </span>
        <span style={{ flex: 1, minWidth: 0, lineHeight: 1.3, paddingTop: 3 }}>
          <span
            style={{
              display: "block",
              fontSize: "var(--cam-font-size-sm, 0.875rem)",
              fontWeight: current ? 700 : 600,
              color: state === "error" ? "var(--cam-error)" : "var(--cam-text)",
            }}
          >
            {title}
          </span>
          {detail && (
            <span
              style={{
                display: "block",
                marginTop: 2,
                fontSize: "var(--cam-font-size-2xs, 0.6875rem)",
                color: state === "error" ? "var(--cam-error)" : "var(--cam-text-muted)",
              }}
            >
              {detail}
            </span>
          )}
        </span>
      </button>
    );
  };

  const scopeConfigured = Boolean(data._scopeConfig);

  return (
    <aside
      aria-label={t("ariaLabel")}
      style={{
        width: "var(--vt-sidebar-width, 280px)",
        flex: "0 0 var(--vt-sidebar-width, 280px)",
        background: "var(--cam-surface-subtle)",
        borderRight: "var(--cam-border-width, 1px) solid var(--cam-border)",
        display: "flex",
        flexDirection: "column",
        // Pinned under the header: the sidebar stays in view while the
        // tables scroll; its own section list scrolls if it is taller.
        position: "sticky",
        top: "var(--mj-header-h, 0px)",
        alignSelf: "flex-start",
        height: "calc(100vh - var(--mj-header-h, 0px))",
        color: "var(--cam-text)",
      }}
    >
      {/* Header: title + progress */}
      <div style={{ padding: "24px 20px 8px" }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "var(--cam-text)",
          }}
        >
          {t("contents")}
        </div>
        <div
          style={{
            fontSize: "var(--cam-font-size-xs, 0.8125rem)",
            color: "var(--cam-text-muted)",
            margin: "4px 0 10px",
          }}
        >
          {progressLabel} · {progressPercent}%
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          aria-label={t("completedSections")}
          style={{
            height: 6,
            background: "var(--cam-border-subtle, #eef0eb)",
            borderRadius: "var(--cam-radius-full, 9999px)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              background: "var(--cam-green)",
              borderRadius: "var(--cam-radius-full, 9999px)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Steps */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 12px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {sections.map((section, idx) => {
          const isCurrent = !isValidationStage && !isScopeStage && idx === currentSectionIndex;
          const status = getSectionStatus(section, data, issues);
          const isComplete = status === "complete";
          const hasError = status === "has-errors";

          // Table progress for the active multi-table section (e.g. "En cours · 1/2")
          const sectionTableProgress = (() => {
            if (!isCurrent) return null;
            const { startsHeadingFieldIds } = computeSubsectionLayout(section, locale);
            const tableFields = section.fields.filter(
              (f) => startsHeadingFieldIds.has(f.id) && !isTableNoneOrNa(f, data) && !isCompanionHiddenByGateway(f, data, section.fields)
            );
            if (tableFields.length <= 1) return null;
            const activeTableIndex = activeTableId
              ? tableFields.findIndex(
                  (f) =>
                    f.id.toLowerCase() === activeTableId.toLowerCase() ||
                    (f.paperCode && f.paperCode.toLowerCase() === activeTableId.toLowerCase())
                )
              : -1;
            const currentNum = activeTableIndex >= 0 ? activeTableIndex + 1 : 1;
            return { current: currentNum, total: tableFields.length };
          })();

          const state: StepState = hasError ? "error" : isCurrent ? "active" : isComplete ? "done" : "todo";
          const dot = hasError ? "!" : isComplete && !isCurrent ? "✓" : String(idx);
          const detail = hasError
            ? t("statusToCorrect")
            : isCurrent
              ? `${t("statusInProgress")}${sectionTableProgress ? ` · ${sectionTableProgress.current}/${sectionTableProgress.total}` : ""}`
              : isComplete
                ? t("statusCompleted")
                : status === "in-progress"
                  ? t("statusInProgress")
                  : undefined;

          return (
            <React.Fragment key={section.id}>
              {renderStep({
                key: section.id,
                state,
                dot,
                title: stepTitle(localized(section.title, locale), idx),
                detail,
                onClick: () => onSelectSection(idx),
                current: isCurrent,
              })}

              {/* Preliminary quiz between Section 1 and Section 2 */}
              {idx === 1 && onSelectScope &&
                renderStep({
                  key: "scope-configuration",
                  state: isScopeStage ? "active" : scopeConfigured ? "done" : "todo",
                  dot: scopeConfigured && !isScopeStage ? "✓" : "?",
                  title: t("quizTitle"),
                  detail: isScopeStage
                    ? t("statusInProgress")
                    : scopeConfigured
                      ? t("statusCompleted")
                      : undefined,
                  onClick: onSelectScope,
                  current: isScopeStage,
                })}
            </React.Fragment>
          );
        })}

        {/* Final review & submission */}
        {onGoToValidation &&
          renderStep({
            key: "validation",
            state: isValidationStage ? "active" : "todo",
            dot: String(sections.length),
            title: t("reviewTitle"),
            onClick: onGoToValidation,
            current: isValidationStage,
          })}

        {/* Bottom User Avatar Pinned at bottom */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: "var(--cam-space-4, 16px)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            aria-label={t("userProfile")}
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--cam-radius-full, 9999px)",
              background: "var(--cam-green-dark)",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              fontSize: "var(--cam-font-size-sm, 0.875rem)",
              fontWeight: 700,
              fontFamily: "var(--cam-font-sans)",
            }}
          >
            N
          </div>
        </div>
      </div>
    </aside>
  );
}
