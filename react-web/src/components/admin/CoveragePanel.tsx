"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { CoverageTable } from "@/components/admin/CoverageTable";
import { DataState } from "@/components/admin/DataState";
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
  const t = useTranslations("adminTargets");
  const [yearDraft, setYearDraft] = useState(String(year));
  useEffect(() => {
    setYearDraft(String(year));
  }, [year]);

  return (
    <>
      <div className="cam-target-toolbar">
        <label className="cam-target-year">
          {t("yearLabel")}
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
  const tCommon = useTranslations("common");
  const tRoot = useTranslations();
  const locale = asUiLocale(useLocale());
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

  // Loading and failure render through DataState (G10); the failure keeps
  // the server's own message and gains a retry.
  if (query.isLoading) {
    return <DataState state="loading" resource={tRoot("adminInscriptionsPage.viewCoverage")} title={tCommon("loading")} />;
  }
  if (query.isError) {
    return (
      <DataState
        state="error"
        resource={tRoot("adminInscriptionsPage.viewCoverage")}
        title={formatApiError(query.error, locale)}
        onRetry={() => query.refetch()}
      />
    );
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
