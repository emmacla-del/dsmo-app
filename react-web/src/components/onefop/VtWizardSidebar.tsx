"use client";

import { Fragment } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { FormData, OnefopEntity, OnefopSection } from "@/lib/onefop-schema";
import { localized, computeSubsectionLayout } from "@/lib/onefop-schema";
import {
  isVtSectionComplete,
  getVtSectionShortLabel,
  type VtWizardSectionOutlineModel,
  type VtWizardSectionOutlineItem,
} from "./vt-wizard-utils";
import { VT_TABBED_SECTION_IDS } from "./vt-wizard-section-utils";

interface VtWizardSidebarProps {
  entity: OnefopEntity;
  data: FormData;
  currentSectionIndex: number;
  onSelectSection: (index: number) => void;
  /** N2: why a section cannot be opened from the rail yet, or null. A locked
   *  item stays readable and focusable but does nothing (aria-disabled). */
  sectionLockReason?: (index: number) => string | null;
  isValidationStage?: boolean;
  onGoToValidation?: () => void;
  outline?: VtWizardSectionOutlineModel | null;
  /** The preliminary quiz, listed right after Section 1 (absent for a closed centre). */
  quiz?: { isCurrent: boolean; isComplete: boolean; onOpen: () => void; lockReason?: string | null };
}

/**
 * Faithful port of _VtWizardSidebar & _VtWizardSidebarOutline from
 * lib/screens/onefop/wizard/vt_wizard_shell.dart:
 * - 280px sovereign sidebar for Vocational Training
 * - MINEFOP / ONEFOP masthead and Census header
 * - 9 numbered sections with status badges (_isComplete)
 * - Live nested subsection outline tree under the active section
 * - "X sur 9 sections terminées" progress bar
 * - Validation & Submission review stage link
 */
export function VtWizardSidebar({
  entity,
  data,
  currentSectionIndex,
  onSelectSection,
  sectionLockReason,
  isValidationStage = false,
  onGoToValidation,
  outline,
  quiz,
}: VtWizardSidebarProps) {
  const t = useTranslations();
  const locale = useLocale();
  const sections = entity.sections;

  const isSectionComplete = (sec: OnefopSection): boolean => isVtSectionComplete(sec, data);

  const doneCount = sections.filter(isSectionComplete).length;
  const activeSection = sections[currentSectionIndex];
  const { startsHeadingFieldIds, headingByFieldId } = activeSection
    ? computeSubsectionLayout(activeSection, locale.startsWith("en") ? "en" : "fr")
    : { startsHeadingFieldIds: new Set<string>(), headingByFieldId: new Map<string, string>() };

  // Collect distinct subsection titles for the active section — skipped for
  // tabbed sections (4, 8): only the active tab's fields are mounted in the
  // DOM, so a scroll-to-field link for a subsection in a different tab would
  // silently do nothing. VtWizardCategoryTabs already provides equivalent
  // (and functional) navigation between those subsections.
  const activeSubsections: { id: string; title: string }[] = [];
  if (activeSection && !VT_TABBED_SECTION_IDS.has(activeSection.id)) {
    for (const field of activeSection.fields) {
      if (startsHeadingFieldIds.has(field.id)) {
        const title = headingByFieldId.get(field.id);
        if (title) {
          activeSubsections.push({ id: field.id, title });
        }
      }
    }
  }

  const scrollToField = (fieldId: string) => {
    const el = document.getElementById(fieldId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <aside
      aria-label={t("vtWizardSidebar.navAriaLabel")}
      style={{
        width: 280,
        flexShrink: 0,
        background: "var(--cam-surface)",
        borderRight: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "calc(100vh - 110px)",
        padding: "20px 14px 20px 18px",
        color: "#1e293b",
      }}
    >
      {/* ── SOMMAIRE Header ── */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: "var(--cam-font-size-3xs)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#94a3b8",
            marginBottom: 6,
          }}
        >
          {locale === "en" ? "CONTENTS" : "SOMMAIRE"}
        </div>

        {/* Progress Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 6 }}>
          <span style={{ fontWeight: 600, color: "#64748b" }}>
            {locale === "en" ? `${doneCount} of ${sections.length} sections` : `${doneCount} sur ${sections.length} sections`}
          </span>
          <span style={{ fontWeight: 700, color: "#0e4d29" }}>
            {Math.round((doneCount / sections.length) * 100)}%
          </span>
        </div>
        <div
          style={{
            height: 4,
            background: "var(--cam-surface-2)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.round((doneCount / sections.length) * 100)}%`,
              background: "#0e4d29",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      <div style={{ height: 1, backgroundColor: "var(--cam-surface-2)", marginBottom: 12 }} />

      {/* ── 9 Numbered Sections ── */}
      <nav style={{ flex: 1, overflowY: "auto", paddingRight: 4, display: "flex", flexDirection: "column", gap: 4 }}>
        {sections.map((sec, idx) => {
          const isCurrent = !isValidationStage && !quiz?.isCurrent && idx === currentSectionIndex;
          const isDone = isSectionComplete(sec);
          const title = getVtSectionShortLabel(sec.id, locale) ?? localized(sec.title, locale.startsWith("en") ? "en" : "fr");
          const lockReason = sectionLockReason?.(idx) ?? null;

          return (
            <Fragment key={sec.id}>
            <div>
              <button
                type="button"
                aria-disabled={lockReason ? true : undefined}
                title={lockReason ?? undefined}
                onClick={lockReason ? undefined : () => onSelectSection(idx)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: isCurrent ? "1px solid #bbf7d0" : "1px solid transparent",
                  background: isCurrent ? "#f0fdf4" : "transparent",
                  color: isCurrent ? "#0e4d29" : isDone ? "#334155" : "#475569",
                  cursor: lockReason ? "not-allowed" : "pointer",
                  textAlign: "left",
                  boxShadow: isCurrent ? "0 1px 3px rgba(14, 77, 41, 0.08)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    boxSizing: "border-box",
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                    background: isCurrent
                      ? "#0e4d29"
                      : isDone
                        ? "#16a34a"
                        : "#f1f5f9",
                    border: !isCurrent && !isDone ? "1px solid #cbd5e1" : "none",
                    color: isCurrent || isDone ? "#ffffff" : "#64748b",
                  }}
                >
                  {isDone ? "✓" : idx + 1}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 12.5,
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? "#0e4d29" : lockReason ? "var(--cam-rail-upcoming)" : isDone ? "#334155" : "#475569",
                    lineHeight: 1.35,
                  }}
                >
                  {title}
                  {lockReason && <span className="sr-only"> — {lockReason}</span>}
                </span>
              </button>

              {/* ── Section Outline or Subsection Tree for the Active Section ── */}
              {isCurrent && outline && outline.items.length > 0 ? (
                <VtWizardSidebarOutline outline={outline} />
              ) : isCurrent && activeSubsections.length > 0 ? (
                <div
                  style={{
                    paddingLeft: "34px",
                    paddingRight: "8px",
                    paddingTop: "4px",
                    paddingBottom: "6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  {activeSubsections.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => scrollToField(sub.id)}
                      style={{
                        background: "none",
                        border: "none",
                        textAlign: "left",
                        fontSize: "var(--cam-font-size-2xs)",
                        color: "#64748b",
                        cursor: "pointer",
                        padding: "3px 0",
                        lineHeight: 1.25,
                        display: "flex",
                        alignItems: "baseline",
                        gap: "6px",
                      }}
                    >
                      <span style={{ color: "#0e4d29", fontWeight: 700, fontSize: "10px" }}>›</span>
                      <span>{sub.title}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {idx === 0 && quiz && (
              <button
                type="button"
                onClick={quiz.lockReason ? undefined : quiz.onOpen}
                aria-current={quiz.isCurrent ? "step" : undefined}
                aria-disabled={quiz.lockReason ? true : undefined}
                title={quiz.lockReason ?? undefined}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: quiz.isCurrent ? "1px solid #bbf7d0" : "1px solid transparent",
                  background: quiz.isCurrent ? "#f0fdf4" : "transparent",
                  color: quiz.isCurrent ? "#0e4d29" : quiz.lockReason ? "var(--cam-rail-upcoming)" : "#475569",
                  cursor: quiz.lockReason ? "not-allowed" : "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    boxSizing: "border-box",
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                    background: quiz.isCurrent ? "#0e4d29" : quiz.isComplete ? "#16a34a" : "#f1f5f9",
                    border: !quiz.isCurrent && !quiz.isComplete ? "1px solid #cbd5e1" : "none",
                    color: quiz.isCurrent || quiz.isComplete ? "#ffffff" : "#64748b",
                  }}
                >
                  {quiz.isComplete ? "✓" : "?"}
                </span>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: quiz.isCurrent ? 700 : 500, lineHeight: 1.35 }}>
                  {locale === "en" ? "Preliminary questionnaire" : "Questionnaire préliminaire"}
                  {quiz.lockReason && <span className="sr-only"> — {quiz.lockReason}</span>}
                </span>
              </button>
            )}
            </Fragment>
          );
        })}

        {/* ── Validation / Submission Summary Step Link ── */}
        <div style={{ marginTop: "8px", borderTop: "1px solid var(--cam-surface-2)", paddingTop: "8px" }}>
          <button
            type="button"
            onClick={onGoToValidation}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 10px",
              border: isValidationStage ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
              borderRadius: 6,
              background: isValidationStage ? "#f0fdf4" : "transparent",
              cursor: "pointer",
              textAlign: "left",
              fontSize: "12px",
              color: isValidationStage ? "#0e4d29" : "#334155",
              fontWeight: 700,
              boxShadow: isValidationStage ? "0 1px 3px rgba(14, 77, 41, 0.08)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <span style={{ fontSize: 13 }}>📋</span>
            <span>{t("vtWizardSidebar.validationLink")}</span>
          </button>
        </div>
      </nav>

      {/* ── Progress Indicator Footer ── */}
      <div
        style={{
          paddingTop: 14,
          borderTop: "1px solid rgba(255, 255, 255, 0.15)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--cam-font-sans)",
            fontSize: 11.5,
            fontWeight: 600,
            color: "rgba(255, 255, 255, 0.8)",
            marginBottom: 6,
          }}
        >
          {locale === "fr"
            ? `${doneCount} sur ${sections.length} sections terminées`
            : `${doneCount} of ${sections.length} sections complete`}
        </div>
        <div
          style={{
            height: 6,
            borderRadius: "var(--cam-radius-sm, 2px)",
            background: "rgba(255, 255, 255, 0.15)",
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${(doneCount / Math.max(1, sections.length)) * 100}%`,
              background: "var(--cam-gold)",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Bottom Accreditation Box */}
        <div
          style={{
            background: "var(--cam-success-bg)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "var(--cam-radius-control, 6px)",
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              color: "var(--cam-green-dark)",
              marginBottom: 2,
              letterSpacing: "0.04em",
            }}
          >
            MINEFOP
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--cam-text)",
              lineHeight: 1.25,
              opacity: 0.9,
            }}
          >
            {locale === "en"
              ? "Ministry of Employment and Vocational Training"
              : "Ministère de l'Emploi et de la Formation Professionnelle"}
          </div>
        </div>
      </div>
    </aside>
  );
}

/**
 * Section outline matching Flutter's _VtWizardSidebarOutline in vt_wizard_shell.dart:
 * - "PLAN DE LA SECTION" caption header
 * - Linear progress indicator showing coverage (filled / total)
 * - Clickable outline rows with semantic status icons (complete, inProgress, needsAttention, notStarted)
 */
function VtWizardSidebarOutline({ outline }: { outline: VtWizardSectionOutlineModel }) {
  const t = useTranslations("vtWizard");
  const total = outline.items.reduce((sum, item) => sum + item.total, 0);
  const filled = outline.items.reduce((sum, item) => sum + item.filled, 0);
  const coverage = total === 0 ? 0 : filled / total;

  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 6, paddingLeft: 12 }}>
      <div
        style={{
          padding: "2px 8px 6px 10px",
          fontSize: "11px",
          fontWeight: 800,
          letterSpacing: "0.3px",
          color: "var(--cam-text-muted)",
        }}
      >
        {t("outlineTitle")}
      </div>
      <div
        role="progressbar"
        aria-label={`${t("outlineProgressLabel")} ${Math.round(coverage * 100)}%`}
        aria-valuenow={Math.round(coverage * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          margin: "0 10px 10px 10px",
          height: 5,
          borderRadius: 3,
          background: "var(--cam-border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.round(coverage * 100)}%`,
            background: "var(--cam-green)",
            borderRadius: 3,
            transition: "width 0.2s ease",
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {outline.items.map((item, i) => (
          <VtWizardSidebarOutlineRow
            key={i}
            item={item}
            selected={i === outline.activeIndex}
            onTap={() => outline.onSelect(i)}
          />
        ))}
      </div>
    </div>
  );
}

function VtWizardSidebarOutlineRow({
  item,
  selected,
  onTap,
}: {
  item: VtWizardSectionOutlineItem;
  selected: boolean;
  onTap: () => void;
}) {
  const t = useTranslations("vtWizard");

  let iconNode: React.ReactNode;
  let color: string;
  let detail: string;

  switch (item.status) {
    case "complete":
      iconNode = (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
      );
      color = "var(--vt-accent)";
      detail = t("statusComplete");
      break;
    case "inProgress":
      iconNode = (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z" />
        </svg>
      );
      color = "#555555";
      detail = t("statusInProgress");
      break;
    case "needsAttention":
      iconNode = (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
      color = "var(--vt-red)";
      detail = t("statusNeedsAttention", { count: item.errors });
      break;
    case "notStarted":
    default:
      iconNode = (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
      color = "#888888";
      detail = t("statusNotStarted");
      break;
  }

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`${item.label}, ${detail}`}
      aria-current={selected ? "true" : undefined}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "8px 10px",
        background: selected ? "var(--cam-success-bg)" : "transparent",
        borderRadius: "var(--cam-radius-sm)",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "background 0.15s ease",
      }}
    >
      <span style={{ color, flexShrink: 0, marginTop: 1, display: "inline-flex" }}>{iconNode}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--cam-font-sans)",
            fontSize: "11px",
            fontWeight: selected ? 700 : 600,
            color: selected ? "var(--cam-green)" : "var(--cam-text)",
            lineHeight: 1.25,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {item.label}
        </div>
        <div
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color,
            marginTop: 2,
            lineHeight: 1.2,
          }}
        >
          {detail}
        </div>
      </div>
    </button>
  );
}
