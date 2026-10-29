"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, MoreHorizontal, TriangleAlert } from "lucide-react";
import { API_BASE_URL, archiveDossier, restoreDossier, bulkVisaDeclarations, bulkRejectDeclarations, bulkRequestCorrectionDeclarations, assignDossier, getPilotageQueuesForView, getToken, listAdminQuestionnaires, localeHeader, reopenDossierForCorrection } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { resolveEntityName, type NamedSubmission } from "@/lib/onefop-entity-name";
import { assessBulkEligibility } from "@/lib/dossier-bulk-eligibility";
import { selectAdminViewCounts } from "@/lib/admin-view-counts";
import { adminResultRange, displayedResultOffset, isBackgroundRefreshing } from "@/lib/admin-query-state";
import { buildDossierReturnTo } from "@/lib/admin-return";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { AdminLiveResultCount } from "@/components/admin/AdminLiveResultCount";
import { DossierResponseRateKpi } from "@/components/admin/DossierResponseRateKpi";
import { AdminActiveFilterChips } from "@/components/admin/AdminActiveFilterChips";
import { AdminFilterDisclosure } from "@/components/admin/AdminFilterDisclosure";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { ArchiveActions } from "@/components/admin/ArchiveActions";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import { CampaignNonRespondentsTable } from "@/components/admin/CampaignNonRespondentsTable";
import { departmentInRegion, regionInTree, useTerritoryDepartments, useTerritoryRegions, useTerritoryStructure } from "@/hooks/useTerritoryStructure";
import { formatCampaignDisplayName, isRegistrationCampaign, listCampaigns } from "@/lib/campaigns";
import { referencePeriodLabel } from "@/lib/onefop-period-label";
import { canListCampaigns, getActiveCollectionCampaigns, getCampaignNonRespondents, getCampaignReturns } from "@/lib/pilotage-targets";
import {
  NOT_PROVIDED,
  count,
  metricUnavailable,
  percent,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";
import { AUDIT_ROLES, DOSSIER_ARCHIVE_ROLES, NATIONAL_READ_ROLES, SURVEY_ROLES, hasRole, isReadOnlyRole } from "@/lib/roles";
import {
  clampAdminListPage,
  hrefWith,
  parseAdminListPage,
  normalizeDossierListHref,
  parseDossierAssignment,
  parseDossierFlag,
  parseDossierPeriod,
  parseDossierQuality,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  establishmentId: string | null;
  companyName: string | null;
  respondentName: string | null;
  region: string | null;
  department: string | null;
  subdivision?: string | null;
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
  validationDataAvailable: boolean;
  submittedAt: string | null;
  isLate: boolean;
  assigneeId?: string | null;
  assigneeName?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  archivedByUser?: { id: string; firstName: string | null; lastName: string | null } | null;
}

interface QuestionnaireListItem extends NamedSubmission {
  id: string;
  submissionId?: string | null;
  /** Official Company.establishmentId; do not use the submission FK UUID. */
  companyEstablishmentId?: string | null;
  respondent?: { respondentName?: string | null } | null;
  region?: string | null;
  department?: string | null;
  subdivision?: string | null;
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
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  archivedByUser?: { id: string; firstName: string | null; lastName: string | null } | null;
  anomalies?: Array<{ isBlocking?: boolean; status?: string }> | null;
}

const PAGE_SIZE = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

function elapsedDays(since: string | null, now: number): number | null {
  if (!since) return null;
  const timestamp = Date.parse(since);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((now - timestamp) / DAY_MS));
}

function elapsedMoreThanDays(since: string | null, now: number, days: number): boolean {
  if (!since) return false;
  const timestamp = Date.parse(since);
  return Number.isFinite(timestamp) && now - timestamp > days * DAY_MS;
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
  view: "submissions" | "completed" | "followup" | "coverage";
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
  const dossierReturnTo = buildDossierReturnTo(searchParams.toString());
  const router = useRouter();
  const pathname = usePathname();
  const activeView = parseDossierVue(searchParams.get("vue"));
  const legacyFiltersApply = activeView === view;
  // Keep each section's filters independently bookmarkable. Older generic
  // filters still seed the section named by ?vue= (or submissions by default).
  const filterParam = (key: string) =>
    searchParams.get(`${view}${key[0].toUpperCase()}${key.slice(1)}`) ??
    (legacyFiltersApply ? searchParams.get(key) : null);
  const parsedStatusFilter = parseDossierStatus(filterParam("status"));
  const statusFilter = view === "completed"
    && !["APPROVED", "REJECTED", "SUPERSEDED"].includes(parsedStatusFilter)
    ? ""
    : parsedStatusFilter;
  const statusRedirectPending = view === "submissions"
    && ["APPROVED", "REJECTED", "SUPERSEDED"].includes(statusFilter);
  // ?sort=oldest (the pilotage review-delay link) lists the longest-waiting
  // files first; URL state like the status, written by setSort.
  const sortOrder = parseDossierSort(filterParam("sort"));
  const companyIdFilter = filterParam("companyId") ?? "";
  const requestedRegionFilter = filterParam("region")?.trim() ?? "";
  const requestedDepartmentFilter = filterParam("department")?.trim() ?? "";
  const campaignIdFilter = searchParams.get("campaignId")?.trim() ?? "";
  const quarterCodeFilter = parseDossierQuarter(filterParam("quarterCode")) ?? "";
  const lateFilter = parseDossierFlag(filterParam("late"));
  const overdueFilter = view === "completed" ? false : parseDossierFlag(filterParam("overdue"));
  const rawAssignment = filterParam("assignment");
  const explicitAssignment = parseDossierAssignment(rawAssignment);
  const assignedToMeFilter = parseDossierFlag(filterParam("assignedToMe")) && !explicitAssignment;
  const assignmentFilter = explicitAssignment || (assignedToMeFilter ? "me" : "");
  const qualityFilter = parseDossierQuality(filterParam("quality"));
  const vue = view;
  const archivedParam = searchParams.get("completedIncludeArchived") ??
    (legacyFiltersApply ? searchParams.get("includeArchived") : null);
  const includeArchived = vue === "completed" && archivedParam !== "false";
  // The header search box pushes /admin/dossiers?q=<query>, so `q` seeds the
  // search box on arrival instead of being dropped.
  const requestedQuery = (filterParam("search") ?? (legacyFiltersApply ? searchParams.get("q") : null) ?? "").trim();
  // /admin/questionnaires links here with ?formType= ("Voir dossiers").
  const requestedFormType = filterParam("formType") ?? "";
  // A chosen region narrows the department list. Clearing the region keeps a
  // department that is still valid. The effect below drops a pair that cannot
  // exist, and only after the territory tree has loaded.
  const territoryStructure = useTerritoryStructure(view !== "coverage");
  const hasTerritoryFilters = Boolean(requestedRegionFilter || requestedDepartmentFilter);
  const validRequestedRegion = !requestedRegionFilter || !territoryStructure.isSuccess
    || regionInTree(territoryStructure.data, requestedRegionFilter) !== false;
  const regionFilter = territoryStructure.isSuccess && !validRequestedRegion ? "" : requestedRegionFilter;
  const validRequestedDepartment = !requestedDepartmentFilter || !territoryStructure.isSuccess || (
    regionFilter
      ? departmentInRegion(territoryStructure.data, regionFilter, requestedDepartmentFilter) !== false
      : territoryStructure.data.some((region) => region.departments.some((department) => department.name === requestedDepartmentFilter))
  );
  const departmentFilter = territoryStructure.isSuccess && (!validRequestedRegion || !validRequestedDepartment)
    ? ""
    : requestedDepartmentFilter;
  const territoryFiltersValid = !hasTerritoryFilters || (
    territoryStructure.isSuccess && validRequestedRegion && validRequestedDepartment
  );
  const { departments: territoryDepartments } = useTerritoryDepartments(regionFilter || undefined, view !== "coverage");
  const normalizedDossierHref = (view === "submissions" || view === "completed")
    && (!hasTerritoryFilters || territoryStructure.isSuccess)
    ? normalizeDossierListHref(searchParams.toString(), view, FORM_TYPES, territoryStructure.data)
    : null;

  // searchInput is what the user types; search is what is sent, 300 ms after
  // the last keystroke (each request runs a multi-column contains query).
  const [searchInput, setSearchInput] = useState(requestedQuery);
  const [search, setSearch] = useState(requestedQuery.trim());
  const typeFilter = FORM_TYPES.includes(requestedFormType) ? requestedFormType : "";
  const periodFilter = parseDossierPeriod(filterParam("period"));
  const requestedPage = parseAdminListPage(filterParam("page"));
  const [offset, setOffset] = useState((requestedPage - 1) * PAGE_SIZE);

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
    assignmentFilter,
    qualityFilter,
    typeFilter,
    periodFilter,
    requestedQuery,
  ].join("|");
  const requestedOffsetSignature = `${filterSignature}|page:${requestedPage}`;
  const [offsetSignature, setOffsetSignature] = useState(requestedOffsetSignature);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  if (offsetSignature !== requestedOffsetSignature) {
    setOffsetSignature(requestedOffsetSignature);
    setOffset((requestedPage - 1) * PAGE_SIZE);
    setSelectedIds(new Set());
  }

  // List filters reset only the active view's page while preserving the other
  // view's bookmarked page. Page changes use the same scoped URL state.
  const setUrlFilter = useCallback((changes: Record<string, string | null>, history: "push" | "replace" = "push") => {
    setSelectedIds(new Set());
    const scoped: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(changes)) {
      if (key === "campaignId") {
        scoped[key] = value;
        continue;
      }
      if (key !== "q") scoped[`${view}${key[0].toUpperCase()}${key.slice(1)}`] = value;
      scoped[key] = null;
    }
    scoped[`${view}Page`] = null;
    scoped.page = null;
    setOffset(0);
    const href = hrefWith(pathname, searchParams.toString(), scoped);
    const currentHref = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    if (href !== currentHref) router[history](href, { scroll: false });
  }, [pathname, router, searchParams, view]);

  const goToOffset = useCallback((next: number) => {
    const nextOffset = Math.max(0, Math.floor(next / PAGE_SIZE) * PAGE_SIZE);
    setOffset(nextOffset);
    setSelectedIds(new Set());
    const nextPage = Math.floor(nextOffset / PAGE_SIZE) + 1;
    router.push(hrefWith(pathname, searchParams.toString(), {
      [`${view}Page`]: nextPage > 1 ? String(nextPage) : null,
      page: null,
    }), { scroll: false });
  }, [pathname, router, searchParams, view]);

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
  const [archiveTarget, setArchiveTarget] = useState<DossierItem | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [certifiedReopen, setCertifiedReopen] = useState(false);
  const [reopenNotice, setReopenNotice] = useState("");
  const [assignNotice, setAssignNotice] = useState("");
  const [archiveNotice, setArchiveNotice] = useState("");
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [certifiedCorrection, setCertifiedCorrection] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionResult, setCorrectionResult] = useState<Awaited<ReturnType<typeof bulkRequestCorrectionDeclarations>> | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNowMs(Date.now());
    const frame = window.requestAnimationFrame(update);
    const timer = window.setInterval(update, 60_000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, []);

  // TODO(backend, S): known limitation — CTD dossiers are searchable only by ID or respondent name (OnefopCtdDetail has no name column; server search no longer reads rawData)
  // TODO(design, S): what is "ASFOP" in the Figma's questionnaire types? Labels use entityTypeLabel until the domain answers (VOCATIONAL_TRAINING?)
  const campaignsQuery = useQuery({
    queryKey: ["admin", "pilotage", "active-campaigns"],
    queryFn: getActiveCollectionCampaigns,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  // Campaign follow-up used to live under Campaign targets, where campaign
  // managers can choose any collection campaign, including closed periods.
  // Keep that selection range when the view moves here. Read-only observers
  // continue to use the existing active-campaign endpoint.
  const allCollectionCampaignsQuery = useQuery({
    queryKey: ["admin", "campaigns", "collection-follow-up"],
    queryFn: () => listCampaigns(),
    enabled: vue === "followup" && canListCampaigns(user?.role),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const activeCampaigns = campaignsQuery.data ?? [];
  const allCollectionCampaigns = (allCollectionCampaignsQuery.data ?? []).filter(
    (campaign) => campaign.collectionType === "ONEFOP" && !isRegistrationCampaign(campaign),
  );
  const mayListAllCampaigns = canListCampaigns(user?.role);
  const campaigns = vue === "followup" && mayListAllCampaigns && allCollectionCampaignsQuery.isSuccess
    ? allCollectionCampaigns
    : activeCampaigns;
  const followUpCampaignCatalogReady = campaignsQuery.isSuccess
    && (!mayListAllCampaigns || allCollectionCampaignsQuery.isSuccess);
  const followUpCampaignIsValid = !campaignIdFilter || (
    followUpCampaignCatalogReady && campaigns.some((campaign) => campaign.id === campaignIdFilter)
  );
  const followUpCampaignSelectionReady = followUpCampaignCatalogReady && followUpCampaignIsValid;
  // The file list treats an empty campaign as every round. The response-rate
  // tile and the follow-up list still need one round, so they keep the
  // fallback to the first campaign.
  const listCampaignId = campaignIdFilter || undefined;
  const listQuarterCode = listCampaignId ? undefined : quarterCodeFilter || undefined;
  const qualityParam = qualityFilter === "clean" || qualityFilter === "warnings" || qualityFilter === "blocking"
    ? qualityFilter
    : undefined;
  const assignmentParam = assignmentFilter === "me" || assignmentFilter === "unassigned" || assignmentFilter === "other"
    ? assignmentFilter
    : undefined;
  const effectiveCampaignId = vue === "followup"
    ? followUpCampaignSelectionReady
      ? campaignIdFilter || activeCampaigns[0]?.id || campaigns[0]?.id || ""
      : ""
    : campaignIdFilter || activeCampaigns[0]?.id || campaigns[0]?.id || "";
  const campaignReturnsQuery = useQuery({
    queryKey: ["admin", "pilotage", "returns", effectiveCampaignId],
    queryFn: () => getCampaignReturns(effectiveCampaignId),
    enabled: vue === "submissions" && Boolean(effectiveCampaignId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const nonRespondentsQuery = useQuery({
    queryKey: ["admin", "pilotage", "non-respondents", effectiveCampaignId],
    queryFn: () => getCampaignNonRespondents(effectiveCampaignId),
    enabled: vue === "followup" && followUpCampaignSelectionReady && Boolean(effectiveCampaignId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const namedCampaigns = campaigns.map((campaign) => ({
    value: campaign.id,
    label: `${referencePeriodLabel(campaign.code, locale)} - ${formatCampaignDisplayName(campaign.name)}`,
  }));
  // Follow-up cannot list every campaign: its query still uses one round.
  const campaignOptions = vue === "followup"
    ? namedCampaigns
    : [{ value: "", label: t("allCampaigns") }, ...namedCampaigns];
  const campaignSelectValue = vue === "followup" ? effectiveCampaignId : campaignIdFilter;
  if (campaignSelectValue && !campaignOptions.some((option) => option.value === campaignSelectValue)) {
    campaignOptions.push({ value: campaignSelectValue, label: campaignSelectValue });
  }
  const quarterOptions = [
    quarterCodeFilter,
    ...recentDossierQuarters(new Date()).filter((code) => code !== quarterCodeFilter),
  ].filter(Boolean);
  const quarterLabel = (code: string) => `${code.slice(-2)} ${code.slice(0, 4)}`;

  // Keep saved survey-coverage URLs working while making Campaign targets >
  // Returns the single canonical returns table. Carry a campaign only when
  // the Dossiers campaign selector has an explicit selection; All campaigns
  // must let the Returns page choose its own collection campaign.
  useEffect(() => {
    if (vue !== "coverage") return;
    const params = new URLSearchParams({ vue: "retours" });
    if (campaignIdFilter) params.set("campagne", campaignIdFilter);
    router.replace(`/admin/cibles?${params.toString()}`);
  }, [campaignIdFilter, router, vue]);

  useEffect(() => {
    if (vue !== "followup" || !followUpCampaignCatalogReady || followUpCampaignIsValid) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("campaignId");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [followUpCampaignCatalogReady, followUpCampaignIsValid, pathname, router, searchParams, vue]);

  // Old queue links could point directly at an endorsed/rejected record. Move
  // those to the completed view so the URL, columns, and available actions
  // all match the record's lifecycle state.
  useEffect(() => {
    if (!statusRedirectPending) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("vue", "completed");
    params.set("completedStatus", statusFilter);
    params.delete("status");
    params.delete("submissionsStatus");
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams, statusFilter, statusRedirectPending, vue]);

  // Every filter is applied server-side (drafts excluded), so `total` is the
  // count of the filtered query and paging never hides matching rows.
  const questionnairesQuery = useQuery({
    queryKey: ["admin", "questionnaires", "list", vue, { statusFilter, typeFilter, regionFilter, departmentFilter, campaignId: listCampaignId ?? "", quarterCode: listQuarterCode ?? "", quality: qualityParam ?? "", assignment: assignmentParam ?? "", lateFilter, overdueFilter, periodFilter, search, companyIdFilter, sortOrder, offset, includeArchived }],
    queryFn: async () => {
      const result = await listAdminQuestionnaires({
        status: vue === "completed" || !statusFilter ? undefined : statusFilter,
        statuses: vue === "completed"
          ? (statusFilter === "APPROVED" || statusFilter === "REJECTED" || statusFilter === "SUPERSEDED" ? statusFilter : "APPROVED,REJECTED,SUPERSEDED")
          : !statusFilter ? "PENDING_REVIEW,CORRECTION_REQUESTED" : undefined,
        view: vue === "completed" ? "completed" : "queue",
        includeArchived,
        formType: typeFilter || undefined,
        period: periodFilter || undefined,
        region: regionFilter || undefined,
        department: departmentFilter || undefined,
        campaignId: listCampaignId,
        quarterCode: listQuarterCode,
        late: lateFilter || undefined,
        overdue: vue === "completed" ? undefined : overdueFilter || undefined,
        quality: qualityParam,
        assignment: assignmentParam,
        search: search || undefined,
        companyId: companyIdFilter || undefined,
        sort: sortOrder || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      // keepPreviousData can keep the prior page visible while a new request
      // is pending. Keep its offset with the response so the footer describes
      // those rows until the replacement page is committed.
      return { ...result, requestedOffset: offset };
    },
    enabled: (vue === "submissions" || vue === "completed") && territoryFiltersValid && !statusRedirectPending,
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
    enabled: vue === "submissions" || vue === "completed",
  });
  const queues = queuesQuery.data ?? null;
  const queueStatusCounts = selectAdminViewCounts(
    queues?.countsView,
    "queue",
    queues?.statusCounts as Partial<Record<DossierStatus, number>> | undefined,
  );
  const actionableQueueCount =
    typeof queueStatusCounts?.PENDING_REVIEW === "number" &&
    typeof queueStatusCounts.CORRECTION_REQUESTED === "number"
      ? queueStatusCounts.PENDING_REVIEW + queueStatusCounts.CORRECTION_REQUESTED
      : undefined;
  const dossierStatusSummary = (vue === "completed"
    ? STATUS_VIEWS.filter((view) => !view.status || ["APPROVED", "REJECTED", "SUPERSEDED"].includes(view.status))
    : STATUS_VIEWS.filter((view) => !view.status || ["PENDING_REVIEW", "CORRECTION_REQUESTED"].includes(view.status)))
    .map((view) => {
      const expectedView = vue === "completed" ? "completed" : "queue";
      const statusCounts = selectAdminViewCounts(queues?.countsView, expectedView, queues?.statusCounts as Partial<Record<DossierStatus, number>> | undefined);
      const value = view.status
        ? statusCounts?.[view.status]
        : vue === "completed"
          ? selectAdminViewCounts(queues?.countsView, expectedView, queues?.totalSubmissionsCount) ?? undefined
          : actionableQueueCount;
      return {
        key: view.status || "all",
        label: !view.status && vue === "submissions" ? t("statusQueueAll") : t(view.labelKey),
        value,
      };
    });
  const dossierStatusBreakdown = vue === "submissions"
    ? dossierStatusSummary.filter((item) => item.key !== "all")
    : dossierStatusSummary;
  const responseRateValue = campaignReturnsQuery.isError
    ? metricUnavailable(locale)
    : percent(campaignReturnsQuery.data?.totals.responseRate, 0, locale);

  /**
   * Queue counters come from the territory-scoped pilotage response. The
   * review queue badge counts only actionable statuses; final decisions live
   * in the Completed view.
   */
  // Bulk visa mutation
  const bulkMutation = useMutation({
    mutationFn: bulkVisaDeclarations,
    onSuccess: (data) => {
      setBulkResult(data);
      queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] });
      setUrlFilter({}, "replace");
    },
  });

  // Bulk reject mutation
  const rejectMutation = useMutation({
    mutationFn: bulkRejectDeclarations,
    onSuccess: (data) => {
      setRejectResult(data);
      queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires"] });
      setUrlFilter({}, "replace");
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
      setUrlFilter({}, "replace");
    },
  });

  // Each section owns its filter state; campaignId remains shared.

  const setStatus = (status: DossierStatus | "") => setUrlFilter({ status });
  const setSort = (sort: DossierSort) => setUrlFilter({ sort });
  const setType = (type: string) => setUrlFilter({ formType: type || null });
  const setPeriod = (period: string) => setUrlFilter({ period: period || null });
  const setRegion = (region: string) => {
    if (!region || !departmentFilter || !territoryStructure.isSuccess) {
      setUrlFilter({ region: region || null });
      return;
    }
    const belongs = departmentInRegion(territoryStructure.data, region, departmentFilter);
    setUrlFilter(belongs === false ? { region, department: null } : { region });
  };
  const setDepartment = (department: string) => setUrlFilter({ department });
  const setCampaign = (campaignId: string) => setUrlFilter(
    campaignId ? { campaignId, quarterCode: null } : { campaignId: null },
  );
  const setQuarter = (quarterCode: string) => setUrlFilter({ quarterCode });
  const setLate = (late: boolean) => setUrlFilter({ late: late ? "1" : null });
  const setQuality = (quality: string) => setUrlFilter({ quality: quality || null });
  const setAssignment = (assignment: string) => setUrlFilter({
    assignment: assignment || null,
  });
  const setOverdue = (overdue: boolean) => setUrlFilter({ overdue: overdue ? "1" : null });
  const setAssignedToMe = (assignedToMe: boolean) => setUrlFilter({ assignedToMe: assignedToMe ? "1" : null });

  // Normalize malformed values once at the URL boundary. Waiting for the
  // territory tree when a territory filter is present prevents an unsupported
  // region/department from reaching the list API before it can be removed.
  useEffect(() => {
    if (!normalizedDossierHref || statusRedirectPending) return;
    const currentHref = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    if (normalizedDossierHref !== currentHref) router.replace(normalizedDossierHref, { scroll: false });
  }, [normalizedDossierHref, pathname, router, searchParams, statusRedirectPending]);

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === search) return;
    const timer = setTimeout(() => {
      setSearch(trimmed);
      setUrlFilter({ search: trimmed || null, q: null }, "replace");
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search, setUrlFilter]);

  const page = questionnairesQuery.data;

  const rawItems = territoryFiltersValid && !statusRedirectPending ? page?.items ?? [] : [];
  // Real rows only. An empty result renders an empty state; there is no
  // sample dataset to substitute, and an error never becomes "no dossiers".
  const allDossiers: DossierItem[] = rawItems.map((sub: QuestionnaireListItem) => {
    const blockingCount = sub.anomalies?.filter((anomaly) => anomaly.isBlocking && anomaly.status === "OPEN").length ?? 0;
    const warningCount = sub.anomalies?.filter((anomaly) => !anomaly.isBlocking && anomaly.status === "OPEN").length ?? 0;
    const name = resolveEntityName(sub) ?? t("fileFallbackName");

    return {
      id: sub.id,
      submissionId: sub.submissionId || sub.id,
      establishmentId: sub.companyEstablishmentId ?? null,
      // Null, not a placeholder name: the entity detail row may be absent.
      companyName: name,
      respondentName: sub.respondent?.respondentName ?? null,
      region: sub.region ?? null,
      department: sub.department ?? null,
      subdivision: sub.subdivision ?? null,
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
      validationDataAvailable: Array.isArray(sub.anomalies),
      submittedAt: sub.submissionDate ?? null,
      isLate: sub.isLate === true,
      assigneeId: sub.assigneeId ?? null,
      assigneeName: sub.assigneeName ?? null,
    };
  });

  // Quality and assignment are part of the server query, so this page is
  // already the filtered page. Do not drop rows again here: that would
  // leave `total` and the export describing a different set.
  const dossiers: DossierItem[] = allDossiers;

  const typeColumnLabel = vue === "completed" ? t("typeColumn") : t("entityTypeColumn");
  const activeFilterChips: Array<{ key: string; label: string; remove: () => void }> = [];
  if (search) activeFilterChips.push({ key: "search", label: `${t("freeSearchLabel")}: ${search}`, remove: () => { setSearchInput(""); setSearch(""); setUrlFilter({ search: null, q: null }); } });
  if (campaignIdFilter) {
    const selectedCampaignLabel = campaignOptions.find((option) => option.value === campaignIdFilter)?.label ?? campaignIdFilter;
    activeFilterChips.push({ key: "campaignId", label: `${t("campaignLabel")}: ${selectedCampaignLabel}`, remove: () => setCampaign("") });
  }
  if (statusFilter) activeFilterChips.push({ key: "status", label: `${t("statusFilterAriaLabel")}: ${t(STATUS_VIEWS.find((v) => v.status === statusFilter)?.labelKey ?? "statusAll")}`, remove: () => setStatus("") });
  if (typeFilter) activeFilterChips.push({ key: "formType", label: `${typeColumnLabel}: ${typeLabel(typeFilter)}`, remove: () => setType("") });
  if (periodFilter) activeFilterChips.push({ key: "period", label: `${t("periodLabel")}: ${t(PERIODS.find((p) => p.value === periodFilter)?.labelKey ?? "allPeriods")}`, remove: () => setPeriod("") });
  if (regionFilter) activeFilterChips.push({ key: "region", label: `${t("regionColumn")}: ${regionFilter}`, remove: () => setRegion("") });
  if (departmentFilter) activeFilterChips.push({ key: "department", label: `${t("departmentLabel")}: ${departmentFilter}`, remove: () => setDepartment("") });
  if (!campaignIdFilter && quarterCodeFilter) activeFilterChips.push({ key: "quarterCode", label: `${t("quarterLabel")}: ${quarterCodeFilter}`, remove: () => setQuarter("") });
  if (lateFilter) activeFilterChips.push({ key: "late", label: t("lateOnly"), remove: () => setLate(false) });
  if (vue !== "completed" && overdueFilter) activeFilterChips.push({ key: "overdue", label: t("overdueOnly"), remove: () => setOverdue(false) });
  if (vue === "completed" && !includeArchived) activeFilterChips.push({ key: "includeArchived", label: t("archivedHiddenFilter"), remove: () => setUrlFilter({ includeArchived: "true" }) });
  if (qualityFilter) {
    const qualityLabels: Record<string, string> = {
      clean: t("qualityClean"),
      warnings: t("qualityWarnings"),
      blocking: t("qualityBlocking"),
    };
    activeFilterChips.push({
      key: "quality",
      label: `${t("controlsColumn")}: ${qualityLabels[qualityFilter] ?? qualityFilter}`,
      remove: () => setQuality(""),
    });
  }
  if (assignmentFilter) {
    const assignmentLabels: Record<string, string> = {
      me: t("assignedToMeOnly"),
      unassigned: t("unassigned"),
      other: t("assignedOther"),
    };
    activeFilterChips.push({
      key: "assignment",
      label: `${t("assignedLabel")}: ${assignmentLabels[assignmentFilter] ?? assignmentFilter}`,
      remove: () => setAssignment(""),
    });
  } else if (assignedToMeFilter) {
    activeFilterChips.push({ key: "assignedToMe", label: t("assignedToMeOnly"), remove: () => setAssignedToMe(false) });
  }
  if (companyIdFilter) {
    // Prefer the resolved company name from the first loaded row; the UUID is
    // only shown as a fallback when no matching row has been fetched yet.
    const resolvedCompanyName = allDossiers.find((d) => d.companyName)?.companyName ?? companyIdFilter.slice(0, 8) + "…";
    activeFilterChips.push({ key: "companyId", label: `${t("organisationColumn")}: ${resolvedCompanyName}`, remove: () => setUrlFilter({ companyId: null }) });
  }
  if (sortOrder) activeFilterChips.push({ key: "sort", label: t("sortOldest"), remove: () => setSort("") });
  const hasActiveAdvancedDossierFilters = Boolean(
    periodFilter || lateFilter || overdueFilter || assignmentFilter || qualityFilter || sortOrder || (!campaignIdFilter && quarterCodeFilter),
  );
  const clearAllFilters = () => setUrlFilter({ status: null, formType: null, period: null, region: null, department: null, quarterCode: null, late: null, overdue: null, assignedToMe: null, assignment: null, quality: null, companyId: null, campaignId: null, includeArchived: "true", sort: null, search: null, q: null });

  /**
   * Source: GET /admin/questionnaires → `total`.
   * Counts the whole filtered query (territory + status + type + region +
   * period + search, drafts excluded) under the caller's server-side scope —
   * the same scope that produced the rows above. `null` until the server
   * answers; never replaced by a literal.
   */
  const totalCount = territoryFiltersValid && !statusRedirectPending ? page?.total ?? null : null;
  const pageCount = totalCount === null ? null : Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const requestedCurrentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const visibleOffset = displayedResultOffset(offset, page?.requestedOffset ?? offset, questionnairesQuery.isPlaceholderData);
  const displayedPage = Math.floor(visibleOffset / PAGE_SIZE) + 1;
  const currentPage = page && territoryFiltersValid && !statusRedirectPending
    ? clampAdminListPage(displayedPage, page.total, PAGE_SIZE)
    : displayedPage;
  const displayOffset = (currentPage - 1) * PAGE_SIZE;
  const visibleRange = adminResultRange(displayOffset, dossiers.length, totalCount ?? 0);

  useEffect(() => {
    if (!page || statusRedirectPending || questionnairesQuery.isPlaceholderData || (view !== "submissions" && view !== "completed")) return;
    if (currentPage !== requestedCurrentPage) {
      router.replace(hrefWith(pathname, searchParams.toString(), {
        [`${view}Page`]: currentPage > 1 ? String(currentPage) : null,
        page: null,
      }), { scroll: false });
    }
  }, [currentPage, page, pathname, questionnairesQuery.isPlaceholderData, requestedCurrentPage, router, searchParams, statusRedirectPending, view]);

  const tableState = resolveDataState({
    isLoading: statusRedirectPending || questionnairesQuery.isLoading || (hasTerritoryFilters && !territoryStructure.isError && !territoryFiltersValid),
    isError: questionnairesQuery.isError || (hasTerritoryFilters && territoryStructure.isError),
    error: questionnairesQuery.error ?? (hasTerritoryFilters && territoryStructure.isError ? territoryStructure.error : undefined),
    rowCount: territoryFiltersValid && !statusRedirectPending ? page?.items.length ?? null : statusRedirectPending ? null : 0,
  });
  const tableError = questionnairesQuery.error ?? (hasTerritoryFilters && territoryStructure.isError ? territoryStructure.error : undefined);
  const retryTable = () => {
    if (hasTerritoryFilters && territoryStructure.isError) void territoryStructure.refetch();
    else void questionnairesQuery.refetch();
  };

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
  const selectedOnPageCount = dossiers.reduce((count, dossier) => count + Number(selectedIds.has(dossier.id)), 0);
  const pageSelectionState: boolean | "indeterminate" = dossiers.length > 0 && selectedOnPageCount === dossiers.length
    ? true
    : selectedOnPageCount > 0
      ? "indeterminate"
      : false;

  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const toggleSelectPage = (checked: boolean) => {
    const next = new Set(selectedIds);
    for (const dossier of dossiers) {
      if (checked) next.add(dossier.id);
      else next.delete(dossier.id);
    }
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
    if (exportInProgress || !territoryFiltersValid || statusRedirectPending) return;
    setExportInProgress(true);
    try {
      const params = new URLSearchParams({ format: fmt });
      if (vue === "completed") {
        params.set("statuses", statusFilter === "APPROVED" || statusFilter === "REJECTED" || statusFilter === "SUPERSEDED" ? statusFilter : "APPROVED,REJECTED,SUPERSEDED");
        params.set("includeArchived", String(includeArchived));
      } else if (statusFilter) params.set("status", statusFilter);
      else params.set("statuses", "PENDING_REVIEW,CORRECTION_REQUESTED");
      if (typeFilter) params.set("formType", typeFilter);
      if (regionFilter) params.set("region", regionFilter);
      if (departmentFilter) params.set("department", departmentFilter);
      if (listCampaignId) params.set("campaignId", listCampaignId);
      if (listQuarterCode) params.set("quarterCode", listQuarterCode);
      if (companyIdFilter) params.set("companyId", companyIdFilter);
      if (lateFilter) params.set("late", "1");
      if (vue !== "completed" && overdueFilter) params.set("overdue", "1");
      if (qualityParam) params.set("quality", qualityParam);
      if (assignmentParam) params.set("assignment", assignmentParam);
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
  const viewHref = (target: "submissions" | "completed" | "followup") =>
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
              value={campaignSelectValue}
              onChange={(event) => setCampaign(event.target.value)}
              disabled={vue === "followup" && !followUpCampaignCatalogReady}
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
          badge: actionableQueueCount,
        },
        {
          label: t("viewCompleted"),
          href: viewHref("completed"),
          isActive: activeView === "completed",
        },
        {
          label: t("viewFollowUp"),
          href: viewHref("followup"),
          isActive: activeView === "followup",
        },
      ]}
    />
  );

  if (vue === "coverage") return null;

  if (vue === "followup") {
    return (
      <section id="dossier-view-followup" className="cam-dossier-view cam-dossier-view--followup">
        {showPageHeader && pageHeader}
        <AdminTablePanel
          title={t("followUpHeading")}
          description={t("followUpScopeNote")}
          headingId="dossiers-followup-heading"
          className="cam-dossier-followup-table"
        >
          {!territoryStructure.isSuccess ? (
            territoryStructure.isError ? (
              <DataState
                state="error"
                resource={t("followUpResource")}
                error={territoryStructure.error}
                onRetry={() => territoryStructure.refetch()}
              />
            ) : <DataState state="loading" resource={t("followUpResource")} />
          ) : !followUpCampaignCatalogReady ? (
            campaignsQuery.isError || allCollectionCampaignsQuery.isError ? (
              <DataState
                state="error"
                resource={t("followUpResource")}
                error={campaignsQuery.error ?? allCollectionCampaignsQuery.error}
                onRetry={() => {
                  void campaignsQuery.refetch();
                  if (mayListAllCampaigns) void allCollectionCampaignsQuery.refetch();
                }}
              />
            ) : <DataState state="loading" resource={t("followUpResource")} />
          ) : campaignIdFilter && !followUpCampaignIsValid ? (
            <DataState state="loading" resource={t("followUpResource")} />
          ) : !effectiveCampaignId ? (
            <DataState state="empty" resource={t("followUpResource")} title={t("noFollowUpCampaign")} />
          ) : nonRespondentsQuery.isLoading ? (
            <DataState state="loading" resource={t("followUpResource")} />
          ) : nonRespondentsQuery.isError ? (
            <DataState
              state="error"
              resource={t("followUpResource")}
              error={nonRespondentsQuery.error}
              onRetry={() => nonRespondentsQuery.refetch()}
            />
          ) : nonRespondentsQuery.data ? (
            <CampaignNonRespondentsTable
              data={nonRespondentsQuery.data}
              canShowContacts={hasRole(user?.role, SURVEY_ROLES)}
              territories={territoryStructure.data}
            />
          ) : null}
        </AdminTablePanel>
      </section>
    );
  }

  return (
    <section id={`dossier-view-${vue}`} className={`cam-dossier-view cam-dossier-view--${vue}`}>
      {showPageHeader && pageHeader}
      {reopenNotice && <Alert variant="success" className="my-4"><AlertDescription>{reopenNotice}</AlertDescription></Alert>}
      {assignNotice && <Alert variant="destructive" className="my-4"><AlertDescription>{assignNotice}</AlertDescription></Alert>}
      {archiveNotice && <Alert variant="destructive" className="my-4"><AlertDescription>{archiveNotice}</AlertDescription></Alert>}

      {vue === "submissions" && (
        <DossierResponseRateKpi
          campaignId={campaignIdFilter}
          campaignLabel={campaignOptions.find((option) => option.value === campaignIdFilter)?.label}
          value={responseRateValue}
        />
      )}

      {vue !== "completed" && queues && queues.reviewDelay.pendingOverThresholdCount > 0 && (
        <Alert variant="warning" className="cam-dossier-overdue-alert my-4">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>
            <span>{t("reviewDelayBanner", { count: queues.reviewDelay.pendingOverThresholdCount })}</span>
            <Button asChild size="sm" variant="outline" className="cam-dossier-overdue-action">
              <Link href={hrefWith(pathname, searchParams.toString(), {
                status: "PENDING_REVIEW",
                overdue: "1",
                sort: "oldest",
              })}>
                {t("reviewDelayLink")}
              </Link>
            </Button>
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

      {/* ── Filters, toolbar and table share one card. ── */}
      <AdminTablePanel
        headingId={`dossiers-${vue}-heading`}
        showHeader={false}
        cardClassName={vue === "submissions" ? "cam-dossier-submissions-card" : vue === "completed" ? "cam-dossier-completed-card" : undefined}
        busy={isBackgroundRefreshing(questionnairesQuery.isFetching, questionnairesQuery.data)}
        busyLabel={t("updatingResults")}
        footer={(
          <div className="cam-dossier-pagination">
            {totalCount === null ? (
              <span aria-hidden="true">{NOT_PROVIDED}</span>
            ) : (
              <AdminLiveResultCount announce={!questionnairesQuery.isPlaceholderData}>
                {totalCount === 0
                  ? t("zeroSubmissions")
                  : t("showingRange", {
                      first: count(visibleRange.start, locale),
                      last: count(visibleRange.end, locale),
                      total: count(totalCount, locale),
                      count: totalCount,
                    })}
              </AdminLiveResultCount>
            )}
            <div className="cam-dossier-pagination-controls">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => goToOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                {t("previousButton")}
              </Button>
              <span className="cam-dossier-page-indicator">
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
          </div>
        )}
      >
        {vue === "submissions" && <CardContent className="cam-dossier-submissions-card-heading">
          <h2 id={`dossiers-${vue}-heading`}>{t("queueHeading")}</h2>
          {!readOnly && <Button type="button" size="sm" variant="outline" onClick={() => handleExport("csv")} disabled={exportInProgress || !territoryFiltersValid || statusRedirectPending}><Download aria-hidden="true" />{t("exportButton")}</Button>}
        </CardContent>}
        {vue === "completed" && <CardContent className="cam-dossier-completed-heading">
          <h2 id={`dossiers-${vue}-heading`}>{t("completedHeading")}</h2>
          {!readOnly && <Button type="button" size="sm" variant="outline" onClick={() => handleExport("csv")} disabled={exportInProgress || !territoryFiltersValid || statusRedirectPending}><Download aria-hidden="true" />{t("exportButton")}</Button>}
        </CardContent>}
        {vue === "completed" && <CardContent className="cam-dossier-completed-archive-filter"><label className="flex items-center gap-2 text-sm"><Checkbox checked={includeArchived} onCheckedChange={(checked) => setUrlFilter({ includeArchived: checked === true ? "true" : "false" })} />{t("showArchived")}</label></CardContent>}
        {dossierStatusBreakdown.some((item) => item.value !== undefined) && (
          <CardContent className="cam-dossier-status-summary" role="group" aria-label={t("statusFilterAriaLabel")}>
            <ul>
              {dossierStatusBreakdown.map((item) => item.value === undefined ? null : (
                <li key={item.key}>
                  <span>{item.label}</span>
                  <strong>{new Intl.NumberFormat(locale).format(item.value)}</strong>
                </li>
              ))}
            </ul>
            {vue === "submissions" && <p role="note">{t("statusCountsScopeNote")}</p>}
          </CardContent>
        )}
        {vue === "submissions" && !readOnly && selectedIds.size > 0 && (
          <CardContent className="cam-dossier-selection-toolbar" aria-live="polite">
            <span className="text-sm font-medium text-foreground">{t("selectionEligibleSummary", { selected: selectedIds.size, eligible: bulkEligibleSelected.length, excluded: excludedSelected.length })}</span>
            {excludedSelected.length > 0 && <details className="text-sm"><summary className="cursor-pointer underline">{t("whyExcluded")}</summary><ul className="mt-2 list-disc ps-5">{excludedSelected.map((d) => <li key={d.id}>{t("excludedRecordReason", { name: d.companyName ?? d.submissionId, reason: d.blockingCount > 0 ? t("blockingAnomalies", { count: d.blockingCount }) : t("notBulkEligibleReason") })}</li>)}</ul></details>}
            <div className="cam-dossier-selection-actions">
              <Button type="button" size="sm" onClick={handleOpenBulkModal} disabled={bulkEligibleSelected.length === 0 || cleanPendingSelected.length === 0}><span aria-hidden="true">✓</span> {t("endorseSelectionButton")}</Button>
              <Button type="button" size="sm" variant="outline" onClick={handleOpenCorrectionModal} disabled={correctableSelected.length === 0}>{t("requestCorrectionSelectionButton")}</Button>
              <Button type="button" size="sm" variant="destructive" onClick={handleOpenRejectModal} disabled={bulkEligibleSelected.length === 0 || rejectableSelected.length === 0}><span aria-hidden="true">×</span> {t("rejectSelectionButton")}</Button>
            </div>
          </CardContent>
        )}
        <CardContent className={`border-b pt-5${vue === "submissions" ? " cam-dossier-submissions-filters" : vue === "completed" ? " cam-dossier-completed-filters" : " cam-dossier-main-coverage-filters"}`}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div>
              <Label htmlFor={`dossiers-search-${vue}`}>{t("freeSearchLabel")}</Label>
              <Input id={`dossiers-search-${vue}`} type="search" placeholder={t("freeSearchPlaceholder")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            </div>
            <div>
              <Label htmlFor={`dossiers-status-${vue}`}>{t("statusFilterAriaLabel")}</Label>
              <select id={`dossiers-status-${vue}`} className="cam-admin-input w-full" value={statusFilter} onChange={(event) => setStatus(event.target.value as DossierStatus | "")}>
                {dossierStatusSummary.map((item) => (
                  <option key={item.key} value={item.key === "all" ? "" : item.key}>{item.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor={`dossiers-type-${vue}`}>{typeColumnLabel}</Label>
              <select id={`dossiers-type-${vue}`} className="cam-admin-input w-full" value={typeFilter} onChange={(event) => setType(event.target.value)}>
                <option value="">{vue === "completed" ? t("allFormTypes") : t("allEntityTypes")}</option>
                {FORM_TYPES.map((value) => <option key={value} value={value}>{typeLabel(value)}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor={`dossiers-region-${vue}`}>{t("regionColumn")}</Label>
              <select id={`dossiers-region-${vue}`} className="cam-admin-input w-full" value={regionFilter} onChange={(event) => setRegion(event.target.value)}>
                <option value="">{t("allRegions")}</option>
                {territoryRegions.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor={`dossiers-department-${vue}`}>{t("departmentLabel")}</Label>
              <select id={`dossiers-department-${vue}`} className="cam-admin-input w-full" value={departmentFilter} onChange={(event) => setDepartment(event.target.value)}>
                <option value="">{t("allDepartments")}</option>
                {territoryDepartments.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          </div>
          <AdminFilterDisclosure label={t("moreFilters")} active={hasActiveAdvancedDossierFilters} className="cam-admin-filter-disclosure--full mt-3">
            <div>
              <Label htmlFor={`dossiers-period-${vue}`}>{t("periodLabel")}</Label>
              <select id={`dossiers-period-${vue}`} className="cam-admin-input w-full" value={periodFilter} onChange={(event) => setPeriod(event.target.value)}>
                <option value="">{t("allPeriods")}</option>
                {PERIODS.map((period) => <option key={period.value} value={period.value}>{t(period.labelKey)}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor={`dossiers-late-${vue}`}>{t("lateLabel")}</Label>
              <select id={`dossiers-late-${vue}`} className="cam-admin-input w-full" value={lateFilter ? "1" : ""} onChange={(event) => setLate(event.target.value === "1")}>
                <option value="">{t("lateAll")}</option>
                <option value="1">{t("lateOnly")}</option>
              </select>
            </div>
            {vue !== "completed" && (
              <div>
                <Label htmlFor={`dossiers-overdue-${vue}`}>{t("overdueLabel")}</Label>
                <select id={`dossiers-overdue-${vue}`} className="cam-admin-input w-full" value={overdueFilter ? "1" : ""} onChange={(event) => setOverdue(event.target.value === "1")}>
                  <option value="">{t("overdueAll")}</option>
                  <option value="1">{t("overdueOnly")}</option>
                </select>
              </div>
            )}
            <div>
              <Label htmlFor={`dossiers-assigned-${vue}`}>{t("assignedLabel")}</Label>
              <select id={`dossiers-assigned-${vue}`} className="cam-admin-input w-full" value={assignmentFilter} onChange={(event) => setAssignment(event.target.value)}>
                <option value="">{t("assignedAll")}</option>
                <option value="unassigned">{t("unassigned")}</option>
                <option value="me">{t("assignedToMeOnly")}</option>
                <option value="other">{t("assignedOther")}</option>
              </select>
            </div>
            {vue === "submissions" && (
              <div>
                <Label htmlFor="dossiers-controls">{t("controlsColumn")}</Label>
                <select id="dossiers-controls" className="cam-admin-input w-full" value={qualityFilter} onChange={(event) => setQuality(event.target.value)}>
                  <option value="">{t("statusAll")}</option>
                  <option value="clean">{t("qualityClean")}</option>
                  <option value="warnings">{t("qualityWarnings")}</option>
                  <option value="blocking">{t("qualityBlocking")}</option>
                </select>
              </div>
            )}
            <div>
              <Label htmlFor={`dossiers-sort-${vue}`}>{t("sortLabel")}</Label>
              <select id={`dossiers-sort-${vue}`} className="cam-admin-input w-full" value={sortOrder || "newest"} onChange={(event) => setSort(parseDossierSort(event.target.value === "newest" ? "" : event.target.value))}>
                <option value="newest">{t("sortNewest")}</option>
                <option value="oldest">{t("sortOldest")}</option>
              </select>
            </div>
            {!campaignIdFilter && (
              <div>
                <Label htmlFor={`dossiers-quarter-${vue}`}>{t("quarterLabel")}</Label>
                <select id={`dossiers-quarter-${vue}`} className="cam-admin-input w-full" value={quarterCodeFilter} onChange={(event) => setQuarter(event.target.value)}>
                  <option value="">{t("allQuarters")}</option>
                  {quarterOptions.map((code) => <option key={code} value={code}>{quarterLabel(code)}</option>)}
                </select>
              </div>
            )}
          </AdminFilterDisclosure>
          <AdminActiveFilterChips filters={activeFilterChips.map(({ key, label, remove }) => ({ key, label, onClear: remove }))} label={t("activeFiltersLabel")} clearAllLabel={t("clearFilters")} onClearAll={clearAllFilters} removeFilterLabel={(label) => t("removeFilterChip", { label })} />
        </CardContent>
        <CardContent className={`overflow-x-auto pt-5${vue === "submissions" ? ` cam-dossier-submissions-table${readOnly ? " cam-dossier-submissions-table--read-only" : ""}` : vue === "completed" ? " cam-dossier-completed-table" : ""}`}>
          <Table>
            <colgroup>
              {(vue === "completed"
                ? [210, 130, 145, 175, 160, 210, 135, 105, 110]
                : readOnly ? [268, 150, 156, 200, 230, 190, 160] : [44, 268, 150, 156, 200, 230, 190, 160]
              ).map((width, index) => <col key={`${vue}-column-${index}`} style={{ width }} />)}
            </colgroup>
            <TableHeader>
              <TableRow>
                {vue === "completed" ? <>
                  <TableHead scope="col" className="sticky left-0 z-20 bg-[var(--cam-surface)] shadow-[2px_0_3px_-3px_rgba(15,23,42,0.45)] border-r">{t("organisationColumn")}</TableHead>
                  <TableHead scope="col">{t("establishmentIdColumn")}</TableHead>
                  <TableHead scope="col">{t("typeColumn")}</TableHead>
                  <TableHead scope="col">{t("territoryColumn")}</TableHead>
                  <TableHead scope="col">{t("campaignPeriodColumn")}</TableHead>
                  <TableHead scope="col">{t("decisionColumn")}</TableHead>
                  <TableHead scope="col">{t("decisionDateColumn")}</TableHead>
                  <TableHead scope="col">{t("archiveStatusColumn")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("actionsColumn")}</TableHead>
                </> : <>
                  {!readOnly && <TableHead scope="col" className="cam-dossier-select-column sticky left-0 z-20 bg-[var(--cam-surface)]">
                    <Checkbox checked={pageSelectionState} onCheckedChange={(checked) => toggleSelectPage(checked === true)} disabled={dossiers.length === 0} aria-label={t("selectAllAria")} />
                  </TableHead>}
                  <TableHead scope="col" className={`cam-dossier-record-column sticky ${readOnly ? "left-0 cam-dossier-record-column--first" : "left-[44px]"} z-20 bg-[var(--cam-surface)]`}>{t("entityColumn")}</TableHead>
                  <TableHead scope="col">{t("entityTypeColumn")}</TableHead>
                  <TableHead scope="col">{t("territoryColumn")}</TableHead>
                  <TableHead scope="col">{t("campaignPeriodColumn")}</TableHead>
                  <TableHead scope="col" title={t("dataIssuesHelp")}>{t("reviewStatusChecksColumn")}</TableHead>
                  <TableHead scope="col">{t("submissionWaitingColumn")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("actionsColumn")}</TableHead>
                </>}
              </TableRow>
            </TableHeader>
            <TableBody>
              <DataStateRow colSpan={vue === "completed" ? 9 : readOnly ? 7 : 8} state={tableState} resource={t("filesResource")} error={tableError} onRetry={retryTable} title={tableState === "empty" ? t("noFilesTitle") : undefined} hint={tableState === "empty" ? t("noFilesHint") : undefined} />
              {dossiers.map((d) => {
                 const visaBadge: { label: string; tone: ToneName } = d.adminStatus === "APPROVED" ? { label: t("badgeEndorsed"), tone: "success" } : d.adminStatus === "CORRECTION_REQUESTED" ? { label: t("badgeCorrection"), tone: "error" } : d.adminStatus === "REJECTED" ? { label: t("badgeRejected"), tone: "error" } : d.adminStatus === "PENDING_REVIEW" ? { label: t("badgePending"), tone: "warning" } : d.adminStatus === "SUPERSEDED" ? { label: t("badgeSuperseded"), tone: "neutral" } : { label: t("badgeNoStatus"), tone: "neutral" };
                const qualityText = [
                  d.blockingCount > 0 ? t("blockingAnomalies", { count: d.blockingCount }) : null,
                  d.warningCount > 0 ? t("warnings", { count: d.warningCount }) : null,
                ].filter(Boolean).join(" · ");
                const qualityTitle = qualityText ? `${qualityText} — ${t("dataIssuesHelp")}` : t("dataIssuesHelp");
                const campaignName = d.campaignName ? formatCampaignDisplayName(d.campaignName) : NOT_PROVIDED;
                const periodLabel = d.quarterCode ? referencePeriodLabel(d.quarterCode, locale) : NOT_PROVIDED;
                const territoryTitle = [d.region, d.department].filter(Boolean).join(" / ") || NOT_PROVIDED;
                const waiting = d.adminStatus === "PENDING_REVIEW" && nowMs !== null ? elapsedDays(d.submittedAt, nowMs) : null;
                const isReviewOverdue = d.adminStatus === "PENDING_REVIEW" && nowMs !== null && elapsedMoreThanDays(d.submittedAt, nowMs, 7);
                const canManageArchive = hasRole(user?.role, DOSSIER_ARCHIVE_ROLES);
                const canAssign = !readOnly && !d.archivedAt && (d.assigneeId == null || d.assigneeId === user?.id);
                const hasQueueMenu = canAssign;
                const hasCompletedActions = (canReadAudit || canManageArchive || (canReopen && d.adminStatus === "APPROVED"));
                const actionsLabel = t("rowActionsAria", { name: d.companyName ?? d.submissionId });
                const detailQuery = new URLSearchParams({ returnTo: dossierReturnTo });
                if (vue === "completed" && includeArchived) detailQuery.set("includeArchived", "true");
                const detailHref = `/admin/dossiers/${encodeURIComponent(d.id)}?${detailQuery.toString()}`;
                const openFile = <Button asChild size="sm" variant="default" className="whitespace-nowrap">
                  <Link href={detailHref}>{t("openFileButton")}</Link>
                </Button>;
                const openQueueFile = <Button asChild size="sm" variant="default" className="whitespace-nowrap">
                  <Link href={detailHref}>{t("reviewDossierButton")}</Link>
                </Button>;
                const rowMenu = (menuItems: ReactNode) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" aria-label={actionsLabel}>
                        <MoreHorizontal aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">{menuItems}</DropdownMenuContent>
                  </DropdownMenu>
                );

                return vue === "completed" ? <TableRow key={d.id}>
                  <TableCell className="sticky left-0 z-10 align-top whitespace-normal bg-[var(--cam-surface)] border-r">
                    <span className="cam-dossier-record-name" title={d.companyName ?? NOT_PROVIDED}>{d.companyName ?? NOT_PROVIDED}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap"><span className="cam-admin-code" title={d.establishmentId ?? undefined}>{d.establishmentId ?? NOT_PROVIDED}</span></TableCell>
                  <TableCell className="whitespace-normal"><span className="cam-dossier-type-value" title={d.formType ? typeLabel(d.formType) : NOT_PROVIDED}>{d.formType ? typeLabel(d.formType) : NOT_PROVIDED}</span></TableCell>
                  <TableCell className="align-top whitespace-normal" title={territoryTitle}>
                    <div className="cam-dossier-cell-stack">
                      {d.region && <span className="cam-dossier-cell-primary">{d.region}</span>}
                      {d.department && <span className="cam-dossier-cell-secondary"><span className="cam-dossier-field-label">{t("departmentLabel")}</span><span>{d.department}</span></span>}
                      {!d.region && !d.department && <span className="cam-dossier-cell-secondary">{NOT_PROVIDED}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    <span className="cam-dossier-cell-primary" title={campaignName}>{campaignName}</span>
                    <span className="block text-sm text-muted-foreground">{periodLabel}</span>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    <Badge variant={BADGE_VARIANT[visaBadge.tone]}>{visaBadge.label}</Badge>
                    {d.rejectionReason && <span className="mt-1 block text-sm text-muted-foreground" title={d.rejectionReason}>{d.rejectionReason}</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{stamp(d.reviewedAt, false, locale)}</TableCell>
                  <TableCell>{d.archivedAt && <Badge variant="neutral">{t("archivedBadge")}</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {openFile}
                      {hasCompletedActions && rowMenu(<>
                        {canReadAudit && <DropdownMenuItem asChild><Link href={`/admin/journal-audit?resourceId=${encodeURIComponent(d.id)}`}>{t("historyLink")}</Link></DropdownMenuItem>}
                        {canManageArchive && !d.archivedAt && <DropdownMenuItem onSelect={() => setArchiveTarget(d)}>{t("archiveButton")}</DropdownMenuItem>}
                        {canManageArchive && d.archivedAt && <DropdownMenuItem disabled={restoreMutation.isPending} onSelect={() => restoreMutation.mutate(d.id)}>{t("restoreButton")}</DropdownMenuItem>}
                        {canReopen && d.adminStatus === "APPROVED" && <DropdownMenuItem onSelect={() => { setReopenNotice(""); reopenMutation.reset(); setReopenTarget(d); setReopenReason(""); setCertifiedReopen(false); }}>{t("reopenButton")}</DropdownMenuItem>}
                      </>)}
                    </div>
                  </TableCell>
                </TableRow> : <TableRow key={d.id}>
                  {!readOnly && <TableCell className="cam-dossier-select-column sticky left-0 z-10 align-top bg-[var(--cam-surface)]">
                    <Checkbox className="mt-1 shrink-0" checked={selectedIds.has(d.id)} onCheckedChange={(checked) => toggleSelect(d.id, checked === true)} aria-label={t("selectRowAria", { name: d.companyName ?? d.respondentName ?? d.submissionId })} />
                  </TableCell>}
                  <TableCell className={`cam-dossier-record-column sticky ${readOnly ? "left-0 cam-dossier-record-column--first" : "left-[44px]"} z-10 align-top whitespace-normal bg-[var(--cam-surface)]`}>
                    <div className="cam-dossier-record-stack">
                      <span className="cam-dossier-record-name" title={d.companyName ?? NOT_PROVIDED}>{d.companyName ?? NOT_PROVIDED}</span>
                      {d.respondentName && <span className="cam-dossier-record-meta"><span className="cam-dossier-field-label">{t("respondentColumn")}</span><span title={d.respondentName}>{d.respondentName}</span></span>}
                    </div>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal"><span className="cam-dossier-type-value" title={d.formType ? typeLabel(d.formType) : NOT_PROVIDED}>{d.formType ? typeLabel(d.formType) : NOT_PROVIDED}</span></TableCell>
                  <TableCell className="align-top whitespace-normal" title={territoryTitle}>
                    <div className="cam-dossier-cell-stack">
                      {d.region && <span className="cam-dossier-cell-primary">{d.region}</span>}
                      {d.department && <span className="cam-dossier-cell-secondary"><span className="cam-dossier-field-label">{t("departmentLabel")}</span><span>{d.department}</span></span>}
                      {!d.region && !d.department && <span className="cam-dossier-cell-secondary">{NOT_PROVIDED}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    <div className="cam-dossier-cell-stack">
                      <span className="cam-dossier-cell-primary" title={campaignName}>{campaignName}</span>
                      <span className="cam-dossier-cell-secondary">{periodLabel}</span>
                    </div>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal" title={qualityTitle}>
                    <div className="cam-dossier-review-stack">
                      <Badge variant={BADGE_VARIANT[visaBadge.tone]}>{visaBadge.label}</Badge>
                      <div className="cam-dossier-validation-summary">
                        {d.blockingCount > 0 && <Badge variant="danger">{t("blockingAnomalies", { count: d.blockingCount })}</Badge>}
                        {d.warningCount > 0 && <Badge variant="danger">{t("warnings", { count: d.warningCount })}</Badge>}
                        {!d.validationDataAvailable
                          ? <span className="cam-dossier-cell-secondary">{t("validationDataUnavailable")}</span>
                          : d.blockingCount === 0 && d.warningCount === 0
                            ? <span className="cam-dossier-cell-secondary">{t("noOpenIssuesRecorded")}</span>
                            : null}
                      </div>
                      <span className="cam-dossier-owner">
                        <span className="cam-dossier-field-label">{t("reviewerLabel")}</span>
                        <span>{d.assigneeId ? d.assigneeName ?? NOT_PROVIDED : t("noReviewerAssigned")}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    <div className="cam-dossier-date-stack">
                      <span className="cam-dossier-date-primary">{stamp(d.submittedAt, true, locale)}</span>
                      {d.isLate && <Badge variant="warning">{t("lateBadge")}</Badge>}
                      {waiting !== null && (
                        <span className={`cam-dossier-waiting${isReviewOverdue ? " is-overdue" : ""}`}>
                          {t("waitingDays", { count: waiting })}
                          {isReviewOverdue && <Badge variant="warning">{t("overdueBadge")}</Badge>}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {openQueueFile}
                      {hasQueueMenu && rowMenu(<>
                        {d.assigneeId && <DropdownMenuLabel>{t("assignedTo", { name: d.assigneeName ?? NOT_PROVIDED })}</DropdownMenuLabel>}
                        {canAssign && <DropdownMenuItem disabled={assignMutation.isPending} onSelect={() => assignMutation.mutate({ id: d.id, assigneeId: d.assigneeId ? null : user?.id ?? null })}>{d.assigneeId ? t("unclaimButton") : t("claimButton")}</DropdownMenuItem>}
                      </>)}
                    </div>
                  </TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
        </CardContent>
        {archiveTarget && <ArchiveActions
          archived={false}
          canManage={hasRole(user?.role, DOSSIER_ARCHIVE_ROLES)}
          resourceName={archiveTarget.companyName ?? archiveTarget.submissionId}
          archiveLabel={t("archiveButton")}
          restoreLabel={t("restoreButton")}
          confirmTitle={t("archiveConfirmTitle")}
          reasonLabel={t("archiveReasonLabel")}
          cancelLabel={tRoot("common.cancel")}
          hideTrigger
          dialogOpen
          onDialogOpenChange={(open) => { if (!open) setArchiveTarget(null); }}
          onArchive={(reason) => { archiveMutation.mutate({ item: archiveTarget, reason }); setArchiveTarget(null); }}
          onRestore={() => {}}
        />}
      </AdminTablePanel>
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
