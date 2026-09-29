"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData, LocalizedText } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { CodedLabel } from "../ui/QuestionCode";
import { isComputedCspCell } from "@/lib/onefop-formulas";
import { CSP_ROW_LABELS } from "@/lib/onefop-tables";
import {
  type FixedMatrixDefinition,
  type StatisticalColumnDefinition,
  type NominalRosterDefinition,
  type TablePresentationMode,
  getStatisticalTableCompletion,
  resolveAdaptiveStrategy,
} from "./StatisticalTableDefinition";
import { StatisticalGridRenderer } from "./StatisticalGridRenderer";
import { GuidedStatisticalEntry } from "./GuidedStatisticalEntry";
import { NominalRosterRenderer } from "./NominalRosterRenderer";
import { missingQuizFieldKeys } from "./quizRequired";
import { TableCompletionIndicator } from "./TableCompletionIndicator";
import { TABLE_BLOCK_TAB_COL_PX, TABLE_LABEL_COL_PX, TABLE_MAX_WIDTH_PX } from "./tableLayout";
import { CoherenceChip, useCoherence } from "../coherence/Coherence";

/** A run of consecutive columns sharing one header group (e.g. "Licenciement" → H/F/T). */
interface ColumnBlock {
  key: string;
  title: LocalizedText;
  columns: StatisticalColumnDefinition[];
  /** Every column is calculated (e.g. "Ensemble", or the gender "Total" block). */
  computedOnly: boolean;
}

/**
 * Splits a grouped table's (already scope-filtered) columns into their
 * header-group blocks. Returns null for tables without column groups.
 */
function buildColumnBlocks(columns: StatisticalColumnDefinition[]): ColumnBlock[] | null {
  if (columns.length === 0 || !columns.every((c) => c.group)) return null;
  const blocks: ColumnBlock[] = [];
  for (const col of columns) {
    const key = `${col.group!.fr}|${col.group!.en}`;
    const last = blocks[blocks.length - 1];
    if (last && last.key === key) {
      last.columns.push(col);
    } else {
      blocks.push({ key, title: col.group!, columns: [col], computedOnly: false });
    }
  }
  for (const b of blocks) b.computedOnly = b.columns.every((c) => c.kind === "computed");
  return blocks;
}

export type TableViewMode = TablePresentationMode;

export interface AdaptiveStatisticalTableProps {
  definition: FixedMatrixDefinition | NominalRosterDefinition;
  data: FormData;
  onChange: (fieldKey: string, value: unknown) => void;
  allowToggle?: boolean;
  initialMode?: TablePresentationMode;
  /** Optional external entry mode override */
  mode?: TablePresentationMode;
  /** Callback when presentation mode is toggled */
  onModeChange?: (mode: TablePresentationMode) => void;
  className?: string;
  disabled?: boolean;
  /** Gateway follow-up: keep paper code + mode toggle, skip repeating the question. */
  followUp?: boolean;
  onAdvanceTable?: () => void;
  onPreviousTable?: () => void;
  autoFocusFirstCell?: boolean;
  onOpenScope?: () => void;
  /** Schema field id of this table (e.g. "S22Q04"), for coherence anomalies. */
  tableFieldId?: string;
}

/**
 * Adaptive statistical table controller.
 *
 * Employs an explicit, typed Adaptive Strategy to determine whether to present:
 * 1. Direct Grid spreadsheet view (optimal for desktop keyboard entry and wide viewports)
 * 2. Guided step-by-step card view (optimal for mobile touch entry and high-complexity tables)
 *
 * Preserves the Single Source of Truth invariant:
 * - Identical StatisticalTableDefinition
 * - Identical flat FormData dictionary
 * - Identical authoritative calculation contracts
 * - Zero data loss or mutation during view transitions
 */
export function AdaptiveStatisticalTable({
  definition,
  data,
  onChange,
  allowToggle = true,
  initialMode,
  mode,
  onModeChange,
  className = "",
  disabled = false,
  followUp = false,
  onAdvanceTable,
  onPreviousTable,
  autoFocusFirstCell,
  onOpenScope,
  tableFieldId,
}: AdaptiveStatisticalTableProps) {
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const t = useTranslations("modernJobs.adaptive");

  // Responsive mobile viewport detection (< 768px)
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    setIsMobile(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Multi-CSP horizontal selector state (e.g. S22Q03 4D)
  const isMultiCsp = Boolean(
    definition.type === "fixed-matrix" &&
    definition.cspSlices &&
    definition.cspSlices.length > 0
  );

  const [selectedCsp, setSelectedCsp] = useState<string | null>(
    (definition.type === "fixed-matrix" ? definition.activeCsp : null) ?? null
  );

  const activeCsp =
    isMultiCsp && definition.type === "fixed-matrix" && definition.cspSlices
      ? (selectedCsp && definition.cspSlices.includes(selectedCsp)
          ? selectedCsp
          : definition.cspSlices[0])
      : null;

  // Derive effective definition for the active CSP slice
  const effectiveDefinition: FixedMatrixDefinition | NominalRosterDefinition = useMemo(() => {
    if (!isMultiCsp || definition.type !== "fixed-matrix" || !activeCsp) {
      return definition;
    }
    const currentRows = definition.buildRowsForCsp
      ? definition.buildRowsForCsp(activeCsp)
      : definition.rows;
    const currentRecalc = definition.recalcForCsp
      ? definition.recalcForCsp(activeCsp)
      : definition.recalc;
    return {
      ...definition,
      rows: currentRows,
      recalc: currentRecalc,
      activeCsp,
    };
  }, [definition, isMultiCsp, activeCsp]);

  // User manual override state (null = follow strategy)
  const [userOverride, setUserOverride] = useState<TablePresentationMode | null>(
    mode ?? initialMode ?? null
  );

  useEffect(() => {
    if (mode) {
      setUserOverride(mode);
    }
  }, [mode]);

  const handleSetMode = (newMode: TablePresentationMode) => {
    setUserOverride(newMode);
    onModeChange?.(newMode);
  };

  // ── Block tabs for wide grids ──────────────────────────────────────────
  // When a grouped table (e.g. S3Q01: 5 departure types × H/F/T) cannot fit
  // its columns in the frame at TABLE_BLOCK_TAB_COL_PX each, the grid shows
  // one editable block at a time (tabs above the table) plus the calculated
  // block(s) pinned on the right — no horizontal scrolling. Blocks come from
  // the definition's columns, which the scope quiz has already filtered, so
  // only the blocks the respondent selected ever appear as tabs.
  // Callback ref (not useRef) so the observer attaches whenever the grid
  // frame mounts — including after switching from Guidé to Tableau.
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);
  const [frameWidth, setFrameWidth] = useState<number>(TABLE_MAX_WIDTH_PX);
  useEffect(() => {
    const el = frameEl;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setFrameWidth(Math.min(w, TABLE_MAX_WIDTH_PX));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [frameEl]);

  const columnBlocks = useMemo(
    () => (effectiveDefinition.type === "fixed-matrix" ? buildColumnBlocks(effectiveDefinition.columns) : null),
    [effectiveDefinition],
  );
  const editableBlocks = useMemo(() => columnBlocks?.filter((b) => !b.computedOnly) ?? [], [columnBlocks]);
  const pinnedBlocks = useMemo(() => columnBlocks?.filter((b) => b.computedOnly) ?? [], [columnBlocks]);
  const [activeBlockIdx, setActiveBlockIdx] = useState(0);
  const [focusAfterBlockSwitch, setFocusAfterBlockSwitch] = useState(false);
  const clampedBlockIdx = Math.min(activeBlockIdx, Math.max(editableBlocks.length - 1, 0));

  // Height of the pinned category tabs (S22Q03), so the block tabs can pin
  // just below them. Published as --mj-csp-h on this table's root.
  const [cspTabsEl, setCspTabsEl] = useState<HTMLDivElement | null>(null);
  const [cspTabsH, setCspTabsH] = useState(0);
  useEffect(() => {
    if (!cspTabsEl || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setCspTabsH(cspTabsEl.offsetHeight));
    observer.observe(cspTabsEl);
    return () => {
      observer.disconnect();
      setCspTabsH(0);
    };
  }, [cspTabsEl]);

  // When an anomaly tooltip / review list asks to show a cell of this table
  // that sits in another block tab, switch to that block first.
  const coherence = useCoherence();
  const focusRequest = coherence?.focusRequest;
  useEffect(() => {
    if (!focusRequest || effectiveDefinition.type !== "fixed-matrix") return;
    const key = focusRequest.cell.fieldKey;
    const colKey = effectiveDefinition.rows
      .flatMap((row) => Object.entries(row.cells))
      .find(([, cell]) => cell.fieldKey === key)?.[0];
    if (!colKey) return;
    const idx = editableBlocks.findIndex((b) => b.columns.some((c) => c.key === colKey));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- responds to an external navigation request
    if (idx !== -1) setActiveBlockIdx(idx);
  }, [focusRequest, effectiveDefinition, editableBlocks]);

  // If nominal roster, delegate directly to NominalRosterRenderer
  if (effectiveDefinition.type === "nominal-roster") {
    return (
      <NominalRosterRenderer
        definition={effectiveDefinition}
        data={data}
        onChange={onChange}
        disabled={disabled}
        className={className}
      />
    );
  }

  // Authoritatively resolve active presentation mode and capabilities
  const decision = resolveAdaptiveStrategy(effectiveDefinition, {
    isMobile,
    userOverride,
  });
  const viewMode = decision.mode;
  const canToggle = allowToggle && decision.allowToggle;

  // Real completion state for the status badge below — the shared,
  // single-source-of-truth check (see StatisticalTableDefinition.ts) so it
  // can't disagree with the section's step pills / completed-count, which
  // use the same function.
  const tableStatus =
    effectiveDefinition.type === "fixed-matrix"
      ? getStatisticalTableCompletion(effectiveDefinition, data)
      : "complete";

  const statusBadge =
    tableStatus === "complete"
      ? {
          background: "var(--cam-success-bg, #eaf3ec)",
          color: "var(--cam-success, #1e6b3a)",
          border: "1px solid var(--cam-success-border, #c3e0cb)",
          icon: "✓",
          label: t("statusCompleted"),
        }
      : tableStatus === "in-progress"
        ? {
            background: "var(--cam-surface-subtle, #fbfbf9)",
            color: "var(--cam-text-muted, #4a5a50)",
            border: "1px solid var(--cam-border, #d8ddd3)",
            icon: "●",
            label: t("statusInProgress"),
          }
        : null;

  // Authoritative batch cell change with definition.recalc execution
  const handleBatchChange = (updates: Record<string, unknown>) => {
    // 1. Commit all raw changes to FormData
    for (const [key, val] of Object.entries(updates)) {
      onChange(key, val);
    }

    // 2. Perform authoritative 2D table recalculation if defined
    if (effectiveDefinition.type === "fixed-matrix" && effectiveDefinition.recalc) {
      const nextData: Record<string, number> = {};

      for (const row of effectiveDefinition.rows) {
        for (const cell of Object.values(row.cells)) {
          if (cell.kind === "number") {
            const rawVal =
              cell.fieldKey in updates
                ? updates[cell.fieldKey]
                : data[cell.fieldKey];
            if (rawVal !== undefined && rawVal !== null && rawVal !== "") {
              const numVal = Number(rawVal);
              if (!Number.isNaN(numVal)) {
                nextData[cell.fieldKey] = numVal;
              } else {
                nextData[cell.fieldKey] = 0;
              }
            } else {
              nextData[cell.fieldKey] = 0;
            }
          }
        }
      }

      const rawRows =
        effectiveDefinition.rawRows ??
        effectiveDefinition.rows.filter((r) => !r.isTotal).map((r) => r.id);
      const recalculated = effectiveDefinition.recalc(nextData, effectiveDefinition.id, rawRows);
      for (const [k, v] of Object.entries(recalculated)) {
        if (isComputedCspCell(k)) {
          onChange(k, v);
        }
      }
    }
  };

  const handleCellChange = (fieldKey: string, value: unknown) => {
    handleBatchChange({ [fieldKey]: value });
  };

  const totalColumnCount = effectiveDefinition.columns.length;
  const useBlockTabs =
    viewMode === "grid" &&
    editableBlocks.length > 1 &&
    TABLE_LABEL_COL_PX + totalColumnCount * TABLE_BLOCK_TAB_COL_PX > frameWidth;
  const activeBlock = useBlockTabs ? editableBlocks[clampedBlockIdx] : undefined;

  // The grid receives a column-sliced view of the same definition: rows,
  // field keys and recalc are untouched (handleBatchChange above still
  // recalculates against the full effectiveDefinition).
  const gridDefinition: FixedMatrixDefinition = activeBlock
    ? {
        ...effectiveDefinition,
        id: `${effectiveDefinition.id}__${activeBlock.key}`,
        columns: [...activeBlock.columns, ...pinnedBlocks.flatMap((b) => b.columns)],
        headerGroups: [activeBlock, ...pinnedBlocks].map((b) => ({ title: b.title, colSpan: b.columns.length })),
      }
    : effectiveDefinition;

  const fieldId = tableFieldId || definition.id;
  const cleanId = fieldId.replace(/^FIELD_/i, "");
  const responseStatus =
    data[`${fieldId}_RESPONSE_STATUS`] ??
    data[`${fieldId.toUpperCase()}_RESPONSE_STATUS`] ??
    data[`${fieldId.toLowerCase()}_RESPONSE_STATUS`] ??
    data[`${cleanId}_RESPONSE_STATUS`] ??
    data[`${cleanId.toUpperCase()}_RESPONSE_STATUS`] ??
    (definition.paperCode ? data[`${definition.paperCode}_RESPONSE_STATUS`] : undefined) ??
    (definition.paperCode ? data[`${definition.paperCode.toUpperCase()}_RESPONSE_STATUS`] : undefined);

  const isReported =
    responseStatus === "REPORTED" ||
    (!responseStatus && !data._scopeConfig);

  const missingFieldKeys = useMemo(
    () => (isReported ? missingQuizFieldKeys(effectiveDefinition, data) : []),
    [isReported, effectiveDefinition, data]
  );

  const handleFocusFirstIncomplete = () => {
    if (!missingFieldKeys || missingFieldKeys.length === 0) return;
    const firstKey = missingFieldKeys[0];

    // If table uses block tabs, switch to the block containing firstKey
    if (useBlockTabs && effectiveDefinition.type === "fixed-matrix") {
      const colKey = effectiveDefinition.rows
        .flatMap((row) => Object.entries(row.cells))
        .find(([, cell]) => cell.fieldKey === firstKey)?.[0];
      if (colKey) {
        const blockIdx = editableBlocks.findIndex((b) => b.columns.some((c) => c.key === colKey));
        if (blockIdx !== -1 && blockIdx !== clampedBlockIdx) {
          setActiveBlockIdx(blockIdx);
        }
      }
    }

    setTimeout(() => {
      const target =
        document.querySelector<HTMLInputElement>(`input[data-field-key="${firstKey}"]`) ||
        document.getElementById(`cell-input-${firstKey}`) ||
        (document.getElementById(firstKey) as HTMLInputElement | null);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.focus({ preventScroll: true });
        (target as HTMLInputElement).select?.();
      }
    }, 60);
  };

  const blockFillState = (block: ColumnBlock): "empty" | "partial" | "complete" => {
    let total = 0;
    let filled = 0;
    for (const row of effectiveDefinition.rows) {
      if (row.isTotal) continue;
      for (const col of block.columns) {
        const cell = row.cells[col.key];
        if (!cell || cell.kind !== "number") continue;
        total += 1;
        const v = data[cell.fieldKey];
        if (v !== undefined && v !== null && v !== "") filled += 1;
      }
    }
    if (filled === 0) return "empty";
    return filled === total ? "complete" : "partial";
  };

  const goToBlock = (idx: number, focusFirstCell: boolean) => {
    setActiveBlockIdx(idx);
    setFocusAfterBlockSwitch(focusFirstCell);
  };
  const gridAdvance =
    useBlockTabs && clampedBlockIdx < editableBlocks.length - 1
      ? () => goToBlock(clampedBlockIdx + 1, true)
      : onAdvanceTable;
  const gridPrevious =
    useBlockTabs && clampedBlockIdx > 0
      ? () => goToBlock(clampedBlockIdx - 1, true)
      : onPreviousTable;

  const handleGuidedAdvance = () => {
    if (isMultiCsp && definition.type === "fixed-matrix" && definition.cspSlices) {
      const curIdx = definition.cspSlices.indexOf(activeCsp!);
      if (curIdx >= 0 && curIdx < definition.cspSlices.length - 1) {
        setSelectedCsp(definition.cspSlices[curIdx + 1]);
        return;
      }
    }
    onAdvanceTable?.();
  };

  return (
    <div
      className={`w-full my-4 flex flex-col gap-3 ${className}`}
      style={{ ["--mj-csp-h" as string]: `${cspTabsH}px` } as React.CSSProperties}
      data-testid={`adaptive-table-${definition.id}`}
      data-view-mode={viewMode}
    >
      {/* ── Table Top Bar with Prompt, Inline Code Info, Status Badge (Tableur) or Clean Title (Guided) ── */}
      {viewMode === "grid" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-3, 12px)", marginBottom: "var(--cam-space-2, 8px)" }}>
          {/* Row 1: Official Prompt Text + Code Info + Status Badge */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--cam-space-4, 16px)", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2, 8px)", flex: 1, minWidth: 260 }}>
              <span
                style={{
                  fontFamily: "var(--cam-font-serif)",
                  fontSize: "var(--cam-font-size-lg, 1.125rem)",
                  color: "var(--cam-text, #0b1f14)",
                  lineHeight: 1.4,
                }}
              >
                <CodedLabel code={definition.paperCode} text={(definition.caption ? localized(definition.caption, locale) : null) || localized(definition.title, locale)} />
              </span>
            </div>

            <CoherenceChip tableFieldId={tableFieldId} />

            {/* Status Badge — reflects actual fill state, hidden when not started */}
            {statusBadge && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: statusBadge.background,
                  color: statusBadge.color,
                  border: statusBadge.border,
                  borderRadius: "var(--cam-radius-full, 9999px)",
                  fontSize: "var(--cam-font-size-2xs, 0.6875rem)",
                  fontWeight: 600,
                  padding: "3px 10px",
                  fontFamily: "var(--cam-font-sans)",
                }}
              >
                {statusBadge.icon} {statusBadge.label}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <h2
              style={{
                fontFamily: "var(--cam-font-serif)",
                fontSize: "var(--cam-font-size-lg, 1.125rem)",
                fontWeight: 700,
                color: "var(--cam-text, #0b1f14)",
                margin: 0,
                lineHeight: 1.35,
              }}
            >
              <CodedLabel code={definition.paperCode} text={(definition.caption ? localized(definition.caption, locale) : null) || localized(definition.title, locale)} />
            </h2>
            <CoherenceChip tableFieldId={tableFieldId} />
          </div>
        </div>
      )}

      {/* ── Table Completion Indicator (Phase 4.4: Incomplete REPORTED Matrix Indicator) ── */}
      {isReported && missingFieldKeys.length > 0 && (
        <TableCompletionIndicator
          missingCount={missingFieldKeys.length}
          onFocusFirstMissing={handleFocusFirstIncomplete}
          locale={locale}
        />
      )}

      {/* ── Horizontal CSP Selector Tabs (Mode Tableur only; e.g. S22Q03 4D) ── */}
      {viewMode === "grid" && isMultiCsp && definition.type === "fixed-matrix" && definition.cspSlices && definition.cspSlices.length > 0 && (
        <div
          ref={setCspTabsEl}
          role="tablist"
          aria-label={t("cspTabs")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            borderBottom: "1px solid var(--cam-border, #d8ddd3)",
            padding: "6px 0",
            overflowX: "auto",
            // Pinned under the header + section pills while the table scrolls.
            position: "sticky",
            top: "calc(var(--mj-header-h, 0px) + var(--mj-pills-h, 0px))",
            zIndex: 26,
            background: "var(--cam-surface, #ffffff)",
          }}
        >
          {definition.cspSlices.map((cspKey) => {
            const isActive = activeCsp === cspKey;
            const labelObj = CSP_ROW_LABELS[cspKey] ?? { fr: cspKey, en: cspKey };
            return (
              <button
                key={cspKey}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setSelectedCsp(cspKey)}
                className="cam-hoverable"
                style={{
                  padding: "6px 14px",
                  fontSize: "var(--cam-font-size-xs, 0.8125rem)",
                  fontWeight: 700,
                  borderRadius: "var(--cam-radius-sm, 4px) var(--cam-radius-sm, 4px) 0 0",
                  borderBottom: "2px solid",
                  borderColor: isActive ? "var(--cam-green, #1e6b3a)" : "transparent",
                  color: isActive ? "var(--cam-green, #1e6b3a)" : "var(--cam-text-muted, #4a5a50)",
                  background: isActive ? "var(--cam-success-bg, #eaf3ec)" : "transparent",
                  boxShadow: isActive ? "var(--cam-shadow-sm, 0 1px 2px rgba(20, 30, 20, 0.04))" : "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                {localized(labelObj, locale)}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Active Renderer ── */}
      {viewMode === "grid" ? (
        <div ref={setFrameEl} className="w-full" style={{ maxWidth: TABLE_MAX_WIDTH_PX }}>
          {useBlockTabs && activeBlock && (
            <BlockTabs
              blocks={editableBlocks}
              pinnedBlocks={pinnedBlocks}
              activeIdx={clampedBlockIdx}
              fillState={blockFillState}
              locale={locale}
              onSelect={(idx) => goToBlock(idx, false)}
            />
          )}
          <StatisticalGridRenderer
            definition={gridDefinition}
            data={data}
            onChange={handleCellChange}
            disabled={disabled}
            onAdvanceTable={gridAdvance}
            onPreviousTable={gridPrevious}
            autoFocusFirstCell={autoFocusFirstCell || focusAfterBlockSwitch}
            tableFieldId={tableFieldId}
            missingFieldKeys={missingFieldKeys}
          />
          {useBlockTabs && activeBlock && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--cam-space-2, 8px)",
                marginTop: "var(--cam-space-2, 8px)",
                fontSize: "var(--cam-font-size-xs, 0.8125rem)",
                color: "var(--cam-text-muted, #4a5a50)",
              }}
            >
              <span style={{ flex: 1 }}>
                {t("blockCounter", { current: clampedBlockIdx + 1, total: editableBlocks.length })}
              </span>
              <button
                type="button"
                className="cam-hoverable"
                disabled={clampedBlockIdx === 0}
                onClick={() => goToBlock(clampedBlockIdx - 1, true)}
                style={blockNavButtonStyle(clampedBlockIdx === 0)}
              >
                {t("prevBlock")}
              </button>
              <button
                type="button"
                className="cam-hoverable"
                disabled={clampedBlockIdx === editableBlocks.length - 1}
                onClick={() => goToBlock(clampedBlockIdx + 1, true)}
                style={blockNavButtonStyle(clampedBlockIdx === editableBlocks.length - 1)}
              >
                {t("nextBlock")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <GuidedStatisticalEntry
          definition={effectiveDefinition}
          data={data}
          onChange={handleCellChange}
          onBatchChange={handleBatchChange}
          disabled={disabled}
          onOpenScope={onOpenScope}
          onAdvanceTable={handleGuidedAdvance}
        />
      )}
    </div>
  );
}

/** Secondary (outline) style — the wizard keeps a single green primary action. */
function blockNavButtonStyle(isDisabled: boolean): React.CSSProperties {
  return {
    padding: "5px 12px",
    fontSize: "var(--cam-font-size-xs, 0.8125rem)",
    fontWeight: 600,
    fontFamily: "var(--cam-font-sans)",
    color: "var(--cam-text, #0b1f14)",
    background: "var(--cam-surface, #ffffff)",
    border: "1px solid var(--cam-border-strong, #aab5a3)",
    borderRadius: "var(--cam-radius-sm, 4px)",
    cursor: isDisabled ? "default" : "pointer",
    opacity: isDisabled ? 0.4 : 1,
  };
}

function BlockTabs({
  blocks,
  pinnedBlocks,
  activeIdx,
  fillState,
  locale,
  onSelect,
}: {
  blocks: ColumnBlock[];
  pinnedBlocks: ColumnBlock[];
  activeIdx: number;
  fillState: (block: ColumnBlock) => "empty" | "partial" | "complete";
  locale: "fr" | "en";
  onSelect: (idx: number) => void;
}) {
  const t = useTranslations("modernJobs.adaptive");
  return (
    <div
      role="tablist"
      aria-label={t("blocksAria")}
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 4,
        overflowX: "auto",
        marginBottom: -1.5,
        // Pinned under the header, the section pills and (S22Q03) the
        // category tabs while the table scrolls.
        position: "sticky",
        top: "calc(var(--mj-header-h, 0px) + var(--mj-pills-h, 0px) + var(--mj-csp-h, 0px))",
        zIndex: 25,
        background: "var(--cam-surface, #ffffff)",
        paddingTop: 4,
      }}
    >
      {blocks.map((block, idx) => {
        const isActive = idx === activeIdx;
        const state = fillState(block);
        const stateLabel =
          state === "complete"
            ? t("blockComplete")
            : state === "partial"
              ? t("blockPartial")
              : t("blockEmpty");
        return (
          <button
            key={block.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`${localized(block.title, locale)} (${stateLabel})`}
            onClick={() => onSelect(idx)}
            className="cam-hoverable"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              fontSize: "var(--cam-font-size-xs, 0.8125rem)",
              fontWeight: 600,
              fontFamily: "var(--cam-font-sans)",
              whiteSpace: "nowrap",
              cursor: "pointer",
              color: isActive ? "var(--cam-text, #0b1f14)" : "var(--cam-text-muted, #4a5a50)",
              background: isActive ? "var(--cam-surface, #ffffff)" : "transparent",
              border: "1px solid",
              borderColor: isActive ? "#475569" : "transparent",
              borderBottomColor: isActive ? "var(--cam-surface, #ffffff)" : "transparent",
              borderRadius: "var(--cam-radius-sm, 4px) var(--cam-radius-sm, 4px) 0 0",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 14,
                height: 14,
                borderRadius: "var(--cam-radius-full, 9999px)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                color: "#ffffff",
                border: "1px solid",
                borderColor:
                  state === "complete"
                    ? "var(--cam-success, #1e6b3a)"
                    : state === "partial"
                      ? "var(--cam-success, #1e6b3a)"
                      : "var(--cam-border-strong, #aab5a3)",
                background:
                  state === "complete"
                    ? "var(--cam-success, #1e6b3a)"
                    : state === "partial"
                      ? "linear-gradient(90deg, var(--cam-success, #1e6b3a) 50%, transparent 50%)"
                      : "transparent",
              }}
            >
              {state === "complete" ? "✓" : ""}
            </span>
            {localized(block.title, locale)}
          </button>
        );
      })}
      {pinnedBlocks.map((block) => (
        <span
          key={block.key}
          style={{
            padding: "7px 10px",
            fontSize: "var(--cam-font-size-xs, 0.8125rem)",
            fontStyle: "italic",
            color: "var(--cam-text-muted, #4a5a50)",
            whiteSpace: "nowrap",
          }}
        >
          Σ {localized(block.title, locale)} ({t("calculated")})
        </span>
      ))}
    </div>
  );
}
