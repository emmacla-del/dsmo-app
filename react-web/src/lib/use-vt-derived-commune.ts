"use client";

import { useEffect, useRef } from "react";
import type { FormData, OnefopEntity } from "./onefop-schema";

const SUBDIVISION = "VT1_6";
const COMMUNE = "VT1_7";
export const COMMUNE_DIRTY = "VT1_7_dirty";

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * The commune to write for a training centre, or undefined to leave it.
 * A commune normally bears its arrondissement's name, so 1.7 follows 1.6:
 * it is filled when empty, and moved along when it still holds the
 * arrondissement it was filled from. A commune the respondent typed is
 * theirs and is never replaced (owner, 2026-10-12).
 */
export function deriveVtCommune(
  previousSubdivision: string | undefined,
  subdivision: string,
  commune: string,
  isDirty?: boolean,
): string | undefined {
  if (isDirty) return undefined;
  if (!subdivision || subdivision === previousSubdivision) return undefined;
  if (isDirty === undefined) {
    if (commune === "" || commune === previousSubdivision) return subdivision === commune ? undefined : subdivision;
    return undefined;
  }
  return subdivision === commune ? undefined : subdivision;
}

/**
 * Fills the training centre's commune (1.7) from its arrondissement (1.6),
 * whether the arrondissement was typed, picked, or brought in locked from
 * the company record. Remembers the last arrondissement seen, so clearing
 * and re-choosing it still moves a commune that followed it.
 *
 * A typed commune is dirty and is never replaced.
 */
export function useVtDerivedCommune(
  entity: OnefopEntity | undefined,
  data: FormData,
  onChange: (updates: Record<string, unknown>) => void,
): void {
  const active = entity?.entityType === "vocationalTraining";
  const subdivision = text(data[SUBDIVISION]);
  const commune = text(data[COMMUNE]);
  const previous = useRef<string | undefined>(undefined);
  const derivedValue = useRef<string | undefined>(commune && commune === subdivision ? commune : undefined);
  const isDirty =
    Boolean(data[COMMUNE_DIRTY]) ||
    (commune !== "" && commune !== subdivision && commune !== derivedValue.current);

  useEffect(() => {
    if (!active) return;
    if (commune && commune !== derivedValue.current && !data[COMMUNE_DIRTY]) {
      onChange({ [COMMUNE_DIRTY]: true });
    }
  }, [active, commune, data, onChange]);

  useEffect(() => {
    if (!active || !subdivision) return;
    const next = deriveVtCommune(previous.current, subdivision, commune, isDirty);
    previous.current = subdivision;
    if (next !== undefined) {
      derivedValue.current = next;
      onChange({ [COMMUNE]: next });
    }
  }, [active, subdivision, commune, isDirty, onChange]);
}
