"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { useAuthStore } from "@/lib/auth-store";
import { APPROVAL_ROLES, hasRole } from "@/lib/roles";
import { CoverageBarChart, type CoverageBarItem } from "@/components/admin/CoverageBarChart";
import { CoverageEntityTypeTable, CoverageTable } from "@/components/admin/CoverageTable";
import { DataState } from "@/components/admin/DataState";
import { canListCampaigns, formatApiError, getAnnualCoverage, parseYearParam, YEAR_MAX, YEAR_MIN, type CoverageResponse } from "@/lib/pilotage-targets";
import { count, percent } from "@/lib/admin-data-state";
import { listCompanyRegistrations } from "@/lib/user-directory";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    <Card>
      <CardContent>
        {/* The year is the only control this view has, so it sits with the
            grid it filters rather than as a toolbar band of its own. */}
        <div className="grid w-40 gap-2">
          <Label htmlFor="coverage-year">{t("yearLabel")}</Label>
          <Input
            id="coverage-year"
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
        </div>
      </CardContent>
      <CardContent className="border-t pt-6">
        <CoverageContent year={year} />
      </CardContent>
    </Card>
  );
}

function CoverageContent({ year }: { year: number }) {
  const tCommon = useTranslations("common");
  const tTargets = useTranslations("adminTargets");
  const tRoot = useTranslations();
  const locale = asUiLocale(useLocale());
  /**
   * A ranked region links to its own registration queue — but only for a
   * reader who may open that queue. Coverage is PILOTAGE_READ_ROLES and the
   * queue is APPROVAL_ROLES, so CENTRAL_AGENT reads this view and would
   * otherwise click into a page that refuses it. `status=ALL` lifts the
   * queue's default (pending + complements): the ranking counts registered
   * establishments, not the files still waiting.
   */
  const role = useAuthStore((state) => state.user?.role);
  const canOpenCampaign = canListCampaigns(role);
  const canReadRegistrationQueue = hasRole(role, APPROVAL_ROLES);
  const queueHref = hasRole(role, APPROVAL_ROLES)
    ? (regionName: string, departmentName?: string) => {
        const params = new URLSearchParams({ vue: "file", status: "ALL", region: regionName });
        if (departmentName) params.set("department", departmentName);
        return `/admin/inscriptions?${params.toString()}`;
      }
    : null;
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

  const territoryTable = (
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
  const { items: quotaItems, withoutTarget } = registrationQuotaRanking(
    query.data,
    tTargets("centralLevel"),
    queueHref,
  );
  const quotaRanking = (
    <section className="grid gap-3" aria-labelledby="registration-quota-ranking-title">
      <div>
        <h2 id="registration-quota-ranking-title" className="text-base font-semibold">{tTargets("quotaCoverageTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tTargets("quotaCoverageContext")}</p>
      </div>
      {quotaItems.length > 0 ? (
        <CoverageBarChart
          items={quotaItems}
          ariaLabel={tTargets("quotaCoverageTitle")}
          metric="quota"
          showDistribution
        />
      ) : (
        <p className="text-sm text-muted-foreground">{tTargets("noQuotaCoverageAreas")}</p>
      )}
      {/* A territory with no quota is absent from the ranking and from the
          band counts above it. Saying how many were left out keeps the
          distribution from reading as the whole ressort. */}
      {withoutTarget > 0 && (
        <p className="text-sm text-muted-foreground">
          {tTargets("quotaCoverageWithoutTarget", { count: withoutTarget })}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{tTargets("quotaCoverageRegisterDefinition")}</p>
      {query.data.period.campaignIds.length > 0 ? (
        <div className="text-sm">
          <span className="font-medium">{tTargets("quotaCampaignSourcesLabel")}</span>
          <ul className="mt-1 grid gap-1">
            {query.data.period.campaignIds.map((campaignId) => (
              <li key={campaignId}>
                {canOpenCampaign ? (
                  <Link className="underline underline-offset-2" href={`/admin/cibles?vue=quotas&campagne=${encodeURIComponent(campaignId)}`}>
                    {campaignId}
                  </Link>
                ) : (
                  <code>{campaignId}</code>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );

  // A backend older than 2026-10-24 sends no byEntityType. Rather than an
  // empty second tab, the view then stays the single territory grid it was.
  const byEntityType = query.data.byEntityType;
  if (!byEntityType) return <div className="grid gap-5"><CoverageSummary totals={query.data.totals} />{canReadRegistrationQueue && <CoverageOverdue />}<CoverageAnnualTrend year={year} />{quotaRanking}{territoryTable}</div>;

  return (
    <div className="grid gap-5">
      <CoverageSummary totals={query.data.totals} />
      {canReadRegistrationQueue && <CoverageOverdue />}
      <CoverageAnnualTrend year={year} />
      {quotaRanking}
      <Tabs defaultValue="territory" className="gap-0">
        <TabsList className="mb-3">
          <TabsTrigger value="territory">{tTargets("byTerritoryTab")}</TabsTrigger>
          <TabsTrigger value="type">{tTargets("byEntityTypeTab")}</TabsTrigger>
        </TabsList>
        <TabsContent value="territory" className="mt-0">{territoryTable}</TabsContent>
        <TabsContent value="type" className="mt-0">
          <CoverageEntityTypeTable rows={byEntityType} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CoverageSummary({ totals }: { totals: CoverageResponse["totals"] }) {
  const t = useTranslations("adminTargets");
  const locale = asUiLocale(useLocale());
  return (
    <section className="grid gap-3" aria-labelledby="registration-coverage-total-title">
      <h2 id="registration-coverage-total-title" className="text-base font-semibold">{t("overallCoverageTitle")}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">{t("annualRegisteredTotal")}</p>
          <strong className="text-xl tabular-nums">{count(totals.registeredInYear, locale)}</strong>
          <p className="mt-1 text-xs text-muted-foreground">{t("cumulativeRegisteredCaption", { count: count(totals.registered, locale) })}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">{t("annualQuotaTotal")}</p>
          <strong className="text-xl tabular-nums">{count(totals.inscriptionTarget, locale)}</strong>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">{t("annualCoverageRate")}</p>
          <strong className="text-xl tabular-nums">{percent(totals.rate == null ? null : totals.rate * 100, 1, locale, 0)}</strong>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("annualRegisteredOverQuota", {
              registered: count(totals.registeredInYear, locale),
              quota: count(totals.inscriptionTarget, locale),
            })}
          </p>
        </div>
      </div>
    </section>
  );
}

function CoverageOverdue() {
  const tRoot = useTranslations();
  const t = useTranslations("adminInscriptionsPage");
  const locale = asUiLocale(useLocale());
  const query = useQuery({
    queryKey: ["auth", "company-registrations", "pending-count"],
    queryFn: () => listCompanyRegistrations({ page: 1, pageSize: 1 }),
    refetchInterval: 120_000,
  });
  const days = query.data?.overdueDays ?? 7;
  if (query.isError) {
    return <DataState dense state="error" resource={t("statusOverdue", { days })} error={query.error} onRetry={() => query.refetch()} />;
  }
  if (query.isPending || !query.data) {
    return <DataState dense state="loading" resource={t("statusOverdue", { days })} title={t("metricUnavailable")} />;
  }

  return (
    <Link
      href="/admin/inscriptions?status=OVERDUE"
      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="text-sm font-medium">{tRoot("adminInscriptionsPage.statusOverdue", { days })}</span>
      <strong className={query.data.counts.overdue ? "text-lg tabular-nums text-destructive" : "text-lg tabular-nums"}>{count(query.data.counts.overdue, locale)}</strong>
      <small className="basis-full text-muted-foreground">{t("registrationOverdueCaption")}</small>
    </Link>
  );
}

function CoverageAnnualTrend({ year }: { year: number }) {
  const t = useTranslations("adminTargets");
  const locale = asUiLocale(useLocale());
  const years = Array.from({ length: 5 }, (_, index) => year - 4 + index).filter((item) => item >= YEAR_MIN);
  const queries = useQueries({
    queries: years.map((item) => ({
      queryKey: ["admin", "pilotage", "coverage-trend", item],
      queryFn: () => getAnnualCoverage(item),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    })),
  });
  if (queries.some((query) => query.isError)) {
    return <DataState dense state="error" resource={t("registrationTrendTitle")} onRetry={() => queries.forEach((query) => void query.refetch())} />;
  }
  if (queries.some((query) => query.isPending)) {
    return <DataState dense state="loading" resource={t("registrationTrendTitle")} title={t("registrationTrendLoading")} />;
  }

  const points = years.map((item, index) => ({
    year: item,
    value: queries[index].data ? registrationsInYear(queries[index].data) : 0,
  }));
  const max = Math.max(1, ...points.map((point) => point.value));

  return (
    <section className="grid gap-3" aria-labelledby="registration-coverage-trend-title">
      <div>
        <h2 id="registration-coverage-trend-title" className="text-base font-semibold">{t("registrationTrendTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("registrationTrendContext")}</p>
      </div>
      <ul className="grid gap-2" aria-label={t("registrationTrendTitle")}>
        {points.map((point) => (
          <li key={point.year} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3" aria-label={`${point.year}: ${count(point.value, locale)}`}>
            <span className="text-sm tabular-nums">{point.year}</span>
            <span aria-hidden="true" className="h-3 overflow-hidden rounded bg-muted">
              <span className="block h-full rounded bg-primary" style={{ width: `${(point.value / max) * 100}%` }} />
            </span>
            <strong className="text-sm tabular-nums">{count(point.value, locale)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function registrationsInYear(data: CoverageResponse): number {
  const territorial = data.regions.reduce(
    (total, region) => total + region.departments.reduce((regionTotal, department) => regionTotal + department.registeredInYear, 0),
    0,
  );
  return territorial
    + (data.central?.registeredInYear ?? 0)
    + (data.unassigned?.registeredInYear ?? 0)
    + (data.nullEntityType?.registeredInYear ?? 0);
}

/** The ranking, plus the territories it could not rank. */
interface QuotaRanking {
  items: CoverageBarItem[];
  /**
   * Territories at the ranked level carrying no measurable target. They are
   * not ranked — there is no denominator — but they are not nothing either,
   * so the view says how many were left out rather than dropping them in
   * silence.
   */
  withoutTarget: number;
}

/**
 * The ranking lists ONE level, never a region and its own departments.
 *
 * A region in DEPARTMENT mode has no target of its own: `summarizeRegion`
 * sets region.target to the SUM of its departments' targets. Listing both
 * levels therefore counted the same registrations twice — once in the region
 * row, once across its department rows — and the legend's distribution counted
 * the same territory twice over as well.
 *
 * The rule is the dashboard's (`coverageRows`, lib/pilotage-coverage.ts):
 * regions when the answer spans several, departments when it is a single
 * region, where one region row would say no more than the headline. A single
 * region whose quota sits at region level (REGION mode, so no department
 * carries one) falls back to its own row, otherwise a regional reader with a
 * region-level quota would see an empty ranking.
 *
 * A MIXED region is in neither list: summarizeRegion refuses to total it
 * (region.target is null and so is every rate), so it counts as without a
 * target, which is what it is.
 */
function registrationQuotaRanking(
  data: CoverageResponse,
  centralLabel: string,
  queueHref: ((regionName: string, departmentName?: string) => string) | null,
): QuotaRanking {
  const items: CoverageBarItem[] = [];
  let withoutTarget = 0;
  const singleRegion = data.regions.length === 1;

  for (const region of data.regions) {
    const departments = singleRegion ? region.departments : [];
    const rankedDepartments = departments.filter(
      (department) => department.inscriptionTarget != null && department.inscriptionTarget > 0 && department.rate != null,
    );

    // Departments are the ranked level only when at least one of them carries
    // a quota; otherwise the region itself is, as it is at national scope.
    if (rankedDepartments.length > 0) {
      for (const department of departments) {
        if (department.inscriptionTarget == null || department.inscriptionTarget <= 0 || department.rate == null) {
          withoutTarget += 1;
          continue;
        }
        items.push({
          key: department.departmentId,
          name: department.name,
          responseRate: department.rate * 100,
          received: department.registeredInYear,
          registered: department.inscriptionTarget,
          target: null,
          // Region AND department: department names repeat across regions, so
          // the region has to travel with it for the link to name one place.
          href: queueHref ? queueHref(region.name, department.name) : undefined,
        });
      }
      continue;
    }

    const regionQuota = region.inscriptionTarget != null && region.inscriptionTarget > 0 ? region.inscriptionTarget : null;
    // registeredInYear, not registered: it is the rate's own numerator, so the
    // counts cell and the percentage beside it describe the same thing. It is
    // null exactly when the reader's scope hides region stock, which is what
    // the guard tests.
    if (regionQuota != null && region.rate != null && region.registeredInYear != null) {
      items.push({
        key: region.regionId,
        name: region.name,
        responseRate: region.rate * 100,
        received: region.registeredInYear,
        registered: regionQuota,
        target: null,
        // The queue filters on the region and department NAMES
        // (Company.region / Company.department, matched case-insensitively
        // server-side), the vocabulary its own filter options use. Territorial
        // authority is re-checked there, so a link can never widen what the
        // reader may see.
        href: queueHref ? queueHref(region.name) : undefined,
      });
      continue;
    }
    // A quota the reader cannot measure is not a missing quota: at department
    // scope a REGION-mode region keeps its target but its stock is withheld
    // (CoverageRegionRow.registered is null), so it is unranked without being
    // counted as quota-less, which would be untrue.
    if (regionQuota == null) withoutTarget += 1;
  }

  if (data.central) {
    if (data.central.inscriptionTarget && data.central.inscriptionTarget > 0 && data.central.rate != null) {
      items.push({
        key: "central",
        name: centralLabel,
        responseRate: data.central.rate * 100,
        received: data.central.registeredInYear,
        registered: data.central.inscriptionTarget,
        target: null,
        // The ministry cohort is not a region, so the queue's region filter
        // cannot name it.
      });
    } else {
      withoutTarget += 1;
    }
  }

  return { items, withoutTarget };
}
