"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
import { useAuthStore } from "@/lib/auth-store";
import { AUDIT_ROLES, hasRole } from "@/lib/roles";
import {
  NOT_PROVIDED,
  count,
  fact,
  metricUnavailable,
  notRecorded,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";
import { asUiLocale } from "@/lib/register-i18n";

/**
 * Administrative status of the dossier, exactly as stored.
 *
 * `null` (no status on the record) is its own case: it is reported, never
 * folded into "en instance".
 */
// `labelKey` is under adminDossierPage.
const STATUS_BADGES: Record<string, { labelKey: string; bg: string; color: string }> = {
  PENDING_REVIEW: { labelKey: "statusPending", bg: "#fef3c7", color: "#d97706" },
  APPROVED: { labelKey: "statusEndorsed", bg: "#ecfdf5", color: "#047857" },
  CORRECTION_REQUESTED: { labelKey: "statusCorrection", bg: "#fff7ed", color: "#c2410c" },
  REJECTED: { labelKey: "statusRejected", bg: "#fef2f2", color: "#b91c1c" },
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
const SECTION_SOURCES: Record<number, { backing: string }> = {
  2: { backing: "cspGenderAge, diplomaData, disabilityData, vulnerableData, firstTimeWorkers" },
  3: { backing: "departureData, dismissalReasons, dismissalUnemployment" },
  4: { backing: "internshipData, skillNeeds, trainingNeeds" },
};

/**
 * Section headings use the canonical AST titles (onefop_ast.dart, through the
 * generated onefop.schema.json). Section 1 is titled per entity type; 2-4 are
 * the enterprise-family sections the backing tables above belong to.
 *
 * The correction request stores the section in its comment, which is the
 * official record sent to the respondent. That text stays French whatever the
 * reviewer's language, so the French titles are kept here as the option
 * values; only the visible option labels follow the locale.
 */
const SECTION1_TITLE_FR: Record<string, string> = {
  ENTREPRISE: "Section 1. Identification de l'entreprise",
  COOPERATIVE: "Section 1. Identification de la coopérative",
  CTD: "Section 1. Identification de la CTD",
  ONG: "Section 1. Identification de l'ONG",
  ADMINISTRATION: "Section 1. Caractéristique de l'administration",
  PROJECT_PROGRAM: "Section 1. Identification de la structure",
  VOCATIONAL_TRAINING: "Section 1. Identification et localisation de la structure",
};
const SECTION_TITLE_FR: Record<2 | 3 | 4, string> = {
  2: "Section 2. Emploi et travail",
  3: "Section 3. Départs",
  4: "Section 4. Stage et formation",
};

/** Correction deadlines: the value is the French text stored in the comment. */
const CORRECTION_DELAYS: { value: string; labelKey: string }[] = [
  { value: "3 jours ouvrables", labelKey: "delay3" },
  { value: "7 jours ouvrables", labelKey: "delay7" },
  { value: "15 jours ouvrables", labelKey: "delay15" },
  { value: "30 jours calendaires", labelKey: "delay30" },
];

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

/**
 * S1Q01 « Régime/statut juridique » (onefop_ast.dart, path
 * enterprise.legalStatus) stores the bilingual option value; the reviewer
 * sees the AST's French label. A value outside the option list is shown as
 * stored rather than dropped: it is still the respondent's answer.
 */
// `adminDossierPage.legalStatus.<key>`; each pair is the AST's own fr/en label.
const LEGAL_STATUS_KEYS: Record<string, string> = {
  "Société unipersonnelle/ Single-member company": "singleMember",
  "SARL/ LLC": "llc",
  "SA/ PLC": "plc",
  "Autres/ Others": "others",
};

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
  const t = useTranslations("adminDossierPage");
  const tCommon = useTranslations("common");
  const locale = asUiLocale(useLocale());
  /** A respondent-entered field: its value, or "not recorded" in the console locale. */
  const recorded = (value: unknown) => {
    const resolved = fact(value);
    return resolved === NOT_PROVIDED ? notRecorded(locale) : resolved;
  };
  const legalStatus = (value: unknown) => {
    const stored = fact(value);
    const key = LEGAL_STATUS_KEYS[stored];
    return key ? t(`legalStatus.${key}`) : stored;
  };
  // The journal is AUDIT_ROLES-only (GET /audit/reports is platform-wide), so
  // its links render only for roles that can open it — not as a 403.
  const canReadAudit = hasRole(useAuthStore((s) => s.user?.role), AUDIT_ROLES);

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
  const submittedOn = stamp(dossier?.submissionDate, false, locale);
  const region = dossier?.region ?? null;
  const statusBadge = dossier?.status ? STATUS_BADGES[dossier.status] ?? null : null;
  const formType = dossier?.formType ?? "";
  const section1Fr = SECTION1_TITLE_FR[formType] ?? SECTION1_TITLE_FR.ENTREPRISE;
  const section1Title = SECTION1_TITLE_FR[formType] ? t(`section1.${formType}`) : t("section1.ENTREPRISE");

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
  // Plain computation: two steps at most, and the React Compiler memoizes
  // the component itself (a manual useMemo over the translator could not be
  // preserved).
  const timeline = (() => {
    if (!dossier) return [];
    const steps: Array<{ key: string; title: string; detail: string | null; stamp: string; color: string }> = [];

    if (dossier.submissionDate) {
      steps.push({
        key: "submitted",
        title: t("timelineReceived"),
        detail: dossier.quarterCode ? t("timelineCampaign", { code: dossier.quarterCode }) : null,
        stamp: stamp(dossier.submissionDate, true, locale),
        color: "#0d9488",
      });
    }

    if (dossier.reviewedAt) {
      const decision =
        dossier.status === "APPROVED"
          ? { title: t("timelineEndorsed"), color: "#16a34a" }
          : dossier.status === "REJECTED"
            ? { title: t("timelineRejected"), color: "#dc2626" }
            : dossier.status === "CORRECTION_REQUESTED"
              ? { title: t("timelineCorrection"), color: "#d97706" }
              : { title: t("timelineDecision"), color: "#6b7280" };
      steps.push({
        key: "reviewed",
        title: decision.title,
        detail: dossier.rejectionReason ?? null,
        stamp: stamp(dossier.reviewedAt, true, locale),
        color: decision.color,
      });
    }

    return steps;
  })();

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
          {t("backToFilesLink")}
        </Link>
        <div style={{ marginTop: 20 }}>
          <DataState
            state={pageState === "ready" ? "notFound" : pageState}
            resource={t("fileResource")}
            error={dossierQuery.error}
            onRetry={() => dossierQuery.refetch()}
            title={
              pageState === "notFound" || pageState === "ready"
                ? t("fileNotFound")
                : pageState === "forbidden"
                  ? t("accessDenied")
                  : undefined
            }
            hint={
              pageState === "notFound" || pageState === "ready"
                ? t("fileNotFoundHint")
                : pageState === "forbidden"
                  ? t("accessDeniedHint")
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
            aria-label={t("backToFilesAriaLabel")}
          >
            ←
          </Link>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>
                {t("fileTitle", { ref })}
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
                {statusBadge ? t(statusBadge.labelKey) : t("statusNotRecorded")}
              </span>
            </div>
            {/* Submission date and territory as stored. The record holds no
                supervisor relation (OnefopSubmission.reviewedBy is a bare
                account id, set only once a decision is taken), so none is
                named here. */}
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
              {t("submittedOn", { date: submittedOn })}
              {region ? t("regionSuffix", { region }) : ""}
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
            {t("rejectFormButton")}
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
            {t("requestCorrectionButton")}
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
            {t("validateArchiveButton")}
          </button>
        </div>
      </div>

      {/* A Tableau de bord / Dossiers / Traçabilité pill row sat here. It
          mixed an Administration page (Traçabilité, AUDIT_ROLES only) into
          the Supervision row and left out the hub's other pages. A detail
          page leads back to its list: the back arrow above does that. */}

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
            {t("axis1Title")}
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
            {t("axis2Title")}
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
            {t("axis3Title")}
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
              {t("respondentCardTitle")}
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
                  {t("fullNameLabel")}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                  {recorded(dossier.respondent?.respondentName)}
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
                  {t("functionLabel")}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                  {recorded(dossier.respondent?.respondentFunction)}
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
                  {t("phoneLabel")}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                  {recorded(dossier.respondent?.phone1)}
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
                  {t("emailLabel")}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                  {recorded(dossier.respondent?.email)}
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
              {t("organisationCardTitle")}
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
                  {t("companyNameLabel")}
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
                  {t("headOfficeLabel")}
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
                  {t("sectorLabel")}
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
                  {t("branchLabel")}
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
                  {t("companySizeLabel")}
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
                  {t("permanentEmployeesLabel")}
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
              <span>{section1Title}</span>
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
                      {t("regionOfLocationLabel")}
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
                      {recorded(detail.region ?? dossier.region)}
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
                      {t("departmentLabel")}
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
                      {recorded(detail.department ?? dossier.department)}
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
                      {t("townLabel")}
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
                      {recorded(detail.commune ?? dossier.subdivision)}
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
                      {t("addressLabel")}
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
                      {fact(detail.locality)}
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
                      {t("yearCreatedLabel")}
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
                      {fact(detail.yearCreated ?? detail.yearOfEstablishment ?? dossier.yearOfCreation)}
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
                      {t("legalStatusLabel")}
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
                      {legalStatus(detail.legalStatus)}
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
              <span>{t("section2")}</span>
              <span style={{ fontSize: 14, transform: expandedSection === 2 ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                ⌄
              </span>
            </button>
            {expandedSection === 2 && (
              <div style={{ padding: "20px", borderTop: "1px solid #e5e7eb" }}>
                <DataState
                  dense
                  state="unavailable"
                  resource={t("sectionDataResource")}
                  title={t("sectionDataTitle")}
                  hint={t("sectionDataHint", { tables: SECTION_SOURCES[2].backing })}
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
              <span>{t("section3")}</span>
              <span style={{ fontSize: 14, transform: expandedSection === 3 ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                ⌄
              </span>
            </button>
            {expandedSection === 3 && (
              <div style={{ padding: "20px", borderTop: "1px solid #e5e7eb" }}>
                <DataState
                  dense
                  state="unavailable"
                  resource={t("sectionDataResource")}
                  title={t("sectionDataTitle")}
                  hint={t("sectionDataHint", { tables: SECTION_SOURCES[3].backing })}
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
              <span>{t("section4")}</span>
              <span style={{ fontSize: 14, transform: expandedSection === 4 ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                ⌄
              </span>
            </button>
            {expandedSection === 4 && (
              <div style={{ padding: "20px", borderTop: "1px solid #e5e7eb" }}>
                <DataState
                  dense
                  state="unavailable"
                  resource={t("sectionDataResource")}
                  title={t("sectionDataTitle")}
                  hint={t("sectionDataHint", { tables: SECTION_SOURCES[4].backing })}
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
                  {t("blockingAnomaliesTitle", { count: diag.blockingAnomalies.length })}
                </h3>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151" }}>
                {diag.blockingAnomalies.map((ano, idx) => (
                  <li key={idx} style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, color: "#991b1b" }}>{ano.ruleCode}</span> · {ano.description}
                    <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
                      {t("observedExpected", { observed: String(ano.observedValue ?? "—"), expected: String(ano.expectedValue ?? "—") })}
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
                  {t("coherenceWarningsTitle", { count: diag.warningAnomalies.length })}
                </h3>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151" }}>
                {diag.warningAnomalies.map((ano, idx) => (
                  <li key={idx} style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, color: "#92400e" }}>{ano.ruleCode}</span> · {ano.description}
                    <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
                      {t("observedExpected", { observed: String(ano.observedValue ?? "—"), expected: String(ano.expectedValue ?? "—") })}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diag && (!diag.blockingAnomalies || diag.blockingAnomalies.length === 0) && (!diag.warningAnomalies || diag.warningAnomalies.length === 0) && (
            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "12px 16px", color: "#065f46", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <span>✓</span>
              <span>{t("noAnomalyDetected")}</span>
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
            {t("historyTitle")}
          </h2>
          {canReadAudit && (
            <Link
              href={`/admin/journal-audit?resourceId=${encodeURIComponent(dossier.id)}`}
              style={{ fontSize: 13, fontWeight: 600, color: "#1e6b3a", textDecoration: "none" }}
            >
              {t("auditEventsLink")}
            </Link>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
          {timeline.length === 0 ? (
            <DataState
              dense
              state="empty"
              resource={t("historyResource")}
              title={t("historyEmptyTitle")}
              hint={t("historyEmptyHint")}
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
                  {t("awaitingDecision")}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#b45309", marginTop: 4 }}>
                  {t("noDecisionRecorded")}
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
                  {t("correctionTitle")}
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
                  aria-label={t("closeAriaLabel")}
                >
                  ✕
                </button>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                {t("declarationLine", { ref, name: name ?? "—" })}
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
                  {t("correctionSuccess")}
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
                      {t("correctionSectionLabel")}
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
                      <option value="">{t("selectSection")}</option>
                      <option value={section1Fr}>{section1Title}</option>
                      <option value={SECTION_TITLE_FR[2]}>{t("section2")}</option>
                      <option value={SECTION_TITLE_FR[3]}>{t("section3")}</option>
                      <option value={SECTION_TITLE_FR[4]}>{t("section4")}</option>
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
                      {t("correctionProblemLabel")}
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
                      placeholder={t("correctionProblemPlaceholder")}
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
                      {t("correctionAxisLabel")}
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
                          ? t("axis2Diagnostic", {
                              blocking: count(diag.axis2BlockingCount, locale),
                              warnings: count(diag.axis2WarningCount, locale),
                            })
                          : t("axis2Unavailable", { unavailable: metricUnavailable(locale) })}
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
                      {t("correctionActionLabel")}
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
                    <span>{t("requestDocuments")}</span>
                  </label>

                  {/* Délai de correction accordé */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "#374151" }}>{t("correctionDelayLabel")}</span>
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
                      {CORRECTION_DELAYS.map((delay) => (
                        <option key={delay.value} value={delay.value}>{t(delay.labelKey)}</option>
                      ))}
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
                      <strong>{t("certifyStrong")}</strong> {t("correctionCertifyRest")}
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
                      {t("correctionFailed", { message: (correctionMutation.error as Error)?.message ?? t("unknownError") })}
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
                {t("correctionAudit")}
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
                  {correctionSuccess ? t("closeButton") : tCommon("cancel")}
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
                    {correctionMutation.isPending ? t("sending") : t("confirmReturn")}
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
                {t("validateArchiveButton")}
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                {t("declarationLine", { ref, name: name ?? "—" })}
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
                  {t("approveSuccess")}
                </div>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                    {t("approveBody")}
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
                      {t("approveFailed", { message: (approveMutation.error as Error)?.message ?? t("unknownError") })}
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
                {approveSuccess ? t("closeButton") : tCommon("cancel")}
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
                  {approveMutation.isPending ? t("validating") : t("confirmValidation")}
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
                  {t("rejectFormButton")}
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
                  aria-label={t("closeAriaLabel")}
                >
                  ✕
                </button>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                {t("declarationLine", { ref, name: name ?? "—" })}
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
                  {t("rejectSuccess")}
                </div>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                    {t("rejectBody")}
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
                      {t("rejectReasonLabel")} <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <textarea
                      id="reject-motif"
                      rows={3}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder={t("rejectReasonPlaceholder")}
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
                        {t("reasonTooShort", { length: rejectReason.trim().length })}
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
                      <strong>{t("certifyStrong")}</strong> {t("rejectCertifyRest")}
                    </span>
                  </label>

                  <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>
                    {t("rejectAudit")}
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
                      {t("rejectFailed", { message: (rejectMutation.error as Error)?.message ?? t("unknownError") })}
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
                {rejectSuccess ? t("closeButton") : tCommon("cancel")}
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
                  {rejectMutation.isPending ? t("rejecting") : t("confirmRejection")}
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
