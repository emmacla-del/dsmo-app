"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminDossier,
  getDossierDiagnostic,
  approveDossier,
  rejectDossier,
  requestCorrectionDossier,
  type AdminDossier,
} from "@/lib/api-client";
import { DataState } from "@/components/admin/DataState";
import {
  METRIC_UNAVAILABLE,
  NOT_RECORDED,
  count,
  fact,
  factOr,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";

/**
 * Administrative status of the dossier, exactly as stored.
 *
 * `null` (no status on the record) is its own case: it is reported, never
 * folded into "en instance".
 */
const STATUS_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  PENDING_REVIEW: { label: "En instance", bg: "#fef3c7", color: "#d97706" },
  APPROVED: { label: "Visé", bg: "#ecfdf5", color: "#047857" },
  CORRECTION_REQUESTED: { label: "Correction demandée", bg: "#fff7ed", color: "#c2410c" },
  REJECTED: { label: "Rejeté", bg: "#fef2f2", color: "#b91c1c" },
};

/**
 * Questionnaire sections whose figures this screen cannot show.
 *
 * GET /admin/questionnaires/:id does return the statistical tables
 * (cspGenderAge, departureData, internshipData, trainingNeeds, …), but mapping
 * them onto these section headings is a statistical-semantics decision owned by
 * the ONEFOP domain and the canonical AST — not something the admin UI may
 * improvise. Until that mapping is specified and reviewed, each section states
 * that its figures are not rendered here rather than printing numbers.
 * See docs/admin-data-integrity-inventory.md.
 */
const SECTION_SOURCES: Record<number, { title: string; backing: string }> = {
  2: {
    title: "Section 2 : Emploi et Conditions de Travail",
    backing: "cspGenderAge, diplomaData, disabilityData, vulnerableData, firstTimeWorkers",
  },
  3: {
    title: "Section 3 : Départs, Licenciements et Retraites",
    backing: "departureData, dismissalReasons, dismissalUnemployment",
  },
  4: {
    title: "Section 4 : Stage et Formation Professionnelle continue",
    backing: "internshipData, skillNeeds, trainingNeeds",
  },
};

type Detail = Record<string, unknown>;

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
  const n = detail.companyName ?? detail.cooperativeName ?? detail.ongName ?? detail.name ?? detail.ctdType;
  return n ? String(n) : null;
}

function SubmissionDetailContent() {
  const params = useParams();
  // No default id: without one there is no dossier to show, and substituting a
  // known identifier would load someone else's record.
  const id = typeof params.id === "string" ? params.id : "";

  const queryClient = useQueryClient();

  const dossierQuery = useQuery({
    queryKey: ["admin", "dossier", id],
    queryFn: () => getAdminDossier(id),
    retry: false,
  });

  const diagnosticQuery = useQuery({
    queryKey: ["admin", "diagnostic", id],
    queryFn: () => getDossierDiagnostic(id),
    retry: false,
  });

  /**
   * Source: GET /admin/questionnaires/:id (QuestionnairesService.getById).
   * Out-of-territory and unknown ids both come back as 404 — the service
   * deliberately does not distinguish them, so the UI reports "introuvable"
   * without leaking the existence of a dossier outside the caller's ressort.
   *
   * There is no fallback record. A failed or forbidden load renders a state,
   * never another establishment's dossier.
   */
  const dossier = dossierQuery.data ?? null;
  const diag = diagnosticQuery.data ?? null;
  const detail: Detail = dossier ? entityDetail(dossier) : {};

  const pageState = resolveDataState({
    isLoading: dossierQuery.isLoading,
    isError: dossierQuery.isError,
    error: dossierQuery.error,
  });

  // Every header fact below is the stored value or the neutral marker.
  const name = entityName(detail);
  const ref = dossier?.submissionId ?? id;
  const submittedOn = stamp(dossier?.submissionDate, false);
  const region = dossier?.region ?? null;
  const statusBadge = dossier?.status ? STATUS_BADGES[dossier.status] ?? null : null;

  const invalidateDossier = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "diagnostic", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "dossier", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] });
  };

  // ── Modals State ────────────────────────────────────────────────────────
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  // The correction request is written to the dossier and sent to the
  // respondent, so nothing is pre-filled: a prepared sentence about figures
  // this dossier may not contain would be persisted as a real administrative
  // instruction. The reviewer states the problem and the action.
  const [correctionSection, setCorrectionSection] = useState("");
  const [correctionProblem, setCorrectionProblem] = useState("");
  const [correctionAction, setCorrectionAction] = useState("");
  const [requireJustificatifs, setRequireJustificatifs] = useState(false);
  const [correctionDelay, setCorrectionDelay] = useState("7 jours ouvrables");
  // PATCH .../request-correction requires certified === true server-side: the
  // reviewer's attestation, not a formality the client can assume. It was
  // hardcoded here, so the attestation was being made on the reviewer's
  // behalf. Same pattern as certifiedReject below.
  const [certifiedCorrection, setCertifiedCorrection] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState(false);

  const correctionMutation = useMutation({
    mutationFn: () => {
      // Every part of the persisted comment comes from what the reviewer
      // actually entered on this screen.
      const fullComments = [
        correctionSection ? `[${correctionSection}]` : null,
        correctionProblem.trim() ? `Constat : ${correctionProblem.trim()}` : null,
        `Action demandée : ${correctionAction.trim()}`,
        requireJustificatifs ? "Pièces justificatives requises." : null,
        `Délai accordé : ${correctionDelay}`,
      ]
        .filter(Boolean)
        .join(" — ");
      return requestCorrectionDossier(id, fullComments, certifiedCorrection);
    },
    onSuccess: () => {
      setCorrectionSuccess(true);
      invalidateDossier();
    },
  });

  // Same three conditions the submit button disables on, so the button's
  // colour and its enabled state can never disagree.
  const correctionReady =
    certifiedCorrection && !!correctionAction.trim() && !!correctionProblem.trim();

  const openCorrectionModal = () => {
    setCorrectionSuccess(false);
    correctionMutation.reset();
    setCertifiedCorrection(false);
    setIsCorrectionOpen(true);
  };

  // ── Reject State & Mutation (Retained) ──
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [certifiedReject, setCertifiedReject] = useState(false);
  const [rejectSuccess, setRejectSuccess] = useState(false);

  const rejectMutation = useMutation({
    mutationFn: () => rejectDossier(id, rejectReason.trim(), certifiedReject),
    onSuccess: () => {
      setRejectSuccess(true);
      invalidateDossier();
    },
  });

  const openRejectModal = () => {
    setRejectSuccess(false);
    rejectMutation.reset();
    setCertifiedReject(false);
    setRejectReason("");
    setIsRejectOpen(true);
  };

  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState(false);

  const approveMutation = useMutation({
    mutationFn: () => approveDossier(id),
    onSuccess: () => {
      setApproveSuccess(true);
      invalidateDossier();
    },
  });

  const openApproveModal = () => {
    setApproveSuccess(false);
    approveMutation.reset();
    setIsApproveOpen(true);
  };

  // Section accordion toggle
  const [expandedSection, setExpandedSection] = useState<number | null>(1);

  /**
   * Instruction history, derived exclusively from timestamps the record
   * carries. A step exists only when its timestamp does; the decision step is
   * labelled by the stored status.
   */
  const timeline = useMemo(() => {
    if (!dossier) return [];
    const steps: Array<{ key: string; title: string; detail: string | null; stamp: string; color: string }> = [];

    if (dossier.submissionDate) {
      steps.push({
        key: "submitted",
        title: "Fiche reçue par le serveur central",
        detail: dossier.quarterCode ? `Campagne ${dossier.quarterCode}` : null,
        stamp: stamp(dossier.submissionDate),
        color: "#0d9488",
      });
    }

    if (dossier.reviewedAt) {
      const decision =
        dossier.status === "APPROVED"
          ? { title: "Visa administratif accordé", color: "#16a34a" }
          : dossier.status === "REJECTED"
            ? { title: "Dossier rejeté", color: "#dc2626" }
            : dossier.status === "CORRECTION_REQUESTED"
              ? { title: "Retour pour correction", color: "#d97706" }
              : { title: "Décision enregistrée", color: "#6b7280" };
      steps.push({
        key: "reviewed",
        title: decision.title,
        detail: dossier.rejectionReason ?? null,
        stamp: stamp(dossier.reviewedAt),
        color: decision.color,
      });
    }

    return steps;
  }, [dossier]);

  /**
   * Nothing below renders without an authoritative record. Loading, a server
   * error, an authorization refusal and "not found" are reported as
   * themselves — there is no path on which a substitute dossier appears.
   */
  if (!dossier) {
    return (
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 0" }}>
        <Link
          href="/admin/dossiers"
          style={{ fontSize: 13, fontWeight: 600, color: "#1e6b3a", textDecoration: "none" }}
        >
          ← Retour aux dossiers
        </Link>
        <div style={{ marginTop: 20 }}>
          <DataState
            state={pageState === "ready" ? "notFound" : pageState}
            resource="ce dossier"
            error={dossierQuery.error}
            onRetry={() => dossierQuery.refetch()}
            title={
              pageState === "notFound" || pageState === "ready"
                ? "Dossier introuvable"
                : pageState === "forbidden"
                  ? "Accès non autorisé"
                  : undefined
            }
            hint={
              pageState === "notFound" || pageState === "ready"
                ? "Aucun dossier ne correspond à cet identifiant dans votre ressort territorial."
                : pageState === "forbidden"
                  ? "Votre rôle ne permet pas de consulter ce dossier."
                  : undefined
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 0 32px 0" }}>
      {/* ── Top Header matching Figma _id.png ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/admin/dossiers"
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "#e5e7eb",
              border: "1px solid #d1d5db",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#374151",
              textDecoration: "none",
              fontSize: 16,
              fontWeight: "bold",
              transition: "background 0.15s ease",
            }}
            aria-label="Retour aux dossiers"
          >
            ←
          </Link>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>
                Soumission #{ref}
              </h1>
              {/* Badge reflects the dossier's stored status. A record with no
                  status says so rather than defaulting to "en attente". */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  borderRadius: 9999,
                  background: statusBadge?.bg ?? "#f3f4f6",
                  color: statusBadge?.color ?? "#6b7280",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: statusBadge?.color ?? "#9ca3af",
                  }}
                />
                {statusBadge?.label ?? "Statut non renseigné"}
              </span>
            </div>
            {/* Submission date and territory as stored. The record holds no
                supervisor relation (OnefopSubmission.reviewedBy is a bare
                account id, set only once a decision is taken), so none is
                named here. */}
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
              Soumis le {submittedOn}
              {region ? ` — Région ${region}` : ""}
              {dossier.department ? ` / ${dossier.department}` : ""}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={openRejectModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 16px",
              borderRadius: 6,
              border: "1px solid #dc2626",
              background: "#ffffff",
              color: "#dc2626",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Rejeter la Fiche
          </button>
          <button
            type="button"
            onClick={openCorrectionModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 16px",
              borderRadius: 6,
              border: "1px solid #d97706",
              background: "#ffffff",
              color: "#d97706",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            Demander une correction
          </button>
          <button
            type="button"
            onClick={openApproveModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 16px",
              borderRadius: 6,
              border: "none",
              background: "#1e6b3a",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Valider et Archiver
          </button>
        </div>
      </div>

      {/* ── Sub-navigation Pills Row matching Figma _id.png ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <Link
          href="/admin/pilotage"
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            color: "#6b7280",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Tableau de bord
        </Link>
        <Link
          href="/admin/dossiers"
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            background: "#d97706",
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Dossiers en instance
        </Link>
        <Link
          href="/admin/activite"
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            color: "#6b7280",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Activité & alertes
        </Link>
      </div>

      {/* ── 3-Axis Diagnostic Strip matching Figma _id.png ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 20,
          padding: "18px 24px",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderLeft: "4px solid #f59e0b",
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#374151",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            AXE 1 · VISA ADMINISTRATIF
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 9999,
              background: "#fef3c7",
              color: "#d97706",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            ⏱ EN INSTANCE
          </span>
        </div>

        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#374151",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            AXE 2 · QUALITÉ DES DONNÉES
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 9999,
              background: "#fef3c7",
              color: "#d97706",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            🚩 2 Avertissements
          </span>
        </div>

        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#374151",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            AXE 3 · ÉLIGIBILITÉ STATISTIQUE
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 9999,
              background: "#fef3c7",
              color: "#d97706",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            En attente d&apos;arbitrage
          </span>
        </div>
      </div>

      {/* ── Two Columns Content matching Figma _id.png ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "380px 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Left Column: Respondent and Structure Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Informations sur le Répondant */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 20,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#111827",
                margin: 0,
                paddingBottom: 14,
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              Informations sur le Répondant
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 2,
                  }}
                >
                  NOM COMPLET
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                  {factOr(dossier.respondent?.respondentName, NOT_RECORDED)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 2,
                  }}
                >
                  FONCTION / POSTE
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                  {factOr(dossier.respondent?.respondentFunction, NOT_RECORDED)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 2,
                  }}
                >
                  TÉLÉPHONE
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                  {factOr(dossier.respondent?.phone1, NOT_RECORDED)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 2,
                  }}
                >
                  ADRESSE EMAIL
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                  {factOr(dossier.respondent?.email, NOT_RECORDED)}
                </div>
              </div>
            </div>
          </div>

          {/* Informations de la Structure */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 20,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#111827",
                margin: 0,
                paddingBottom: 14,
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              Informations de la Structure
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 2,
                  }}
                >
                  RAISON SOCIALE
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                  {fact(detail.companyName)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 2,
                  }}
                >
                  SIÈGE SOCIAL
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                  {fact(detail.headOffice)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 2,
                  }}
                >
                  SECTEUR D&apos;ACTIVITÉ
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                  {fact(detail.sector)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 2,
                  }}
                >
                  BRANCHE
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                  {fact(detail.branch)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 2,
                  }}
                >
                  TAILLE DE L&apos;ENTREPRISE
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                  {fact(detail.enterpriseSize)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 2,
                  }}
                >
                  EMPLOYÉS PERMANENTS
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                  {fact(detail.permanentWorkers)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 4 Accordion Sections matching Figma _id.png */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Section 1 : Identification de l'Établissement (Expanded) */}
          <div
            style={{
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid #e5e7eb",
              background: "#ffffff",
            }}
          >
            <button
              type="button"
              onClick={() => setExpandedSection(expandedSection === 1 ? null : 1)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                background: "#1e6b3a",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 600,
                textAlign: "left",
              }}
            >
              <span>Section 1 : Identification de l&apos;Établissement</span>
              <span style={{ fontSize: 14, transform: expandedSection === 1 ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                ⌄
              </span>
            </button>
            {expandedSection === 1 && (
              <div style={{ padding: "20px" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                        marginBottom: 6,
                      }}
                    >
                      Numéro de contribuable
                    </label>
                    <div
                      style={{
                        background: "#f9fafb",
                        border: "1px solid #f3f4f6",
                        borderRadius: 6,
                        padding: "10px 14px",
                        fontSize: 14,
                        color: "#111827",
                        fontWeight: 500,
                      }}
                    >
                      {factOr(dossier.taxNumber, NOT_RECORDED)}
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                        marginBottom: 6,
                      }}
                    >
                      Numéro de registre du commerce (RCCM)
                    </label>
                    <div
                      style={{
                        background: "#f9fafb",
                        border: "1px solid #f3f4f6",
                        borderRadius: 6,
                        padding: "10px 14px",
                        fontSize: 14,
                        color: "#111827",
                        fontWeight: 500,
                      }}
                    >
                      {factOr(dossier.registrationNumber, NOT_RECORDED)}
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                        marginBottom: 6,
                      }}
                    >
                      Région d&apos;implantation
                    </label>
                    <div
                      style={{
                        background: "#f9fafb",
                        border: "1px solid #f3f4f6",
                        borderRadius: 6,
                        padding: "10px 14px",
                        fontSize: 14,
                        color: "#111827",
                        fontWeight: 500,
                      }}
                    >
                      {factOr(detail.region ?? dossier.region, NOT_RECORDED)}
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                        marginBottom: 6,
                      }}
                    >
                      Département
                    </label>
                    <div
                      style={{
                        background: "#f9fafb",
                        border: "1px solid #f3f4f6",
                        borderRadius: 6,
                        padding: "10px 14px",
                        fontSize: 14,
                        color: "#111827",
                        fontWeight: 500,
                      }}
                    >
                      {factOr(detail.department ?? dossier.department, NOT_RECORDED)}
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                        marginBottom: 6,
                      }}
                    >
                      Ville / Commune
                    </label>
                    <div
                      style={{
                        background: "#f9fafb",
                        border: "1px solid #f3f4f6",
                        borderRadius: 6,
                        padding: "10px 14px",
                        fontSize: 14,
                        color: "#111827",
                        fontWeight: 500,
                      }}
                    >
                      {factOr(detail.commune ?? dossier.subdivision, NOT_RECORDED)}
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                        marginBottom: 6,
                      }}
                    >
                      Quartier / Adresse
                    </label>
                    <div
                      style={{
                        background: "#f9fafb",
                        border: "1px solid #f3f4f6",
                        borderRadius: 6,
                        padding: "10px 14px",
                        fontSize: 14,
                        color: "#111827",
                        fontWeight: 500,
                      }}
                    >
                      {fact(detail.address)}
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                        marginBottom: 6,
                      }}
                    >
                      Date de création
                    </label>
                    <div
                      style={{
                        background: "#f9fafb",
                        border: "1px solid #f3f4f6",
                        borderRadius: 6,
                        padding: "10px 14px",
                        fontSize: 14,
                        color: "#111827",
                        fontWeight: 500,
                      }}
                    >
                      {fact(detail.creationDate)}
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                        marginBottom: 6,
                      }}
                    >
                      Régime d&apos;imposition
                    </label>
                    <div
                      style={{
                        background: "#f9fafb",
                        border: "1px solid #f3f4f6",
                        borderRadius: 6,
                        padding: "10px 14px",
                        fontSize: 14,
                        color: "#111827",
                        fontWeight: 500,
                      }}
                    >
                      {fact(detail.taxRegime)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2 : Emploi et Conditions de Travail */}
          <div
            style={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setExpandedSection(expandedSection === 2 ? null : 2)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                background: "#ffffff",
                color: "#111827",
                border: "none",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 600,
                textAlign: "left",
              }}
            >
              <span>Section 2 : Emploi et Conditions de Travail</span>
              <span style={{ fontSize: 14, transform: expandedSection === 2 ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                ⌄
              </span>
            </button>
            {expandedSection === 2 && (
              <div style={{ padding: "20px", borderTop: "1px solid #e5e7eb" }}>
                <DataState
                  dense
                  state="unavailable"
                  resource="les données de cette section"
                  title="Données chiffrées non affichées ici"
                  hint={`Les tableaux statistiques de cette section (${SECTION_SOURCES[2].backing}) sont enregistrés avec le dossier, mais leur restitution dans cet écran n'est pas encore spécifiée par le domaine ONEFOP. Consultez le PDF officiel du dossier ou l'export statistique.`}
                />
              </div>
            )}
          </div>

          {/* Section 3 : Départs, Licenciements et Retraites */}
          <div
            style={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setExpandedSection(expandedSection === 3 ? null : 3)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                background: "#ffffff",
                color: "#111827",
                border: "none",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 600,
                textAlign: "left",
              }}
            >
              <span>Section 3 : Départs, Licenciements et Retraites</span>
              <span style={{ fontSize: 14, transform: expandedSection === 3 ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                ⌄
              </span>
            </button>
            {expandedSection === 3 && (
              <div style={{ padding: "20px", borderTop: "1px solid #e5e7eb" }}>
                <DataState
                  dense
                  state="unavailable"
                  resource="les données de cette section"
                  title="Données chiffrées non affichées ici"
                  hint={`Les tableaux statistiques de cette section (${SECTION_SOURCES[3].backing}) sont enregistrés avec le dossier, mais leur restitution dans cet écran n'est pas encore spécifiée par le domaine ONEFOP. Consultez le PDF officiel du dossier ou l'export statistique.`}
                />
              </div>
            )}
          </div>

          {/* Section 4 : Stage et Formation Professionnelle continue */}
          <div
            style={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setExpandedSection(expandedSection === 4 ? null : 4)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                background: "#ffffff",
                color: "#111827",
                border: "none",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 600,
                textAlign: "left",
              }}
            >
              <span>Section 4 : Stage et Formation Professionnelle continue</span>
              <span style={{ fontSize: 14, transform: expandedSection === 4 ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                ⌄
              </span>
            </button>
            {expandedSection === 4 && (
              <div style={{ padding: "20px", borderTop: "1px solid #e5e7eb" }}>
                <DataState
                  dense
                  state="unavailable"
                  resource="les données de cette section"
                  title="Données chiffrées non affichées ici"
                  hint={`Les tableaux statistiques de cette section (${SECTION_SOURCES[4].backing}) sont enregistrés avec le dossier, mais leur restitution dans cet écran n'est pas encore spécifiée par le domaine ONEFOP. Consultez le PDF officiel du dossier ou l'export statistique.`}
                />
              </div>
            )}
          </div>

          {/* ── Retained Quality Anomalies & Alerts Widgets ── */}
          {diag && diag.blockingAnomalies && diag.blockingAnomalies.length > 0 && (
            <div style={{ background: "#ffffff", border: "1px solid #fecaca", borderRadius: 8, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626" }} />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#b91c1c", margin: 0 }}>
                  Anomalies bloquantes ({diag.blockingAnomalies.length})
                </h3>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151" }}>
                {diag.blockingAnomalies.map((ano, idx) => (
                  <li key={idx} style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, color: "#991b1b" }}>{ano.ruleCode}</span> · {ano.description}
                    <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
                      Observé : {String(ano.observedValue ?? "—")} · Attendu : {String(ano.expectedValue ?? "—")}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diag && diag.warningAnomalies && diag.warningAnomalies.length > 0 && (
            <div style={{ background: "#ffffff", border: "1px solid #fde68a", borderRadius: 8, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706" }} />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#b45309", margin: 0 }}>
                  Alertes de cohérence ({diag.warningAnomalies.length})
                </h3>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151" }}>
                {diag.warningAnomalies.map((ano, idx) => (
                  <li key={idx} style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, color: "#92400e" }}>{ano.ruleCode}</span> · {ano.description}
                    <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
                      Observé : {String(ano.observedValue ?? "—")} · Attendu : {String(ano.expectedValue ?? "—")}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diag && (!diag.blockingAnomalies || diag.blockingAnomalies.length === 0) && (!diag.warningAnomalies || diag.warningAnomalies.length === 0) && (
            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "12px 16px", color: "#065f46", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <span>✓</span>
              <span>Aucune anomalie détectée. Le dossier est conforme aux règles de cohérence.</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Instruction history ──
          Built only from timestamps stored on the dossier:
            - submissionDate  → reception by the central server
            - reviewedAt      → the administrative decision, labelled by the
                                stored status (visa / rejet / correction)
            - rejectionReason → the recorded motive, when there is one
          No step is shown for a timestamp the record does not carry, and no
          actor is named: `reviewedBy` holds a bare account id, and the named
          history of who did what lives in the audit journal, which is linked
          rather than reconstructed here. */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "20px 24px",
          marginTop: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            paddingBottom: 14,
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
            Historique d&apos;instruction de la Fiche
          </h2>
          <Link
            href={`/admin/journal-audit?resourceId=${encodeURIComponent(dossier.id)}`}
            style={{ fontSize: 13, fontWeight: 600, color: "#1e6b3a", textDecoration: "none" }}
          >
            Voir les événements d&apos;audit →
          </Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
          {timeline.length === 0 ? (
            <DataState
              dense
              state="empty"
              resource="l'historique d'instruction"
              title="Aucune étape horodatée"
              hint="Ce dossier ne porte aucune date de soumission ni de décision."
            />
          ) : (
            timeline.map((step) => (
              <div key={step.key} style={{ display: "flex", gap: 12 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: step.color,
                    marginTop: 4,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{step.title}</div>
                  {step.detail && (
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{step.detail}</div>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 600, color: step.color, marginTop: 4 }}>
                    {step.stamp}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Pending states are shown as pending, with no predicted approver. */}
          {dossier.status === "PENDING_REVIEW" && (
            <div style={{ display: "flex", gap: 12 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: "#f59e0b",
                  marginTop: 4,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  En attente de décision
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#b45309", marginTop: 4 }}>
                  Aucune décision enregistrée
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Retour pour Correction matching Figma retour-correction.png ── */}
      {isCorrectionOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="correction-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setIsCorrectionOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 580,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 id="correction-title" style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>
                  Retour pour Correction
                </h2>
                <button
                  type="button"
                  onClick={() => setIsCorrectionOpen(false)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    border: "1.5px solid #9ca3af",
                    background: "transparent",
                    color: "#6b7280",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                Déclaration #{ref} — {name}
              </p>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {correctionSuccess ? (
                <div
                  style={{
                    padding: "14px 16px",
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    borderRadius: 6,
                    color: "#065f46",
                    fontSize: 14,
                  }}
                >
                  La demande de correction a été enregistrée avec succès et notifiée au déclarant.
                </div>
              ) : (
                <>
                  {/* 1. Section concernée */}
                  <div>
                    <label
                      htmlFor="modal-correction-section"
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#374151",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 6,
                      }}
                    >
                      1. SECTION CONCERNÉE
                    </label>
                    <select
                      id="modal-correction-section"
                      value={correctionSection}
                      onChange={(e) => setCorrectionSection(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        fontSize: 14,
                        color: "#111827",
                        background: "#ffffff",
                      }}
                    >
                      <option value="">Sélectionnez une section…</option>
                      <option value="Section 1 : Identification de l'Établissement">
                        Section 1 : Identification de l&apos;Établissement
                      </option>
                      <option value="Section 2 : Emploi et Conditions de Travail">
                        Section 2 : Emploi et Conditions de Travail
                      </option>
                      <option value="Section 3 : Départs, Licenciements et Retraites">
                        Section 3 : Départs, Licenciements et Retraites
                      </option>
                      <option value="Section 4 : Stage et Formation Professionnelle continue">
                        Section 4 : Stage et Formation Professionnelle continue
                      </option>
                    </select>
                  </div>

                  {/* 2. Problème identifié */}
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#374151",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 6,
                      }}
                    >
                      2. PROBLÈME CONSTATÉ
                    </div>
                    {/* Written by the reviewer. Nothing is pre-filled: this
                        text is persisted with the dossier and sent to the
                        respondent, so a prepared statement about figures the
                        dossier may not contain would become a real
                        administrative finding. */}
                    <textarea
                      id="modal-correction-problem"
                      rows={3}
                      value={correctionProblem}
                      onChange={(e) => setCorrectionProblem(e.target.value)}
                      placeholder="Décrivez l'écart ou la non-conformité constatée sur ce dossier."
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                        lineHeight: 1.4,
                        color: "#111827",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* 3. Axe de qualité affecté */}
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#374151",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 6,
                      }}
                    >
                      3. AXE DE QUALITÉ (DIAGNOSTIC DU DOSSIER)
                    </div>
                    {/* Source: GET /admin/questionnaires/:id/diagnostic —
                        axis2BlockingCount / axis2WarningCount as computed by
                        EligibilityEngineService. Reported as "non disponible"
                        when the diagnostic could not be read. */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: diag && diag.axis2BlockingCount > 0 ? "#dc2626" : "#6b7280",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <span>●</span>
                      <span>
                        {diag
                          ? `Axe 2 — ${count(diag.axis2BlockingCount)} anomalie(s) bloquante(s), ${count(diag.axis2WarningCount)} avertissement(s)`
                          : `Axe 2 — ${METRIC_UNAVAILABLE}`}
                      </span>
                    </div>
                  </div>

                  {/* 4. Action demandée */}
                  <div>
                    <label
                      htmlFor="modal-correction-action"
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#374151",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 6,
                      }}
                    >
                      4. ACTION DEMANDÉE AU DÉCLARANT
                    </label>
                    <textarea
                      id="modal-correction-action"
                      rows={3}
                      value={correctionAction}
                      onChange={(e) => setCorrectionAction(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                        lineHeight: 1.4,
                        color: "#111827",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Checkbox */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      color: "#374151",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={requireJustificatifs}
                      onChange={(e) => setRequireJustificatifs(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                    <span>Demander des documents justificatifs</span>
                  </label>

                  {/* Délai de correction accordé */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "#374151" }}>Délai de correction accordé :</span>
                    <select
                      value={correctionDelay}
                      onChange={(e) => setCorrectionDelay(e.target.value)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                        color: "#111827",
                        background: "#ffffff",
                      }}
                    >
                      <option value="3 jours ouvrables">3 jours ouvrables</option>
                      <option value="7 jours ouvrables">7 jours ouvrables</option>
                      <option value="15 jours ouvrables">15 jours ouvrables</option>
                      <option value="30 jours calendaires">30 jours calendaires</option>
                    </select>
                  </div>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      fontSize: 13,
                      color: "#374151",
                      cursor: "pointer",
                      padding: 10,
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={certifiedCorrection}
                      onChange={(e) => setCertifiedCorrection(e.target.checked)}
                      style={{ marginTop: 2, cursor: "pointer" }}
                    />
                    <span>
                      <strong>Je certifie sur l&apos;honneur</strong> que cette demande de correction est motivée et conforme aux règles ministérielles.
                    </span>
                  </label>

                  {correctionMutation.isError && (
                    <div
                      role="alert"
                      style={{
                        padding: 12,
                        borderRadius: 6,
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#b91c1c",
                        fontSize: 13,
                        marginTop: 12,
                      }}
                    >
                      La demande de correction a échoué : {(correctionMutation.error as Error)?.message ?? "Erreur inconnue"}.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer matching Figma */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e5e7eb",
                background: "#f9fafb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 11, color: "#6b7280" }}>
                Cette action génère une entrée d&apos;audit DECLARATION.RETURNED
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsCorrectionOpen(false)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: "#374151",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {correctionSuccess ? "Fermer" : "Annuler"}
                </button>
                {!correctionSuccess && (
                  <button
                    type="button"
                    onClick={() => correctionMutation.mutate()}
                    disabled={
                      correctionMutation.isPending ||
                      !certifiedCorrection ||
                      !correctionAction.trim() ||
                      !correctionProblem.trim()
                    }
                    style={{
                      padding: "8px 18px",
                      borderRadius: 6,
                      border: "none",
                      background: correctionReady ? "#d97706" : "#fcd34d",
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: correctionReady ? "pointer" : "not-allowed",
                    }}
                  >
                    {correctionMutation.isPending ? "Transmission..." : "Confirmer le Retour"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Valider et Archiver ── */}
      {isApproveOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setIsApproveOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 500,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e5e7eb" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>
                Valider et Archiver
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                Déclaration #{ref} — {name}
              </p>
            </div>
            <div style={{ padding: "20px 24px" }}>
              {approveSuccess ? (
                <div
                  style={{
                    padding: "14px 16px",
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    borderRadius: 6,
                    color: "#065f46",
                    fontSize: 14,
                  }}
                >
                  Le dossier a été officiellement visé et archivé.
                </div>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                    Cette action accorde le visa administratif officiel à cette fiche et la marque comme validée pour intégration statistique. Confirmez-vous la décision ?
                  </p>
                  {approveMutation.isError && (
                    <div
                      role="alert"
                      style={{
                        padding: 12,
                        borderRadius: 6,
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#b91c1c",
                        fontSize: 13,
                        marginTop: 12,
                      }}
                    >
                      La validation a échoué : {(approveMutation.error as Error)?.message ?? "Erreur inconnue"}.
                    </div>
                  )}
                </>
              )}
            </div>
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e5e7eb",
                background: "#f9fafb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setIsApproveOpen(false)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {approveSuccess ? "Fermer" : "Annuler"}
              </button>
              {!approveSuccess && (
                <button
                  type="button"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 6,
                    border: "none",
                    background: "#1e6b3a",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {approveMutation.isPending ? "Validation..." : "Confirmer la validation"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Rejeter la Fiche (Retained Action) ── */}
      {isRejectOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setIsRejectOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>
                  Rejeter la Fiche
                </h2>
                <button
                  type="button"
                  onClick={() => setIsRejectOpen(false)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    border: "1.5px solid #9ca3af",
                    background: "transparent",
                    color: "#6b7280",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                Déclaration #{ref} — {name}
              </p>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {rejectSuccess ? (
                <div
                  style={{
                    padding: "14px 16px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 6,
                    color: "#991b1b",
                    fontSize: 14,
                  }}
                >
                  La fiche a été officiellement rejetée. Le déclarant en a été informé.
                </div>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                    Cette décision met un terme au processus d&apos;instruction pour cette déclaration.
                  </p>

                  <div>
                    <label
                      htmlFor="reject-motif"
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#374151",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 6,
                      }}
                    >
                      Motif du rejet <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <textarea
                      id="reject-motif"
                      rows={3}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Précisez le motif légal ou technique du rejet (10 caractères minimum)…"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                        lineHeight: 1.4,
                        color: "#111827",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                    {rejectReason.trim().length > 0 && rejectReason.trim().length < 10 && (
                      <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>
                        Le motif doit comporter au moins 10 caractères ({rejectReason.trim().length}/10).
                      </p>
                    )}
                  </div>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      fontSize: 13,
                      color: "#374151",
                      cursor: "pointer",
                      padding: 10,
                      background: "#fff5f5",
                      border: "1px solid #fecaca",
                      borderRadius: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={certifiedReject}
                      onChange={(e) => setCertifiedReject(e.target.checked)}
                      style={{ marginTop: 2, cursor: "pointer" }}
                    />
                    <span>
                      <strong>Je certifie sur l&apos;honneur</strong> que cette décision de rejet est motivée et conforme aux règles ministérielles.
                    </span>
                  </label>

                  <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>
                    Cette action génère une entrée d&apos;audit AUDIT_REJECT.
                  </p>

                  {rejectMutation.isError && (
                    <div
                      role="alert"
                      style={{
                        padding: 12,
                        borderRadius: 6,
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#b91c1c",
                        fontSize: 13,
                      }}
                    >
                      Le rejet a échoué : {(rejectMutation.error as Error)?.message ?? "Erreur inconnue"}.
                    </div>
                  )}
                </>
              )}
            </div>

            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e5e7eb",
                background: "#f9fafb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setIsRejectOpen(false)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {rejectSuccess ? "Fermer" : "Annuler"}
              </button>
              {!rejectSuccess && (
                <button
                  type="button"
                  onClick={() => rejectMutation.mutate()}
                  disabled={!certifiedReject || rejectReason.trim().length < 10 || rejectMutation.isPending}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 6,
                    border: "none",
                    background: certifiedReject && rejectReason.trim().length >= 10 ? "#dc2626" : "#fca5a5",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: certifiedReject && rejectReason.trim().length >= 10 ? "pointer" : "not-allowed",
                  }}
                >
                  {rejectMutation.isPending ? "Rejet en cours..." : "Confirmer le Rejet"}
                </button>
              )}
            </div>
          </div>
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
