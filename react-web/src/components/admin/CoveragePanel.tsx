"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CoverageTable } from "@/components/admin/CoverageTable";
import { formatApiError, getAnnualCoverage, parseYearParam, YEAR_MAX, YEAR_MIN } from "@/lib/pilotage-targets";

/**
 * Annual registration coverage: registered establishments against the
 * registration-campaign targets, per territory.
 *
 * Moved out of /admin/cibles (where it was the "Couverture" tab) into
 * /admin/inscriptions: it measures registrations, not declarations, and sat
 * under a page and a hub about campaign quotas. Same query, same table.
 *
 * Source: GET /admin/pilotage/coverage/annual?year= (PILOTAGE_READ_ROLES —
 * the same four roles as the registration queue), territory-scoped
 * server-side.
 *
 * The year lives in the caller's URL (?annee=), so the view survives a
 * reload; `onYearChange` is how the caller writes it back.
 */
export function CoveragePanel({ year, onYearChange }: { year: number; onYearChange: (year: number) => void }) {
  const [yearDraft, setYearDraft] = useState(String(year));
  useEffect(() => {
    setYearDraft(String(year));
  }, [year]);

  return (
    <>
      <div className="cam-target-toolbar">
        <label className="cam-target-year">
          Année
          <input
            className="cam-input"
            type="number"
            min={YEAR_MIN}
            max={YEAR_MAX}
            value={yearDraft}
            onChange={(event) => setYearDraft(event.target.value)}
            onBlur={() => {
              const parsed = parseYearParam(yearDraft);
              if (parsed != null && parsed !== year) onYearChange(parsed);
              else setYearDraft(String(year));
            }}
          />
        </label>
      </div>
      <CoverageContent year={year} />
    </>
  );
}

function CoverageContent({ year }: { year: number }) {
  const query = useQuery({
    queryKey: ["admin", "pilotage", "coverage", year],
    queryFn: () => getAnnualCoverage(year),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!query.data) return;
    const mixed = query.data.regions.filter((region) => region.mode === "MIXED").map((region) => region.regionId);
    setExpanded(new Set(query.data.regions.length === 1 ? query.data.regions.map((region) => region.regionId) : mixed));
  }, [query.data]);

  if (query.isLoading) return <p className="cam-admin-lede">Chargement…</p>;
  if (query.isError) {
    return <div className="cam-admin-notice cam-admin-notice--error" role="alert">{formatApiError(query.error)}</div>;
  }
  if (!query.data) return null;

  return (
    <CoverageTable
      data={query.data}
      expanded={expanded}
      onToggle={(regionId) =>
        setExpanded((current) => {
          const next = new Set(current);
          if (next.has(regionId)) next.delete(regionId);
          else next.add(regionId);
          return next;
        })
      }
    />
  );
}
