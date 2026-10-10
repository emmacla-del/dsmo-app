"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData, OnefopField, OnefopSection } from "@/lib/onefop-schema";
import { computeSubsectionLayout, isFieldVisible, localized } from "@/lib/onefop-schema";
import type { ValidationIssue } from "@/lib/onefop-validation";
import { FieldRenderer } from "./FieldRenderer";
import { FormGrid, FormCol } from "./ui/FormGrid";
import { FormSectionCard } from "./ui/FormSectionCard";
import { RequiredQuestionsNote } from "./ui/OptionalSuffix";
import type { FormStatus } from "./form/StatusChip";
import { CameroonGeographySelector } from "@/components/modern-jobs/geography/CameroonGeographySelector";
import { Section1ThematicRenderer } from "@/components/modern-jobs/section1/Section1ThematicRenderer";
import { isCompanionHiddenByGateway, resolveTableStatusFieldId } from "@/components/modern-jobs/conditional/ConditionalTable";
import { canonicalGatewayId } from "@/components/modern-jobs/conditional/gateway-catalog";
import { GUIDED_ONLY_TEMPLATES, getModernJobsTableDefinition, getGuidedOnlyTableDefinition } from "./tables/definitions/modernJobsTableDefinitions";
import { getStatisticalTableCompletion } from "./tables/StatisticalTableDefinition";
import { quizGovernsEntry, missingQuizFieldKeys } from "./tables/quizRequired";
import { isRowTextEmbeddedInTable } from "@/lib/onefop-tables";
import { TABLE_MAX_WIDTH_PX } from "./tables/tableLayout";
import { resetScroll } from "@/lib/reset-scroll";
import { GuidedReviewGateContext, type GuidedReviewHandle, type GuidedReviewRegistry } from "./tables/GuidedReviewGate";

export interface SectionTableNavState {
  current: number;
  total: number;
  hasMultiple: boolean;
  isDeckFocus: boolean;
  currentTitle?: string;
  nextTitle?: string;
  prevTitle?: string;
}

interface SectionRendererProps {
  section: OnefopSection;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  issues?: ValidationIssue[];
  /** Respondent Identification (Section 0) only: field ids the user has
   * blurred at least once. Gates whether a required-field error is shown
   * for that field — see the section0 branch below. Every other section
   * ignores this and keeps showing `issues` unconditionally, unchanged. */
  touchedFields?: Set<string>;
  /** Called on blur for a field, so its error can start showing once left. */
  onFieldTouch?: (fieldId: string) => void;
  /** True when user tried to advance/continue, revealing all required field errors. */
  attemptedContinue?: boolean;
  /** Optional callback to open the facts interview */
  onOpenScope?: () => void;
  /** Active table id for two-way synchronization with sidebar */
  activeTableId?: string;
  onSelectTable?: (fieldId: string) => void;
  /** Called when the last table in the section is completed/advanced */
  onSectionComplete?: () => void;
  /** Reports table progression state to parent wizard */
  onTableNavStateChange?: (state: SectionTableNavState | null) => void;
  /** Ref to delegate wizard next/prev to table navigation */
  sectionNavRef?: React.MutableRefObject<{ onNext: () => boolean; onPrev: () => boolean } | null>;
  /** Tableau / Guidé choice shared by every section and table (owned by the wizard). */
  entryMode?: "grid" | "guided";
  onEntryModeChange?: (mode: "grid" | "guided") => void;
}

function isShortField(field: OnefopField): boolean {
  return (
    field.type === "text" ||
    field.type === "number" ||
    field.type === "email" ||
    field.type === "tel" ||
    field.type === "date"
  );
}

function getFieldSpan(field: OnefopField): 1 | 2 | 3 | "full" {
  if (field.type === "table" || field.type === "repeating_table") {
    return "full";
  }
  if (field.id.endsWith("_REGION")) {
    return "full";
  }
  if (field.type === "textarea") {
    return "full";
  }
  if (field.type === "checkbox" || field.type === "radio") {
    return field.options && field.options.length <= 3 ? 2 : "full";
  }
  if (isShortField(field)) {
    // A one-third column only fits a short question on one line; give longer
    // questions more room instead of wrapping them over two or three lines.
    const longest = Math.max(field.label?.fr?.length ?? 0, field.label?.en?.length ?? 0);
    if (longest <= 26) return 1;
    return longest <= 60 ? 2 : "full";
  }
  return 2;
}

/**
 * Modernized SectionRenderer for the Modern Jobs Wizard (all non-VT entities).
 * Renders subsections inside structured FormSectionCard containers and arranges
 * questions in responsive CSS FormGrids (1-col mobile, 2-col tablet, 3-col desktop),
 * binds cascading administrative geography, and shows statistical tables as the preliminary quiz decides (ConditionalTable).
 */
export function SectionRenderer({
  section,
  data,
  onChange,
  issues = [],
  touchedFields,
  onFieldTouch,
  attemptedContinue = false,
  onOpenScope,
  activeTableId,
  onSelectTable,
  onSectionComplete,
  onTableNavStateChange,
  sectionNavRef,
  entryMode: entryModeProp,
  onEntryModeChange,
}: SectionRendererProps) {
  const locale: "fr" | "en" = useLocale().startsWith("en") ? "en" : "fr";
  const t = useTranslations("modernJobs.section");
  const { headingByFieldId, startsHeadingFieldIds } = computeSubsectionLayout(section, locale);
  const issueByFieldId = new Map(issues.map((issue) => [issue.fieldId, issue.message]));

  const shouldShowError = (fieldId: string) => {
    return (touchedFields?.has(fieldId) || attemptedContinue) && issueByFieldId.has(fieldId);
  };

  // One table at a time (the "Tout afficher" view was removed); kept as a
  // constant so the existing focus/all branches stay readable.
  const deckMode = "focus" as "focus" | "all";

  // Tableau/Guidé: the wizard owns one choice for the whole declaration, so
  // it carries across sections and tables until the user changes it. The
  // local state is only a fallback when rendered outside the wizard.
  const [localEntryMode, setLocalEntryMode] = useState<"grid" | "guided">(() =>
    typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches ? "guided" : "grid",
  );
  const sectionEntryMode = entryModeProp ?? localEntryMode;
  const setSectionEntryMode = onEntryModeChange ?? setLocalEntryMode;

  // The pinned table-pills bar publishes its height as --mj-pills-h on the
  // wizard root, so the block/category tabs above each table can pin just
  // below it (see AdaptiveStatisticalTable).
  const [pillsEl, setPillsEl] = useState<HTMLDivElement | null>(null);
  const pillsRef = setPillsEl;
  useEffect(() => {
    const root = (pillsEl?.closest("[data-mj-root]") as HTMLElement | null) ?? null;
    if (!pillsEl || !root || typeof ResizeObserver === "undefined") return;
    const publish = () => root.style.setProperty("--mj-pills-h", `${pillsEl.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(pillsEl);
    return () => {
      observer.disconnect();
      root.style.setProperty("--mj-pills-h", "0px");
    };
  }, [pillsEl]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const gateMapRef = useRef<Map<string, GuidedReviewHandle>>(new Map());
  const reviewRegistry = useMemo<GuidedReviewRegistry>(() => ({
    register: (id: string, handle: GuidedReviewHandle) => {
      gateMapRef.current.set(id, handle);
    },
    unregister: (id: string) => {
      gateMapRef.current.delete(id);
    },
    getHandles: () => Array.from(gateMapRef.current.values()),
  }), []);

  // Partition fields into subsection chunks
  const visibleFields = section.fields.filter((field) => isFieldVisible(field, data));

  interface SubsectionChunk {
    headingId: string;
    title: string | null;
    fields: OnefopField[];
  }

  const chunks: SubsectionChunk[] = [];
  let currentChunk: SubsectionChunk = {
    headingId: "init",
    title: null,
    fields: [],
  };

  for (const field of visibleFields) {
    if (startsHeadingFieldIds.has(field.id)) {
      if (currentChunk.fields.length > 0) {
        chunks.push(currentChunk);
      }
      currentChunk = {
        headingId: field.id,
        title: headingByFieldId.get(field.id) ?? null,
        fields: [field],
      };
    } else {
      currentChunk.fields.push(field);
    }
  }
  if (currentChunk.fields.length > 0) {
    chunks.push(currentChunk);
  }

  const isHandledByGeography = (field: OnefopField) => {
    if (field.id.endsWith("_DEPT") || field.id.endsWith("_SUBDIV") || field.id.endsWith("_LOCALITY")) {
      const prefix = field.id.replace(/_(DEPT|SUBDIV|LOCALITY)$/, "");
      return section.fields.some((f) => f.id === `${prefix}_REGION`);
    }
    return false;
  };

  const isStandaloneStatusField = (field: OnefopField) => {
    return field.id.endsWith("_RESPONSE_STATUS");
  };

  // S3Q02_REASON_n_TEXT / S4Q02_DOMAIN_n_TEXT / S4Q03_DOMAIN_n_TEXT are typed
  // in their table's first column (TableRenderer's GenericGrid), bound to
  // these same field ids — so their standalone inputs are not rendered again.
  // They still count for completion/validation (isFieldSatisfied).
  const isShownInsideTable = (field: OnefopField) =>
    isRowTextEmbeddedInTable(field.id, section.fields);

  const isTableFieldHiddenByScope = (field: OnefopField) => {
    if (field.type === "table" || field.type === "repeating_table" || !!field.table) {
      const statusFieldId = resolveTableStatusFieldId(field, data);
      return data[statusFieldId] === "NONE";
    }
    return false;
  };

  // Single source of truth for "is this field answered" — used by the
  // section's completed-tables count, its per-card status chip, and its
  // step pills alike, so the three can't disagree with each other. A table
  // field is checked against its own entry cells (via the shared
  // getStatisticalTableCompletion), not the field's own `data[f.id]`, which
  // is never set for table-shaped fields — their data lives under many
  // separately-keyed cell fields instead.
  const isFieldSatisfied = (f: OnefopField): boolean => {
    const isTable = f.type === "table" || f.type === "repeating_table" || !!f.table;
    const statusFieldId = isTable ? resolveTableStatusFieldId(f, data) : "";
    const isReportedTable = isTable && data[statusFieldId] === "REPORTED";
    if (!f.required && !isReportedTable) return true;
    if (isCompanionHiddenByGateway(f, data, section.fields)) return true;
    if (isTableFieldHiddenByScope(f)) return true;
    if (isTable) {
      const modernDef = getModernJobsTableDefinition(f, data) ?? getGuidedOnlyTableDefinition(f, data);
      if (modernDef) {
        if (quizGovernsEntry(data)) {
          return missingQuizFieldKeys(modernDef, data).length === 0;
        }
        return getStatisticalTableCompletion(modernDef, data) === "complete";
      }
    }
    const val = data[f.id];
    return val !== undefined && val !== null && val !== "";
  };

  const gatewayErrorForTable = (field: OnefopField): string | undefined => {
    if (field.type !== "table" && field.type !== "repeating_table") {
      return issueByFieldId.get(field.id);
    }
    const paper = canonicalGatewayId(field.paperCode || field.id);
    return (
      issueByFieldId.get(`${paper}_RESPONSE_STATUS`) ??
      issueByFieldId.get(`${field.id}_RESPONSE_STATUS`) ??
      issueByFieldId.get(field.id)
    );
  };

  // Filter valid renderable chunks (exclude chunks where all fields are hidden by scope)
  const validChunks = chunks.filter((chunk) => {
    const renderable = chunk.fields.filter(
      (f) =>
        !isStandaloneStatusField(f) &&
        !isShownInsideTable(f) &&
        !isHandledByGeography(f) &&
        !isCompanionHiddenByGateway(f, data, section.fields) &&
        !isTableFieldHiddenByScope(f)
    );
    return renderable.length > 0;
  });

  const sectionHasTables = section.fields.some(
    (f) => f.type === "table" || f.type === "repeating_table" || !!f.table
  );

  const isMultiTableSection = sectionHasTables && validChunks.length > 1;
  const sectionHasAdaptiveTables = validChunks.some((chunk) =>
    chunk.fields.some(
      (f) =>
        (f.type === "table" || !!f.table) &&
        (getModernJobsTableDefinition(f, data) !== null || GUIDED_ONLY_TEMPLATES.has(f.table?.template ?? "")),
    ),
  );

  const completedChunksCount = validChunks.filter((chunk) =>
    chunk.fields.every(isFieldSatisfied)
  ).length;

  const formatCleanTitle = (raw?: string): string => {
    if (!raw) return "";
    let t = raw
      .replace(/^[0-9]+(\.[0-9]+)*\s*[-–.]?\s*/i, "")
      .replace(/^[A-Z][0-9]+[A-Z0-9]*\s*[-–.]?\s*/i, "")
      .trim();
    if (t === t.toUpperCase() && t.length > 3) {
      t = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    }
    return t;
  };

  // Sync focused index with activeTableId from sidebar / external
  useEffect(() => {
    if (!activeTableId) return;
    const idx = validChunks.findIndex((chunk) =>
      chunk.fields.some(
        (f) =>
          f.id.toLowerCase() === activeTableId.toLowerCase() ||
          (f.paperCode && f.paperCode.toLowerCase() === activeTableId.toLowerCase())
      )
    );
    if (idx !== -1) {
      setFocusedIndex(idx);
    }
  }, [activeTableId, validChunks]);

  // Reset to first chunk when section changes
  useEffect(() => {
    setFocusedIndex(0);
  }, [section.id]);

  const clampedIndex = Math.min(Math.max(0, focusedIndex), Math.max(0, validChunks.length - 1));
  const activeDeckChunk = validChunks[clampedIndex];
  const activeTableField = activeDeckChunk?.fields.find((f) => f.type === "table" || !!f.table);

  const handleSelectDeckIndex = (idx: number) => {
    setFocusedIndex(idx);
    const targetChunk = validChunks[idx];
    const targetField = targetChunk?.fields.find((f) => f.type === "table" || !!f.table);
    if (targetField && onSelectTable) {
      onSelectTable(targetField.id);
    }
    if (deckMode === "all" && targetChunk) {
      const el = document.getElementById(targetChunk.headingId !== "init" ? `subsection-${targetChunk.headingId}` : "");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };


  const handleAdvance = () => {
    if (clampedIndex < validChunks.length - 1) {
      handleSelectDeckIndex(clampedIndex + 1);
      resetScroll(80);
    } else if (onSectionComplete) {
      onSectionComplete();
    }
  };

  const handlePrevious = () => {
    if (clampedIndex > 0) {
      handleSelectDeckIndex(clampedIndex - 1);
      resetScroll(80);
    }
  };

  // Register nav delegation to parent wizard
  useEffect(() => {
    if (!sectionNavRef) return;
    sectionNavRef.current = {
      onNext: () => {
        if (sectionEntryMode === "guided") {
          const handles = reviewRegistry.getHandles();
          // One question per screen: the active guided table steps first
          // (next question → summary). Once its summary is shown, fall
          // through so the deck moves on to the next table.
          for (const h of handles) {
            if (h.advance && h.advance()) return true;
          }
          const unreviewed = handles.filter((h: GuidedReviewHandle) => !h.advance && !h.isReviewing);
          if (unreviewed.length > 0) {
            unreviewed.forEach((h: GuidedReviewHandle) => h.openReview());
            const firstId = unreviewed[0].tableId;
            const targetEl =
              document.getElementById(`guided-review-${firstId}`) ||
              document.getElementById(`guided-table-${firstId}`);
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            return true;
          }
        }

        if (deckMode === "focus" && clampedIndex < validChunks.length - 1) {
          handleSelectDeckIndex(clampedIndex + 1);
          resetScroll(80);
          return true;
        }
        return false;
      },
      onPrev: () => {
        if (sectionEntryMode === "guided") {
          const handles = reviewRegistry.getHandles();
          for (const h of handles) {
            if (h.retreat && h.retreat()) return true;
          }
          const reviewing = handles.filter((h: GuidedReviewHandle) => !h.retreat && h.isReviewing);
          if (reviewing.length > 0) {
            reviewing.forEach((h: GuidedReviewHandle) => h.exitReview());
            resetScroll(80);
            return true;
          }
        }

        if (deckMode === "focus" && clampedIndex > 0) {
          handleSelectDeckIndex(clampedIndex - 1);
          resetScroll(80);
          return true;
        }
        return false;
      },
    };
    return () => {
      if (sectionNavRef) {
        sectionNavRef.current = null;
      }
    };
  });

  // Report table nav state to parent wizard
  useEffect(() => {
    if (!onTableNavStateChange) return;
    if (sectionHasTables && validChunks.length > 1) {
      const currentChunk = validChunks[clampedIndex];
      const prevChunk = clampedIndex > 0 ? validChunks[clampedIndex - 1] : undefined;
      const nextChunk = clampedIndex < validChunks.length - 1 ? validChunks[clampedIndex + 1] : undefined;

      const getChunkTitle = (c?: typeof currentChunk) => {
        if (!c) return undefined;
        const chunkTable = c.fields.find((f) => f.type === "table" || !!f.table);
        return c.title || chunkTable?.paperCode || undefined;
      };

      onTableNavStateChange({
        current: clampedIndex + 1,
        total: validChunks.length,
        hasMultiple: true,
        isDeckFocus: deckMode === "focus" && sectionEntryMode !== "guided",
        currentTitle: getChunkTitle(currentChunk),
        prevTitle: getChunkTitle(prevChunk),
        nextTitle: getChunkTitle(nextChunk),
      });
    } else {
      onTableNavStateChange(null);
    }
  }, [sectionHasTables, validChunks.length, clampedIndex, deckMode, sectionEntryMode, onTableNavStateChange]);

  // Cross-table coherence guidance badge
  const renderCoherenceBadge = (tid?: string) => {
    if (!tid) return null;
    const lower = tid.toLowerCase();

    // S22Q03 (Diplômes) or S22Q04 (Handicap) or S22Q05 (Vulnérables)
    if (lower.includes("s22q03") || lower.includes("s22q04") || lower.includes("s22q05")) {
      const permM = Number(data["s22q01_total_male_total"] ?? 0);
      const permF = Number(data["s22q01_total_female_total"] ?? 0);
      const permTotal = Number(data["s22q01_total_total_total"] ?? data["s22q01_total_total"] ?? (permM + permF));

      const tempM = Number(data["s22q02_total_male_total"] ?? 0);
      const tempF = Number(data["s22q02_total_female_total"] ?? 0);
      const tempTotal = Number(data["s22q02_total_total_total"] ?? data["s22q02_total_total"] ?? (tempM + tempF));

      const grandTotalRecruits = permTotal + tempTotal;

      if (grandTotalRecruits > 0) {
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: "var(--cam-radius-sm)",
              background: "var(--vt-accent-soft, #eaf3ec)",
              border: "1px solid var(--cam-green)",
              color: "var(--cam-green)",
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <span>
              {t("recallRecruits", { total: grandTotalRecruits, permanent: permTotal, temporary: tempTotal })}
            </span>
          </div>
        );
      }
    }

    // S3Q02 or S3Q03 (Motifs de départ / Licenciements)
    if (lower.includes("s3q02") || lower.includes("s3q03")) {
      const depTotal = Number(data["s3q01_total_total"] ?? data["s3q01_total_ensemble_total"] ?? 0);
      if (depTotal > 0) {
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: "var(--cam-radius-sm)",
              background: "var(--cam-success-bg)",
              border: "1px solid var(--cam-green)",
              color: "var(--cam-green)",
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <span>
              {t("recallDepartures", { count: depTotal })}
            </span>
          </div>
        );
      }
    }

    return null;
  };

  const renderChunkCard = (chunk: SubsectionChunk, index: number, isFocusView: boolean = false) => {
    const chunkHasTable = chunk.fields.some((f) => f.type === "table" || f.type === "repeating_table" || !!f.table);
    const hasChunkErrors = chunk.fields.some((f) => issueByFieldId.has(f.id));
    const allChunkAnswered = chunk.fields.every(isFieldSatisfied);

    const status: FormStatus = hasChunkErrors
      ? "has-errors"
      : allChunkAnswered
        ? "complete"
        : "in-progress";

    const statusLabel =
      status === "has-errors"
        ? t("statusToCorrect")
        : status === "complete"
          ? t("statusCompleted")
          : t("statusInProgress");

    const tableField = chunk.fields.find((f) => f.type === "table" || !!f.table);
    const isGuided = sectionEntryMode === "guided";

    return (
      <FormSectionCard
        key={chunk.headingId || index}
        id={chunk.headingId !== "init" ? `subsection-${chunk.headingId}` : undefined}
        title={
          isGuided
            ? (chunk.title ? formatCleanTitle(chunk.title) : undefined)
            : (chunkHasTable ? undefined : (chunk.title ?? undefined))
        }
        status={isGuided ? undefined : (chunkHasTable ? undefined : (chunk.title ? status : undefined))}
        statusLabel={statusLabel}
        style={
          isGuided
            ? {
                background: "transparent",
                border: "none",
                boxShadow: "none",
                borderRadius: 0,
                padding: "0 0 var(--cam-space-5) 0",
                marginBottom: "var(--cam-space-5)",
                borderBottom: index < validChunks.length - 1 ? "1px solid var(--cam-border)" : "none",
                maxWidth: "840px",
              }
            : chunkHasTable
              ? { maxWidth: `calc(${TABLE_MAX_WIDTH_PX}px + 2 * var(--cam-space-5) + 2px)` }
              : undefined
        }
      >
        {chunkHasTable && tableField && renderCoherenceBadge(tableField.id)}
        <FormGrid cols={3}>
          {chunk.fields.map((field) => {
            if (isStandaloneStatusField(field)) return null;
            if (isShownInsideTable(field)) return null;
            if (isTableFieldHiddenByScope(field)) return null;
            if (isCompanionHiddenByGateway(field, data, section.fields)) return null;
            if (isHandledByGeography(field)) return null;

            if (field.id.endsWith("_REGION")) {
              const prefix = field.id.replace(/_REGION$/, "");
              const deptFieldId = `${prefix}_DEPT`;
              const subdivFieldId = `${prefix}_SUBDIV`;
              const localityFieldId = `${prefix}_LOCALITY`;
              const hasLocality = section.fields.some((f) => f.id === localityFieldId);

              const geoErrors: Record<string, string> = {};
              if (issueByFieldId.has(field.id)) geoErrors[field.id] = issueByFieldId.get(field.id)!;
              if (issueByFieldId.has(deptFieldId)) geoErrors[deptFieldId] = issueByFieldId.get(deptFieldId)!;
              if (issueByFieldId.has(subdivFieldId)) geoErrors[subdivFieldId] = issueByFieldId.get(subdivFieldId)!;
              if (hasLocality && issueByFieldId.has(localityFieldId)) {
                geoErrors[localityFieldId] = issueByFieldId.get(localityFieldId)!;
              }

              return (
                <FormCol key={field.id} span="full">
                  <CameroonGeographySelector
                    regionFieldId={field.id}
                    departmentFieldId={deptFieldId}
                    subdivisionFieldId={subdivFieldId}
                    localityFieldId={hasLocality ? localityFieldId : undefined}
                    data={data}
                    onChange={onChange}
                    locale={locale}
                    required={field.required}
                    errors={geoErrors}
                  />
                </FormCol>
              );
            }

            const span = getFieldSpan(field);
            return (
              <FormCol key={field.id} span={span}>
                <FieldRenderer
                  field={field}
                  value={data[field.id]}
                  data={data}
                  onChange={onChange}
                  sectionId={section.id}
                  errorMessage={
                    field.type === "table" || field.type === "repeating_table"
                      ? gatewayErrorForTable(field)
                      : shouldShowError(field.id)
                        ? issueByFieldId.get(field.id)
                        : undefined
                  }
                  onFieldTouch={onFieldTouch}
                  onAdvanceTable={handleAdvance}
                  onPreviousTable={handlePrevious}
                  autoFocusFirstCell={isFocusView}
                  entryMode={sectionEntryMode}
                  onEntryModeChange={setSectionEntryMode}
                  showTableModeToggle={false}
                  onOpenScope={onOpenScope}
                />
              </FormCol>
            );
          })}
        </FormGrid>
      </FormSectionCard>
    );
  };

  return (
    <GuidedReviewGateContext.Provider value={reviewRegistry}>
    <section
      id={section.id}
      aria-labelledby={`${section.id}-heading`}
      style={{
        marginBottom: "var(--cam-space-6, 24px)",
        scrollMarginTop: "80px",
      }}
    >
      {/* ── Section Masthead ──
          For table sections on desktop the sidebar already names the section
          and the pinned pills bar below names the tables, so this block is
          kept for screen readers only (it still labels the <section>). On
          smaller screens, where the sidebar is hidden, it stays visible. */}
      <style>{`
        @media (min-width: 1024px) {
          .mj-section-masthead[data-collapse="true"] {
            position: absolute !important; width: 1px; height: 1px; padding: 0 !important;
            margin: -1px !important; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0 !important;
          }
        }
      `}</style>
      <div
        className="mj-section-masthead"
        data-collapse={isMultiTableSection ? "true" : "false"}
        style={{
          borderBottom: "1px solid var(--cam-border)",
          paddingBottom: "var(--cam-space-4, 16px)",
          marginBottom: "var(--cam-space-5)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--cam-space-4, 16px)",
          }}
        >
          {/* Left: Title + Statistics Subtitle */}
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1
              id={`${section.id}-heading`}
              // Focus target of the wizard on every section change (see
              // useStepFocus); not a Tab stop and not given a focus ring.
              tabIndex={-1}
              style={{
                outline: "none",
                fontFamily: "var(--cam-font-serif)",
                fontSize: "var(--cam-font-size-xl, 1.5rem)",
                fontWeight: 700,
                color: "var(--cam-text)",
                margin: 0,
                lineHeight: 1.25,
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
              }}
            >
              {section.id === "section0"
                ? t("section0Heading")
                : (localized(section.title, locale) || section.id)}
            </h1>
            <p
              style={{
                fontFamily: "var(--cam-font-sans)",
                fontSize: "var(--cam-font-size-xs, 0.8125rem)",
                color: "var(--cam-text-muted)",
                margin: "var(--cam-space-1, 4px) 0 0 0",
              }}
            >
              {isMultiTableSection ? (
                sectionEntryMode === "guided" ? (
                  t("topicsSummary", { total: validChunks.length, completed: completedChunksCount })
                ) : (
                  t("tablesSummary", { total: validChunks.length, completed: completedChunksCount })
                )
              ) : section.id === "section0" ? (
                t("section0Intro")
              ) : section.description ? (
                localized(section.description, locale)
              ) : null}
            </p>
            {visibleFields.length > 0 && <RequiredQuestionsNote />}
          </div>

        </div>

      </div>

      {/* Tableau/Guidé switch for single-table sections — the pills bar below
          (which carries it for multi-table sections) is not rendered when the
          quiz leaves a section with only one table, and the switch must stay
          reachable in every table section. */}
      {!isMultiTableSection && sectionHasAdaptiveTables && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            margin: "calc(-1 * var(--cam-space-3, 12px)) 0 var(--cam-space-3, 12px)",
          }}
        >
          <EntryModeSwitch mode={sectionEntryMode} onChange={setSectionEntryMode} />
        </div>
      )}

      {/* Step Pills Row — pinned under the header while the tables scroll
          (a direct child of <section> so it stays pinned for the whole section). */}
      {isMultiTableSection && (
        <div
          ref={pillsRef}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--cam-space-2, 8px)",
            justifyContent: "space-between",
            flexWrap: "wrap",
            position: "sticky",
            top: "var(--mj-header-h, 0px)",
            zIndex: 30,
            background: "var(--cam-bg)",
            margin: "calc(-1 * var(--cam-space-3, 12px)) 0 var(--cam-space-3, 12px)",
            padding: "var(--cam-space-2, 8px) 0",
            borderBottom: "1px solid var(--cam-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2, 8px)", flexWrap: "wrap", flex: "1 1 auto", minWidth: 0 }}>
          {validChunks.map((chunk, cIdx) => {
            const isCurrent = cIdx === clampedIndex;
            const chunkTable = chunk.fields.find((f) => f.type === "table" || !!f.table);
            const chunkHasError = chunk.fields.some((f) => issueByFieldId.has(f.id));
            const chunkAllAnswered = chunk.fields.every(isFieldSatisfied);
            const rawTitle = chunk.title || chunkTable?.paperCode || `T${cIdx + 1}`;
            const cleanTitle = formatCleanTitle(rawTitle) || rawTitle;

            return (
              <button
                key={chunk.headingId || cIdx}
                type="button"
                onClick={() => handleSelectDeckIndex(cIdx)}
                className="cam-hoverable"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: "var(--cam-radius-control, 6px)",
                  fontSize: "var(--cam-font-size-xs, 0.8125rem)",
                  fontWeight: isCurrent ? 600 : 500,
                  background: isCurrent
                    ? "var(--cam-green)"
                    : chunkHasError
                      ? "var(--cam-error-bg)"
                      : chunkAllAnswered
                        ? "var(--cam-success-bg)"
                        : "var(--cam-surface)",
                  color: isCurrent
                    ? "#ffffff"
                    : chunkHasError
                      ? "var(--cam-error)"
                      : chunkAllAnswered
                        ? "var(--cam-green)"
                        : "var(--cam-text-muted)",
                  border: isCurrent
                    ? "1px solid var(--cam-green)"
                    : chunkHasError
                      ? "1px solid var(--cam-error-border)"
                      : chunkAllAnswered
                        ? "1px solid var(--cam-success-border)"
                        : "1px solid var(--cam-border-strong)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {chunkAllAnswered && !chunkHasError && <span aria-hidden="true">✓</span>}
                <span>{`${cIdx + 1}. ${cleanTitle}`}</span>
              </button>
            );
          })}
          </div>

          {/* Right: one Tableau/Guidé switch for the whole section + keyboard help */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2, 8px)", flex: "0 0 auto" }}>
            {sectionHasAdaptiveTables && (
              <EntryModeSwitch mode={sectionEntryMode} onChange={setSectionEntryMode} />
            )}
            <button
              type="button"
              onClick={() => setShowShortcutsHelp((v) => !v)}
              aria-expanded={showShortcutsHelp}
              title={t("shortcutsTitle")}
              aria-label={t("shortcutsAria")}
              className="cam-hoverable"
              style={{
                background: showShortcutsHelp ? "var(--cam-surface-subtle)" : "var(--cam-surface)",
                border: "1px solid var(--cam-border)",
                borderRadius: "var(--cam-radius-control, 6px)",
                width: 32,
                height: 32,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--cam-text-muted)",
                cursor: "pointer",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                <line x1="6" y1="8" x2="6" y2="8" />
                <line x1="10" y1="8" x2="10" y2="8" />
                <line x1="14" y1="8" x2="14" y2="8" />
                <line x1="18" y1="8" x2="18" y2="8" />
                <line x1="6" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="18" y2="12" />
                <line x1="7" y1="16" x2="17" y2="16" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Shortcuts Help Box (if toggled) */}
      {isMultiTableSection && showShortcutsHelp && (
        <div
          className="cam-panel-fade-in"
          style={{
            marginBottom: "var(--cam-space-3, 12px)",
            background: "var(--cam-surface-subtle)",
            border: "1px solid var(--cam-border)",
            borderRadius: "var(--cam-radius-control, 6px)",
            padding: "10px 14px",
            fontSize: "var(--cam-font-size-xs, 0.8125rem)",
            color: "var(--cam-text)",
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div><kbd style={{ background: "var(--cam-border)", padding: "2px 6px", borderRadius: 3, fontWeight: 700 }}>Tab</kbd> : {t("shortcutNextCell")}</div>
          <div><kbd style={{ background: "var(--cam-border)", padding: "2px 6px", borderRadius: 3, fontWeight: 700 }}>{t("keyShiftTab")}</kbd> : {t("shortcutPrevCell")}</div>
          <div><kbd style={{ background: "var(--cam-border)", padding: "2px 6px", borderRadius: 3, fontWeight: 700 }}>{t("keyEnter")}</kbd> : {t("shortcutConfirmNext")}</div>
          <div><kbd style={{ background: "var(--cam-border)", padding: "2px 6px", borderRadius: 3, fontWeight: 700 }}>{t("keyCtrlEnter")}</kbd> : {t("shortcutJumpNext")}</div>
          <div><kbd style={{ background: "var(--cam-border)", padding: "2px 6px", borderRadius: 3, fontWeight: 700 }}>↑ ↓ ← →</kbd> : {t("shortcutArrows")}</div>
        </div>
      )}


      {section.id.startsWith("section1_") ? (
        <Section1ThematicRenderer
          section={section}
          data={data}
          onChange={onChange}
          issues={issues}
          locale={locale}
          touchedFields={touchedFields}
          onFieldTouch={onFieldTouch}
          attemptedContinue={attemptedContinue}
        />
      ) : section.id === "section0" ? (
        <div
          style={{
            background: "var(--cam-surface)",
            border: "var(--cam-border-width, 1px) solid var(--cam-border)",
            borderRadius: "var(--cam-radius-md)",
            padding: "var(--cam-space-5)",
            maxWidth: 780,
            width: "100%",
            boxSizing: "border-box",
            boxShadow: "var(--cam-shadow-sm, 0 1px 2px rgba(20, 30, 20, 0.04))",
          }}
        >
          <div
            style={{
              fontSize: "var(--cam-font-size-xs, 0.8125rem)",
              fontWeight: 500,
              color: "var(--cam-text-muted)",
              marginBottom: "var(--cam-space-3, 12px)",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            {t("section0Eyebrow")}
          </div>

          {(() => {
            const allSec0Fields = section.fields.filter(
              (f) => !isStandaloneStatusField(f) && !isHandledByGeography(f)
            );
            const nameField = allSec0Fields.find((f) => f.id === "S0Q01");
            const functionField = allSec0Fields.find((f) => f.id === "S0Q02");
            const tel1Field = allSec0Fields.find((f) => f.id === "S0Q03_TEL1");
            const tel2Field = allSec0Fields.find((f) => f.id === "S0Q03_TEL2");
            const emailField = allSec0Fields.find((f) => f.id === "S0Q03_EMAIL");
            const handledIds = new Set(["S0Q01", "S0Q02", "S0Q03_TEL1", "S0Q03_TEL2", "S0Q03_EMAIL"]);
            const remainingFields = allSec0Fields.filter((f) => !handledIds.has(f.id));

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {nameField && (
                  <FieldRenderer
                    field={nameField}
                    value={data[nameField.id]}
                    data={data}
                    onChange={onChange}
                    sectionId={section.id}
                    errorMessage={shouldShowError(nameField.id) ? issueByFieldId.get(nameField.id) : undefined}
                    onFieldTouch={onFieldTouch}
                  />
                )}

                {functionField && (
                  <FieldRenderer
                    field={functionField}
                    value={data[functionField.id]}
                    data={data}
                    onChange={onChange}
                    sectionId={section.id}
                    errorMessage={shouldShowError(functionField.id) ? issueByFieldId.get(functionField.id) : undefined}
                    onFieldTouch={onFieldTouch}
                  />
                )}

                {(tel1Field || tel2Field) && (
                  <div
                    style={{
                      display: "grid",
                      // Side by side only when both questions fit on one line each.
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))",
                      gap: 12,
                    }}
                  >
                    {tel1Field && (
                      <FieldRenderer
                        field={tel1Field}
                        value={data[tel1Field.id]}
                        data={data}
                        onChange={onChange}
                        sectionId={section.id}
                        errorMessage={shouldShowError(tel1Field.id) ? issueByFieldId.get(tel1Field.id) : undefined}
                        onFieldTouch={onFieldTouch}
                        noBottomMargin
                      />
                    )}
                    {tel2Field && (
                      <FieldRenderer
                        field={tel2Field}
                        value={data[tel2Field.id]}
                        data={data}
                        onChange={onChange}
                        sectionId={section.id}
                        errorMessage={shouldShowError(tel2Field.id) ? issueByFieldId.get(tel2Field.id) : undefined}
                        onFieldTouch={onFieldTouch}
                        noBottomMargin
                      />
                    )}
                  </div>
                )}

                {emailField && (
                  <FieldRenderer
                    field={emailField}
                    value={data[emailField.id]}
                    data={data}
                    onChange={onChange}
                    sectionId={section.id}
                    errorMessage={shouldShowError(emailField.id) ? issueByFieldId.get(emailField.id) : undefined}
                    onFieldTouch={onFieldTouch}
                  />
                )}

                {remainingFields.map((f) => (
                  <FieldRenderer
                    key={f.id}
                    field={f}
                    value={data[f.id]}
                    data={data}
                    onChange={onChange}
                    sectionId={section.id}
                    errorMessage={shouldShowError(f.id) ? issueByFieldId.get(f.id) : undefined}
                    onFieldTouch={onFieldTouch}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      ) : (
        (() => {
          if (validChunks.length === 0 && section.fields.length > 0) {
            return (
              <div
                style={{
                  background: "var(--cam-surface)",
                  border: "1px dashed var(--cam-border)",
                  borderRadius: "var(--cam-radius-md)",
                  padding: "36px 24px",
                  textAlign: "center",
                }}
              >
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    margin: "0 0 8px",
                    color: "var(--cam-text)",
                  }}
                >
                  {t("allNone")}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--cam-text-muted)",
                    maxWidth: 520,
                    margin: "0 auto 20px",
                    lineHeight: 1.5,
                  }}
                >
                  {t("noTablesFromQuiz")}
                </p>
                {onOpenScope && (
                  <button
                    type="button"
                    onClick={onOpenScope}
                    style={{
                      background: "var(--cam-surface)",
                      border: "1px solid var(--cam-border)",
                      borderRadius: "var(--cam-radius-sm)",
                      padding: "8px 18px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--cam-green)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {t("editQuiz")}
                  </button>
                )}
              </div>
            );
          }

          return (
            <div>
              {/* Render tables in Focus Deck (one table at a time, both modes) or stacked for single-table sections */}
              <div
                key={isMultiTableSection && deckMode === "focus" ? `${section.id}-focus-${clampedIndex}` : `${section.id}-all`}
                className="deck-view-transition"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                }}
              >
                {/* Guidé also shows one table at a time (one question per screen inside it). */}
                {isMultiTableSection && deckMode === "focus" ? (
                  activeDeckChunk && renderChunkCard(activeDeckChunk, clampedIndex, true)
                ) : (
                  validChunks.map((chunk, index) => renderChunkCard(chunk, index, false))
                )}
              </div>
            </div>
          );
        })()
      )}
    </section>
    </GuidedReviewGateContext.Provider>
  );
}

/** Section-level Tableau / Guidé switch (same look as the per-table one it replaces). */
function EntryModeSwitch({
  mode,
  onChange,
}: {
  mode: "grid" | "guided";
  onChange: (mode: "grid" | "guided") => void;
}) {
  const t = useTranslations("modernJobs.entryMode");
  const btn = (active: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: active ? "var(--cam-text)" : "transparent",
    color: active ? "#ffffff" : "var(--cam-text-muted)",
    border: "none",
    borderRadius: "var(--cam-radius-sm)",
    padding: "5px 12px",
    fontSize: "var(--cam-font-size-xs, 0.8125rem)",
    fontWeight: 600,
    fontFamily: "var(--cam-font-sans)",
    cursor: "pointer",
  });
  return (
    <div
      role="group"
      aria-label={t("ariaLabel")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "var(--cam-surface)",
        border: "1px solid var(--cam-border)",
        borderRadius: "var(--cam-radius-control, 6px)",
        padding: 2,
      }}
    >
      <button type="button" aria-pressed={mode === "grid"} onClick={() => onChange("grid")} className="cam-hoverable" style={btn(mode === "grid")}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
        {t("grid")}
      </button>
      <button type="button" aria-pressed={mode === "guided"} onClick={() => onChange("guided")} className="cam-hoverable" style={btn(mode === "guided")}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" />
        </svg>
        {t("guided")}
      </button>
    </div>
  );
}
