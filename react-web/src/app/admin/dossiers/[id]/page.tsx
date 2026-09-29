"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getDossierDiagnostic } from "@/lib/api-client";

function axis1Label(status: string) {
  if (status === "APPROVED") return "Visé";
  if (status === "PENDING_REVIEW") return "En instance";
  if (status === "REJECTED") return "Rejeté";
  if (status === "CORRECTION_REQUESTED") return "Correction demandée";
  return status;
}

function axis1Colors(status: string): { bg: string; color: string } {
  if (status === "APPROVED") return { bg: "rgba(30,107,58,0.1)", color: "#1e6b3a" };
  if (status === "REJECTED") return { bg: "rgba(220,38,38,0.08)", color: "#dc2626" };
  return { bg: "rgba(217,119,6,0.1)", color: "#d97706" };
}

function SubmissionDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const name = searchParams.get("name") ?? `Soumission ${id}`;
  const ref = searchParams.get("ref") ?? id;
  const date = searchParams.get("date") ?? "—";
  const region = searchParams.get("region") ?? "—";

  const diagnosticQuery = useQuery({
    queryKey: ["admin", "diagnostic", id],
    queryFn: () => getDossierDiagnostic(id),
  });

  const diag = diagnosticQuery.data;

  return (
    <div className="cam-admin-page">
      {/* Header toolbar */}
      <div className="cam-admin-page-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)" }}>
          <Link
            href="/admin/dossiers"
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "var(--cam-bg)", border: "1px solid var(--cam-border)",
              display: "grid", placeItems: "center", color: "var(--cam-text-muted)",
              textDecoration: "none", flexShrink: 0
            }}
            aria-label="Retour aux dossiers"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </Link>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", flexWrap: "wrap" }}>
              <strong style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: 700, color: "var(--cam-text)" }}>
                Soumission #{ref}
              </strong>
              {diag && (
                <span className="cam-pilot-badge" style={
                  diag.axis1Status === "APPROVED"
                    ? { background: "rgba(30,107,58,0.1)", color: "#1e6b3a" }
                    : diag.axis1Status === "REJECTED"
                      ? { background: "rgba(220,38,38,0.08)", color: "#dc2626" }
                      : { background: "rgba(217,119,6,0.1)", color: "#d97706" }
                }>
                  {axis1Label(diag.axis1Status)}
                </span>
              )}
            </div>
            <div className="cam-admin-meta">
              {name} · Soumis le {date} · {region}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--cam-space-2)" }}>
          <button type="button" className="cam-button cam-button-sm" style={{ background: "rgba(220,38,38,0.06)", borderColor: "rgba(220,38,38,0.3)", color: "#dc2626" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Rejeter la Fiche
          </button>
          <button type="button" className="cam-button cam-button-primary cam-button-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            Valider et Archiver
          </button>
        </div>
      </div>

      {/* Error state */}
      {diagnosticQuery.isError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>Impossible de charger le diagnostic de ce dossier.</span>
        </div>
      )}

      {/* 3-axis diagnostic panel */}
      {(diagnosticQuery.isLoading || diag) && (
        <div className="cam-admin-section" style={{ position: "relative", overflow: "hidden" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
            background: "var(--cam-green-dark)", borderRadius: "var(--cam-radius-lg) 0 0 var(--cam-radius-lg)"
          }} aria-hidden="true" />
          <div style={{ padding: "var(--cam-space-5)", paddingLeft: "calc(var(--cam-space-5) + 3px)", display: "flex", gap: "var(--cam-space-8)", flexWrap: "wrap" }}>
            {/* Axis 1 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-2)", minWidth: 180 }}>
              <div className="cam-admin-meta" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 11 }}>
                Axe 1 · Visa administratif
              </div>
              {diagnosticQuery.isLoading ? (
                <span className="cam-admin-meta">Chargement…</span>
              ) : diag ? (
                <span className="cam-pilot-badge" style={axis1Colors(diag.axis1Status)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {axis1Label(diag.axis1Status).toUpperCase()}
                </span>
              ) : null}
            </div>
            {/* Axis 2 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-2)", minWidth: 180 }}>
              <div className="cam-admin-meta" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 11 }}>
                Axe 2 · Qualité des données
              </div>
              {diagnosticQuery.isLoading ? (
                <span className="cam-admin-meta">Chargement…</span>
              ) : diag ? (
                <span className="cam-pilot-badge" style={
                  diag.axis2BlockingCount > 0
                    ? { background: "rgba(220,38,38,0.08)", color: "#dc2626" }
                    : { background: "rgba(30,107,58,0.1)", color: "#1e6b3a" }
                }>
                  {diag.axis2BlockingCount > 0
                    ? `⚑ ${diag.axis2BlockingCount} Anomalie${diag.axis2BlockingCount > 1 ? "s" : ""}`
                    : diag.axis2WarningCount > 0
                      ? `⚑ ${diag.axis2WarningCount} Avertissement${diag.axis2WarningCount > 1 ? "s" : ""}`
                      : "✓ Conforme"}
                </span>
              ) : null}
            </div>
            {/* Axis 3 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-2)", minWidth: 180 }}>
              <div className="cam-admin-meta" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 11 }}>
                Axe 3 · Éligibilité statistique
              </div>
              {diagnosticQuery.isLoading ? (
                <span className="cam-admin-meta">Chargement…</span>
              ) : diag ? (
                <span className="cam-pilot-badge" style={
                  diag.axis3Eligibility === "READY"
                    ? { background: "rgba(30,107,58,0.1)", color: "#1e6b3a" }
                    : { background: "rgba(217,119,6,0.1)", color: "#d97706" }
                }>
                  {diag.axis3Eligibility === "READY" ? "Éligible à la diffusion" : "En attente d'arbitrage"}
                </span>
              ) : null}
              {diag?.exclusionReason && (
                <div className="cam-admin-meta">{diag.exclusionReason}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Anomalies */}
      {diag && diag.blockingAnomalies.length > 0 && (
        <section className="cam-admin-section" aria-labelledby="blocking-title">
          <div className="cam-admin-section-head">
            <h2 className="cam-admin-h2" id="blocking-title">
              Anomalies bloquantes ({diag.blockingAnomalies.length})
            </h2>
          </div>
          <div className="cam-admin-section-body">
            <ul className="cam-admin-issues">
              {diag.blockingAnomalies.map((ano, idx) => (
                <li key={ano.id || idx}>
                  <span className="cam-admin-issue-code">{ano.ruleCode}</span> · {ano.description}
                  <div className="cam-admin-meta" style={{ marginTop: 2 }}>
                    Observé {ano.observedValue} · attendu {ano.expectedValue}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {diag && diag.warningAnomalies.length > 0 && (
        <section className="cam-admin-section" aria-labelledby="warning-title">
          <div className="cam-admin-section-head">
            <h2 className="cam-admin-h2" id="warning-title">
              Alertes de cohérence ({diag.warningAnomalies.length})
            </h2>
          </div>
          <div className="cam-admin-section-body">
            <ul className="cam-admin-issues is-warn">
              {diag.warningAnomalies.map((ano, idx) => (
                <li key={ano.id || idx}>
                  <span className="cam-admin-issue-code">{ano.ruleCode}</span> · {ano.description}
                  <div className="cam-admin-meta" style={{ marginTop: 2 }}>
                    Observé {ano.observedValue} · attendu {ano.expectedValue}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {diag && diag.blockingAnomalies.length === 0 && diag.warningAnomalies.length === 0 && (
        <div className="cam-admin-notice cam-admin-notice--success" role="status" style={{ display: "flex" }}>
          <span>Aucune anomalie détectée. Le dossier est conforme aux règles de cohérence.</span>
        </div>
      )}
    </div>
  );
}

export default function SubmissionDetailPage() {
  return (
    <Suspense fallback={null}>
      <SubmissionDetailContent />
    </Suspense>
  );
}
