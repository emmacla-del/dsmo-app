"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Download, MoreHorizontal, Search } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { useAuthStore } from "@/lib/auth-store";
import { API_BASE_URL, getToken, localeHeader } from "@/lib/api-client";
import {
  listCompanyRegistrations,
  archiveUser,
  restoreUser,
  suspendUser,
  activateUser,
  decidedOrganisation,
  type CompanyRegistrationItem,
} from "@/lib/user-directory";
import { clampAdminListPage, parseAdminListPage, parseRegistrationVue } from "@/lib/admin-url";
import { selectAdminViewCounts } from "@/lib/admin-view-counts";
import { isBackgroundRefreshing } from "@/lib/admin-query-state";
import { buildRegistrationReturnTo } from "@/lib/admin-return";
import { registrationReviewHref } from "@/lib/registration-trail";
import { ENTITY_TYPE_OPTION_KEYS } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { APPROVAL_ROLES, USER_ARCHIVE_ROLES, USER_LIFECYCLE_ROLES, hasRole } from "@/lib/roles";
import {
  inscriptionsHref,
  normalizeInscriptionsHref,
  normalizeRegistrationStatus,
  organisationsStatusesForFilter,
  REGISTRATION_ENTITY_TYPES,
  REGISTRATION_METHOD_VALUES,
  registrationMethodLabel,
} from "@/lib/inscriptions";
import { departmentInRegion, regionInTree, useTerritoryDepartments, useTerritoryRegions, useTerritoryStructure } from "@/hooks/useTerritoryStructure";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { RegistrationQueue } from "@/components/admin/RegistrationQueue";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { AdminKpiStrip, type KpiItem } from "@/components/admin/AdminKpiStrip";
import { AdminNumberedPager } from "@/components/admin/AdminPager";
import { AdminLiveResultCount } from "@/components/admin/AdminLiveResultCount";
import { AdminActiveFilterChips } from "@/components/admin/AdminActiveFilterChips";
import { AdminFilterPill } from "@/components/admin/AdminFilterPill";
import { AdminFilterField, AdminFilterMore, AdminScopePill, territoryPillFor } from "@/components/admin/AdminFilterBarParts";
import { AdminSavedViews, savedViewQuery } from "@/components/admin/AdminSavedViews";
import { ArchiveActions } from "@/components/admin/ArchiveActions";
import { ConfirmDialog } from "@/components/auth/ConfirmDialog";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import { NOT_PROVIDED, count, resolveDataState } from "@/lib/admin-data-state";
import { coverageHref } from "@/lib/pilotage-targets";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 8;

/** The console tones, as Badge variants. */
type Tone = "neutral" | "success" | "warning" | "danger" | "info";

// API entity types, labelled through ENTITY_TYPE_OPTION_KEYS (the public
// wizard's labels, no administrative codes).

// The stored account status decides the badge: its label (a key under
// adminInscriptionsPage) and its tone. An unknown status shows as itself,
// neutral.
const STATUS_BADGE: Record<string, { textKey: string; tone: Tone }> = {
  PENDING_APPROVAL: { textKey: "badgePending", tone: "warning" },
  COMPLEMENTS_REQUESTED: { textKey: "badgeComplements", tone: "info" },
  ACTIVE: { textKey: "badgeApproved", tone: "success" },
  REJECTED: { textKey: "badgeRejected", tone: "danger" },
};


function buildOrganisationsRequestParams(filters: {
  search: string;
  statusFilter: string;
  typeFilter: string;
  region: string;
  department: string;
  registrationMethod?: string;
  sortOrder?: "oldest" | "newest";
  from?: string;
  to?: string;
  includeArchived: boolean;
  createdBy?: string;
}): Parameters<typeof listCompanyRegistrations>[0] {
  const status = normalizeRegistrationStatus(filters.statusFilter, "organisations");
  return {
    search: filters.search || undefined,
    statuses: organisationsStatusesForFilter(status, filters.createdBy),
    createdBy: filters.createdBy || undefined,
    view: "organisations",
    includeArchived: filters.includeArchived,
    entityType: filters.typeFilter || undefined,
    region: filters.region || undefined,
    department: filters.department || undefined,
    registrationMethod: filters.registrationMethod || undefined,
    sortOrder: filters.sortOrder,
    from: filters.from,
    to: filters.to,
  };
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function parseDateInput(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  return date;
}

function dateBoundary(date: Date, endOfDay = false): string {
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  // Registration dates follow the Cameroon calendar (Africa/Douala, UTC+1),
  // regardless of the reviewer's browser timezone.
  return `${dateKey}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+01:00`;
}

function formatQueueDate(date: Date, locale: "fr" | "en"): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

// Suspense because useSearchParams() requires it in the app router.
export default function InscriptionsPage() {
  return (
    <Suspense fallback={<InscriptionsLoading />}>
      <InscriptionsView />
    </Suspense>
  );
}

/**
 * The default view is the registration queue (pending review only), its own
 * component; the organisations list and the legacy coverage alias stay here.
 */
function InscriptionsView() {
  const searchParams = useSearchParams();
  return parseRegistrationVue(searchParams.get("vue")) === "queue"
    ? <RegistrationQueue />
    : <InscriptionsContent />;
}

/**
 * Writes list filters to the URL at once, on top of what the URL says now.
 *
 * Through the router the address only changed when the server answered, so a
 * second filter chosen meanwhile was built on the old query and dropped the
 * first. The list is read in the browser and has nothing to fetch from the
 * server, and Next keeps useSearchParams in step with the history API.
 */
function writeListUrl(changes: Record<string, string | number | null>, history: "push" | "replace" = "push") {
  const query = window.location.search.slice(1);
  const view = parseRegistrationVue(new URLSearchParams(query).get("vue"));
  const href = inscriptionsHref(query, view, changes);
  if (href === `/admin/inscriptions${query ? `?${query}` : ""}`) return;
  if (history === "push") window.history.pushState(null, "", href);
  else window.history.replaceState(null, "", href);
}

function InscriptionsLoading() {
  const t = useTranslations("adminInscriptionsPage");
  const tRoot = useTranslations();
  return (
    <div className="cam-admin-page">
      <DataState
        state="loading"
        resource={t("pageTitle")}
        title={tRoot("common.loading")}
      />
    </div>
  );
}

function InscriptionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // /admin/equipe's "Voir les inscriptions" arrives with ?vue=organisations&
  // createdBy=<userId>: every file that agent registered, whatever its status,
  // since the équipe card counts every status (organisationsStatusesForFilter).
  const vue = parseRegistrationVue(searchParams.get("vue"));
  const createdBy = vue === "organisations" ? searchParams.get("createdBy")?.trim() ?? "" : "";
  const requestedStatus = searchParams.get("status") ?? "";
  const initialStatus = normalizeRegistrationStatus(requestedStatus, vue);
  // The coverage ranking links a region here (?region=<Region.name>), the
  // same vocabulary this page's own filter options use. It only seeds the
  // filter: changing it afterwards is local state, as every other filter is,
  // and the backend re-checks the region against the reader's jurisdiction.
  const initialRegion = searchParams.get("region")?.trim() ?? "";
  const initialDepartment = searchParams.get("department")?.trim() ?? "";
  // ?type= seeds the entity-type filter, for the coverage view's per-type
  // ranking. An unknown code is dropped rather than sent: the filter offers
  // a fixed list, and an unrecognised one would narrow the queue to nothing
  // with no way to see why.
  const requestedType = searchParams.get("type")?.trim() ?? "";
  const initialType = REGISTRATION_ENTITY_TYPES.includes(requestedType as (typeof REGISTRATION_ENTITY_TYPES)[number]) ? requestedType : "";
  // Keep old registration-coverage URLs working while the view lives with
  // the other campaign views under /admin/cibles.
  // ADR-0001 / Phase 3: vue values will be renamed to registrations: queue |
  // organisations | coverage; declarations: submissions | completed | coverage.
  // vue is presentation only and grants no permission. Update parsers, tabs,
  // link helpers, and labels together. See docs/plans/admin-modules-refactor.md
  // Phase 3.
  const currentQuery = searchParams.toString();
  useEffect(() => {
    if (vue !== "coverage") return;
    router.replace(coverageHref(
      searchParams.get("annee"),
      searchParams.get("semestre"),
      searchParams.get("trimestre"),
    ));
  }, [router, searchParams, vue]);
  const establishmentReturnTo = buildRegistrationReturnTo(currentQuery);
  const page = parseAdminListPage(searchParams.get("page"));
  const setPage = useCallback((nextPage: number) => {
    const clampedPage = Math.max(1, Math.trunc(nextPage));
    writeListUrl({ page: clampedPage === 1 ? null : clampedPage });
  }, []);
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id);
  const includeArchived = vue === "organisations" && searchParams.get("includeArchived") === "true";
  const canReadQueue = !!role && APPROVAL_ROLES.includes(role);
  const queryClient = useQueryClient();
  const { regions: territoryRegions } = useTerritoryRegions();
  const tRoot = useTranslations();
  const t = useTranslations("adminInscriptionsPage");
  const locale = asUiLocale(useLocale());
  useEffect(() => {
    document.title = `${vue === "coverage" ? t("viewCoverage") : vue === "organisations" ? t("viewOrganisations") : t("pageTitle")} | CAMLEAP`;
  }, [t, vue]);
  const entityLabel = (value: string | null) =>
    value && ENTITY_TYPE_OPTION_KEYS[value] ? tRoot(ENTITY_TYPE_OPTION_KEYS[value]) : value ?? "—";
  // A table cell shows the short form; the full respondent label is its title.
  const entityShortLabel = (value: string | null) =>
    value && ENTITY_TYPE_OPTION_KEYS[value] ? t(`entityShort.${value}`) : value ?? NOT_PROVIDED;

  const requestedSearch = searchParams.get("search") ?? searchParams.get("organisation") ?? "";
  const rawRequestedMethod = searchParams.get("registrationMethod") ?? "";
  const requestedMethod = REGISTRATION_METHOD_VALUES.includes(rawRequestedMethod as (typeof REGISTRATION_METHOD_VALUES)[number])
    ? rawRequestedMethod
    : "";
  const dateFromParam = searchParams.get("from");
  const dateToParam = searchParams.get("to");
  const parsedFromDate = dateFromParam && Number.isFinite(Date.parse(dateFromParam)) ? parseDateInput(dateFromParam.slice(0, 10)) : undefined;
  const parsedToDate = dateToParam && Number.isFinite(Date.parse(dateToParam)) ? parseDateInput(dateToParam.slice(0, 10)) : undefined;
  const customDatesValid = Boolean(parsedFromDate && parsedToDate && Date.parse(dateFromParam ?? "") <= Date.parse(dateToParam ?? ""));
  const rawDateRange = searchParams.get("dateRange");
  const requestedDateRange = rawDateRange === "30" || rawDateRange === "90"
    ? rawDateRange
    : (rawDateRange === "custom" || (!rawDateRange && (dateFromParam || dateToParam))) && customDatesValid
      ? "custom"
      : "all";
  const [organisationInput, setOrganisationInput] = useState(requestedSearch);
  const [organisation, setOrganisation] = useState(requestedSearch.trim());
  const [regionInput, setRegion] = useState(initialRegion);
  const [departmentInput, setDepartment] = useState(initialDepartment);
  // A chosen region narrows the department list. Clearing the region keeps a
  // department that is still valid. An impossible pair is removed only after
  // the territory tree has loaded.
  const territoryStructure = useTerritoryStructure();
  const validRequestedRegion = !regionInput || !territoryStructure.isSuccess
    || regionInTree(territoryStructure.data, regionInput) !== false;
  const region = territoryStructure.isSuccess && !validRequestedRegion ? "" : regionInput;
  const validRequestedDepartment = !departmentInput || !territoryStructure.isSuccess || (
    region
      ? departmentInRegion(territoryStructure.data, region, departmentInput) !== false
      : territoryStructure.data.some((item) => item.departments.some((department) => department.name === departmentInput))
  );
  const department = territoryStructure.isSuccess && (!validRequestedRegion || !validRequestedDepartment)
    ? ""
    : departmentInput;
  const hasTerritoryFilters = Boolean(regionInput || departmentInput);
  const territoryFiltersValid = !hasTerritoryFilters || (
    territoryStructure.isSuccess && validRequestedRegion && validRequestedDepartment
  );
  const { departments: territoryDepartments } = useTerritoryDepartments(region || undefined);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const requestedAssignedToMe = vue === "queue" && (searchParams.get("assignedToMe") === "1" || searchParams.get("assignedToMe") === "true");
  const [assignedToMe, setAssignedToMe] = useState(requestedAssignedToMe);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [registrationMethod, setRegistrationMethod] = useState(requestedMethod);
  const [dateRange, setDateRange] = useState(requestedDateRange);
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest">(searchParams.get("sort") === "oldest" ? "oldest" : "newest");
  const requestedDuplicates = vue === "queue" ? searchParams.get("duplicates") ?? "" : "";
  const [duplicatesFilter, setDuplicatesFilter] = useState(
    requestedDuplicates === "with" || requestedDuplicates === "without" ? requestedDuplicates : "",
  );
  const [popoverDateFrom, setPopoverDateFrom] = useState(dateFromParam ? dateFromParam.slice(0, 10) : "");
  const [popoverDateTo, setPopoverDateTo] = useState(dateToParam ? dateToParam.slice(0, 10) : "");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(
    parsedFromDate && parsedToDate && customDatesValid ? { from: parsedFromDate, to: parsedToDate } : undefined,
  );
  const [archiveTarget, setArchiveTarget] = useState<CompanyRegistrationItem | null>(null);
  // The review page (/admin/inscriptions/[id]) comes back with the decision it
  // recorded, when it had no next file to move to.
  const arrivedDecision = searchParams.get("decisionNotice");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(() => {
    if (arrivedDecision !== "approved" && arrivedDecision !== "rejected" && arrivedDecision !== "complements") return null;
    const organisation = decidedOrganisation(queryClient, searchParams.get("decidedFile"));
    return {
      tone: "success",
      text: organisation
        ? tRoot(`adminRegistrationReview.decidedNotice.${arrivedDecision}`, { organisation })
        : t(arrivedDecision === "approved" ? "approvedNotice" : arrivedDecision === "rejected" ? "rejectedNotice" : "complementsNotice"),
    };
  });

  const applyStatus = (value: string) => { setStatusFilter(value); setUrlFilters({ status: value || null }); };
  const applyType = (value: string) => { setTypeFilter(value); setUrlFilters({ type: value || null }); };
  const applyRegion = (value: string) => {
    const next = value || "";
    setRegion(next);
    if (!next || !department || !territoryStructure.isSuccess || departmentInRegion(territoryStructure.data, next, department) !== false) {
      setUrlFilters({ region: next || null });
      return;
    }
    setDepartment("");
    setUrlFilters({ region: next, department: null });
  };
  const applyDepartment = (value: string) => { setDepartment(value); setUrlFilters({ department: value || null }); };
  const applyMethod = (value: string) => { setRegistrationMethod(value); setUrlFilters({ registrationMethod: value || null }); };
  const applyAssignedToMe = (value: boolean) => { setAssignedToMe(value); setUrlFilters({ assignedToMe: value ? "1" : null }); };
  const applyDuplicates = (value: string) => { setDuplicatesFilter(value); setUrlFilters({ duplicates: value || null }); };
  const applySort = (value: string) => {
    const next = value === "oldest" ? "oldest" : "newest";
    setSortOrder(next);
    setUrlFilters({ sort: next === "newest" ? null : next });
  };
  const applyDateRange = (value: string) => {
    setDateRange(value);
    setCustomDateRange(undefined);
    setPopoverDateFrom("");
    setPopoverDateTo("");
    setUrlFilters({ dateRange: value === "all" ? null : value, from: null, to: null });
  };

  const setUrlFilters = useCallback((changes: Record<string, string | number | null>, history: "push" | "replace" = "push") => {
    writeListUrl({ page: null, ...changes }, history);
  }, []);

  // The decision notice was read into state above; a reload must not repeat it.
  useEffect(() => {
    if (!arrivedDecision) return;
    router.replace(inscriptionsHref(currentQuery, vue, { decisionNotice: null, decidedFile: null }), { scroll: false });
  }, [arrivedDecision, currentQuery, router, vue]);

  const normalizedViewHref = normalizeInscriptionsHref(currentQuery, vue);
  const currentHref = `/admin/inscriptions${currentQuery ? `?${currentQuery}` : ""}`;

  useEffect(() => {
    if (vue === "coverage") return;
    if (normalizedViewHref !== currentHref) {
      router.replace(normalizedViewHref, { scroll: false });
      return;
    }
    if (!territoryStructure.isSuccess) return;
    const tree = territoryStructure.data;
    if (regionInput && regionInTree(tree, regionInput) === false) {
      router.replace(inscriptionsHref(currentQuery, vue, { region: null, department: null }));
      return;
    }
    if (!departmentInput) return;
    const departmentIsValid = regionInput
      ? departmentInRegion(tree, regionInput, departmentInput) !== false
      : tree.some((item) => item.departments.some((department) => department.name === departmentInput));
    if (departmentIsValid) return;
    router.replace(inscriptionsHref(currentQuery, vue, { department: null }));
  }, [normalizedViewHref, currentHref, territoryStructure.isSuccess, territoryStructure.data, regionInput, departmentInput, currentQuery, vue, router]);

  useEffect(() => {
    if (vue === "coverage") return;
    const next = organisationInput.trim();
    if (next === organisation) return;
    const timer = setTimeout(() => {
      setOrganisation(next);
      setUrlFilters({ search: next || null, organisation: null }, "replace");
    }, 300);
    return () => clearTimeout(timer);
  }, [vue, organisationInput, organisation, setUrlFilters]);

  /**
   * The filters the URL carries, re-applied whenever its own values change.
   *
   * The state initialisers above run on the first render only. Coverage
   * rankings link back to this list with status/region/type filters, which can
   * switch the current route without remounting. Without this, the queue
   * opened on its previous filter state and the chips said nothing was filtered.
   *
   * Keyed on the four values, not on the query string, so the period selector
   * and the view toggle (both of which keep every other parameter) leave a
   * filter the reviewer has since changed by hand alone. Compared during the
   * render rather than in an effect: this adjusts React state to React state,
   * which an effect would turn into a cascading render (and which
   * react-hooks/set-state-in-effect refuses).
   */
  const urlFilters = `${initialStatus}\u0000${initialRegion}\u0000${initialDepartment}\u0000${initialType}\u0000${requestedMethod}\u0000${requestedDateRange}\u0000${searchParams.get("sort") ?? ""}\u0000${requestedSearch}\u0000${dateFromParam ?? ""}\u0000${dateToParam ?? ""}\u0000${requestedAssignedToMe ? "1" : ""}\u0000${requestedDuplicates}`;
  const [appliedUrlFilters, setAppliedUrlFilters] = useState(urlFilters);
  if (appliedUrlFilters !== urlFilters) {
    setAppliedUrlFilters(urlFilters);
    setStatusFilter(initialStatus);
    setAssignedToMe(requestedAssignedToMe);
    setRegion(initialRegion);
    setDepartment(initialDepartment);
    setTypeFilter(initialType);
    setRegistrationMethod(requestedMethod);
    setDateRange(requestedDateRange);
    setSortOrder(searchParams.get("sort") === "oldest" ? "oldest" : "newest");
    setDuplicatesFilter(requestedDuplicates === "with" || requestedDuplicates === "without" ? requestedDuplicates : "");
    setOrganisationInput(requestedSearch);
    setOrganisation(requestedSearch.trim());
    const restoredFrom = dateFromParam ? parseDateInput(dateFromParam.slice(0, 10)) : undefined;
    const restoredTo = dateToParam ? parseDateInput(dateToParam.slice(0, 10)) : undefined;
    setCustomDateRange(restoredFrom && restoredTo ? { from: restoredFrom, to: restoredTo } : undefined);
    setPopoverDateFrom(dateFromParam ? dateFromParam.slice(0, 10) : "");
    setPopoverDateTo(dateToParam ? dateToParam.slice(0, 10) : "");
  }

  const commitOrganisationsRange = (fromValue: string, toValue: string) => {
    setPopoverDateFrom(fromValue);
    setPopoverDateTo(toValue);
    const fromDate = parseDateInput(fromValue);
    const toDate = parseDateInput(toValue);
    if (!fromDate || !toDate) {
      setCustomDateRange(undefined);
      if (dateFromParam || dateToParam) setUrlFilters({ dateRange: "custom", from: null, to: null });
      return;
    }
    setCustomDateRange({ from: fromDate, to: toDate });
    setDateRange("custom");
    setUrlFilters({
      dateRange: "custom",
      from: dateBoundary(fromDate),
      to: dateBoundary(toDate, true),
    });
  };

  // A custom range counts only once both ends are set. Last-30 and last-90
  // stay a single start bound.
  const customFrom = dateRange === "custom" ? customDateRange?.from : undefined;
  const customTo = dateRange === "custom" ? customDateRange?.to : undefined;
  const from = dateRange === "30"
    ? daysAgo(30)
    : dateRange === "90"
      ? daysAgo(90)
      : customFrom && customTo
        ? dateBoundary(customFrom)
        : undefined;
  const to = customFrom && customTo ? dateBoundary(customTo, true) : undefined;

  const organisationsRequestParams = buildOrganisationsRequestParams({
    search: organisation,
    statusFilter,
    typeFilter,
    region,
    department,
    registrationMethod,
    sortOrder,
    from,
    to,
    includeArchived,
    createdBy,
  });
  const organisationsQuery = useQuery({
    queryKey: ["auth", "company-registrations", "organisations", organisationsRequestParams, page],
    queryFn: () => listCompanyRegistrations({ ...organisationsRequestParams, page, pageSize: PAGE_SIZE }),
    enabled: canReadQueue && vue === "organisations" && territoryFiltersValid,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const activeListQuery = organisationsQuery;
  useEffect(() => {
    if (vue === "coverage" || !territoryFiltersValid || activeListQuery.data === undefined || activeListQuery.isPlaceholderData) return;
    const validPage = clampAdminListPage(page, activeListQuery.data.total, PAGE_SIZE);
    if (validPage !== page) setPage(validPage);
  }, [activeListQuery.data, activeListQuery.isPlaceholderData, page, setPage, territoryFiltersValid, vue]);

  // Account actions on the organisations list: each one is confirmed first,
  // naming the organisation and the consequence, and reports its outcome
  // (audit R-5; CLAUDE.md: account-affecting actions need a confirmation).
  const [accountAction, setAccountAction] = useState<{ kind: "suspend" | "activate" | "restore"; item: CompanyRegistrationItem } | null>(null);
  const archiveMutation = useMutation({
    mutationFn: (target: { item: CompanyRegistrationItem; reason: string }) => archiveUser(target.item.id, target.reason),
    onSuccess: (_data, target) => {
      setNotice({ tone: "success", text: t("archiveDone", { organisation: target.item.organisation }) });
      void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] });
    },
    onError: (error) => {
      setNotice({ tone: "error", text: `${t("archiveFailed")} ${error instanceof Error ? error.message : ""}`.trim() });
    },
  });
  const restoreMutation = useMutation({
    mutationFn: (item: CompanyRegistrationItem) => restoreUser(item.id),
    onSuccess: (_data, item) => {
      setNotice({ tone: "success", text: t("restoreDone", { organisation: item.organisation }) });
      void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] });
    },
    onError: (error) => {
      setNotice({ tone: "error", text: `${t("restoreFailed")} ${error instanceof Error ? error.message : ""}`.trim() });
    },
  });
  const lifecycleMutation = useMutation({
    mutationFn: (item: CompanyRegistrationItem) => item.isActive ? suspendUser(item.id) : activateUser(item.id),
    onSuccess: (_data, item) => {
      setNotice({ tone: "success", text: t(item.isActive ? "suspendDone" : "activateDone", { organisation: item.organisation }) });
      void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] });
    },
    onError: (error, item) => {
      setNotice({ tone: "error", text: `${t(item.isActive ? "suspendFailed" : "activateFailed")} ${error instanceof Error ? error.message : ""}`.trim() });
    },
  });
  const runAccountAction = () => {
    if (!accountAction) return;
    if (accountAction.kind === "restore") restoreMutation.mutate(accountAction.item);
    else lifecycleMutation.mutate(accountAction.item);
    setAccountAction(null);
  };

  const exportOrganisations = async () => {
    if (!territoryFiltersValid) return;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(organisationsRequestParams)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/auth/company-registrations/export?${params.toString()}`, {
      headers: { ...localeHeader(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) {
      let message = t("exportFailed");
      try {
        const body = await response.json();
        const raw = body?.message;
        if (typeof raw === "string" && raw.trim()) message = raw;
        else if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].trim()) message = raw[0];
      } catch {
        // Keep the generic export failure when the body is not JSON.
      }
      setNotice({ tone: "error", text: message });
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = `registrations_organisations_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  // The region filter is applied by the API, inside the reviewer's own
  // territory scope, so paging and the totals stay consistent with it.
  const territoryValidationError = hasTerritoryFilters && territoryStructure.isError;
  const territoryValidationPending = hasTerritoryFilters && !territoryFiltersValid && !territoryValidationError;
  const organisationsResult = territoryFiltersValid ? organisationsQuery.data : undefined;
  const organisationItems = organisationsResult?.items ?? [];
  const organisationCounts = selectAdminViewCounts(organisationsResult?.countsView, "organisations", organisationsResult?.counts);
  const organisationsUpdating = territoryFiltersValid && isBackgroundRefreshing(organisationsQuery.isFetching, organisationsQuery.data);

  const organisationsTableState = resolveDataState({
    roleAllowed: canReadQueue,
    isLoading: organisationsQuery.isLoading || territoryValidationPending,
    isError: organisationsQuery.isError || territoryValidationError,
    error: organisationsQuery.error ?? (territoryValidationError ? territoryStructure.error : undefined),
    rowCount: territoryFiltersValid && organisationsResult ? organisationItems.length : null,
  });

  const activeQueueFilters: Array<{ key: string; label: string; clear: () => void }> = [];
  if (organisation || organisationInput.trim()) {
    activeQueueFilters.push({ key: "search", label: `${t("searchLabel")}: ${organisation || organisationInput.trim()}`, clear: () => { setOrganisationInput(""); setOrganisation(""); setUrlFilters({ search: null, organisation: null }); } });
  }
  if (typeFilter) activeQueueFilters.push({ key: "type", label: `${t("establishmentTypeColumn")}: ${entityLabel(typeFilter)}`, clear: () => { setTypeFilter(""); setUrlFilters({ type: null }); } });
  if (region) activeQueueFilters.push({ key: "region", label: `${t("regionColumn")}: ${region}`, clear: () => { setRegion(""); setUrlFilters({ region: null }); } });
  if (department) activeQueueFilters.push({ key: "department", label: `${t("departmentColumn")}: ${department}`, clear: () => { setDepartment(""); setUrlFilters({ department: null }); } });
  if (dateRange !== "all") {
    const dateLabel = dateRange === "30"
      ? t("last30Days")
      : dateRange === "90"
        ? t("last90Days")
        : customDateRange?.from && customDateRange.to
          ? `${formatQueueDate(customDateRange.from, locale)} – ${formatQueueDate(customDateRange.to, locale)}`
          : t("customDateRange");
    activeQueueFilters.push({ key: "dateRange", label: `${t("submissionDateColumn")}: ${dateLabel}`, clear: () => applyDateRange("all") });
  }
  if (registrationMethod) {
    activeQueueFilters.push({ key: "registrationMethod", label: `${t("registrationSourceColumn")}: ${registrationMethodLabel(registrationMethod, locale) ?? registrationMethod}`, clear: () => applyMethod("") });
  }
  if (statusFilter) {
    const statusLabel = statusFilter === "ALL"
      ? t("statusAll")
      : statusFilter === "PENDING_APPROVAL"
          ? t("statusPending")
          : statusFilter === "COMPLEMENTS_REQUESTED"
            ? t("statusComplements")
            : statusFilter === "ACTIVE"
              ? t("statusApproved")
              : t("statusRejected");
    activeQueueFilters.push({ key: "status", label: `${t("registrationStatusColumn")}: ${statusLabel}`, clear: () => applyStatus("") });
  }
  if (assignedToMe) {
    activeQueueFilters.push({ key: "assignedToMe", label: tRoot("adminDossiersPage.assignedToMeOnly"), clear: () => applyAssignedToMe(false) });
  }
  if (duplicatesFilter) {
    activeQueueFilters.push({
      key: "duplicates",
      label: `${t("duplicatesColumn")}: ${duplicatesFilter === "with" ? t("withDuplicates") : t("withoutDuplicates")}`,
      clear: () => applyDuplicates(""),
    });
  }
  if (createdBy) {
    // The name comes from the rows themselves (createdByName, resolved by the
    // server); with no row to read it from, the chip still says what it does.
    const author = organisationsResult?.items.find((item) => item.createdBy === createdBy)?.createdByName;
    activeQueueFilters.push({
      key: "createdBy",
      label: author ? t("createdByChip", { name: author }) : t("createdByChipUnnamed"),
      clear: () => setUrlFilters({ createdBy: null }),
    });
  }
  // The order is not a filter: it has its own control and « Tout effacer » keeps it (audit, §2).
  if (includeArchived) {
    activeQueueFilters.push({ key: "includeArchived", label: t("showArchived"), clear: () => setUrlFilters({ includeArchived: null }) });
  }
  const visibleActiveFilters = vue === "organisations"
    ? activeQueueFilters.filter((filter) => ["search", "type", "region", "department", "dateRange", "status", "includeArchived", "registrationMethod", "sort", "createdBy"].includes(filter.key))
    : activeQueueFilters;
  const clearQueueFilters = (extra: Record<string, null> = {}) => {
    setOrganisationInput("");
    setOrganisation("");
    setRegion("");
    setDepartment("");
    setStatusFilter("");
    setTypeFilter("");
    setRegistrationMethod("");
    setAssignedToMe(false);
    setDateRange("all");
    setCustomDateRange(undefined);
    setDuplicatesFilter(""); setPopoverDateFrom(""); setPopoverDateTo(""); setUrlFilters({ createdBy: null, status: null, region: null, department: null, type: null, search: null, organisation: null, dateRange: null, from: null, to: null, registrationMethod: null, assignedToMe: null, duplicates: null, ...extra });
  };

  // Filter bar (spec §4F): search, scope, up to four pills, saved views,
  // « Filtres » for the rest. A pill's filter is not repeated as a chip, and
  // the « Filtres » count covers only what has no pill.
  const territoryPill = territoryPillFor(role);
  const userRegion = useAuthStore((s) => s.user?.region);
  const scopedDepartments = role === "REGIONAL_ADMIN" && userRegion && territoryStructure.isSuccess
    ? (territoryStructure.data.find((item) => item.name === userRegion)?.departments.map((item) => item.name) ?? [])
    : territoryDepartments;
  const organisationPillKeys = ["search", "status", "type", ...(territoryPill ? [territoryPill] : [])];
  const organisationPanelChips = visibleActiveFilters.filter(({ key }) => !organisationPillKeys.includes(key));
  const hasActiveOrganisationFilters = visibleActiveFilters.length > 0;
  const applySavedView = (query: string) => router.push(`/admin/inscriptions${query ? `?${query}` : ""}`, { scroll: false });
  const filtersLabel = tRoot("adminDossiersPage.filtersButton");
  const searchField = (id: string) => (
    <div className="cam-filter-bar-search">
      <Label className="cam-sr-only" htmlFor={id}>{t("searchLabel")}</Label>
      <Search aria-hidden="true" className="cam-filter-bar-search-icon" />
      <Input id={id} type="search" value={organisationInput} placeholder={t("searchPlaceholder")} onChange={(event) => setOrganisationInput(event.target.value)} />
    </div>
  );
  const territoryPillControl = territoryPill === "region"
    ? <AdminFilterPill label={t("regionColumn")} value={region} allLabel={t("allRegions")} clearLabel={t("removeFilterChip", { label: t("regionColumn") })} onChange={applyRegion} options={territoryRegions.map((value) => ({ value, label: value }))} />
    : territoryPill === "department"
      ? <AdminFilterPill label={t("departmentColumn")} value={department} allLabel={t("allDepartments")} clearLabel={t("removeFilterChip", { label: t("departmentColumn") })} onChange={applyDepartment} options={scopedDepartments.map((value) => ({ value, label: value }))} />
      : null;
  // National readers narrow by department in the panel, once a region is set or not.
  const departmentPanelField = (idPrefix: string) => territoryPill !== "region" ? null : (
    <AdminFilterField id={`${idPrefix}-department`} label={t("departmentColumn")}>
      <select id={`${idPrefix}-department`} className="cam-admin-input w-full" value={department} onChange={(event) => applyDepartment(event.target.value)}>
        <option value="">{t("allDepartments")}</option>
        {territoryDepartments.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </AdminFilterField>
  );
  const dateRangeField = (idPrefix: string) => (
    <AdminFilterField id={`${idPrefix}-date-range`} label={t("submissionDateColumn")} wide>
      <select id={`${idPrefix}-date-range`} className="cam-admin-input w-full" value={dateRange} onChange={(event) => applyDateRange(event.target.value)}>
        <option value="all">{t("allDates")}</option>
        <option value="30">{t("last30Days")}</option>
        <option value="90">{t("last90Days")}</option>
        <option value="custom">{t("customDateRange")}</option>
      </select>
      {customDateFields(idPrefix)}
    </AdminFilterField>
  );
  const methodField = (idPrefix: string) => (
    <AdminFilterField id={`${idPrefix}-method`} label={t("registrationMethodFilterLabel")}>
      <select id={`${idPrefix}-method`} className="cam-admin-input w-full" value={registrationMethod} onChange={(event) => applyMethod(event.target.value)}>
        <option value="">{t("allRegistrationMethods")}</option>
        {REGISTRATION_METHOD_VALUES.map((value) => <option key={value} value={value}>{registrationMethodLabel(value, locale) ?? value}</option>)}
      </select>
    </AdminFilterField>
  );
  // Order is a daily control, not a filter: always in view at the end of the
  // bar (ux-pilot audit 6 Nov: oldest-first was hidden in « Filtres »).
  const sortControl = (idPrefix: string) => (
    <label className="cam-sort-control" htmlFor={`${idPrefix}-sort`}>
      {t("sortControlLabel")}
      <select id={`${idPrefix}-sort`} value={sortOrder} onChange={(event) => applySort(event.target.value)}>
        <option value="newest">{tRoot("adminDossiersPage.sortNewest")}</option>
        <option value="oldest">{tRoot("adminDossiersPage.sortOldest")}</option>
      </select>
    </label>
  );

  const customDateFields = (idPrefix: string) => dateRange !== "custom" ? null : (
    <div className="cam-filter-more-dates">
      <div>
        <Label htmlFor={`${idPrefix}-date-from`}>{t("dateFromLabel")}</Label>
        <Input id={`${idPrefix}-date-from`} type="date" value={popoverDateFrom} max={popoverDateTo || undefined} onChange={(event) => commitOrganisationsRange(event.target.value, popoverDateTo)} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-date-to`}>{t("dateToLabel")}</Label>
        <Input id={`${idPrefix}-date-to`} type="date" value={popoverDateTo} min={popoverDateFrom || undefined} onChange={(event) => commitOrganisationsRange(popoverDateFrom, event.target.value)} />
      </div>
      {!(popoverDateFrom && popoverDateTo) && <p className="cam-dash-context">{t("selectDateRange")}</p>}
    </div>
  );


  const organisationKpis: KpiItem[] = organisationCounts ? [
    { key: "approved", label: t("kpiApproved"), value: count(organisationCounts.approved ?? 0, locale), hint: t("kpiApprovedHint"), tone: "success", pressed: statusFilter === "ACTIVE", onSelect: () => applyStatus(statusFilter === "ACTIVE" ? "" : "ACTIVE"), selectHint: t("kpiFilterHint") },
    { key: "rejected", label: t("kpiRejected"), value: count(organisationCounts.rejected ?? 0, locale), hint: t("kpiRejectedHint"), tone: "danger", pressed: statusFilter === "REJECTED", onSelect: () => applyStatus(statusFilter === "REJECTED" ? "" : "REJECTED"), selectHint: t("kpiFilterHint") },
  ] : [];
  const kpiStrip = canReadQueue ? (
    <AdminKpiStrip
      items={organisationKpis}
      label={t("kpiAriaLabel")}
      loading={territoryFiltersValid && !organisationsResult && !organisationsQuery.isError}
      loadingLabel={tRoot("adminLayout.loadingFigures")}
      error={organisationsQuery.isError}
      errorLabel={tRoot("adminLayout.figuresUnavailable")}
    />
  ) : null;

  if (vue === "coverage") return null;

  return (
    <div className="cam-admin-page cam-admin-workflow-page cam-registration-hub-page">
      {/* Keep the registration action alongside its destinations, not in the sidebar. */}
      <AdminPageHeader
        breadcrumb={[{ label: tRoot("adminNav.hubs.inscriptions"), href: "/admin/inscriptions" }, { label: vue === "organisations" ? t("viewOrganisations") : tRoot("adminNav.routes.inscriptions") }]}
        title={vue === "organisations" ? t("viewOrganisations") : tRoot("adminNav.routes.inscriptions")}
        subtitle={vue === "organisations" ? t("organisationsSubtitle") : t("pageSubtitle")}
        hideTabs
        actions={
          // Exports sit with the page's actions, as on the canvas boards.
          <Button type="button" size="sm" variant="outline" onClick={exportOrganisations} disabled={!territoryFiltersValid}>
            <Download aria-hidden="true" />
            {t("exportRegistrations")}
          </Button>
        }
      />
      {kpiStrip}

      {vue === "organisations" && <>
        {notice && <Alert role={notice.tone === "error" ? "alert" : "status"} variant={notice.tone === "error" ? "destructive" : "success"} className="my-4">{notice.text}</Alert>}
        <AdminTablePanel title={t("viewOrganisations")} description={<>{t("organisationsScopeNote")} {t("statusCountsScopeNote")}</>} headingId="registration-organisations-table-title" busy={organisationsUpdating} busyLabel={t("updatingOrganisations")}>
          <div className="cam-admin-table-panel-body">
            <div className="cam-registration-filters">
              <div className="cam-filter-bar" role="group" aria-label={filtersLabel}>
                {searchField("organisations-search")}
                <AdminScopePill />
                <AdminFilterPill
                  label={t("registrationStatusColumn")}
                  value={statusFilter === "ACTIVE" || statusFilter === "REJECTED" ? statusFilter : ""}
                  allLabel={t("bothStatuses")}
                  clearLabel={t("removeFilterChip", { label: t("registrationStatusColumn") })}
                  onChange={applyStatus}
                  options={[
                    { value: "ACTIVE", label: t("statusApproved"), count: organisationCounts?.approved },
                    { value: "REJECTED", label: t("statusRejected"), count: organisationCounts?.rejected },
                  ]}
                />
                {territoryPillControl}
                <AdminFilterPill
                  label={t("establishmentTypeColumn")}
                  value={typeFilter}
                  allLabel={t("allTypes")}
                  clearLabel={t("removeFilterChip", { label: t("establishmentTypeColumn") })}
                  onChange={applyType}
                  options={REGISTRATION_ENTITY_TYPES.map((value) => ({ value, label: entityLabel(value) }))}
                />
                <AdminFilterMore label={filtersLabel} count={organisationPanelChips.length}>
                  {dateRangeField("organisations")}
                  {departmentPanelField("organisations")}
                  {methodField("organisations")}
                  <div className="cam-filter-more-field is-wide cam-filter-more-check">
                    <Checkbox id="organisations-include-archived" checked={includeArchived} onCheckedChange={(checked) => setUrlFilters({ includeArchived: checked === true ? "true" : null })} />
                    <Label htmlFor="organisations-include-archived" className="!mb-0 cursor-pointer">{t("showArchived")}</Label>
                  </div>
                </AdminFilterMore>
                {hasActiveOrganisationFilters && <Button type="button" variant="ghost" size="sm" onClick={() => clearQueueFilters({ includeArchived: null })}>{t("clearFilters")}</Button>}
                {sortControl("organisations")}
                {userId && <AdminSavedViews storageKey={`camleap.savedViews.organisations.${userId}`} currentQuery={savedViewQuery(currentQuery)} onApply={applySavedView} />}
              </div>
              <AdminActiveFilterChips filters={organisationPanelChips.map(({ key, label, clear }) => ({ key, label, onClear: clear }))} label={t("activeFiltersLabel")} removeFilterLabel={(label) => t("removeFilterChip", { label })} />
            </div>
            <Table className="cam-registration-organisations-table cam-table-stack"><TableHeader><TableRow>
              <TableHead scope="col">{t("organisationColumn")}</TableHead>
              <TableHead scope="col">{t("registrationStatusColumn")}</TableHead>
              <TableHead scope="col">{t("territoryColumn")}</TableHead>
              <TableHead scope="col" className="text-right">{t("actionsColumn")}</TableHead>
            </TableRow></TableHeader><TableBody>
              <DataStateRow colSpan={4} state={organisationsTableState} resource={t("viewOrganisations")} error={organisationsQuery.error ?? (territoryValidationError ? territoryStructure.error : undefined)} onRetry={() => territoryValidationError ? territoryStructure.refetch() : organisationsQuery.refetch()} title={organisationsTableState === "empty" ? t("emptyTitle") : undefined} />
              {organisationItems.map((item) => {
                const badge = STATUS_BADGE[item.status];
                const detailIdentifier = item.establishmentId || item.registrationNumber;
                return <TableRow key={item.id}>
                  <TableHead scope="row"><span className="cam-record-cell"><span className="cam-record-cell-name" title={item.organisation}>{item.organisation}</span><span className="cam-record-cell-meta"><span className="cam-record-cell-ref">{item.establishmentId || NOT_PROVIDED}</span><span className="cam-tag" title={entityLabel(item.entityType)}>{entityShortLabel(item.entityType)}</span></span></span></TableHead>
                  <TableCell data-label={t("registrationStatusColumn")}><span className="flex flex-wrap items-center gap-1.5"><Badge variant={badge?.tone ?? "neutral"}>{badge ? t(badge.textKey) : item.status}</Badge>{item.archivedAt && <Badge variant="neutral">{t("archivedBadge")}</Badge>}</span></TableCell>
                  <TableCell data-label={t("territoryColumn")} className="cam-cell-nowrap">{[item.region, item.department].filter(Boolean).join(" · ") || NOT_PROVIDED}</TableCell>
                  <TableCell className="cam-cell-action"><div className="flex items-center justify-end gap-1">
                    {/* A file still under review (listed here only for one agent's
                        files) opens on its review page, where it can be decided. */}
                    {item.status === "PENDING_APPROVAL" || item.status === "COMPLEMENTS_REQUESTED"
                      ? <Link className="cam-button cam-button-secondary cam-button-sm" href={registrationReviewHref(item.id, `/admin/inscriptions?${currentQuery}`)}>{t("openButton")}</Link>
                      : detailIdentifier
                      ? <Link className="cam-button cam-button-secondary cam-button-sm" href={`/admin/etablissement-detail?id=${encodeURIComponent(detailIdentifier)}&returnTo=${encodeURIComponent(establishmentReturnTo)}`}>{t("openButton")}</Link>
                      : <span aria-disabled="true" className="cam-button cam-button-secondary cam-button-sm" title={NOT_PROVIDED}>{t("openButton")}</span>}
                    {/* Every reader gets the menu: it holds the read-only « Déclarations » link (audit R-6). */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button type="button" size="icon-sm" variant="ghost" className="shrink-0" aria-label={t("actionsColumn")} title={t("actionsColumn")}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link href={`/admin/dossiers?vue=submissions&companyId=${encodeURIComponent(item.companyId)}`}>{t("declarationsLink")}</Link></DropdownMenuItem>
                        {hasRole(role, USER_ARCHIVE_ROLES) && !item.archivedAt && <DropdownMenuItem onSelect={() => setArchiveTarget(item)}>{t("archiveButton")}</DropdownMenuItem>}
                        {hasRole(role, USER_ARCHIVE_ROLES) && item.archivedAt && <DropdownMenuItem disabled={restoreMutation.isPending} onSelect={() => setAccountAction({ kind: "restore", item })}>{t("restoreButton")}</DropdownMenuItem>}
                        {!item.archivedAt && item.status === "ACTIVE" && hasRole(role, USER_LIFECYCLE_ROLES) && <DropdownMenuItem disabled={lifecycleMutation.isPending} onSelect={() => setAccountAction({ kind: item.isActive ? "suspend" : "activate", item })}>{item.isActive ? t("suspendButton") : t("activateButton")}</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div></TableCell>
                </TableRow>;
              })}
            </TableBody></Table>
            {organisationsResult && organisationsResult.total > 0 && <AdminNumberedPager
              page={page}
              pageCount={Math.max(1, Math.ceil(organisationsResult.total / PAGE_SIZE))}
              range={<AdminLiveResultCount announce={!organisationsQuery.isPlaceholderData}>{t("showingRange", { start: count((page - 1) * PAGE_SIZE + 1, locale), end: count(Math.min(page * PAGE_SIZE, organisationsResult.total), locale), total: count(organisationsResult.total, locale) })}</AdminLiveResultCount>}
              previousLabel={t("previousButton")}
              nextLabel={t("nextButton")}
              label={t("pagerAriaLabel")}
              pageLabel={(n) => t("pageButtonAriaLabel", { page: n })}
              disabled={organisationsQuery.isFetching}
              onPage={setPage}
            />}
          </div>
        </AdminTablePanel>
        {archiveTarget && <ArchiveActions
          archived={false}
          canManage={hasRole(role, USER_ARCHIVE_ROLES)}
          resourceName={archiveTarget.organisation}
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
        {accountAction && <ConfirmDialog
          id="registration-account-action"
          title={t(`${accountAction.kind}ConfirmTitle`, { organisation: accountAction.item.organisation })}
          body={t(`${accountAction.kind}ConfirmBody`)}
          cancelLabel={tRoot("common.cancel")}
          confirmLabel={t(`${accountAction.kind === "activate" ? "activate" : accountAction.kind}Button`)}
          onCancel={() => setAccountAction(null)}
          onConfirm={runAccountAction}
        />}
      </>}

    </div>
  );
}

/** The registration-method badge, or a dash for a row that predates tracking. */
