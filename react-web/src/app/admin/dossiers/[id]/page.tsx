"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDossierDiagnostic, approveDossier, rejectDossier, requestCorrectionDossier } from "@/lib/api-client";
import { AdminDialog } from "@/components/admin/AdminDialog";

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

// apiFetch throws ApiError carrying the HTTP status. The backend answers 404
// both for unknown ids and for dossiers outside the agent's territory.
// Checked by shape, not instanceof ApiError, which failed on the live build.
function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status: unknown }).status === 404
  );
}

function SubmissionDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const name = searchParams.get("name") ?? `Soumission ${id}`;
  const ref = searchParams.get("ref") ?? id;
  const date = searchParams.get("date") ?? "—";
  const region = searchParams.get("region") ?? "—";

  const queryClient = useQueryClient();

  const diagnosticQuery = useQuery({
    queryKey: ["admin", "diagnostic", id],
    queryFn: () => getDossierDiagnostic(id),
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 3,
  });

  // ── Reject dialog state ───────────────────────────────────────────────────
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [certifiedReject, setCertifiedReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSuccess, setRejectSuccess] = useState(false);

  const rejectMutation = useMutation({
    mutationFn: () => rejectDossier(id, rejectReason.trim(), certifiedReject),
    onSuccess: () => {
      setRejectSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["admin", "diagnostic", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] });
    },
  });

  const openRejectDialog = () => {
    setRejectSuccess(false);
    rejectMutation.reset();
    setCertifiedReject(false);
    setRejectReason("");
    setIsRejectOpen(true);
  };

  // ── Approve dialog state ──────────────────────────────────────────────────
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState(false);

  const approveMutation = useMutation({
    mutationFn: () => approveDossier(id),
    onSuccess: () => {
      setApproveSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["admin", "diagnostic", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] });
    },
  });

  const openApproveDialog = () => {
    setApproveSuccess(false);
    approveMutation.reset();
    setIsApproveOpen(true);
  };

  // ── Correction dialog state ───────────────────────────────────────────────
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [correctionComments, setCorrectionComments] = useState("");
  const [correctionCertified, setCorrectionCertified] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState(false);

  const correctionMutation = useMutation({
    mutationFn: () => requestCorrectionDossier(id, correctionComments.trim(), correctionCertified),
    onSuccess: () => {
      setCorrectionSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["admin", "diagnostic", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] });
    },
  });

  const openCorrectionDialog = () => {
    setCorrectionSuccess(false);
    correctionMutation.reset();
    setCorrectionComments("");
    setCorrectionCertified(false);
    setIsCorrectionOpen(true);
  };

  // ── Button disable logic ──────────────────────────────────────────────────
  const diag = diagnosticQuery.data;

  const canReject =
    !!diag &&
    (diag.axis1Status === "PENDING_REVIEW" || diag.axis1Status === "CORRECTION_REQUESTED");

  const canRequestCorrection =
    !!diag &&
    diag.axis1Status === "PENDING_REVIEW";

  const canApprove =
    !!diag &&
    diag.axis1Status === "PENDING_REVIEW" &&
    diag.axis2BlockingCount === 0;

  function rejectDisabledReason(): string | undefined {
    if (!diag) return "Chargement du diagnostic en cours…";
    if (diag.axis1Status === "APPROVED") return "Dossier déjà visé";
    if (diag.axis1Status === "REJECTED") return "Dossier déjà rejeté";
    if (diag.axis1Status === "CORRECTION_REQUESTED") return "Correction déjà demandée — attendez la resoumission ou rejetez";
    return undefined;
  }

  function correctionDisabledReason(): string | undefined {
    if (!diag) return "Chargement du diagnostic en cours…";
    if (diag.axis1Status === "APPROVED") return "Dossier déjà visé";
    if (diag.axis1Status === "REJECTED") return "Dossier rejeté — ne peut plus être corrigé";
    if (diag.axis1Status === "CORRECTION_REQUESTED") return "Correction déjà demandée — attendez la resoumission";
    return undefined;
  }

  function approveDisabledReason(): string | undefined {
    if (!diag) return "Chargement du diagnostic en cours…";
    if (diag.axis1Status === "APPROVED") return "Dossier déjà visé";
    if (diag.axis1Status === "REJECTED") return "Dossier rejeté — rouvrir d'abord";
    if (diag.axis1Status === "CORRECTION_REQUESTED") return "Correction en cours — attendez la resoumission";
    if (diag.axis2BlockingCount > 0) return `${diag.axis2BlockingCount} anomalie${diag.axis2BlockingCount > 1 ? "s" : ""} bloquante${diag.axis2BlockingCount > 1 ? "s" : ""} non résolue${diag.axis2BlockingCount > 1 ? "s" : ""}`;
    return undefined;
  }

  if (diagnosticQuery.isError && isNotFound(diagnosticQuery.error)) {
    return (
      <div className="cam-admin-page">
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <div>
            <strong style={{ display: "block", color: "var(--cam-text)" }}>Dossier introuvable</strong>
            <span>Ce dossier n&apos;existe pas ou vous n&apos;avez pas accès à cette région.</span>
          </div>
          <Link href="/admin/dossiers" className="cam-button cam-button-sm">
            ← Retour aux dossiers
          </Link>
        </div>
      </div>
    );
  }

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
          <button
            type="button"
            className="cam-button cam-button-sm"
            style={{ background: "rgba(220,38,38,0.06)", borderColor: "rgba(220,38,38,0.3)", color: "#dc2626" }}
            disabled={!canReject}
            title={rejectDisabledReason()}
            onClick={openRejectDialog}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Rejeter la Fiche
          </button>
          <button
            type="button"
            className="cam-button cam-button-sm"
            disabled={!canRequestCorrection}
            title={correctionDisabledReason()}
            onClick={openCorrectionDialog}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Demander une correction
          </button>
          <button
            type="button"
            className="cam-button cam-button-primary cam-button-sm"
            disabled={!canApprove}
            title={approveDisabledReason()}
            onClick={openApproveDialog}
          >
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

      {/* ── Reject dialog ─────────────────────────────────────────────────── */}
      <AdminDialog
        open={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        title="Rejeter la fiche"
        eyebrow="Action irréversible"
        footer={
          rejectSuccess ? (
            <button type="button" className="cam-button cam-button-sm" onClick={() => setIsRejectOpen(false)}>
              Fermer
            </button>
          ) : (
            <>
              <button type="button" className="cam-button cam-button-sm" onClick={() => setIsRejectOpen(false)} disabled={rejectMutation.isPending}>
                Annuler
              </button>
              <button
                type="button"
                className="cam-button cam-button-sm"
                style={{ background: "rgba(220,38,38,0.06)", borderColor: "rgba(220,38,38,0.3)", color: "#dc2626" }}
                disabled={rejectMutation.isPending || rejectReason.trim().length < 10 || !certifiedReject}
                onClick={() => rejectMutation.mutate()}
              >
                {rejectMutation.isPending ? "Rejet en cours…" : "Confirmer le rejet"}
              </button>
            </>
          )
        }
      >
        {rejectSuccess ? (
          <div className="cam-admin-notice cam-admin-notice--success" role="status">
            <span>La fiche a été rejetée. Le diagnostic a été actualisé.</span>
          </div>
        ) : (
          <>
            <p style={{ margin: "0 0 var(--cam-space-4)", color: "var(--cam-text-muted)", fontSize: "var(--cam-font-size-sm)" }}>
              Dossier #{ref} — {name}
            </p>
            <label htmlFor="reject-reason" style={{ display: "block", fontWeight: 600, marginBottom: "var(--cam-space-2)", color: "var(--cam-text)", fontSize: "var(--cam-font-size-sm)" }}>
              Motif de rejet <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <textarea
              id="reject-reason"
              rows={4}
              className="cam-input"
              style={{ width: "100%", resize: "vertical", minHeight: 96, boxSizing: "border-box" }}
              placeholder="Précisez le motif du rejet (10 caractères minimum)…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              disabled={rejectMutation.isPending}
            />
            {rejectReason.trim().length > 0 && rejectReason.trim().length < 10 && (
              <p style={{ margin: "var(--cam-space-1) 0 0", color: "#dc2626", fontSize: "var(--cam-font-size-xs)" }}>
                Le motif doit faire au moins 10 caractères ({rejectReason.trim().length}/10).
              </p>
            )}
            <label style={{ display: "flex", alignItems: "flex-start", gap: "var(--cam-space-2)", marginTop: "var(--cam-space-4)", cursor: "pointer", fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text)" }}>
              <input
                type="checkbox"
                checked={certifiedReject}
                onChange={(e) => setCertifiedReject(e.target.checked)}
                disabled={rejectMutation.isPending}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              Je certifie que cette décision de rejet est fondée et sera notifiée au déclarant.
            </label>
            {rejectMutation.isError && (
              <div className="cam-admin-notice cam-admin-notice--error" role="alert" style={{ marginTop: "var(--cam-space-3)" }}>
                <span>{(rejectMutation.error as Error)?.message ?? "Erreur lors du rejet."}</span>
              </div>
            )}
          </>
        )}
      </AdminDialog>

      {/* ── Correction dialog ────────────────────────────────────────────── */}
      <AdminDialog
        open={isCorrectionOpen}
        onClose={() => setIsCorrectionOpen(false)}
        title="Demander une correction"
        eyebrow="Renvoi au déclarant"
        footer={
          correctionSuccess ? (
            <button type="button" className="cam-button cam-button-sm" onClick={() => setIsCorrectionOpen(false)}>
              Fermer
            </button>
          ) : (
            <>
              <button type="button" className="cam-button cam-button-sm" onClick={() => setIsCorrectionOpen(false)} disabled={correctionMutation.isPending}>
                Annuler
              </button>
              <button
                type="button"
                className="cam-button cam-button-sm"
                style={{ borderColor: "rgba(180,83,9,0.4)", color: "#b45309" }}
                disabled={correctionMutation.isPending || correctionComments.trim().length < 10 || !correctionCertified}
                onClick={() => correctionMutation.mutate()}
              >
                {correctionMutation.isPending ? "Envoi en cours…" : "Envoyer la demande"}
              </button>
            </>
          )
        }
      >
        {correctionSuccess ? (
          <div className="cam-admin-notice cam-admin-notice--success" role="status">
            <span>La demande de correction a été transmise. Le déclarant verra le motif dans son espace.</span>
          </div>
        ) : (
          <>
            <p style={{ margin: "0 0 var(--cam-space-4)", color: "var(--cam-text-muted)", fontSize: "var(--cam-font-size-sm)" }}>
              Dossier #{ref} — {name}
            </p>
            <label htmlFor="correction-comments" style={{ display: "block", fontWeight: 600, marginBottom: "var(--cam-space-2)", color: "var(--cam-text)", fontSize: "var(--cam-font-size-sm)" }}>
              Commentaires pour le déclarant <span style={{ color: "#b45309" }}>*</span>
            </label>
            <textarea
              id="correction-comments"
              rows={4}
              className="cam-input"
              style={{ width: "100%", resize: "vertical", minHeight: 96, boxSizing: "border-box" }}
              placeholder="Décrivez les corrections attendues (10 caractères minimum)…"
              value={correctionComments}
              onChange={(e) => setCorrectionComments(e.target.value)}
              disabled={correctionMutation.isPending}
            />
            {correctionComments.trim().length > 0 && correctionComments.trim().length < 10 && (
              <p style={{ margin: "var(--cam-space-1) 0 0", color: "#b45309", fontSize: "var(--cam-font-size-xs)" }}>
                Le commentaire doit faire au moins 10 caractères ({correctionComments.trim().length}/10).
              </p>
            )}
            <label style={{ display: "flex", alignItems: "flex-start", gap: "var(--cam-space-2)", marginTop: "var(--cam-space-4)", cursor: "pointer", fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text)" }}>
              <input
                type="checkbox"
                checked={correctionCertified}
                onChange={(e) => setCorrectionCertified(e.target.checked)}
                disabled={correctionMutation.isPending}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <span>
                Je certifie sur l&rsquo;honneur avoir examiné ce dossier et confirme la demande de correction.
              </span>
            </label>
            {correctionMutation.isError && (
              <div className="cam-admin-notice cam-admin-notice--error" role="alert" style={{ marginTop: "var(--cam-space-3)" }}>
                <span>{(correctionMutation.error as Error)?.message ?? "Erreur lors de la demande de correction."}</span>
              </div>
            )}
          </>
        )}
      </AdminDialog>

      {/* ── Approve dialog ────────────────────────────────────────────────── */}
      <AdminDialog
        open={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        title="Valider et archiver"
        eyebrow="Confirmation requise"
        footer={
          approveSuccess ? (
            <button type="button" className="cam-button cam-button-sm" onClick={() => setIsApproveOpen(false)}>
              Fermer
            </button>
          ) : (
            <>
              <button type="button" className="cam-button cam-button-sm" onClick={() => setIsApproveOpen(false)} disabled={approveMutation.isPending}>
                Annuler
              </button>
              <button
                type="button"
                className="cam-button cam-button-primary cam-button-sm"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
              >
                {approveMutation.isPending ? "Validation en cours…" : "Valider et archiver"}
              </button>
            </>
          )
        }
      >
        {approveSuccess ? (
          <div className="cam-admin-notice cam-admin-notice--success" role="status">
            <span>Le dossier a été visé et archivé. Le diagnostic a été actualisé.</span>
          </div>
        ) : (
          <>
            <p style={{ margin: "0 0 var(--cam-space-3)", color: "var(--cam-text-muted)", fontSize: "var(--cam-font-size-sm)" }}>
              Dossier #{ref} — {name}
            </p>
            <p style={{ margin: "0 0 var(--cam-space-3)", color: "var(--cam-text)", fontSize: "var(--cam-font-size-sm)" }}>
              Cette action vise officiellement le dossier et le marque comme <strong>APPROUVÉ</strong>. Elle est irréversible et génère un enregistrement d&apos;audit.
            </p>
            <p style={{ margin: 0, color: "var(--cam-text-muted)", fontSize: "var(--cam-font-size-sm)" }}>
              Confirmez-vous la validation de ce dossier ?
            </p>
            {approveMutation.isError && (
              <div className="cam-admin-notice cam-admin-notice--error" role="alert" style={{ marginTop: "var(--cam-space-3)" }}>
                <span>{(approveMutation.error as Error)?.message ?? "Erreur lors de la validation."}</span>
              </div>
            )}
          </>
        )}
      </AdminDialog>
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
