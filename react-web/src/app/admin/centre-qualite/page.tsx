"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { listAnomaliesRegistry } from "@/lib/api-client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";

// UI shell for the "Centre de Contrôle de Qualité" frame (qualite/centre.png).
// Only "Contrôles récents" has a data source today: the anomaly registry
// (GET /admin/questionnaires/anomalies/registry, territory-scoped server-side).
// Every other panel renders "—" with its reason; see
// docs/admin-replacement/ui-wiring-todo.md. No page-level role gate is added.

// Class-level @Roles on AdminQuestionnairesController.
const REGISTRY_ROLES = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "CENTRAL", "REGIONAL", "DIVISIONAL"];

interface AnomalyItem {
  id: string;
  ruleCode: string;
  description: string;
  status: "OPEN" | "RESOLVED" | "WAIVED";
  isBlocking: boolean;
  detectedAt: string;
  submission: { id: string; submissionId: string | null; region: string | null } | null;
}

const KPIS: { label: string; reason: string }[] = [
  { label: "Complétude", reason: "Définition du taux de complétude à arbitrer ; aucune mesure stockée." },
  { label: "Cohérence", reason: "Les contrôles de cohérence restent consultatifs et ne sont pas persistés." },
  { label: "Taux d'anomalies", reason: "Aucun agrégat d'anomalies par déclaration côté serveur." },
  { label: "Avertissements", reason: "Aucun agrégat d'avertissements côté serveur." },
  { label: "Éligibilité statistique", reason: "Le taux d'éligibilité n'est pas exposé par le moteur de diagnostic." },
];

function stamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const sameDay = d.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat("fr-FR", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short" }).format(d);
}

function dotColor(a: AnomalyItem) {
  if (a.status !== "OPEN") return "var(--cam-green)";
  return a.isBlocking ? "var(--cam-error)" : "var(--cam-warning)";
}

function statusText(a: AnomalyItem) {
  if (a.status === "RESOLVED") return "Anomalie résolue";
  if (a.status === "WAIVED") return "Anomalie levée";
  return a.isBlocking ? "Anomalie bloquante" : "Avertissement";
}

function Unavailable({ title, reason }: { title: string; reason: string }) {
  return (
    <section className="cam-dash-card" aria-label={title}>
      <div className="cam-dash-card-head">
        <h3 className="cam-dash-card-title">{title}</h3>
      </div>
      <p className="cam-dash-empty">— {reason}</p>
    </section>
  );
}

export default function CentreQualitePage() {
  const role = useAuthStore((s) => s.user?.role);
  const canReadRegistry = !!role && REGISTRY_ROLES.includes(role);

  const recentQuery = useQuery({
    queryKey: ["admin", "anomalies", "recent"],
    queryFn: () => listAnomaliesRegistry({ limit: 5 }),
    enabled: canReadRegistry,
  });
  const recent = (recentQuery.data?.items ?? []) as AnomalyItem[];

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Données" }, { label: "Qualité des données" }]}
        title="Centre de Contrôle de Qualité"
        actions={<AdminHeaderActions />}
      />

      <div className="cam-pilot-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }} aria-label="Indicateurs de qualité">
        {KPIS.map((k) => (
          <div key={k.label} className="cam-pilot-kpi" title={k.reason}>
            <div className="cam-pilot-kpi-top">
              <span className="cam-pilot-kpi-label" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{k.label}</span>
            </div>
            <div className="cam-pilot-kpi-value">—</div>
            <div className="cam-pilot-kpi-trend" style={{ color: "var(--cam-text-muted)" }}>{k.reason}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--cam-space-4)", alignItems: "flex-start" }}>
        <div style={{ flex: "3 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
          <Unavailable
            title="Anomalies par type"
            reason="Le registre des anomalies liste les cas un par un ; aucun agrégat par type de règle n'est exposé."
          />
          <Unavailable
            title="Anomalies par région"
            reason="Aucun agrégat par région, et les seuils de statut (critique, élevé, modéré…) ne sont pas définis."
          />
        </div>

        <div style={{ flex: "2 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
          <section className="cam-dash-card" aria-labelledby="qc-recent-title">
            <div className="cam-dash-card-head">
              <h3 id="qc-recent-title" className="cam-dash-card-title">Contrôles récents</h3>
              {canReadRegistry && <Link href="/admin/files-attente" className="cam-dash-link">Voir tout →</Link>}
            </div>
            {!canReadRegistry ? (
              <p className="cam-dash-empty">— Le registre des anomalies n&apos;est pas accessible à votre rôle.</p>
            ) : recentQuery.isLoading ? (
              <p className="cam-dash-empty">Chargement…</p>
            ) : recentQuery.isError ? (
              <div role="alert" className="cam-admin-notice cam-admin-notice--error">
                <span>Impossible de charger les anomalies : {(recentQuery.error as Error).message}</span>
              </div>
            ) : recent.length === 0 ? (
              <p className="cam-dash-empty">Aucune anomalie détectée.</p>
            ) : (
              <ol className="cam-dash-timeline">
                {recent.map((a) => (
                  <li key={a.id}>
                    <span className="cam-dash-timeline-time">{stamp(a.detectedAt)}</span>
                    <span className="cam-dash-timeline-dot" style={{ background: dotColor(a) }} aria-hidden="true" />
                    <span className="cam-dash-timeline-body">
                      {statusText(a)} : {a.description}
                      {a.submission && (
                        <>
                          {" — "}
                          <Link href={`/admin/dossiers/${a.submission.id}`}>{a.submission.submissionId ?? "dossier"}</Link>
                        </>
                      )}
                      {a.submission?.region && <span className="cam-dash-tag">{a.submission.region}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="cam-dash-card" aria-labelledby="qc-rules-title">
            <div className="cam-dash-card-head">
              <h3 id="qc-rules-title" className="cam-dash-card-title">Règles de validation</h3>
            </div>
            <p className="cam-dash-empty">
              — Aucun référentiel de règles consultable : l&apos;activation ou la désactivation d&apos;une règle modifierait
              la sémantique de validation et doit d&apos;abord être arbitrée.
            </p>
            <button type="button" className="cam-text-button" disabled title="Référentiel des règles non disponible." style={{ opacity: 0.55, cursor: "not-allowed" }}>
              Gérer les règles de validation →
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
