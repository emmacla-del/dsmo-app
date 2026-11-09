"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import { usePinnedRevision } from "@/lib/use-pinned-revision";
import {
  applyRegistrationClaim,
  approveUser,
  assignRegistrationUser,
  decidedOrganisation,
  getCompanyRegistration,
  getCompanyRegistrationHistory,
  listCompanyRegistrations,
  rejectUser,
  requestComplements,
  type ApproveUserOptions,
} from "@/lib/user-directory";
import {
  approvalDataBlocker,
  approvalGate,
  daysWaiting,
  registrationMethodBadgeClass,
  registrationMethodLabel,
  verificationFlags,
  verificationIssues,
  verificationRows,
  type VerificationIssue,
  type VerificationKey,
  type VerificationMarks,
  type VerificationRow,
} from "@/lib/inscriptions";
import {
  decisionStaysListed,
  findNextInQueue,
  parseRegistrationTrail,
  readRegistrationTrailRaw,
  registrationReviewHref,
  resolveRegistrationReturnTo,
  saveRegistrationTrail,
  subscribeRegistrationTrail,
  trailPosition,
  trailWithout,
} from "@/lib/registration-trail";
import { ENTITY_TYPE_OPTION_KEYS, hasRealNiu } from "@/lib/companies-directory";
import { respondentFunctionLabel } from "@/lib/display-labels";
import { asUiLocale } from "@/lib/register-i18n";
import { APPROVAL_ROLES, hasRole } from "@/lib/roles";
import { NOT_PROVIDED, resolveDataState, stamp } from "@/lib/admin-data-state";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPageHeader";
import { registrationDecisionModel } from "@/lib/registration-decision";
import { claimTimeLeft } from "@/lib/registration-queue";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { ConfirmDialog } from "@/components/auth/ConfirmDialog";
import { UnsavedNavigationGuard } from "@/components/auth/UnsavedNavigationGuard";
import { DataState } from "@/components/admin/DataState";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * /admin/inscriptions/[id] — one registration, reviewed on its own page
 * (spec §4C, the dossier workspace's three columns): sections | what the
 * reviewer reads and checks | claim, checklist and decision.
 *
 * Same rules as the queue's dialog, which stays until this page is approved:
 * the four verification marks start unanswered, Approuver waits for every
 * applicable row to be ✓ (approvalGate, enforced again by the server), the
 * central-structure confirmation when the entity type needs it, a reason for
 * a rejection or a complements request, and expectedRevision on every
 * decision so a file changed meanwhile answers 409 instead of being decided
 * blind.
 */

type DecisionKind = "approved" | "rejected" | "complements";
type Choice = "REJECT" | "REQUEST_COMPLEMENTS" | null;
type StatusVariant = "pending" | "validated" | "rejected" | "correction" | "active" | "neutral";

const DECIDABLE_STATUSES = new Set(["PENDING_APPROVAL", "COMPLEMENTS_REQUESTED"]);
const STATUS_BADGE: Record<string, { textKey: string; variant: StatusVariant }> = {
  PENDING_APPROVAL: { textKey: "badgePending", variant: "pending" },
  COMPLEMENTS_REQUESTED: { textKey: "badgeComplements", variant: "correction" },
  ACTIVE: { textKey: "badgeApproved", variant: "validated" },
  REJECTED: { textKey: "badgeRejected", variant: "rejected" },
};
const NOTICE_KEYS: Record<DecisionKind, string> = {
  approved: "approvedNotice",
  rejected: "rejectedNotice",
  complements: "complementsNotice",
};
const METHOD_TONE: Record<string, "success" | "info" | "neutral"> = {
  "cam-badge-success": "success",
  "cam-badge-info": "info",
  "cam-badge-neutral": "neutral",
};
// Same column names as the dialog's diff (adminInscriptionsPage.field.*).
const FIELD_KEYS = new Set([
  "name", "taxNumber", "mainActivity", "secondaryActivity", "parentCompany", "address", "phone", "email",
  "cnpsNumber", "fax", "socialCapital", "entityType", "region", "department", "subdivision",
  "regionId", "departmentId", "subdivisionId",
]);

export default function RegistrationReviewRoute() {
  return (
    <Suspense fallback={null}>
      <RegistrationReviewKeyed />
    </Suspense>
  );
}

/** Reasons and messages sent to the declarant: same minimum as the dossier dialogs. */
const REASON_MIN_LENGTH = 10;

/** One component per file: moving to the next file starts with clean marks and choices. */
function RegistrationReviewKeyed() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  return <RegistrationReview key={id} id={id} />;
}

function RegistrationReview({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const t = useTranslations("adminRegistrationReview");
  const tq = useTranslations("adminInscriptionsPage");
  const tRoot = useTranslations();
  const locale = asUiLocale(useLocale());
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id);
  const canReview = hasRole(role, APPROVAL_ROLES);
  const returnTo = resolveRegistrationReturnTo(searchParams.get("returnTo"));

  const registrationQuery = useQuery({
    queryKey: ["auth", "company-registration", id],
    queryFn: () => getCompanyRegistration(id),
    enabled: canReview && id !== "",
    staleTime: 15_000,
  });
  const item = registrationQuery.data;
  // A claim lasts 2 hours (CLAUDE.md §21, 2026-11-09): its time left moves on
  // while the page is open.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const [revision, pinRevision] = usePinnedRevision(registrationQuery.isFetching ? undefined : item?.updatedAt);
  const historyQuery = useQuery({
    queryKey: ["auth", "company-registration", id, "history"],
    queryFn: () => getCompanyRegistrationHistory(id),
    enabled: canReview && id !== "" && !!item,
    staleTime: 15_000,
  });

  // ── Queue position (sessionStorage, written by the queue) ──
  const trailRaw = useSyncExternalStore(subscribeRegistrationTrail, readRegistrationTrailRaw, () => null);
  const trail = useMemo(() => parseRegistrationTrail(trailRaw), [trailRaw]);
  const position = trailPosition(trail, id);
  const previousPageNumber = position?.previousPage ?? null;
  const previousPageQuery = useQuery({
    queryKey: ["registration-trail", "previous", trail?.params, trail?.pageSize, previousPageNumber] as const,
    queryFn: () => listCompanyRegistrations({ ...(trail?.params ?? {}), page: previousPageNumber ?? 1, pageSize: trail?.pageSize }),
    enabled: canReview && !!trail && previousPageNumber !== null,
    staleTime: 15_000,
  });
  const nextPageQuery = useQuery({
    queryKey: ["registration-trail", "next", trail?.params, trail?.pageSize, trail?.page, trail?.decided, id] as const,
    queryFn: () => findNextInQueue(trail!, id, (page) => listCompanyRegistrations({ ...trail!.params, page, pageSize: trail!.pageSize })),
    enabled: canReview && !!trail && position?.nextPage != null,
    staleTime: 15_000,
  });
  const previousItems = previousPageQuery.data?.items ?? [];
  const previousId = position?.previousId ?? previousItems[previousItems.length - 1]?.id ?? null;
  const nextId = position?.nextId ?? nextPageQuery.data?.nextId ?? null;

  const trailAfter = (kind: DecisionKind) => trail && trailWithout(trail, id, decisionStaysListed(trail.params, kind));

  const moveTo = (targetId: string, direction: "previous" | "next", extra: Record<string, string> = {}, decision: DecisionKind | null = null) => {
    if (trail && position) {
      const base = (decision && trailAfter(decision)) || trail;
      const nextPage = direction === "next" && !position.nextId ? nextPageQuery.data : null;
      const previousPage = direction === "previous" && !position.previousId ? previousPageQuery.data : null;
      if (nextPage) {
        // Read before this decision, so its total still counts a file that has left.
        saveRegistrationTrail({ ...base, page: nextPage.page, ids: nextPage.ids.filter((value) => value !== id), total: nextPage.total - (trail.total - base.total) });
      } else if (previousPage) {
        saveRegistrationTrail({ ...base, page: previousPage.page, ids: previousPage.items.map((row) => row.id).filter((value) => value !== id) });
      } else {
        saveRegistrationTrail(base);
      }
    }
    router.replace(registrationReviewHref(targetId, returnTo, extra), { scroll: false });
  };

  // ── Review state ──
  const [marks, setMarks] = useState<VerificationMarks>({});
  const [centralChecked, setCentralChecked] = useState(false);
  const [choice, setChoice] = useState<Choice>(null);
  // One text per choice: a rejection reason must never go out as a
  // complements message after switching (audit R-3 notes).
  const [comments, setComments] = useState<Record<"REJECT" | "REQUEST_COMPLEMENTS", string>>({ REJECT: "", REQUEST_COMPLEMENTS: "" });
  const comment = choice ? comments[choice] : "";
  const setComment = (value: string) => { if (choice) setComments((current) => ({ ...current, [choice]: value })); };
  // Leaving the file (Précédent / Suivant, a duplicate link) asks first
  // when marks or a reason would be lost (audit R-2).
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  // « Reprendre le dossier »: the confirmation before taking over a colleague's claim.
  const [takeOverOpen, setTakeOverOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  // A fresh object per click, so the same row can be jumped to twice.
  const [checkTarget, setCheckTarget] = useState<{ key: VerificationKey } | null>(null);
  const arrivedNotice = searchParams.get("decisionNotice");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string; stale?: boolean; movedOn?: boolean } | null>(() => {
    if (!arrivedNotice || !(arrivedNotice in NOTICE_KEYS)) return null;
    const organisation = decidedOrganisation(queryClient, searchParams.get("decidedFile"));
    return {
      tone: "success",
      movedOn: true,
      text: organisation ? t(`decidedNotice.${arrivedNotice}`, { organisation }) : tq(NOTICE_KEYS[arrivedNotice as DecisionKind]),
    };
  });
  const answersRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // The notice travelled in the URL; a reload must not show it again.
  useEffect(() => {
    if (arrivedNotice) router.replace(registrationReviewHref(id, returnTo), { scroll: false });
  }, [arrivedNotice, id, returnTo, router]);

  useEffect(() => {
    document.title = `${item?.organisation || t("documentTitle")} | CAMLEAP`;
  }, [item?.organisation, t]);

  // Runs after the phone sheet has closed and the row's explanation is on screen.
  useEffect(() => {
    if (!checkTarget) return;
    const row = document.getElementById(`verify-${checkTarget.key}`);
    if (!row) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    row.focus({ preventScroll: true });
  }, [checkTarget]);

  // The section index follows the reading position in the centre column.
  useEffect(() => {
    const root = answersRef.current;
    if (!root || !item) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-review-section]"));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveSection(visible[0].target.id);
    }, { root: window.matchMedia("(min-width: 1024px)").matches ? root : null, rootMargin: "0px 0px -60% 0px" });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [item]);

  // Phone sheet: Escape closes it and focus goes back to the summary bar.
  const summaryButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!panelOpen) return;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPanelOpen(false);
      summaryButtonRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  // ── Claim ──
  const claimMutation = useMutation({
    mutationFn: (assigneeId: string | null) => assignRegistrationUser(id, assigneeId, item?.assigneeId ?? null),
    onSuccess: (claim) => {
      setTakeOverOpen(false);
      applyRegistrationClaim(queryClient, id, claim);
      void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] });
    },
    onError: (error) => {
      setTakeOverOpen(false);
      setNotice({ tone: "error", text: `${t("claimFailed")} ${error instanceof Error ? error.message : ""}`.trim() });
      void queryClient.invalidateQueries({ queryKey: ["auth", "company-registration", id] });
    },
  });

  // ── Decisions ──
  const decided = (kind: DecisionKind) => {
    void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] });
    void queryClient.invalidateQueries({ queryKey: ["auth", "company-registration"] });
    void queryClient.invalidateQueries({ queryKey: ["registration-trail"] });
    if (nextId && nextId !== id) {
      moveTo(nextId, "next", { decisionNotice: kind, decidedFile: id }, kind);
      return;
    }
    const remaining = trailAfter(kind);
    if (remaining) saveRegistrationTrail(remaining);
    router.replace(`${returnTo}${returnTo.includes("?") ? "&" : "?"}decisionNotice=${kind}&decidedFile=${encodeURIComponent(id)}`, { scroll: false });
  };
  const failed = (error: Error & { status?: number }) => {
    if (error?.status === 409) {
      // The officer's own claim ran out while the page was open: say so,
      // rather than « changed meanwhile »; the reload shows it free to claim.
      const lapsed = !!userId && item?.assigneeId === userId && claimTimeLeft(item?.claimExpiresAt, new Date(), locale)?.lapsed;
      setNotice({ tone: "error", text: lapsed ? t("claimLapsedError") : t("staleFileError"), stale: true });
      return;
    }
    setNotice({ tone: "error", text: error.message });
  };
  const approveMutation = useMutation({
    mutationFn: (options: ApproveUserOptions) => approveUser(id, options),
    onSuccess: () => decided("approved"),
    onError: failed,
  });
  const rejectMutation = useMutation({
    mutationFn: ({ reason, expectedRevision }: { reason: string; expectedRevision?: string }) => rejectUser(id, reason, expectedRevision),
    onSuccess: () => decided("rejected"),
    onError: failed,
  });
  const complementsMutation = useMutation({
    mutationFn: ({ message, expectedRevision }: { message: string; expectedRevision?: string }) => requestComplements(id, message, expectedRevision),
    onSuccess: () => decided("complements"),
    onError: failed,
  });
  const pending = approveMutation.isPending || rejectMutation.isPending || complementsMutation.isPending;

  const reload = () => {
    setNotice(null);
    setMarks({});
    setCentralChecked(false);
    void registrationQuery.refetch().then(({ data }) => { if (data) pinRevision(data.updatedAt); });
  };

  const breadcrumb = [
    { label: tRoot("adminNav.hubs.inscriptions") },
    { label: tRoot("adminNav.routes.inscriptions"), href: returnTo },
  ];

  if (!item) {
    const state = resolveDataState({
      roleAllowed: canReview,
      isLoading: registrationQuery.isLoading,
      isError: registrationQuery.isError,
      error: registrationQuery.error,
      rowCount: null,
    });
    return (
      <div className="cam-admin-page">
        <AdminPageHeader
          breadcrumb={breadcrumb}
          backHref={returnTo}
          title={state === "loading" ? t("loadingTitle") : state === "forbidden" ? t("forbiddenTitle") : t("notFoundTitle")}
        />
        <DataState
          state={state === "ready" || state === "empty" ? "notFound" : state}
          resource={t("resource")}
          error={registrationQuery.error}
          onRetry={() => registrationQuery.refetch()}
          title={state === "notFound" || state === "ready" || state === "empty" ? t("notFoundTitle") : undefined}
          hint={state === "notFound" || state === "ready" || state === "empty" ? t("notFoundHint") : undefined}
        />
      </div>
    );
  }

  const decidable = DECIDABLE_STATUSES.has(item.status);
  const rows = verificationRows(item, locale);
  const gate = approvalGate(rows, marks, locale);
  const dataBlocker = approvalDataBlocker(item);
  const approveBlocked = (dataBlocker && t(dataBlocker === "entityType" ? "missingEntityTypeBlock" : "missingSubdivisionBlock"))
    ?? gate.message
    ?? (item.requiresCentralStructureCheck && !centralChecked ? tq("centralCheckRequired") : null);
  const answered = rows.filter((row) => marks[row.key] !== undefined).length;
  const anyRejected = rows.some((row) => marks[row.key] === "ko");
  const waitingDays = decidable ? daysWaiting(item.waitingSince) : null;
  const status = STATUS_BADGE[item.status];
  const ownsClaim = !!userId && item.assigneeId === userId;
  const claimedByOther = !!item.assigneeId && !ownsClaim;
  const claimLeft = item.assigneeId ? claimTimeLeft(item.claimExpiresAt, now, locale) : null;
  // The claim and the main action: see registration-decision.ts.
  const { canDecide, complementsFirst } = registrationDecisionModel({
    userId,
    assigneeId: item.assigneeId,
    dataBlocked: !!dataBlocker,
    anyRejected,
    anyEmpty: rows.some((row) => row.value === null),
  });

  const entityLabel = (value: string | null) =>
    value && ENTITY_TYPE_OPTION_KEYS[value] ? tRoot(ENTITY_TYPE_OPTION_KEYS[value]) : value ?? NOT_PROVIDED;
  const fieldLabel = (field: string) => (FIELD_KEYS.has(field) ? tq(`field.${field}`) : field);
  const diffValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") return NOT_PROVIDED;
    if (typeof value === "string") return ENTITY_TYPE_OPTION_KEYS[value] ? tRoot(ENTITY_TYPE_OPTION_KEYS[value]) : value;
    return String(value);
  };
  const methodLabel = registrationMethodLabel(item.registrationMethod, locale);
  const historyState = resolveDataState({
    roleAllowed: canReview,
    isLoading: historyQuery.isLoading,
    isError: historyQuery.isError,
    error: historyQuery.error,
    rowCount: historyQuery.data ? historyQuery.data.length + 1 : null,
  });
  // The file's own creation is always the oldest event; an assisted
  // registration already has an audit entry for it.
  const hasCreationEvent = (historyQuery.data ?? []).some((entry) => entry.action === "COMPANY_REGISTRATION_ASSISTED");
  const historyLabel = (action: string) => (t.has(`historyAction.${action}`) ? t(`historyAction.${action}`) : action);
  const niu = hasRealNiu(item.taxNumber) ? item.taxNumber : null;
  const expectedRevision = revision ?? item.updatedAt;

  const complementsButton = (variant: "default" | "outline") => (
    <Button
      type="button"
      variant={variant}
      aria-expanded={choice === "REQUEST_COMPLEMENTS"}
      aria-controls="registration-decision-reason"
      disabled={pending}
      onClick={() => { setChoice(choice === "REQUEST_COMPLEMENTS" ? null : "REQUEST_COMPLEMENTS"); setCommentError(null); }}
    >
      {tq("requestComplements")}
    </Button>
  );

  const submitChoice = () => {
    const text = comment.trim();
    if (!text) {
      setCommentError(choice === "REJECT" ? tq("rejectReasonRequired") : tq("complementsMessageRequired"));
      return;
    }
    // Sent to the declarant: the same 10-character minimum as the dossier dialogs.
    if (text.length < REASON_MIN_LENGTH) {
      setCommentError(t("reasonTooShort", { length: text.length, min: REASON_MIN_LENGTH }));
      return;
    }
    setCommentError(null);
    if (choice === "REJECT") rejectMutation.mutate({ reason: text, expectedRevision });
    else complementsMutation.mutate({ message: text, expectedRevision });
  };
  const approve = () => {
    if (approveBlocked) return;
    approveMutation.mutate({ centralStructureConfirmed: centralChecked, ...verificationFlags(rows, marks), expectedRevision });
  };

  const unsavedWork = decidable && canReview && (
    rows.some((row) => marks[row.key] !== undefined) || centralChecked || !!comments.REJECT.trim() || !!comments.REQUEST_COMPLEMENTS.trim()
  );
  const leaveTo = (go: () => void) => { if (unsavedWork) setPendingLeave(() => go); else go(); };

  const sections = [
    item.duplicateHints.length > 0 && { id: "registration-duplicates", label: t("duplicatesTitle"), flag: String(item.duplicateHints.length), blocking: false },
    item.lastResubmission && { id: "registration-changes", label: t("changesNavLabel"), flag: null, blocking: false },
    { id: "registration-verify", label: t("verifyNavLabel"), flag: decidable && answered < rows.length ? String(rows.length - answered) : null, blocking: anyRejected || rows.some((row) => row.value === null) },
    { id: "registration-respondent", label: tq("respondentTitle"), flag: null, blocking: false },
    { id: "registration-identity", label: t("identityNavLabel"), flag: null, blocking: false },
    { id: "registration-history", label: t("historyTitle"), flag: null, blocking: false },
  ].filter(Boolean) as { id: string; label: string; flag: string | null; blocking: boolean }[];

  const issuesOf = (row: VerificationRow) => (decidable ? verificationIssues(row, marks[row.key], item) : []);
  const stateLabel = (row: VerificationRow) => {
    if (marks[row.key] === "ok") return t("stateOk");
    if (marks[row.key] === "ko") return t("stateKo");
    const kind = issuesOf(row)[0]?.kind;
    if (kind === "empty") return t("stateEmpty");
    if (kind === "duplicate") return t("verifyIssue.duplicateTitle");
    if (kind === "changed") return t("verifyIssue.changedState");
    return t("stateTodo");
  };
  const issueText = (issue: VerificationIssue) => {
    if (issue.kind === "changed") return t("verifyIssue.changedText", { before: diffValue(issue.before) });
    if (issue.kind !== "duplicate") return t(`verifyIssue.${issue.kind}Text`);
    return issue.organisation
      ? t(`verifyIssue.duplicate.${issue.field}`, { organisation: issue.organisation })
      : t(`verifyIssue.duplicate.${issue.field}Outside`);
  };

  return (
    <div className="cam-admin-page cam-dossier-workspace-page cam-registration-review-page">
      <AdminPageHeader
        record
        breadcrumb={breadcrumb}
        backHref={returnTo}
        title={<span className="cam-dossier-title-line">
          <span title={item.organisation}>{item.organisation || NOT_PROVIDED}</span>
          {status ? <AdminStatusBadge label={tq(status.textKey)} variant={status.variant} /> : <AdminStatusBadge label={item.status} variant="neutral" />}
          {/* One time signal, in the information tone (audit R-4). */}
          {waitingDays !== null && <span className="cam-dossier-waiting-badge">
            {t("waitingSince", { count: waitingDays })}{item.overdue && <> · {t("overdueSuffix")}</>}
          </span>}
        </span>}
        subtitle={<span className="cam-dossier-header-facts">
          {item.establishmentId && <span className="cam-registration-ref">{t("reference", { ref: item.establishmentId })}</span>}
          <span>{entityLabel(item.entityType)}</span>
          <span>{[item.region, item.department].filter(Boolean).join(" · ") || NOT_PROVIDED}</span>
          <span>{t("submittedOn", { date: stamp(item.submittedAt, false, locale) })}</span>
          {niu && <span className="cam-registration-ref">{t("niu", { niu })}</span>}
        </span>}
        actions={position && (
          <div className="cam-dossier-header-actions-v2">
            <span className="cam-admin-meta">{t("position", { position: position.position, total: position.total })}</span>
            <div className="cam-dossier-decision-navigation">
              <Button type="button" size="sm" variant="outline" disabled={!previousId || pending} onClick={() => previousId && leaveTo(() => moveTo(previousId, "previous"))}>
                <span aria-hidden="true">‹</span> {t("previous")}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={!nextId || pending} onClick={() => nextId && leaveTo(() => moveTo(nextId, "next"))}>
                {t("next")} <span aria-hidden="true">›</span>
              </Button>
            </div>
          </div>
        )}
      />

      {notice && (
        <Alert role={notice.tone === "error" ? "alert" : "status"} variant={notice.tone === "error" ? "destructive" : "success"} className="cam-registration-notice">
          <span>{notice.text}{notice.movedOn && <> {t("nextFileNotice", { organisation: item.organisation || NOT_PROVIDED })}</>}</span>
          {notice.stale && <Button type="button" size="sm" variant="outline" onClick={reload}>{t("reloadButton")}</Button>}
        </Alert>
      )}

      <div className="cam-dossier-workspace-layout is-three-column">
        <aside className="cam-dossier-rail">
          <nav aria-label={t("sectionsNav")}>
            <h2>{t("sectionsTitle")}</h2>
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`} aria-current={activeSection === section.id ? "location" : undefined}>
                <span>{section.label}</span>
                {section.flag && <span className={`cam-dossier-rail-flag${section.blocking ? " is-blocking" : ""}`}>{section.flag}</span>}
              </a>
            ))}
          </nav>
        </aside>

        <div className="cam-dossier-answer-column" ref={answersRef}>
          {item.duplicateHints.length > 0 && (
            <section id="registration-duplicates" data-review-section className="cam-dossier-section" aria-labelledby="registration-duplicates-title">
              <div className="cam-dossier-section-head">
                <h2 id="registration-duplicates-title">{t("duplicatesTitle")}</h2>
                <Badge variant="warning">{tq("possibleMatches", { count: item.duplicateHints.length })}</Badge>
              </div>
              <p className="cam-registration-lead">{t("duplicatesIntro")}</p>
              <div className="cam-dossier-field-flag is-warning cam-registration-hints" role="note">
                <ul>
                  {item.duplicateHints.map((hint, index) => <li key={`${hint}-${index}`}>{hint}</li>)}
                </ul>
                {item.duplicateFiles?.map((file) => (
                  <p key={file.id}>
                    <Link href={registrationReviewHref(file.id, returnTo)}>
                      {t("duplicatesOpenFile", { organisation: file.organisation })}
                    </Link>
                  </p>
                ))}
              </div>
            </section>
          )}

          {item.lastResubmission && (
            <section id="registration-changes" data-review-section className="cam-dossier-section" aria-labelledby="registration-changes-title">
              <div className="cam-dossier-section-head">
                <h2 id="registration-changes-title">{t("changesTitle")}</h2>
                <span className="cam-admin-meta">{t("changesWhen", { date: stamp(item.lastResubmission.at, true, locale) })}</span>
              </div>
              {Object.keys(item.lastResubmission.changes).length === 0 ? (
                <p className="cam-registration-lead">{tq("resubmittedUnchanged")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">{tq("fieldColumn")}</TableHead>
                      <TableHead scope="col">{tq("beforeColumn")}</TableHead>
                      <TableHead scope="col">{tq("afterColumn")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(item.lastResubmission.changes).map(([field, diff]) => (
                      <TableRow key={field}>
                        <TableHead scope="row" className="h-auto whitespace-normal font-medium text-foreground">{fieldLabel(field)}</TableHead>
                        <TableCell className="cam-registration-before">{diffValue(diff.before)}</TableCell>
                        <TableCell className="cam-registration-after">{diffValue(diff.after)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          )}

          <section id="registration-verify" data-review-section className="cam-dossier-section" aria-labelledby="registration-verify-title">
            <div className="cam-dossier-section-head">
              <h2 id="registration-verify-title">{tq("toVerifyTitle")}</h2>
              {decidable && <span className="cam-admin-meta">{t("verifyHint")}</span>}
            </div>
            <div className="cam-registration-verify">
              {rows.map((row) => {
                const issues = issuesOf(row);
                const active = checkTarget?.key === row.key;
                return (
                <div
                  key={row.key}
                  id={`verify-${row.key}`}
                  className={`cam-registration-verify-row${active ? " is-active" : ""}${issues[0] ? ` is-${issues[0].severity}` : ""}`}
                  tabIndex={-1}
                >
                  <span className="cam-registration-verify-label">{row.label}</span>
                  <span className={`cam-registration-verify-value${row.value === null ? " is-empty" : ""}`}>{row.value ?? tq("notRecorded")}</span>
                  {decidable ? (
                    <div role="radiogroup" aria-label={tq("verificationAriaLabel", { label: row.label })} className="cam-registration-segmented">
                      <label className="is-ok">
                        <input
                          type="radio"
                          name={`verify-${row.key}`}
                          value="ok"
                          disabled={row.value === null || pending}
                          checked={marks[row.key] === "ok"}
                          onChange={() => setMarks((current) => ({ ...current, [row.key]: "ok" }))}
                        />
                        <span>{tq("compliant")}</span>
                      </label>
                      <label className="is-ko">
                        <input
                          type="radio"
                          name={`verify-${row.key}`}
                          value="ko"
                          disabled={pending}
                          checked={marks[row.key] === "ko"}
                          onChange={() => setMarks((current) => ({ ...current, [row.key]: "ko" }))}
                        />
                        <span>{tq("nonCompliant")}</span>
                      </label>
                    </div>
                  ) : <span aria-hidden="true" />}
                  {(issues.length > 0 || active) && (
                    <div className="cam-registration-verify-notes">
                      {issues.map((issue, index) => (
                        <div key={index} className={`cam-dossier-field-flag is-${issue.severity}`} role="note">
                          <strong>{t(`verifyIssue.${issue.kind}Title`)}</strong>
                          <p>{issueText(issue)}</p>
                          {issue.kind === "duplicate" && issue.fileId && issue.organisation && (
                            <Link href={registrationReviewHref(issue.fileId, returnTo)}>
                              {t("duplicatesOpenFile", { organisation: issue.organisation })}
                            </Link>
                          )}
                        </div>
                      ))}
                      {issues.length === 0 && <p className="cam-admin-meta">{t("verifyIssue.noneText")}</p>}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </section>

          <section id="registration-respondent" data-review-section className="cam-dossier-section" aria-labelledby="registration-respondent-title">
            <div className="cam-dossier-section-head">
              <h2 id="registration-respondent-title">{tq("respondentTitle")}</h2>
              <span className="cam-admin-meta">{tq("respondentNote")}</span>
            </div>
            <dl className="cam-registration-fields">
              <div><dt>{tq("nameLabel")}</dt><dd>{[item.respondentFirstName, item.respondentLastName].filter(Boolean).join(" ") || NOT_PROVIDED}</dd></div>
              <div><dt>{tq("functionLabel")}</dt><dd>{respondentFunctionLabel(item.respondentFunction, locale) || NOT_PROVIDED}</dd></div>
              <div><dt>{tq("phoneLabel")}</dt><dd>{[item.respondentPhone, item.respondentPhone2].filter(Boolean).join(" · ") || NOT_PROVIDED}</dd></div>
              <div><dt>{tq("loginEmailLabel")}</dt><dd>{item.email || NOT_PROVIDED}</dd></div>
            </dl>
          </section>

          <section id="registration-identity" data-review-section className="cam-dossier-section" aria-labelledby="registration-identity-title">
            <div className="cam-dossier-section-head">
              <h2 id="registration-identity-title">{t("identityTitle")}</h2>
            </div>
            <dl className="cam-registration-fields">
              <div><dt>{tq("establishmentTypeColumn")}</dt><dd>{entityLabel(item.entityType)}</dd></div>
              <div><dt>{tq("regionColumn")}</dt><dd>{item.region || NOT_PROVIDED}</dd></div>
              <div><dt>{tq("departmentColumn")}</dt><dd>{item.department || NOT_PROVIDED}</dd></div>
              <div><dt>{tq("field.subdivision")}</dt><dd>{item.subdivision || NOT_PROVIDED}</dd></div>
              <div><dt>{tq("field.address")}</dt><dd>{item.address || NOT_PROVIDED}</dd></div>
              <div><dt>{tq("field.mainActivity")}</dt><dd>{item.mainActivity || NOT_PROVIDED}</dd></div>
              {item.secondaryActivity && <div><dt>{tq("field.secondaryActivity")}</dt><dd>{item.secondaryActivity}</dd></div>}
              {item.parentCompany && <div><dt>{tq("field.parentCompany")}</dt><dd>{item.parentCompany}</dd></div>}
              <div><dt>{t("taxNumberLabel")}</dt><dd className="cam-registration-ref">{niu ?? NOT_PROVIDED}</dd></div>
              <div><dt>{t("cnpsLabel")}</dt><dd className="cam-registration-ref">{item.cnpsNumber || NOT_PROVIDED}</dd></div>
              {item.registrationNumber && <div><dt>{t("registrationNumberLabel")}</dt><dd className="cam-registration-ref">{item.registrationNumber}</dd></div>}
              <div><dt>{t("submittedLabel")}</dt><dd>{stamp(item.submittedAt, true, locale)}</dd></div>
              <div>
                <dt>{tq("registeredByLabel")}</dt>
                <dd className="cam-registration-registered-by">
                  {item.createdByName && <span>{item.createdByName}</span>}
                  {methodLabel
                    ? <Badge variant={METHOD_TONE[registrationMethodBadgeClass(item.registrationMethod)] ?? "neutral"}>{methodLabel}</Badge>
                    : !item.createdByName && NOT_PROVIDED}
                </dd>
              </div>
            </dl>
          </section>

          <section id="registration-history" data-review-section className="cam-dossier-section" aria-labelledby="registration-history-title">
            <div className="cam-dossier-section-head">
              <h2 id="registration-history-title">{t("historyTitle")}</h2>
            </div>
            {historyState !== "ready" && historyState !== "empty" ? (
              <DataState
                dense
                state={historyState}
                resource={t("historyResource")}
                error={historyQuery.error}
                onRetry={() => historyQuery.refetch()}
              />
            ) : (
              <ol className="cam-registration-history">
                {(historyQuery.data ?? []).map((entry) => (
                  <li key={entry.id}>
                    <time className="cam-registration-ref" dateTime={entry.at}>{stamp(entry.at, true, locale)}</time>
                    <div>
                      <strong>{historyLabel(entry.action)}</strong>
                      {(entry.byDeclarant || entry.actorName) && (
                        <span className="cam-admin-meta"> · {entry.byDeclarant ? t("historyByDeclarant") : t("historyBy", { name: entry.actorName ?? NOT_PROVIDED })}</span>
                      )}
                      {entry.action === "REGISTRATION_ASSIGNED" && (
                        <p>{entry.assigneeName ? t("historyAssignedTo", { name: entry.assigneeName }) : t("historyReleased")}</p>
                      )}
                      {entry.changedFields.length > 0 && <p>{t("historyChanged", { fields: entry.changedFields.map(fieldLabel).join(", ") })}</p>}
                      {entry.text && <blockquote>{entry.text}</blockquote>}
                    </div>
                  </li>
                ))}
                {!hasCreationEvent && (
                  <li>
                    <time className="cam-registration-ref" dateTime={item.submittedAt}>{stamp(item.submittedAt, true, locale)}</time>
                    <div><strong>{t("historySubmitted")}</strong>{methodLabel && <span className="cam-admin-meta"> · {methodLabel}</span>}</div>
                  </li>
                )}
              </ol>
            )}
          </section>
        </div>

        {/* Phone: the panel is a sheet behind this bar (spec §4C). */}
        <div className="cam-dossier-review-summary">
          <div>
            <strong>{!decidable ? t("decidedTitle") : !canDecide ? t("claimOther", { name: item.assigneeName ?? NOT_PROVIDED }) : approveBlocked ? t("summaryToCheck", { done: answered, total: rows.length }) : t("summaryReady")}</strong>
            {decidable && anyRejected && <span className="cam-dossier-review-summary-blocking">{t("stateKo")}</span>}
          </div>
          <Button ref={summaryButtonRef} type="button" aria-expanded={panelOpen} aria-controls="registration-review-panel" onClick={() => setPanelOpen(true)}>
            {t("openReviewPanel")}
          </Button>
        </div>
        {panelOpen && <div className="cam-dossier-review-scrim" aria-hidden="true" onClick={() => setPanelOpen(false)} />}

        <aside
          id="registration-review-panel"
          ref={panelRef}
          tabIndex={-1}
          aria-label={t("decisionTitle")}
          className={`cam-dossier-review-panel${panelOpen ? " is-open" : ""}`}
        >
          <button type="button" className="cam-dossier-review-close" aria-label={t("closeReviewPanel")} onClick={() => { setPanelOpen(false); summaryButtonRef.current?.focus(); }}>
            <span aria-hidden="true">×</span>
          </button>

          {decidable && (
            <div className="cam-dossier-review-card cam-dossier-decision-state cam-registration-claim">
              {/* Board: « Réclamation » with who holds the file on the right. */}
              <div className="cam-dossier-review-card-head">
                <h2>{t("claimTitle")}</h2>
                <AdminStatusBadge
                  label={ownsClaim ? t("claimYou") : claimedByOther ? t("claimOther", { name: item.assigneeName ?? NOT_PROVIDED }) : t("claimFree")}
                  variant={ownsClaim ? "active" : claimedByOther ? "correction" : "neutral"}
                />
              </div>
              {(ownsClaim || !item.assigneeId) && userId && (
                <button
                  type="button"
                  className="cam-text-button"
                  data-claim-action={ownsClaim ? "release" : "claim"}
                  disabled={claimMutation.isPending}
                  onClick={() => claimMutation.mutate(ownsClaim ? null : userId)}
                >
                  {ownsClaim ? t("releaseButton") : t("claimButton")}
                </button>
              )}
              {claimedByOther && userId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-claim-action="take-over"
                  disabled={claimMutation.isPending || pending}
                  onClick={() => setTakeOverOpen(true)}
                >
                  {t("takeOverButton")}
                </Button>
              )}
              <p className="cam-registration-claim-hint">{ownsClaim ? t("claimYouHint") : claimedByOther ? t("claimOtherHint") : t("claimFreeHint")}</p>
              {claimLeft && (
                <p className={claimLeft.urgent ? "cam-claim-time is-urgent" : "cam-claim-time"}>
                  {claimLeft.lapsed ? tRoot("adminRegistrationQueue.claimLapsed") : tRoot("adminRegistrationQueue.timeLeft", { time: claimLeft.label })}
                  {" "}{tRoot("adminRegistrationQueue.timeLeftHelp")}
                </p>
              )}
            </div>
          )}

          {decidable && (
            <section className="cam-dossier-review-card" aria-labelledby="registration-checklist-title">
              <div className="cam-dossier-review-card-head">
                <h2 id="registration-checklist-title">{t("checklistTitle")}</h2>
                <span className="cam-dossier-review-counts">{t("checklistProgress", { done: answered, total: rows.length })}</span>
              </div>
              <progress className="cam-dossier-review-progress" value={answered} max={rows.length} aria-hidden="true" />
              <ul className="cam-registration-checklist">
                {rows.map((row) => {
                  const severity = issuesOf(row)[0]?.severity;
                  const tone = marks[row.key] === "ok" ? "is-ok" : marks[row.key] === "ko" ? "is-ko" : severity ? `is-${severity}` : undefined;
                  return (
                    <li key={row.key} className={tone}>
                      <a
                        href={`#verify-${row.key}`}
                        onClick={(event) => {
                          event.preventDefault();
                          setPanelOpen(false);
                          setCheckTarget({ key: row.key });
                        }}
                      >
                        <span className="cam-registration-checklist-label">{row.label}</span>
                        <span className="cam-registration-checklist-state">{stateLabel(row)}</span>
                      </a>
                    </li>
                  );
                })}
                {/* Not a verification: the NIU has no row to mark, so this leads to the duplicates section. */}
                {item.duplicateMatches?.some((match) => match.field === "taxNumber") && (
                  <li className="is-warning">
                    <a href="#registration-duplicates" onClick={() => setPanelOpen(false)}>
                      <span className="cam-registration-checklist-label">{t("taxNumberLabel")}</span>
                      <span className="cam-registration-checklist-state">{t("verifyIssue.duplicateTitle")}</span>
                    </a>
                  </li>
                )}
              </ul>
              {item.requiresCentralStructureCheck && (
                <div className="cam-registration-central">
                  <Checkbox id="registration-central-check" checked={centralChecked} disabled={pending} onCheckedChange={(checked) => setCentralChecked(checked === true)} />
                  <Label htmlFor="registration-central-check" className="font-normal leading-snug">
                    <span>{tq("centralConfirmed")}</span>
                    <span className="cam-admin-meta">{t("centralHint")}</span>
                  </Label>
                </div>
              )}
            </section>
          )}

          {decidable ? (
            <section className="cam-dossier-review-card cam-dossier-review-decisions" aria-labelledby="registration-decision-title">
              <h2 id="registration-decision-title">{t("decisionTitle")}</h2>
              {!canDecide ? (
                // Board: the reason in a note, then the three decisions shown
                // but unavailable, so the officer sees what claiming opens.
                <>
                  <p className="cam-admin-notice cam-admin-notice--info" role="note">
                    {claimedByOther ? t("claimOtherDecide", { name: item.assigneeName ?? NOT_PROVIDED }) : t("claimToDecide")}
                  </p>
                  <Button type="button" disabled>{tq("approveAccount")}</Button>
                  <Button type="button" variant="outline" disabled>{tq("requestComplements")}</Button>
                  <Button type="button" variant="outline" className="cam-registration-reject" disabled>{tq("rejectAccount")}</Button>
                  <p className="cam-registration-claim-hint">{t("reasonSent")}</p>
                </>
              ) : <>
              {approveBlocked && <p id="registration-approve-blocked" className="cam-dossier-review-blocked">{approveBlocked}</p>}
              {complementsFirst && complementsButton("default")}
              <Button
                type="button"
                variant={complementsFirst ? "outline" : "default"}
                onClick={approve}
                disabled={pending || !!approveBlocked}
                aria-describedby={approveBlocked ? "registration-approve-blocked" : undefined}
              >
                {approveMutation.isPending ? tq("decisionSubmitting") : tq("approveAccount")}
              </Button>
              {!complementsFirst && complementsButton("outline")}
              <Button
                type="button"
                variant="outline"
                className="cam-registration-reject"
                aria-expanded={choice === "REJECT"}
                aria-controls="registration-decision-reason"
                disabled={pending}
                onClick={() => { setChoice(choice === "REJECT" ? null : "REJECT"); setCommentError(null); }}
              >
                {tq("rejectAccount")}
              </Button>
              {choice && (
                <div id="registration-decision-reason" className="cam-registration-reason">
                  <Label htmlFor="registration-decision-comment">
                    {choice === "REJECT" ? tq("rejectReasonLabel") : tq("complementsMessageLabel")} <span aria-hidden="true">*</span>
                  </Label>
                  <Textarea
                    id="registration-decision-comment"
                    value={comment}
                    required
                    aria-invalid={commentError ? true : undefined}
                    aria-describedby="registration-decision-comment-hint"
                    onChange={(event) => { setComment(event.target.value); if (commentError) setCommentError(null); }}
                  />
                  <p id="registration-decision-comment-hint" className="cam-admin-meta">
                    {commentError
                      ? <span className="cam-registration-error" role="alert">{commentError}</span>
                      : <>
                        {choice === "REJECT" ? tq("rejectReasonHint") : tq("complementsMessageHint")} {t("reasonSent")}
                        {comment.trim().length < REASON_MIN_LENGTH && <> {t("reasonRemaining", { count: REASON_MIN_LENGTH - comment.trim().length })}</>}
                      </>}
                  </p>
                  <div className="cam-registration-reason-actions">
                    <Button type="button" variant={choice === "REJECT" ? "destructive" : "default"} disabled={pending} onClick={submitChoice}>
                      {pending ? tq("decisionSubmitting") : choice === "REJECT" ? t("confirmReject") : t("confirmComplements")}
                    </Button>
                    <Button type="button" variant="ghost" disabled={pending} onClick={() => { setChoice(null); setCommentError(null); }}>
                      {t("cancelChoice")}
                    </Button>
                  </div>
                </div>
              )}
              </>}
            </section>
          ) : (
            <section className="cam-dossier-review-card" aria-labelledby="registration-decided-title">
              <h2 id="registration-decided-title">{t("decidedTitle")}</h2>
              <p>
                {status ? tq(status.textKey) : item.status}
                {(item.approvedAt || item.rejectedAt) && <> {t("decidedOn", { date: stamp(item.approvedAt ?? item.rejectedAt, true, locale) })}</>}
              </p>
              <p className="cam-dossier-review-prompt">{t("decidedHint")}</p>
              {item.approvalComment && <p><strong>{t("approvalComment")}</strong> {item.approvalComment}</p>}
              {item.rejectionReason && <p><strong>{t("rejectionReason")}</strong> {item.rejectionReason}</p>}
            </section>
          )}
        </aside>
      </div>

      <AdminDialog
        open={takeOverOpen}
        onClose={() => setTakeOverOpen(false)}
        title={t("takeOverTitle")}
        eyebrow={item.organisation || NOT_PROVIDED}
        footer={
          <>
            <Button type="button" variant="outline" size="sm" disabled={claimMutation.isPending} onClick={() => setTakeOverOpen(false)}>
              {t("cancelChoice")}
            </Button>
            <Button type="button" size="sm" disabled={claimMutation.isPending || !userId} onClick={() => userId && claimMutation.mutate(userId)}>
              {t("takeOverConfirm")}
            </Button>
          </>
        }
      >
        <p>{t("takeOverBody", { name: item.assigneeName ?? NOT_PROVIDED })}</p>
      </AdminDialog>

      {/* Links (a duplicate, the breadcrumb) and Précédent / Suivant both ask
          before the marks and reasons on this file are lost. */}
      <UnsavedNavigationGuard
        active={unsavedWork && !pending}
        title={t("leaveTitle")}
        body={t("leaveBody")}
        cancelLabel={t("leaveStay")}
        confirmLabel={t("leaveConfirm")}
      />
      {pendingLeave && (
        <ConfirmDialog
          id="registration-leave"
          title={t("leaveTitle")}
          body={t("leaveBody")}
          cancelLabel={t("leaveStay")}
          confirmLabel={t("leaveConfirm")}
          onCancel={() => setPendingLeave(null)}
          onConfirm={() => { const go = pendingLeave; setPendingLeave(null); go(); }}
        />
      )}
    </div>
  );
}
