"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CircleX, Download, FileText, Percent, RotateCcw, X } from "lucide-react";
import { API_BASE_URL, archiveDossier, restoreDossier, bulkVisaDeclarations, bulkRejectDeclarations, bulkRequestCorrectionDeclarations, assignDossier, getPilotageQueuesForView, getToken, listAdminQuestionnaires, localeHeader, reopenDossierForCorrection } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { resolveEntityName, type NamedSubmission } from "@/lib/onefop-entity-name";
import { assessBulkEligibility } from "@/lib/dossier-bulk-eligibility";
import { selectAdminViewCounts } from "@/lib/admin-view-counts";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { ArchiveActions } from "@/components/admin/ArchiveActions";
import { DataStateRow } from "@/components/admin/DataState";
import { DossiersCoverage } from "@/components/admin/DossiersCoverage";
import { ViewSwitch } from "@/components/admin/ViewSwitch";
import { useTerritoryDepartments, useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { formatCampaignDisplayName, formatCampaignShortName } from "@/lib/campaigns";
import { referencePeriodLabel } from "@/lib/onefop-period-label";
import { getActiveCollectionCampaigns, getCampaignReturns } from "@/lib/pilotage-targets";
import {
  NOT_PROVIDED,
  count,
  metricUnavailable,
  percent,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";
import { AUDIT_ROLES, DOSSIER_ARCHIVE_ROLES, NATIONAL_READ_ROLES, hasRole, isReadOnlyRole } from "@/lib/roles";
import {
  hrefWith,
  parseDossierFlag,
  parseDossierQuarter,
  parseDossierSort,
  parseDossierStatus,
  parseDossierVue,
  recentDossierQuarters,
  type DossierSort,
  type DossierStatus,
} from "@/lib/admin-url";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

/**
 * One dossier row.
 *
 * Every field is mapped from a GET /admin/questionnaires item. Fields the
 * record does not carry are `null` and render as an em dash; none of them has
 * a default. `quality` and `eligibility` are derived — see `toRow` for the
 * exact formulas.
 */
interface DossierItem {
  id: string;
  submissionId: string;
  companyName: string | null;
  respondentName: string | null;
  region: string | null;
  department: string | null;
  formType: string | null;
  adminStatus: "PENDING_REVIEW" | "APPROVED" | "CORRECTION_REQUESTED" | "REJECTED" | "SUPERSEDED" | null;
  campaignName: string | null;
  quarterCode: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  supersededById?: string | null;
  updatedAt: string | null;
  blockingCount: number;
  warningCount: number;
  submittedAt: string | null;
  isLate: boolean;
  assigneeId?: string | null;
  assigneeName?: string | null;
  companyRegistrationStatus?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  archivedByUser?: { id: string; firstName: string | null; lastName: string | null } | null;
}

interface QuestionnaireListItem extends NamedSubmission {
  id: string;
  submissionId?: string | null;
  respondent?: { respondentName?: string | null } | null;
  region?: string | null;
  department?: string | null;
  formType?: string | null;
  status?: DossierItem["adminStatus"];
  campaignName?: string | null;
  quarterCode?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  supersededById?: string | null;
  updatedAt?: string | null;
  submissionDate?: string | null;
  isLate?: boolean;
  assigneeId?: string | null;
  assigneeName?: string | null;
  companyRegistrationStatus?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  archivedByUser?: { id: string; firstName: string | null; lastName: string | null } | null;
  anomalies?: Array<{ isBlocking?: boolean; status?: string }> | null;
}

const PAGE_SIZE = 10;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readableActor(value: string | null | undefined): string | null {
  return value && !UUID_PATTERN.test(value) ? value : null;
}

/**
 * The tone each derived state maps to, as a Badge variant. The tone names on
 * the left are the ones the derivations below already used; `error` is the
 * console's word for what the component calls `danger`.
 */
const BADGE_VARIANT = {
  success: "success",
  info: "info",
  error: "danger",
  warning: "warning",
  neutral: "neutral",
} as const;

type ToneName = keyof typeof BADGE_VARIANT;

// The organisation's own registration (account) status, as stored on
// Company.user.status. It is not the dossier's status: a file can be endorsed
// while its organisation's account is still under review. Unknown statuses are
// shown as stored, neutral, rather than guessed at.
const ORG_STATUS_BADGE: Record<string, { textKey: string; tone: ToneName }> = {
  PENDING_APPROVAL: { textKey: "orgStatusPending", tone: "warning" },
  COMPLEMENTS_REQUESTED: { textKey: "orgStatusComplements", tone: "info" },
  ACTIVE: { textKey: "orgStatusActive", tone: "success" },
  REJECTED: { textKey: "orgStatusRejected", tone: "error" },
};

// Mirrors ADMIN_LIST_FORM_TYPES (backend admin-list-filter.ts), labelled by entityTypeLabel.
const FORM_TYPES = ["ENTREPRISE", "COOPERATIVE", "CTD", "ONG", "ADMINISTRATION", "PROJECT_PROGRAM", "VOCATIONAL_TRAINING"];
// Mirrors ADMIN_LIST_PERIODS; "" = Toutes les périodes (the default, so pending
// dossiers older than 30 days stay visible). `labelKey` is under adminDossiersPage.
const PERIODS: Array<{ value: string; labelKey: string }> = [
  { value: "7d", labelKey: "period7d" },
  { value: "30d", labelKey: "period30d" },
  { value: "3m", labelKey: "period3m" },
  { value: "12m", labelKey: "period12m" },
];
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The status filter: one control, every status, each with its count.
 *
 * The visa and correction queues were absorbed from the deleted
 * /admin/files-attente; they are this same list under a `status` filter.
 * They used to be tab-styled buttons beside a separate Statut dropdown that
 * set the same filter. Now there is one control, and the status lives in
 * ?status= so a reload or a shared link keeps it.
 *
 * Counts come from GET /admin/questionnaires/pilotage/queues: `statusCounts`
 * and `totalSubmissionsCount`, over the caller's whole territory, DRAFT
 * excluded — the same base as this list. They do not follow the type,
 * region, period or search filters below.
 */
// `labelKey` / `noteKey` are under adminDossiersPage.
const STATUS_VIEWS: Array<{ status: DossierStatus | ""; labelKey: string; noteKey?: string }> = [
  { status: "", labelKey: "statusAll" },
  { status: "PENDING_REVIEW", labelKey: "statusPending", noteKey: "statusPendingNote" },
  { status: "CORRECTION_REQUESTED", labelKey: "statusCorrections", noteKey: "statusCorrectionsNote" },
  { status: "APPROVED", labelKey: "statusEndorsed" },
  { status: "REJECTED", labelKey: "statusRejected" },
  // Closed files, kept for the record; not in "All" nor in any count.
  { status: "SUPERSEDED", labelKey: "statusSuperseded", noteKey: "statusSupersededNote" },
];

// Suspense because useSearchParams() requires it in the app router.
export default function DossiersPage() {
  return (
    <Suspense fallback={null}>
      <DossiersSingleView />
    </Suspense>
  );
}

function DossiersSingleView() {
  const searchParams = useSearchParams();
  const activeView = parseDossierVue(searchParams.get("vue"));

  return (
    <div className="cam-admin-page cam-dossier-page cam-dossier-page--single">
      <DossiersContent key={activeView} view={activeView} showPageHeader />
    </div>
  );
}

function DossiersContent({
  view,
  showPageHeader = false,
}: {
  view: "submissions" | "completed" | "coverage";
  showPageHeader?: boolean;
}) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  // Central agents consult: no selection column, no visa / reject / export
  // toolbar. The server refuses all three to the role regardless.
  const readOnly = isReadOnlyRole(user?.role);
  const canReopen = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN_ONEFOP" || user?.role === "ADMIN_ONEFOP_SUBMISSIONS";
  const canReadAudit = hasRole(user?.role, AUDIT_ROLES);
  const t = useTranslations("adminDossiersPage");
  const tRoot = useTranslations();
  const locale = asUiLocale(useLocale());
  const typeLabel = (type: string) =>
    ENTITY_TYPE_OPTION_KEYS[type] ? tRoot(ENTITY_TYPE_OPTION_KEYS[type]) : entityTypeLabel(type);
  /**
   * The actor's own authorised scope, from the stored user record.
   *
   * An account whose role is territorial but whose territory is unset is
   * reported as unaffected — not as national. The backend fails such a scope
   * closed (territoryWhere), and labelling it "National" here would assert an
   * authorisation the account does not hold.
   */
  const scopeLabel =
    user?.role === "REGIONAL_ADMIN"
      ? (user.region ? t("scopeRegional", { region: user.region }) : t("scopeRegionalUnassigned"))
      : user?.role === "DIVISIONAL_ADMIN"
        ? (user.department ? t("scopeDepartmental", { department: user.department }) : t("scopeDepartmentalUnassigned"))
        : hasRole(user?.role, NATIONAL_READ_ROLES)
          ? t("scopeNational")
          : t("scopeUnassigned");
  const { regions: territoryRegions } = useTerritoryRegions(view !== "coverage");

  // ADR-0001 / Phase 3: vue values will be renamed to registrations: queue |
  // organisations | coverage; declarations: submissions | completed | coverage.
  // vue is presentation only and grants no permission. Update parsers, tabs,
  // link helpers, and labels together. See docs/plans/admin-modules-refactor.md
  // Phase 3.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeView = parseDossierVue(searchParams.get("vue"));
  const legacyFiltersApply = activeView === view;
  // Keep each section's filters independently bookmarkable. Older generic
  // filters still seed the section named by ?vue= (or submissions by default).
  const filterParam = (key: string) =>
    searchParams.get(`${view}${key[0].toUpperCase()}${key.slice(1)}`) ??
    (legacyFiltersApply ? searchParams.get(key) : null);
  const statusFilter = parseDossierStatus(filterParam("status"));
  // ?sort=oldest (the pilotage review-delay link) lists the longest-waiting
  // files first; URL state like the status, written by setSort.
  const sortOrder = parseDossierSort(filterParam("sort"));
  const companyIdFilter = filterParam("companyId") ?? "";
  const regionFilter = filterParam("region") ?? "";
  const departmentFilter = filterParam("department") ?? "";
  const campaignIdFilter = searchParams.get("campaignId")?.trim() ?? "";
  const quarterCodeFilter = parseDossierQuarter(filterParam("quarterCode")) ?? "";
  const lateFilter = parseDossierFlag(filterParam("late"));
  const overdueFilter = parseDossierFlag(filterParam("overdue"));
  const assignedToMeFilter = parseDossierFlag(filterParam("assignedToMe"));
  const vue = view;
  const archivedParam = searchParams.get("completedIncludeArchived") ??
    (legacyFiltersApply ? searchParams.get("includeArchived") : null);
  const includeArchived = vue === "completed" && archivedParam !== "false";
  // The header search box pushes /admin/dossiers?q=<query>, so `q` seeds the
  // search box on arrival instead of being dropped.
  const requestedQuery = filterParam("search") ?? (legacyFiltersApply ? searchParams.get("q") : null) ?? "";
  // /admin/questionnaires links here with ?formType= ("Voir dossiers").
  const requestedFormType = filterParam("formType") ?? "";
  const { departments: territoryDepartments } = useTerritoryDepartments(regionFilter || undefined, view !== "coverage");

  // searchInput is what the user types; search is what is sent, 300 ms after
  // the last keystroke (each request runs a multi-column contains query).
  const [searchInput, setSearchInput] = useState(requestedQuery);
  const [search, setSearch] = useState(requestedQuery.trim());
  const typeFilter = FORM_TYPES.includes(requestedFormType) ? requestedFormType : "";
  const periodFilter = filterParam("period") ?? "";
  const [offset, setOffset] = useState(0);

  // Any URL filter change, including the browser's back button, starts again
  // at the first page.
  const filterSignature = [
    vue,
    statusFilter,
    sortOrder,
    regionFilter,
    departmentFilter,
    campaignIdFilter,
    quarterCodeFilter,
    lateFilter ? "late" : "",
    overdueFilter ? "overdue" : "",
    assignedToMeFilter ? "assigned" : "",
    typeFilter,
    periodFilter,
    requestedQuery,
  ].join("|");
  const [offsetSignature, setOffsetSignature] = useState(filterSignature);
  if (offsetSignature !== filterSignature) {
    setOffsetSignature(filterSignature);
    setOffset(0);
  }

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // A new ?q= from the header replaces the search box without an effect-driven
  // cascading render. This component-local render adjustment mirrors the URL.
  const [searchUrlValue, setSearchUrlValue] = useState(requestedQuery);
  if (searchUrlValue !== requestedQuery) {
    setSearchUrlValue(requestedQuery);
    setSearchInput(requestedQuery);
    setSearch(requestedQuery.trim());
    setOffset(0);
    setSelectedIds(new Set());
  }

  // Modal / Drawer state — bulk visa
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [certifiedBulk, setCertifiedBulk] = useState(false);
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkResult, setBulkResult] = useState<Awaited<ReturnType<typeof bulkVisaDeclarations>> | null>(null);

  // Modal state — bulk reject
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [certifiedReject, setCertifiedReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectResult, setRejectResult] = useState<Awaited<ReturnType<typeof bulkRejectDeclarations>> | null>(null);
  const [reopenTarget, setReopenTarget] = useState<DossierItem | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [certifiedReopen, setCertifiedReopen] = useState(false);
  const [reopenNotice, setReopenNotice] = useState("");
  const [assignNotice, setAssignNotice] = useState("");
  const [archiveNotice, setArchiveNotice] = useState("");
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [certifiedCorrection, setCertifiedCorrection] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionResult, setCorrectionResult] = useState<Awaited<ReturnType<typeof bulkRequestCorrectionDeclarations>> | null>(null);

  // TODO(backend, S): known limitation — CTD dossiers are searchable only by ID or respondent name (OnefopCtdDetail has no name column; server search no longer reads rawData)
  // TODO(design, S): what is "ASFOP" in the Figma's questionnaire types? Labels use entityTypeLabel until the domain answers (VOCATIONAL_TRAINING?)
  const campaignsQuery = useQuery({
    queryKey: ["admin", "pilotage", "active-campaigns"],
    queryFn: getActiveCollectionCampaigns,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const campaigns = campaignsQuery.data ?? [];
  const effectiveCampaignId = campaignIdFilter || campaigns[0]?.id || "";
  const campaignReturnsQuery = useQuery({
    queryKey: ["admin", "pilotage", "returns", effectiveCampaignId],
    queryFn: () => getCampaignReturns(effectiveCampaignId),
    enabled: vue === "submissions" && Boolean(effectiveCampaignId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const campaignOptions = campaigns.map((campaign) => ({
    value: campaign.id,
    label: `${referencePeriodLabel(campaign.code, locale)} - ${formatCampaignDisplayName(campaign.name)}`,
  }));
  if (effectiveCampaignId && !campaignOptions.some((option) => option.value === effectiveCampaignId)) {
    campaignOptions.unshift({ value: effectiveCampaignId, label: effectiveCampaignId });
  }
  const quarterOptions = [
    quarterCodeFilter,
    ...recentDossierQuarters(new Date()).filter((code) => code !== quarterCodeFilter),
  ].filter(Boolean);
  const quarterLabel = (code: string) => `${code.slice(-2)} ${code.slice(0, 4)}`;

  // Every filter is applied server-side (drafts excluded), so `total` is the
  // count of the filtered query and paging never hides matching rows.
  const questionnairesQuery = useQuery({
    queryKey: ["admin", "questionnaires", "list", vue, { statusFilter, typeFilter, regionFilter, departmentFilter, campaignId: effectiveCampaignId, quarterCodeFilter, lateFilter, overdueFilter, assignedToMeFilter, periodFilter, search, companyIdFilter, sortOrder, offset, includeArchived }],
    queryFn: () =>
      listAdminQuestionnaires({
        status: vue === "completed" ? undefined : statusFilter || undefined,
        statuses: vue === "completed"
          ? (statusFilter === "APPROVED" || statusFilter === "REJECTED" || statusFilter === "SUPERSEDED" ? statusFilter : "APPROVED,REJECTED,SUPERSEDED")
          : undefined,
        view: vue === "completed" ? "completed" : "queue",
        includeArchived,
        formType: typeFilter || undefined,
        period: periodFilter || undefined,
        region: regionFilter || undefined,
        department: departmentFilter || undefined,
        campaignId: effectiveCampaignId || undefined,
        quarterCode: quarterCodeFilter || undefined,
        late: lateFilter || undefined,
        overdue: overdueFilter || undefined,
        assignedToMe: assignedToMeFilter || undefined,
        search: search || undefined,
        companyId: companyIdFilter || undefined,
        sort: sortOrder || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    enabled: vue !== "coverage",
    placeholderData: keepPreviousData,
  });

  const archiveMutation = useMutation({
    mutationFn: (target: { item: DossierItem; reason: string }) => archiveDossier(target.item.id, target.reason),
    onSuccess: () => { setArchiveNotice(""); void queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] }); void queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] }); },
    onError: (error) => {
      setArchiveNotice(`${t("archiveFailed")} ${error instanceof Error ? error.message : ""}`.trim());
    },
  });
  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreDossier(id),
    onSuccess: () => { setArchiveNotice(""); void queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] }); void queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] }); },
    onError: (error) => {
      setArchiveNotice(`${t("archiveFailed")} ${error instanceof Error ? error.message : ""}`.trim());
    },
  });

  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues", vue === "completed" ? "completed" : "queue", vue === "completed" ? includeArchived : false],
    queryFn: () => getPilotageQueuesForView(vue === "completed" ? "completed" : "queue", vue === "completed" ? includeArchived : undefined),
    enabled: vue !== "coverage",
  });
  const queues = queuesQuery.data ?? null;
  const queueStatusCounts = selectAdminViewCounts(
    queues?.countsView,
    "queue",
    queues?.statusCounts as Partial<Record<DossierStatus, number>> | undefined,
  );
  const responseRateValue = campaignReturnsQuery.isError
    ? metricUnavailable(locale)
    : percent(campaignReturnsQuery.data?.totals.responseRate, 0, locale);

  /**
   * Queue counters for the tab row. Source: GET /admin/questionnaires/
   * pilotage/queues, territory-scoped server-side. `null` until the server
   * answers — an unreachable queue is not an empty queue, so a tab badge shows
   * an em dash rather than a number the server never gave.
   */
  // Bulk visa mutation
  const bulkMutation = useMutation({
    mutationFn: bulkVisaDeclarations,
    onSuccess: (data) => {
      setBulkResult(data);
      queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] });
      setSelectedIds(new Set());
      setOffset(0);
    },
  });

  // Bulk reject mutation
  const rejectMutation = useMutation({
    mutationFn: bulkRejectDeclarations,
    onSuccess: (data) => {
      setRejectResult(data);
      queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] });
      setSelectedIds(new Set());
      setOffset(0);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: () => reopenDossierForCorrection(
      reopenTarget?.id ?? "",
      reopenReason.trim(),
      certifiedReopen,
      reopenTarget?.updatedAt ?? "",
    ),
    onSuccess: () => {
      setReopenNotice(t("reopenSuccess"));
      setReopenTarget(null);
      setReopenReason("");
      setCertifiedReopen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (target: { id: string; assigneeId: string | null }) => assignDossier(target.id, target.assigneeId),
    onMutate: () => setAssignNotice(""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] });
    },
    onError: (error) => setAssignNotice(error instanceof Error ? error.message : t("assignFailed")),
  });

  const correctionMutation = useMutation({
    mutationFn: bulkRequestCorrectionDeclarations,
    onSuccess: (data) => {
      setCorrectionResult(data);
      queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] });
      setSelectedIds(new Set());
      setOffset(0);
    },
  });

  // Each section owns its filter state; campaignId remains shared.
  const setUrlFilter = useCallback((changes: Record<string, string | null>) => {
    setSelectedIds(new Set());
    setOffset(0);
    const scoped: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(changes)) {
      if (key === "campaignId") {
        scoped[key] = value;
        continue;
      }
      if (key !== "q") scoped[`${view}${key[0].toUpperCase()}${key.slice(1)}`] = value;
      scoped[key] = null;
    }
    router.replace(hrefWith(pathname, searchParams.toString(), scoped));
  }, [pathname, router, searchParams, view]);

  const setStatus = (status: DossierStatus | "") => setUrlFilter({ status });
  const setSort = (sort: DossierSort) => setUrlFilter({ sort });
  const setType = (type: string) => setUrlFilter({ formType: type || null });
  const setPeriod = (period: string) => setUrlFilter({ period: period || null });
  // A region and a department belong together: changing the region clears a
  // department that may not be inside it.
  const setRegion = (region: string) => setUrlFilter({ region, department: null });
  const setDepartment = (department: string) => setUrlFilter({ department });
  const setCampaign = (campaignId: string) => setUrlFilter({ campaignId });
  const setQuarter = (quarterCode: string) => setUrlFilter({ quarterCode });
  const setLate = (late: boolean) => setUrlFilter({ late: late ? "1" : null });
  const setOverdue = (overdue: boolean) => setUrlFilter({ overdue: overdue ? "1" : null });
  const setAssignedToMe = (assignedToMe: boolean) => setUrlFilter({ assignedToMe: assignedToMe ? "1" : null });

  const goToOffset = (next: number) => {
    setOffset(next);
    setSelectedIds(new Set());
  };

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === search) return;
    const timer = setTimeout(() => {
      setSearch(trimmed);
      setOffset(0);
      setSelectedIds(new Set());
      setUrlFilter({ search: trimmed || null, q: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search, setUrlFilter]);

  const page = questionnairesQuery.data;

  const rawItems = page?.items ?? [];
  // Real rows only. An empty result renders an empty state; there is no
  // sample dataset to substitute, and an error never becomes "no dossiers".
  const dossiers: DossierItem[] = rawItems.map((sub: QuestionnaireListItem) => {
    const blockingCount = sub.anomalies?.filter((anomaly) => anomaly.isBlocking && anomaly.status === "OPEN").length ?? 0;
    const warningCount = sub.anomalies?.filter((anomaly) => !anomaly.isBlocking && anomaly.status === "OPEN").length ?? 0;
    const name = resolveEntityName(sub) ?? t("fileFallbackName");

    return {
      id: sub.id,
      submissionId: sub.submissionId || sub.id,
      // Null, not a placeholder name: the entity detail row may be absent.
      companyName: name,
      respondentName: sub.respondent?.respondentName ?? null,
      region: sub.region ?? null,
      department: sub.department ?? null,
      // No default form type — an unset formType is reported, not guessed.
      formType: sub.formType ?? null,
      adminStatus: sub.status ?? null,
      campaignName: sub.campaignName ?? null,
      quarterCode: sub.quarterCode ?? null,
      reviewedBy: sub.reviewedBy ?? null,
      reviewedAt: sub.reviewedAt ?? null,
      rejectionReason: sub.rejectionReason ?? null,
      supersededById: sub.supersededById ?? null,
      archivedAt: sub.archivedAt ?? null,
      archivedBy: sub.archivedBy ?? null,
      archiveReason: sub.archiveReason ?? null,
      archivedByUser: sub.archivedByUser ?? null,
      updatedAt: sub.updatedAt ?? null,
      blockingCount,
      warningCount,
      submittedAt: sub.submissionDate ?? null,
      isLate: sub.isLate === true,
      assigneeId: sub.assigneeId ?? null,
      assigneeName: sub.assigneeName ?? null,
      companyRegistrationStatus: sub.companyRegistrationStatus ?? null,
    };
  });

  const activeFilterChips: Array<{ key: string; label: string; remove: () => void }> = [];
  if (search) activeFilterChips.push({ key: "search", label: `${t("freeSearchLabel")}: ${search}`, remove: () => { setSearchInput(""); setSearch(""); setUrlFilter({ search: null, q: null }); } });
  if (statusFilter) activeFilterChips.push({ key: "status", label: `${t("statusFilterAriaLabel")}: ${t(STATUS_VIEWS.find((v) => v.status === statusFilter)?.labelKey ?? "statusAll")}`, remove: () => setStatus("") });
  if (typeFilter) activeFilterChips.push({ key: "formType", label: `${t("typeColumn")}: ${typeLabel(typeFilter)}`, remove: () => setType("") });
  if (periodFilter) activeFilterChips.push({ key: "period", label: `${t("periodLabel")}: ${t(PERIODS.find((p) => p.value === periodFilter)?.labelKey ?? "allPeriods")}`, remove: () => setPeriod("") });
  if (regionFilter) activeFilterChips.push({ key: "region", label: `${t("regionColumn")}: ${regionFilter}`, remove: () => setRegion("") });
  if (departmentFilter) activeFilterChips.push({ key: "department", label: `${t("departmentLabel")}: ${departmentFilter}`, remove: () => setDepartment("") });
  if (quarterCodeFilter) activeFilterChips.push({ key: "quarterCode", label: `${t("quarterLabel")}: ${quarterCodeFilter}`, remove: () => setQuarter("") });
  if (lateFilter) activeFilterChips.push({ key: "late", label: t("lateOnly"), remove: () => setLate(false) });
  if (overdueFilter) activeFilterChips.push({ key: "overdue", label: t("overdueOnly"), remove: () => setOverdue(false) });
  if (assignedToMeFilter) activeFilterChips.push({ key: "assignedToMe", label: t("assignedToMeOnly"), remove: () => setAssignedToMe(false) });
  if (companyIdFilter) activeFilterChips.push({ key: "companyId", label: `${t("organisationColumn")}: ${companyIdFilter}`, remove: () => setUrlFilter({ companyId: null }) });
  if (sortOrder) activeFilterChips.push({ key: "sort", label: t("sortOldest"), remove: () => setSort("") });
  const clearAllFilters = () => setUrlFilter({ status: null, formType: null, period: null, region: null, department: null, quarterCode: null, late: null, overdue: null, assignedToMe: null, companyId: null, sort: null, search: null, q: null });

  /**
   * Source: GET /admin/questionnaires → `total`.
   * Counts the whole filtered query (territory + status + type + region +
   * period + search, drafts excluded) under the caller's server-side scope —
   * the same scope that produced the rows above. `null` until the server
   * answers; never replaced by a literal.
   */
  const totalCount = page?.total ?? null;
  const pageCount = totalCount === null ? null : Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const firstShown = dossiers.length === 0 ? 0 : offset + 1;
  const lastShown = offset + dossiers.length;

  const tableState = resolveDataState({
    isLoading: questionnairesQuery.isLoading,
    isError: questionnairesQuery.isError,
    error: questionnairesQuery.error,
    rowCount: page?.items.length ?? null,
  });

  // The actor who will sign the operation, from the session's own user record.
  const signatoryLabel = user
    ? `${[user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email} — ${scopeLabel}`
    : NOT_PROVIDED;

  const bulkPreflight = assessBulkEligibility(
    dossiers.map((d) => ({ ...d, status: d.adminStatus })),
    selectedIds,
  );
  const cleanPendingSelected = bulkPreflight.endorsementEligible;
  const bulkEligibleSelected = bulkPreflight.eligible;
  const excludedSelected = bulkPreflight.excluded;
  const rejectableSelected = bulkPreflight.rejectionEligible;
  const correctableSelected = bulkPreflight.correctionEligible;

  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleOpenBulkModal = () => {
    setBulkResult(null);
    bulkMutation.reset();
    setCertifiedBulk(false);
    setBulkNotes("");
    setIsBulkModalOpen(true);
  };

  const handleOpenRejectModal = () => {
    setRejectResult(null);
    rejectMutation.reset();
    setCertifiedReject(false);
    setRejectReason("");
    setIsRejectModalOpen(true);
  };

  const handleConfirmBulkVisa = () => {
    if (!certifiedBulk) return;
    const idsToApprove = cleanPendingSelected.map((d) => d.id);
    bulkMutation.mutate({
      submissionIds: idsToApprove,
      certified: true,
      notes: bulkNotes || undefined,
    });
  };

  const handleConfirmBulkReject = () => {
    if (!certifiedReject || rejectReason.trim().length < 10) return;
    const idsToReject = rejectableSelected.map((d) => d.id);
    rejectMutation.mutate({
      submissionIds: idsToReject,
      reason: rejectReason.trim(),
      certified: true,
    });
  };

  const handleOpenCorrectionModal = () => {
    setCorrectionResult(null);
    correctionMutation.reset();
    setCertifiedCorrection(false);
    setCorrectionReason("");
    setIsCorrectionModalOpen(true);
  };

  const handleConfirmBulkCorrection = () => {
    if (!certifiedCorrection || correctionReason.trim().length < 10) return;
    correctionMutation.mutate({
      submissionIds: correctableSelected.map((d) => d.id),
      reason: correctionReason.trim(),
      certified: true,
    });
  };

  const [exportInProgress, setExportInProgress] = useState(false);

  async function handleExport(fmt: "csv" | "xlsx") {
    if (exportInProgress) return;
    setExportInProgress(true);
    try {
      const params = new URLSearchParams({ format: fmt });
      if (vue === "completed") {
        params.set("statuses", statusFilter === "APPROVED" || statusFilter === "REJECTED" || statusFilter === "SUPERSEDED" ? statusFilter : "APPROVED,REJECTED,SUPERSEDED");
        params.set("includeArchived", String(includeArchived));
      } else if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("formType", typeFilter);
      if (regionFilter) params.set("region", regionFilter);
      if (departmentFilter) params.set("department", departmentFilter);
      if (effectiveCampaignId) params.set("campaignId", effectiveCampaignId);
      if (quarterCodeFilter) params.set("quarterCode", quarterCodeFilter);
      if (lateFilter) params.set("late", "1");
      if (overdueFilter) params.set("overdue", "1");
      if (assignedToMeFilter) params.set("assignedToMe", "1");
      if (periodFilter) params.set("period", periodFilter);
      if (search) params.set("search", search);
      const token = getToken();
      const resp = await fetch(
        `${API_BASE_URL}/admin/questionnaires/export?${params.toString()}`,
        { headers: { ...localeHeader(), ...(token ? { Authorization: `Bearer ${token}` } : {}) } },
      );
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.message ?? t("exportFailedStatus", { status: resp.status }));
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `dossiers_${date}.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(t("exportFailed", { message: msg }));
    } finally {
      setExportInProgress(false);
    }
  }

  const legacyFilterClear = {
    status: null, sort: null, companyId: null, region: null, department: null,
    quarterCode: null, late: null, overdue: null, assignedToMe: null,
    formType: null, period: null, search: null, q: null, includeArchived: null,
  };
  const viewHref = (target: "submissions" | "completed" | "coverage") =>
    hrefWith(pathname, searchParams.toString(), { ...legacyFilterClear, vue: target });

  const pageHeader = (
    <AdminPageHeader
      title={t("pageTitle")}
      subtitle={t("pageSubtitle")}
      actions={(
        <div className="cam-dossier-header-actions">
          <label className="cam-dossier-campaign">
            <span>{t("campaignLabel")}</span>
            <select
              className="cam-admin-input"
              value={effectiveCampaignId}
              onChange={(event) => setCampaign(event.target.value)}
              aria-label={t("campaignLabel")}
            >
              {campaignOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <AdminHeaderActions showCampaignPill={false} />
        </div>
      )}
      tabs={[
        {
          label: t("viewSubmissions"),
          href: viewHref("submissions"),
          isActive: activeView === "submissions",
          badge: selectAdminViewCounts(queues?.countsView, "queue", queues?.totalSubmissionsCount) ?? undefined,
        },
        {
          label: t("viewCompleted"),
          href: viewHref("completed"),
          isActive: activeView === "completed",
        },
        {
          label: t("viewCoverage"),
          href: viewHref("coverage"),
          isActive: activeView === "coverage",
        },
      ]}
    />
  );

  if (vue === "coverage") {
    return (
      <>
        {showPageHeader && pageHeader}
        <section id="dossier-view-coverage" className="cam-dossier-view cam-dossier-view--coverage">
          <div className="cam-dossier-section-heading"><h2 id="dossiers-coverage-heading">{t("viewCoverage")}</h2></div>
          <AdminTablePanel
            headingId="dossiers-coverage-heading"
            showHeader={false}
            cardClassName="cam-dossier-coverage-card"
          >
            <CardContent className="cam-dossier-coverage-table">
              <DossiersCoverage
                campaignId={effectiveCampaignId}
                onCampaignChange={setCampaign}
                regionFilter={regionFilter}
                searchTerm={searchInput}
                onRegionChange={setRegion}
                onSearchChange={setSearchInput}
                showCampaignControls={false}
              />
            </CardContent>
          </AdminTablePanel>
        </section>
      </>
    );
  }

  return (
    <section id={`dossier-view-${vue}`} className={`cam-dossier-view cam-dossier-view--${vue}`}>
      {showPageHeader && pageHeader}
      {reopenNotice && <Alert variant="success" className="my-4"><AlertDescription>{reopenNotice}</AlertDescription></Alert>}
      {assignNotice && <Alert variant="destructive" className="my-4"><AlertDescription>{assignNotice}</AlertDescription></Alert>}
      {archiveNotice && <Alert variant="destructive" className="my-4"><AlertDescription>{archiveNotice}</AlertDescription></Alert>}

      {vue === "submissions" && (
        <section className="cam-dossier-kpis" aria-label={t("viewSubmissions")}>
          <div className="cam-dossier-kpi cam-dossier-kpi--blue">
            <span className="cam-dossier-kpi-icon"><FileText size={17} aria-hidden="true" /></span>
            <div><span>{t("statusPending")}</span><strong>{count(queueStatusCounts?.PENDING_REVIEW, locale)}</strong></div>
          </div>
          <div className="cam-dossier-kpi cam-dossier-kpi--green">
            <span className="cam-dossier-kpi-icon"><Check size={17} aria-hidden="true" /></span>
            <div><span>{t("statusEndorsed")}</span><strong>{count(queueStatusCounts?.APPROVED, locale)}</strong></div>
          </div>
          <div className="cam-dossier-kpi cam-dossier-kpi--red">
            <span className="cam-dossier-kpi-icon"><CircleX size={17} aria-hidden="true" /></span>
            <div><span>{t("statusRejected")}</span><strong>{count(queueStatusCounts?.REJECTED, locale)}</strong></div>
          </div>
          <div className="cam-dossier-kpi cam-dossier-kpi--amber">
            <span className="cam-dossier-kpi-icon"><RotateCcw size={17} aria-hidden="true" /></span>
            <div><span>{t("statusCorrections")}</span><strong>{count(queueStatusCounts?.CORRECTION_REQUESTED, locale)}</strong></div>
          </div>
          <div className="cam-dossier-kpi cam-dossier-kpi--blue" title={!effectiveCampaignId ? t("responseRateNeedsCampaign") : undefined}>
            <span className="cam-dossier-kpi-icon"><Percent size={17} aria-hidden="true" /></span>
            <div><span>{tRoot("adminTargets.responseRateColumn")}</span><strong>{responseRateValue}</strong></div>
          </div>
        </section>
      )}

      <ViewSwitch
        label={t("statusFilterAriaLabel")}
        items={(vue === "completed" ? STATUS_VIEWS.filter((view) => !view.status || ["APPROVED", "REJECTED", "SUPERSEDED"].includes(view.status)) : STATUS_VIEWS.filter((view) => view.status !== "SUPERSEDED")).map((view) => {
          const expectedView = vue === "completed" ? "completed" : "queue";
          const statusCounts = selectAdminViewCounts(queues?.countsView, expectedView, queues?.statusCounts as Partial<Record<DossierStatus, number>> | undefined);
          const value = view.status
            ? statusCounts?.[view.status]
            : selectAdminViewCounts(queues?.countsView, expectedView, queues?.totalSubmissionsCount) ?? undefined;
          return {
            key: view.status || "all",
            label: t(view.labelKey),
            active: statusFilter === view.status,
            count: value ?? null,
            onClick: () => setStatus(view.status),
          };
        })}
      />

      {vue !== "completed" && queues && queues.reviewDelay.pendingOverThresholdCount > 0 && (
        <Alert variant="warning" className="my-4">
          <AlertDescription>
            {t("reviewDelayBanner", { count: queues.reviewDelay.pendingOverThresholdCount })}{" "}
            <Link
              href={hrefWith(pathname, searchParams.toString(), {
                status: "PENDING_REVIEW",
                overdue: "1",
                sort: "oldest",
              })}
            >
              {t("reviewDelayLink")}
            </Link>
          </AlertDescription>
        </Alert>
      )}


      {/* ── Status filter: one control, URL-backed (?status=) ── */}
      {/* The queue's own note, carried over from /admin/files-attente. Shown
          only for the status it describes. */}
      {STATUS_VIEWS.filter((view) => vue === "submissions" && view.noteKey && view.status === statusFilter).map((view) => (
        <Alert key={view.labelKey} variant="info" className="my-4">
          <AlertDescription>{view.noteKey && t(view.noteKey)}</AlertDescription>
        </Alert>
      ))}

      {/* ── Filters, toolbar and table: one card, so the controls read as
          belonging to the list they act on. The filter row wraps rather than
          overflowing, the way the fixed four-column grid it replaces did. ──
          Statut is not here: the control above sets it. */}
      <AdminTablePanel
        headingId={`dossiers-${vue}-heading`}
        showHeader={false}
        cardClassName={vue === "submissions" ? "cam-dossier-submissions-card" : vue === "completed" ? "cam-dossier-completed-card" : undefined}
      >
        {vue === "submissions" && !readOnly && selectedIds.size > 0 && (
          <CardContent className="flex flex-wrap items-center gap-3 border-b pt-6" aria-live="polite">
            <>
              <span className="text-sm font-medium text-foreground">{t("selectionEligibleSummary", { selected: selectedIds.size, eligible: bulkEligibleSelected.length, excluded: excludedSelected.length })}</span>
              {excludedSelected.length > 0 && <details className="text-sm"><summary className="cursor-pointer underline">{t("whyExcluded")}</summary><ul className="mt-2 list-disc ps-5">{excludedSelected.map((d) => <li key={d.id}>{t("excludedRecordReason", { name: d.companyName ?? d.submissionId, reason: d.blockingCount > 0 ? t("blockingAnomalies", { count: d.blockingCount }) : t("notBulkEligibleReason") })}</li>)}</ul></details>}
              <Button type="button" size="sm" onClick={handleOpenBulkModal} disabled={bulkEligibleSelected.length === 0 || cleanPendingSelected.length === 0}><span aria-hidden="true">✓</span> {t("endorseSelectionButton")}</Button>
              <Button type="button" size="sm" variant="outline" onClick={handleOpenCorrectionModal} disabled={correctableSelected.length === 0}>{t("requestCorrectionSelectionButton")}</Button>
              <Button type="button" size="sm" variant="destructive" onClick={handleOpenRejectModal} disabled={bulkEligibleSelected.length === 0 || rejectableSelected.length === 0}><span aria-hidden="true">×</span> {t("rejectSelectionButton")}</Button>
            </>
          </CardContent>
        )}
        {vue === "submissions" && <CardContent className="cam-dossier-submissions-card-heading">
          <h2 id={`dossiers-${vue}-heading`}>{t("queueHeading")}</h2>
          {!readOnly && <Button type="button" size="sm" variant="outline" onClick={() => handleExport("csv")} disabled={exportInProgress}><Download aria-hidden="true" />{t("exportButton")}</Button>}
        </CardContent>}
        {vue === "completed" && <CardContent className="cam-dossier-completed-heading">
          <h2 id={`dossiers-${vue}-heading`}>{t("completedHeading")}</h2>
          {!readOnly && <Button type="button" size="sm" variant="outline" onClick={() => handleExport("csv")} disabled={exportInProgress}><Download aria-hidden="true" />{t("exportButton")}</Button>}
        </CardContent>}
        {vue !== "submissions" && vue !== "completed" && !readOnly && <CardContent className="flex justify-end border-b pt-4"><Button type="button" size="sm" variant="outline" onClick={() => handleExport("csv")} disabled={exportInProgress}><Download aria-hidden="true" />{t("exportButton")}</Button></CardContent>}
        {vue === "completed" && <CardContent className="cam-dossier-completed-archive-filter"><label className="flex items-center gap-2 text-sm"><Checkbox checked={includeArchived} onCheckedChange={(checked) => setUrlFilter({ includeArchived: checked === true ? "true" : "false" })} />{t("showArchived")}</label></CardContent>}
        <CardContent className={`border-b pt-5${vue === "submissions" ? " cam-dossier-submissions-filters" : vue === "completed" ? " cam-dossier-completed-filters" : ""}`}>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2"><Label className={vue === "submissions" ? "sr-only" : undefined} htmlFor={`dossiers-search-${vue}`}>{t("freeSearchLabel")}</Label><Input id={`dossiers-search-${vue}`} type="search" placeholder={t("freeSearchPlaceholder")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div>
            {vue !== "submissions" && vue !== "completed" && <div><Label htmlFor="dossiers-status">{t("statusFilterAriaLabel")}</Label><select id="dossiers-status" className="cam-admin-input w-full" value={statusFilter} onChange={(event) => setStatus(event.target.value as DossierStatus | "")}>
              <option value="">{t("statusAll")}</option>
              {(vue === "completed" ? ["APPROVED", "REJECTED", "SUPERSEDED"] : ["PENDING_REVIEW", "CORRECTION_REQUESTED", "APPROVED", "REJECTED"]).map((status) => <option key={status} value={status}>{t(STATUS_VIEWS.find((view) => view.status === status)?.labelKey ?? "statusAll")}</option>)}
            </select></div>}
            <div><Label className={vue === "submissions" ? "sr-only" : undefined} htmlFor={`dossiers-region-${vue}`}>{t("regionLabel")}</Label><select id={`dossiers-region-${vue}`} className="cam-admin-input w-full" value={regionFilter} onChange={(event) => setRegion(event.target.value)}><option value="">{t("allRegions")}</option>{territoryRegions.map((region) => <option key={region} value={region}>{region}</option>)}</select></div>
            {vue === "submissions" && <div className="cam-dossier-submissions-clear"><Button type="button" size="sm" variant="outline" disabled={activeFilterChips.length === 0} onClick={clearAllFilters}>{t("clearFilters")}</Button></div>}
          </div>
          <details className="mt-3"><summary className="cursor-pointer text-sm font-medium">{t("moreFilters")}</summary><div className="mt-3 grid gap-3 md:grid-cols-4">
            <div><Label htmlFor={`dossiers-type-${vue}`}>{t("typeColumn")}</Label><select id={`dossiers-type-${vue}`} className="cam-admin-input w-full" value={typeFilter} onChange={(event) => setType(event.target.value)}><option value="">{t("allFormTypes")}</option>{FORM_TYPES.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}</select></div>
            <div><Label htmlFor={`dossiers-period-${vue}`}>{t("periodLabel")}</Label><select id={`dossiers-period-${vue}`} className="cam-admin-input w-full" value={periodFilter} onChange={(event) => setPeriod(event.target.value)}><option value="">{t("allPeriods")}</option>{PERIODS.map((period) => <option key={period.value} value={period.value}>{t(period.labelKey)}</option>)}</select></div>
            <div><Label htmlFor={`dossiers-department-${vue}`}>{t("departmentLabel")}</Label><select id={`dossiers-department-${vue}`} className="cam-admin-input w-full" value={departmentFilter} onChange={(event) => setDepartment(event.target.value)}><option value="">{t("allDepartments")}</option>{territoryDepartments.map((department) => <option key={department} value={department}>{department}</option>)}</select></div>
            <div><Label htmlFor={`dossiers-quarter-${vue}`}>{t("quarterLabel")}</Label><select id={`dossiers-quarter-${vue}`} className="cam-admin-input w-full" value={quarterCodeFilter} onChange={(event) => setQuarter(event.target.value)}><option value="">{t("allQuarters")}</option>{quarterOptions.map((code) => <option key={code} value={code}>{quarterLabel(code)}</option>)}</select></div>
            <div><Label htmlFor={`dossiers-late-${vue}`}>{t("lateLabel")}</Label><select id={`dossiers-late-${vue}`} className="cam-admin-input w-full" value={lateFilter ? "1" : ""} onChange={(event) => setLate(event.target.value === "1")}><option value="">{t("lateAll")}</option><option value="1">{t("lateOnly")}</option></select></div>
            <div><Label htmlFor={`dossiers-overdue-${vue}`}>{t("overdueLabel")}</Label><select id={`dossiers-overdue-${vue}`} className="cam-admin-input w-full" value={overdueFilter ? "1" : ""} onChange={(event) => setOverdue(event.target.value === "1")}><option value="">{t("overdueAll")}</option><option value="1">{t("overdueOnly")}</option></select></div>
            <div><Label htmlFor={`dossiers-assigned-${vue}`}>{t("assignedLabel")}</Label><select id={`dossiers-assigned-${vue}`} className="cam-admin-input w-full" value={assignedToMeFilter ? "1" : ""} onChange={(event) => setAssignedToMe(event.target.value === "1")}><option value="">{t("assignedAll")}</option><option value="1">{t("assignedToMeOnly")}</option></select></div>
            <div><Label htmlFor={`dossiers-sort-${vue}`}>{t("sortLabel")}</Label><select id={`dossiers-sort-${vue}`} className="cam-admin-input w-full" value={sortOrder || "newest"} onChange={(event) => setSort(parseDossierSort(event.target.value === "newest" ? "" : event.target.value))}><option value="newest">{t("sortNewest")}</option><option value="oldest">{t("sortOldest")}</option></select></div>
          </div></details>
          {activeFilterChips.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={t("activeFiltersLabel")}><span className="text-sm font-medium">{t("activeFiltersLabel")}</span>{activeFilterChips.map((chip) => <Button type="button" key={chip.key} variant="outline" size="sm" onClick={chip.remove} aria-label={t("removeFilterChip", { label: chip.label })}>{chip.label}<X className="ms-2 size-3" aria-hidden="true" /></Button>)}{vue !== "submissions" && <Button type="button" variant="ghost" size="sm" onClick={clearAllFilters}>{t("clearFilters")}</Button>}</div>}
        </CardContent>
        <CardContent className={`overflow-x-auto pt-5${vue === "submissions" ? " cam-dossier-submissions-table" : vue === "completed" ? " cam-dossier-completed-table" : ""}`}>
          <Table>
            <TableHeader><TableRow>
              {vue === "completed" ? <>
                <TableHead scope="col">{t("organisationColumn")}</TableHead>
                <TableHead scope="col">{t("decisionColumn")}</TableHead>
                <TableHead scope="col">{t("decisionDateColumn")}</TableHead>
                <TableHead scope="col">{t("decidedByColumn")}</TableHead>
                <TableHead scope="col">{t("campaignPeriodColumn")}</TableHead>
                <TableHead scope="col">{t("actionsColumn")}</TableHead>
              </> : <>
                <TableHead className="cam-dossier-select-column"><span className="sr-only">{t("actionsColumn")}</span></TableHead>
                <TableHead scope="col">{t("organisationReferenceColumn")}</TableHead>
                <TableHead scope="col">{t("submissionPeriodColumn")}</TableHead>
                <TableHead scope="col">{t("adminStatusColumn")}</TableHead>
                <TableHead scope="col" title={t("dataIssuesHelp")}>{t("dataQualityColumn")}</TableHead>
                <TableHead scope="col">{t("statisticalEligibilityColumn")}</TableHead>
                <TableHead scope="col">{t("submittedOnColumn")}</TableHead>
                <TableHead scope="col">{t("assignedToColumn")}</TableHead>
                <TableHead scope="col">{t("actionsColumn")}</TableHead>
              </>}
            </TableRow></TableHeader>
            <TableBody>
              <DataStateRow colSpan={vue === "completed" ? 6 : 9} state={tableState} resource={t("filesResource")} error={questionnairesQuery.error} onRetry={() => questionnairesQuery.refetch()} title={tableState === "empty" ? t("noFilesTitle") : undefined} hint={tableState === "empty" ? t("noFilesHint") : undefined} />
              {dossiers.map((d) => {
                const visaBadge: { label: string; tone: ToneName } = d.adminStatus === "APPROVED" ? { label: t("badgeEndorsed"), tone: "success" } : d.adminStatus === "CORRECTION_REQUESTED" ? { label: t("badgeCorrection"), tone: "info" } : d.adminStatus === "REJECTED" ? { label: t("badgeRejected"), tone: "error" } : d.adminStatus === "PENDING_REVIEW" ? { label: t("badgePending"), tone: "warning" } : d.adminStatus === "SUPERSEDED" ? { label: t("badgeSuperseded"), tone: "neutral" } : { label: t("badgeNoStatus"), tone: "neutral" };
                const qualityTone: ToneName = d.blockingCount > 0 ? "error" : d.warningCount > 0 ? "warning" : "neutral";
                const qualityText = d.blockingCount > 0 ? t("blockingAnomalies", { count: d.blockingCount }) : d.warningCount > 0 ? t("warnings", { count: d.warningCount }) : t("noAnomaly");
                const eligibility: "eligible" | "notEligible" | "pending" = d.adminStatus === "APPROVED" ? (d.blockingCount === 0 ? "eligible" : "notEligible") : d.adminStatus === "REJECTED" || d.adminStatus === "SUPERSEDED" ? "notEligible" : "pending";
                const eligibilityText = eligibility === "eligible" ? t("eligible") : eligibility === "notEligible" ? t("notEligible") : t("eligibilityPending");
                const orgStatus = d.companyRegistrationStatus ? ORG_STATUS_BADGE[d.companyRegistrationStatus] : null;
                const orgStatusNode = d.companyRegistrationStatus ? <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">{t("orgStatusLabel")} :{orgStatus ? <Badge variant={BADGE_VARIANT[orgStatus.tone]}>{t(orgStatus.textKey)}</Badge> : <Badge variant="neutral">{d.companyRegistrationStatus}</Badge>}</span> : null;
                const reviewerName = readableActor(d.reviewedBy);
                const campaignName = d.campaignName ? formatCampaignDisplayName(d.campaignName) : NOT_PROVIDED;
                const shortCampaignName = d.campaignName ? formatCampaignShortName(d.campaignName) : NOT_PROVIDED;
                const periodLabel = d.quarterCode ? referencePeriodLabel(d.quarterCode, locale) : NOT_PROVIDED;
                return vue === "completed" ? <TableRow key={d.id}>
                  <TableCell className="align-top whitespace-normal p-3 font-medium"><span className="line-clamp-1" title={d.companyName ?? NOT_PROVIDED}>{d.companyName ?? NOT_PROVIDED}</span>{orgStatusNode}</TableCell>
                  <TableCell className="align-top whitespace-normal p-3"><Badge variant={BADGE_VARIANT[visaBadge.tone]}>{visaBadge.label}</Badge>{d.rejectionReason && <span className="line-clamp-2 max-w-[200px] text-xs text-muted-foreground" title={d.rejectionReason}>{d.rejectionReason}</span>}</TableCell>
                  <TableCell className="align-top whitespace-normal p-3">{stamp(d.reviewedAt, true, locale)}</TableCell>
                  <TableCell className="align-top whitespace-normal p-3">{reviewerName ?? NOT_PROVIDED}</TableCell>
                  <TableCell className="align-top whitespace-normal p-3"><span className="line-clamp-2" title={campaignName}>{shortCampaignName}</span><span className="block text-sm text-muted-foreground">{periodLabel}</span></TableCell>
                  <TableCell className="align-top whitespace-normal p-3"><div className="flex flex-wrap items-center gap-3"><Link href={`/admin/dossiers/${encodeURIComponent(d.id)}${includeArchived ? "?includeArchived=true" : ""}`} className="text-sm underline">{t("openFileButton")}</Link>{canReadAudit && <Link className="text-sm underline" href={`/admin/journal-audit?resourceId=${encodeURIComponent(d.id)}`}>{t("historyLink")}</Link>}<ArchiveActions archived={!!d.archivedAt} canManage={hasRole(user?.role, DOSSIER_ARCHIVE_ROLES)} resourceName={d.companyName ?? d.submissionId} archiveLabel={t("archiveButton")} restoreLabel={t("restoreButton")} confirmTitle={t("archiveConfirmTitle")} reasonLabel={t("archiveReasonLabel")} cancelLabel={tRoot("common.cancel")} onArchive={(reason) => archiveMutation.mutate({ item: d, reason })} onRestore={() => restoreMutation.mutate(d.id)} />{canReopen && d.adminStatus === "APPROVED" && <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => { setReopenNotice(""); reopenMutation.reset(); setReopenTarget(d); setReopenReason(""); setCertifiedReopen(false); }}>{t("reopenButton")}</Button>}</div></TableCell>
                </TableRow> : <TableRow key={d.id}>
                  <TableCell className="cam-dossier-select-column align-top">{!readOnly && <Checkbox className="mt-1 shrink-0" checked={selectedIds.has(d.id)} onCheckedChange={(checked) => toggleSelect(d.id, checked === true)} aria-label={t("selectRowAria", { name: d.companyName ?? d.respondentName ?? d.submissionId })} />}</TableCell>
                  <TableCell className="align-top whitespace-normal p-3 font-medium"><div className="min-w-0"><span className="line-clamp-1" title={d.companyName ?? d.submissionId}>{d.companyName ?? d.submissionId}</span>{orgStatusNode}<div className="line-clamp-1 text-xs text-muted-foreground" title={`${d.respondentName ?? NOT_PROVIDED} · ${d.formType ? typeLabel(d.formType) : NOT_PROVIDED}`}>{d.respondentName ?? NOT_PROVIDED} · {d.formType ? typeLabel(d.formType) : NOT_PROVIDED}</div></div></TableCell>
                  <TableCell className="align-top whitespace-normal p-3"><span className="line-clamp-1 break-all" title={d.submissionId}>{d.submissionId}</span><span className="line-clamp-2 text-sm text-muted-foreground" title={`${campaignName} · ${periodLabel}`}>{shortCampaignName} · {periodLabel}</span></TableCell>
                  <TableCell className="align-top whitespace-normal p-3"><Badge variant={BADGE_VARIANT[visaBadge.tone]}>{visaBadge.label}</Badge></TableCell>
                  <TableCell className="align-top whitespace-normal p-3"><Badge variant={BADGE_VARIANT[qualityTone]}>{qualityText}</Badge></TableCell>
                  <TableCell className="align-top whitespace-normal p-3"><Badge variant={eligibility === "eligible" ? "success" : eligibility === "pending" ? "warning" : "neutral"}>{eligibilityText}</Badge></TableCell>
                  <TableCell className="align-top whitespace-normal p-3">{stamp(d.submittedAt, true, locale)}{d.isLate && <Badge variant="warning" className="ms-2">{t("lateBadge")}</Badge>}</TableCell>
                  <TableCell className="align-top whitespace-normal p-3"><div className="flex flex-wrap items-center gap-2">{d.assigneeId ? <span>{t("assignedTo", { name: d.assigneeName ?? NOT_PROVIDED })}</span> : <span>{t("unassigned")}</span>}{!readOnly && !d.archivedAt && (d.assigneeId == null || d.assigneeId === user?.id) && <Button type="button" variant="link" size="sm" className="h-auto px-0" disabled={assignMutation.isPending} onClick={() => assignMutation.mutate({ id: d.id, assigneeId: d.assigneeId ? null : user?.id ?? null })}>{d.assigneeId ? t("unclaimButton") : t("claimButton")}</Button>}</div></TableCell>
                  <TableCell className="align-top whitespace-normal p-3"><Link href={`/admin/dossiers/${encodeURIComponent(d.id)}`} className="text-sm underline">{t("openFileButton")}</Link></TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
        </CardContent>
      </AdminTablePanel>
      {/* Pagination driven by the server-reported `total` for the same
          filtered query. The range reflects the rows actually returned, and
          the page count is whatever the real total implies. */}
      <div className="flex flex-wrap items-center justify-end gap-4 py-4 text-sm text-muted-foreground">
        <span>
          {totalCount === null
            ? NOT_PROVIDED
            : totalCount === 0
              ? t("zeroSubmissions")
              : t("showingRange", {
                  first: count(firstShown, locale),
                  last: count(lastShown, locale),
                  total: count(totalCount, locale),
                  count: totalCount,
                })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={offset === 0}
          onClick={() => goToOffset(Math.max(0, offset - PAGE_SIZE))}
        >
          {t("previousButton")}
        </Button>
        <span>
          {pageCount === null ? t("pageNumber", { page: currentPage }) : t("pageOf", { page: currentPage, pages: pageCount })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pageCount === null || currentPage >= pageCount}
          onClick={() => goToOffset(offset + PAGE_SIZE)}
        >
          {t("nextButton")}
        </Button>
      </div>

      {/* ── Bulk visa. AdminDialog is a native <dialog>, so the focus trap,
          Escape, inert background and focus return that the fixed-position
          overlay here declared with aria-modal but never implemented now
          actually hold. It is deliberately NOT replaced by the component
          library: this is the console's most consequential confirmation, and
          its chrome is already audited. Only the controls inside it moved. ── */}
      <AdminDialog
        open={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title={t("bulkEndorseTitle")}
        eyebrow={t("bulkEndorseCount", { count: cleanPendingSelected.length })}
        footer={
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => setIsBulkModalOpen(false)}>
              {tRoot("common.cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmBulkVisa}
              disabled={!certifiedBulk || bulkMutation.isPending}
            >
              {bulkMutation.isPending ? t("validating") : t("confirmEndorsement")}
            </Button>
          </>
        }
      >
        <p>{t("confirmSelectedDecision", { decision: t("bulkEndorseAction"), count: cleanPendingSelected.length, records: cleanPendingSelected.map((d) => d.companyName ?? d.submissionId).join(", ") })}</p>
        <div className="flex items-start gap-3">
          <Checkbox
            id="bulk-endorse-certify"
            checked={certifiedBulk}
            onCheckedChange={(c) => setCertifiedBulk(c === true)}
          />
          <Label htmlFor="bulk-endorse-certify" className="font-normal leading-snug">
            {t("bulkEndorseCertify")}
          </Label>
        </div>

        {/* Signatory is the signed-in actor. The authoritative timestamp is
            the one the server returns with the operation, so none is
            predicted before confirmation. */}
        <Card className="mt-4">
          <CardContent>
            <div className="text-sm text-muted-foreground">{t("signatoryLabel")}</div>
            <div className="font-medium text-foreground">{signatoryLabel}</div>
          </CardContent>
        </Card>

        {/* The real outcome of the operation, as reported by the server. */}
        {bulkResult && (
          <Alert variant="success" className="mt-3">
            <AlertDescription>
              <div>
                <strong>
                  {t("bulkEndorseResult", {
                    endorsed: count(bulkResult.processedCount, locale),
                    skipped: count(bulkResult.rejectedCount, locale),
                  })}
                </strong>
                <div>{t("operationTimestamped", { date: stamp(bulkResult.timestamp, true, locale) })}</div>
                {bulkResult.rejectedItems?.length > 0 && (
                  <ul className="mt-2 ps-4 list-disc">
                    {bulkResult.rejectedItems.map((item: { id: string; reason: string }) => (
                      <li key={item.id}>{item.id} — {item.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {bulkMutation.isError && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>
              {t("bulkEndorseFailed", { message: (bulkMutation.error as Error)?.message ?? t("unknownError") })}
            </AlertDescription>
          </Alert>
        )}

        <p className="mt-3 mb-0 text-sm text-muted-foreground">
          {t("bulkEndorseAudit")}
        </p>
      </AdminDialog>

      {/* ── Bulk reject (retained widget) ── */}
      <AdminDialog
        open={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title={t("bulkRejectTitle")}
        eyebrow={t("territoryLine", { scope: scopeLabel })}
        footer={
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => setIsRejectModalOpen(false)}>
              {rejectResult ? t("closeButton") : tRoot("common.cancel")}
            </Button>
            {!rejectResult && rejectableSelected.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleConfirmBulkReject}
                disabled={!certifiedReject || rejectReason.trim().length < 10 || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? t("rejecting") : t("rejectCountButton", { count: rejectableSelected.length })}
              </Button>
            )}
          </>
        }
      >
        {rejectResult ? (
          <Alert variant="destructive">
            <AlertDescription>
              <div>
                <strong>{t("bulkRejectResult", { count: count(rejectResult.rejectedCount ?? rejectResult.processedCount, locale) })}</strong>{" "}
                {t("bulkRejectLogged", { date: stamp(rejectResult.timestamp, true, locale) })}
              </div>
            </AlertDescription>
          </Alert>
        ) : rejectableSelected.length === 0 ? (
          <p className="cam-admin-empty">{t("noneRejectable")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="m-0">
              {t("bulkRejectIntroBefore")} <strong>{t("bulkRejectIntroCount", { count: rejectableSelected.length })}</strong>{" "}
              {t("bulkRejectIntroAfter", { count: rejectableSelected.length })}
            </p>
            <p className="m-0 text-sm text-muted-foreground">{t("confirmSelectedDecision", { decision: t("bulkRejectAction"), count: rejectableSelected.length, records: rejectableSelected.map((d) => d.companyName ?? d.submissionId).join(", ") })}</p>

            <div className="grid gap-2">
              <Label htmlFor="bulk-reject-reason">
                {t("bulkRejectReasonLabel")} <span aria-hidden="true">*</span>
              </Label>
              <Textarea
                id="bulk-reject-reason"
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("bulkRejectReasonPlaceholder")}
              />
              {rejectReason.trim().length > 0 && rejectReason.trim().length < 10 && (
                <p className="cam-field-error m-0">
                  {t("reasonTooShort", { length: rejectReason.trim().length })}
                </p>
              )}
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="bulk-reject-certify"
                checked={certifiedReject}
                onCheckedChange={(c) => setCertifiedReject(c === true)}
              />
              {/* One <span>, not two children: Label is `flex items-center
                  gap-2`, so a bare <strong> beside the text becomes a second
                  flex item and the sentence breaks into two columns. */}
              <Label htmlFor="bulk-reject-certify" className="font-normal leading-snug">
                <span>
                  <strong>{t("certifyStrong")}</strong> {t("bulkRejectCertifyRest", { count: rejectableSelected.length })}
                </span>
              </Label>
            </div>

            {rejectMutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {t("bulkRejectFailed", { message: (rejectMutation.error as Error)?.message ?? t("unknownErrorCapital") })}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </AdminDialog>

      {/* ── Bulk request correction (phase 5) ── */}
      <AdminDialog
        open={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        title={t("bulkCorrectionTitle")}
        eyebrow={t("territoryLine", { scope: scopeLabel })}
        footer={
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => setIsCorrectionModalOpen(false)}>
              {correctionResult ? t("closeButton") : tRoot("common.cancel")}
            </Button>
            {!correctionResult && correctableSelected.length > 0 && (
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmBulkCorrection}
                disabled={!certifiedCorrection || correctionReason.trim().length < 10 || correctionMutation.isPending}
              >
                {correctionMutation.isPending ? t("correcting") : t("requestCorrectionCountButton", { count: correctableSelected.length })}
              </Button>
            )}
          </>
        }
      >
        {correctionResult ? (
          <Alert variant="success">
            <AlertDescription>
              <div>
                <strong>{t("bulkCorrectionResult", { count: count(correctionResult.processedCount, locale) })}</strong>{" "}
                {t("operationTimestamped", { date: stamp(correctionResult.timestamp, true, locale) })}
              </div>
              {correctionResult.skippedCount > 0 && (
                <div className="mt-2">{t("bulkCorrectionSkipped", { count: count(correctionResult.skippedCount, locale) })}</div>
              )}
              {correctionResult.skippedItems?.length > 0 && (
                <ul className="mt-2 ps-4 list-disc">
                  {correctionResult.skippedItems.map((item: { id: string; reason: string }) => (
                    <li key={item.id}>{item.id} — {item.reason}</li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        ) : correctableSelected.length === 0 ? (
          <p className="cam-admin-empty">{t("noneCorrectable")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="m-0">
              {t("bulkCorrectionIntro", { count: correctableSelected.length })}
            </p>
            <p className="m-0 text-sm text-muted-foreground">{t("confirmSelectedDecision", { decision: t("bulkCorrectionAction"), count: correctableSelected.length, records: correctableSelected.map((d) => d.companyName ?? d.submissionId).join(", ") })}</p>

            <div className="grid gap-2">
              <Label htmlFor="bulk-correction-reason">
                {t("bulkCorrectionReasonLabel")} <span aria-hidden="true">*</span>
              </Label>
              <Textarea
                id="bulk-correction-reason"
                rows={3}
                required
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder={t("bulkCorrectionReasonPlaceholder")}
              />
              {correctionReason.trim().length > 0 && correctionReason.trim().length < 10 && (
                <p className="cam-field-error m-0">
                  {t("reasonTooShort", { length: correctionReason.trim().length })}
                </p>
              )}
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="bulk-correction-certify"
                checked={certifiedCorrection}
                onCheckedChange={(c) => setCertifiedCorrection(c === true)}
              />
              <Label htmlFor="bulk-correction-certify" className="font-normal leading-snug">
                <span>
                  <strong>{t("certifyStrong")}</strong> {t("bulkCorrectionCertifyRest", { count: correctableSelected.length })}
                </span>
              </Label>
            </div>

            {correctionMutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {t("bulkCorrectionFailed", { message: (correctionMutation.error as Error)?.message ?? t("unknownErrorCapital") })}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </AdminDialog>
      <AdminDialog
        open={!!reopenTarget}
        onClose={() => setReopenTarget(null)}
        title={t("reopenConfirmTitle")}
        eyebrow={reopenTarget?.companyName ?? ""}
        footer={<>
          <Button type="button" size="sm" variant="outline" onClick={() => setReopenTarget(null)}>{tRoot("common.cancel")}</Button>
          <Button type="button" size="sm" onClick={() => reopenMutation.mutate()} disabled={!certifiedReopen || reopenReason.trim().length < 10 || reopenMutation.isPending}>{reopenMutation.isPending ? t("reopening") : t("confirmReopen")}</Button>
        </>}
      >
        <div className="grid gap-4">
          <p className="m-0">{reopenTarget && t("confirmSelectedDecision", { decision: t("reopenButton").toLowerCase(), count: 1, records: reopenTarget.companyName ?? reopenTarget.submissionId })}</p>
          <div className="grid gap-2"><Label htmlFor="completed-reopen-reason">{t("reopenReasonLabel")}</Label><Textarea id="completed-reopen-reason" rows={3} value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder={t("reopenReasonPlaceholder")} />{reopenReason.trim().length > 0 && reopenReason.trim().length < 10 && <p className="cam-field-error m-0">{t("reasonTooShort", { length: reopenReason.trim().length })}</p>}</div>
          <div className="flex items-start gap-3"><Checkbox id="completed-reopen-certify" checked={certifiedReopen} onCheckedChange={(checked) => setCertifiedReopen(checked === true)} /><Label htmlFor="completed-reopen-certify" className="font-normal leading-snug">{t("reopenCertify")}</Label></div>
          {reopenMutation.isError && <Alert variant="destructive"><AlertDescription>{t("reopenFailed", { message: (reopenMutation.error as Error)?.message ?? t("unknownError") })}</AlertDescription></Alert>}
        </div>
      </AdminDialog>
    </section>
  );
}
