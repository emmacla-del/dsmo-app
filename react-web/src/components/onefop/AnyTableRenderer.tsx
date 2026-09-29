"use client";

import type { FormData, OnefopField } from "@/lib/onefop-schema";
import { ActivitiesTableRenderer } from "./ActivitiesTableRenderer";
import { TableRenderer } from "./TableRenderer";
import { VtTableRenderer } from "./VtTableRenderer";
import { AdaptiveStatisticalTable } from "./tables/AdaptiveStatisticalTable";
import { getGuidedOnlyTableDefinition, getModernJobsTableDefinition } from "./tables/definitions/modernJobsTableDefinitions";

interface AnyTableRendererProps {
  field: OnefopField;
  data: FormData;
  onChange: (cellId: string, value: unknown) => void;
  /** When true, the table sits under a gateway and should not repeat the question. */
  followUp?: boolean;
  onAdvanceTable?: () => void;
  onPreviousTable?: () => void;
  autoFocusFirstCell?: boolean;
  onOpenScope?: () => void;
  mode?: "grid" | "guided";
  onModeChange?: (mode: "grid" | "guided") => void;
  /** False when a section-level Tableau/Guidé switch replaces the per-table one. */
  showModeToggle?: boolean;
}

/**
 * Single dispatch point for every table-shaped field, shared by every
 * presentation mode so this routing exists in exactly one place:
 *  - activities_table → dedicated renderer
 *  - VT tables (table.vt present) → VtTableRenderer
 *  - Modern Jobs tables (S21Q01, S3Q01, S22Q03) → AdaptiveStatisticalTable (dual [ Tableau | Guidé ])
 *  - every other classic (non-VT) table → TableRenderer
 */
export function AnyTableRenderer({
  field,
  data,
  onChange,
  followUp = false,
  onAdvanceTable,
  onPreviousTable,
  autoFocusFirstCell,
  onOpenScope,
  mode,
  onModeChange,
  showModeToggle = true,
}: AnyTableRendererProps) {
  if (field.table?.template === "activities_table") {
    return <ActivitiesTableRenderer field={field} data={data} onChange={onChange} />;
  }
  if (field.table?.vt) {
    return <VtTableRenderer field={field} data={data} onChange={onChange} />;
  }

  // Modern Jobs Wizard adaptive statistical tables (S21Q01, S3Q01, S22Q03)
  const modernDef = getModernJobsTableDefinition(field, data);
  if (modernDef) {
    return (
      <AdaptiveStatisticalTable
        definition={modernDef}
        data={data}
        onChange={onChange}
        followUp={followUp}
        onAdvanceTable={onAdvanceTable}
        onPreviousTable={onPreviousTable}
        autoFocusFirstCell={autoFocusFirstCell}
        onOpenScope={onOpenScope}
        tableFieldId={field.id}
        mode={mode}
        allowToggle={showModeToggle}
        onModeChange={onModeChange}
      />
    );
  }

  // Classic tables (vulnerable people, dismissal reasons, dismissal/technical
  // unemployment, skills and training needs): Tableau keeps TableRenderer
  // unchanged; Guidé asks them question by question (same cell keys), so a
  // grid never appears inside the guided flow.
  if (mode === "guided") {
    const guidedDef = getGuidedOnlyTableDefinition(field, data);
    if (guidedDef) {
      return (
        <AdaptiveStatisticalTable
          definition={guidedDef}
          data={data}
          onChange={onChange}
          followUp={followUp}
          onAdvanceTable={onAdvanceTable}
          onPreviousTable={onPreviousTable}
          autoFocusFirstCell={autoFocusFirstCell}
          onOpenScope={onOpenScope}
          tableFieldId={field.id}
          mode="guided"
          allowToggle={false}
          onModeChange={onModeChange}
        />
      );
    }
  }

  return <TableRenderer field={field} data={data} onChange={onChange} />;
}

