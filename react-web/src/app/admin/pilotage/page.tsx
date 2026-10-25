"use client";

import { Suspense, type ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import { getPilotageQueues } from "@/lib/api-client";
import { formatCampaignDate, formatCampaignDisplayName } from "@/lib/campaigns";
import { referencePeriodLabel } from "@/lib/onefop-period-label";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CampaignActivityTrendChart } from "@/components/admin/CampaignActivityTrendChart";
import { CoverageBarChart } from "@/components/admin/CoverageBarChart";
import { CampaignReviewStatusChart } from "@/components/admin/CampaignReviewStatusChart";
import { DataState } from "@/components/admin/DataState";
import { StatStrip } from "@/components/admin/StatStrip";
import { RegistrationTrendChart } from "@/components/admin/RegistrationTrendChart";
import { count, percent, NOT_PROVIDED } from "@/lib/admin-data-state";
import { anomalyRegisterHref } from "@/lib/admin-url";
import { listCompanyRegistrations } from "@/lib/user-directory";
import { getCompanyStats } from "@/lib/companies-directory";
import { APPROVAL_ROLES, CAMPAIGN_ROLES, DIRECTORY_READ_ROLES, PILOTAGE_READ_ROLES, SURVEY_ROLES, hasRole } from "@/lib/roles";
import {
  getActiveCollectionCampaigns,
  getCampaignReturns,
  type PilotageCampaign,
} from "@/lib/pilotage-targets";
import { coverageRows, entityTypeRows, isCampaignCollectionComplete, pickCoverageCampaign, ratioToPercent } from "@/lib/pilotage-coverage";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** The console locale, for the shared formatters. */
function useUiLocale() {
  return asUiLocale(useLocale());
}

function computeDaysLeft(deadlineStr?: string | null): number | null {
  if (!deadlineStr) return null;
  const targetTime = new Date(deadlineStr).getTime();
  if (Number.isNaN(targetTime)) return null;
  return Math.max(0, Math.ceil((targetTime - Date.now()) / (1000 * 60 * 60 * 24)));
}

// ── Sections ────────────────────────────────────────────────────────────────

// Every block of the dashboard opens the same way: its heading on a rule,
// with the link that continues it on the right. No box around the block.
function BlockHead({ id, title, link }: { id: string; title: string; link?: ReactNode }) {
  return (
    <div className="cam-dash-block-head">
      <h2 id={id} className="cam-dash-block-title">{title}</h2>
      {link}
    </div>
  );
}

/** shadcn Card surface with the dashboard's existing content layout. */
function DashboardCard({
  className = "",
  labelledBy,
  children,
}: {
  className?: string;
  labelledBy: string;
  children: ReactNode;
}) {
  return (
    <Card
      role="region"
      aria-labelledby={labelledBy}
      className={`gap-0 p-6 ${className}`}
    >
      {children}
    </Card>
  );
}

function DashboardActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button variant="link" size="sm" asChild className="cam-dash-text-btn h-auto px-0 py-1">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function DashboardMetricLink({
  href,
  label,
  value,
  caption,
}: {
  href: string;
  label: ReactNode;
  value: ReactNode;
  caption: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="cam-dash-action-metric group rounded-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card className="cam-dash-action-metric-card grid h-full grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 p-3 transition-colors group-hover:bg-accent">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{caption}</small>
      </Card>
    </Link>
  );
}

/**
 * The campaign's coverage, the first thing the dashboard answers: how far
 * the active ONEFOP collection has got, overall and territory by territory.
 *
 * Source: GET /admin/pilotage/campaigns/:id/returns, the figures of
 * /admin/cibles?vue=retours (same query key, so the two share a cache). It
 * counts submissions and registered establishments live, territory-scoped
 * server-side. `campaign.progress` is NOT used: it counts CampaignSubmission
 * rows snapshotted at activation, so it read 0 % while 5 of 7 registered
 * establishments had declared (2026-10-17).
 *
 * The campaign id comes from GET /admin/pilotage/campaigns/active, open to
 * PILOTAGE_READ_ROLES like the returns themselves; any other role (AUDITOR,
 * which lands here as the /admin fallback) sees that the figure is
 * unavailable to it, never "no active campaign".
 */
function CampaignCoverage({
  campaign,
  isLoading,
  isError,
  error,
  onRetry,
  canReadCampaigns,
  canManageCampaigns,
  canAccessSurveyDetails,
}: {
  campaign?: PilotageCampaign;
  /** The active campaign is still being fetched: say so, never "Inactive". */
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  canReadCampaigns: boolean;
  canManageCampaigns: boolean;
  canAccessSurveyDetails: boolean;
}) {
  const t = useTranslations("adminPilotagePage");
  const tRoot = useTranslations();
  const tCommon = useTranslations("common");
  const tTargets = useTranslations("adminTargets");
  const tStatus = useTranslations("adminCampagnesPage.status");
  const locale = useUiLocale();
  const [coverageBreakdown, setCoverageBreakdown] = useState<"territory" | "type">("territory");

  const returnsQuery = useQuery({
    queryKey: ["admin", "pilotage", "returns", campaign?.id],
    queryFn: () => getCampaignReturns(campaign!.id),
    enabled: !!campaign,
    refetchInterval: 120000,
  });

  const resource = t("coverageResource");

  if (!canReadCampaigns) {
    return (
      <section className="cam-dash-block cam-dash-panel" aria-labelledby="dash-coverage-title">
        <BlockHead id="dash-coverage-title" title={t("coverageTitle")} />
        <DataState state="unavailable" resource={resource} title={t("coverageUnavailable")} />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="cam-dash-block cam-dash-panel" aria-labelledby="dash-coverage-title">
        <BlockHead id="dash-coverage-title" title={t("coverageTitle")} />
        <DataState state="error" resource={resource} error={error} onRetry={onRetry} />
      </section>
    );
  }

  if (!campaign) {
    return (
      <section className="cam-dash-block cam-dash-panel" aria-labelledby="dash-coverage-title" aria-busy={isLoading || undefined}>
        <BlockHead
          id="dash-coverage-title"
          title={t("coverageTitle")}
          link={canManageCampaigns ? <DashboardActionLink href="/admin/campagnes">{t("manageCampaignsLink")}</DashboardActionLink> : undefined}
        />
        <div>
          <div className="cam-dash-card-title-row">
            <h3 className="cam-dash-card-title">{t("campaignCardTitle")}</h3>
            {!isLoading && <Badge variant="neutral">{t("campaignInactive")}</Badge>}
          </div>
          <p className="cam-dash-card-sub">{isLoading ? tCommon("loading") : t("noActiveCampaign")}</p>
        </div>
      </section>
    );
  }

  // Campaign dates are Cameroon calendar days (Africa/Douala), not the
  // viewer's own zone: see lib/douala-date.
  // Already the deadline in force (extended when it was): the route says so.
  const deadlineStr = campaign.deadline;
  const daysLeft = computeDaysLeft(deadlineStr);
  const dateRange = campaign.startDate && deadlineStr
    ? `${formatCampaignDate(campaign.startDate)} — ${formatCampaignDate(deadlineStr)}`
    : campaign.startDate
      ? t("since", { date: formatCampaignDate(campaign.startDate) })
      : NOT_PROVIDED;
  const when = daysLeft !== null ? `${dateRange} · ${t("daysRemaining", { days: daysLeft })}` : dateRange;

  const data = returnsQuery.data;
  const totals = data?.totals;
  const responsePct = ratioToPercent(totals?.responseRate);
  const collectionComplete = data ? isCampaignCollectionComplete(data) : false;
  const lowestRateFirst = <T extends { responseRate: number | null }>(items: T[]) =>
    items.slice().sort((a, b) =>
      (a.responseRate ?? Number.POSITIVE_INFINITY) - (b.responseRate ?? Number.POSITIVE_INFINITY),
    );
  const rows = data ? lowestRateFirst(coverageRows(data)) : [];
  const typeRows = data ? lowestRateFirst(entityTypeRows(data)) : [];
  const reportingRegions = data?.regions.filter((region) => region.received > 0).length ?? 0;
  const fullyReportingRegions = data?.regions.filter((region) => region.responseRate === 1).length ?? 0;
  const untyped = data?.untypedRegisteredStock ?? 0;
  const detailHref = `/admin/cibles?vue=retours&campagne=${encodeURIComponent(campaign.id)}`;

  const territoryItems = rows.map((row) => ({
    key: row.key,
    name: row.kind === "central" ? t("centralLevel") : row.name,
    responseRate: ratioToPercent(row.responseRate),
    received: row.received,
    registered: row.registeredStock,
    target: row.quota,
    href: canAccessSurveyDetails ? `${detailHref}&territoire=${encodeURIComponent(row.key)}` : undefined,
  }));

  const typeItems = typeRows.map((row) => {
    const key = ENTITY_TYPE_OPTION_KEYS[row.entityType];
    return {
      key: row.entityType,
      name: key ? tRoot(key) : entityTypeLabel(row.entityType),
      responseRate: ratioToPercent(row.responseRate),
      received: row.received,
      registered: row.registeredStock,
      target: null,
    };
  });
  const territoryReviewItems = rows.map((row) => ({
    key: row.key,
    name: row.kind === "central" ? t("centralLevel") : row.name,
    pendingReview: row.pendingReview,
    correctionRequested: row.correctionRequested,
    approved: row.approved,
    href: canAccessSurveyDetails ? `${detailHref}&territoire=${encodeURIComponent(row.key)}` : undefined,
  }));
  const typeReviewItems = typeRows.map((row) => {
    const key = ENTITY_TYPE_OPTION_KEYS[row.entityType];
    return {
      key: row.entityType,
      name: key ? tRoot(key) : entityTypeLabel(row.entityType),
      pendingReview: row.pendingReview,
      correctionRequested: row.correctionRequested,
      approved: row.approved,
    };
  });

  return (
    <>
      <DashboardCard labelledBy="dash-coverage-title">
        <div className="cam-dash-card-header">
          <div>
            <p className="cam-dash-eyebrow">{t("campaignCardTitle")}</p>
            <h2 id="dash-coverage-title" className="cam-dash-card-heading">
              {campaign.name ? formatCampaignDisplayName(campaign.name) : referencePeriodLabel(campaign.code, locale)}
            </h2>
            <p className="cam-dash-card-subtext">{when}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={campaign.status === "ACTIVE" ? "success" : "neutral"}>
              {campaign.status === "ACTIVE"
                ? t("campaignActive")
                : tStatus.has(campaign.status) ? tStatus(campaign.status) : campaign.status}
            </Badge>
            {canManageCampaigns && (
              <DashboardActionLink href="/admin/campagnes">
                {t("campaignDetailsLink")} →
              </DashboardActionLink>
            )}
          </div>
        </div>

        <div className="cam-dash-block-body">
          {returnsQuery.isError ? (
            <DataState dense state="error" resource={resource} error={returnsQuery.error} onRetry={() => returnsQuery.refetch()} />
          ) : !totals ? (
            <DataState dense state="loading" resource={resource} title={t("loadingCoverage")} />
          ) : (
            <div className="cam-dash-response-kpis">
              <div className="cam-dash-response-kpi">
                <span>{t("responseRateLabel")}</span>
                <strong>{percent(responsePct, 1, locale, 0)}</strong>
                <small>{t("responseRateCaption", { received: count(totals.received, locale), stock: count(totals.registeredStock, locale) })}</small>
              </div>
              <div className="cam-dash-response-kpi">
                <span>{t("regionsReporting")}</span>
                <strong>{count(reportingRegions, locale)} <small>{t("regionsOf", { total: count(data?.regions.length ?? 0, locale) })}</small></strong>
                <small>{t("regionsAtFullResponse", { count: count(fullyReportingRegions, locale) })}</small>
              </div>
              <div className="cam-dash-response-kpi">
                <span>{t("lateLabel")}</span>
                <strong className={totals.late > 0 ? "is-warning" : undefined}>{count(totals.late, locale)}</strong>
                <small>{totals.late > 0 ? t("lateSubmissionsCaption") : t("nothingOverdue")}</small>
              </div>
            </div>
          )}
        </div>
      </DashboardCard>

      {/* The timeline and category breakdown answer different questions. */}
      <div className="cam-dash-coverage-analysis">
        {totals && (
          <DashboardCard className="cam-dash-coverage-breakdown" labelledBy="campaign-coverage-heading">
            <div className="cam-dash-card-header">
              <h3 id="campaign-coverage-heading" className="cam-dash-card-heading">{collectionComplete ? t("reviewStatusTitle") : t("coverageTitle")}</h3>
              {!collectionComplete && coverageBreakdown === "territory" && canAccessSurveyDetails && (
                <DashboardActionLink href={detailHref}>
                  {t("coverageDetailLink")} &rarr;
                </DashboardActionLink>
              )}
            </div>
            {/* Radix renders role="tab" / aria-selected itself, so
                .cam-dash-coverage-tabs keeps styling these unchanged; only the
                hand-rolled roles, ids and aria-controls wiring are gone. The
                two panels are mounted per breakdown rather than one panel
                switching content, which is what gives each its own tab. */}
            <Tabs
              value={coverageBreakdown}
              onValueChange={(value) => setCoverageBreakdown(value === "type" ? "type" : "territory")}
              className="gap-0"
            >
              <TabsList
                className="cam-dash-coverage-tabs h-auto"
                aria-label={collectionComplete ? t("reviewStatusTitle") : t("coverageTitle")}
              >
                <TabsTrigger value="territory">
                  {collectionComplete ? t("reviewByScopeTitle") : t("coverageByScopeTitle")}
                </TabsTrigger>
                <TabsTrigger value="type">
                  {collectionComplete ? t("reviewByTypeTitle") : t("coverageByTypeTitle")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="territory" className="cam-dash-coverage-tabpanel mt-0">
                {collectionComplete ? (
                  <CampaignReviewStatusChart items={territoryReviewItems} ariaLabel={t("reviewByScopeTitle")} />
                ) : rows.length === 0 ? (
                  <p className="cam-dash-empty">{tTargets("noTerritory")}</p>
                ) : (
                  <CoverageBarChart items={territoryItems} ariaLabel={t("coverageByScopeTitle")} />
                )}
              </TabsContent>

              <TabsContent value="type" className="cam-dash-coverage-tabpanel mt-0">
                {collectionComplete ? (
                  <CampaignReviewStatusChart items={typeReviewItems} ariaLabel={t("reviewByTypeTitle")} />
                ) : (
                  <>
                    {typeRows.length > 0
                      ? <CoverageBarChart items={typeItems} ariaLabel={t("coverageByTypeTitle")} />
                      : <p className="cam-dash-empty">{t("progressNone")}</p>}
                    {untyped > 0 && (
                      <p className="cam-dash-detail-text mt-3">
                        {t("untypedFootnote", { count: untyped })}
                      </p>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </DashboardCard>
        )}
        <CampaignActivityTrendChart campaignId={campaign.id} />
      </div>
    </>
  );
}

export default function PilotagePage() {
  return (
    <Suspense fallback={null}>
      <PilotageDashboard />
    </Suspense>
  );
}

function PilotageDashboard() {
  const t = useTranslations();
  const locale = useUiLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedOperation = searchParams.get("operation");
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role;
  const isAuthenticated = useAuthStore((state) => state.status === "authenticated");
  const canReadSurveySubmissions = hasRole(userRole, PILOTAGE_READ_ROLES);
  const canReadCampaigns = canReadSurveySubmissions;
  const canReviewRegistrations = hasRole(userRole, APPROVAL_ROLES);
  const canReadEstablishmentRegister = hasRole(userRole, DIRECTORY_READ_ROLES);
  const canReadRegistrationOperation = canReviewRegistrations || canReadEstablishmentRegister;
  const hasCombinedOperations = canReviewRegistrations && canReadSurveySubmissions;
  const canManageCampaigns = hasRole(userRole, CAMPAIGN_ROLES);
  const canAccessSurveyDetails = hasRole(userRole, SURVEY_ROLES);
  const activeOperation = requestedOperation === "submissions" && canReadSurveySubmissions
    ? "submissions"
    : requestedOperation === "registrations" && canReadRegistrationOperation
      ? "registrations"
      : canReadRegistrationOperation
        ? "registrations"
        : "submissions";
  function selectOperation(operation: "registrations" | "submissions") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("operation", operation);
    router.replace(`/admin/pilotage?${params.toString()}`, { scroll: false });
  }

  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues"],
    queryFn: getPilotageQueues,
    enabled: isAuthenticated && canReadSurveySubmissions,
    refetchInterval: 120000,
  });
  const registrationsQuery = useQuery({
    queryKey: ["auth", "company-registrations", "pending-count"],
    queryFn: () => listCompanyRegistrations({ page: 1, pageSize: 1 }),
    enabled: isAuthenticated && canReviewRegistrations,
    refetchInterval: 120000,
  });
  const companyStatsQuery = useQuery({
    queryKey: ["dsmo", "companies", "stats"],
    queryFn: getCompanyStats,
    enabled: isAuthenticated && canReadEstablishmentRegister,
    refetchInterval: 120000,
  });
  const campaignsQuery = useQuery({
    queryKey: ["admin", "pilotage", "campaigns", "active"],
    queryFn: getActiveCollectionCampaigns,
    enabled: isAuthenticated && canReadCampaigns && activeOperation === "submissions",
  });
  const activeCampaign = pickCoverageCampaign(campaignsQuery.data);
  const campaignLoading = !user || (canReadCampaigns && campaignsQuery.isPending);
  const queues = queuesQuery.data ?? null;

  return (
    <div className="cam-admin-page cam-admin-dashboard">
      <AdminPageHeader
        breadcrumb={[{ label: t("adminNav.hubs.supervision") }, { label: t("adminNav.routes.pilotage") }]}
        title={t("adminNav.routes.pilotage")}
        subtitle={t("adminPilotagePage.dashboardSubtitle")}
      />

      {!canReadRegistrationOperation && !canReadSurveySubmissions ? (
        <DataState
          state="unavailable"
          resource={t("adminNav.routes.pilotage")}
          title={t("adminPilotagePage.dashboardUnavailable")}
        />
      ) : (
        <>
          {hasCombinedOperations && (
            <DashboardCard className="cam-dash-action-summary cam-dash-national-summary" labelledBy="dash-national-summary-title">
              <div className="cam-dash-card-header">
                <div>
                  <h2 id="dash-national-summary-title" className="cam-dash-card-heading">{t("adminPilotagePage.toProcessTitle")}</h2>
                  <p className="cam-dash-detail-text">{t("adminPilotagePage.dashboardSummaryContext")}</p>
                </div>
              </div>
              <div className="cam-dash-action-summary-grid cam-dash-action-summary-grid--five">
                <DashboardMetricLink
                  href="/admin/inscriptions?status=PENDING_APPROVAL"
                  label={t("adminPilotagePage.kpiPendingRegistrations")}
                  value={registrationsQuery.data ? count(registrationsQuery.data.counts.pending, locale) : t("adminPilotagePage.metricUnavailable")}
                  caption={t("adminPilotagePage.registrationPendingCaption")}
                />
                <DashboardMetricLink
                  href="/admin/inscriptions?status=OVERDUE"
                  label={t("adminInscriptionsPage.statusOverdue", { days: registrationsQuery.data?.overdueDays ?? 7 })}
                  value={registrationsQuery.data ? count(registrationsQuery.data.counts.overdue, locale) : t("adminPilotagePage.metricUnavailable")}
                  caption={t("adminPilotagePage.registrationOverdueCaption")}
                />
                <DashboardMetricLink
                  href="/admin/dossiers?status=PENDING_REVIEW"
                  label={t("adminPilotagePage.statusPending")}
                  value={queues?.pendingNationalVisasCount != null ? count(queues.pendingNationalVisasCount, locale) : t("adminPilotagePage.metricUnavailable")}
                  caption={t("adminPilotagePage.kpiDeclarationsToReview")}
                />
                <DashboardMetricLink
                  href="/admin/dossiers?status=CORRECTION_REQUESTED"
                  label={t("adminPilotagePage.statusCorrection")}
                  value={queues?.correctionsUnderReviewCount != null ? count(queues.correctionsUnderReviewCount, locale) : t("adminPilotagePage.metricUnavailable")}
                  caption={t("adminPilotagePage.kpiReturnsToCorrect")}
                />
                <DashboardMetricLink
                  href={anomalyRegisterHref({ status: "OPEN", severity: "BLOCKING" })}
                  label={t("adminPilotagePage.kpiQualityAlerts")}
                  value={queues?.blockingAnomaliesCount != null ? count(queues.blockingAnomaliesCount, locale) : t("adminPilotagePage.metricUnavailable")}
                  caption={t("adminPilotagePage.qualityAnomalies")}
                />
              </div>
            </DashboardCard>
          )}

          <Tabs
            value={activeOperation}
            onValueChange={(value) => {
              if (value === "registrations" || value === "submissions") selectOperation(value);
            }}
            className="gap-0"
          >
            {/* flex-wrap, because the triggers are flex-none: at 375px the
                two of them measured 410px against a 375px viewport and
                scrolled the whole page sideways. They wrap instead. */}
            {hasCombinedOperations && (
              <TabsList className="cam-dash-operation-tabs h-auto w-full flex-wrap justify-start rounded-none bg-transparent p-0" aria-label={t("adminPilotagePage.operationsTabsLabel")}>
                <TabsTrigger
                  value="registrations"
                  id="dash-registrations-tab"
                  className="flex-none rounded-none bg-transparent data-[state=active]:bg-transparent"
                >
                  {t("adminPilotagePage.registrationOperationTab")}
                </TabsTrigger>
                <TabsTrigger
                  value="submissions"
                  id="dash-submissions-tab"
                  className="flex-none rounded-none bg-transparent data-[state=active]:bg-transparent"
                >
                  {t("adminPilotagePage.submissionsOperationTab")}
                </TabsTrigger>
              </TabsList>
            )}

          {activeOperation === "registrations" && canReadRegistrationOperation ? (
            <TabsContent id="dash-registrations-panel" value="registrations" aria-label={t("adminPilotagePage.registrationOperationTab")} className="mt-0">
              {canReadEstablishmentRegister && (
                <DashboardCard className="cam-dash-register-overview" labelledBy="dash-register-overview-title">
                  <div className="cam-dash-card-header">
                    <div>
                      <h2 id="dash-register-overview-title" className="cam-dash-card-heading">
                        {t("adminPilotagePage.registerStatusTitle")}
                      </h2>
                      <p className="cam-dash-detail-text">{t("adminPilotagePage.registerStatusContext")}</p>
                    </div>
                    <DashboardActionLink href="/admin/etablissements">
                      {t("adminPilotagePage.registerStatusLink")} →
                    </DashboardActionLink>
                  </div>
                  <StatStrip
                    label={t("adminPilotagePage.registerStatusTitle")}
                    loadingLabel={t("adminLayout.loadingFigures")}
                    loading={companyStatsQuery.isLoading}
                    error={companyStatsQuery.isError}
                    errorLabel={t("adminLayout.figuresUnavailable")}
                    items={[
                      { key: "total", value: count(companyStatsQuery.data?.total ?? null, locale), label: t("adminEtablissementsPage.kpiTotal") },
                      { key: "active", value: count(companyStatsQuery.data?.active ?? null, locale), label: t("adminEtablissementsPage.kpiActive") },
                      { key: "pending", value: count(companyStatsQuery.data?.pendingValidation ?? null, locale), label: t("adminEtablissementsPage.kpiPending") },
                      { key: "rejected", value: count(companyStatsQuery.data?.rejected ?? null, locale), label: t("adminEtablissementsPage.kpiRejected") },
                      { key: "suspended", value: count(companyStatsQuery.data?.suspended ?? null, locale), label: t("adminEtablissementsPage.kpiSuspended") },
                    ]}
                  />
                  <RegistrationTrendChart />
                </DashboardCard>
              )}

              {canReviewRegistrations && !hasCombinedOperations && (
                <DashboardCard className="cam-dash-action-summary" labelledBy="dash-registration-summary-title">
                  <div className="cam-dash-card-header">
                    <div>
                      <h2 id="dash-registration-summary-title" className="cam-dash-card-heading">
                        {t("adminPilotagePage.registrationSummaryTitle")}
                      </h2>
                      <p className="cam-dash-detail-text">{t("adminPilotagePage.registrationSummaryContext")}</p>
                    </div>
                    <DashboardActionLink href="/admin/inscriptions">
                      {t("adminPilotagePage.registrationQueueLink")} →
                    </DashboardActionLink>
                  </div>
                  <div className="cam-dash-action-summary-grid">
                    <DashboardMetricLink
                      href="/admin/inscriptions?status=PENDING_APPROVAL"
                      label={t("adminInscriptionsPage.statusPending")}
                      value={registrationsQuery.data ? count(registrationsQuery.data.counts.pending, locale) : t("adminPilotagePage.metricUnavailable")}
                      caption={t("adminPilotagePage.registrationPendingCaption")}
                    />
                    <DashboardMetricLink
                      href="/admin/inscriptions?status=COMPLEMENTS_REQUESTED"
                      label={t("adminInscriptionsPage.statusComplements")}
                      value={registrationsQuery.data ? count(registrationsQuery.data.counts.complements, locale) : t("adminPilotagePage.metricUnavailable")}
                      caption={t("adminPilotagePage.registrationComplementsCaption")}
                    />
                    <DashboardMetricLink
                      href="/admin/inscriptions?status=OVERDUE"
                      label={t("adminInscriptionsPage.statusOverdue", { days: registrationsQuery.data?.overdueDays ?? 7 })}
                      value={registrationsQuery.data ? count(registrationsQuery.data.counts.overdue, locale) : t("adminPilotagePage.metricUnavailable")}
                      caption={t("adminPilotagePage.registrationOverdueCaption")}
                    />
                  </div>
                </DashboardCard>
              )}
            </TabsContent>
          ) : canReadSurveySubmissions ? (
            <TabsContent id="dash-submissions-panel" value="submissions" aria-label={t("adminPilotagePage.submissionsOperationTab")} className="mt-0">
              {!hasCombinedOperations && <DashboardCard className="cam-dash-action-summary" labelledBy="dash-submission-summary-title">
                <div className="cam-dash-card-header">
                  <div>
                    <h2 id="dash-submission-summary-title" className="cam-dash-card-heading">
                      {t("adminPilotagePage.toProcessTitle")}
                    </h2>
                    <p className="cam-dash-detail-text">{t("adminPilotagePage.territoryWideContext")}</p>
                  </div>
                </div>
                <div className="cam-dash-action-summary-grid">
                  <DashboardMetricLink
                    href="/admin/dossiers?status=PENDING_REVIEW"
                    label={t("adminPilotagePage.statusPending")}
                    value={queues?.pendingNationalVisasCount != null ? count(queues.pendingNationalVisasCount, locale) : t("adminPilotagePage.metricUnavailable")}
                    caption={t("adminPilotagePage.kpiDeclarationsToReview")}
                  />
                  <DashboardMetricLink
                    href="/admin/dossiers?status=CORRECTION_REQUESTED"
                    label={t("adminPilotagePage.statusCorrection")}
                    value={queues?.correctionsUnderReviewCount != null ? count(queues.correctionsUnderReviewCount, locale) : t("adminPilotagePage.metricUnavailable")}
                    caption={t("adminPilotagePage.kpiReturnsToCorrect")}
                  />
                  <DashboardMetricLink
                    href={anomalyRegisterHref({ status: "OPEN", severity: "BLOCKING" })}
                    label={t("adminPilotagePage.kpiQualityAlerts")}
                    value={queues?.blockingAnomaliesCount != null ? count(queues.blockingAnomaliesCount, locale) : t("adminPilotagePage.metricUnavailable")}
                    caption={t("adminPilotagePage.qualityAnomalies")}
                  />
                </div>
              </DashboardCard>}

          {/* The coverage breakdown — by territory and by entity type — is
              the question this tab exists to answer. A `compact` variant used
              to suppress it here, along with the "regions reporting" figure;
              it was the only caller, so the variant has been removed rather
              than left as a second rendering nobody reached. */}
          <CampaignCoverage
            campaign={activeCampaign}
            isLoading={campaignLoading}
            isError={campaignsQuery.isError}
            error={campaignsQuery.error}
            onRetry={() => campaignsQuery.refetch()}
            canReadCampaigns={canReadCampaigns}
            canManageCampaigns={canManageCampaigns}
            canAccessSurveyDetails={canAccessSurveyDetails}
          />
            </TabsContent>
          ) : null}
          </Tabs>
        </>
      )}
    </div>
  );
}
