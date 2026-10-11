"use client";

import { useEffect, useMemo } from "react";
import type { FormData, OnefopEntity } from "./onefop-schema";
import { hasVtSavedTotals, vtFixedRowTotalsToSave } from "@/components/onefop/tables/vtFixedRowGrid";

/**
 * Keeps the saved totals of every VT fixed-row table, and of the add-a-row
 * tables with a calculated column (4.10, 6.3), equal to the sum of their
 * group, whichever entry mode filled the numbers (owner, 2026-10-11).
 * Runs on the whole declaration, not on the table on screen, so a draft
 * loaded with totals missing or stale is corrected even for tables in tabs
 * the respondent does not reopen. Writes nothing once everything matches.
 */
export function useVtFixedRowTotals(
  entity: OnefopEntity | undefined,
  data: FormData,
  onChange: (updates: Record<string, unknown>) => void,
): void {
  const tables = useMemo(
    () =>
      entity?.entityType === "vocationalTraining"
        ? entity.sections.flatMap((section) => section.fields).filter(hasVtSavedTotals)
        : [],
    [entity],
  );

  useEffect(() => {
    if (tables.length === 0) return;
    const updates: Record<string, unknown> = {};
    for (const field of tables) Object.assign(updates, vtFixedRowTotalsToSave(field, data));
    if (Object.keys(updates).length > 0) onChange(updates);
  }, [tables, data, onChange]);
}
