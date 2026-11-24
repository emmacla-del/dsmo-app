"use client";

import { Suspense, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Download, MoreHorizontal, Plus, Search } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import {
  ENTITY_TYPE_OPTION_KEYS,
  listCompanies,
  getCompanyStats,
  entityTypeLabel,
  type Company,
} from "@/lib/companies-directory";
import { activateUser, archiveUser, restoreUser, suspendUser } from "@/lib/user-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { DIRECTORY_READ_ROLES, SURVEY_READ_ROLES, USER_ARCHIVE_ROLES, USER_LIFECYCLE_ROLES, hasRole, isReadOnlyRole } from "@/lib/roles";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { AdminFilterPill } from "@/components/admin/AdminFilterPill";
import { AdminFilterField, AdminFilterMore, AdminScopePill, territoryPillFor } from "@/components/admin/AdminFilterBarParts";
import { AdminActiveFilterChips } from "@/components/admin/AdminActiveFilterChips";
import { AdminSavedViews, savedViewQuery } from "@/components/admin/AdminSavedViews";
import { clampAdminListPage, hrefWith, parseAdminListPage } from "@/lib/admin-url";
import { AdminKpiStrip } from "@/components/admin/AdminKpiStrip";
import { AdminNumberedPager } from "@/components/admin/AdminPager";
import { DataStateRow } from "@/components/admin/DataState";
import { ArchiveActions } from "@/components/admin/ArchiveActions";
import { ConfirmDialog } from "@/components/auth/ConfirmDialog";
import {
  NOT_PROVIDED,
  count,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";
import { useTerritoryDepartments, useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { YEAR_MIN } from "@/lib/pilotage-targets";
import { doualaIsoDate, doualaYear } from "@/lib/douala-date";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 8;
type Semester = 1 | 2;
type Quarter = 1 | 2 | 3 | 4;

function registrationPeriod(value: string | null): { year: number | null; semester: Semester | null; quarter: Quarter | null } {
  const date = doualaIsoDate(value);
  if (!date) return { year: null, semester: null, quarter: null };
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const quarter = Math.ceil(month / 3) as Quarter;
  return { year, semester: quarter <= 2 ? 1 : 2, quarter };
}

/**
 * The seven live OnefopEntityType values, labelled through the shared
 * entityTypeLabel() helper so this list and the row labels can never
 * disagree.
 *
 * Replaces a hand-written array that offered a type absent from the enum —
 * so that option could only ever return nothing — and omitted
 * PROJECT_PROGRAM and VOCATIONAL_TRAINING, hiding two real entity types from
 * the filter. The deprecated VOCATIONAL_TRAINING_CENTER is deliberately not
 * here.
 */
const ENTITY_TYPE_VALUES = [
  "ENTREPRISE",
  "COOPERATIVE",
  "CTD",
  "ONG",
  "ADMINISTRATION",
  "PROJECT_PROGRAM",
  "VOCATIONAL_TRAINING",
];


// Only states a linked account can actually be in, derived from User.status /
// User.isActive. "Incomplet" was offered but no record ever carries it, so
// that filter could only ever return nothing.
//
// All four go to GET /companies, which reads them as the stat strip does:
// ACTIVE = approved and active, SUSPENDED = approved and deactivated
// (User.isActive false), PENDING_APPROVAL and REJECTED as stored.
// `labelKey` is under adminEtablissementsPage.
const ACCOUNT_STATUSES = [
  { value: "ALL", labelKey: "allMasculine" },
  { value: "ACTIVE", labelKey: "status.ACTIF" },
  { value: "SUSPENDED", labelKey: "status.SUSPENDU" },
];


/**
 * One establishment row.
 *
 * Every field is mapped from a GET /companies record. Fields the record
 * does not carry stay `null` and render as an em dash. There is deliberately
 * no `creePar`: nothing on the Company model records who created the account
 * (docs/admin-data-integrity-inventory.md), so the column was removed rather
 * than filled with "Auto-inscription" on every row.
 */
interface EtabItem {
  id: string;
  companyId: string;
  userId: string;
  name: string | null;
  type: string | null;
  /** French label, for the CSV export (whose columns do not follow the locale). */
  typeLabel: string | null;
  identifier: string | null;
  registrationNumber: string | null;
  region: string | null;
  department: string | null;
  subdivision: string | null;
  responsable: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  dateInscription: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  year: number | null;
  semester: Semester | null;
  quarter: Quarter | null;
  status: "ACTIF" | "EN_ATTENTE" | "REJETE" | "SUSPENDU" | "INCONNU";
}

// French status values for the CSV export.
const STATUS_LABELS: Record<EtabItem["status"], string> = {
  ACTIF: "Actif",
  EN_ATTENTE: "En attente",
  REJETE: "Rejeté",
  SUSPENDU: "Suspendu",
  INCONNU: "Aucun compte lié",
};

export default function EtablissementsPage() {
  return (
    <Suspense fallback={null}>
      <EtablissementsContent />
    </Suspense>
  );
}

function EtablissementsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const userId = useAuthStore((s) => s.user?.id);
  const userRegion = useAuthStore((s) => s.user?.region);
  const userDepartment = useAuthStore((s) => s.user?.department);
  const queryClient = useQueryClient();
  const tRoot = useTranslations();
  const t = useTranslations("adminEtablissementsPage");
  const tStats = useTranslations("adminLayout");
  useEffect(() => {
    document.title = `${t("pageTitle")} | CAMLEAP`;
  }, [t]);
  const locale = asUiLocale(useLocale());
  const typeDisplay = (type: string) =>
    ENTITY_TYPE_OPTION_KEYS[type] ? tRoot(ENTITY_TYPE_OPTION_KEYS[type]) : entityTypeLabel(type);
  const role = useAuthStore((s) => s.user?.role);
  // Fails closed: an unknown or not-yet-loaded role is not authorised. The
  // previous `!role ||` made a missing role read as permitted.
  const canRead = !!role && DIRECTORY_READ_ROLES.includes(role);
  // Central agents consult the register: no export, no registration on a
  // company's behalf, no account management.
  const readOnly = isReadOnlyRole(role);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<EtabItem | null>(null);
  const [accountAction, setAccountAction] = useState<{ kind: "suspend" | "activate" | "restore"; item: EtabItem } | null>(null);

  const { regions: territoryRegions } = useTerritoryRegions();

  // Every filter and the page live in the URL (G15): a reload, a shared link
  // or a saved view reopens the same list. Only the search box keeps a draft,
  // written to the URL after a 300 ms pause.
  // Written at once and on top of the address as it stands: through the router
  // it changed only when the server answered, so a second filter chosen
  // meanwhile dropped the first. Next keeps useSearchParams in step.
  const setFilters = (changes: Record<string, string | number | null>) =>
    window.history.replaceState(null, "", hrefWith(pathname, window.location.search.slice(1), { page: null, ...changes }));
  const urlSearch = searchParams.get("search")?.trim() ?? "";
  const rawType = searchParams.get("type") ?? "";
  const selectedType = (ENTITY_TYPE_VALUES as readonly string[]).includes(rawType) ? rawType : "ALL";
  const selectedRegion = searchParams.get("region")?.trim() || "Toutes";
  const selectedDepartment = searchParams.get("department")?.trim() ?? "";
  const includeArchived = searchParams.get("includeArchived") === "true";
  const territoryPill = territoryPillFor(role);
  const departmentRegion = role === "REGIONAL_ADMIN" ? userRegion : selectedRegion === "Toutes" ? undefined : selectedRegion;
  const { departments: territoryDepartments } = useTerritoryDepartments(departmentRegion);
  const departmentOptions = role === "DIVISIONAL_ADMIN" ? (userDepartment ? [userDepartment] : []) : territoryDepartments;
  const rawStatus = searchParams.get("status") ?? "";
  const selectedStatus = ACCOUNT_STATUSES.some((status) => status.value === rawStatus) ? rawStatus : "ALL";
  const sortOrder: "oldest" | "newest" = searchParams.get("sort") === "oldest" ? "oldest" : "newest";
  const rawYear = Number(searchParams.get("year"));
  const periodYear = Number.isInteger(rawYear) && rawYear >= YEAR_MIN && rawYear <= 2100 ? rawYear : null;
  const rawSemester = searchParams.get("semester");
  const periodSemester: Semester | null = rawSemester === "1" ? 1 : rawSemester === "2" ? 2 : null;
  const rawQuarter = Number(searchParams.get("quarter"));
  const periodQuarter: Quarter | null = [1, 2, 3, 4].includes(rawQuarter)
    && (periodSemester === null || (rawQuarter <= 2 ? 1 : 2) === periodSemester)
    ? rawQuarter as Quarter
    : null;
  const page = parseAdminListPage(searchParams.get("page"));
  const setPage = (next: number) => setFilters({ page: next <= 1 ? null : next });

  useEffect(() => {
    if (!rawStatus || ACCOUNT_STATUSES.some((status) => status.value === rawStatus)) return;
    window.history.replaceState(null, "", hrefWith(pathname, window.location.search.slice(1), { status: null, page: null }));
  }, [pathname, rawStatus]);

  const [searchInput, setSearchInput] = useState(urlSearch);
  // A saved view or the back button changes the URL under the box: follow it.
  const [syncedSearch, setSyncedSearch] = useState(urlSearch);
  if (syncedSearch !== urlSearch) {
    setSyncedSearch(urlSearch);
    setSearchInput(urlSearch);
  }
  const latestAvailableYear = doualaYear(new Date()) ?? new Date().getFullYear();
  const yearOptions = Array.from(
    { length: Math.max(0, latestAvailableYear - YEAR_MIN + 1) },
    (_, index) => latestAvailableYear - index,
  );
  const quarterOptions: Quarter[] = periodSemester === 1
    ? [1, 2]
    : periodSemester === 2
      ? [3, 4]
      : [1, 2, 3, 4];

  useEffect(() => {
    const next = searchInput.trim();
    if (next === urlSearch) return;
    const timer = setTimeout(() => {
      window.history.replaceState(null, "", hrefWith(pathname, window.location.search.slice(1), { page: null, search: next || null }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, urlSearch, pathname]);

  const companyStatsQuery = useQuery({
    queryKey: ["dsmo", "companies", "stats", includeArchived],
    queryFn: () => getCompanyStats(includeArchived),
    enabled: canRead,
  });

  // Sent to GET /companies, which filters and counts over the whole
  // territory-scoped register rather than over the page already fetched.
  const serverStatus = selectedStatus !== "ALL" ? selectedStatus : undefined;
  const serverRegion = selectedRegion !== "Toutes" ? selectedRegion : undefined;
  const serverDepartment = selectedDepartment || undefined;
  const serverType = selectedType !== "ALL" ? selectedType : undefined;

  const companiesQuery = useQuery({
    queryKey: ["dsmo", "companies", "registered", urlSearch, serverStatus ?? "ALL", serverRegion ?? "ALL", serverDepartment ?? "ALL", serverType ?? "ALL", includeArchived, sortOrder, periodYear, periodSemester, periodQuarter, page],
    queryFn: () =>
      listCompanies({
        search: urlSearch || undefined,
        status: serverStatus,
        region: serverRegion,
        department: serverDepartment,
        entityType: serverType,
        registeredOnly: true,
        includeArchived,
        sortOrder,
        year: periodYear ?? undefined,
        semester: periodSemester ?? undefined,
        quarter: periodQuarter ?? undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: canRead,
  });

  // A page past the end (an old link, a saved view, a list that has shrunk)
  // answers no rows with the full total, which read as an empty register.
  const companiesTotal = companiesQuery.data?.total;
  useEffect(() => {
    if (companiesTotal === undefined) return;
    const validPage = clampAdminListPage(page, companiesTotal, PAGE_SIZE);
    if (validPage === page) return;
    window.history.replaceState(null, "", hrefWith(pathname, window.location.search.slice(1), { page: validPage <= 1 ? null : validPage }));
  }, [companiesTotal, page, pathname]);

  const companyStats = companyStatsQuery.data;

  /**
   * Total establishments.
   * Approved stock is the active and suspended buckets from GET /companies/stats.
   */
  const totalEtablissements = companyStats ? companyStats.active + companyStats.suspended : null;

  const rawRows: Company[] = companiesQuery.data?.companies ?? [];

  // Real rows only. Fields the record does not carry stay null.
  const displayRows: EtabItem[] = rawRows.map((c) => ({
    id: c.establishmentId || c.id,
    companyId: c.id,
    userId: c.user?.id ?? "",
    name: c.name ?? null,
    type: c.entityType?.toUpperCase() ?? null,
    typeLabel: c.entityType ? entityTypeLabel(c.entityType) : null,
    identifier: c.establishmentId ?? null,
    registrationNumber: c.registrationNumber ?? null,
    region: c.region ?? null,
    department: c.department ?? null,
    subdivision: c.subdivision ?? null,
    responsable:
      [c.respondentFirstName, c.respondentLastName].filter(Boolean).join(" ").trim() ||
      c.user?.email ||
      null,
    contactEmail: c.user?.email ?? null,
    contactPhone: c.respondentPhone ?? c.phone ?? null,
    dateInscription: c.createdAt ?? null,
    archivedAt: c.user?.archivedAt ?? null,
    archiveReason: c.user?.archiveReason ?? null,
    ...registrationPeriod(c.createdAt),
    status: c.user?.isActive ? "ACTIF" : "SUSPENDU",
  }));

  // Type and « Suspendu » are filtered by GET /companies too (2026-11-03), so
  // the rows, the total and the pager describe the same query.

  /**
   * Pager figures, all taken from the response GET /companies actually
   * returned. Until now the footer read "Affichage 1-8 sur 1 847
   * établissements" from a hardcoded string and the page buttons had no
   * onClick at all, so `page` could never leave 1 and the total was an
   * invented figure.
   */
  const filteredTotal = companiesQuery.data?.total ?? null;
  const totalPages = filteredTotal === null ? 1 : Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const rangeFrom = rawRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo = rawRows.length === 0 ? 0 : rangeFrom + rawRows.length - 1;

  const filteredRows = displayRows;

  const tableState = resolveDataState({
    roleAllowed: canRead,
    isLoading: companiesQuery.isLoading,
    isError: companiesQuery.isError,
    error: companiesQuery.error,
    rowCount: companiesQuery.data ? filteredRows.length : null,
  });

  // Filter bar (spec §4F): search, scope, type / region / status pills,
  // « Filtres » for the period and the order. Chips only for what has no pill.
  const tq = (key: string, values?: Record<string, string>) => tRoot(`adminInscriptionsPage.${key}`, values);
  const showRegionPill = territoryPill === "region";
  const showDepartmentPill = territoryPill === "department";
  const panelChips = [
    selectedDepartment && !showDepartmentPill && { key: "department", label: `${tRoot("companiesDirectory.departmentColumn")} : ${selectedDepartment}`, clear: () => setFilters({ department: null }) },
    periodYear != null && { key: "year", label: `${t("yearColumn")} : ${periodYear}`, clear: () => setFilters({ year: null }) },
    periodSemester != null && { key: "semester", label: `${t("semesterColumn")} : S${periodSemester}`, clear: () => setFilters({ semester: null, quarter: null }) },
    periodQuarter != null && { key: "quarter", label: `${t("quarterColumn")} : Q${periodQuarter}`, clear: () => setFilters({ quarter: null }) },
    sortOrder !== "newest" && { key: "sort", label: tRoot("adminDossiersPage.sortOldest"), clear: () => setFilters({ sort: null }) },
    includeArchived && { key: "includeArchived", label: t("showArchived"), clear: () => setFilters({ includeArchived: null }) },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];
  const hasAnyFilter = panelChips.length > 0 || searchInput.trim() !== "" || selectedType !== "ALL" || selectedRegion !== "Toutes" || selectedStatus !== "ALL";
  const clearAllFilters = () => {
    setSearchInput("");
    setFilters({ search: null, type: null, region: null, department: null, status: null, includeArchived: null, sort: null, year: null, semester: null, quarter: null });
  };

  /**
   * Exports exactly the rows on screen — one page of the server's filtered
   * result, minus any page-local narrowing. Nothing is padded or generated;
   * an empty table exports nothing.
   *
   * Values are CSV-quoted so a company name containing a comma cannot shift
   * other fields into the wrong column — a silent corruption of an
   * administrative export.
   */
  const exportCsv = () => {
    if (filteredRows.length === 0) return;
    const headers = ["Nom", "Identifiant", "Type", "Région / Ville", "Responsable", "Date d'inscription", "Année", "Semestre", "Trimestre", "Statut"];
    const cell = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      headers.map((h) => cell(h)).join(","),
      ...filteredRows.map((r) =>
        [
          cell(r.name),
          cell(r.identifier),
          cell(r.typeLabel),
          cell([r.region, r.department, r.subdivision].filter(Boolean).join(" / ")),
          cell(r.responsable),
          cell(r.dateInscription ? stamp(r.dateInscription, true) : null),
          cell(r.year == null ? null : String(r.year)),
          cell(r.semester == null ? null : `S${r.semester}`),
          cell(r.quarter == null ? null : `Q${r.quarter}`),
          cell(STATUS_LABELS[r.status]),
        ].join(","),
      ),
    ];
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `etablissements_onefop_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Register volume. Authoritative metrics sourced from GET /companies/stats.
  const volume = [
    { key: "total", label: t("kpiTotal"), loading: companyStatsQuery.isLoading, value: totalEtablissements, hint: t("kpiTotalHint") },
    { key: "active", label: t("kpiActive"), loading: companyStatsQuery.isLoading, value: companyStats?.active, hint: t("kpiActiveHint") },
    { key: "suspended", label: t("kpiSuspended"), loading: companyStatsQuery.isLoading, value: companyStats?.suspended, hint: t("kpiSuspendedHint") },
  ];

  const invalidateRegister = () => {
    void queryClient.invalidateQueries({ queryKey: ["dsmo", "companies"] });
    void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] });
  };
  const archiveMutation = useMutation({
    mutationFn: ({ item, reason }: { item: EtabItem; reason: string }) => archiveUser(item.userId, reason),
    onSuccess: (_data, { item }) => {
      setNotice({ tone: "success", text: t("archiveDone", { establishment: item.name ?? NOT_PROVIDED }) });
      invalidateRegister();
    },
    onError: (error) => setNotice({ tone: "error", text: `${t("archiveFailed")} ${error instanceof Error ? error.message : ""}`.trim() }),
  });
  const restoreMutation = useMutation({
    mutationFn: (item: EtabItem) => restoreUser(item.userId),
    onSuccess: (_data, item) => {
      setNotice({ tone: "success", text: t("restoreDone", { establishment: item.name ?? NOT_PROVIDED }) });
      invalidateRegister();
    },
    onError: (error) => setNotice({ tone: "error", text: `${t("restoreFailed")} ${error instanceof Error ? error.message : ""}`.trim() }),
  });
  const lifecycleMutation = useMutation({
    mutationFn: ({ kind, item }: { kind: "suspend" | "activate"; item: EtabItem }) => kind === "suspend" ? suspendUser(item.userId) : activateUser(item.userId),
    onSuccess: (_data, { kind, item }) => {
      setNotice({ tone: "success", text: t(kind === "suspend" ? "suspendDone" : "activateDone", { establishment: item.name ?? NOT_PROVIDED }) });
      invalidateRegister();
    },
    onError: (error, { kind }) => setNotice({ tone: "error", text: `${t(kind === "suspend" ? "suspendFailed" : "activateFailed")} ${error instanceof Error ? error.message : ""}`.trim() }),
  });
  const runAccountAction = () => {
    if (!accountAction) return;
    if (accountAction.kind === "restore") restoreMutation.mutate(accountAction.item);
    else lifecycleMutation.mutate({ kind: accountAction.kind, item: accountAction.item });
    setAccountAction(null);
  };

  return (
    <div className="cam-admin-page">
      {/* Page actions sit in the header; this destination is the establishment
          register under its own navigation group. Annuaire moved to
          Administration. */}
      <AdminPageHeader
        breadcrumb={[{ label: tRoot("adminNav.hubs.inscriptions"), href: "/admin/inscriptions" }, { label: tRoot("adminNav.routes.etablissements") }]}
        title={tRoot("adminNav.routes.etablissements")}
        subtitle={t("registerSubtitle")}
        hideTabs
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Export with the page's actions, as on the canvas board. */}
            {!readOnly && (
              <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
                <Download aria-hidden="true" />
                {t("exportButton")}
              </Button>
            )}
            {!readOnly && (
              <Button
                type="button"
                size="sm"
                // Admin-assisted registration, inside the console. This used to
                // open the public /register self-signup, which left the console
                // and recorded no admin attribution (createdBy).
                onClick={() => router.push("/admin/inscriptions/nouvelle")}
              >
                <Plus aria-hidden="true" />
                {tRoot("adminNav.routes.nouvelleInscription")}
              </Button>
            )}
          </div>
        }
      />

      {/* Key figures (canvas board 1): each one filters the register below. */}
      <AdminKpiStrip
        label={tStats("keyFigures")}
        loadingLabel={tStats("loadingFigures")}
        loading={volume.some((k) => k.loading)}
        error={companyStatsQuery.isError}
        errorLabel={tStats("figuresUnavailable")}
        items={volume.map((k) => {
          const status = k.key === "active" ? "ACTIVE" : k.key === "suspended" ? "SUSPENDED" : "ALL";
          return {
            key: k.key,
            value: count(k.value, locale),
            label: k.label,
            hint: k.hint,
            tone: k.key === "active" ? "success" : "neutral",
            pressed: selectedStatus === status,
            onSelect: () => setFilters({ status: status === "ALL" || selectedStatus === status ? null : status }),
          };
        })}
      />

      {notice && <Alert role={notice.tone === "error" ? "alert" : "status"} variant={notice.tone === "error" ? "destructive" : "success"} className="my-4">{notice.text}</Alert>}

      <AdminTablePanel
        footer={
          // Pager figures, all from the response GET /companies returned.
          <AdminNumberedPager
            page={page}
            pageCount={totalPages}
            range={companiesQuery.isLoading || filteredTotal === null ? NOT_PROVIDED : t("showingRange", { from: count(rangeFrom, locale), to: count(rangeTo, locale), total: count(filteredTotal, locale) })}
            previousLabel={t("previousButton")}
            nextLabel={t("nextButton")}
            label={t("pagerAriaLabel")}
            pageLabel={(n) => t("pageButtonAriaLabel", { page: n })}
            onPage={(n) => setPage(Math.min(totalPages, Math.max(1, n)))}
          />
        }
        title={t("registerTitle")}
        description={t("scopeNote")}
        headingId="establishments-register-title"
        toolbar={
          <div className="cam-registration-filters">
            <div className="cam-filter-bar" role="group" aria-label={tRoot("adminDossiersPage.filtersButton")}>
              <div className="cam-filter-bar-search">
                <Label className="cam-sr-only" htmlFor="etab-search">{t("searchLabel")}</Label>
                <Search aria-hidden="true" className="cam-filter-bar-search-icon" />
                <Input id="etab-search" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t("searchPlaceholder")} />
              </div>
              <AdminScopePill />
              <AdminFilterPill
                label={tRoot("companiesDirectory.typeColumn")}
                value={selectedType === "ALL" ? "" : selectedType}
                allLabel={t("allMasculine")}
                clearLabel={tq("removeFilterChip", { label: tRoot("companiesDirectory.typeColumn") })}
                onChange={(value) => setFilters({ type: value || null })}
                options={ENTITY_TYPE_VALUES.map((value) => ({ value, label: typeDisplay(value) }))}
              />
              {showRegionPill && <AdminFilterPill
                label={tRoot("companiesDirectory.regionColumn")}
                value={selectedRegion === "Toutes" ? "" : selectedRegion}
                allLabel={t("allRegions")}
                clearLabel={tq("removeFilterChip", { label: tRoot("companiesDirectory.regionColumn") })}
                onChange={(value) => setFilters({ region: value || null, department: null })}
                options={territoryRegions.map((value) => ({ value, label: value }))}
              />}
              {showDepartmentPill && <AdminFilterPill
                label={tRoot("companiesDirectory.departmentColumn")}
                value={selectedDepartment}
                allLabel={t("allDepartments")}
                clearLabel={tq("removeFilterChip", { label: tRoot("companiesDirectory.departmentColumn") })}
                onChange={(value) => setFilters({ department: value || null })}
                options={departmentOptions.map((value) => ({ value, label: value }))}
              />}
              <AdminFilterPill
                label={t("statusFilterLabel")}
                value={selectedStatus === "ALL" ? "" : selectedStatus}
                allLabel={t("allMasculine")}
                clearLabel={tq("removeFilterChip", { label: t("statusFilterLabel") })}
                onChange={(value) => setFilters({ status: value || null })}
                options={ACCOUNT_STATUSES.filter((status) => status.value !== "ALL").map((status) => ({ value: status.value, label: t(status.labelKey) }))}
              />
              {userId && <AdminSavedViews storageKey={`camleap.savedViews.etablissements.${userId}`} currentQuery={savedViewQuery(currentQuery)} onApply={(query) => router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })} />}
              <AdminFilterMore label={tRoot("adminDossiersPage.filtersButton")} count={panelChips.length}>
                {showRegionPill && <AdminFilterField id="etab-department" label={tRoot("companiesDirectory.departmentColumn")}>
                  <select id="etab-department" className="cam-admin-input w-full" value={selectedDepartment} onChange={(event) => setFilters({ department: event.target.value || null })}>
                    <option value="">{t("allDepartments")}</option>
                    {departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
                  </select>
                </AdminFilterField>}
                <AdminFilterField id="etab-year" label={t("yearColumn")}>
                  <select
                    id="etab-year"
                    className="cam-admin-input w-full"
                    value={periodYear == null ? "all" : String(periodYear)}
                    onChange={(event) => {
                      setFilters({ year: event.target.value === "all" ? null : Number(event.target.value) });
                    }}
                  >
                    <option value="all">{t("allYears")}</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={String(year)}>{year}</option>
                    ))}
                  </select>
                </AdminFilterField>
                <AdminFilterField id="etab-semester" label={t("semesterColumn")}>
                  <select
                    id="etab-semester"
                    className="cam-admin-input w-full"
                    value={periodSemester == null ? "all" : String(periodSemester)}
                    onChange={(event) => {
                      setFilters({ semester: event.target.value === "all" ? null : event.target.value, quarter: null });
                    }}
                  >
                    <option value="all">{t("allSemesters")}</option>
                    <option value="1">S1</option>
                    <option value="2">S2</option>
                  </select>
                </AdminFilterField>
                <AdminFilterField id="etab-quarter" label={t("quarterColumn")}>
                  <select
                    id="etab-quarter"
                    className="cam-admin-input w-full"
                    value={periodQuarter == null ? "all" : String(periodQuarter)}
                    onChange={(event) => {
                      setFilters({ quarter: event.target.value === "all" ? null : Number(event.target.value) });
                    }}
                  >
                    <option value="all">{t("allQuarters")}</option>
                    {quarterOptions.map((quarter) => (
                      <option key={quarter} value={String(quarter)}>Q{quarter}</option>
                    ))}
                  </select>
                </AdminFilterField>
                <AdminFilterField id="etab-sort" label={tRoot("adminDossiersPage.sortLabel")}>
                  <select
                    id="etab-sort"
                    className="cam-admin-input w-full"
                    value={sortOrder}
                    onChange={(event) => {
                      setFilters({ sort: event.target.value === "oldest" ? "oldest" : null });
                    }}
                  >
                    <option value="newest">{tRoot("adminDossiersPage.sortNewest")}</option>
                    <option value="oldest">{tRoot("adminDossiersPage.sortOldest")}</option>
                  </select>
                </AdminFilterField>
                <div className="cam-filter-more-field is-wide cam-filter-more-check">
                  <Checkbox id="etab-include-archived" checked={includeArchived} onCheckedChange={(checked) => setFilters({ includeArchived: checked === true ? "true" : null })} />
                  <Label htmlFor="etab-include-archived" className="!mb-0 cursor-pointer">{t("showArchived")}</Label>
                </div>
              </AdminFilterMore>
              {hasAnyFilter && <Button type="button" variant="ghost" size="sm" onClick={clearAllFilters}>{tq("clearFilters")}</Button>}
            </div>
            <AdminActiveFilterChips filters={panelChips.map(({ key, label, clear }) => ({ key, label, onClear: clear }))} label={tq("activeFiltersLabel")} removeFilterLabel={(label) => tq("removeFilterChip", { label })} />
          </div>
        }
      >
          <Table className="cam-table-stack cam-register-table">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t("establishmentColumn")}</TableHead>
                <TableHead scope="col">{t("statusFilterLabel")}</TableHead>
                <TableHead scope="col">{t("territoryColumn")}</TableHead>
                <TableHead scope="col">{t("contactColumn")}</TableHead>
                <TableHead scope="col">{t("registrationDateColumn")}</TableHead>
                <TableHead scope="col" className="text-right">{t("actionsColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <DataStateRow
                colSpan={6}
                state={tableState}
                resource={t("registerResource")}
                error={companiesQuery.error}
                onRetry={() => companiesQuery.refetch()}
                title={tableState === "empty" ? t("noEstablishmentTitle") : undefined}
                hint={tableState === "empty" ? t("noEstablishmentHint") : undefined}
              />
              {filteredRows.map((item) => {
                const detailIdentifier = item.identifier || item.registrationNumber;
                const detailHref = !item.archivedAt && detailIdentifier ? `/admin/etablissement-detail?id=${encodeURIComponent(detailIdentifier)}&returnTo=${encodeURIComponent(`${pathname}${currentQuery ? `?${currentQuery}` : ""}`)}` : null;
                const territory = [item.region, item.department, item.subdivision].filter(Boolean).join(" · ") || NOT_PROVIDED;
                const contactDisplay = item.responsable ?? item.contactEmail ?? item.contactPhone ?? NOT_PROVIDED;
                const contactTitle = Array.from(new Set(
                  [item.responsable, item.contactEmail, item.contactPhone].filter((value): value is string => Boolean(value)),
                )).join(" · ") || NOT_PROVIDED;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="cam-record-cell">
                        <span className="cam-record-cell-name" title={item.name ?? NOT_PROVIDED}>{item.name ?? NOT_PROVIDED}</span>
                        <span className="cam-record-cell-meta">
                          <span className="cam-record-cell-ref">{item.identifier ?? NOT_PROVIDED}</span>
                          {item.type && <span className="cam-tag" title={typeDisplay(item.type)}>{tRoot.has(`adminInscriptionsPage.entityShort.${item.type}`) ? tRoot(`adminInscriptionsPage.entityShort.${item.type}`) : typeDisplay(item.type)}</span>}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell data-label={t("statusFilterLabel")}>
                      <span className="cam-cell-stack">
                        <span className="flex flex-wrap gap-1.5">
                          <Badge variant={item.status === "ACTIF" ? "success" : "neutral"}>{t(`status.${item.status}`)}</Badge>
                          {item.archivedAt && <Badge variant="neutral">{t("archivedBadge")}</Badge>}
                        </span>
                        {item.archivedAt && item.archiveReason && <span className="cam-cell-sub">{item.archiveReason}</span>}
                      </span>
                    </TableCell>
                    <TableCell data-label={t("territoryColumn")} title={territory}>
                      {[item.region, item.department].filter(Boolean).join(" · ") || NOT_PROVIDED}
                      {item.subdivision && <span className="cam-cell-sub">{item.subdivision}</span>}
                    </TableCell>
                    <TableCell data-label={t("contactColumn")} title={contactTitle}>
                      <span className="cam-cell-clamp">{contactDisplay}</span>
                      {item.contactPhone && item.contactPhone !== contactDisplay && <span className="cam-cell-sub">{item.contactPhone}</span>}
                    </TableCell>
                    <TableCell data-label={t("registrationDateColumn")} className="cam-cell-nowrap">
                      <span className="cam-cell-muted">{stamp(item.dateInscription, false, locale)}</span>
                    </TableCell>
                    <TableCell className="cam-cell-action text-right">
                      <div className="flex items-center justify-end gap-1">
                        {detailHref ? (
                          <Link className="cam-button cam-button-secondary cam-button-sm" href={detailHref}>{t("viewDetails")}</Link>
                        ) : (
                          <span aria-disabled="true" className="cam-button cam-button-secondary cam-button-sm">{t("viewDetails")}</span>
                        )}
                        {item.userId && <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" size="icon-sm" variant="ghost" aria-label={t("moreActions", { establishment: item.name ?? NOT_PROVIDED })}>
                              <MoreHorizontal aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {hasRole(role, SURVEY_READ_ROLES) && <DropdownMenuItem asChild><Link href={`/admin/dossiers?vue=submissions&submissionsStatus=ALL&submissionsCompanyId=${encodeURIComponent(item.companyId)}`}>{t("declarationsLink")}</Link></DropdownMenuItem>}
                            {hasRole(role, USER_LIFECYCLE_ROLES) && !item.archivedAt && <DropdownMenuItem disabled={lifecycleMutation.isPending} onSelect={() => setAccountAction({ kind: item.status === "ACTIF" ? "suspend" : "activate", item })}>{t(item.status === "ACTIF" ? "suspendButton" : "activateButton")}</DropdownMenuItem>}
                            {hasRole(role, USER_ARCHIVE_ROLES) && !item.archivedAt && <DropdownMenuItem onSelect={() => setArchiveTarget(item)}>{t("archiveButton")}</DropdownMenuItem>}
                            {hasRole(role, USER_ARCHIVE_ROLES) && item.archivedAt && <DropdownMenuItem disabled={restoreMutation.isPending} onSelect={() => setAccountAction({ kind: "restore", item })}>{t("restoreButton")}</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
      </AdminTablePanel>

      {archiveTarget && <ArchiveActions
        archived={false}
        canManage={hasRole(role, USER_ARCHIVE_ROLES)}
        resourceName={archiveTarget.name ?? NOT_PROVIDED}
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
        id="establishment-account-action"
        title={t(`${accountAction.kind}ConfirmTitle`, { establishment: accountAction.item.name ?? NOT_PROVIDED })}
        body={t(`${accountAction.kind}ConfirmBody`)}
        cancelLabel={tRoot("common.cancel")}
        confirmLabel={t(`${accountAction.kind}Button`)}
        onCancel={() => setAccountAction(null)}
        onConfirm={runAccountAction}
      />}

    </div>
  );
}
