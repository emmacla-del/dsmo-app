"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import { getDataManagementStats, getPilotageQueues, listAdminQuestionnaires } from "@/lib/api-client";
import { formatCampaignDate, formatCampaignDisplayName } from "@/lib/campaigns";
import { referencePeriodLabel } from "@/lib/onefop-period-label";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { KpiTile } from "@/components/admin/KpiTile";
import { CampaignProgressChart } from "@/components/admin/CampaignProgressChart";
import { DataState } from "@/components/admin/DataState";
import { count, days, daysSince, meterWidth, percent, rate, shortStamp, NOT_PROVIDED } from "@/lib/admin-data-state";
import type { ReviewDelay } from "@/lib/api-client";
import { getQualitySummary, type QualitySummary } from "@/lib/anomaly-registry";
import { resolveEntityName, type NamedSubmission } from "@/lib/onefop-entity-name";
import { usePendingRegistrationsCount } from "@/hooks/usePendingRegistrationsCount";
import { anomalyRegisterHref } from "@/lib/admin-url";
import { DATA_STATS_ROLES, PILOTAGE_READ_ROLES, hasRole } from "@/lib/roles";
import {
  getActiveCollectionCampaigns,
  getCampaignReturns,
  canWritePilotageTargets,
  type PilotageCampaign,
} from "@/lib/pilotage-targets";
import { coverageRows, entityTypeRows, pickCoverageCampaign, ratioToPercent } from "@/lib/pilotage-coverage";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";

// The stored submission status decides the label and the timeline dot's tone.
// `labelKey` is under adminPilotagePage; `tone` is a .cam-dash-timeline-dot
// modifier. An unknown status keeps the dot's muted default.
const STATUS_META: Record<string, { labelKey: string; tone: "success" | "warning" | "error" }> = {
  APPROVED: { labelKey: "statusApproved", tone: "success" },
  PENDING_REVIEW: { labelKey: "statusPending", tone: "warning" },
  CORRECTION_REQUESTED: { labelKey: "statusCorrection", tone: "warning" },
  REJECTED: { labelKey: "statusRejected", tone: "error" },
};

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
  canReadCampaigns,
  canSetQuotas,
}: {
  campaign?: PilotageCampaign;
  /** The active campaign is still being fetched: say so, never "Inactive". */
  isLoading: boolean;
  canReadCampaigns: boolean;
  canSetQuotas: boolean;
}) {
  const t = useTranslations("adminPilotagePage");
  const tRoot = useTranslations();
  const tCommon = useTranslations("common");
  const tTargets = useTranslations("adminTargets");
  const tStatus = useTranslations("adminCampagnesPage.status");
  const locale = useUiLocale();

  const returnsQuery = useQuery({
    queryKey: ["admin", "pilotage", "returns", campaign?.id],
    queryFn: () => getCampaignReturns(campaign!.id),
    enabled: !!campaign,
    refetchInterval: 120000,
  });

  const resource = t("coverageResource");

  if (!canReadCampaigns) {
    return (
      <section className="cam-dash-block" aria-labelledby="dash-coverage-title">
        <BlockHead id="dash-coverage-title" title={t("coverageTitle")} />
        <DataState state="unavailable" resource={resource} title={t("coverageUnavailable")} />
      </section>
    );
  }

  if (!campaign) {
    return (
      <section className="cam-dash-block" aria-labelledby="dash-coverage-title" aria-busy={isLoading || undefined}>
        <BlockHead
          id="dash-coverage-title"
          title={t("coverageTitle")}
          link={<Link href="/admin/campagnes" className="cam-dash-link">{t("manageCampaignsLink")}</Link>}
        />
        <div>
          <div className="cam-dash-card-title-row">
            <h3 className="cam-dash-card-title">{t("campaignCardTitle")}</h3>
            {!isLoading && <span className="cam-badge cam-badge-neutral">{t("campaignInactive")}</span>}
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
  const rows = data ? coverageRows(data) : [];
  const typeRows = data ? entityTypeRows(data) : [];
  const untyped = data?.untypedRegisteredStock ?? 0;
  const detailHref = `/admin/cibles?vue=retours&campagne=${encodeURIComponent(campaign.id)}`;

  return (
    <section className="cam-dash-block" aria-labelledby="dash-coverage-title">
      <BlockHead
        id="dash-coverage-title"
        title={t("coverageTitle")}
        link={<Link href="/admin/campagnes" className="cam-dash-link">{t("campaignDetailsLink")}</Link>}
      />
      <div className="cam-dash-block-body">
        <div>
          <div className="cam-dash-card-title-row">
            <h3 className="cam-dash-card-title">{campaign.name ? formatCampaignDisplayName(campaign.name) : referencePeriodLabel(campaign.code, locale)}</h3>
            <span className={`cam-badge ${campaign.status === "ACTIVE" ? "cam-badge-success" : "cam-badge-neutral"}`}>
              {campaign.status === "ACTIVE"
                ? t("campaignActive")
                : tStatus.has(campaign.status) ? tStatus(campaign.status) : campaign.status}
            </span>
          </div>
          <p className="cam-dash-card-sub">{when}</p>
        </div>

        {returnsQuery.isError ? (
          <DataState dense state="error" resource={resource} error={returnsQuery.error} onRetry={() => returnsQuery.refetch()} />
        ) : !totals ? (
          <DataState dense state="loading" resource={resource} title={t("loadingCoverage")} />
        ) : (
          <>
            {/* Wide screens: the figures beside the curve, not each
                stretched across the page. */}
            <div className="cam-dash-coverage-top">
              <div className="cam-dash-coverage-figures">
                <div>
                  <div className="cam-dash-coverage">
                    <p className="cam-dash-coverage-figure">{percent(responsePct, 1, locale, 0)}</p>
                    <div>
                      <p className="cam-dash-coverage-label">{t("responseRateLabel")}</p>
                      <p className="cam-dash-card-sub">
                        {t("responseRateCaption", { received: totals.received, stock: totals.registeredStock })}
                      </p>
                    </div>
                  </div>
                  <div className="cam-dash-bar" aria-hidden="true">
                    <span style={{ width: meterWidth(responsePct) }} />
                  </div>
                </div>

                <dl className="cam-dash-stats">
                  <div>
                    <dt>{t("onTimeLabel")}</dt>
                    <dd>{count(totals.onTime, locale)}</dd>
                  </div>
                  <div>
                    <dt>{t("lateLabel")}</dt>
                    <dd>{count(totals.late, locale)}</dd>
                  </div>
                  <div>
                    <dt>{t("endorsedLabel")}</dt>
                    <dd>{count(totals.approved, locale)}</dd>
                  </div>
                  <div>
                    <dt>{t("quotaRateLabel")}</dt>
                    {/* The quota rate exists only once quotas are set; until then
                        the absence is named, with the way to set them. */}
                    <dd>
                      {totals.quota != null
                        ? percent(ratioToPercent(totals.quotaRate), 1, locale, 0)
                        : <span className="cam-admin-muted">{t("noQuota")}</span>}
                    </dd>
                    {totals.quota == null && canSetQuotas && (
                      <Link href={`/admin/cibles?vue=quotas&campagne=${encodeURIComponent(campaign.id)}`} className="cam-dash-link">
                        {t("setQuotasLink")}
                      </Link>
                    )}
                  </div>
                </dl>
              </div>

              {/* Is the campaign on pace? The curve ends on totals.received. */}
              <CampaignProgressChart campaignId={campaign.id} registeredStock={totals.registeredStock} />
            </div>

            {/* Wide screens: the two breakdowns side by side. */}
            <div className="cam-dash-coverage-tables">
              <div>
                <div className="cam-dash-table-wrap">
                  <table className="cam-dash-table">
                    <thead>
                      <tr>
                        <th scope="col">{t("territoryColumn")}</th>
                        <th scope="col" className="is-num">{t("receivedColumn")}</th>
                        <th scope="col" className="is-num is-wide-only">{t("lateColumn")}</th>
                        <th scope="col" className="is-num">{t("responseRateColumn")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={4}>
                            <p className="cam-dash-empty">{tTargets("noTerritory")}</p>
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => {
                          const pct = ratioToPercent(row.responseRate);
                          return (
                            <tr key={row.key}>
                              <th scope="row">{row.kind === "central" ? t("centralLevel") : row.name}</th>
                              <td className="is-num">{count(row.received, locale)}</td>
                              <td className="is-num is-wide-only">{count(row.late, locale)}</td>
                              <td className="is-num">
                                <span className="cam-dash-meter-cell">
                                  <span>{percent(pct, 1, locale, 0)}</span>
                                  <span className="cam-dash-bar" aria-hidden="true">
                                    <span style={{ width: meterWidth(pct) }} />
                                  </span>
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
              </div>
              <p className="cam-dash-table-foot">
                <Link href={detailHref} className="cam-dash-link">{t("coverageDetailLink")}</Link>
              </p>
              </div>

              {/* The same headline split by type of organisation: the rows add
                  up to it (server-side, same territory scope). Registered is the
                  denominator of the rate, so it gives way first on a phone. */}
              {(typeRows.length > 0 || untyped > 0) && (
                <div>
                  {typeRows.length > 0 && (
                    <div className="cam-dash-table-wrap">
                      <table className="cam-dash-table">
                        <thead>
                          <tr>
                            <th scope="col">{t("entityTypeColumn")}</th>
                            <th scope="col" className="is-num is-wide-only">{t("registeredColumn")}</th>
                            <th scope="col" className="is-num">{t("receivedColumn")}</th>
                            <th scope="col" className="is-num">{t("responseRateColumn")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {typeRows.map((row) => {
                            const pct = ratioToPercent(row.responseRate);
                            const key = ENTITY_TYPE_OPTION_KEYS[row.entityType];
                            return (
                              <tr key={row.entityType}>
                                <th scope="row">{key ? tRoot(key) : entityTypeLabel(row.entityType)}</th>
                                <td className="is-num is-wide-only">{count(row.registeredStock, locale)}</td>
                                <td className="is-num">{count(row.received, locale)}</td>
                                <td className="is-num">
                                  <span className="cam-dash-meter-cell">
                                    <span>{percent(pct, 1, locale, 0)}</span>
                                    <span className="cam-dash-bar" aria-hidden="true">
                                      <span style={{ width: meterWidth(pct) }} />
                                    </span>
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {untyped > 0 && (
                    <p className="cam-dash-table-foot cam-admin-muted">{t("untypedFootnote", { count: untyped })}</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// The entity name is NOT a flat `companyName` on /admin/questionnaires items;
// it is resolved from the per-entity detail relations — see resolveEntityName.
type ActivitySubmissionItem = NamedSubmission & {
  id?: string;
  adminStatus?: string;
  status?: string;
  region?: string;
  submittedAt?: string;
  createdAt?: string;
  // `region` is read off the same rawData blob the name resolver walks.
  rawData?: NamedSubmission["rawData"] & { enterprise?: { region?: string | null } | null };
};

function RecentActivity({
  items,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  items: ActivitySubmissionItem[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const t = useTranslations("adminPilotagePage");
  const locale = useUiLocale();
  return (
    <section className="cam-dash-block" id="activity" aria-labelledby="dash-activity-title">
      {/* This feed is the latest submissions, so it continues in the dossier
          list. It used to point at the audit journal: different data, and
          AUDIT_ROLES-only, so a 403 for every territorial and ONEFOP admin. */}
      <BlockHead
        id="dash-activity-title"
        title={t("recentActivityTitle")}
        link={<Link href="/admin/dossiers" className="cam-dash-link">{t("viewAllFilesLink")}</Link>}
      />
      {isError ? (
        <DataState
          dense
          state="error"
          resource={t("recentActivityResource")}
          error={error}
          onRetry={onRetry}
        />
      ) : isLoading ? (
        <DataState dense state="loading" resource={t("recentActivityResource")} title={t("loadingActivity")} />
      ) : items.length === 0 ? (
        <DataState dense state="empty" resource={t("recentActivityResource")} title={t("noRecentActivity")} />
      ) : (
        <ol className="cam-dash-timeline">
          {items.map((s, idx) => {
            const statusKey = s.adminStatus || s.status;
            const known = statusKey ? STATUS_META[statusKey] : undefined;
            const label = known ? t(known.labelKey) : statusKey || t("statusPending");
            const region = s.region || s.rawData?.enterprise?.region || null;
            const name = resolveEntityName(s) ?? (s.id ? t("formRef", { id: s.id.slice(0, 8) }) : NOT_PROVIDED);
            return (
              <li key={s.id || idx}>
                <span className="cam-dash-timeline-time">{shortStamp(s.submittedAt || s.createdAt, locale)}</span>
                <span
                  className={`cam-dash-timeline-dot${known ? ` cam-dash-timeline-dot--${known.tone}` : ""}`}
                  aria-hidden="true"
                />
                <span className="cam-dash-timeline-body">
                  {/* Each entry opens its dossier when the record carries an id. */}
                  {s.id ? (
                    <Link href={`/admin/dossiers/${encodeURIComponent(s.id)}`}>{name}</Link>
                  ) : (
                    <strong>{name}</strong>
                  )}{" "}
                  — <span className="cam-admin-muted">{label}</span>
                  {region && <span className="cam-dash-tag">{region}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function DataQuality({ quality, fallbackEligibilityPct }: { quality: QualitySummary | null; fallbackEligibilityPct: number | null }) {
  const t = useTranslations("adminPilotagePage");
  const locale = useUiLocale();
  // Anomalies and warnings are better low: green there would read as good
  // news whatever the rate, so their meter is grey.
  const metrics = [
    { label: t("qualityCompleteness"), value: quality?.completenessRate ?? null, lowerIsBetter: false },
    { label: t("qualityCoherence"), value: quality?.coherenceRate ?? null, lowerIsBetter: false },
    { label: t("qualityAnomalies"), value: quality?.anomalyRate ?? null, lowerIsBetter: true },
    { label: t("qualityWarnings"), value: quality?.warningRate ?? null, lowerIsBetter: true },
    { label: t("qualityEligibility"), value: quality?.statisticalEligibilityRate ?? fallbackEligibilityPct, lowerIsBetter: false },
  ];

  return (
    <section className="cam-dash-block" aria-labelledby="dash-quality-title">
      <BlockHead
        id="dash-quality-title"
        title={t("dataQualityTitle")}
        link={<Link href="/admin/centre-qualite" className="cam-dash-link">{t("qualityCentreLink")}</Link>}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="cam-dash-metric-row">
              <span>{m.label}</span>
              <strong>{percent(m.value, 0, locale)}</strong>
            </div>
            <div className={`cam-dash-bar${m.lowerIsBetter ? " cam-dash-bar--neutral" : ""}`} aria-hidden="true">
              <span style={{ width: meterWidth(m.value) }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Review pace, under the "À traiter" tiles: how long the oldest file has
 * waited for a decision, how many have waited past the threshold, and the
 * median time from submission to decision. All from pilotage/queues, so the
 * figures cover the same territory as the tiles. `null` = not loaded yet.
 */
function ReviewPace({ delay }: { delay: ReviewDelay | null }) {
  const t = useTranslations("adminPilotagePage");
  const locale = useUiLocale();
  const oldestDays = delay ? daysSince(delay.oldestPendingSubmittedAt) : null;
  const overdue = delay?.pendingOverThresholdCount ?? null;

  return (
    <div className="cam-dash-pace">
      <ul className="cam-dash-pace-facts">
        <li>
          {delay && delay.oldestPendingSubmittedAt === null
            ? t("paceNonePending")
            : <>{t("paceOldest")} <strong>{days(oldestDays, locale)}</strong></>}
        </li>
        <li>
          <strong className={overdue ? "is-overdue" : undefined}>{count(overdue, locale)}</strong>{" "}
          {t("paceOverdue", { days: delay?.thresholdDays ?? 7 })}
        </li>
        <li>
          {delay && delay.decidedMedianDays === null
            ? t("paceNoDecision", { window: delay.windowDays })
            : (
              <>
                {t("paceMedian", { window: delay?.windowDays ?? 90 })} <strong>{days(delay?.decidedMedianDays, locale)}</strong>{" "}
                {delay && t("paceDecisions", { count: delay.decidedCount })}
              </>
            )}
        </li>
      </ul>
      <Link href="/admin/dossiers?status=PENDING_REVIEW&sort=oldest" className="cam-dash-link">
        {t("paceLink")}
      </Link>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function PilotagePage() {
  const t = useTranslations();
  const locale = useUiLocale();
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role;
  const isRegional = userRole === "REGIONAL_ADMIN";
  const isDivisional = userRole === "DIVISIONAL_ADMIN";
  const isTerritorial = isRegional || isDivisional;

  const status = useAuthStore((s) => s.status);
  const isAuthenticated = status === "authenticated";

  // These figures move at administrative pace, not every 30s. Each poll of the
  // five queries below opens Prisma connections against Supabase's session-mode
  // pooler, whose ceiling this page was hitting (intermittent EMAXCONNSESSION
  // 500s on /admin/pilotage), so they refetch every 2 minutes.
  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues"],
    queryFn: getPilotageQueues,
    enabled: isAuthenticated,
    refetchInterval: 120000,
  });

  // GET /data-management/stats is territory-scoped server-side (territoryWhere).
  // Role-scoped absence is permanent, so the stage is hidden; scope-scoped absence (the registrations tile below) is temporary and shows "—". Do not unify.
  const canReadDataStats = hasRole(userRole, DATA_STATS_ROLES);
  const statsQuery = useQuery({
    queryKey: ["admin", "data-management", "stats"],
    queryFn: getDataManagementStats,
    refetchInterval: 120000,
    enabled: isAuthenticated && canReadDataStats,
  });

  const recentQuery = useQuery({
    queryKey: ["admin", "questionnaires", "recent", 8],
    queryFn: () => listAdminQuestionnaires({ limit: 8, offset: 0 }),
    enabled: isAuthenticated,
    refetchInterval: 120000,
  });

  // The active ONEFOP collection campaign, from the pilotage route every
  // pilotage reader may call. GET /campaigns would shut DIVISIONAL_ADMIN and
  // CENTRAL_AGENT out of a figure they may read (§21, 2026-10-17).
  const canReadCampaigns = hasRole(userRole, PILOTAGE_READ_ROLES);
  const campaignsQuery = useQuery({
    queryKey: ["admin", "pilotage", "campaigns", "active"],
    queryFn: getActiveCollectionCampaigns,
    enabled: canReadCampaigns,
  });
  const activeCampaign = pickCoverageCampaign(campaignsQuery.data);
  const campaignLoading = !user || (canReadCampaigns && campaignsQuery.isPending);

  const qualityQuery = useQuery({
    queryKey: ["admin", "questionnaires", "quality", "summary", activeCampaign?.id],
    queryFn: () => getQualitySummary(activeCampaign?.id),
    enabled: isAuthenticated,
    refetchInterval: 120000,
  });

  // Registration queue head-count for the "Inscriptions en attente" tile —
  // the same hook as the sidebar and tab badges. Its gate excludes AUDITOR,
  // which reaches this page as the /admin fallback route: left ungated the
  // query would 403 on every poll. Gated off, the count stays null, so the
  // tile renders the honest absence.
  const { count: inscriptionsPending } = usePendingRegistrationsCount(isAuthenticated);

  // Authoritative data only. null until loaded or if query errors.
  const queues = queuesQuery.data ?? null;
  const stats = statsQuery.data ?? null;
  const quality = qualityQuery.data ?? null;

  // Zero is data: if queues returns 0 submissions, totalSubmissions is 0.
  // Never substitute national figures for an empty territorial result.
  const totalSubmissions = queues ? queues.totalSubmissionsCount : null;

  const eligibilityPct = queues ? rate(queues.statisticallyReadyCount, queues.totalSubmissionsCount) : null;


  const statusApproved = queues ? queues.approvedCount : null;

  const recentActivity = recentQuery.data?.items ?? [];

  // Inscriptions: GET /data-management/stats is territory-scoped server-side.
  const totalInscriptions = stats
    ? (stats.totals?.companies ?? stats.totalCompanies ?? null)
    : null;

  const nationalCount = !isTerritorial && queues ? queues.pendingNationalVisasCount : null;
  const readyCount = queues ? queues.statisticallyReadyCount : null;

  // No stage is highlighted: the yellow "Déclarations" box carried no stated
  // meaning (owner, 2026-10-10).
  const pipeline = [
    ...(canReadDataStats ? [{ label: t("adminPilotagePage.pipelineRegistrations"), value: totalInscriptions }] : []),
    { label: t("adminPilotagePage.pipelineDeclarations"), value: totalSubmissions },
    { label: t("adminPilotagePage.pipelineNational"), value: nationalCount },
    { label: t("adminPilotagePage.pipelineApproved"), value: statusApproved },
    { label: t("adminPilotagePage.pipelineExportable"), value: readyCount },
  ];

  // 4 "À TRAITER" tiles: null renders "—" when the source is absent for
  // this actor. Zero is data: an available-but-empty source renders 0.
  const declarationsReview = queues ? (queues.pendingNationalVisasCount ?? 0) : null;
  const correctionsCount = queues ? queues.correctionsUnderReviewCount : null;
  const anomaliesCount = queues ? queues.blockingAnomaliesCount : null;

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: t("adminNav.hubs.supervision") }, { label: t("adminNav.routes.pilotage") }]}
        title={t("adminNav.routes.pilotage")}
        actions={<AdminHeaderActions />}
      />

      {queuesQuery.isError && (
        <DataState
          state="error"
          resource={t("adminPilotagePage.indicatorsResource")}
          error={queuesQuery.error}
          onRetry={() => queuesQuery.refetch()}
        />
      )}

      {/* Coverage first: "how far along is the campaign?" is the question
          this page answers before any queue (owner, 2026-10-17). */}
      <CampaignCoverage
        campaign={activeCampaign}
        isLoading={campaignLoading}
        canReadCampaigns={canReadCampaigns}
        canSetQuotas={canWritePilotageTargets(userRole)}
      />

      <section className="cam-dash-block" aria-labelledby="dash-todo-title">
        <BlockHead id="dash-todo-title" title={t("adminPilotagePage.toProcessTitle")} />

        <div className="cam-dash-kpis">
          <KpiTile
            tone="warning"
            value={inscriptionsPending}
            label={t("adminPilotagePage.kpiPendingRegistrations")}
            href="/admin/inscriptions"
          />
          <KpiTile
            tone="info"
            value={declarationsReview}
            label={t("adminPilotagePage.kpiDeclarationsToReview")}
            href="/admin/dossiers?status=PENDING_REVIEW"
          />
          <KpiTile
            tone="error"
            value={correctionsCount}
            label={t("adminPilotagePage.kpiReturnsToCorrect")}
            href="/admin/dossiers?status=CORRECTION_REQUESTED"
          />
          <KpiTile
            tone="warning"
            value={anomaliesCount}
            label={t("adminPilotagePage.kpiQualityAlerts")}
            // The tile counts open blocking anomalies (blockingAnomaliesCount),
            // so it opens the register filtered to exactly those rows.
            href={anomalyRegisterHref({ status: "OPEN", severity: "BLOCKING" })}
          />
        </div>
        <ReviewPace delay={queues?.reviewDelay ?? null} />
      </section>

      <section className="cam-dash-block" aria-labelledby="dash-pipeline-title">
        <BlockHead id="dash-pipeline-title" title={t("adminPilotagePage.pipelineTitle")} />
        <ol className="cam-dash-pipeline">
          {pipeline.map((stage) => (
            <li key={stage.label}>
              <span className="cam-dash-pipeline-value">{count(stage.value, locale)}</span>
              <span className="cam-dash-pipeline-label">{stage.label}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="cam-dash-columns">
        <RecentActivity
          items={recentActivity}
          isLoading={recentQuery.isLoading}
          isError={recentQuery.isError}
          error={recentQuery.error}
          onRetry={() => recentQuery.refetch()}
        />
        <DataQuality quality={quality} fallbackEligibilityPct={eligibilityPct} />
      </div>
    </div>
  );
}
