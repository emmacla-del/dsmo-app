"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminDossier,
  getDossierDiagnostic,
  approveDossier,
  rejectDossier,
  requestCorrectionDossier,
  type AdminDossier,
} from "@/lib/api-client";
import { entityTypeLabel } from "@/lib/companies-directory";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type BadgeVariant = "pending" | "validated" | "rejected" | "correction";

const STATUS_META: Record<string, { label: string; variant: BadgeVariant; pill: "ok" | "warn" | "error" }> = {
  PENDING_REVIEW: { label: "En instance", variant: "pending", pill: "warn" },
  APPROVED: { label: "Visé", variant: "validated", pill: "ok" },
  REJECTED: { label: "Rejeté", variant: "rejected", pill: "error" },
  CORRECTION_REQUESTED: { label: "Correction demandée", variant: "correction", pill: "warn" },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, variant: "pending" as const, pill: "warn" as const };
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

function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

type Detail = Record<string, unknown>;

interface Anomaly {
  id?: string;
  ruleCode: string;
  description: string;
  observedValue: unknown;
  expectedValue: unknown;
}

function text(v: unknown): string | null {
  return v === null || v === undefined || v === "" ? null : String(v);
}

function entityDetail(d: AdminDossier): Detail {
  return (
    d.enterpriseDetail ??
    d.cooperativeDetail ??
    d.ctdDetail ??
    d.ongDetail ??
    d.administrationDetail ??
    d.projectProgramDetail ??
    d.vocationalTrainingDetail ??
    {}
  );
}

function entityName(detail: Detail): string | null {
  return text(detail.companyName ?? detail.cooperativeName ?? detail.ongName ?? detail.name ?? detail.ctdType);
}

type Field = { label: string; value: ReactNode };

// A field whose key is absent from the entity detail is not part of that
// questionnaire and is skipped; a present-but-empty one was left unanswered.
function detailField(detail: Detail, key: string, label: string): Field | null {
  if (!(key in detail)) return null;
  return { label, value: text(detail[key]) };
}

function FieldList({ fields, twoColumns }: { fields: (Field | null)[]; twoColumns?: boolean }) {
  return (
    <dl className={`cam-dossier-fields${twoColumns ? " cam-dossier-fields--two" : ""}`}>
      {fields.filter((f): f is Field => f !== null).map((f) => (
        <div key={f.label}>
          <dt>{f.label}</dt>
          <dd>{f.value ?? <span className="cam-admin-meta">Non renseigné</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

function AnomalyList({ title, id, items, warn }: { title: string; id: string; items: Anomaly[]; warn?: boolean }) {
  return (
    <section className="cam-dash-card" aria-labelledby={id}>
      <h2 id={id} className="cam-dossier-card-title">{title} ({items.length})</h2>
      <ul className={`cam-admin-issues${warn ? " is-warn" : ""}`} style={{ marginTop: "var(--cam-space-4)" }}>
        {items.map((ano, idx) => (
          <li key={ano.id || idx}>
            <span className="cam-admin-issue-code">{ano.ruleCode}</span> · {ano.description}
            <div className="cam-admin-meta" style={{ marginTop: 2 }}>
              Observé {text(ano.observedValue) ?? "—"} · attendu {text(ano.expectedValue) ?? "—"}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InstructionHistory({ dossier }: { dossier: AdminDossier }) {
  const reviewed = fmtDate(dossier.reviewedAt, true);
  const decision: { title: string; text: string | null; date: string | null; dot: string } = (() => {
    switch (dossier.status) {
      case "APPROVED":
        return { title: "Fiche visée", text: "Visa administratif accordé", date: reviewed, dot: "" };
      case "REJECTED":
        return { title: "Fiche rejetée", text: dossier.rejectionReason ? `Motif : ${dossier.rejectionReason}` : null, date: reviewed, dot: " is-rejected" };
      case "CORRECTION_REQUESTED":
        return { title: "Retournée pour correction", text: dossier.rejectionReason ? `Motif : ${dossier.rejectionReason}` : null, date: reviewed, dot: " is-current" };
      default:
        return { title: "Actuellement en cours de revue", text: "En attente d'une décision de visa", date: null, dot: " is-current" };
    }
  })();

  return (
    <section className="cam-dash-card" aria-labelledby="dossier-history-title">
      <h2 id="dossier-history-title" className="cam-dossier-card-title">Historique d&apos;instruction de la fiche</h2>
      <ol className="cam-dossier-history">
        <li>
          <span className="cam-dossier-history-dot" aria-hidden="true" />
          <div>
            <strong>Fiche soumise pour validation</strong>
            <p>Reçue par le serveur central de l&apos;Observatoire</p>
            {fmtDate(dossier.submissionDate, true) && <time dateTime={dossier.submissionDate}>{fmtDate(dossier.submissionDate, true)}</time>}
          </div>
        </li>
        <li>
          <span className={`cam-dossier-history-dot${decision.dot}`} aria-hidden="true" />
          <div>
            <strong>{decision.title}</strong>
            {decision.text && <p>{decision.text}</p>}
            {decision.date && dossier.reviewedAt && <time dateTime={dossier.reviewedAt}>{decision.date}</time>}
          </div>
        </li>
      </ol>
    </section>
  );
}

function SubmissionDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const queryClient = useQueryClient();

  const dossierQuery = useQuery({
    queryKey: ["admin", "dossier", id],
    queryFn: () => getAdminDossier(id),
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 3,
  });

  const diagnosticQuery = useQuery({
    queryKey: ["admin", "diagnostic", id],
    queryFn: () => getDossierDiagnostic(id),
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 3,
  });

  const dossier = dossierQuery.data;
  const detail = dossier ? entityDetail(dossier) : {};
  // Query-string values from the list are a placeholder until the dossier loads.
  const name = (dossier && entityName(detail)) ?? searchParams.get("name") ?? `Soumission ${id}`;
  const ref = dossier?.submissionId ?? searchParams.get("ref") ?? id;
  const date = fmtDate(dossier?.submissionDate) ?? searchParams.get("date") ?? "—";
  const region = dossier?.region ?? searchParams.get("region") ?? "—";

  const invalidateDossier = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "diagnostic", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "dossier", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] });
  };

  // ── Reject dialog state ───────────────────────────────────────────────────
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [certifiedReject, setCertifiedReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSuccess, setRejectSuccess] = useState(false);

  const rejectMutation = useMutation({
    mutationFn: () => rejectDossier(id, rejectReason.trim(), certifiedReject),
    onSuccess: () => {
      setRejectSuccess(true);
      invalidateDossier();
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
      invalidateDossier();
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
      invalidateDossier();
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

  if (
    (diagnosticQuery.isError && isNotFound(diagnosticQuery.error)) ||
    (dossierQuery.isError && isNotFound(dossierQuery.error))
  ) {
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

  const headerStatus = diag?.axis1Status ?? dossier?.status;
  const axis1 = diag ? statusMeta(diag.axis1Status) : null;
  const axesTone = diag?.axis1Status === "APPROVED" ? " is-approved" : diag?.axis1Status === "REJECTED" ? " is-rejected" : "";
  const respondent = dossier?.respondent;

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[
          { label: "Contrôle qualité" },
          { label: "Visas & décisions", href: "/admin/dossiers" },
          { label: "Détail du dossier" },
        ]}
        backHref="/admin/dossiers"
        title={`Soumission #${ref}`}
        statusBadge={headerStatus ? { label: statusMeta(headerStatus).label, variant: statusMeta(headerStatus).variant } : undefined}
        subtitle={`Soumis le ${date} — ${name}${region !== "—" ? ` (Région ${region})` : ""}`}
        actions={
          <>
            <button
              type="button"
              className="cam-button cam-button-danger cam-button-sm"
              disabled={!canReject}
              title={rejectDisabledReason()}
              onClick={openRejectDialog}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Rejeter la Fiche
            </button>
            <button
              type="button"
              className="cam-button cam-button-secondary cam-button-sm"
              disabled={!canRequestCorrection}
              title={correctionDisabledReason()}
              onClick={openCorrectionDialog}
            >
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
          </>
        }
      />

      {(diagnosticQuery.isError || dossierQuery.isError) && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>
            {diagnosticQuery.isError
              ? "Impossible de charger le diagnostic de ce dossier."
              : "Impossible de charger le contenu de ce dossier."}
          </span>
        </div>
      )}

      {/* 3-axis diagnostic strip */}
      {(diagnosticQuery.isLoading || diag) && (
        <section className={`cam-dossier-axes${axesTone}`} aria-label="Diagnostic du dossier">
          <div className="cam-dossier-axis">
            <p className="cam-dossier-label">Axe 1 · Visa administratif</p>
            {axis1 ? (
              <span className={`cam-dossier-pill cam-dossier-pill--${axis1.pill}`}>{axis1.label.toUpperCase()}</span>
            ) : (
              <span className="cam-admin-meta">Chargement…</span>
            )}
          </div>
          <div className="cam-dossier-axis">
            <p className="cam-dossier-label">Axe 2 · Qualité des données</p>
            {diag ? (
              <span className={`cam-dossier-pill cam-dossier-pill--${diag.axis2BlockingCount > 0 ? "error" : diag.axis2WarningCount > 0 ? "warn" : "ok"}`}>
                {diag.axis2BlockingCount > 0
                  ? `⚑ ${diag.axis2BlockingCount} Anomalie${diag.axis2BlockingCount > 1 ? "s" : ""}`
                  : diag.axis2WarningCount > 0
                    ? `⚑ ${diag.axis2WarningCount} Avertissement${diag.axis2WarningCount > 1 ? "s" : ""}`
                    : "✓ Conforme"}
              </span>
            ) : (
              <span className="cam-admin-meta">Chargement…</span>
            )}
          </div>
          <div className="cam-dossier-axis">
            <p className="cam-dossier-label">Axe 3 · Éligibilité statistique</p>
            {diag ? (
              <span className={`cam-dossier-pill cam-dossier-pill--${diag.axis3Eligibility === "READY" ? "ok" : "warn"}`}>
                {diag.axis3Eligibility === "READY" ? "Éligible à la diffusion" : "En attente d'arbitrage"}
              </span>
            ) : (
              <span className="cam-admin-meta">Chargement…</span>
            )}
            {diag?.exclusionReason && <p className="cam-dossier-note">{diag.exclusionReason}</p>}
          </div>
        </section>
      )}

      <div className="cam-dossier-grid">
        {/* Left column: respondent and structure */}
        <div className="cam-dash-column">
          <section className="cam-dash-card" aria-labelledby="dossier-respondent-title">
            <h2 id="dossier-respondent-title" className="cam-dossier-card-title">Informations sur le Répondant</h2>
            {dossierQuery.isLoading ? (
              <p className="cam-dash-empty" style={{ marginTop: "var(--cam-space-4)" }}>Chargement…</p>
            ) : respondent ? (
              <FieldList
                fields={[
                  { label: "Nom complet", value: respondent.respondentName || null },
                  { label: "Fonction / poste", value: respondent.respondentFunction || null },
                  { label: "Téléphone", value: [respondent.phone1, respondent.phone2].filter(Boolean).join(" · ") || null },
                  { label: "Adresse email", value: respondent.email || null },
                ]}
              />
            ) : (
              <p className="cam-dash-empty" style={{ marginTop: "var(--cam-space-4)" }}>Aucun répondant enregistré.</p>
            )}
          </section>

          <section className="cam-dash-card" aria-labelledby="dossier-structure-title">
            <h2 id="dossier-structure-title" className="cam-dossier-card-title">Informations de la Structure</h2>
            {dossierQuery.isLoading ? (
              <p className="cam-dash-empty" style={{ marginTop: "var(--cam-space-4)" }}>Chargement…</p>
            ) : dossier ? (
              <FieldList
                fields={[
                  { label: "Raison sociale", value: entityName(detail) },
                  { label: "Type de questionnaire", value: entityTypeLabel(dossier.formType) },
                  detailField(detail, "headOffice", "Siège social"),
                  detailField(detail, "sector", "Secteur d'activité"),
                  detailField(detail, "branch", "Branche"),
                  detailField(detail, "mainActivity", "Activité principale"),
                  detailField(detail, "mainMission", "Mission principale"),
                  detailField(detail, "enterpriseSize", "Taille de l'entreprise"),
                  detailField(detail, "permanentWorkers", "Employés permanents"),
                ]}
              />
            ) : null}
          </section>
        </div>

        {/* Right column: questionnaire content and anomalies */}
        <div className="cam-dash-column">
          <details className="cam-dossier-section" open>
            <summary>Section 1 : Identification de l&apos;Établissement</summary>
            <div className="cam-dossier-section-body">
              {dossierQuery.isLoading ? (
                <p className="cam-dash-empty" style={{ marginTop: "var(--cam-space-4)" }}>Chargement…</p>
              ) : dossier ? (
                <FieldList
                  twoColumns
                  fields={[
                    { label: "Numéro de contribuable", value: dossier.taxNumber },
                    { label: "Numéro de registre du commerce (RCCM)", value: dossier.registrationNumber },
                    { label: "Numéro CNPS", value: dossier.cnpsNumber },
                    detailField(detail, "legalStatus", "Statut juridique"),
                    { label: "Région d'implantation", value: text(detail.region ?? dossier.region) },
                    { label: "Département", value: text(detail.department ?? dossier.department) },
                    { label: "Arrondissement", value: text(detail.subdivision ?? detail.commune ?? dossier.subdivision) },
                    detailField(detail, "locality", "Ville / localité"),
                    detailField(detail, "poBox", "Boîte postale"),
                    detailField(detail, "phone1", "Téléphone de la structure"),
                    detailField(detail, "yearCreated", "Année de création"),
                    detailField(detail, "yearOfEstablishment", "Année de création"),
                    { label: "Période de collecte", value: dossier.quarterCode },
                  ]}
                />
              ) : null}
            </div>
          </details>
          {/* TODO(frontend, L): read-only rendering of Sections 2–4 (employment, departures, training tables) — see docs/deferred.md */}
          <p className="cam-dossier-note">
            Les sections 2 à 4 (effectifs, départs, formation) ne sont pas encore consultables dans la console web.
          </p>

          {diag && diag.blockingAnomalies.length > 0 && (
            <AnomalyList title="Anomalies bloquantes" id="blocking-title" items={diag.blockingAnomalies} />
          )}
          {diag && diag.warningAnomalies.length > 0 && (
            <AnomalyList title="Alertes de cohérence" id="warning-title" items={diag.warningAnomalies} warn />
          )}
          {diag && diag.blockingAnomalies.length === 0 && diag.warningAnomalies.length === 0 && (
            <div className="cam-admin-notice cam-admin-notice--success" role="status" style={{ display: "flex" }}>
              <span>Aucune anomalie détectée. Le dossier est conforme aux règles de cohérence.</span>
            </div>
          )}
        </div>
      </div>

      {dossier && <InstructionHistory dossier={dossier} />}

      {/* ── Reject dialog ─────────────────────────────────────────────────── */}
      <AdminDialog
        open={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        title="Rejeter la fiche"
        eyebrow="Action irréversible"
        footer={
          rejectSuccess ? (
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setIsRejectOpen(false)}>
              Fermer
            </button>
          ) : (
            <>
              <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setIsRejectOpen(false)} disabled={rejectMutation.isPending}>
                Annuler
              </button>
              <button
                type="button"
                className="cam-button cam-button-danger cam-button-sm"
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
            <p className="cam-admin-meta" style={{ margin: "0 0 var(--cam-space-4)" }}>
              Déclaration #{ref} — {name}
            </p>
            <label htmlFor="reject-reason" className="cam-admin-label">
              Motif de rejet <span style={{ color: "var(--cam-error)" }}>*</span>
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
              <p style={{ margin: "var(--cam-space-1) 0 0", color: "var(--cam-error)", fontSize: "var(--cam-font-size-xs)" }}>
                Le motif doit faire au moins 10 caractères ({rejectReason.trim().length}/10).
              </p>
            )}
            <label className="cam-admin-choice" style={{ marginTop: "var(--cam-space-4)" }}>
              <input
                type="checkbox"
                checked={certifiedReject}
                onChange={(e) => setCertifiedReject(e.target.checked)}
                disabled={rejectMutation.isPending}
              />
              <span>Je certifie que cette décision de rejet est fondée et sera notifiée au déclarant.</span>
            </label>
            <p className="cam-dossier-note" style={{ marginTop: "var(--cam-space-4)" }}>
              Cette action génère une entrée d&apos;audit AUDIT_REJECT.
            </p>
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
        title="Retour pour correction"
        eyebrow="Renvoi au déclarant"
        footer={
          correctionSuccess ? (
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setIsCorrectionOpen(false)}>
              Fermer
            </button>
          ) : (
            <>
              <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setIsCorrectionOpen(false)} disabled={correctionMutation.isPending}>
                Annuler
              </button>
              <button
                type="button"
                className="cam-button cam-button-primary cam-button-sm"
                disabled={correctionMutation.isPending || correctionComments.trim().length < 10 || !correctionCertified}
                onClick={() => correctionMutation.mutate()}
              >
                {correctionMutation.isPending ? "Envoi en cours…" : "Confirmer le retour"}
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
            <p className="cam-admin-meta" style={{ margin: "0 0 var(--cam-space-4)" }}>
              Déclaration #{ref} — {name}
            </p>
            <label htmlFor="correction-comments" className="cam-admin-label">
              Action demandée au déclarant <span style={{ color: "var(--cam-warning)" }}>*</span>
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
              <p style={{ margin: "var(--cam-space-1) 0 0", color: "var(--cam-warning)", fontSize: "var(--cam-font-size-xs)" }}>
                Le commentaire doit faire au moins 10 caractères ({correctionComments.trim().length}/10).
              </p>
            )}
            <label className="cam-admin-choice" style={{ marginTop: "var(--cam-space-4)" }}>
              <input
                type="checkbox"
                checked={correctionCertified}
                onChange={(e) => setCorrectionCertified(e.target.checked)}
                disabled={correctionMutation.isPending}
              />
              <span>Je certifie sur l&rsquo;honneur avoir examiné ce dossier et confirme la demande de correction.</span>
            </label>
            <p className="cam-dossier-note" style={{ marginTop: "var(--cam-space-4)" }}>
              Cette action génère une entrée d&apos;audit AUDIT_CORRECTION.
            </p>
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
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setIsApproveOpen(false)}>
              Fermer
            </button>
          ) : (
            <>
              <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setIsApproveOpen(false)} disabled={approveMutation.isPending}>
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
            <p className="cam-admin-meta" style={{ margin: "0 0 var(--cam-space-3)" }}>
              Déclaration #{ref} — {name}
            </p>
            <p style={{ margin: "0 0 var(--cam-space-3)", color: "var(--cam-text)", fontSize: "var(--cam-font-size-sm)" }}>
              Cette action vise officiellement le dossier et le marque comme <strong>APPROUVÉ</strong>. Elle est irréversible.
            </p>
            <p className="cam-admin-meta" style={{ margin: 0 }}>
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
