"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getPilotageQueues, listAdminQuestionnaires } from "@/lib/api-client";

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

function fmtDate(dateStr: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export default function PilotagePage() {
  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues"],
    queryFn: getPilotageQueues,
    refetchInterval: 30000,
  });

  const questionnairesQuery = useQuery({
    queryKey: ["admin", "questionnaires"],
    queryFn: () => listAdminQuestionnaires(),
    refetchInterval: 30000,
  });

  const queues = queuesQuery.data ?? {
    totalSubmissionsCount: 0,
    blockingAnomaliesCount: 0,
    pendingNationalVisasCount: 0,
    pendingRegionalVisasCount: 0,
    pendingDivisionalVisasCount: 0,
    correctionsUnderReviewCount: 0,
    statisticallyReadyCount: 0,
  };

  const submissions: any[] = questionnairesQuery.data ?? [];
  const totalSubmissions = queues.totalSubmissionsCount || submissions.length;
  const eligibilityPct = totalSubmissions > 0
    ? Math.round((queues.statisticallyReadyCount / totalSubmissions) * 100)
    : 0;

  // Regional data for bar chart
  const regionalData = CAMEROON_REGIONS.map((name) => {
    const count = submissions.filter(
      (s) => (s.region || s.rawData?.enterprise?.region || "").toLowerCase() === name.toLowerCase()
    ).length;
    return { name, count };
  }).sort((a, b) => b.count - a.count);

  const maxRegionalCount = Math.max(...regionalData.map((r) => r.count), 1);

  // Status breakdown for donut
  const statusCounts = {
    approved: submissions.filter((s) => s.adminStatus === "APPROVED" || s.status === "APPROVED").length,
    pending: submissions.filter((s) => s.adminStatus === "PENDING_REVIEW" || s.status === "PENDING_REVIEW").length,
    correction: submissions.filter((s) => s.adminStatus === "CORRECTION_REQUESTED" || s.status === "CORRECTION_REQUESTED").length,
    rejected: submissions.filter((s) => s.adminStatus === "REJECTED" || s.status === "REJECTED").length,
  };
  const totalStatusCount = Object.values(statusCounts).reduce((a, b) => a + b, 0) || 1;

  const donutSegments = [
    { label: "Validé", count: statusCounts.approved, pct: (statusCounts.approved / totalStatusCount) * 100, color: "#1e6b3a" },
    { label: "En attente", count: statusCounts.pending, pct: (statusCounts.pending / totalStatusCount) * 100, color: "#f0b429" },
    { label: "Correction", count: statusCounts.correction, pct: (statusCounts.correction / totalStatusCount) * 100, color: "#c25800" },
    { label: "Rejeté", count: statusCounts.rejected, pct: (statusCounts.rejected / totalStatusCount) * 100, color: "#b3202c" },
  ];

  // Conic gradient string for donut
  let cursor = 0;
  const conicParts = donutSegments.map((seg) => {
    const start = cursor;
    cursor += seg.pct;
    return `${seg.color} ${start.toFixed(1)}% ${cursor.toFixed(1)}%`;
  });
  const conicGradient = `conic-gradient(${conicParts.join(", ")})`;

  // Recent activity (last 10 submissions)
  const recentActivity = [...submissions]
    .sort((a, b) => new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime())
    .slice(0, 8);

  const kpiCards = [
    {
      label: "Total Soumissions",
      value: fmt(totalSubmissions),
      trend: queues.totalSubmissionsCount > 0 ? "Toutes périodes" : "Aucune donnée",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
      iconBg: "#e8f5ef",
      iconColor: "#1e6b3a",
    },
    {
      label: "Taux d'éligibilité",
      value: `${eligibilityPct} %`,
      trend: `${fmt(queues.statisticallyReadyCount)} éligibles`,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
      iconBg: "#e8f2ff",
      iconColor: "#1a5fb4",
    },
    {
      label: "Visas en instance",
      value: fmt(queues.pendingNationalVisasCount + queues.pendingRegionalVisasCount),
      trend: `${queues.pendingNationalVisasCount} nat. · ${queues.pendingRegionalVisasCount} rég.`,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      iconBg: "#fef9e7",
      iconColor: "#b8860b",
    },
    {
      label: "Anomalies bloquantes",
      value: fmt(queues.blockingAnomaliesCount),
      trend: queues.blockingAnomaliesCount === 0 ? "Aucune anomalie" : "À instruire",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      iconBg: queues.blockingAnomaliesCount > 0 ? "#fdecea" : "#e8f7f3",
      iconColor: queues.blockingAnomaliesCount > 0 ? "#b3202c" : "#007a5e",
    },
  ];

  return (
    <div className="cam-admin-page">
      {/* Quick-action bar */}
      <div className="cam-admin-actions" style={{ justifyContent: "flex-end" }}>
        <Link href="/admin/diffusion" className="cam-button cam-button-secondary cam-button-sm">
          Données et exports
        </Link>
        <Link href="/admin/files-attente" className="cam-button cam-button-primary cam-button-sm">
          Traiter les dossiers en instance
          {(queues.pendingNationalVisasCount + queues.blockingAnomaliesCount) > 0 && (
            <span className="cam-button-count">{queues.pendingNationalVisasCount + queues.blockingAnomaliesCount}</span>
          )}
        </Link>
      </div>

      {/* KPI cards row */}
      <div className="cam-pilot-kpis">
        {kpiCards.map((card) => (
          <div key={card.label} className="cam-pilot-kpi">
            <div className="cam-pilot-kpi-top">
              <span className="cam-pilot-kpi-label">{card.label}</span>
              <div className="cam-pilot-kpi-icon" style={{ background: card.iconBg, color: card.iconColor }}>
                {card.icon}
              </div>
            </div>
            <div className="cam-pilot-kpi-value">{card.value}</div>
            <div className="cam-pilot-kpi-trend">{card.trend}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="cam-pilot-charts">
        {/* Bar chart — regional distribution */}
        <div className="cam-pilot-panel">
          <div className="cam-pilot-panel-head">
            <h2 className="cam-admin-h2">Répartition territoriale</h2>
            <span className="cam-admin-meta">{fmt(totalSubmissions)} déclarations</span>
          </div>
          <div className="cam-pilot-panel-body">
            <ul className="cam-pilot-hbars" aria-label="Soumissions par région">
              {regionalData.map((r) => {
                const pct = maxRegionalCount > 0 ? (r.count / maxRegionalCount) * 100 : 0;
                return (
                  <li key={r.name} className="cam-pilot-hbar">
                    <span className="cam-pilot-hbar-label">{r.name}</span>
                    <div className="cam-pilot-hbar-track" aria-hidden="true">
                      <div className="cam-pilot-hbar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="cam-pilot-hbar-val">{r.count}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Donut chart — status distribution */}
        <div className="cam-pilot-panel">
          <div className="cam-pilot-panel-head">
            <h2 className="cam-admin-h2">Statut des fiches</h2>
            <span className="cam-admin-meta">{fmt(totalStatusCount)} fiches</span>
          </div>
          <div className="cam-pilot-panel-body cam-pilot-donut-wrap">
            <div
              className="cam-pilot-donut"
              style={{ background: conicGradient }}
              aria-label={`Répartition des statuts : ${donutSegments.map((s) => `${s.label} ${s.count}`).join(", ")}`}
            />
            <ul className="cam-pilot-donut-legend">
              {donutSegments.map((seg) => (
                <li key={seg.label} className="cam-pilot-donut-item">
                  <span className="cam-pilot-donut-dot" style={{ background: seg.color }} />
                  <span className="cam-pilot-donut-item-label">{seg.label}</span>
                  <span className="cam-pilot-donut-item-val">{seg.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Files de traitement + activité récente */}
      <div className="cam-pilot-bottom">
        {/* Queue summary */}
        <div className="cam-pilot-panel cam-pilot-panel--narrow">
          <div className="cam-pilot-panel-head">
            <h2 className="cam-admin-h2">Files de traitement</h2>
          </div>
          <ul className="cam-admin-queue">
            {[
              {
                href: "/admin/files-attente?tab=anomalies",
                count: queues.blockingAnomaliesCount,
                tone: "var(--cam-error)",
                title: "Anomalies bloquantes",
                hint: "Incohérences arithmétiques ouvertes",
              },
              {
                href: "/admin/files-attente?tab=visas",
                count: queues.pendingNationalVisasCount,
                tone: "var(--cam-info)",
                title: "Visas nationaux en attente",
                hint: "Transmis par les délégations",
              },
              {
                href: "/admin/files-attente?tab=corrections",
                count: queues.correctionsUnderReviewCount,
                tone: "var(--cam-warning)",
                title: "Corrections demandées",
                hint: "Renvoyées aux employeurs",
              },
              {
                href: "/admin/diffusion",
                count: queues.statisticallyReadyCount,
                tone: "var(--cam-success)",
                title: "Éligibles à la diffusion",
                hint: "Visés et sans anomalie",
              },
            ].map((q) => (
              <li key={q.href}>
                <Link href={q.href}>
                  <span className="cam-admin-queue-count" style={{ color: q.count > 0 ? q.tone : "var(--cam-text-muted)" }}>
                    {q.count}
                  </span>
                  <span>
                    <span className="cam-admin-queue-title" style={{ display: "block" }}>{q.title}</span>
                    <span className="cam-admin-meta">{q.hint}</span>
                  </span>
                  <span className="cam-admin-queue-arrow" aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Recent activity table */}
        <div className="cam-pilot-panel cam-pilot-panel--wide">
          <div className="cam-pilot-panel-head">
            <h2 className="cam-admin-h2">Activité récente</h2>
            <Link href="/admin/dossiers" className="cam-admin-meta" style={{ color: "var(--cam-green)", fontWeight: 600, textDecoration: "none" }}>
              Voir tous →
            </Link>
          </div>
          {recentActivity.length === 0 ? (
            <div className="cam-pilot-panel-body">
              <p className="cam-admin-meta" style={{ padding: "var(--cam-space-4) 0", textAlign: "center" }}>
                {questionnairesQuery.isLoading ? "Chargement…" : "Aucune déclaration enregistrée"}
              </p>
            </div>
          ) : (
            <div className="cam-pilot-table-wrap">
              <table className="cam-pilot-table">
                <thead>
                  <tr>
                    <th>Répondant</th>
                    <th>Type de fiche</th>
                    <th>Région</th>
                    <th>Statut</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((s: any) => {
                    const statusKey = s.adminStatus || s.status || "PENDING_REVIEW";
                    const meta = STATUS_META[statusKey] ?? STATUS_META.PENDING_REVIEW;
                    return (
                      <tr key={s.id}>
                        <td className="cam-pilot-td-name">
                          <Link href={`/admin/dossiers/${s.id}`}>
                            {s.companyName || s.rawData?.enterprise?.companyName || "—"}
                          </Link>
                        </td>
                        <td>{s.formType || s.questionnaire?.type || "—"}</td>
                        <td>{s.region || s.rawData?.enterprise?.region || "—"}</td>
                        <td>
                          <span className="cam-pilot-badge" style={{ color: meta.color, background: meta.bg }}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="cam-pilot-td-date">{fmtDate(s.submittedAt || s.createdAt || "")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
