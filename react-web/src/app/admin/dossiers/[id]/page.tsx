"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  getAdminDossier,
  getDossierDiagnostic,
  getDossierClaimState,
  getDossierNeighbours,
  listDossierReviewProgress,
  approveDossier,
  rejectDossier,
  requestCorrectionDossier,
  reopenDossierForCorrection,
  type AdminDossier,
} from "@/lib/api-client";
import { DataState } from "@/components/admin/DataState";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPageHeader";
import { resolveDossierReturnTo } from "@/lib/admin-return";
import { dossierNeighbourQuery } from "@/lib/dossier-neighbour-query";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { Textarea } from "@/components/ui/textarea";
import { DossierClaimPanel, dossierReviewProgressKey } from "@/components/admin/DossierClaimPanel";
import { mergeDossierHistory, type DossierHistoryEntry } from "@/lib/dossier-history";
import { groupDossierFindings, mergeSameRule } from "@/lib/dossier-findings";
import { findingTargets, placeFindings, sectionFlagCount } from "@/lib/finding-targets";
import { PlacedFlagNotice } from "@/components/admin/DossierAnswerSections";
import { ExplainFindingAction, ExplainedFindings, RecheckCoherenceAction, explainedFindingsKey, useExplainedFindings } from "@/components/admin/DossierExplainFinding";
import { FindingCompare, VtFindingCompare } from "@/components/admin/DossierFindingFigures";
import { vtFindingFigures, type VtFigure } from "@/lib/vt-finding-figures";
import { AnomalyNumber, CoherenceProvider, type AnomalyMarker } from "@/components/onefop/coherence/Coherence";
import { reviewCellChecks, sameRule } from "@/lib/dossier-cell-checks";
import type { FormData } from "@/lib/onefop-schema";
import { ruleFamilyLabel } from "@/lib/anomaly-registry";
import { dossierClaimStateKey, useDossierClaim } from "@/lib/use-dossier-claim";
import { DossierVtSections } from "@/components/admin/DossierVtSections";
import { DossierAnswerSections } from "@/components/admin/DossierAnswerSections";
import { useAuthStore } from "@/lib/auth-store";
import { AUDIT_ROLES, SURVEY_ROLES, hasRole, isReadOnlyRole } from "@/lib/roles";
import { isActiveDossierClaimOwner } from "@/lib/dossier-review-state";
import { DossierBarClaim } from "@/components/admin/DossierBarClaim";
import { useOnefopSchema } from "@/lib/use-onefop-schema";
import {
  detailAnswerValue,
  dossierEntity,
  dossierEntityKey,
  dossierSections,
  dossierSectionState,
  questionnaireAsks,
} from "@/lib/dossier-sections";
import { coherenceWarningText } from "@/lib/coherence-warning-text";
import {
  NOT_PROVIDED,
  count,
  fact,
  metricUnavailable,
  notRecorded,
  resolveDataState,
  shortRecordId,
  stamp,
} from "@/lib/admin-data-state";
import { referencePeriodKind, referencePeriodPhrases } from "@/lib/onefop-period-label";
import { withCampaignPeriod } from "@/lib/campaign-period";
import { asUiLocale } from "@/lib/register-i18n";
import { respondentFunctionLabel } from "@/lib/display-labels";
import {
  allowedDecisions,
  canReopenForCorrection,
  eligibilityAxis,
  qualityAxis,
  type AxisBadge,
  type AxisTone,
  type DiagnosticState,
} from "@/lib/dossier-axes";

// An anomaly's observed/expected pair is worth a line only when it carries a
// figure. The coherence checks store "Incohérence détectée" / "Égalité
// requise", which repeated under every alert and said nothing the
// description (which has the numbers) does not.
function hasFigures(observed: unknown, expected: unknown): boolean {
  return /\d/.test(String(observed ?? "")) || /\d/.test(String(expected ?? ""));
}

// The 8.8 staff list names people. The server sends it to these two roles
// only (src/questionnaires/staff-names.ts, §21); the page uses the same list
// to say why the table is withheld rather than call it empty.
const STAFF_NAME_ROLES = ["SUPER_ADMIN", "ADMIN_ONEFOP", "ADMIN_ONEFOP_SUBMISSIONS"];

// An axis verdict in the rail is a line of text (lib/dossier-axes.ts). Only an
// error is coloured: a badge beside the bar's status badge read as a second
// status, and colour on every line said nothing.
const AXIS_TEXT_CLASS: Record<AxisTone, string> = {
  success: "cam-dossier-axis-text",
  warning: "cam-dossier-axis-text",
  error: "cam-dossier-axis-text is-error",
  neutral: "cam-dossier-axis-text",
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
 * A file replaced by a newer submission (SUPERSEDED, owner 2026-10-16) is
 * closed: no decision is offered, and the header says so with a link to the
 * file that replaced it, whatever the reader's role.
 */
function supersededNotice(dossier: AdminDossier, t: (key: string) => string) {
  if (dossier.status !== "SUPERSEDED") return null;
  return (
    <>
      <span className="cam-admin-meta">{t("supersededLine")}</span>
      {dossier.supersededById && (
        <Link
          href={`/admin/dossiers/${encodeURIComponent(dossier.supersededById)}`}
          className="cam-button cam-button-secondary cam-button-sm"
        >
          {t("openReplacingFile")}
        </Link>
      )}
    </>
  );
}

// Section headings, and which sections exist at all, are read from the
// generated schema for the file's own entity type (lib/dossier-sections.ts).
// They used to be a single hardcoded list — the enterprise family's — shown
// for every type but VT, so a project/programme file was headed with three
// enterprise sections its questionnaire does not have, and the
// correction-request dialog offered them (B3 of
// docs/audit/e2e-2026-10-17-project-enterprise.md).
//
// GET /admin/questionnaires/:id returns rawData (the respondent's answers)
// but not the statistical child tables, and mapping those onto the classic
// templates' headings is a statistical-semantics decision owned by the ONEFOP
// domain and the canonical AST — not something the admin UI may improvise.
// Until that mapping is specified and reviewed, each section past the first
// states that its figures are not rendered here rather than printing numbers.
// See docs/admin-data-integrity-inventory.md.

/** Correction deadlines: the value is the French text stored in the comment. */
const CORRECTION_DELAYS: { value: string; labelKey: string }[] = [
  { value: "3 jours ouvrables", labelKey: "delay3" },
  { value: "7 jours ouvrables", labelKey: "delay7" },
  { value: "15 jours ouvrables", labelKey: "delay15" },
  { value: "30 jours calendaires", labelKey: "delay30" },
];

type Detail = Record<string, unknown>;

function isStaleRevision(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

// The structure card's fields, per structure type, in reading order. Each
// type has its own detail record (Onefop*Detail in prisma/schema.prisma);
// the card used to read the enterprise fields for every type, so a training
// centre showed six empty company fields. Labels: adminDossierPage.structureField.
const STRUCTURE_FIELDS: { detail: keyof AdminDossier; fields: string[] }[] = [
  { detail: "enterpriseDetail", fields: ["companyName", "headOffice", "sector", "branch", "enterpriseSize", "permanentWorkers"] },
  { detail: "cooperativeDetail", fields: ["cooperativeName", "cooperativeType", "headOffice", "yearCreated", "sector", "permanentWorkers"] },
  { detail: "ctdDetail", fields: ["ctdType", "councilType", "yearCreated", "sector", "permanentWorkers"] },
  { detail: "ongDetail", fields: ["ongName", "headOffice", "yearCreated", "mainMission", "permanentWorkers"] },
  { detail: "administrationDetail", fields: ["name", "sigle", "mainMission", "sector"] },
  { detail: "projectProgramDetail", fields: ["name", "sigle", "nature", "supervisingMinistry", "personInCharge", "permanentWorkers"] },
  { detail: "vocationalTrainingDetail", fields: ["name", "sigle", "cfpType", "educationSystem", "functionalStatus", "yearOfEstablishment", "promoterName", "accreditationOrderNumber"] },
];

// VT stores an option as its bilingual label, "fr/ en" ("Fonctionnelle/
// Functional"); the reviewer reads the half in the interface language. The
// separator is "/ " (slash then space), so "SAR/SM/ RA/HECs" splits in two.
function localHalf(value: string, locale: "fr" | "en"): string {
  const parts = value.split("/ ");
  return parts.length === 2 ? parts[locale === "en" ? 1 : 0].trim() : value;
}

/** The structure fields this dossier actually carries, as [field, value]; never invented. */
function structureFacts(d: AdminDossier): [string, string][] {
  const entry = STRUCTURE_FIELDS.find((e) => d[e.detail]);
  if (!entry) return [];
  const rec = d[entry.detail] as Record<string, unknown>;
  return entry.fields
    .map((f): [string, string] => [f, rec[f] == null ? "" : String(rec[f]).trim()])
    .filter(([, v]) => v !== "");
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
  const searchParams = useSearchParams();
  const includeArchived = searchParams.get("includeArchived") === "true";
  const returnTo = resolveDossierReturnTo(searchParams.get("returnTo"));
  const isQueueMove = searchParams.get("reviewMove") === "1";
  // No default id: without one there is no dossier to show, and substituting a
  // known identifier would load someone else's record.
  const id = typeof params.id === "string" ? params.id : "";

  const queryClient = useQueryClient();
  const t = useTranslations("adminDossierPage");
  const tCommon = useTranslations("common");
  const tRoot = useTranslations();
  // Overview > Submission review > (this dossier). The hub and route labels are
  // the sidebar's own keys, so the trail cannot drift from the nav.
  const breadcrumb = [
    { label: tRoot("adminNav.hubs.teledeclarations") },
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
  // Central agents consult a dossier; approve, reject and request
  // correction are not offered (and are refused server-side).
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id);
  const readOnly = isReadOnlyRole(role) || searchParams.get("readOnly") === "true";
  const neighbourQuery = dossierNeighbourQuery(returnTo, readOnly);
  const canSeeStaffNames = typeof role === "string" && STAFF_NAME_ROLES.includes(role);

  const dossierQuery = useQuery({
    queryKey: ["admin", "dossier", id, includeArchived],
    queryFn: () => getAdminDossier(id, includeArchived),
    retry: false,
    ...(isQueueMove ? { staleTime: 0, refetchOnMount: "always" as const } : {}),
  });

  const claimStateQuery = useQuery({
    queryKey: dossierClaimStateKey(id),
    queryFn: () => getDossierClaimState(id),
    enabled: Boolean(id),
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
    ...(isQueueMove ? { refetchOnMount: "always" as const } : {}),
  });

  const diagnosticQuery = useQuery({
    queryKey: ["admin", "diagnostic", id, includeArchived],
    queryFn: () => getDossierDiagnostic(id, includeArchived),
    retry: false,
    ...(isQueueMove ? { staleTime: 0, refetchOnMount: "always" as const } : {}),
  });

  const progressQuery = useQuery({
    queryKey: dossierReviewProgressKey(id),
    queryFn: () => listDossierReviewProgress(id),
    enabled: Boolean(id),
  });

  const neighboursQuery = useQuery({
    queryKey: ["admin", "dossier-neighbours", id, neighbourQuery.filters],
    queryFn: () => getDossierNeighbours(id, neighbourQuery.filters),
    enabled: Boolean(id) && neighbourQuery.view !== null,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Opened from the reference on the respondent's receipt (its submissionId,
  // which the API also resolves): continue under the dossier's own id, the one
  // every action and link on this page uses (F12).
  const router = useRouter();
  const canonicalId = dossierQuery.data?.id;
  useEffect(() => {
    if (canonicalId && canonicalId !== id) router.replace(`/admin/dossiers/${encodeURIComponent(canonicalId)}`);
  }, [canonicalId, id, router]);

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
  const claimState = claimStateQuery.data;
  const shouldOpenApprove = searchParams.get("openApprove") === "1";
  const shouldOpenCorrection = searchParams.get("openCorrection") === "1";
  const shouldOpenReject = searchParams.get("openReject") === "1";
  const focusVerify = searchParams.get("focus") === "verify";
  // The strip's badges are the records' own values; a diagnostic that failed
  // to load reads as "not available", never as a figure.
  const diagnosticState: DiagnosticState = diagnosticQuery.isLoading
    ? "loading"
    : diagnosticQuery.isError || !diag
      ? "unavailable"
      : "ready";
  const axisText = (badge: AxisBadge) => (
    <span className={AXIS_TEXT_CLASS[badge.tone]}>{t(badge.key, badge.values)}</span>
  );
  const detail: Detail = dossier ? entityDetail(dossier) : {};
  const structure = dossier ? structureFacts(dossier) : [];

  const pageState = resolveDataState({
    isLoading: dossierQuery.isLoading,
    isError: dossierQuery.isError,
    error: dossierQuery.error,
  });

  // Every header fact below is the stored value or the neutral marker.
  const name = entityName(detail);
  const ref = dossier?.submissionId ?? id;
  const submittedOn = stamp(dossier?.submissionDate, true, locale);
  const region = dossier?.region ?? null;
  const statusBadge = dossier?.status ? STATUS_BADGES[dossier.status] ?? null : null;
  const statusLabel = statusBadge
    ? t(statusBadge.labelKey)
    : dossier?.status === "SUPERSEDED"
      ? t("statusSuperseded")
      : t("statusNotRecorded");
  const decisions = allowedDecisions(dossier?.status);
  const hasActiveClaim = isActiveDossierClaimOwner(claimState, userId);
  const canReviewDossier = hasRole(role, SURVEY_ROLES) && hasActiveClaim;
  // A background refetch (window focus, the claim's 60 s refresh) disables
  // the decisions rather than hiding them, so the bar never jumps under the
  // cursor; the server's revision check stays the real guard.
  // A background refresh (window focus, the claim's periodic check) leaves the
  // decisions usable: greying them out made the bar flicker every time the
  // reviewer came back to the window. The server's revision check refuses a
  // decision taken on a stale file, and the page then reloads it.
  const { claimStateQuery: barClaimQuery, claimMutation, actionNotice: claimActionNotice } = useDossierClaim(id);
  // The decision in words where the buttons were, dated when the server
  // recorded the review date; without a date the status badge already says it.
  const decidedOn = dossier?.reviewedAt ? stamp(dossier.reviewedAt, true, locale) : null;
  const decidedLine = !decidedOn
    ? null
    : dossier?.status === "APPROVED"
      ? t("decisionApprovedOn", { date: decidedOn })
      : dossier?.status === "REJECTED"
        ? t("decisionRejectedOn", { date: decidedOn })
        : dossier?.status === "CORRECTION_REQUESTED"
          ? t("awaitingRespondent", { date: decidedOn })
          : null;
  const formType = dossier?.formType ?? "";

  // A VT file is shown section by section from the schema and the
  // respondent's data (components/admin/DossierVtSections.tsx). The schema is
  // a static file, fetched once and cached.
  const isVt = formType === "VOCATIONAL_TRAINING";
  const schemaQuery = useOnefopSchema();
  // The reviewer reads the same question the respondent answered: the AST's
  // placeholder date becomes the file's own round, named
  // (« au cours du trimestre » — lib/campaign-period.ts). The round's code
  // is enough to name its kind, so the file's period bounds are not needed
  // here. A code that names no kind is left alone: the schema's own wording
  // beats a period this page cannot state.
  const reviewedSchema = useMemo(() => {
    if (!schemaQuery.data) return undefined;
    const code = dossier?.quarterCode ?? null;
    if (!referencePeriodKind(code)) return schemaQuery.data;
    return withCampaignPeriod(schemaQuery.data, { start: null, end: null, code });
  }, [schemaQuery.data, dossier?.quarterCode]);
  // The questionnaire this file was filled on. Every section heading, the
  // identity questions it asks and the correction-request options come from
  // it, so a project/programme file is never described with another type's
  // sections.
  const entity = dossierEntity(reviewedSchema, formType);
  // Section 1 is the identity disclosure below; the rest are listed after it.
  const [section1, ...laterSections] = dossierSections(entity, locale);
  useEffect(() => {
    if (focusVerify && dossier && diagnosticState === "ready") {
      window.setTimeout(() => document.getElementById("dossier-verify")?.scrollIntoView({ block: "start" }), 0);
    }
  }, [diagnosticState, dossier, focusVerify]);
  /** A structure or identity answer: the option the respondent chose, in the
   * reader's language, whether the detail row stored the option or its code. */
  const answerValue = (column: string, stored: string) =>
    localHalf(detailAnswerValue(entity, column, stored), locale);
  /** An identity row belongs on screen when this questionnaire asks the
   * question, or when the record carries a value for it anyway. */
  const identityRow = (column: string, value: unknown) =>
    questionnaireAsks(entity, column) || fact(value) !== NOT_PROVIDED;
  /** A coherence warning in the console language; the stored text when it cannot be read. */
  const warningText = (ruleCode: string | null | undefined, description: string | null | undefined) =>
    coherenceWarningText(t, ruleCode, description);

  const invalidateDossier = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin", "diagnostic", id] }),
    queryClient.invalidateQueries({ queryKey: ["admin", "dossier", id] }),
    queryClient.invalidateQueries({ queryKey: dossierClaimStateKey(id) }),
    queryClient.invalidateQueries({ queryKey: dossierReviewProgressKey(id) }),
    queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] }),
    queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] }),
  ]);

  const preserveDossierRevision = (result: unknown) => {
    if (!result || typeof result !== "object") return;
    const revision = (result as { revision?: unknown }).revision;
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) return;
    queryClient.setQueriesData({ queryKey: ["admin", "dossier", id] }, (old: unknown) =>
      old && typeof old === "object" ? { ...old, revision } : old,
    );
  };

  const refreshAfterRevisionConflict = (error: unknown) => {
    if (isStaleRevision(error)) return invalidateDossier();
  };

  const advanceAfterDecision = async (reference: string) => {
    const neighbours = await getDossierNeighbours(id, neighbourQuery.filters);
    const decision = encodeURIComponent(reference);
    if (neighbours.next) {
      const archived = neighbourQuery.filters.includeArchived ? "&includeArchived=true" : "";
      router.replace(`/admin/dossiers/${encodeURIComponent(neighbours.next.id)}?returnTo=${encodeURIComponent(returnTo)}${archived}&reviewMove=1&decisionNotice=${decision}`, { scroll: false });
      return;
    }
    const separator = returnTo.includes("?") ? "&" : "?";
    router.replace(`${returnTo}${separator}decisionNotice=${decision}&endOfQueue=1`, { scroll: false });
  };

  const decisionNotice = searchParams.get("decisionNotice");
  const previousHref = !neighboursQuery.isFetching && neighboursQuery.data?.previous
    ? `/admin/dossiers/${encodeURIComponent(neighboursQuery.data.previous.id)}?returnTo=${encodeURIComponent(returnTo)}${neighbourQuery.filters.includeArchived ? "&includeArchived=true" : ""}&reviewMove=1`
    : null;
  const nextHref = !neighboursQuery.isFetching && neighboursQuery.data?.next
    ? `/admin/dossiers/${encodeURIComponent(neighboursQuery.data.next.id)}?returnTo=${encodeURIComponent(returnTo)}${neighbourQuery.filters.includeArchived ? "&includeArchived=true" : ""}&reviewMove=1`
    : null;

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
    retry: false,
    mutationFn: () => {
      if (!dossier || !Number.isSafeInteger(dossier.revision)) {
        throw new Error("La version du dossier est indisponible. Rechargez le dossier avant de confirmer.");
      }
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
      return requestCorrectionDossier(id, fullComments, certifiedCorrection, dossier.revision);
    },
    onSuccess: (result) => {
      preserveDossierRevision(result);
      setCorrectionSuccess(true);
      const reference = dossier?.submissionId ?? id;
      return invalidateDossier().then(() => advanceAfterDecision(reference));
    },
    onError: refreshAfterRevisionConflict,
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
    retry: false,
    mutationFn: () => {
      if (!dossier || !Number.isSafeInteger(dossier.revision)) {
        throw new Error("La version du dossier est indisponible. Rechargez le dossier avant de confirmer.");
      }
      return rejectDossier(id, rejectReason.trim(), certifiedReject, dossier.revision);
    },
    onSuccess: (result) => {
      preserveDossierRevision(result);
      setRejectSuccess(true);
      const reference = dossier?.submissionId ?? id;
      return invalidateDossier().then(() => advanceAfterDecision(reference));
    },
    onError: refreshAfterRevisionConflict,
  });

  // ── Reopen an endorsed file for correction (defect 13) ──
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [certifiedReopen, setCertifiedReopen] = useState(false);
  const [reopenSuccess, setReopenSuccess] = useState(false);

  const reopenMutation = useMutation({
    retry: false,
    mutationFn: () => {
      if (!dossier || !Number.isSafeInteger(dossier.revision)) {
        throw new Error("La version du dossier est indisponible. Rechargez le dossier avant de confirmer.");
      }
      return reopenDossierForCorrection(id, reopenReason.trim(), certifiedReopen, dossier.revision);
    },
    onSuccess: (result) => {
      preserveDossierRevision(result);
      setReopenSuccess(true);
      // Keep the reviewer on this file after reopening; the refreshed status
      // and this existing success notice confirm the change.
      void queryClient.cancelQueries({ queryKey: ["admin", "dossier", id] });
      queryClient.setQueryData(["admin", "dossier", id], (old: unknown) =>
        old && typeof old === "object" ? { ...old, status: "CORRECTION_REQUESTED", rejectionReason: reopenReason.trim() } : old,
      );
      return invalidateDossier();
    },
    onError: refreshAfterRevisionConflict,
  });

  const openReopenModal = () => {
    setReopenSuccess(false);
    reopenMutation.reset();
    setCertifiedReopen(false);
    setReopenReason("");
    setIsReopenOpen(true);
  };

  const openRejectModal = () => {
    setRejectSuccess(false);
    rejectMutation.reset();
    setCertifiedReject(false);
    setRejectReason("");
    setIsRejectOpen(true);
  };

  const handledOpenCorrectionRef = useRef(false);
  useEffect(() => {
    if (!shouldOpenCorrection || handledOpenCorrectionRef.current || dossierQuery.isFetching || claimStateQuery.isFetching) return;
    handledOpenCorrectionRef.current = true;
    if (dossier && decisions.requestCorrection && canReviewDossier) {
      queueMicrotask(() => openCorrectionModal());
      return;
    }
    router.replace(returnTo, { scroll: false });
  }, [canReviewDossier, decisions.requestCorrection, dossier, dossierQuery.isFetching, claimStateQuery.isFetching, openCorrectionModal, returnTo, router, shouldOpenCorrection]);

  const handledOpenRejectRef = useRef(false);
  useEffect(() => {
    if (!shouldOpenReject || handledOpenRejectRef.current || dossierQuery.isFetching || claimStateQuery.isFetching) return;
    handledOpenRejectRef.current = true;
    if (dossier && decisions.reject && canReviewDossier) {
      queueMicrotask(() => openRejectModal());
      return;
    }
    router.replace(returnTo, { scroll: false });
  }, [canReviewDossier, decisions.reject, dossier, dossierQuery.isFetching, claimStateQuery.isFetching, openRejectModal, returnTo, router, shouldOpenReject]);

  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState(false);
  const [approveComment, setApproveComment] = useState("");
  const hasOpenWarnings = (diag?.warningAnomalies.length ?? 0) > 0;
  const approvalChecksReady = diagnosticState === "ready" && (diag?.blockingAnomalies.length ?? 0) === 0;
  const explained = useExplainedFindings(dossier?.id);
  // The cells behind each open finding, recomputed from the figures as filed,
  // so the tables mark what disagrees and say what it is compared with.
  // Joined to a string so the memo reruns when the codes change, not on each render.
  const openRuleKey = diagnosticState === "ready"
    ? [...(diag?.blockingAnomalies ?? []), ...(diag?.warningAnomalies ?? [])].map((item) => String(item.ruleCode)).join("|")
    : "";
  const settledRuleKey = explained.items.map((item) => item.ruleCode).join("|");
  // Nothing is recomputed until both lists are read: before that, every gap
  // would look unreported for a moment.
  const checksReady = diagnosticState === "ready" && !explained.query.isLoading;
  const filedData = checksReady ? dossier?.rawData : null;
  // Detection needs the explained list: a role that cannot read it would see
  // an explained rule come back as « detected », so it gets no detection.
  const canDetect = explained.query.isSuccess;
  const cellChecks = useMemo(() => {
    const checks = reviewCellChecks(
      (filedData ?? null) as FormData | null,
      dossierEntityKey(formType),
      openRuleKey ? openRuleKey.split("|") : [],
      settledRuleKey ? settledRuleKey.split("|") : [],
    );
    return canDetect ? checks : { ...checks, flags: checks.flags.filter((flag) => !checks.detected.includes(flag)), detected: [] };
  }, [filedData, formType, openRuleKey, settledRuleKey, canDetect]);
  // Detected on review, one entry per rule (the checker raises one per sex).
  const detectedByRule = [...cellChecks.detected.reduce((byRule, flag) => {
    byRule.set(flag.code, [...(byRule.get(flag.code) ?? []), flag]);
    return byRule;
  }, new Map<string, typeof cellChecks.detected>())];
  // Each finding with figures to show gets a number and a colour, in list
  // order (stored findings, then those detected on review); its figures carry
  // the same number and colour in the tables.
  // VT rules compare table totals, which each stored warning states
  // (« (4.1: 12, hommes) »): the tables are marked, not cells.
  const vtFiguresByRule = new Map<string, VtFigure[]>();
  if (isVt) {
    for (const item of mergeSameRule([...(diag?.blockingAnomalies ?? []), ...(diag?.warningAnomalies ?? [])])) {
      const figures = item.anomalies.flatMap((anomaly) => vtFindingFigures(anomaly.description));
      if (figures.length >= 2) vtFiguresByRule.set(item.ruleCode, figures);
    }
  }
  const markedRules = [
    ...groupDossierFindings(diag?.blockingAnomalies ?? [], diag?.warningAnomalies ?? [])
      .flatMap((group) => mergeSameRule(group.findings).map((item) => item.ruleCode)),
    ...detectedByRule.map(([code]) => code),
  ].filter((code, index, all) => all.indexOf(code) === index
    && (cellChecks.flags.some((flag) => sameRule(code, flag.code)) || vtFiguresByRule.has(code)));
  const ruleMarkers = new Map<string, AnomalyMarker>(markedRules.map((code, index) =>
    [code, { n: index + 1, color: `var(--cam-anomaly-${(index % 5) + 1})` }]));
  // VT table paper number → the numbered findings that compare it.
  const vtTableMarkers: Record<string, AnomalyMarker[]> = {};
  for (const [code, figures] of vtFiguresByRule) {
    const marker = ruleMarkers.get(code);
    if (!marker) continue;
    for (const table of new Set(figures.map((figure) => figure.code))) {
      if (!(vtTableMarkers[table] ??= []).some((item) => item.n === marker.n)) vtTableMarkers[table].push(marker);
    }
  }
  const flagMarkers: Record<string, AnomalyMarker> = {};
  for (const flag of cellChecks.flags) {
    const code = markedRules.find((rule) => sameRule(rule, flag.code));
    if (code) flagMarkers[flag.key] = ruleMarkers.get(code)!;
  }
  // A rule that fired for men, women and total is one thing to check.
  const blockingFindings = mergeSameRule(diag?.blockingAnomalies ?? []).length;
  const warningFindings = mergeSameRule(diag?.warningAnomalies ?? []).length;
  const openFindings = diagnosticState === "ready" ? blockingFindings + warningFindings : 0;
  // One wording for a finding, in the list and where it is placed.
  const findingSentence = (ruleCode: string, description: string | null | undefined) =>
    t.has(`findingRule.${ruleCode}`) ? t(`findingRule.${ruleCode}`) : warningText(ruleCode, description);
  // Each finding marked on the tables or sections its rule compares.
  const placedFlags = placeFindings([
    ...mergeSameRule(diag?.blockingAnomalies ?? []).map((item) => ({ severity: "blocking" as const, ruleCode: item.ruleCode, text: findingSentence(item.ruleCode, item.finding.description) })),
    ...mergeSameRule(diag?.warningAnomalies ?? []).map((item) => ({ severity: "warning" as const, ruleCode: item.ruleCode, text: findingSentence(item.ruleCode, item.finding.description) })),
  // A finding the figures do not show is not placed on tables that agree.
  ].filter((item) => !cellChecks.notFound.has(item.ruleCode)), entity, locale);
  const railFlag = (flag: { count: number; blocking: boolean }) => flag.count > 0
    ? <span className={`cam-dossier-rail-flag${flag.blocking ? " is-blocking" : ""}`} aria-label={t("railFlagged", { count: flag.count })}> · {t("railFlagged", { count: flag.count })}</span>
    : null;

  const approveMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!dossier || !Number.isSafeInteger(dossier.revision)) {
        throw new Error("La version du dossier est indisponible. Rechargez le dossier avant de confirmer.");
      }
      const latestDiagnostic = await getDossierDiagnostic(id, includeArchived);
      queryClient.setQueryData(["admin", "diagnostic", id, includeArchived], latestDiagnostic);
      if (latestDiagnostic.blockingAnomalies.length > 0) throw new Error(t("blockingIssuesMustBeResolved"));
      if (latestDiagnostic.warningAnomalies.length > 0 && !approveComment.trim()) throw new Error(t("warningJustificationRequired"));
      return approveDossier(id, dossier.revision, approveComment);
    },
    onSuccess: (approvedData: any) => {
      preserveDossierRevision(approvedData);
      setApproveSuccess(true);
      // Defect 9: cancel any in-flight refetches for the dossier and diagnostic queries,
      // and write the authoritative server update directly into query cache so the header,
      // decision actions, and diagnostic state update immediately without a stale race.
      queryClient.cancelQueries({ queryKey: ["admin", "dossier", id] });
      queryClient.cancelQueries({ queryKey: ["admin", "diagnostic", id] });
      if (canonicalId && canonicalId !== id) {
        queryClient.cancelQueries({ queryKey: ["admin", "dossier", canonicalId] });
        queryClient.cancelQueries({ queryKey: ["admin", "diagnostic", canonicalId] });
      }

      queryClient.setQueryData(["admin", "dossier", id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          status: "APPROVED",
          revision: approvedData?.revision ?? old.revision,
          reviewedAt: approvedData?.reviewedAt ?? new Date().toISOString(),
          reviewedBy: approvedData?.reviewedBy ?? old.reviewedBy,
        };
      });
      if (canonicalId && canonicalId !== id) {
        queryClient.setQueryData(["admin", "dossier", canonicalId], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            status: "APPROVED",
            revision: approvedData?.revision ?? old.revision,
            reviewedAt: approvedData?.reviewedAt ?? new Date().toISOString(),
            reviewedBy: approvedData?.reviewedBy ?? old.reviewedBy,
          };
        });
      }

      queryClient.setQueryData(["admin", "diagnostic", id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          axis1Endorsed: true,
          axis3Eligible: true,
        };
      });
      if (canonicalId && canonicalId !== id) {
        queryClient.setQueryData(["admin", "diagnostic", canonicalId], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            axis1Endorsed: true,
            axis3Eligible: true,
          };
        });
      }

      const reference = dossier?.submissionId ?? id;
      return invalidateDossier().then(() => advanceAfterDecision(reference));
    },
    onError: refreshAfterRevisionConflict,
  });

  const openApproveModal = () => {
    setApproveSuccess(false);
    setApproveComment("");
    approveMutation.reset();
    setIsApproveOpen(true);
  };

  const handledOpenApproveRef = useRef(false);
  useEffect(() => {
    if (!shouldOpenApprove || handledOpenApproveRef.current || dossierQuery.isLoading || diagnosticQuery.isLoading) return;
    handledOpenApproveRef.current = true;
    if (dossier && diag && diag.blockingAnomalies.length === 0) {
      window.setTimeout(openApproveModal, 0);
      return;
    }
  }, [diagnosticQuery.isLoading, diag, dossier, dossierQuery.isLoading, openApproveModal, shouldOpenApprove]);

  // Section accordion toggle, by section id (the schema's own). `undefined`
  // is "the reader has not chosen yet", which opens the first section as the
  // page always did; `null` is every section closed, which a default of the
  // first id could not express.

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
    const steps: DossierHistoryEntry[] = [];

    if (dossier.submissionDate) {
      steps.push({
        key: "submitted",
        title: t("timelineReceived"),
        detail: dossier.quarterCode
          ? referencePeriodPhrases(dossier.quarterCode, locale)?.campaign ?? t("timelineCampaign", { code: dossier.quarterCode })
          : null,
        stamp: stamp(dossier.submissionDate, true, locale),
        dot: "",
        at: dossier.submissionDate,
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
        at: dossier.reviewedAt,
      });
    }

    return steps;
  })();
  // One list for the file's milestones and the reviewers' notes. The notes
  // are a live query, so a note saved below appears here at once.
  const mergedHistory = mergeDossierHistory(timeline, progressQuery.data?.items ?? [], {
    noteTitle: t("historyNoteEntry"),
    anomalyResolved: (anomalyId) => t("progressAnomalyResolved", { id: anomalyId }),
    activityRecorded: t("progressActivityRecorded"),
    stamp: (iso) => stamp(iso, true, locale),
  });

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
          backHref={returnTo}
          // No number while loading: the URL may hold the database id or the
          // receipt reference, and the page then showed one number, then
          // another. The loaded page shows the receipt reference.
          title={dossierQuery.isLoading ? t("fileTitleLoading") : t("fileTitle", { ref: shortRecordId(id) })}
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
        backHref={returnTo}
        title={<span title={name ?? ref}>{name ?? t("fileTitle", { ref: shortRecordId(ref) })}</span>}
        subtitle={<>
          <span className="cam-dossier-header-facts">
            {/* The short reference the queue shows; the full one stays in the tooltip. */}
            <span title={ref}>{t("submissionReference", { ref: shortRecordId(ref) })}</span>
            <span>{formType ? (ENTITY_TYPE_OPTION_KEYS[formType] ? tRoot(ENTITY_TYPE_OPTION_KEYS[formType]) : entityTypeLabel(formType)) : NOT_PROVIDED}</span>
            <span>{[region, dossier.department].filter(Boolean).join(" / ") || NOT_PROVIDED}</span>
            <span>{t("receivedOn", { date: submittedOn })}</span>
            {/* Moved from the queue (2026-11-02): read here, with the file. */}
            {dossier.isLate && <span>{t("filedLate")}</span>}
            {dossier.supersedes && (
              <span>
                <Link href={`/admin/dossiers/${encodeURIComponent(dossier.supersedes.id)}?returnTo=${encodeURIComponent(returnTo)}`}>
                  {t("correctsFile", { ref: shortRecordId(dossier.supersedes.submissionId) })}
                </Link>
              </span>
            )}
          </span>
          <span className="cam-dossier-respondent-line">
            {[dossier.respondent?.respondentName, respondentFunctionLabel(dossier.respondent?.respondentFunction, locale), dossier.respondent?.phone1, dossier.respondent?.email].filter(Boolean).join(" · ") || t("respondentUnavailable")}
          </span>
        </>}
        actions={supersededNotice(dossier, t) ?? undefined}
      />

      <div className="cam-dossier-decision-bar" aria-label={t("decisionBarLabel")}>
        <div className="cam-dossier-decision-state">
          <AdminStatusBadge label={statusLabel} variant={statusBadge?.variant ?? "neutral"} />
          {barClaimQuery.data && <DossierBarClaim
            claim={barClaimQuery.data}
            userId={userId}
            role={role}
            readOnly={readOnly}
            busy={claimMutation.isPending}
            saving={claimMutation.isPending}
            onChange={(assigneeId) => claimMutation.mutate(assigneeId)}
          />}
          {barClaimQuery.isError && !barClaimQuery.data && <span className="cam-admin-meta" role="alert">{t("claimStateFailed")}</span>}
          {claimActionNotice && <span className="cam-admin-meta" role="status">{claimActionNotice}</span>}
        </div>
        <nav className="cam-dossier-decision-navigation" aria-label={t("queueNavigationLabel")}>
          {previousHref
            ? <Link className="cam-button cam-button-secondary cam-button-sm" href={previousHref}>‹ {t("previousFile")}</Link>
            : <span className="cam-button cam-button-secondary cam-button-sm is-disabled" aria-disabled="true">‹ {t("previousFile")}</span>}
          {nextHref
            ? <Link className="cam-button cam-button-secondary cam-button-sm" href={nextHref}>{t("nextFile")} ›</Link>
            : <span className="cam-button cam-button-secondary cam-button-sm is-disabled" aria-disabled="true">{t("nextFile")} ›</span>}
        </nav>
        {!readOnly && <div className="cam-dossier-decision-actions">
          {decidedLine && <span className="cam-admin-meta">{decidedLine}</span>}
          {decisions.reject && canReviewDossier && <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={openRejectModal}>{t("rejectFormButton")}</button>}
          {decisions.requestCorrection && canReviewDossier && <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={openCorrectionModal}>{t("requestCorrectionButton")}</button>}
          {canReopenForCorrection(dossier.status, role) && <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={openReopenModal}>{t("reopenButton")}</button>}
          {decisions.approve && canReviewDossier && !approvalChecksReady && (
            <span className="cam-admin-notice cam-admin-notice--warn" role="status">
              {diagnosticState !== "ready" ? t("approvalChecksUnavailableOrBlocked") : t("blockingIssuesMustBeResolved")}
            </span>
          )}
          {decisions.approve && canReviewDossier && <button type="button" className="cam-button cam-button-primary cam-button-sm" disabled={!approvalChecksReady} onClick={openApproveModal}>{t("validateArchiveButton")}</button>}
        </div>}
      </div>

      {decisionNotice && <p className="cam-admin-notice cam-admin-notice--success" role="status">
        {searchParams.get("endOfQueue") === "1"
          ? t("endOfQueueNotice", { id: decisionNotice })
          : t("decisionMovedNotice", { id: decisionNotice })}
      </p>}

      {/* A Tableau de bord / Dossiers / Tracabilite pill row sat here. It
          mixed an Administration page (Tracabilite, AUDIT_ROLES only) into
          the Overview row and left out the hub's other pages. A detail
          page leads back to its list: the back arrow above does that. */}

      {/* 3-axis diagnostic strip: each badge is read from the dossier or its
          diagnostic (lib/dossier-axes.ts). The strip's left edge followed a
          fixed amber; .cam-dossier-axes carries is-approved / is-rejected, so
          it now follows the dossier's own decision. */}
      <CoherenceProvider flags={cellChecks.flags} readOnly markers={flagMarkers}>
      <div className="cam-dossier-workspace-layout">
        <aside className="cam-dossier-rail">
          <section aria-labelledby="dossier-controls-title">
            <h2 id="dossier-controls-title">{t("controlsTitle")}</h2>
            {/* The status is the decision bar's; the rail says what is left to check
                and whether the file can enter the statistics. */}
            <p>{diagnosticState === "ready"
              ? <><span className={blockingFindings > 0 ? "cam-dossier-axis-text is-error" : undefined}>{t("blockingCount", { count: blockingFindings })}</span> · {t("warningCount", { count: warningFindings })}{detectedByRule.length > 0 && <> · {t("railDetected", { count: detectedByRule.length })}</>}</>
              : axisText(qualityAxis(diagnosticState, diag))}</p>
            <p className="cam-admin-meta">{t("railEligibility")}</p>
            <p>{axisText(eligibilityAxis(diagnosticState, diag))}</p>
            {/* Re-runs the checks with the current rules, on the server: what it
                adds or closes is recorded, unlike « détecté à la relecture ». */}
            {dossier.status === "PENDING_REVIEW" && !readOnly && hasRole(role, SURVEY_ROLES) && (
              <RecheckCoherenceAction
                dossierId={dossier.id}
                onSettled={() => {
                  void invalidateDossier();
                  void queryClient.invalidateQueries({ queryKey: explainedFindingsKey(dossier.id) });
                }}
              />
            )}
          </section>
          <nav aria-label={t("sectionIndexLabel")}>
            <h2>{t("sectionsTitle")}</h2>
            <a href="#dossier-verify">{t("verifyHeading", { count: openFindings })}</a>
            <a href="#dossier-structure">{t("identificationTitle")}{railFlag({ count: placedFlags["dossier-structure"]?.length ?? 0, blocking: (placedFlags["dossier-structure"] ?? []).some((flag) => flag.severity === "blocking") })}</a>
            {isVt && schemaQuery.data?.entities.vocationalTraining?.sections.filter((s) => s.order !== 0).map((s) => {
              const vtEntity = schemaQuery.data?.entities.vocationalTraining;
              const state = vtEntity ? dossierSectionState(vtEntity, s.id, dossier.rawData as Record<string, unknown> | null) : null;
              return <a key={s.id} href={`#dossier-section-${s.id}`}>{s.title?.[locale] ?? s.id}{state ? <span className="cam-admin-meta"> · {t(`sectionState.${state}`)}</span> : null}{railFlag(sectionFlagCount(placedFlags, s))}</a>;
            })}
            {!isVt && laterSections.map((s) => {
              const state = entity ? dossierSectionState(entity, s.id, dossier.rawData as Record<string, unknown> | null) : null;
              const schemaSection = entity?.sections.find((item) => item.id === s.id);
              return <a key={s.id} href={`#dossier-section-${s.id}`}>{s.title}{state ? <span className="cam-admin-meta"> · {t(`sectionState.${state}`)}</span> : null}{schemaSection ? railFlag(sectionFlagCount(placedFlags, schemaSection)) : null}</a>;
            })}
            <a href="#dossier-history">{t("notesAndHistoryTitle")}</a>
          </nav>
        </aside>
        <div className="cam-dash-column cam-dossier-answer-column" style={{ gap: "var(--cam-space-3)" }}>
          <section id="dossier-verify" className="cam-dossier-findings">
            <h2>{t("verifyHeading", { count: openFindings })}</h2>
            {diag && groupDossierFindings(diag.blockingAnomalies ?? [], diag.warningAnomalies ?? []).map((group) => (
              <div key={`${group.severity}-${group.family ?? "none"}`} className={`cam-dossier-findings-group is-${group.severity}`}>
                <h3 className="cam-admin-label">
                  {t(group.severity === "blocking" ? "findingsBlocking" : "findingsWarning")}
                  {group.family ? ` · ${ruleFamilyLabel(group.family, locale)}` : ""}
                </h3>
                {mergeSameRule(group.findings).map(({ ruleCode, finding, rows, anomalies }) => {
                  // A rule the catalogue words is read in the reader's language
                  // with its figures in a breakdown; any other keeps its stored text.
                  const worded = t.has(`findingRule.${ruleCode}`);
                  const targets = findingTargets(ruleCode, entity, locale);
                  const figureRows = rows.filter((row) => hasFigures(row.observed, row.expected));
                  return (
                    <div
                      className={`${group.severity === "blocking" ? "is-blocking" : "is-warning"}${ruleMarkers.has(ruleCode) ? " is-numbered" : ""}`}
                      key={ruleCode}
                      title={ruleCode}
                      style={ruleMarkers.has(ruleCode) ? { borderInlineStartColor: ruleMarkers.get(ruleCode)!.color } : undefined}
                    >
                      <p className="cam-dossier-finding-title">
                        {ruleMarkers.has(ruleCode) && <AnomalyNumber marker={ruleMarkers.get(ruleCode)!} />}
                        <span>{findingSentence(ruleCode, finding.description)}</span>
                      </p>
                      {ruleMarkers.has(ruleCode) && (vtFiguresByRule.has(ruleCode)
                        ? <VtFindingCompare figures={vtFiguresByRule.get(ruleCode)!} />
                        : <FindingCompare ruleCode={ruleCode} data={(dossier.rawData ?? {}) as FormData} />)}
                      {worded && figureRows.length > 0 && (
                        <table className="cam-dash-table cam-dossier-finding-figures">
                          <thead>
                            <tr><th scope="col" /><th scope="col">{t("findingObserved")}</th><th scope="col">{t("findingExpected")}</th></tr>
                          </thead>
                          <tbody>
                            {figureRows.map((row, index) => (
                              <tr key={`${row.sex ?? "all"}-${index}`}>
                                <th scope="row">{row.sex ? t(`findingSex.${row.sex}`) : "—"}</th>
                                <td>{String(row.observed ?? "—")}</td>
                                <td>{String(row.expected ?? "—")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {!worded && figureRows.length > 0 && figureRows.map((row, index) => (
                        <p key={index} className="cam-admin-meta">{t("observedExpected", { observed: String(row.observed ?? "—"), expected: String(row.expected ?? "—") })}</p>
                      ))}
                      {/* One link, named by where it leads; the question it reaches
                          is in the tooltip. The tables the rule compares it with
                          are marked in place and listed on demand. */}
                      {/* Recomputed from the figures as filed: the gap is shown on
                          its cells, or the finding says it is not in them. */}
                      {cellChecks.notFound.has(ruleCode) && (
                        <p className="cam-admin-meta cam-dossier-finding-stale">{t("findingNotInFigures")}</p>
                      )}
                      {targets.length > 0 && (
                        <div className="cam-dossier-finding-targets">
                          <a href={`#${targets[0].anchor}`} title={targets[0].label}>
                            {t(targets[0].anchor === "dossier-structure"
                              ? "findingSeeIdentification"
                              : targets[0].anchor.startsWith("dossier-section-") ? "findingSeeSection" : "findingSeeTable")}
                          </a>
                          {targets.length > 1 && (
                            <details>
                              <summary>{t("findingComparedWith", { count: targets.length - 1 })}</summary>
                              <ul>
                                {targets.slice(1).map((target) => (
                                  <li key={target.anchor}><a href={`#${target.anchor}`} title={target.label}>{target.label}</a></li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      )}
                      {/* Warnings only: a blocking finding is never explained away
                          from here (§7; plan dossier-field-observations, Part A). */}
                      {group.severity === "warning" && canReviewDossier && !readOnly && dossier && Number.isSafeInteger(dossier.revision)
                        && anomalies.every((item) => typeof item.id === "string") && (
                        <div className="cam-dossier-finding-links">
                          <ExplainFindingAction
                            anomalyIds={anomalies.map((item) => item.id as string)}
                            revision={dossier.revision}
                            sentence={findingSentence(ruleCode, finding.description)}
                            onSettled={() => {
                              void invalidateDossier();
                              void queryClient.invalidateQueries({ queryKey: explainedFindingsKey(dossier.id) });
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {/* A gap in the figures with no stored finding: the file was filed
                before the rule existed or was fixed. Recomputed here, not
                recorded until « Recalculer les contrôles » stores it; until
                then there is nothing to explain and endorsement does not ask. */}
            {detectedByRule.length > 0 && (
              <div className="cam-dossier-findings-group is-warning">
                <h3 className="cam-admin-label">{t("detectedHeading", { count: detectedByRule.length })}</h3>
                <p className="cam-admin-meta">{t("detectedNote")}</p>
                {detectedByRule.map(([code, flags]) => (
                  <div
                    key={code}
                    className="is-warning is-numbered"
                    title={code}
                    style={ruleMarkers.has(code) ? { borderInlineStartColor: ruleMarkers.get(code)!.color } : undefined}
                  >
                    <p className="cam-dossier-finding-title">
                      {ruleMarkers.has(code) && <AnomalyNumber marker={ruleMarkers.get(code)!} />}
                      <span>{flags[0].title[locale].replace(/\s*\((hommes|femmes|men|women)\)$/, "")}</span>
                    </p>
                    {flags.map((flag) => <p key={flag.key}>{flag.message[locale]}</p>)}
                    <FindingCompare ruleCode={code} data={(dossier.rawData ?? {}) as FormData} />
                  </div>
                ))}
              </div>
            )}
            {/* « Conforme » only when nothing was ever raised: an explained warning is not « no anomaly ». */}
            {diag && diag.blockingAnomalies.length === 0 && diag.warningAnomalies.length === 0 && detectedByRule.length === 0 && (
              explained.items.length > 0 ? <p>{t("noOpenAnomaly")}</p> : <p>{t("noAnomalyDetected")}</p>
            )}
            <ExplainedFindings explained={explained} sentence={findingSentence} />
          </section>
        {/* Questionnaire sections, as native disclosures.
            These were <button>-driven divs; <details>/<summary> is what
            .cam-dossier-section styles, and it carries the open state,
            keyboard behaviour and the expanded/collapsed announcement that
            the hand-built version did not. One open at a time is preserved
            through `expandedSection`. */}
        <div className="cam-dash-column cam-dossier-answer-column" style={{ gap: "var(--cam-space-3)" }}>
          {/* Identification: the organisation as registered and Section 1's
              location, in one block (Section 1 is not repeated below). */}
          <section className="cam-dossier-section" id="dossier-structure">
            <h2>{t("identificationTitle")}</h2>
            {placedFlags["dossier-structure"] && <PlacedFlagNotice flags={placedFlags["dossier-structure"]} label={t("flaggedHere")} back={t("flaggedBack")} />}
            {structure.length > 0 || (!isVt && section1) ? (
              <dl className="cam-dossier-fields cam-dossier-fields--two">
                {structure.map(([field, value]) => (
                  <div key={field}><dt>{t(`structureField.${field === "yearOfEstablishment" ? "yearCreated" : field}`)}</dt><dd>{answerValue(field, value)}</dd></div>
                ))}
                {!isVt && section1 && <>
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
                {/* Founding year and legal status: asked by some
                    questionnaires and not others — the project/programme form
                    asks neither, and the two rows read "—" on a project file
                    as though the respondent had left them out (B3). A
                    question this questionnaire does not ask appears only when
                    the record carries a value for it anyway (an enterprise's
                    registered founding year, Company.yearOfCreation). */}
                {identityRow("yearCreated", detail.yearCreated ?? detail.yearOfEstablishment ?? dossier.yearOfCreation) && (
                  <div>
                    <dt>{t("yearCreatedLabel")}</dt>
                    <dd>{fact(detail.yearCreated ?? detail.yearOfEstablishment ?? dossier.yearOfCreation)}</dd>
                  </div>
                )}
                {identityRow("legalStatus", detail.legalStatus) && (
                  <div>
                    <dt>{t("legalStatusLabel")}</dt>
                    <dd>{legalStatus(detail.legalStatus)}</dd>
                  </div>
                )}
              </>}
              </dl>
            ) : <p className="cam-admin-meta">{t("structureEmpty")}</p>}
          </section>

          {isVt ? (
            schemaQuery.data ? (
              <DossierVtSections
                schema={schemaQuery.data}
                data={(dossier.rawData ?? {}) as Record<string, unknown>}
                canSeeStaffNames={canSeeStaffNames}
                flags={placedFlags}
                tableMarkers={vtTableMarkers}
              />
            ) : (
              <DataState
                dense
                state={schemaQuery.isError ? "error" : "loading"}
                resource={t("vt.resource")}
                error={schemaQuery.error}
                onRetry={() => schemaQuery.refetch()}
              />
            )
          ) : !entity ? (
            <DataState
              dense
              state={schemaQuery.isError ? "error" : schemaQuery.isLoading ? "loading" : "unavailable"}
              resource={t("vt.resource")}
              title={schemaQuery.data ? t("vt.schemaUnavailable") : undefined}
              error={schemaQuery.error}
              onRetry={() => schemaQuery.refetch()}
            />
          ) : (
          <>

          {laterSections.map((section) => (
            <DossierAnswerSections
              key={section.id}
              entity={entity}
              sectionId={section.id}
              title={section.title}
              data={(dossier.rawData ?? null) as Record<string, unknown> | null}
              quarterCode={dossier.quarterCode ?? null}
              flags={placedFlags}
            />
          ))}
          </>
          )}

          {/* Findings are at the top of the continuous answer column. */}
        </div>
        </div>
      </div>
      </CoherenceProvider>

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
      <section className="cam-admin-section cam-dossier-history-section" id="dossier-history">
        <div className="cam-admin-section-head">
          <h2 className="cam-admin-h2">{t("notesAndHistoryTitle")}</h2>
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
          <DossierClaimPanel dossierId={id} userId={userId} role={role} revision={dossier.revision} />
          {progressQuery.isError && <p className="cam-admin-meta" role="alert">{t("progressHistoryFailed")}</p>}
          {mergedHistory.length === 0 && dossier.status !== "PENDING_REVIEW" ? (
            <DataState
              dense
              state="empty"
              resource={t("historyResource")}
              title={t("historyEmptyTitle")}
              hint={t("historyEmptyHint")}
            />
          ) : (
            <ul className="cam-dossier-history">
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
              {mergedHistory.map((step) => (
                <li key={step.key}>
                  <span className={`cam-dossier-history-dot ${step.dot}`.trimEnd()} aria-hidden="true" />
                  <div>
                    <strong>{step.title}</strong>
                    {step.detail && <p className="cam-dossier-note">{step.detail}</p>}
                    <p className="cam-dossier-note">{step.stamp}</p>
                  </div>
                </li>
              ))}
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
                {/* The sections of this file's own questionnaire: a reviewer
                    could ask a project respondent to correct « Section 3.
                    Départs », which their form never asked (B3). The value is
                    the canonical French AST title, because it is stored in
                    the correction comment -- the official record sent to the
                    respondent. Only the label follows the locale. */}
                {dossierSections(entity, locale).map((s) => (
                  <option key={s.id} value={s.titleFr}>{s.title}</option>
                ))}
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
                {isStaleRevision(correctionMutation.error)
                  ? t("staleFileModified")
                  : t("correctionFailed", { message: (correctionMutation.error as Error)?.message ?? t("unknownError") })}
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
                disabled={approveMutation.isPending || !approvalChecksReady || (hasOpenWarnings && !approveComment.trim())}
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
            {hasOpenWarnings && (
              <label className="cam-admin-form-section">
                <span className="cam-admin-label">{t("warningJustificationLabel")} <span aria-hidden="true">*</span></span>
                <Textarea
                  value={approveComment}
                  onChange={(event) => setApproveComment(event.target.value)}
                  maxLength={2000}
                  required
                  aria-required="true"
                  aria-invalid={!approveComment.trim()}
                  placeholder={t("warningJustificationPlaceholder")}
                />
                <span className="cam-admin-meta">{t("warningJustificationHelp", { count: diag?.warningAnomalies.length ?? 0 })}</span>
              </label>
            )}
            {approveMutation.isError && (
              <div role="alert" className="cam-admin-notice cam-admin-notice--error" style={{ marginTop: "var(--cam-space-3)" }}>
                {isStaleRevision(approveMutation.error)
                  ? t("staleFileModified")
                  : t("approveFailed", { message: (approveMutation.error as Error)?.message ?? t("unknownError") })}
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
                {isStaleRevision(rejectMutation.error)
                  ? t("staleFileModified")
                  : t("rejectFailed", { message: (rejectMutation.error as Error)?.message ?? t("unknownError") })}
              </div>
            )}
          </div>
        )}
      </AdminDialog>

      <AdminDialog
        open={isReopenOpen}
        onClose={() => setIsReopenOpen(false)}
        title={t("reopenButton")}
        eyebrow={t("declarationLine", { ref, name: name ?? "\u2014" })}
        footer={
          <>
            <button
              type="button"
              className="cam-button cam-button-secondary cam-button-sm"
              onClick={() => setIsReopenOpen(false)}
            >
              {reopenSuccess ? t("closeButton") : tCommon("cancel")}
            </button>
            {!reopenSuccess && (
              <button
                type="button"
                className="cam-button cam-button-primary cam-button-sm"
                onClick={() => reopenMutation.mutate()}
                disabled={!certifiedReopen || reopenReason.trim().length < 10 || reopenMutation.isPending}
              >
                {reopenMutation.isPending ? t("reopening") : t("confirmReopen")}
              </button>
            )}
          </>
        }
      >
        {reopenSuccess ? (
          <p className="cam-admin-notice cam-admin-notice--success">{t("reopenSuccess")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
            <p style={{ margin: 0 }}>{t("reopenBody")}</p>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="reopen-motif">
                {t("reopenReasonLabel")}
              </label>
              <textarea
                id="reopen-motif"
                className="cam-admin-textarea"
                rows={3}
                required
                aria-required="true"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder={t("reopenReasonPlaceholder")}
              />
              {reopenReason.trim().length > 0 && reopenReason.trim().length < 10 && (
                <p className="cam-field-error" style={{ margin: "var(--cam-space-1) 0 0" }}>
                  {t("reasonTooShort", { length: reopenReason.trim().length })}
                </p>
              )}
            </div>

            <label className="cam-admin-choice">
              <input
                type="checkbox"
                checked={certifiedReopen}
                onChange={(e) => setCertifiedReopen(e.target.checked)}
              />
              <span>
                <strong>{t("certifyStrong")}</strong> {t("reopenCertifyRest")}
              </span>
            </label>

            <p className="cam-admin-meta" style={{ margin: 0 }}>{t("reopenAudit")}</p>

            {reopenMutation.isError && (
              <div role="alert" className="cam-admin-notice cam-admin-notice--error">
                {isStaleRevision(reopenMutation.error)
                  ? t("staleFileModified")
                  : t("reopenFailed", { message: (reopenMutation.error as Error)?.message ?? t("unknownError") })}
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
