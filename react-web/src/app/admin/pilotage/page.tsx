"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getDataManagementStats, getPilotageQueues, listAdminQuestionnaires } from "@/lib/api-client";
import type { Campaign } from "@/lib/campaigns";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions, useActiveCampaign } from "@/components/admin/AdminHeaderActions";
import { KpiTile } from "@/components/admin/KpiTile";

const CAMEROON_REGIONS = [
  "Centre",
  "Littoral",
  "Ouest",
  "Nord-Ouest",
  "Sud-Ouest",
  "Extrême-Nord",
  "Nord",
  "Adamaoua",
  "Est",
  "Sud",
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED: { label: "Validé", color: "#007a5e", bg: "#e8f7f3" },
  PENDING_REVIEW: { label: "En attente", color: "#b8860b", bg: "#fef9e7" },
  CORRECTION_REQUESTED: { label: "Correction", color: "#c25800", bg: "#fff3e8" },
  REJECTED: { label: "Rejeté", color: "#b3202c", bg: "#fdecea" },
};

function fmt(n: number) {
  return n.toLocaleString("fr-FR");
}

function fmtDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

// Timeline stamp: time of day for today's events, short date otherwise.
function fmtStamp(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat("fr-FR", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short" }).format(d);
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

function CampaignCard({ campaign, totalSubmissions }: { campaign?: Campaign; totalSubmissions: number }) {
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
  const completionPct = target && target > 0
    ? Math.round((submittedCount / target) * 100)
    : null;

  const dateRange = campaign.startDate && deadlineStr
    ? `${fmtDate(campaign.startDate)} — ${fmtDate(deadlineStr)}`
    : campaign.startDate
      ? `Depuis le ${fmtDate(campaign.startDate)}`
      : "—";

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
            {completionPct !== null ? `${completionPct}%` : "—"}
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
            {daysLeft !== null ? `${daysLeft} jours restants` : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b7280" }}>Entreprises ciblées</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginTop: 4 }}>
            {target !== null ? `${fmt(target)} entreprises` : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b7280" }}>Agents de collecte</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginTop: 4 }}>—</div>
        </div>
      </div>
    </section>
  );
}

function RegionalCoverage({ rows }: { rows: { name: string; count: number }[] }) {
  return (
    <section className="cam-dash-card" aria-labelledby="dash-regions-title" style={{ padding: "20px 24px", background: "#ffffff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
      <div className="cam-dash-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 id="dash-regions-title" style={{ fontSize: 16, fontWeight: 700, color: "#1e6b3a", margin: 0 }}>Couverture Régionale</h3>
        <Link href="/admin/centre-qualite?tab=regional" style={{ fontSize: 13, fontWeight: 600, color: "#1e6b3a", textDecoration: "none" }}>Voir toutes les régions →</Link>
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
            {rows.map((r) => (
              <tr key={r.name} style={{ borderBottom: "1px solid #f3f4f6", fontSize: 13 }}>
                <th scope="row" style={{ padding: "10px 12px", fontWeight: 600, color: "#111827", textAlign: "left" }}>{r.name}</th>
                <td className="is-num" style={{ padding: "10px 12px", textAlign: "right", color: "#111827" }}>{fmt(r.count)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "#6b7280" }}>—</td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "#6b7280" }}>—</td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "#6b7280" }}>—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface ActivitySubmissionItem {
  id?: string;
  adminStatus?: string;
  status?: string;
  region?: string;
  companyName?: string;
  submittedAt?: string;
  createdAt?: string;
  rawData?: { enterprise?: { region?: string; companyName?: string } };
}

function RecentActivity({ items, isLoading }: { items: ActivitySubmissionItem[]; isLoading: boolean }) {
  return (
    <section className="cam-dash-card" id="activity" aria-labelledby="dash-activity-title" style={{ padding: "20px 24px", background: "#ffffff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
      <div className="cam-dash-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 id="dash-activity-title" style={{ fontSize: 16, fontWeight: 700, color: "#1e6b3a", margin: 0 }}>Activité Récente</h3>
        <Link href="/admin/journal-audit" style={{ fontSize: 13, fontWeight: 600, color: "#1e6b3a", textDecoration: "none" }}>Voir tout le journal →</Link>
      </div>
      {isLoading ? (
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
            const meta = STATUS_META[s.adminStatus || s.status || "PENDING_REVIEW"] ?? STATUS_META.PENDING_REVIEW;
            const region = s.region || s.rawData?.enterprise?.region || null;
            const name = s.companyName || s.rawData?.enterprise?.companyName || `Fiche #${s.id?.slice(0, 8)}`;
            return (
              <li key={s.id || idx} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ color: "#6b7280", fontSize: 12, minWidth: 42, fontVariantNumeric: "tabular-nums" }}>
                  {fmtStamp(s.submittedAt || s.createdAt || new Date().toISOString())}
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

function DataQuality({ eligibilityPct }: { eligibilityPct: number | null }) {
  const metrics = [
    { label: "Complétude", value: null },
    { label: "Cohérence", value: null },
    { label: "Anomalies", value: null },
    { label: "Avertissements", value: null },
    { label: "Éligibilité statistique", value: eligibilityPct },
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
                {m.value !== null ? `${m.value}%` : "—"}
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
  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues"],
    queryFn: getPilotageQueues,
    refetchInterval: 30000,
  });

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

  const queues = queuesQuery.data ?? {
    totalSubmissionsCount: 0,
    blockingAnomaliesCount: 0,
    pendingNationalVisasCount: 0,
    pendingRegionalVisasCount: 0,
    pendingDivisionalVisasCount: 0,
    correctionsUnderReviewCount: 0,
    statisticallyReadyCount: 0,
    statusCounts: { PENDING_REVIEW: 0, APPROVED: 0, CORRECTION_REQUESTED: 0, REJECTED: 0 },
    approvedCount: 0,
    regionCounts: [],
  };

  const stats = statsQuery.data;

  const totalSubmissions = queues.totalSubmissionsCount > 0
    ? queues.totalSubmissionsCount
    : (stats ? (stats.totalOnefopSubmissions ?? 0) + (stats.totalDeclarations ?? 0) : 0);

  const eligibilityPct = queues.totalSubmissionsCount > 0
    ? Math.round((queues.statisticallyReadyCount / queues.totalSubmissionsCount) * 100)
    : null;

  const regionalData = CAMEROON_REGIONS.map((regionName) => {
    const match = queues.regionCounts.find(
      (rc) => rc.region?.trim().toLowerCase() === regionName.toLowerCase()
    );
    return {
      name: regionName,
      count: match?.count ?? 0,
    };
  });

  const statusCounts = {
    approved: queues.approvedCount ?? 0,
    pending: queues.statusCounts?.PENDING_REVIEW ?? 0,
    correction: queues.statusCounts?.CORRECTION_REQUESTED ?? 0,
    rejected: queues.statusCounts?.REJECTED ?? 0,
  };

  const recentActivity = recentQuery.data?.items ?? [];

  // 6-stage pipeline: real values from DB stats & queues
  const totalInscriptions = stats?.totalCompanies ?? 0;
  const regionalCount = queues.pendingRegionalVisasCount ?? 0;
  const nationalCount = queues.pendingNationalVisasCount ?? 0;
  const readyCount = queues.statisticallyReadyCount ?? 0;

  const pipeline = [
    { label: "Inscriptions", value: totalInscriptions, highlighted: false },
    { label: "Déclarations", value: totalSubmissions, highlighted: true },
    { label: "Contrôle régional", value: regionalCount, highlighted: true },
    { label: "Contrôle national", value: nationalCount, highlighted: false },
    { label: "Approuvées", value: statusCounts.approved, highlighted: false },
    { label: "Exportables", value: readyCount, highlighted: false },
  ];

  // 4 "À TRAITER" tiles: null renders "—" when no dedicated metric exists yet
  const inscriptionsPending = null;
  const declarationsReview = queuesQuery.data ? queues.pendingNationalVisasCount + queues.pendingRegionalVisasCount : null;
  const correctionsCount = queuesQuery.data ? queues.correctionsUnderReviewCount : null;
  const anomaliesCount = queuesQuery.data ? queues.blockingAnomaliesCount : null;

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Supervision" }, { label: "Tableau de bord" }]}
        title="Observatoire National de l'Emploi"
        actions={<AdminHeaderActions />}
        hideTabs={true}
      />

      <section aria-labelledby="dash-todo-title" style={{ marginBottom: 28 }}>
        <SectionLabel id="dash-todo-title" tone="green">À TRAITER</SectionLabel>

        {/* 3 In-Page Sub-navigation Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Link
            href="/admin/pilotage"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 16px",
              borderRadius: 6,
              background: "#1e6b3a",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              boxShadow: "0 1px 3px rgba(30, 107, 58, 0.2)",
            }}
          >
            Tableau de bord
          </Link>
          <Link
            href="/admin/dossiers"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 16px",
              borderRadius: 6,
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              color: "#374151",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
            }}
          >
            Dossiers en instance
          </Link>
          <Link
            href="/admin/activite"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 16px",
              borderRadius: 6,
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              color: "#374151",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
            }}
          >
            Activité & alertes
          </Link>
        </div>

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
          <RegionalCoverage rows={regionalData} />
        </div>

        <div className="cam-dash-column">
          <RecentActivity items={recentActivity} isLoading={recentQuery.isLoading} />
          <DataQuality eligibilityPct={eligibilityPct} />
        </div>
      </div>
    </div>
  );
}
