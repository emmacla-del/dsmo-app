"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import { getDataManagementStats, getPilotageQueues, listAdminQuestionnaires } from "@/lib/api-client";
import { formatCampaignDate, type Campaign } from "@/lib/campaigns";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions, useActiveCampaign } from "@/components/admin/AdminHeaderActions";
import { KpiTile } from "@/components/admin/KpiTile";
import { DataState } from "@/components/admin/DataState";
import { count, meterWidth, percent, rate, shortStamp, NOT_PROVIDED } from "@/lib/admin-data-state";
import { useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { getQualitySummary, type QualitySummary } from "@/lib/anomaly-registry";
import { resolveEntityName, type NamedSubmission } from "@/lib/onefop-entity-name";
import { usePendingRegistrationsCount } from "@/hooks/usePendingRegistrationsCount";
import { anomalyRegisterHref } from "@/lib/admin-url";
import { APPROVAL_ROLES, CAMPAIGN_ROLES, DATA_STATS_ROLES, hasRole } from "@/lib/roles";
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

function SectionLabel({ id, tone, children }: { id: string; tone: "gold" | "green"; children: string }) {
  return (
    <h2 id={id} className={`cam-dash-section-label cam-dash-section-label--${tone}`}>
      {children}
    </h2>
  );
}

/**
 * Links out of the campaign card, each rendered only for roles that can open
 * its target: /admin/campagnes is CAMPAIGN_ROLES (not DIVISIONAL_ADMIN),
 * /admin/cibles is APPROVAL_ROLES (not AUDITOR).
 */
function CampaignLinks({ campaignLabel, canOpenCampaigns, canOpenTargets }: { campaignLabel: string; canOpenCampaigns: boolean; canOpenTargets: boolean }) {
  const t = useTranslations("adminPilotagePage");
  if (!canOpenCampaigns && !canOpenTargets) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--cam-space-2)" }}>
      {canOpenCampaigns && (
        <Link href="/admin/campagnes" className="cam-dash-link">{campaignLabel}</Link>
      )}
      {canOpenTargets && (
        <Link href="/admin/cibles" className="cam-dash-link">{t("quotasLink")}</Link>
      )}
    </div>
  );
}

function CampaignCard({
  campaign,
  totalSubmissions,
  canOpenCampaigns,
  canOpenTargets,
}: {
  campaign?: Campaign;
  totalSubmissions: number | null;
  canOpenCampaigns: boolean;
  canOpenTargets: boolean;
}) {
  const t = useTranslations("adminPilotagePage");
  const locale = useUiLocale();
  const deadlineStr = campaign?.extendedDeadline || campaign?.deadline;
  const daysLeft = computeDaysLeft(deadlineStr);

  if (!campaign) {
    return (
      <section className="cam-dash-card" aria-labelledby="dash-campaign-title">
        <div className="cam-dash-card-head">
          <div>
            <div className="cam-dash-card-title-row">
              <h3 id="dash-campaign-title" className="cam-dash-card-title">{t("campaignCardTitle")}</h3>
              <span className="cam-badge cam-badge-neutral">{t("campaignInactive")}</span>
            </div>
            <p className="cam-dash-card-sub">{t("noActiveCampaign")}</p>
          </div>
          <CampaignLinks campaignLabel={t("manageCampaignsLink")} canOpenCampaigns={canOpenCampaigns} canOpenTargets={canOpenTargets} />
        </div>
      </section>
    );
  }

  const target = campaign.progress?.total ?? null;
  const submittedCount = campaign.progress?.submitted ?? totalSubmissions;
  // null unless both figures are known and the target is non-zero.
  const completionPct = rate(submittedCount, target);

  // Campaign dates are Cameroon calendar days (Africa/Douala), not the
  // viewer's own zone: see lib/douala-date.
  const dateRange = campaign.startDate && deadlineStr
    ? `${formatCampaignDate(campaign.startDate)} — ${formatCampaignDate(deadlineStr)}`
    : campaign.startDate
      ? t("since", { date: formatCampaignDate(campaign.startDate) })
      : NOT_PROVIDED;

  return (
    <section className="cam-dash-card" aria-labelledby="dash-campaign-title">
      <div className="cam-dash-card-head">
        <div>
          <div className="cam-dash-card-title-row">
            <h3 id="dash-campaign-title" className="cam-dash-card-title">{campaign.name || campaign.code}</h3>
            <span className={`cam-badge ${campaign.status === "ACTIVE" ? "cam-badge-success" : "cam-badge-neutral"}`}>
              {campaign.status === "ACTIVE" ? t("campaignActive") : campaign.status}
            </span>
          </div>
          <p className="cam-dash-card-sub">{dateRange}</p>
        </div>
        <CampaignLinks campaignLabel={t("campaignDetailsLink")} canOpenCampaigns={canOpenCampaigns} canOpenTargets={canOpenTargets} />
      </div>

      <div className="cam-dash-metric-row">
        <span>{t("coverageRateLabel")}</span>
        <strong>{percent(completionPct, 0, locale)}</strong>
      </div>
      <div className="cam-dash-bar">
        <span style={{ width: meterWidth(completionPct) }} />
      </div>

      <dl className="cam-dash-stats" style={{ marginTop: "var(--cam-space-5)" }}>
        <div>
          <dt>{t("timeRemainingLabel")}</dt>
          <dd>{daysLeft !== null ? t("daysRemaining", { days: daysLeft }) : NOT_PROVIDED}</dd>
        </div>
        <div>
          <dt>{t("targetedCompaniesLabel")}</dt>
          <dd>{target !== null ? t("targetedCompaniesValue", { count: count(target, locale) }) : NOT_PROVIDED}</dd>
        </div>
        <div>
          <dt>{t("collectionOfficersLabel")}</dt>
          <dd>{NOT_PROVIDED}</dd>
        </div>
      </dl>
    </section>
  );
}

function RegionalCoverage({ rows, isDivisional }: { rows: { name: string; count: number }[]; isDivisional?: boolean }) {
  const t = useTranslations("adminPilotagePage");
  const locale = useUiLocale();
  return (
    <section className="cam-dash-card" aria-labelledby="dash-regions-title">
      <div className="cam-dash-card-head">
        {/* "Voir toutes les régions →" pointed at /admin/centre-qualite,
            which has no all-regions view. This table already lists every
            region in the caller's scope, so the link had nowhere to go. */}
        <h3 id="dash-regions-title" className="cam-dash-card-title">{t("regionalCoverageTitle")}</h3>
      </div>
      <div className="cam-dash-table-wrap">
        <table className="cam-dash-table">
          <thead>
            <tr>
              <th scope="col">{t("regionColumn")}</th>
              <th scope="col" className="is-num">{t("submissionsColumn")}</th>
              <th scope="col" className="is-num">{t("completionColumn")}</th>
              <th scope="col" className="is-num">{t("qcColumn")}</th>
              <th scope="col" className="is-num">{t("anomaliesColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <p className="cam-dash-empty">{isDivisional ? t("regionalNotApplicable") : t("noRegionalData")}</p>
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.name}>
                  <th scope="row">{r.name}</th>
                  <td className="is-num">{count(r.count, locale)}</td>
                  {/* No per-region completion, QC or anomaly figure has a
                      source yet; the columns say so rather than estimate. */}
                  <td className="is-num cam-admin-muted">{NOT_PROVIDED}</td>
                  <td className="is-num cam-admin-muted">{NOT_PROVIDED}</td>
                  <td className="is-num cam-admin-muted">{NOT_PROVIDED}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
    <section className="cam-dash-card" id="activity" aria-labelledby="dash-activity-title">
      <div className="cam-dash-card-head">
        <h3 id="dash-activity-title" className="cam-dash-card-title">{t("recentActivityTitle")}</h3>
        {/* This feed is the latest submissions, so it continues in the dossier
            list. It used to point at the audit journal: different data, and
            AUDIT_ROLES-only, so a 403 for every territorial and ONEFOP admin. */}
        <Link href="/admin/dossiers" className="cam-dash-link">{t("viewAllFilesLink")}</Link>
      </div>
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
  const metrics = [
    { label: t("qualityCompleteness"), value: quality?.completenessRate ?? null },
    { label: t("qualityCoherence"), value: quality?.coherenceRate ?? null },
    { label: t("qualityAnomalies"), value: quality?.anomalyRate ?? null },
    { label: t("qualityWarnings"), value: quality?.warningRate ?? null },
    { label: t("qualityEligibility"), value: quality?.statisticalEligibilityRate ?? fallbackEligibilityPct },
  ];

  return (
    <section className="cam-dash-card" aria-labelledby="dash-quality-title">
      <div className="cam-dash-card-head">
        <h3 id="dash-quality-title" className="cam-dash-card-title">{t("dataQualityTitle")}</h3>
        <Link href="/admin/centre-qualite" className="cam-dash-link">{t("qualityCentreLink")}</Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="cam-dash-metric-row">
              <span>{m.label}</span>
              <strong>{percent(m.value, 0, locale)}</strong>
            </div>
            <div className="cam-dash-bar">
              <span style={{ width: meterWidth(m.value) }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function PilotagePage() {
  const t = useTranslations();
  const locale = useUiLocale();
  const { regions: CAMEROON_REGIONS } = useTerritoryRegions();
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role;
  const isRegional = userRole === "REGIONAL_ADMIN";
  const isDivisional = userRole === "DIVISIONAL_ADMIN";
  const isTerritorial = isRegional || isDivisional;
  const userRegion = user?.region?.trim().toLowerCase();

  // These figures move at administrative pace, not every 30s. Each poll of the
  // five queries below opens Prisma connections against Supabase's session-mode
  // pooler, whose ceiling this page was hitting (intermittent EMAXCONNSESSION
  // 500s on /admin/pilotage), so they refetch every 2 minutes.
  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues"],
    queryFn: getPilotageQueues,
    refetchInterval: 120000,
  });

  // GET /data-management/stats is territory-scoped server-side (territoryWhere).
  // Role-scoped absence is permanent, so the stage is hidden; scope-scoped absence (the registrations tile below) is temporary and shows "—". Do not unify.
  const canReadDataStats = hasRole(userRole, DATA_STATS_ROLES);
  const statsQuery = useQuery({
    queryKey: ["admin", "data-management", "stats"],
    queryFn: getDataManagementStats,
    refetchInterval: 120000,
    enabled: canReadDataStats,
  });

  const recentQuery = useQuery({
    queryKey: ["admin", "questionnaires", "recent", 8],
    queryFn: () => listAdminQuestionnaires({ limit: 8, offset: 0 }),
    refetchInterval: 120000,
  });

  const { activeCampaign } = useActiveCampaign();

  const qualityQuery = useQuery({
    queryKey: ["admin", "questionnaires", "quality", "summary", activeCampaign?.id],
    queryFn: () => getQualitySummary(activeCampaign?.id),
    refetchInterval: 120000,
  });

  // Registration queue head-count for the "Inscriptions en attente" tile —
  // the same hook as the sidebar and tab badges. Its gate excludes AUDITOR,
  // which reaches this page as the /admin fallback route: left ungated the
  // query would 403 on every poll. Gated off, the count stays null, so the
  // tile renders the honest absence.
  const { count: inscriptionsPending } = usePendingRegistrationsCount();

  // Authoritative data only. null until loaded or if query errors.
  const queues = queuesQuery.data ?? null;
  const stats = statsQuery.data ?? null;
  const quality = qualityQuery.data ?? null;

  // Zero is data: if queues returns 0 submissions, totalSubmissions is 0.
  // Never substitute national figures for an empty territorial result.
  const totalSubmissions = queues ? queues.totalSubmissionsCount : null;

  const eligibilityPct = queues ? rate(queues.statisticallyReadyCount, queues.totalSubmissionsCount) : null;

  const regionalData = useMemo(() => {
    if (!queues) return [];
    if (isRegional && userRegion) {
      const match = queues.regionCounts.find(
        (rc) => rc.region?.trim().toLowerCase() === userRegion
      );
      const matchedRegionName = CAMEROON_REGIONS.find((r) => r.toLowerCase() === userRegion) || user?.region || "";
      return [{
        name: matchedRegionName,
        count: match?.count ?? 0,
      }];
    }
    if (isDivisional) {
      return [];
    }
    return CAMEROON_REGIONS.map((regionName) => {
      const match = queues.regionCounts.find(
        (rc) => rc.region?.trim().toLowerCase() === regionName.toLowerCase()
      );
      return {
        name: regionName,
        count: match?.count ?? 0,
      };
    });
  }, [queues, isRegional, isDivisional, userRegion, user?.region, CAMEROON_REGIONS]);

  const statusApproved = queues ? queues.approvedCount : null;

  const recentActivity = recentQuery.data?.items ?? [];

  // Inscriptions: GET /data-management/stats is territory-scoped server-side.
  const totalInscriptions = stats
    ? (stats.totals?.companies ?? stats.totalCompanies ?? null)
    : null;

  const nationalCount = !isTerritorial && queues ? queues.pendingNationalVisasCount : null;
  const readyCount = queues ? queues.statisticallyReadyCount : null;

  // `highlighted` lives on each stage, so it travels with "Déclarations" when
  // the Inscriptions stage is dropped for a role that cannot read its source.
  const pipeline = [
    ...(canReadDataStats ? [{ label: t("adminPilotagePage.pipelineRegistrations"), value: totalInscriptions, highlighted: false }] : []),
    { label: t("adminPilotagePage.pipelineDeclarations"), value: totalSubmissions, highlighted: true },
    { label: t("adminPilotagePage.pipelineNational"), value: nationalCount, highlighted: false },
    { label: t("adminPilotagePage.pipelineApproved"), value: statusApproved, highlighted: false },
    { label: t("adminPilotagePage.pipelineExportable"), value: readyCount, highlighted: false },
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

      <section aria-labelledby="dash-todo-title">
        <SectionLabel id="dash-todo-title" tone="green">{t("adminPilotagePage.toProcessTitle")}</SectionLabel>

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
      </section>

      <section aria-labelledby="dash-pipeline-title">
        <SectionLabel id="dash-pipeline-title" tone="green">{t("adminPilotagePage.pipelineTitle")}</SectionLabel>
        <ol className="cam-dash-pipeline">
          {pipeline.map((stage) => (
            <li key={stage.label} className={stage.highlighted ? "is-highlighted" : undefined}>
              <span className="cam-dash-pipeline-value">{count(stage.value, locale)}</span>
              <span className="cam-dash-pipeline-label">{stage.label}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="cam-dash-columns">
        <div className="cam-dash-column">
          <CampaignCard
            campaign={activeCampaign}
            totalSubmissions={totalSubmissions}
            canOpenCampaigns={hasRole(userRole, CAMPAIGN_ROLES)}
            canOpenTargets={hasRole(userRole, APPROVAL_ROLES)}
          />
          <RegionalCoverage rows={regionalData} isDivisional={isDivisional} />
        </div>

        <div className="cam-dash-column">
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
    </div>
  );
}
