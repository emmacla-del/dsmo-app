"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { MoreHorizontal, Plus, Search, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { useAuthStore } from "@/lib/auth-store";
import { API_BASE_URL, getToken, localeHeader } from "@/lib/api-client";
import {
  listCompanyRegistrations,
  archiveUser,
  restoreUser,
  suspendUser,
  activateUser,
  assignRegistrationUser,
  decidedOrganisation,
  type CompanyRegistrationItem,
} from "@/lib/user-directory";
import { clampAdminListPage, parseAdminListPage, parseRegistrationVue } from "@/lib/admin-url";
import { selectAdminViewCounts } from "@/lib/admin-view-counts";
import { isBackgroundRefreshing } from "@/lib/admin-query-state";
import { buildRegistrationReturnTo } from "@/lib/admin-return";
import { registrationReviewHref, saveRegistrationTrail, type RegistrationListParams } from "@/lib/registration-trail";
import { ENTITY_TYPE_OPTION_KEYS } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { APPROVAL_ROLES, DIRECTORY_ROLES, USER_ARCHIVE_ROLES, USER_LIFECYCLE_ROLES, hasRole } from "@/lib/roles";
import {
  inscriptionsHref,
  normalizeInscriptionsHref,
  normalizeRegistrationStatus,
  organisationsStatusesForFilter,
  REGISTRATION_ENTITY_TYPES,
  REGISTRATION_METHOD_VALUES,
  registrationMethodLabel,
  REGISTRATION_OVERDUE_DEFAULT_DAYS,
  daysWaiting,
} from "@/lib/inscriptions";
import { departmentInRegion, regionInTree, useTerritoryDepartments, useTerritoryRegions, useTerritoryStructure } from "@/hooks/useTerritoryStructure";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { RegistrationsHubTabs } from "@/components/admin/RegistrationsHubTabs";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { AdminLiveResultCount } from "@/components/admin/AdminLiveResultCount";
import { AdminActiveFilterChips } from "@/components/admin/AdminActiveFilterChips";
import { AdminFilterPill } from "@/components/admin/AdminFilterPill";
import { AdminFilterField, AdminFilterMore, AdminScopePill, territoryPillFor } from "@/components/admin/AdminFilterBarParts";
import { AdminSavedViews, savedViewQuery } from "@/components/admin/AdminSavedViews";
import { ArchiveActions } from "@/components/admin/ArchiveActions";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import { NOT_PROVIDED, count, resolveDataState, stamp } from "@/lib/admin-data-state";
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
}): Parameters<typeof listCompanyRegistrations>[0] {
  const status = normalizeRegistrationStatus(filters.statusFilter, "organisations");
  return {
    search: filters.search || undefined,
    statuses: organisationsStatusesForFilter(status),
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
      <InscriptionsContent />
    </Suspense>
  );
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
  // /admin/equipe's "Voir les inscriptions" arrives with ?createdBy=<userId>:
  // every file that agent registered, so the status filter starts at "ALL"
  // rather than the review queue — the équipe card counts every status.
  const vue = parseRegistrationVue(searchParams.get("vue"));
  const createdBy = vue === "queue" ? searchParams.get("createdBy")?.trim() ?? "" : "";
  const requestedStatus = searchParams.get("status") ?? "";
  const initialStatus = normalizeRegistrationStatus(requestedStatus, vue) || (vue === "queue" && createdBy ? "ALL" : "");
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
    const currentView = parseRegistrationVue(new URLSearchParams(currentQuery).get("vue"));
    router.push(inscriptionsHref(currentQuery, currentView, { page: clampedPage === 1 ? null : clampedPage }), { scroll: false });
  }, [currentQuery, router]);
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
    const currentView = parseRegistrationVue(new URLSearchParams(currentQuery).get("vue"));
    const href = inscriptionsHref(currentQuery, currentView, { page: null, ...changes });
    const currentHref = `/admin/inscriptions${currentQuery ? `?${currentQuery}` : ""}`;
    if (href !== currentHref) router[history](href, { scroll: false });
  }, [currentQuery, router]);

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
  }, [organisationInput, organisation, setUrlFilters]);

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
  const duplicatesParam = duplicatesFilter === "with" || duplicatesFilter === "without" ? duplicatesFilter : undefined;

  // "OVERDUE" is a view of the queue, not a stored status: files the
  // reviewers have left waiting past the threshold set in /admin/parametres.
  const overdueOnly = statusFilter === "OVERDUE";
  const queueQueryKey = [
    "auth",
    "company-registrations",
    "queue",
    organisation,
    statusFilter,
    typeFilter,
    region,
    department,
    registrationMethod,
    from,
    to,
    duplicatesParam,
    createdBy,
    registrationMethod,
    assignedToMe,
    sortOrder,
    page,
  ] as const;
  // The queue request without paging: also what the review page pages through.
  const queueListParams: RegistrationListParams = {
    search: organisation || undefined,
    view: "queue",
    status: overdueOnly ? undefined : statusFilter || undefined,
    overdue: overdueOnly || undefined,
    createdBy: createdBy || undefined,
    entityType: typeFilter || undefined,
    region: region || undefined,
    department: department || undefined,
    registrationMethod: registrationMethod || undefined,
    duplicates: duplicatesParam,
    assignedToMe: assignedToMe || undefined,
    sortOrder,
    from,
    to,
  };
  const queueQuery = useQuery({
    queryKey: queueQueryKey,
    queryFn: () => listCompanyRegistrations({ ...queueListParams, page, pageSize: PAGE_SIZE }),
    enabled: canReadQueue && vue === "queue" && territoryFiltersValid,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

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
  });
  const organisationsQuery = useQuery({
    queryKey: ["auth", "company-registrations", "organisations", organisationsRequestParams, page],
    queryFn: () => listCompanyRegistrations({ ...organisationsRequestParams, page, pageSize: PAGE_SIZE }),
    enabled: canReadQueue && vue === "organisations" && territoryFiltersValid,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const activeListQuery = vue === "organisations" ? organisationsQuery : queueQuery;
  useEffect(() => {
    if (vue === "coverage" || !territoryFiltersValid || activeListQuery.data === undefined || activeListQuery.isPlaceholderData) return;
    const validPage = clampAdminListPage(page, activeListQuery.data.total, PAGE_SIZE);
    if (validPage !== page) setPage(validPage);
  }, [activeListQuery.data, activeListQuery.isPlaceholderData, page, setPage, territoryFiltersValid, vue]);

  const archiveMutation = useMutation({
    mutationFn: (target: { item: CompanyRegistrationItem; reason: string }) => archiveUser(target.item.id, target.reason),
    onSuccess: () => { setNotice(null); void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] }); },
    onError: (error) => {
      setNotice({ tone: "error", text: `${t("archiveFailed")} ${error instanceof Error ? error.message : ""}`.trim() });
    },
  });
  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreUser(id),
    onSuccess: () => { setNotice(null); void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] }); },
    onError: (error) => {
      setNotice({ tone: "error", text: `${t("archiveFailed")} ${error instanceof Error ? error.message : ""}`.trim() });
    },
  });
  const lifecycleMutation = useMutation({
    mutationFn: (target: { id: string; active: boolean }) => target.active ? suspendUser(target.id) : activateUser(target.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] }),
  });

  const exportRegistrations = async (targetView: "organisations" | "queue" = vue === "queue" ? "queue" : "organisations") => {
    if (!territoryFiltersValid) return;
    const params = new URLSearchParams();
    if (targetView === "organisations") {
      for (const [key, value] of Object.entries(organisationsRequestParams)) {
        if (value !== undefined) params.set(key, String(value));
      }
    } else {
      params.set("view", "queue");
      if (organisation) params.set("search", organisation);
      if (overdueOnly) params.set("overdue", "true");
      else if (statusFilter) params.set("status", statusFilter);
      if (createdBy) params.set("createdBy", createdBy);
      if (typeFilter) params.set("entityType", typeFilter);
      if (region) params.set("region", region);
      if (department) params.set("department", department);
      if (registrationMethod) params.set("registrationMethod", registrationMethod);
      if (duplicatesParam) params.set("duplicates", duplicatesParam);
      if (assignedToMe) params.set("assignedToMe", "true");
      if (from) params.set("from", from);
      if (to) params.set("to", to);
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
    link.download = `registrations_${targetView}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const exportOrganisations = () => exportRegistrations("organisations");
  const exportQueue = () => exportRegistrations("queue");

  const assignMutation = useMutation({
    mutationFn: (target: { id: string; assigneeId: string | null; expectedAssigneeId: string | null }) =>
      assignRegistrationUser(target.id, target.assigneeId, target.expectedAssigneeId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] }),
    onError: (error) => {
      setNotice({ tone: "error", text: `${tRoot("adminDossiersPage.assignFailed")} ${error instanceof Error ? error.message : ""}`.trim() });
      void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] });
    },
  });

  // The region filter is applied by the API, inside the reviewer's own
  // territory scope, so paging and the totals stay consistent with it.
  const territoryValidationError = hasTerritoryFilters && territoryStructure.isError;
  const territoryValidationPending = hasTerritoryFilters && !territoryFiltersValid && !territoryValidationError;
  const items = territoryFiltersValid ? queueQuery.data?.items ?? [] : [];
  // null until the queue answers: a tile never shows a zero it has not read.
  const counts = territoryFiltersValid ? selectAdminViewCounts(queueQuery.data?.countsView, "queue", queueQuery.data?.counts) : null;
  const organisationsResult = territoryFiltersValid ? organisationsQuery.data : undefined;
  const organisationItems = organisationsResult?.items ?? [];
  const organisationCounts = selectAdminViewCounts(organisationsResult?.countsView, "organisations", organisationsResult?.counts);
  // The threshold the server applied, so the labels match the flags.
  const overdueDays = territoryFiltersValid ? queueQuery.data?.overdueDays ?? REGISTRATION_OVERDUE_DEFAULT_DAYS : REGISTRATION_OVERDUE_DEFAULT_DAYS;
  const total = territoryFiltersValid ? queueQuery.data?.total ?? 0 : 0;
  const queueUpdating = territoryFiltersValid && queueQuery.isFetching && queueQuery.data !== undefined;
  const organisationsUpdating = territoryFiltersValid && isBackgroundRefreshing(organisationsQuery.isFetching, organisationsQuery.data);

  // « Réclamer et ouvrir » / « Ouvrir »: the review page, with this page of
  // the queue as its previous / next trail. A claim that fails (someone else
  // took the file meanwhile) keeps the reviewer on the queue, with the reason.
  const [opening, setOpening] = useState<string | null>(null);
  const openReviewPage = async (item: CompanyRegistrationItem, claim: boolean) => {
    setNotice(null);
    saveRegistrationTrail({
      returnTo: currentHref,
      params: queueListParams,
      page: queueQuery.data?.page ?? page,
      pageSize: PAGE_SIZE,
      total: queueQuery.data?.total ?? items.length,
      ids: items.map((row) => row.id),
    });
    if (claim && userId) {
      setOpening(item.id);
      try {
        await assignMutation.mutateAsync({ id: item.id, assigneeId: userId, expectedAssigneeId: item.assigneeId });
      } catch {
        setOpening(null);
        return;
      }
    }
    router.push(registrationReviewHref(item.id, currentHref));
  };

  const displayedPage = territoryFiltersValid ? queueQuery.data?.page ?? page : 1;
  const start = items.length === 0 ? 0 : (displayedPage - 1) * PAGE_SIZE + 1;
  const end = items.length === 0 ? 0 : start + items.length - 1;

  const tableState = resolveDataState({
    roleAllowed: canReadQueue,
    isLoading: queueQuery.isLoading || territoryValidationPending,
    isError: queueQuery.isError || territoryValidationError,
    error: queueQuery.error ?? (territoryValidationError ? territoryStructure.error : undefined),
    rowCount: territoryFiltersValid && queueQuery.data ? items.length : null,
  });
  const organisationsTableState = resolveDataState({
    roleAllowed: canReadQueue,
    isLoading: organisationsQuery.isLoading || territoryValidationPending,
    isError: organisationsQuery.isError || territoryValidationError,
    error: organisationsQuery.error ?? (territoryValidationError ? territoryStructure.error : undefined),
    rowCount: territoryFiltersValid && organisationsResult ? organisationItems.length : null,
  });

  const statusSource = territoryFiltersValid ? (vue === "organisations" ? organisationCounts : counts) : null;
  const registrationStatusSegments = statusSource ? (vue === "organisations" ? [
    { key: "approved", label: t("statusApproved"), value: statusSource.approved, tone: "approved" },
    { key: "rejected", label: t("statusRejected"), value: statusSource.rejected, tone: "rejected" },
  ] : [
    { key: "pending", label: t("statusPending"), value: statusSource.pending, tone: "pending" },
    { key: "complements", label: t("statusComplements"), value: statusSource.complements, tone: "correction" },
    { key: "approved", label: t("statusApproved"), value: statusSource.approved, tone: "approved" },
    { key: "rejected", label: t("statusRejected"), value: statusSource.rejected, tone: "rejected" },
  ]) : [];
  const registrationStatusTotal = registrationStatusSegments.reduce((total, segment) => total + segment.value, 0);
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
      : statusFilter === "OVERDUE"
        ? t("statusOverdue", { days: overdueDays })
        : statusFilter === "PENDING_APPROVAL"
          ? t("statusPending")
          : statusFilter === "COMPLEMENTS_REQUESTED"
            ? t("statusComplements")
            : statusFilter === "ACTIVE"
              ? t("statusApproved")
              : t("statusRejected");
    activeQueueFilters.push({ key: "status", label: `${t("registrationStatusColumn")}: ${statusLabel}`, clear: () => applyStatus("") });
  }
  if (createdBy) {
    activeQueueFilters.push({ key: "createdBy", label: `${t("registeredByLabel")}: ${items.find((item) => item.createdBy === createdBy)?.createdByName ?? t("selectedOfficer")}`, clear: () => setUrlFilters({ createdBy: null }) });
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
  if (sortOrder !== "newest") {
    activeQueueFilters.push({ key: "sort", label: `${t("submissionDateColumn")}: ${tRoot("adminDossiersPage.sortOldest")}`, clear: () => applySort("newest") });
  }
  if (includeArchived) {
    activeQueueFilters.push({ key: "includeArchived", label: t("showArchived"), clear: () => setUrlFilters({ includeArchived: null }) });
  }
  const visibleActiveFilters = vue === "organisations"
    ? activeQueueFilters.filter((filter) => ["search", "type", "region", "department", "dateRange", "status", "includeArchived", "registrationMethod", "sort"].includes(filter.key))
    : activeQueueFilters;
  const hasActiveQueueFilters = Boolean(
    organisationInput.trim() || organisation || region || department || statusFilter || typeFilter ||
    registrationMethod || dateRange !== "all" || duplicatesFilter || createdBy || assignedToMe || sortOrder !== "newest",
  );
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
    setSortOrder("newest");
    setCustomDateRange(undefined);
    setDuplicatesFilter(""); setPopoverDateFrom(""); setPopoverDateTo(""); setUrlFilters({ createdBy: null, status: null, region: null, department: null, type: null, search: null, organisation: null, dateRange: null, from: null, to: null, registrationMethod: null, assignedToMe: null, duplicates: null, sort: null, ...extra });
  };

  // Filter bar (spec §4F): search, scope, up to four pills, saved views,
  // « Filtres » for the rest. A pill's filter is not repeated as a chip, and
  // the « Filtres » count covers only what has no pill.
  const territoryPill = territoryPillFor(role);
  const userRegion = useAuthStore((s) => s.user?.region);
  const scopedDepartments = role === "REGIONAL_ADMIN" && userRegion && territoryStructure.isSuccess
    ? (territoryStructure.data.find((item) => item.name === userRegion)?.departments.map((item) => item.name) ?? [])
    : territoryDepartments;
  const queuePillKeys = ["search", "status", "duplicates", "assignedToMe", "createdBy", ...(territoryPill ? [territoryPill] : [])];
  const organisationPillKeys = ["search", "status", "type", ...(territoryPill ? [territoryPill] : [])];
  const queuePanelChips = activeQueueFilters.filter(({ key }) => !queuePillKeys.includes(key) && key !== "includeArchived");
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
  const sortField = (idPrefix: string) => (
    <AdminFilterField id={`${idPrefix}-sort`} label={tRoot("adminDossiersPage.sortLabel")}>
      <select id={`${idPrefix}-sort`} className="cam-admin-input w-full" value={sortOrder} onChange={(event) => applySort(event.target.value)}>
        <option value="newest">{tRoot("adminDossiersPage.sortNewest")}</option>
        <option value="oldest">{tRoot("adminDossiersPage.sortOldest")}</option>
      </select>
    </AdminFilterField>
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

  const registrationStatusSummary = canReadQueue && statusSource && registrationStatusTotal > 0 ? (
    <section className="cam-registration-status-summary" aria-labelledby="registration-status-title">
      <div className="cam-registration-status-head">
        <h2 id="registration-status-title">{t("statusDistributionTitle")}</h2>
        <span>{t("statusDistributionContext")}</span>
      </div>
      <ul className="cam-registration-status-list" aria-label={t("statusDistributionAria", {
        pending: statusSource.pending ?? 0,
        complements: statusSource.complements ?? 0,
        approved: statusSource.approved ?? 0,
        rejected: statusSource.rejected ?? 0,
      })}>
        {registrationStatusSegments.map((segment) => (
          <li key={segment.key}>
            <span className={`cam-dash-status-swatch is-${segment.tone}`} aria-hidden="true" />
            <span className="cam-dash-status-label">{segment.label}</span>
            <strong>{count(segment.value, locale)}</strong>
          </li>
        ))}
      </ul>
      <p className="cam-admin-help-text" role="note">{t("statusCountsScopeNote")}</p>
      {vue === "queue" && (
        <p className="cam-dash-context cam-registration-overdue-summary">
          {t("overdueSummary", { count: count(statusSource.overdue ?? 0, locale), days: overdueDays })}
        </p>
      )}
    </section>
  ) : null;

  if (vue === "coverage") return null;

  return (
    <div className="cam-admin-page cam-admin-workflow-page cam-registration-hub-page">
      {/* Keep the registration action alongside its destinations, not in the sidebar. */}
      <AdminPageHeader
        title={tRoot("adminNav.hubs.inscriptions")}
        hideTabs
        actions={vue === "queue" && role && DIRECTORY_ROLES.includes(role) ? (
          <Link href="/admin/inscriptions/nouvelle" className="cam-button cam-button-primary cam-button-sm">
            <Plus aria-hidden="true" />
            {tRoot("adminNav.routes.nouvelleInscription")}
          </Link>
        ) : undefined}
      />
      <RegistrationsHubTabs activeTab={vue} canReviewRegistrations={canReadQueue} currentQuery={currentQuery} />

      {vue === "organisations" && <>
        {notice && <Alert role={notice.tone === "error" ? "alert" : "status"} variant={notice.tone === "error" ? "destructive" : "success"} className="my-4">{notice.text}</Alert>}
        <AdminTablePanel title={t("viewOrganisations")} description={t("organisationsScopeNote")} headingId="registration-organisations-table-title" busy={organisationsUpdating} busyLabel={t("updatingOrganisations")} actions={<Button type="button" size="sm" variant="outline" onClick={exportOrganisations} disabled={!territoryFiltersValid}>{t("exportRegistrations")}</Button>}>
          <div className="cam-admin-table-panel-body">
            {registrationStatusSummary}
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
                {userId && <AdminSavedViews storageKey={`camleap.savedViews.organisations.${userId}`} currentQuery={savedViewQuery(currentQuery)} onApply={applySavedView} />}
                <AdminFilterMore label={filtersLabel} count={organisationPanelChips.length}>
                  {dateRangeField("organisations")}
                  {departmentPanelField("organisations")}
                  {methodField("organisations")}
                  {sortField("organisations")}
                  <div className="cam-filter-more-field is-wide cam-filter-more-check">
                    <Checkbox id="organisations-include-archived" checked={includeArchived} onCheckedChange={(checked) => setUrlFilters({ includeArchived: checked === true ? "true" : null })} />
                    <Label htmlFor="organisations-include-archived" className="!mb-0 cursor-pointer">{t("showArchived")}</Label>
                  </div>
                </AdminFilterMore>
                {hasActiveOrganisationFilters && <Button type="button" variant="ghost" size="sm" onClick={() => clearQueueFilters({ includeArchived: null })}>{t("clearFilters")}</Button>}
              </div>
              <AdminActiveFilterChips filters={organisationPanelChips.map(({ key, label, clear }) => ({ key, label, onClear: clear }))} label={t("activeFiltersLabel")} removeFilterLabel={(label) => t("removeFilterChip", { label })} />
            </div>
            <Table className="cam-registration-organisations-table"><TableHeader><TableRow>
              <TableHead scope="col" className="whitespace-normal">{t("organisationColumn")}</TableHead>
              <TableHead scope="col">{t("registrationStatusColumn")}</TableHead>
              <TableHead scope="col">{`${t("regionColumn")} / ${t("departmentColumn")}`}</TableHead>
              <TableHead scope="col">{t("establishmentTypeColumn")}</TableHead>
              <TableHead scope="col" className="whitespace-normal">{t("actionsColumn")}</TableHead>
            </TableRow></TableHeader><TableBody>
              <DataStateRow colSpan={5} state={organisationsTableState} resource={t("viewOrganisations")} error={organisationsQuery.error ?? (territoryValidationError ? territoryStructure.error : undefined)} onRetry={() => territoryValidationError ? territoryStructure.refetch() : organisationsQuery.refetch()} title={organisationsTableState === "empty" ? t("emptyTitle") : undefined} />
              {organisationItems.map((item) => {
                const badge = STATUS_BADGE[item.status];
                const detailIdentifier = item.establishmentId || item.registrationNumber;
                return <TableRow key={item.id}>
                  <TableHead scope="row" className="sticky left-0 z-10 h-auto whitespace-normal border-r bg-[var(--cam-surface)] font-medium text-foreground shadow-[2px_0_3px_-3px_rgba(15,23,42,0.45)]"><span className="block max-w-[250px] truncate font-semibold" title={item.organisation}>{item.organisation}</span><span className="block max-w-[250px] truncate text-xs text-muted-foreground" title={item.establishmentId ?? undefined}>{item.establishmentId || NOT_PROVIDED}</span></TableHead>
                  <TableCell className="align-top whitespace-normal py-2"><span className="flex flex-wrap items-center gap-1.5"><Badge variant={badge?.tone ?? "neutral"}>{badge ? t(badge.textKey) : item.status}</Badge>{item.archivedAt && <Badge variant="neutral">{t("archivedBadge")}</Badge>}</span></TableCell>
                  <TableCell className="align-top whitespace-normal py-2"><span className="block truncate" title={[item.region, item.department].filter(Boolean).join(" / ")}>{[item.region, item.department].filter(Boolean).join(" / ") || NOT_PROVIDED}</span></TableCell>
                  <TableCell className="align-top whitespace-normal py-2"><span className="block max-w-[250px] truncate" title={entityLabel(item.entityType)}>{entityLabel(item.entityType)}</span></TableCell>
                  <TableCell className="align-top whitespace-normal py-2"><div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {detailIdentifier
                      ? <Link className="text-sm underline" href={`/admin/etablissement-detail?id=${encodeURIComponent(detailIdentifier)}&returnTo=${encodeURIComponent(establishmentReturnTo)}`}>{t("openButton")}</Link>
                      : <span aria-disabled="true" className="cursor-not-allowed text-sm text-muted-foreground">{t("openButton")}</span>}
                    {(hasRole(role, USER_ARCHIVE_ROLES) || (!item.archivedAt && item.status === "ACTIVE" && hasRole(role, USER_LIFECYCLE_ROLES))) && <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button type="button" size="icon-sm" variant="ghost" className="shrink-0" aria-label={t("actionsColumn")} title={t("actionsColumn")}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link href={`/admin/dossiers?vue=submissions&companyId=${encodeURIComponent(item.companyId)}`}>{t("declarationsLink")}</Link></DropdownMenuItem>
                        {hasRole(role, USER_ARCHIVE_ROLES) && !item.archivedAt && <DropdownMenuItem onSelect={() => setArchiveTarget(item)}>{t("archiveButton")}</DropdownMenuItem>}
                        {hasRole(role, USER_ARCHIVE_ROLES) && item.archivedAt && <DropdownMenuItem disabled={restoreMutation.isPending} onSelect={() => restoreMutation.mutate(item.id)}>{t("restoreButton")}</DropdownMenuItem>}
                        {!item.archivedAt && item.status === "ACTIVE" && hasRole(role, USER_LIFECYCLE_ROLES) && <DropdownMenuItem disabled={lifecycleMutation.isPending} onSelect={() => lifecycleMutation.mutate({ id: item.id, active: item.isActive })}>{item.isActive ? t("suspendButton") : t("activateButton")}</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>}
                  </div></TableCell>
                </TableRow>;
              })}
            </TableBody></Table>
            {organisationsResult && organisationsResult.total > 0 && <div className="flex justify-end gap-3 py-4"><Button type="button" variant="outline" size="sm" disabled={page <= 1 || organisationsQuery.isFetching} onClick={() => setPage(page - 1)}>{t("previousButton")}</Button><AdminLiveResultCount announce={!organisationsQuery.isPlaceholderData} className="self-center text-sm">{t("showingRange", { start: (page - 1) * PAGE_SIZE + 1, end: Math.min(page * PAGE_SIZE, organisationsResult.total), total: organisationsResult.total })}</AdminLiveResultCount><Button type="button" variant="outline" size="sm" disabled={page * PAGE_SIZE >= organisationsResult.total || organisationsQuery.isFetching} onClick={() => setPage(page + 1)}>{t("nextButton")}</Button></div>}
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
      </>}

      {vue === "queue" && (<>
      {createdBy && (
        <Alert role="status" variant="info" className="my-4 flex items-center gap-3">
          <span>
            {t("createdByFilter")}{" "}
            <strong>{items.find((i) => i.createdBy === createdBy)?.createdByName ?? t("selectedOfficer")}</strong>
          </span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="ms-auto h-auto px-0"
            onClick={() => {
              applyStatus("");
              setUrlFilters({ createdBy: null });
            }}
          >
            {t("removeFilter")}
          </Button>
        </Alert>
      )}

      {notice && (
        <Alert
          role={notice.tone === "error" ? "alert" : "status"}
          variant={notice.tone === "error" ? "destructive" : "success"}
          className="my-4 flex items-center gap-3"
        >
          <span>{notice.text}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ms-auto size-7"
            aria-label={t("closeAriaLabel")}
            onClick={() => setNotice(null)}
          >
            <X />
          </Button>
        </Alert>
      )}

      {vue === "queue" && queueUpdating && (
        <p className="cam-registration-queue-updating" role="status" aria-live="polite">
          <span className="cam-registration-queue-spinner" aria-hidden="true" />
          {t("updatingQueue")}
        </p>
      )}

      {/* Files the reviewers have not decided in time. The national
          administration may decide any file; this is where it sees which. */}
      {!!counts?.overdue && !overdueOnly && (
        <Alert role="status" variant="warning" className="my-4 flex items-center gap-3">
          <span>{t("overdueNotice", { count: counts.overdue, days: overdueDays })}</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="ms-auto h-auto px-0"
            onClick={() => applyStatus("OVERDUE")}
          >
            {t("overdueShow")}
          </Button>
        </Alert>
      )}

      </>)}

      {vue === "queue" && (<>

      <AdminTablePanel title={t("viewQueue")} headingId="registration-queue-table-title" busy={queueUpdating} actions={<Button type="button" size="sm" variant="outline" onClick={exportQueue} disabled={!territoryFiltersValid}>{t("exportRegistrations")}</Button>}>
        <div className="cam-admin-table-panel-body">
          {registrationStatusSummary}
          <div className="cam-registration-filters">
            <div className="cam-filter-bar" role="group" aria-label={filtersLabel}>
              {searchField("registrations-search")}
              <AdminScopePill />
              <AdminFilterPill
                label={t("registrationStatusColumn")}
                value={statusFilter}
                allLabel={t("statusInQueue")}
                clearLabel={t("removeFilterChip", { label: t("registrationStatusColumn") })}
                onChange={applyStatus}
                options={[
                  { value: "PENDING_APPROVAL", label: t("statusPending"), count: counts?.pending },
                  { value: "COMPLEMENTS_REQUESTED", label: t("statusComplements"), count: counts?.complements },
                  { value: "OVERDUE", label: t("statusOverdue", { days: overdueDays }), count: counts?.overdue },
                  { value: "ACTIVE", label: t("statusApproved"), count: counts?.approved },
                  { value: "REJECTED", label: t("statusRejected"), count: counts?.rejected },
                  { value: "ALL", label: t("statusAll") },
                ]}
              />
              <AdminFilterPill
                label={t("duplicatesColumn")}
                value={duplicatesFilter}
                allLabel={t("statusAll")}
                clearLabel={t("removeFilterChip", { label: t("duplicatesColumn") })}
                onChange={applyDuplicates}
                options={[
                  { value: "with", label: t("withDuplicates") },
                  { value: "without", label: t("withoutDuplicates") },
                ]}
              />
              {territoryPillControl}
              <AdminFilterPill
                label={t("assignmentColumn")}
                value={assignedToMe ? "1" : ""}
                allLabel={tRoot("adminDossiersPage.assignedAll")}
                clearLabel={t("removeFilterChip", { label: t("assignmentColumn") })}
                onChange={(value) => applyAssignedToMe(value === "1")}
                options={[{ value: "1", label: tRoot("adminDossiersPage.assignedToMeOnly") }]}
              />
              {userId && <AdminSavedViews storageKey={`camleap.savedViews.inscriptions.${userId}`} currentQuery={savedViewQuery(currentQuery)} onApply={applySavedView} />}
              <AdminFilterMore label={filtersLabel} count={queuePanelChips.length}>
                {dateRangeField("registrations")}
                {departmentPanelField("registrations")}
                <AdminFilterField id="registrations-type" label={t("establishmentTypeColumn")}>
                  <select id="registrations-type" className="cam-admin-input w-full" value={typeFilter} onChange={(event) => applyType(event.target.value)}>
                    <option value="">{t("allTypes")}</option>
                    {REGISTRATION_ENTITY_TYPES.map((value) => <option key={value} value={value}>{entityLabel(value)}</option>)}
                  </select>
                </AdminFilterField>
                {methodField("registrations")}
                {sortField("registrations")}
              </AdminFilterMore>
              {hasActiveQueueFilters && <Button type="button" variant="ghost" size="sm" onClick={() => clearQueueFilters()}>{t("clearFilters")}</Button>}
            </div>
            <AdminActiveFilterChips filters={queuePanelChips.map(({ key, label, clear }) => ({ key, label, onClear: clear }))} label={t("activeFiltersLabel")} removeFilterLabel={(label) => t("removeFilterChip", { label })} />
          </div>
          <Table className="cam-registration-queue-table">
            <TableHeader><TableRow>
              <TableHead scope="col" className="whitespace-normal sticky left-0 z-20">{t("organisationReferenceColumn")}</TableHead>
              <TableHead scope="col">{t("registrationStatusColumn")}</TableHead>
              <TableHead scope="col">{t("duplicatesColumn")}</TableHead>
              <TableHead scope="col">{`${t("regionColumn")} / ${t("departmentColumn")}`}</TableHead>
              <TableHead scope="col">{t("establishmentTypeColumn")}</TableHead>
              <TableHead scope="col">{t("submissionDateColumn")}</TableHead>
              <TableHead scope="col">{t("assignmentColumn")}</TableHead>
              <TableHead scope="col">{t("actionsColumn")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <DataStateRow colSpan={8} state={tableState} resource={tRoot("adminNav.routes.inscriptions")} error={queueQuery.error ?? (territoryValidationError ? territoryStructure.error : undefined)} onRetry={() => territoryValidationError ? territoryStructure.refetch() : queueQuery.refetch()} title={tableState === "loading" ? tRoot("common.loading") : tableState === "error" ? t("loadError") : tableState === "forbidden" ? t("noQueueAccess") : tableState === "empty" ? t("emptyTitle") : undefined} />
              {items.map((item) => {
                const badge = STATUS_BADGE[item.status];
                return <TableRow key={item.id}>
                  <TableHead scope="row" className="sticky left-0 z-10 h-auto whitespace-normal border-r bg-[var(--cam-surface)] font-medium text-foreground shadow-[2px_0_3px_-3px_rgba(15,23,42,0.45)]"><span className="block max-w-[250px] truncate font-semibold" title={item.organisation}>{item.organisation}</span><span className="block max-w-[250px] truncate text-xs text-muted-foreground" title={item.establishmentId ?? undefined}>{item.establishmentId || NOT_PROVIDED}</span></TableHead>
                  <TableCell className="align-top whitespace-normal py-3"><div className="flex flex-wrap items-center gap-1.5"><Badge variant={badge?.tone ?? "neutral"}>{badge ? t(badge.textKey) : item.status}</Badge>{item.overdue && <Badge variant="danger">{t("overdueBadge", { days: daysWaiting(item.waitingSince) ?? overdueDays })}</Badge>}</div></TableCell>
                  <TableCell className="align-top whitespace-normal py-3">{item.duplicateHints.length > 0 ? <details><summary className="cursor-pointer">{t("possibleMatches", { count: item.duplicateHints.length })}</summary><ul className="mt-1 list-disc break-words ps-5">{item.duplicateHints.map((hint, index) => <li key={`${hint}-${index}`}>{hint}</li>)}</ul></details> : NOT_PROVIDED}</TableCell>
                  <TableCell className="align-top whitespace-normal py-3"><span className="block truncate" title={[item.region, item.department].filter(Boolean).join(" / ")}>{[item.region, item.department].filter(Boolean).join(" / ") || NOT_PROVIDED}</span></TableCell>
                  <TableCell className="align-top whitespace-normal py-3"><span className="block truncate" title={entityLabel(item.entityType)}>{entityLabel(item.entityType)}</span></TableCell>
                  <TableCell className="align-top whitespace-normal py-3"><span className="whitespace-nowrap">{stamp(item.submittedAt, true, locale)}</span></TableCell>
                  <TableCell className="align-top whitespace-normal py-3"><div className="flex flex-col items-start gap-1"><span className="truncate" title={item.assigneeId ? item.assigneeName ?? undefined : undefined}>{item.assigneeId ? tRoot("adminDossiersPage.assignedTo", { name: item.assigneeName ?? NOT_PROVIDED }) : tRoot("adminDossiersPage.unassigned")}</span>{hasRole(role, APPROVAL_ROLES) && (item.assigneeId == null || item.assigneeId === userId) && <Button type="button" variant="link" size="sm" className="h-auto px-0" disabled={assignMutation.isPending} onClick={() => assignMutation.mutate({ id: item.id, assigneeId: item.assigneeId ? null : userId ?? null, expectedAssigneeId: item.assigneeId })}>{item.assigneeId ? tRoot("adminDossiersPage.unclaimButton") : tRoot("adminDossiersPage.claimButton")}</Button>}</div></TableCell>
                  <TableCell className="align-top whitespace-normal py-3"><div className="cam-registration-row-actions">
                    {/* Unclaimed: the main action claims, then opens the review page. The
                        dialog stays reachable from the menu until the page is approved. */}
                    {(() => {
                      const canClaim = hasRole(role, APPROVAL_ROLES) && item.assigneeId == null && !!userId;
                      return <>
                        <Button type="button" size="sm" variant={canClaim ? "default" : "outline"} disabled={queueUpdating || opening !== null} onClick={() => void openReviewPage(item, canClaim)}>
                          {canClaim ? tRoot("adminRegistrationReview.claimAndOpen") : tRoot("adminRegistrationReview.openPage")}
                        </Button>
                        {canClaim && <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button type="button" size="icon-sm" variant="ghost" className="shrink-0" aria-label={tRoot("adminRegistrationReview.rowActions", { organisation: item.organisation })} title={t("actionsColumn")}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => void openReviewPage(item, false)}>{tRoot("adminRegistrationReview.openWithoutClaim")}</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>}
                      </>;
                    })()}
                  </div></TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
        </div>
      </AdminTablePanel>

      {/* Only once the queue has answered (G10) and has rows: "0–0 sur 0"
          read as a count nobody had read while loading, and repeats the
          table's own empty state once loaded. */}
      {queueQuery.data && total > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-4 py-4 text-sm text-muted-foreground">
          <span>
            {t("showingRange", { start: count(start, locale), end: count(end, locale), total: count(total, locale) })}
          </span>
          <Button type="button" variant="outline" size="sm" disabled={queueUpdating || page <= 1} onClick={() => setPage(page - 1)}>
            {t("previousButton")}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={queueUpdating || end >= total} onClick={() => setPage(page + 1)}>
            {t("nextButton")}
          </Button>
        </div>
      )}
      </>)}

    </div>
  );
}

/** The registration-method badge, or a dash for a row that predates tracking. */
