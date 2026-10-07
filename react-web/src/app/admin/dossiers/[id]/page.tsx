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
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminDialog } from "@/components/admin/AdminDialog";
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
import {
  eligibilityAxis,
  endorsementAxis,
  qualityAxis,
  type AxisBadge,
  type AxisTone,
  type DiagnosticState,
} from "@/lib/dossier-axes";

// Badge colours per tone for the three-axis strip (lib/dossier-axes.ts).
// Axis verdict -> .cam-dossier-pill modifier. `neutral` keeps the base pill
// with no modifier: it is the absence of a verdict (the diagnostic could not
// be read, or the axis does not apply), not a fourth kind of verdict.
const AXIS_PILL: Record<AxisTone, string> = {
  success: "cam-dossier-pill--ok",
  warning: "cam-dossier-pill--warn",
  error: "cam-dossier-pill--error",
  neutral: "",
};

/**
 * Administrative status of the dossier, exactly as stored.
 *
 * `null` (no status on the record) is its own case: it is reported, never
 * folded into "en instance".
 */
// `labelKey` is under adminDossierPage; `variant` is an AdminStatusBadge
// tone, so the badge follows the tokens instead of a copy of their values.
// A status absent from this map is NOT folded into any of the four: it keeps
// its own branch at the call site (see `statusBadge` below).
const STATUS_BADGES: Record<string, { labelKey: string; variant: "pending" | "validated" | "correction" | "rejected" }> = {
  PENDING_REVIEW: { labelKey: "statusPending", variant: "pending" },
  APPROVED: { labelKey: "statusEndorsed", variant: "validated" },
  CORRECTION_REQUESTED: { labelKey: "statusCorrection", variant: "correction" },
  REJECTED: { labelKey: "statusRejected", variant: "rejected" },
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
  const tRoot = useTranslations();
  // Supervision > Dossiers > (this dossier). The hub and route labels are
  // the sidebar's own keys, so the trail cannot drift from the nav.
  const breadcrumb = [
    { label: tRoot("adminNav.hubs.supervision") },
    { label: tRoot("adminNav.routes.dossiers"), href: "/admin/dossiers" },
  ];
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
  // The strip's badges are the records' own values; a diagnostic that failed
  // to load reads as "not available", never as a figure.
  const diagnosticState: DiagnosticState = diagnosticQuery.isLoading
    ? "loading"
    : diagnosticQuery.isError || !diag
      ? "unavailable"
      : "ready";
  const axisBadge = (badge: AxisBadge) => (
    <span className={`cam-dossier-pill ${AXIS_PILL[badge.tone]}`.trimEnd()}>
      {t(badge.key, badge.values)}
    </span>
  );
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
    const steps: Array<{ key: string; title: string; detail: string | null; stamp: string; dot: string }> = [];

    if (dossier.submissionDate) {
      steps.push({
        key: "submitted",
        title: t("timelineReceived"),
        detail: dossier.quarterCode ? t("timelineCampaign", { code: dossier.quarterCode }) : null,
        stamp: stamp(dossier.submissionDate, true, locale),
        dot: "",
      });
    }

    if (dossier.reviewedAt) {
      const decision =
        dossier.status === "APPROVED"
          ? { title: t("timelineEndorsed"), dot: "" }
          : dossier.status === "REJECTED"
            ? { title: t("timelineRejected"), dot: "is-rejected" }
            : dossier.status === "CORRECTION_REQUESTED"
              ? { title: t("timelineCorrection"), dot: "is-current" }
              : { title: t("timelineDecision"), dot: "" };
      steps.push({
        key: "reviewed",
        title: decision.title,
        detail: dossier.rejectionReason ?? null,
        stamp: stamp(dossier.reviewedAt, true, locale),
        dot: decision.dot,
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
      <div className="cam-admin-page">
        <AdminPageHeader
          breadcrumb={breadcrumb}
          backHref="/admin/dossiers"
          title={t("fileTitle", { ref: id })}
        />
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
    );
  }

  return (
    <div className="cam-admin-page">
      {/* Header, status badge and the three decision actions. The page used to
          hand-build an <h1>, a back arrow and a status pill here, which is why
          it was the one screen in the console with no shared chrome at all;
          admin/layout.tsx already excludes this route from its own fallback
          header, so none of that needed re-adding. */}
      <AdminPageHeader
        breadcrumb={breadcrumb}
        backHref="/admin/dossiers"
        title={t("fileTitle", { ref })}
        subtitle={`${t("submittedOn", { date: submittedOn })}${region ? t("regionSuffix", { region }) : ""}${dossier.department ? ` / ${dossier.department}` : ""}`}
        statusBadge={{
          // A record with no stored status says so, in its own neutral tone,
          // rather than defaulting into "en attente".
          label: statusBadge ? t(statusBadge.labelKey) : t("statusNotRecorded"),
          variant: statusBadge ? statusBadge.variant : "neutral",
        }}
        actions={
          <>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={openRejectModal}>
              {t("rejectFormButton")}
            </button>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={openCorrectionModal}>
              {t("requestCorrectionButton")}
            </button>
            <button type="button" className="cam-button cam-button-primary cam-button-sm" onClick={openApproveModal}>
              {t("validateArchiveButton")}
            </button>
          </>
        }
      />

      {/* A Tableau de bord / Dossiers / Tracabilite pill row sat here. It
          mixed an Administration page (Tracabilite, AUDIT_ROLES only) into
          the Supervision row and left out the hub's other pages. A detail
          page leads back to its list: the back arrow above does that. */}

      {/* 3-axis diagnostic strip: each badge is read from the dossier or its
          diagnostic (lib/dossier-axes.ts). The strip's left edge followed a
          fixed amber; .cam-dossier-axes carries is-approved / is-rejected, so
          it now follows the dossier's own decision. */}
      <div
        className={`cam-dossier-axes${
          dossier.status === "APPROVED" ? " is-approved" : dossier.status === "REJECTED" ? " is-rejected" : ""
        }`}
      >
        <div className="cam-dossier-axis">
          <p className="cam-dossier-label">{t("axis1Title")}</p>
          {axisBadge(endorsementAxis(dossier.status))}
        </div>
        <div className="cam-dossier-axis">
          <p className="cam-dossier-label">{t("axis2Title")}</p>
          {axisBadge(qualityAxis(diagnosticState, diag))}
        </div>
        <div className="cam-dossier-axis">
          <p className="cam-dossier-label">{t("axis3Title")}</p>
          {axisBadge(eligibilityAxis(diagnosticState, diag))}
        </div>
      </div>

      <div className="cam-dossier-grid" style={{ marginTop: "var(--cam-space-5)" }}>
        {/* Left: respondent and structure, as stored */}
        <div className="cam-dash-column">
          <section className="cam-dash-card">
            <h2 className="cam-dossier-card-title">{t("respondentCardTitle")}</h2>
            {/* Submission date and territory as stored. The record holds no
                supervisor relation (OnefopSubmission.reviewedBy is a bare
                account id, set only once a decision is taken), so none is
                named here. */}
            <dl className="cam-dossier-fields">
              <div>
                <dt>{t("fullNameLabel")}</dt>
                <dd>{recorded(dossier.respondent?.respondentName)}</dd>
              </div>
              <div>
                <dt>{t("functionLabel")}</dt>
                <dd>{recorded(dossier.respondent?.respondentFunction)}</dd>
              </div>
              <div>
                <dt>{t("phoneLabel")}</dt>
                <dd>{recorded(dossier.respondent?.phone1)}</dd>
              </div>
              <div>
                <dt>{t("emailLabel")}</dt>
                <dd>{recorded(dossier.respondent?.email)}</dd>
              </div>
            </dl>
          </section>

          <section className="cam-dash-card">
            <h2 className="cam-dossier-card-title">{t("organisationCardTitle")}</h2>
            <dl className="cam-dossier-fields">
              <div>
                <dt>{t("companyNameLabel")}</dt>
                <dd>{fact(detail.companyName)}</dd>
              </div>
              <div>
                <dt>{t("headOfficeLabel")}</dt>
                <dd>{fact(detail.headOffice)}</dd>
              </div>
              <div>
                <dt>{t("sectorLabel")}</dt>
                <dd>{fact(detail.sector)}</dd>
              </div>
              <div>
                <dt>{t("branchLabel")}</dt>
                <dd>{fact(detail.branch)}</dd>
              </div>
              <div>
                <dt>{t("companySizeLabel")}</dt>
                <dd>{fact(detail.enterpriseSize)}</dd>
              </div>
              <div>
                <dt>{t("permanentEmployeesLabel")}</dt>
                <dd>{fact(detail.permanentWorkers)}</dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Right: the four questionnaire sections, as native disclosures.
            These were <button>-driven divs; <details>/<summary> is what
            .cam-dossier-section styles, and it carries the open state,
            keyboard behaviour and the expanded/collapsed announcement that
            the hand-built version did not. One open at a time is preserved
            through `expandedSection`. */}
        <div className="cam-dash-column" style={{ gap: "var(--cam-space-3)" }}>
          <details
            className="cam-dossier-section"
            open={expandedSection === 1}
            onToggle={(e) => {
              // React closing a sibling fires that sibling's toggle with
              // open === false; without this guard it would clear the
              // section the reader just opened.
              if (e.currentTarget.open) setExpandedSection(1);
              else setExpandedSection((cur) => (cur === 1 ? null : cur));
            }}
          >
            <summary>{section1Title}</summary>
            <div className="cam-dossier-section-body">
              <dl className="cam-dossier-fields cam-dossier-fields--two">
                <div>
                  <dt>{t("regionOfLocationLabel")}</dt>
                  <dd>{recorded(detail.region ?? dossier.region)}</dd>
                </div>
                <div>
                  <dt>{t("departmentLabel")}</dt>
                  <dd>{recorded(detail.department ?? dossier.department)}</dd>
                </div>
                <div>
                  <dt>{t("townLabel")}</dt>
                  <dd>{recorded(detail.commune ?? dossier.subdivision)}</dd>
                </div>
                <div>
                  <dt>{t("addressLabel")}</dt>
                  <dd>{fact(detail.locality)}</dd>
                </div>
                <div>
                  <dt>{t("yearCreatedLabel")}</dt>
                  <dd>{fact(detail.yearCreated ?? detail.yearOfEstablishment ?? dossier.yearOfCreation)}</dd>
                </div>
                <div>
                  <dt>{t("legalStatusLabel")}</dt>
                  <dd>{legalStatus(detail.legalStatus)}</dd>
                </div>
              </dl>
            </div>
          </details>

          {([2, 3, 4] as const).map((n) => (
            <details
              key={n}
              className="cam-dossier-section"
              open={expandedSection === n}
              onToggle={(e) => {
                if (e.currentTarget.open) setExpandedSection(n);
                else setExpandedSection((cur) => (cur === n ? null : cur));
              }}
            >
              <summary>{t(`section${n}`)}</summary>
              <div className="cam-dossier-section-body">
                <DataState
                  dense
                  state="unavailable"
                  resource={t("sectionDataResource")}
                  title={t("sectionDataTitle")}
                  hint={t("sectionDataHint", { tables: SECTION_SOURCES[n].backing })}
                />
              </div>
            </details>
          ))}

          {/* Retained quality anomalies and alerts */}
          {diag && diag.blockingAnomalies && diag.blockingAnomalies.length > 0 && (
            <section className="cam-dash-card">
              <h3 className="cam-dossier-card-title">
                {t("blockingAnomaliesTitle", { count: diag.blockingAnomalies.length })}
              </h3>
              <ul className="cam-admin-issues" style={{ marginTop: "var(--cam-space-4)" }}>
                {diag.blockingAnomalies.map((ano, idx) => (
                  <li key={idx}>
                    <span className="cam-admin-issue-code">{ano.ruleCode}</span> &middot; {ano.description}
                    <p className="cam-admin-meta" style={{ margin: 0 }}>
                      {t("observedExpected", { observed: String(ano.observedValue ?? "\u2014"), expected: String(ano.expectedValue ?? "\u2014") })}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {diag && diag.warningAnomalies && diag.warningAnomalies.length > 0 && (
            <section className="cam-dash-card">
              <h3 className="cam-dossier-card-title">
                {t("coherenceWarningsTitle", { count: diag.warningAnomalies.length })}
              </h3>
              <ul className="cam-admin-issues is-warn" style={{ marginTop: "var(--cam-space-4)" }}>
                {diag.warningAnomalies.map((ano, idx) => (
                  <li key={idx}>
                    <span className="cam-admin-issue-code">{ano.ruleCode}</span> &middot; {ano.description}
                    <p className="cam-admin-meta" style={{ margin: 0 }}>
                      {t("observedExpected", { observed: String(ano.observedValue ?? "\u2014"), expected: String(ano.expectedValue ?? "\u2014") })}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {diag && (!diag.blockingAnomalies || diag.blockingAnomalies.length === 0) && (!diag.warningAnomalies || diag.warningAnomalies.length === 0) && (
            <p className="cam-admin-notice cam-admin-notice--success">{t("noAnomalyDetected")}</p>
          )}
        </div>
      </div>

      {/* Instruction history. Built only from timestamps stored on the
          dossier:
            - submissionDate  -> reception by the central server
            - reviewedAt      -> the administrative decision, labelled by the
                                 stored status (visa / rejet / correction)
            - rejectionReason -> the recorded motive, when there is one
          No step is shown for a timestamp the record does not carry, and no
          actor is named: `reviewedBy` holds a bare account id, and the named
          history of who did what lives in the audit journal, which is linked
          rather than reconstructed here. */}
      <section className="cam-admin-section" style={{ marginTop: "var(--cam-space-5)" }}>
        <div className="cam-admin-section-head">
          <h2 className="cam-admin-h2">{t("historyTitle")}</h2>
          {canReadAudit && (
            <Link
              href={`/admin/journal-audit?resourceId=${encodeURIComponent(dossier.id)}`}
              className="cam-text-button"
            >
              {t("auditEventsLink")}
            </Link>
          )}
        </div>
        <div className="cam-admin-section-body">
          {timeline.length === 0 && dossier.status !== "PENDING_REVIEW" ? (
            <DataState
              dense
              state="empty"
              resource={t("historyResource")}
              title={t("historyEmptyTitle")}
              hint={t("historyEmptyHint")}
            />
          ) : (
            <ul className="cam-dossier-history">
              {timeline.map((step) => (
                <li key={step.key}>
                  <span className={`cam-dossier-history-dot ${step.dot}`.trimEnd()} aria-hidden="true" />
                  <div>
                    <strong>{step.title}</strong>
                    {step.detail && <p className="cam-dossier-note">{step.detail}</p>}
                    <p className="cam-dossier-note">{step.stamp}</p>
                  </div>
                </li>
              ))}
              {/* Pending states are shown as pending, with no predicted approver. */}
              {dossier.status === "PENDING_REVIEW" && (
                <li>
                  <span className="cam-dossier-history-dot is-current" aria-hidden="true" />
                  <div>
                    <strong>{t("awaitingDecision")}</strong>
                    <p className="cam-dossier-note">{t("noDecisionRecorded")}</p>
                  </div>
                </li>
              )}
            </ul>
          )}
        </div>
      </section>

      {/* Retour pour correction. The three overlays this page carried each
          declared aria-modal="true" with no focus trap, no Escape handler and
          no focus return; AdminDialog is a native <dialog>, so showModal()
          provides all three. */}
      <AdminDialog
        open={isCorrectionOpen}
        onClose={() => setIsCorrectionOpen(false)}
        title={t("correctionTitle")}
        eyebrow={t("declarationLine", { ref, name: name ?? "\u2014" })}
        footer={
          <>
            <span className="cam-admin-meta" style={{ marginInlineEnd: "auto" }}>{t("correctionAudit")}</span>
            <button
              type="button"
              className="cam-button cam-button-secondary cam-button-sm"
              onClick={() => setIsCorrectionOpen(false)}
            >
              {correctionSuccess ? t("closeButton") : tCommon("cancel")}
            </button>
            {!correctionSuccess && (
              <button
                type="button"
                className="cam-button cam-button-primary cam-button-sm"
                onClick={() => correctionMutation.mutate()}
                disabled={
                  correctionMutation.isPending ||
                  !certifiedCorrection ||
                  !correctionAction.trim() ||
                  !correctionProblem.trim()
                }
              >
                {correctionMutation.isPending ? t("sending") : t("confirmReturn")}
              </button>
            )}
          </>
        }
      >
        {correctionSuccess ? (
          <p className="cam-admin-notice cam-admin-notice--success">{t("correctionSuccess")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="modal-correction-section">
                {t("correctionSectionLabel")}
              </label>
              <select
                id="modal-correction-section"
                className="cam-select"
                value={correctionSection}
                onChange={(e) => setCorrectionSection(e.target.value)}
              >
                <option value="">{t("selectSection")}</option>
                {/* The value is the canonical French AST title, because it is
                    stored in the correction comment -- the official record
                    sent to the respondent. Only the label follows the locale. */}
                <option value={section1Fr}>{section1Title}</option>
                <option value={SECTION_TITLE_FR[2]}>{t("section2")}</option>
                <option value={SECTION_TITLE_FR[3]}>{t("section3")}</option>
                <option value={SECTION_TITLE_FR[4]}>{t("section4")}</option>
              </select>
            </div>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="modal-correction-problem">
                {t("correctionProblemLabel")}
              </label>
              {/* Written by the reviewer. Nothing is pre-filled: this text is
                  persisted with the dossier and sent to the respondent, so a
                  prepared statement about figures the dossier may not contain
                  would become a real administrative finding. */}
              <textarea
                id="modal-correction-problem"
                className="cam-admin-textarea"
                rows={3}
                value={correctionProblem}
                onChange={(e) => setCorrectionProblem(e.target.value)}
                placeholder={t("correctionProblemPlaceholder")}
              />
            </div>

            <div className="cam-field">
              <p className="cam-admin-label" style={{ margin: 0 }}>{t("correctionAxisLabel")}</p>
              {/* Source: GET /admin/questionnaires/:id/diagnostic --
                  axis2BlockingCount / axis2WarningCount as computed by
                  EligibilityEngineService. Reported as "non disponible" when
                  the diagnostic could not be read. */}
              <p className="cam-dossier-note">
                {diag
                  ? t("axis2Diagnostic", {
                      blocking: count(diag.axis2BlockingCount, locale),
                      warnings: count(diag.axis2WarningCount, locale),
                    })
                  : t("axis2Unavailable", { unavailable: metricUnavailable(locale) })}
              </p>
            </div>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="modal-correction-action">
                {t("correctionActionLabel")}
              </label>
              <textarea
                id="modal-correction-action"
                className="cam-admin-textarea"
                rows={3}
                value={correctionAction}
                onChange={(e) => setCorrectionAction(e.target.value)}
              />
            </div>

            <label className="cam-admin-choice">
              <input
                type="checkbox"
                checked={requireJustificatifs}
                onChange={(e) => setRequireJustificatifs(e.target.checked)}
              />
              <span>{t("requestDocuments")}</span>
            </label>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="modal-correction-delay">
                {t("correctionDelayLabel")}
              </label>
              <select
                id="modal-correction-delay"
                className="cam-select"
                value={correctionDelay}
                onChange={(e) => setCorrectionDelay(e.target.value)}
              >
                {/* As above: the value is the French text stored in the
                    comment; the label is translated. */}
                {CORRECTION_DELAYS.map((delay) => (
                  <option key={delay.value} value={delay.value}>{t(delay.labelKey)}</option>
                ))}
              </select>
            </div>

            <label className="cam-admin-choice">
              <input
                type="checkbox"
                checked={certifiedCorrection}
                onChange={(e) => setCertifiedCorrection(e.target.checked)}
              />
              <span>
                <strong>{t("certifyStrong")}</strong> {t("correctionCertifyRest")}
              </span>
            </label>

            {correctionMutation.isError && (
              <div role="alert" className="cam-admin-notice cam-admin-notice--error">
                {t("correctionFailed", { message: (correctionMutation.error as Error)?.message ?? t("unknownError") })}
              </div>
            )}
          </div>
        )}
      </AdminDialog>

      {/* Valider et archiver */}
      <AdminDialog
        open={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        title={t("validateArchiveButton")}
        eyebrow={t("declarationLine", { ref, name: name ?? "\u2014" })}
        footer={
          <>
            <button
              type="button"
              className="cam-button cam-button-secondary cam-button-sm"
              onClick={() => setIsApproveOpen(false)}
            >
              {approveSuccess ? t("closeButton") : tCommon("cancel")}
            </button>
            {!approveSuccess && (
              <button
                type="button"
                className="cam-button cam-button-primary cam-button-sm"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? t("validating") : t("confirmValidation")}
              </button>
            )}
          </>
        }
      >
        {approveSuccess ? (
          <p className="cam-admin-notice cam-admin-notice--success">{t("approveSuccess")}</p>
        ) : (
          <>
            <p style={{ margin: 0 }}>{t("approveBody")}</p>
            {approveMutation.isError && (
              <div role="alert" className="cam-admin-notice cam-admin-notice--error" style={{ marginTop: "var(--cam-space-3)" }}>
                {t("approveFailed", { message: (approveMutation.error as Error)?.message ?? t("unknownError") })}
              </div>
            )}
          </>
        )}
      </AdminDialog>

      {/* Rejeter (retained action) */}
      <AdminDialog
        open={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        title={t("rejectFormButton")}
        eyebrow={t("declarationLine", { ref, name: name ?? "\u2014" })}
        footer={
          <>
            <button
              type="button"
              className="cam-button cam-button-secondary cam-button-sm"
              onClick={() => setIsRejectOpen(false)}
            >
              {rejectSuccess ? t("closeButton") : tCommon("cancel")}
            </button>
            {!rejectSuccess && (
              <button
                type="button"
                className="cam-button cam-button-danger cam-button-sm"
                onClick={() => rejectMutation.mutate()}
                disabled={!certifiedReject || rejectReason.trim().length < 10 || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? t("rejecting") : t("confirmRejection")}
              </button>
            )}
          </>
        }
      >
        {rejectSuccess ? (
          <p className="cam-admin-notice cam-admin-notice--error">{t("rejectSuccess")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
            <p style={{ margin: 0 }}>{t("rejectBody")}</p>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="reject-motif">
                {t("rejectReasonLabel")} <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="reject-motif"
                className="cam-admin-textarea"
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("rejectReasonPlaceholder")}
              />
              {rejectReason.trim().length > 0 && rejectReason.trim().length < 10 && (
                <p className="cam-field-error" style={{ margin: "var(--cam-space-1) 0 0" }}>
                  {t("reasonTooShort", { length: rejectReason.trim().length })}
                </p>
              )}
            </div>

            <label className="cam-admin-choice">
              <input
                type="checkbox"
                checked={certifiedReject}
                onChange={(e) => setCertifiedReject(e.target.checked)}
              />
              <span>
                <strong>{t("certifyStrong")}</strong> {t("rejectCertifyRest")}
              </span>
            </label>

            <p className="cam-admin-meta" style={{ margin: 0 }}>{t("rejectAudit")}</p>

            {rejectMutation.isError && (
              <div role="alert" className="cam-admin-notice cam-admin-notice--error">
                {t("rejectFailed", { message: (rejectMutation.error as Error)?.message ?? t("unknownError") })}
              </div>
            )}
          </div>
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
