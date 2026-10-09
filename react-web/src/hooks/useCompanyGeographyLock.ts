"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FormData } from "@/lib/onefop-schema";
import {
  geographyCorrections,
  lockedGeographyValues,
  type GeographyFieldIds,
} from "@/lib/onefop-geography-lock";
import { myCompanyQueryOptions } from "@/lib/shared-queries";

/**
 * The respondent's own company record (same query key as the ONEFOP preview
 * page, so it is served from cache). Only COMPANY accounts reach the wizard.
 */
export function useMyCompanyGeography() {
  return useQuery(myCompanyQueryOptions).data;
}

/**
 * Locked Section 1 geography values (null when editable), with the form kept
 * equal to what the server will store: any differing draft value is replaced
 * by the company value.
 */
export function useCompanyGeographyLock(
  ids: GeographyFieldIds | null,
  data: FormData,
  onChange: (fieldId: string, value: unknown) => void,
): Record<string, string> | null {
  const company = useMyCompanyGeography();
  const locked = ids ? lockedGeographyValues(company, ids) : null;
  const corrections = geographyCorrections(locked, data);
  const pending = corrections.map(([k, v]) => `${k}=${v}`).join("|");

  useEffect(() => {
    for (const [k, v] of corrections) onChange(k, v);
    // `pending` captures the corrections' content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, onChange]);

  return locked;
}
