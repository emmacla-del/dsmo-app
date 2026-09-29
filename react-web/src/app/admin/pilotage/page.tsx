"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getPilotageQueues, listAdminQuestionnaires } from "@/lib/api-client";
import type { Campaign } from "@/lib/campaigns";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPageHeader";
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

// ── Sections ────────────────────────────────────────────────────────────────

function SectionLabel({ id, tone, children }: { id: string; tone: "gold" | "green"; children: string }) {
  return (
    <h2 id={id} className={`cam-dash-section-label cam-dash-section-label--${tone}`}>
      {children}
    </h2>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  // TODO(backend, M): missing campaign target, national completion %, and active agent count for the Figma progress bar and stats row
  // Captured once per mount: render must stay pure (react-hooks/purity).
  const [now] = useState(() => Date.now());
  const end = campaign.extendedDeadline || campaign.deadline;
  const daysLeft = end ? Math.max(0, Math.ceil((new Date(end).getTime() - now) / 86_400_000)) : null;

  return (
    <section className="cam-dash-card" aria-labelledby="dash-campaign-title">
      <div className="cam-dash-card-head">
        <div>
          <div className="cam-dash-card-title-row">
            <h3 id="dash-campaign-title" className="cam-dash-card-title">{campaign.name}</h3>
            <AdminStatusBadge label="Actif" variant="active" />
          </div>
          <p className="cam-dash-card-sub">
            {fmtDate(campaign.startDate)} — {fmtDate(end)}
          </p>
        </div>
        <Link href="/admin/campagnes" className="cam-dash-link">Voir les détails de la campagne →</Link>
      </div>
      {daysLeft !== null && (
        <dl className="cam-dash-stats">
          <div>
            <dt>Temps restant</dt>
            <dd>{daysLeft} {daysLeft === 1 ? "jour restant" : "jours restants"}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function RegionalCoverage({ rows }: { rows: { name: string; count: number }[] }) {
  // TODO(backend, M): missing per-region completion, QC and anomaly rates for the Couverture Régionale columns
  return (
    <section className="cam-dash-card" aria-labelledby="dash-regions-title">
      <div className="cam-dash-card-head">
        <h3 id="dash-regions-title" className="cam-dash-card-title">Couverture Régionale</h3>
      </div>
      <div className="cam-dash-table-wrap">
        <table className="cam-dash-table">
          <thead>
            <tr>
              <th scope="col">Région</th>
              <th scope="col" className="is-num">Soumissions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <th scope="row">{r.name}</th>
                <td className="is-num">{fmt(r.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RecentActivity({ items, isLoading }: { items: any[]; isLoading: boolean }) {
  // TODO(backend, M): no audit-log endpoint; timeline is derived from the latest submissions, and "Voir tout le journal" needs /admin/journal-audit
  return (
    <section className="cam-dash-card" aria-labelledby="dash-activity-title">
      <div className="cam-dash-card-head">
        <h3 id="dash-activity-title" className="cam-dash-card-title">Activité Récente</h3>
        <Link href="/admin/dossiers" className="cam-dash-link">Voir tous les dossiers →</Link>
      </div>
      {items.length === 0 ? (
        <p className="cam-dash-empty">{isLoading ? "Chargement…" : "Aucune déclaration enregistrée"}</p>
      ) : (
        <ol className="cam-dash-timeline">
          {items.map((s) => {
            const meta = STATUS_META[s.adminStatus || s.status || "PENDING_REVIEW"] ?? STATUS_META.PENDING_REVIEW;
            const region = s.region || s.rawData?.enterprise?.region;
            return (
              <li key={s.id}>
                <span className="cam-dash-timeline-time">{fmtStamp(s.submittedAt || s.createdAt || "")}</span>
                <span className="cam-dash-timeline-dot" style={{ background: meta.color }} aria-hidden="true" />
                <span className="cam-dash-timeline-body">
                  <Link href={`/admin/dossiers/${s.id}`}>
                    {s.companyName || s.rawData?.enterprise?.companyName || "—"}
                  </Link>
                  {" — "}{meta.label}
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

function DataQuality({ eligibilityPct, hasData }: { eligibilityPct: number; hasData: boolean }) {
  // TODO(backend, L): remaining quality metrics (Complétude, Cohérence, Anomalies, Avertissements rates) and the /admin/qualite centre link
  return (
    <section className="cam-dash-card" aria-labelledby="dash-quality-title">
      <div className="cam-dash-card-head">
        <h3 id="dash-quality-title" className="cam-dash-card-title">Qualité des Données</h3>
      </div>
      <div className="cam-dash-metric">
        <div className="cam-dash-metric-row">
          <span>Éligibilité statistique</span>
          <strong>{hasData ? `${eligibilityPct} %` : "—"}</strong>
        </div>
        <div className="cam-dash-bar" aria-hidden="true">
          <span style={{ width: `${hasData ? eligibilityPct : 0}%` }} />
        </div>
      </div>
    </section>
  );
}

function StatusDonut({ segments, total }: { segments: { label: string; count: number; pct: number; color: string }[]; total: number }) {
  // TODO(design, S): status donut is not in the Figma dashboard — kept because it is the only status breakdown; verify placement with designer
  const conicParts = segments.map((seg, i) => {
    const start = segments.slice(0, i).reduce((sum, s) => sum + s.pct, 0);
    return `${seg.color} ${start.toFixed(1)}% ${(start + seg.pct).toFixed(1)}%`;
  });

  return (
    <section className="cam-dash-card" aria-labelledby="dash-status-title">
      <div className="cam-dash-card-head">
        <h3 id="dash-status-title" className="cam-dash-card-title">Statut des fiches</h3>
        <span className="cam-dash-card-sub">{fmt(total)} fiches</span>
      </div>
      <div className="cam-pilot-donut-wrap">
        <div
          className="cam-pilot-donut"
          style={{ background: `conic-gradient(${conicParts.join(", ")})` }}
          role="img"
          aria-label={`Répartition des statuts : ${segments.map((s) => `${s.label} ${s.count}`).join(", ")}`}
        />
        <ul className="cam-pilot-donut-legend">
          {segments.map((seg) => (
            <li key={seg.label} className="cam-pilot-donut-item">
              <span className="cam-pilot-donut-dot" style={{ background: seg.color }} />
              <span className="cam-pilot-donut-item-label">{seg.label}</span>
              <span className="cam-pilot-donut-item-val">{seg.count}</span>
            </li>
          ))}
        </ul>
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

  // Timeline only: the 8 most recent submissions. Every dashboard figure comes
  // from getPilotageQueues, computed server-side over the whole territory.
  const recentQuery = useQuery({
    queryKey: ["admin", "questionnaires", "recent", 8],
    queryFn: () => listAdminQuestionnaires({ limit: 8, offset: 0 }),
    refetchInterval: 30000,
  });

  const { canReadCampaigns, activeCampaign, isLoading: campaignLoading } = useActiveCampaign();

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

  const totalSubmissions = queues.totalSubmissionsCount;
  const eligibilityPct = totalSubmissions > 0
    ? Math.round((queues.statisticallyReadyCount / totalSubmissions) * 100)
    : 0;

  const regionalData = CAMEROON_REGIONS.map((name) => {
    const count = queues.regionCounts
      .filter((r) => (r.region ?? "").trim().toLowerCase() === name.toLowerCase())
      .reduce((sum, r) => sum + r.count, 0);
    return { name, count };
  }).sort((a, b) => b.count - a.count);

  const statusCounts = {
    approved: queues.approvedCount,
    pending: queues.statusCounts.PENDING_REVIEW,
    correction: queues.statusCounts.CORRECTION_REQUESTED,
    rejected: queues.statusCounts.REJECTED,
  };
  const totalStatusCount = Object.values(statusCounts).reduce((a, b) => a + b, 0) || 1;

  const donutSegments = [
    { label: "Validé", count: statusCounts.approved, pct: (statusCounts.approved / totalStatusCount) * 100, color: "var(--cam-success)" },
    { label: "En attente", count: statusCounts.pending, pct: (statusCounts.pending / totalStatusCount) * 100, color: "var(--cam-flag-yellow)" },
    { label: "Correction", count: statusCounts.correction, pct: (statusCounts.correction / totalStatusCount) * 100, color: "var(--cam-warning)" },
    { label: "Rejeté", count: statusCounts.rejected, pct: (statusCounts.rejected / totalStatusCount) * 100, color: "var(--cam-error)" },
  ];

  const recentActivity = recentQuery.data?.items ?? [];

  // TODO(backend, S): missing inscriptions count (Figma pipeline starts with an "Inscriptions" stage)
  // TODO(design, S): Figma highlights "Déclarations" and "Contrôle régional" stages — confirm what the highlight means before styling it
  const pipeline = [
    { label: "Déclarations", value: totalSubmissions },
    { label: "Contrôle régional", value: queues.pendingRegionalVisasCount },
    { label: "Contrôle national", value: queues.pendingNationalVisasCount },
    { label: "Approuvées", value: statusCounts.approved },
    { label: "Exportables", value: queues.statisticallyReadyCount },
  ];

  // TODO(backend, S): missing /admin/inscriptions/count for the "Inscriptions en attente" tile
  const inscriptionsPending: number | null = null;

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Supervision" }, { label: "Tableau de bord" }]}
        title="Tableau de bord"
        subtitle="Supervision des collectes et indicateurs de performance"
        actions={<AdminHeaderActions />}
      />

      <section aria-labelledby="dash-todo-title">
        <SectionLabel id="dash-todo-title" tone="gold">À traiter</SectionLabel>
        <div className="cam-dash-kpis">
          <KpiTile tone="warning" value={inscriptionsPending} label="Inscriptions en attente" />
          <KpiTile
            tone="info"
            value={queues.pendingNationalVisasCount + queues.pendingRegionalVisasCount}
            label="Déclarations à examiner"
            href="/admin/files-attente?tab=visas"
          />
          <KpiTile
            tone="error"
            value={queues.correctionsUnderReviewCount}
            label="Retours à corriger"
            href="/admin/files-attente?tab=corrections"
          />
          <KpiTile
            tone="warning"
            value={queues.blockingAnomaliesCount}
            label="Alertes qualité"
            href="/admin/files-attente?tab=anomalies"
          />
        </div>
      </section>

      <section aria-labelledby="dash-pipeline-title">
        <SectionLabel id="dash-pipeline-title" tone="green">Pipeline des déclarations</SectionLabel>
        <ol className="cam-dash-pipeline">
          {pipeline.map((stage) => (
            <li key={stage.label}>
              <span className="cam-dash-pipeline-value">{fmt(stage.value)}</span>
              <span className="cam-dash-pipeline-label">{stage.label}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="cam-dash-columns">
        <div className="cam-dash-column">
          {canReadCampaigns && (
            activeCampaign
              ? <CampaignCard campaign={activeCampaign} />
              : (
                <section className="cam-dash-card" aria-label="Campagne de collecte">
                  <p className="cam-dash-empty">
                    {campaignLoading ? "Chargement…" : "Aucune campagne de collecte active."}{" "}
                    {!campaignLoading && <Link href="/admin/campagnes" className="cam-dash-link">Gérer les campagnes →</Link>}
                  </p>
                </section>
              )
          )}
          <RegionalCoverage rows={regionalData} />
        </div>

        <div className="cam-dash-column">
          <RecentActivity items={recentActivity} isLoading={recentQuery.isLoading} />
          <DataQuality eligibilityPct={eligibilityPct} hasData={totalSubmissions > 0} />
          <StatusDonut segments={donutSegments} total={totalStatusCount} />
        </div>
      </div>
    </div>
  );
}
