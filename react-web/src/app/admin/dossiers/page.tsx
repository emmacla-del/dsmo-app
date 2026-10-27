"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, X } from "lucide-react";
import { API_BASE_URL, bulkVisaDeclarations, bulkRejectDeclarations, getPilotageQueuesForView, getToken, listAdminQuestionnaires, localeHeader, reopenDossierForCorrection } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { resolveEntityName, type NamedSubmission } from "@/lib/onefop-entity-name";
import { assessBulkEligibility } from "@/lib/dossier-bulk-eligibility";
import { selectAdminViewCounts } from "@/lib/admin-view-counts";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataStateRow } from "@/components/admin/DataState";
import { DossiersCoverage } from "@/components/admin/DossiersCoverage";
import { ViewSwitch } from "@/components/admin/ViewSwitch";
import { useTerritoryDepartments, useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { formatCampaignDisplayName } from "@/lib/campaigns";
import { referencePeriodLabel } from "@/lib/onefop-period-label";
import { getActiveCollectionCampaigns } from "@/lib/pilotage-targets";
import {
  NOT_PROVIDED,
  count,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";
import { AUDIT_ROLES, NATIONAL_READ_ROLES, hasRole, isReadOnlyRole } from "@/lib/roles";
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
  updatedAt: string | null;
  blockingCount: number;
  warningCount: number;
  submittedAt: string | null;
  isLate: boolean;
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
  updatedAt?: string | null;
  submissionDate?: string | null;
  isLate?: boolean;
  anomalies?: Array<{ isBlocking?: boolean; status?: string }> | null;
}

const PAGE_SIZE = 10;

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
      <DossiersContent />
    </Suspense>
  );
}

function DossiersContent() {
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
  const { regions: territoryRegions } = useTerritoryRegions();

  // ADR-0001 / Phase 3: vue values will be renamed to registrations: queue |
  // organisations | coverage; declarations: submissions | completed | coverage.
  // vue is presentation only and grants no permission. Update parsers, tabs,
  // link helpers, and labels together. See docs/plans/admin-modules-refactor.md
  // Phase 3.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Filters that belong to a shared or bookmarked view live in the URL.
  // The status filter is ?status=, written by setStatus.
  const statusFilter = parseDossierStatus(searchParams.get("status"));
  // ?sort=oldest (the pilotage review-delay link) lists the longest-waiting
  // files first; URL state like the status, written by setSort.
  const sortOrder = parseDossierSort(searchParams.get("sort"));
  const companyIdFilter = searchParams.get("companyId") ?? "";
  const regionFilter = searchParams.get("region") ?? "";
  const departmentFilter = searchParams.get("department") ?? "";
  const campaignIdFilter = searchParams.get("campaignId")?.trim() ?? "";
  const quarterCodeFilter = parseDossierQuarter(searchParams.get("quarterCode")) ?? "";
  const lateFilter = parseDossierFlag(searchParams.get("late"));
  const overdueFilter = parseDossierFlag(searchParams.get("overdue"));
  const vue = parseDossierVue(searchParams.get("vue"));
  // The header search box pushes /admin/dossiers?q=<query>, so `q` seeds the
  // search box on arrival instead of being dropped.
  const requestedQuery = searchParams.get("search") ?? searchParams.get("q") ?? "";
  // /admin/questionnaires links here with ?formType= ("Voir dossiers").
  const requestedFormType = searchParams.get("formType") ?? "";
  const { departments: territoryDepartments } = useTerritoryDepartments(regionFilter || undefined);

  // searchInput is what the user types; search is what is sent, 300 ms after
  // the last keystroke (each request runs a multi-column contains query).
  const [searchInput, setSearchInput] = useState(requestedQuery);
  const [search, setSearch] = useState(requestedQuery.trim());
  const typeFilter = FORM_TYPES.includes(requestedFormType) ? requestedFormType : "";
  const periodFilter = searchParams.get("period") ?? "";
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

  // TODO(backend, S): known limitation — CTD dossiers are searchable only by ID or respondent name (OnefopCtdDetail has no name column; server search no longer reads rawData)
  // TODO(design, S): what is "ASFOP" in the Figma's questionnaire types? Labels use entityTypeLabel until the domain answers (VOCATIONAL_TRAINING?)
  const campaignsQuery = useQuery({
    queryKey: ["admin", "pilotage", "active-campaigns"],
    queryFn: getActiveCollectionCampaigns,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const campaigns = campaignsQuery.data ?? [];
  const campaignOptions = campaigns.map((campaign) => ({
    value: campaign.id,
    label: `${referencePeriodLabel(campaign.code, locale)} - ${formatCampaignDisplayName(campaign.name)}`,
  }));
  if (campaignIdFilter && !campaignOptions.some((option) => option.value === campaignIdFilter)) {
    campaignOptions.unshift({ value: campaignIdFilter, label: campaignIdFilter });
  }
  const quarterOptions = [
    quarterCodeFilter,
    ...recentDossierQuarters(new Date()).filter((code) => code !== quarterCodeFilter),
  ].filter(Boolean);
  const quarterLabel = (code: string) => `${code.slice(-2)} ${code.slice(0, 4)}`;

  // Every filter is applied server-side (drafts excluded), so `total` is the
  // count of the filtered query and paging never hides matching rows.
  const questionnairesQuery = useQuery({
    queryKey: ["admin", "questionnaires", "list", vue, { statusFilter, typeFilter, regionFilter, departmentFilter, campaignIdFilter, quarterCodeFilter, lateFilter, overdueFilter, periodFilter, search, companyIdFilter, sortOrder, offset }],
    queryFn: () =>
      listAdminQuestionnaires({
        status: vue === "completed" ? undefined : statusFilter || undefined,
        statuses: vue === "completed"
          ? (statusFilter === "APPROVED" || statusFilter === "REJECTED" || statusFilter === "SUPERSEDED" ? statusFilter : "APPROVED,REJECTED,SUPERSEDED")
          : undefined,
        view: vue === "completed" ? "completed" : "queue",
        formType: typeFilter || undefined,
        period: periodFilter || undefined,
        region: regionFilter || undefined,
        department: departmentFilter || undefined,
        campaignId: campaignIdFilter || undefined,
        quarterCode: quarterCodeFilter || undefined,
        late: lateFilter || undefined,
        overdue: overdueFilter || undefined,
        search: search || undefined,
        companyId: companyIdFilter || undefined,
        sort: sortOrder || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    enabled: vue !== "coverage",
    placeholderData: keepPreviousData,
  });

  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues", vue === "completed" ? "completed" : "queue"],
    queryFn: () => getPilotageQueuesForView(vue === "completed" ? "completed" : "queue"),
  });
  const queues = queuesQuery.data ?? null;

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

  // Writes a URL filter, keeping every other parameter, and drops a stale
  // selection. The list follows from the URL, so a reload reopens the same view.
  const setUrlFilter = useCallback((changes: Record<string, string | null>) => {
    setSelectedIds(new Set());
    setOffset(0);
    router.replace(hrefWith(pathname, searchParams.toString(), changes));
  }, [pathname, router, searchParams]);

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
    const name = resolveEntityName(sub) ?? t("fileFallbackName", { id: sub.submissionId || sub.id });

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
      updatedAt: sub.updatedAt ?? null,
      blockingCount,
      warningCount,
      submittedAt: sub.submissionDate ?? null,
      isLate: sub.isLate === true,
    };
  });

  const activeFilterChips: Array<{ key: string; label: string; remove: () => void }> = [];
  if (search) activeFilterChips.push({ key: "search", label: `${t("freeSearchLabel")}: ${search}`, remove: () => { setSearchInput(""); setSearch(""); setUrlFilter({ search: null, q: null }); } });
  if (statusFilter) activeFilterChips.push({ key: "status", label: `${t("statusFilterAriaLabel")}: ${t(STATUS_VIEWS.find((v) => v.status === statusFilter)?.labelKey ?? "statusAll")}`, remove: () => setStatus("") });
  if (typeFilter) activeFilterChips.push({ key: "formType", label: `${t("typeColumn")}: ${typeLabel(typeFilter)}`, remove: () => setType("") });
  if (periodFilter) activeFilterChips.push({ key: "period", label: `${t("periodLabel")}: ${t(PERIODS.find((p) => p.value === periodFilter)?.labelKey ?? "allPeriods")}`, remove: () => setPeriod("") });
  if (regionFilter) activeFilterChips.push({ key: "region", label: `${t("regionColumn")}: ${regionFilter}`, remove: () => setRegion("") });
  if (departmentFilter) activeFilterChips.push({ key: "department", label: `${t("departmentLabel")}: ${departmentFilter}`, remove: () => setDepartment("") });
  if (campaignIdFilter) activeFilterChips.push({ key: "campaignId", label: `${t("campaignLabel")}: ${campaignOptions.find((o) => o.value === campaignIdFilter)?.label ?? campaignIdFilter}`, remove: () => setCampaign("") });
  if (quarterCodeFilter) activeFilterChips.push({ key: "quarterCode", label: `${t("quarterLabel")}: ${quarterCodeFilter}`, remove: () => setQuarter("") });
  if (lateFilter) activeFilterChips.push({ key: "late", label: t("lateOnly"), remove: () => setLate(false) });
  if (overdueFilter) activeFilterChips.push({ key: "overdue", label: t("overdueOnly"), remove: () => setOverdue(false) });
  if (companyIdFilter) activeFilterChips.push({ key: "companyId", label: `${t("organisationColumn")}: ${companyIdFilter}`, remove: () => setUrlFilter({ companyId: null }) });
  if (sortOrder) activeFilterChips.push({ key: "sort", label: t("sortOldest"), remove: () => setSort("") });
  const clearAllFilters = () => setUrlFilter({ status: null, formType: null, period: null, region: null, department: null, campaignId: null, quarterCode: null, late: null, overdue: null, companyId: null, sort: null, search: null, q: null });

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

  const [exportInProgress, setExportInProgress] = useState(false);

  async function handleExport(fmt: "csv" | "xlsx") {
    if (exportInProgress) return;
    setExportInProgress(true);
    try {
      const params = new URLSearchParams({ format: fmt });
      if (vue === "completed") {
        params.set("statuses", statusFilter === "APPROVED" || statusFilter === "REJECTED" || statusFilter === "SUPERSEDED" ? statusFilter : "APPROVED,REJECTED,SUPERSEDED");
      } else if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("formType", typeFilter);
      if (regionFilter) params.set("region", regionFilter);
      if (departmentFilter) params.set("department", departmentFilter);
      if (campaignIdFilter) params.set("campaignId", campaignIdFilter);
      if (quarterCodeFilter) params.set("quarterCode", quarterCodeFilter);
      if (lateFilter) params.set("late", "1");
      if (overdueFilter) params.set("overdue", "1");
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

  const pageHeader = (
    <AdminPageHeader
      breadcrumb={[{ label: tRoot("adminNav.hubs.teledeclarations") }, { label: tRoot("adminNav.routes.dossiers") }]}
      title={tRoot("adminNav.routes.dossiers")}
      subtitle={vue === "coverage" ? t("subtitleCoverage") : vue === "completed" ? t("completedSubtitle") : t("subtitle")}
      actions={<AdminHeaderActions />}
      tabs={[
        {
          label: t("viewSubmissions"),
          href: hrefWith(pathname, searchParams.toString(), { vue: "submissions", status: null }),
          isActive: vue === "submissions",
          badge: selectAdminViewCounts(queues?.countsView, "queue", queues?.totalSubmissionsCount) ?? undefined,
        },
        {
          label: t("viewCompleted"),
          href: hrefWith(pathname, searchParams.toString(), { vue: "completed", status: null }),
          isActive: vue === "completed",
        },
        {
          label: t("viewCoverage"),
          href: hrefWith(pathname, searchParams.toString(), { vue: "coverage", status: null }),
          isActive: vue === "coverage",
        },
      ]}
    />
  );

  if (vue === "coverage") {
    return (
      <div className="cam-admin-page">
        {pageHeader}
        <DossiersCoverage campaignId={campaignIdFilter} onCampaignChange={setCampaign} />
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      {pageHeader}
      {reopenNotice && <Alert variant="success" className="my-4"><AlertDescription>{reopenNotice}</AlertDescription></Alert>}

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

      {queues && queues.reviewDelay.pendingOverThresholdCount > 0 && (
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
      <Card>
        {vue === "submissions" && !readOnly && (
          <CardContent className="flex flex-wrap items-center gap-3 border-b pt-6" aria-live="polite">
            {selectedIds.size > 0 ? <>
              <span className="text-sm font-medium text-foreground">{t("selectionEligibleSummary", { selected: selectedIds.size, eligible: bulkEligibleSelected.length, excluded: excludedSelected.length })}</span>
              {excludedSelected.length > 0 && <details className="text-sm"><summary className="cursor-pointer underline">{t("whyExcluded")}</summary><ul className="mt-2 list-disc ps-5">{excludedSelected.map((d) => <li key={d.id}>{t("excludedRecordReason", { name: d.companyName ?? d.submissionId, reason: d.blockingCount > 0 ? t("blockingAnomalies", { count: d.blockingCount }) : t("notBulkEligibleReason") })}</li>)}</ul></details>}
              <Button type="button" size="sm" onClick={handleOpenBulkModal} disabled={bulkEligibleSelected.length === 0 || cleanPendingSelected.length === 0}><span aria-hidden="true">✓</span> {t("endorseSelectionButton")}</Button>
              <Button type="button" size="sm" variant="destructive" onClick={handleOpenRejectModal} disabled={bulkEligibleSelected.length === 0 || rejectableSelected.length === 0}><span aria-hidden="true">×</span> {t("rejectSelectionButton")}</Button>
            </> : <span className="text-sm text-muted-foreground">{t("selectionHint")}</span>}
          </CardContent>
        )}
        {!readOnly && <CardContent className="flex justify-end border-b pt-4"><Button type="button" size="sm" variant="outline" onClick={() => handleExport("csv")} disabled={exportInProgress}><Download aria-hidden="true" />{t("exportButton")}</Button></CardContent>}
        <CardContent className="border-b pt-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2"><Label htmlFor="dossiers-search">{t("freeSearchLabel")}</Label><Input id="dossiers-search" type="search" placeholder={t("freeSearchPlaceholder")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div>
            <div><Label htmlFor="dossiers-status">{t("statusFilterAriaLabel")}</Label><select id="dossiers-status" className="cam-admin-input w-full" value={statusFilter} onChange={(event) => setStatus(event.target.value as DossierStatus | "")}>
              <option value="">{t("statusAll")}</option>
              {(vue === "completed" ? ["APPROVED", "REJECTED", "SUPERSEDED"] : ["PENDING_REVIEW", "CORRECTION_REQUESTED", "APPROVED", "REJECTED"]).map((status) => <option key={status} value={status}>{t(STATUS_VIEWS.find((view) => view.status === status)?.labelKey ?? "statusAll")}</option>)}
            </select></div>
            <div><Label htmlFor="dossiers-campaign">{t("campaignLabel")}</Label><select id="dossiers-campaign" className="cam-admin-input w-full" value={campaignIdFilter} onChange={(event) => setCampaign(event.target.value)}><option value="">{t("allCampaigns")}</option>{campaignOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            <div><Label htmlFor="dossiers-region">{t("regionLabel")}</Label><select id="dossiers-region" className="cam-admin-input w-full" value={regionFilter} onChange={(event) => setRegion(event.target.value)}><option value="">{t("allRegions")}</option>{territoryRegions.map((region) => <option key={region} value={region}>{region}</option>)}</select></div>
          </div>
          <details className="mt-3"><summary className="cursor-pointer text-sm font-medium">{t("moreFilters")}</summary><div className="mt-3 grid gap-3 md:grid-cols-4">
            <div><Label htmlFor="dossiers-type">{t("typeColumn")}</Label><select id="dossiers-type" className="cam-admin-input w-full" value={typeFilter} onChange={(event) => setType(event.target.value)}><option value="">{t("allFormTypes")}</option>{FORM_TYPES.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}</select></div>
            <div><Label htmlFor="dossiers-period">{t("periodLabel")}</Label><select id="dossiers-period" className="cam-admin-input w-full" value={periodFilter} onChange={(event) => setPeriod(event.target.value)}><option value="">{t("allPeriods")}</option>{PERIODS.map((period) => <option key={period.value} value={period.value}>{t(period.labelKey)}</option>)}</select></div>
            <div><Label htmlFor="dossiers-department">{t("departmentLabel")}</Label><select id="dossiers-department" className="cam-admin-input w-full" value={departmentFilter} onChange={(event) => setDepartment(event.target.value)}><option value="">{t("allDepartments")}</option>{territoryDepartments.map((department) => <option key={department} value={department}>{department}</option>)}</select></div>
            <div><Label htmlFor="dossiers-quarter">{t("quarterLabel")}</Label><select id="dossiers-quarter" className="cam-admin-input w-full" value={quarterCodeFilter} onChange={(event) => setQuarter(event.target.value)}><option value="">{t("allQuarters")}</option>{quarterOptions.map((code) => <option key={code} value={code}>{quarterLabel(code)}</option>)}</select></div>
            <div><Label htmlFor="dossiers-late">{t("lateLabel")}</Label><select id="dossiers-late" className="cam-admin-input w-full" value={lateFilter ? "1" : ""} onChange={(event) => setLate(event.target.value === "1")}><option value="">{t("lateAll")}</option><option value="1">{t("lateOnly")}</option></select></div>
            <div><Label htmlFor="dossiers-overdue">{t("overdueLabel")}</Label><select id="dossiers-overdue" className="cam-admin-input w-full" value={overdueFilter ? "1" : ""} onChange={(event) => setOverdue(event.target.value === "1")}><option value="">{t("overdueAll")}</option><option value="1">{t("overdueOnly")}</option></select></div>
            <div><Label htmlFor="dossiers-sort">{t("sortLabel")}</Label><select id="dossiers-sort" className="cam-admin-input w-full" value={sortOrder || "newest"} onChange={(event) => setSort(parseDossierSort(event.target.value === "newest" ? "" : event.target.value))}><option value="newest">{t("sortNewest")}</option><option value="oldest">{t("sortOldest")}</option></select></div>
          </div></details>
          {activeFilterChips.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={t("activeFiltersLabel")}><span className="text-sm font-medium">{t("activeFiltersLabel")}</span>{activeFilterChips.map((chip) => <Button type="button" key={chip.key} variant="outline" size="sm" onClick={chip.remove} aria-label={t("removeFilterChip", { label: chip.label })}>{chip.label}<X className="ms-2 size-3" aria-hidden="true" /></Button>)}<Button type="button" variant="ghost" size="sm" onClick={clearAllFilters}>{t("clearFilters")}</Button></div>}
        </CardContent>
        <CardContent className="overflow-x-auto pt-5">
          <Table>
            <TableHeader><TableRow>
              <TableHead scope="col">{vue === "completed" ? t("organisationColumn") : t("organisationReferenceColumn")}</TableHead>
              <TableHead scope="col">{vue === "completed" ? t("reviewDecisionColumn") : t("reviewDecisionColumn")}</TableHead>
              <TableHead scope="col">{vue === "completed" ? t("decisionDateColumn") : <>{t("dataIssuesColumn")}<span className="block text-xs font-normal text-muted-foreground">{t("dataIssuesHelp")}</span></>}</TableHead>
              <TableHead scope="col">{vue === "completed" ? t("campaignPeriodColumn") : t("statisticalEligibilityColumn")}</TableHead>
              <TableHead scope="col">{vue === "completed" ? t("historyColumn") : t("submittedAtColumn")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <DataStateRow colSpan={5} state={tableState} resource={t("filesResource")} error={questionnairesQuery.error} onRetry={() => questionnairesQuery.refetch()} title={tableState === "empty" ? t("noFilesTitle") : undefined} hint={tableState === "empty" ? t("noFilesHint") : undefined} />
              {dossiers.map((d) => {
                const visaBadge: { label: string; tone: ToneName } = d.adminStatus === "APPROVED" ? { label: t("badgeEndorsed"), tone: "success" } : d.adminStatus === "CORRECTION_REQUESTED" ? { label: t("badgeCorrection"), tone: "info" } : d.adminStatus === "REJECTED" ? { label: t("badgeRejected"), tone: "error" } : d.adminStatus === "PENDING_REVIEW" ? { label: t("badgePending"), tone: "warning" } : d.adminStatus === "SUPERSEDED" ? { label: t("badgeSuperseded"), tone: "neutral" } : { label: t("badgeNoStatus"), tone: "neutral" };
                const qualityTone: ToneName = d.blockingCount > 0 ? "error" : d.warningCount > 0 ? "warning" : "neutral";
                const qualityText = d.blockingCount > 0 ? t("blockingAnomalies", { count: d.blockingCount }) : d.warningCount > 0 ? t("warnings", { count: d.warningCount }) : t("noAnomaly");
                const eligibility: "eligible" | "notEligible" | "pending" = d.adminStatus === "APPROVED" ? (d.blockingCount === 0 ? "eligible" : "notEligible") : d.adminStatus === "REJECTED" || d.adminStatus === "SUPERSEDED" ? "notEligible" : "pending";
                const eligibilityText = eligibility === "eligible" ? t("eligible") : eligibility === "notEligible" ? t("notEligible") : t("eligibilityPending");
                return vue === "completed" ? <TableRow key={d.id}>
                  <TableCell className="font-medium"><span className="block">{d.companyName ?? NOT_PROVIDED}</span><Link href={`/admin/dossiers/${encodeURIComponent(d.id)}`} className="text-sm underline">{t("openFileButton")}</Link></TableCell>
                  <TableCell><Badge variant={BADGE_VARIANT[visaBadge.tone]}>{visaBadge.label}</Badge>{d.rejectionReason && <span className="mt-1 block max-w-xs text-xs text-muted-foreground">{d.rejectionReason}</span>}{canReopen && d.adminStatus === "APPROVED" && <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => { setReopenNotice(""); reopenMutation.reset(); setReopenTarget(d); setReopenReason(""); setCertifiedReopen(false); }}>{t("reopenButton")}</Button>}</TableCell>
                  <TableCell className="whitespace-nowrap">{d.reviewedAt ? <>{stamp(d.reviewedAt, true, locale)}<span className="block text-xs text-muted-foreground">{d.reviewedBy ?? NOT_PROVIDED}</span></> : NOT_PROVIDED}</TableCell>
                  <TableCell>{d.campaignName ?? NOT_PROVIDED}<span className="block text-xs text-muted-foreground">{d.quarterCode ?? NOT_PROVIDED}</span></TableCell>
                  <TableCell>{canReadAudit ? <Link className="underline" href={`/admin/journal-audit?resourceId=${encodeURIComponent(d.id)}`}>{t("historyLink")}</Link> : NOT_PROVIDED}</TableCell>
                </TableRow> : <TableRow key={d.id}>
                  <TableCell className="font-medium">{!readOnly && <Checkbox className="me-2 align-middle" checked={selectedIds.has(d.id)} onCheckedChange={(checked) => toggleSelect(d.id, checked === true)} aria-label={t("selectRowAria", { name: d.companyName ?? d.respondentName ?? d.submissionId })} />}<span>{d.companyName ?? d.submissionId}</span><div className="text-xs text-muted-foreground">{d.respondentName ?? NOT_PROVIDED} · {d.formType ? typeLabel(d.formType) : NOT_PROVIDED}</div><Link href={`/admin/dossiers/${encodeURIComponent(d.id)}`} className="text-sm underline">{t("openFileButton")}</Link></TableCell>
                  <TableCell><Badge variant={BADGE_VARIANT[visaBadge.tone]}>{visaBadge.label}</Badge></TableCell>
                  <TableCell><Badge variant={BADGE_VARIANT[qualityTone]}>{qualityText}</Badge></TableCell>
                  <TableCell><Badge variant={eligibility === "eligible" ? "success" : eligibility === "pending" ? "warning" : "neutral"}>{eligibilityText}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap">{stamp(d.submittedAt, true, locale)}{d.isLate && <Badge variant="warning" className="ms-2">{t("lateBadge")}</Badge>}</TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
    </div>
  );
}
