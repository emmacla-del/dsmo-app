"use client";

import { useEffect, useRef } from "react";
import type { FormData, OnefopEntity } from "./onefop-schema";

const SUBDIVISION = "VT1_6";
const COMMUNE = "VT1_7";

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
): string | undefined {
  if (!subdivision || subdivision === previousSubdivision) return undefined;
  if (commune === "" || commune === previousSubdivision) return subdivision === commune ? undefined : subdivision;
  return undefined;
}

/**
 * Fills the training centre's commune (1.7) from its arrondissement (1.6),
 * whether the arrondissement was typed, picked, or brought in locked from
 * the company record. Remembers the last arrondissement seen, so clearing
 * and re-choosing it still moves a commune that followed it.
 *
 * Pass the entity only once the draft has loaded: before that, the form
 * holds the registration prefill without the saved commune, and a commune
 * written then could replace the one the respondent typed (defect 2,
 * 2026-10-16). Nothing is stored to tell a typed commune from a derived
 * one; a commune that differs from the arrondissement is the respondent's.
 */
export function useVtDerivedCommune(
  entity: OnefopEntity | undefined,
  data: FormData,
  onChange: (updates: Record<string, unknown>) => void,
): void {
  const previous = useRef<string | undefined>(undefined);
  const active = entity?.entityType === "vocationalTraining";
  const subdivision = text(data[SUBDIVISION]);
  const commune = text(data[COMMUNE]);

  useEffect(() => {
    if (!active || !subdivision) return;
    const next = deriveVtCommune(previous.current, subdivision, commune);
    previous.current = subdivision;
    if (next !== undefined) onChange({ [COMMUNE]: next });
  }, [active, subdivision, commune, onChange]);
}
