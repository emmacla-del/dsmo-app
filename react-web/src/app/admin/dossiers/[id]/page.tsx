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
  type DossierDiagnostic,
} from "@/lib/api-client";
import { entityTypeLabel } from "@/lib/companies-directory";

// Default Figma mock for ENT-2026-04521
const FIGMA_DOSSIER_MOCK: AdminDossier = {
  id: "ENT-2026-04521",
  submissionId: "ENT-2026-04521",
  formType: "ENTERPRISE",
  status: "PENDING_REVIEW",
  region: "Littoral",
  department: "Wouri",
  subdivision: "Douala Ier",
  submissionDate: "2026-09-18T16:45:00.000Z",
  reviewedAt: null,
  rejectionReason: null,
  quarterCode: "2026-T1",
  taxNumber: "M018400012542T",
  cnpsNumber: "1234567890",
  registrationNumber: "RC/DLA/2026/B/842",
  respondent: {
    respondentName: "Jean-Paul Mbarga",
    respondentFunction: "Directeur des Ressources Humaines",
    phone1: "+237 699 887 766",
    phone2: null,
    email: "jp.mbarga@example.cm",
  },
  enterpriseDetail: {
    companyName: "SABC S.A. (Brasseries du Cameroun)",
    headOffice: "Douala, Cameroun",
    sector: "Secteur Secondaire",
    branch: "Industrie Agro-alimentaire",
    enterpriseSize: "Grande Entreprise",
    permanentWorkers: "1 245 personnes",
    taxNumber: "M018400012542T",
    registrationNumber: "RC/DLA/2026/B/842",
    region: "Littoral",
    department: "Wouri",
    commune: "Douala Ier",
    address: "Rue des Écoles, Koumassi",
    creationDate: "12 Décembre 1948",
    taxRegime: "Réel",
  },
  cooperativeDetail: null,
  ctdDetail: null,
  ongDetail: null,
  administrationDetail: null,
  projectProgramDetail: null,
  vocationalTrainingDetail: null,
};

const FIGMA_DIAGNOSTIC_MOCK: DossierDiagnostic = {
  submissionId: "ENT-2026-04521",
  axis1Status: "PENDING_REVIEW",
  axis2BlockingCount: 0,
  axis2WarningCount: 2,
  axis3Eligibility: "READY",
  blockingAnomalies: [],
  warningAnomalies: [
    {
      ruleCode: "SEC2_SUM_MISMATCH",
      description: "Le total des employés permanents (1 245) ne correspond pas à la somme des catégories déclarées (1 189). Écart de 56 postes non classifiés.",
      observedValue: "1 245 vs 1 189",
      expectedValue: "Total cohérent",
    },
    {
      ruleCode: "SEC2_PAYROLL_RATIO",
      description: "Ratio masse salariale / effectif légèrement supérieur à la médiane sectorielle (+12%).",
      observedValue: "285 000 000 FCFA",
      expectedValue: "Médiane secteur",
    },
  ],
};

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
  const searchParams = useSearchParams();
  const id = (params.id as string) || "ENT-2026-04521";

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

  // Use live data if present, otherwise fallback to Figma mock
  const dossier: AdminDossier = dossierQuery.data || FIGMA_DOSSIER_MOCK;
  const diag: DossierDiagnostic = diagnosticQuery.data || FIGMA_DIAGNOSTIC_MOCK;
  const detail = entityDetail(dossier);

  const name = entityName(detail) ?? searchParams.get("name") ?? "SABC S.A. (Brasseries du Cameroun)";
  const ref = dossier.submissionId || id;
  const date = fmtDate(dossier.submissionDate) || "18/09/2026";
  const region = dossier.region || "Littoral";

  const invalidateDossier = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "diagnostic", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "dossier", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] });
  };

  // ── Modals State ────────────────────────────────────────────────────────
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [correctionSection, setCorrectionSection] = useState("Section 2 : Emploi et Conditions de Travail");
  const [correctionProblem, setCorrectionProblem] = useState(
    "Le total des employés permanents (1 245) ne correspond pas à la somme des catégories déclarées (1 189). Écart de 56 postes non classifiés."
  );
  const [correctionAction, setCorrectionAction] = useState(
    "Veuillez vérifier et corriger les effectifs dans la Section 2. Le total doit correspondre exactement à la somme des catégories (cadres + agents de maîtrise + employés + ouvriers)."
  );
  const [requireJustificatifs, setRequireJustificatifs] = useState(false);
  const [correctionDelay, setCorrectionDelay] = useState("7 jours ouvrables");
  const [correctionSuccess, setCorrectionSuccess] = useState(false);

  const correctionMutation = useMutation({
    mutationFn: () => {
      const fullComments = `[${correctionSection}] ${correctionAction.trim()}${
        requireJustificatifs ? " — Pièces justificatives requises." : ""
      } (Délai accordé : ${correctionDelay})`;
      return requestCorrectionDossier(id, fullComments, true);
    },
    onSuccess: () => {
      setCorrectionSuccess(true);
      invalidateDossier();
    },
  });

  const openCorrectionModal = () => {
    setCorrectionSuccess(false);
    correctionMutation.reset();
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
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  borderRadius: 9999,
                  background: "#fef3c7",
                  color: "#d97706",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#d97706",
                  }}
                />
                En Attente
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
              Soumis le {date} — Superviseur: Samuel Eto&apos;o (Région {region})
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
                  {dossier.respondent?.respondentName || "Jean-Paul Mbarga"}
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
                  {dossier.respondent?.respondentFunction || "Directeur des Ressources Humaines"}
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
                  {dossier.respondent?.phone1 || "+237 699 887 766"}
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
                  {dossier.respondent?.email || "jp.mbarga@example.cm"}
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
                  {String(detail.companyName || "SABC S.A. (Brasseries du Cameroun)")}
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
                  {String(detail.headOffice || "Douala, Cameroun")}
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
                  {String(detail.sector || "Secteur Secondaire")}
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
                  {String(detail.branch || "Industrie Agro-alimentaire")}
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
                  {String(detail.enterpriseSize || "Grande Entreprise")}
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
                  {String(detail.permanentWorkers || "1 245 personnes")}
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
                      {dossier.taxNumber || "M018400012542T"}
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
                      {dossier.registrationNumber || "RC/DLA/2026/B/842"}
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
                      {String(detail.region || dossier.region || "Littoral")}
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
                      {String(detail.department || dossier.department || "Wouri")}
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
                      {String(detail.commune || dossier.subdivision || "Douala Ier")}
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
                      {String(detail.address || "Rue des Écoles, Koumassi")}
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
                      {String(detail.creationDate || "12 Décembre 1948")}
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
                      {String(detail.taxRegime || "Réel")}
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                      Employés permanents
                    </label>
                    <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "#111827" }}>
                      1 245 personnes
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                      Cadres et dirigeants
                    </label>
                    <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "#111827" }}>
                      120
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                      Agents de maîtrise / Techniciens
                    </label>
                    <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "#111827" }}>
                      310
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                      Employés et ouvriers qualifiés
                    </label>
                    <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "#111827" }}>
                      759
                    </div>
                  </div>
                </div>
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
                <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
                  Aucun mouvement exceptionnel notifié sur cette période (14 départs volontaires, 8 départs à la retraite).
                </p>
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
                <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
                  35 stagiaires académiques accueillis · 140 salariés formés au cours de l&apos;exercice · Budget 18 500 000 FCFA.
                </p>
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

      {/* ── Bottom Timeline Card matching Figma _id.png ── */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "20px 24px",
          marginTop: 24,
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
          Historique d&apos;instruction de la Fiche
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            marginTop: 20,
          }}
        >
          {/* Step 1 */}
          <div style={{ display: "flex", gap: 12 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#22c55e",
                border: "3px solid #bbf7d0",
                marginTop: 3,
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                Fiche d&apos;enquête initialisée
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                Soumis par le répondant, supervisé par Samuel Eto&apos;o
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#15803d", marginTop: 4 }}>
                15/09/2026 - 08:30
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ display: "flex", gap: 12 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#0d9488",
                marginTop: 3,
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                Fiche soumise pour validation
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                Soumis au serveur central de l&apos;Observatoire National
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0f766e", marginTop: 4 }}>
                18/09/2026 - 16:45
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ display: "flex", gap: 12 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#f59e0b",
                marginTop: 3,
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                Actuellement en cours de revue
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                En attente de validation par M. Ewane (Superviseur National)
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#b45309", marginTop: 4 }}>
                En attente de revue
              </div>
            </div>
          </div>
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
                      2. PROBLÈME IDENTIFIÉ
                    </div>
                    <div
                      style={{
                        padding: "12px 14px",
                        background: "#fffbeb",
                        border: "1px solid #fde68a",
                        borderRadius: 6,
                        color: "#92400e",
                        fontSize: 13,
                        lineHeight: 1.45,
                      }}
                    >
                      {correctionProblem}
                    </div>
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
                      3. AXE DE QUALITÉ AFFECTÉ
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: "#dc2626",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <span>●</span>
                      <span>Axe 2 — Qualité des données: Conforme → 2 Anomalies</span>
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
                    disabled={correctionMutation.isPending || !correctionAction.trim()}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 6,
                      border: "none",
                      background: "#d97706",
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
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
                <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                  Cette action accorde le visa administratif officiel à cette fiche et la marque comme validée pour intégration statistique. Confirmez-vous la décision ?
                </p>
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
