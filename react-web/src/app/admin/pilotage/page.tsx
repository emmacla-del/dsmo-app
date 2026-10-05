"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";
import { getDataManagementStats, getPilotageQueues, listAdminQuestionnaires } from "@/lib/api-client";
import type { Campaign } from "@/lib/campaigns";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions, useActiveCampaign } from "@/components/admin/AdminHeaderActions";
import { KpiTile } from "@/components/admin/KpiTile";
import { DataState } from "@/components/admin/DataState";
import { count, rate, shortStamp, stamp, NOT_PROVIDED } from "@/lib/admin-data-state";
import { useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { getQualitySummary, type QualitySummary } from "@/lib/anomaly-registry";
import { resolveEntityName, type NamedSubmission } from "@/lib/onefop-entity-name";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED: { label: "Validé", color: "#007a5e", bg: "#e8f7f3" },
  PENDING_REVIEW: { label: "En attente", color: "#b8860b", bg: "#fef9e7" },
  CORRECTION_REQUESTED: { label: "Correction", color: "#c25800", bg: "#fff3e8" },
  REJECTED: { label: "Rejeté", color: "#b3202c", bg: "#fdecea" },
};

function fmt(n: number | null | undefined) {
  return count(n);
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

function CampaignCard({ campaign, totalSubmissions }: { campaign?: Campaign; totalSubmissions: number | null }) {
  const deadlineStr = campaign?.extendedDeadline || campaign?.deadline;
  const daysLeft = computeDaysLeft(deadlineStr);

  if (!campaign) {
    return (
      <section className="cam-dash-card" aria-labelledby="dash-campaign-title" style={{ padding: "20px 24px", background: "#ffffff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
        <div className="cam-dash-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="cam-dash-card-title-row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 id="dash-campaign-title" style={{ fontSize: 16, fontWeight: 700, color: "#374151", margin: 0 }}>
                Campagne de Collecte
              </h3>
              <span style={{ fontSize: 11, fontWeight: 600, background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: 9999 }}>
                Inactive
              </span>
            </div>
            <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
              Aucune campagne de collecte active actuellement.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <Link href="/admin/campagnes" style={{ fontSize: 13, fontWeight: 600, color: "#1e6b3a", textDecoration: "none" }}>
              Gérer les campagnes →
            </Link>
            <Link href="/admin/cibles" style={{ fontSize: 13, fontWeight: 600, color: "#1e6b3a", textDecoration: "none" }}>
              Cibles et couverture →
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const target = campaign.progress?.total ?? null;
  const submittedCount = campaign.progress?.submitted ?? totalSubmissions;
  const completionPct = target && target > 0 && submittedCount !== null
    ? Math.round((submittedCount / target) * 100)
    : null;

  const dateRange = campaign.startDate && deadlineStr
    ? `${stamp(campaign.startDate, false)} — ${stamp(deadlineStr, false)}`
    : campaign.startDate
      ? `Depuis le ${stamp(campaign.startDate, false)}`
      : NOT_PROVIDED;

  return (
    <section className="cam-dash-card" aria-labelledby="dash-campaign-title" style={{ padding: "20px 24px", background: "#ffffff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
      <div className="cam-dash-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div className="cam-dash-card-title-row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 id="dash-campaign-title" style={{ fontSize: 16, fontWeight: 700, color: "#1e6b3a", margin: 0 }}>
              {campaign.name || campaign.code}
            </h3>
            <span style={{ fontSize: 11, fontWeight: 600, background: "#ecfdf5", color: "#059669", padding: "2px 8px", borderRadius: 9999 }}>
              {campaign.status === "ACTIVE" ? "Actif" : campaign.status}
            </span>
          </div>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
            {dateRange}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <Link href="/admin/campagnes" style={{ fontSize: 13, fontWeight: 600, color: "#1e6b3a", textDecoration: "none" }}>
            Voir les détails de la campagne →
          </Link>
          <Link href="/admin/cibles" style={{ fontSize: 13, fontWeight: 600, color: "#1e6b3a", textDecoration: "none" }}>
            Cibles et couverture →
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Taux de couverture des entreprises ciblées</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1e6b3a" }}>
            {completionPct !== null ? `${completionPct}%` : NOT_PROVIDED}
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "#e5e7eb", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${completionPct ?? 0}%`, background: "#1e6b3a", borderRadius: 4 }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 20, paddingTop: 16, borderTop: "1px solid #f3f4f6" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b7280" }}>Temps restant</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginTop: 4 }}>
            {daysLeft !== null ? `${daysLeft} jours restants` : NOT_PROVIDED}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b7280" }}>Entreprises ciblées</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginTop: 4 }}>
            {target !== null ? `${fmt(target)} entreprises` : NOT_PROVIDED}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b7280" }}>Agents de collecte</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginTop: 4 }}>{NOT_PROVIDED}</div>
        </div>
      </div>
    </section>
  );
}

function RegionalCoverage({ rows, isDivisional }: { rows: { name: string; count: number }[]; isDivisional?: boolean }) {
  return (
    <section className="cam-dash-card" aria-labelledby="dash-regions-title" style={{ padding: "20px 24px", background: "#ffffff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
      <div className="cam-dash-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 id="dash-regions-title" style={{ fontSize: 16, fontWeight: 700, color: "#1e6b3a", margin: 0 }}>Couverture Régionale</h3>
        <Link href="/admin/centre-qualite" style={{ fontSize: 13, fontWeight: 600, color: "#1e6b3a", textDecoration: "none" }}>Voir toutes les régions →</Link>
      </div>
      <div className="cam-dash-table-wrap">
        <table className="cam-dash-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left", fontSize: 12, color: "#6b7280" }}>
              <th scope="col" style={{ padding: "8px 12px", fontWeight: 500 }}>Région</th>
              <th scope="col" className="is-num" style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500 }}>Soumissions</th>
              <th scope="col" style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500 }}>Complétion</th>
              <th scope="col" style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500 }}>Contrôle QC</th>
              <th scope="col" style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500 }}>Anomalies</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "16px 12px", textAlign: "center", color: "#6b7280", fontSize: 13 }}>
                  {isDivisional ? "Ressort départemental (couverture régionale non applicable)." : "Aucune donnée régionale disponible."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.name} style={{ borderBottom: "1px solid #f3f4f6", fontSize: 13 }}>
                  <th scope="row" style={{ padding: "10px 12px", fontWeight: 600, color: "#111827", textAlign: "left" }}>{r.name}</th>
                  <td className="is-num" style={{ padding: "10px 12px", textAlign: "right", color: "#111827" }}>{fmt(r.count)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "#6b7280" }}>{NOT_PROVIDED}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "#6b7280" }}>{NOT_PROVIDED}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "#6b7280" }}>{NOT_PROVIDED}</td>
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
  return (
    <section className="cam-dash-card" id="activity" aria-labelledby="dash-activity-title" style={{ padding: "20px 24px", background: "#ffffff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
      <div className="cam-dash-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 id="dash-activity-title" style={{ fontSize: 16, fontWeight: 700, color: "#1e6b3a", margin: 0 }}>Activité Récente</h3>
        <Link href="/admin/journal-audit" style={{ fontSize: 13, fontWeight: 600, color: "#1e6b3a", textDecoration: "none" }}>Voir tout le journal →</Link>
      </div>
      {isError ? (
        <div style={{ padding: "16px 0" }}>
          <DataState
            dense
            state="error"
            resource="l'activité récente"
            error={error}
            onRetry={onRetry}
          />
        </div>
      ) : isLoading ? (
        <div style={{ padding: "24px 0", textAlign: "center", color: "#6b7280", fontSize: 13 }}>
          Chargement de l&apos;activité...
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: "24px 0", textAlign: "center", color: "#6b7280", fontSize: 13 }}>
          Aucune activité récente enregistrée.
        </div>
      ) : (
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((s, idx) => {
            const statusKey = s.adminStatus || s.status;
            const meta = statusKey && STATUS_META[statusKey]
              ? STATUS_META[statusKey]
              : { label: statusKey || "En attente", color: "#6b7280", bg: "#f3f4f6" };
            const region = s.region || s.rawData?.enterprise?.region || null;
            const name = resolveEntityName(s) ?? (s.id ? `Fiche #${s.id.slice(0, 8)}` : NOT_PROVIDED);
            return (
              <li key={s.id || idx} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ color: "#6b7280", fontSize: 12, minWidth: 42, fontVariantNumeric: "tabular-nums" }}>
                  {shortStamp(s.submittedAt || s.createdAt)}
                </span>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, flexShrink: 0 }} aria-hidden="true" />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#111827" }}>
                  <strong>{name}</strong> — <span style={{ color: "#4b5563" }}>{meta.label}</span>
                </span>
                {region && (
                  <span style={{ fontSize: 11, background: "#f3f4f6", padding: "2px 8px", borderRadius: 4, color: "#4b5563", flexShrink: 0, fontWeight: 500 }}>
                    {region}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function DataQuality({ quality, fallbackEligibilityPct }: { quality: QualitySummary | null; fallbackEligibilityPct: number | null }) {
  const metrics = [
    { label: "Complétude", value: quality?.completenessRate ?? null },
    { label: "Cohérence", value: quality?.coherenceRate ?? null },
    { label: "Anomalies", value: quality?.anomalyRate ?? null },
    { label: "Avertissements", value: quality?.warningRate ?? null },
    { label: "Éligibilité statistique", value: quality?.statisticalEligibilityRate ?? fallbackEligibilityPct },
  ];

  return (
    <section className="cam-dash-card" aria-labelledby="dash-quality-title" style={{ padding: "20px 24px", background: "#ffffff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
      <div className="cam-dash-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 id="dash-quality-title" style={{ fontSize: 16, fontWeight: 700, color: "#1e6b3a", margin: 0 }}>Qualité des Données</h3>
        <Link href="/admin/centre-qualite" style={{ fontSize: 13, fontWeight: 600, color: "#1e6b3a", textDecoration: "none" }}>Voir le centre qualité →</Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {metrics.map((m) => (
          <div key={m.label}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: "#374151", fontWeight: 500 }}>{m.label}</span>
              <strong style={{ color: m.value !== null ? "#1e6b3a" : "#6b7280", fontWeight: 700 }}>
                {m.value !== null ? `${m.value}%` : NOT_PROVIDED}
              </strong>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "#f3f4f6", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${m.value ?? 0}%`, background: "#1e6b3a", borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function PilotagePage() {
  const { regions: CAMEROON_REGIONS } = useTerritoryRegions();
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role;
  const isRegional = userRole === "REGIONAL_ADMIN";
  const isDivisional = userRole === "DIVISIONAL_ADMIN";
  const isTerritorial = isRegional || isDivisional;
  const userRegion = user?.region?.trim().toLowerCase();

  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues"],
    queryFn: getPilotageQueues,
    refetchInterval: 30000,
  });

  // GET /data-management/stats is territory-scoped server-side (territoryWhere).
  const statsQuery = useQuery({
    queryKey: ["admin", "data-management", "stats"],
    queryFn: getDataManagementStats,
    refetchInterval: 30000,
  });

  const recentQuery = useQuery({
    queryKey: ["admin", "questionnaires", "recent", 8],
    queryFn: () => listAdminQuestionnaires({ limit: 8, offset: 0 }),
    refetchInterval: 30000,
  });

  const { activeCampaign } = useActiveCampaign();

  const qualityQuery = useQuery({
    queryKey: ["admin", "questionnaires", "quality", "summary", activeCampaign?.id],
    queryFn: () => getQualitySummary(activeCampaign?.id),
    refetchInterval: 30000,
  });

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

  const pipeline = [
    { label: "Inscriptions", value: totalInscriptions, highlighted: false },
    { label: "Déclarations", value: totalSubmissions, highlighted: true },
    { label: "Supervision nationale", value: nationalCount, highlighted: false },
    { label: "Approuvées", value: statusApproved, highlighted: false },
    { label: "Exportables", value: readyCount, highlighted: false },
  ];

  // 4 "À TRAITER" tiles: null renders "—" when no dedicated metric exists yet
  const inscriptionsPending = null;
  const declarationsReview = queues ? (queues.pendingNationalVisasCount ?? 0) : null;
  const correctionsCount = queues ? queues.correctionsUnderReviewCount : null;
  const anomaliesCount = queues ? queues.blockingAnomaliesCount : null;

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Supervision" }, { label: "Tableau de bord" }]}
        title="Observatoire National de l'Emploi"
        actions={<AdminHeaderActions />}
      />

      {queuesQuery.isError && (
        <div style={{ marginBottom: 20 }}>
          <DataState
            state="error"
            resource="les indicateurs de supervision"
            error={queuesQuery.error}
            onRetry={() => queuesQuery.refetch()}
          />
        </div>
      )}

      <section aria-labelledby="dash-todo-title" style={{ marginBottom: 28 }}>
        <SectionLabel id="dash-todo-title" tone="green">À TRAITER</SectionLabel>

        <div className="cam-dash-kpis">
          <KpiTile
            tone="warning"
            value={inscriptionsPending}
            label="Inscriptions en attente"
            href="/admin/inscriptions"
          />
          <KpiTile
            tone="info"
            value={declarationsReview}
            label="Déclarations à examiner"
            href="/admin/dossiers?status=PENDING_REVIEW"
          />
          <KpiTile
            tone="error"
            value={correctionsCount}
            label="Retours à corriger"
            href="/admin/dossiers?status=CORRECTION_REQUESTED"
          />
          <KpiTile
            tone="warning"
            value={anomaliesCount}
            label="Alertes qualité"
            href="/admin/centre-qualite"
          />
        </div>
      </section>

      <section aria-labelledby="dash-pipeline-title" style={{ marginBottom: 28 }}>
        <SectionLabel id="dash-pipeline-title" tone="green">PIPELINE DES DÉCLARATIONS</SectionLabel>
        <ol className="cam-dash-pipeline">
          {pipeline.map((stage) => (
            <li key={stage.label} className={stage.highlighted ? "is-highlighted" : undefined}>
              <span className="cam-dash-pipeline-value">{fmt(stage.value)}</span>
              <span className="cam-dash-pipeline-label">{stage.label}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="cam-dash-columns">
        <div className="cam-dash-column">
          <CampaignCard campaign={activeCampaign} totalSubmissions={totalSubmissions} />
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
