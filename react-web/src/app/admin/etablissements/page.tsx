"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Download, Plus } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import {
  ENTITY_TYPE_OPTION_KEYS,
  listCompanies,
  getCompanyStats,
  entityTypeLabel,
  type Company,
} from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { getDataManagementStats } from "@/lib/api-client";
import { APPROVAL_ROLES, DIRECTORY_READ_ROLES, isReadOnlyRole } from "@/lib/roles";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { RegistrationsHubTabs } from "@/components/admin/RegistrationsHubTabs";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { AdminFilterDisclosure } from "@/components/admin/AdminFilterDisclosure";
import { StatStrip } from "@/components/admin/StatStrip";
import { DataStateRow } from "@/components/admin/DataState";
import {
  NOT_PROVIDED,
  count,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";
import { useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { YEAR_MIN } from "@/lib/pilotage-targets";
import { doualaIsoDate, doualaYear } from "@/lib/douala-date";
import { Button } from "@/components/ui/button";
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
// ACTIVE, PENDING_APPROVAL and REJECTED are literal UserStatus values and go
// to the server as-is. SUSPENDED is not a UserStatus at all — suspension is
// User.isActive === false — so GET /companies has no way to express it and
// it stays a page-local narrowing. See SERVER_FILTERABLE_STATUSES.
// `labelKey` is under adminEtablissementsPage.
const ACCOUNT_STATUSES = [
  { value: "ALL", labelKey: "allMasculine" },
  { value: "ACTIVE", labelKey: "status.ACTIF" },
  { value: "PENDING_APPROVAL", labelKey: "status.EN_ATTENTE" },
  { value: "REJECTED", labelKey: "status.REJETE" },
  { value: "SUSPENDED", labelKey: "status.SUSPENDU" },
];

const SERVER_FILTERABLE_STATUSES = ["ACTIVE", "PENDING_APPROVAL", "REJECTED"];

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
  const router = useRouter();
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

  const { regions: territoryRegions } = useTerritoryRegions();
  const CAMEROON_REGIONS: string[] = useMemo(() => ["Toutes", ...territoryRegions], [territoryRegions]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedRegion, setSelectedRegion] = useState("Toutes");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest">("newest");
  const [periodYear, setPeriodYear] = useState<number | null>(null);
  const [periodSemester, setPeriodSemester] = useState<Semester | null>(null);
  const [periodQuarter, setPeriodQuarter] = useState<Quarter | null>(null);
  const [page, setPage] = useState(1);
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

  // Region and status are server-side filters now, so they share the search
  // box's 300ms debounce: one timer, one refetch, and the three controls can
  // never queue three separate requests between keystrokes.
  const [appliedRegion, setAppliedRegion] = useState("Toutes");
  const [appliedStatus, setAppliedStatus] = useState("ALL");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setAppliedRegion(selectedRegion);
      setAppliedStatus(selectedStatus);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, selectedRegion, selectedStatus]);

  const statsQuery = useQuery({
    queryKey: ["admin", "data-management", "stats"],
    queryFn: getDataManagementStats,
  });

  const companyStatsQuery = useQuery({
    queryKey: ["dsmo", "companies", "stats"],
    queryFn: getCompanyStats,
    enabled: canRead,
  });

  // Sent to GET /companies, which filters and counts over the whole
  // territory-scoped register rather than over the page already fetched.
  const serverStatus = SERVER_FILTERABLE_STATUSES.includes(appliedStatus) ? appliedStatus : undefined;
  const serverRegion = appliedRegion !== "Toutes" ? appliedRegion : undefined;

  const companiesQuery = useQuery({
    queryKey: ["dsmo", "companies", search, serverStatus ?? "ALL", serverRegion ?? "ALL", sortOrder, periodYear, periodSemester, periodQuarter, page],
    queryFn: () =>
      listCompanies({
        search: search || undefined,
        status: serverStatus,
        region: serverRegion,
        sortOrder,
        year: periodYear ?? undefined,
        semester: periodSemester ?? undefined,
        quarter: periodQuarter ?? undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: canRead,
  });

  const stats = statsQuery.data;
  const companyStats = companyStatsQuery.data;

  /**
   * Total establishments.
   * Sourced directly from GET /companies/stats (or GET /data-management/stats).
   */
  const totalEtablissements = companyStats?.total ?? stats?.totals?.companies ?? stats?.totalCompanies ?? null;

  const rawRows: Company[] = companiesQuery.data?.companies ?? [];

  // Real rows only. Fields the record does not carry stay null.
  const displayRows: EtabItem[] = rawRows.map((c) => ({
    id: c.establishmentId || c.id,
    companyId: c.id,
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
    ...registrationPeriod(c.createdAt),
    // Derived from the linked account's own stored state. A company with no
    // linked account yields "INCONNU" rather than being called suspended.
    status: !c.user
      ? "INCONNU"
      : c.user.status === "REJECTED"
        ? "REJETE"
        : c.user.status === "PENDING_APPROVAL"
        ? "EN_ATTENTE"
        : c.user.isActive
          ? "ACTIF"
          : "SUSPENDU",
  }));

  /**
   * What is left for the client to narrow, now that search / region / status
   * are applied and counted server-side.
   *
   * Two dimensions GET /companies cannot express:
   *  - entity type: the endpoint takes no entityType param;
   *  - "Suspendu": suspension is User.isActive === false, and the endpoint's
   *    `status` param filters User.status, which has no SUSPENDED member.
   *
   * Both therefore narrow the *current page* only. `localNarrowing` is true
   * whenever one is active, and the footer then stops claiming a server
   * total it is no longer describing.
   */
  const localNarrowing = selectedType !== "ALL" || appliedStatus === "SUSPENDED";

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

  // A short window around the current page: a register of several thousand
  // establishments must not render several hundred buttons.
  const pageWindow: number[] = (() => {
    const span = 3;
    let start = Math.max(1, page - Math.floor(span / 2));
    const end = Math.min(totalPages, start + span - 1);
    start = Math.max(1, end - span + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  })();

  const filteredRows = displayRows.filter((item) => {
    if (selectedType !== "ALL" && item.type !== selectedType) return false;
    if (appliedStatus === "SUSPENDED" && item.status !== "SUSPENDU") return false;
    return true;
  });

  const tableState = resolveDataState({
    roleAllowed: canRead,
    isLoading: companiesQuery.isLoading,
    isError: companiesQuery.isError,
    error: companiesQuery.error,
    rowCount: companiesQuery.data ? filteredRows.length : null,
  });

  const hasActiveAdvancedFilters =
    periodYear != null ||
    periodSemester != null ||
    periodQuarter != null ||
    selectedStatus !== "ALL" ||
    sortOrder !== "newest";

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
    { key: "total", label: t("kpiTotal"), loading: companyStatsQuery.isLoading || statsQuery.isLoading, value: totalEtablissements, hint: t("kpiTotalHint") },
    { key: "active", label: t("kpiActive"), loading: companyStatsQuery.isLoading, value: companyStats?.active, hint: t("kpiActiveHint") },
    { key: "pending", label: t("kpiPending"), loading: companyStatsQuery.isLoading, value: companyStats?.pendingValidation, hint: t("kpiPendingHint") },
    { key: "suspended", label: t("kpiSuspended"), loading: companyStatsQuery.isLoading, value: companyStats?.suspended, hint: t("kpiSuspendedHint") },
  ];

  return (
    <div className="cam-admin-page">
      {/* Page actions sit in the header; this destination is the establishment
          register under its own navigation group. Annuaire moved to
          Administration. */}
      {/* The same single tab bar as /admin/inscriptions, so the two pages of
          this hub read as one place with three destinations rather than two
          screens each restating where they are. */}
      <AdminPageHeader
        title={tRoot("adminNav.hubs.inscriptions")}
        subtitle={t("subtitle")}
        hideTabs
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
      <RegistrationsHubTabs activeTab="register" canReviewRegistrations={!!role && APPROVAL_ROLES.includes(role)} />

      <StatStrip
        label={tStats("keyFigures")}
        loadingLabel={tStats("loadingFigures")}
        loading={volume.some((k) => k.loading)}
        error={companyStatsQuery.isError || statsQuery.isError}
        errorLabel={tStats("figuresUnavailable")}
        items={volume.map((k) => ({ key: k.key, value: count(k.value, locale), label: k.label, hint: k.hint }))}
      />

      <AdminTablePanel
        title={t("registerResource")}
        description={t("scopeNote")}
        headingId="establishments-register-title"
        meta={tableState === "ready" ? count(filteredRows.length, locale) : NOT_PROVIDED}
        toolbar={
          <div className="grid gap-3 md:grid-cols-5">
            <div className="md:col-span-2">
              <Label htmlFor="etab-search">{t("searchLabel")}</Label>
              <Input
                id="etab-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("searchPlaceholder")}
              />
            </div>
            <div>
              <Label htmlFor="etab-type">{tRoot("companiesDirectory.typeColumn")}</Label>
              <select
                id="etab-type"
                className="cam-admin-input w-full"
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value)}
              >
                <option value="ALL">{t("allMasculine")}</option>
                {ENTITY_TYPE_VALUES.map((value) => (
                  <option key={value} value={value}>{typeDisplay(value)}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="etab-region">{tRoot("companiesDirectory.regionColumn")}</Label>
              <select
                id="etab-region"
                className="cam-admin-input w-full"
                value={selectedRegion}
                onChange={(event) => setSelectedRegion(event.target.value)}
              >
                {CAMEROON_REGIONS.map((region) => (
                  <option key={region} value={region}>{region === "Toutes" ? t("allRegions") : region}</option>
                ))}
              </select>
            </div>
            <AdminFilterDisclosure label={t("moreFilters")} active={hasActiveAdvancedFilters}>
              <div>
                <Label htmlFor="etab-year">{t("yearColumn")}</Label>
                <select
                  id="etab-year"
                  className="cam-admin-input w-full"
                  value={periodYear == null ? "all" : String(periodYear)}
                  onChange={(event) => {
                    setPeriodYear(event.target.value === "all" ? null : Number(event.target.value));
                    setPage(1);
                  }}
                >
                  <option value="all">{t("allYears")}</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={String(year)}>{year}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="etab-semester">{t("semesterColumn")}</Label>
                <select
                  id="etab-semester"
                  className="cam-admin-input w-full"
                  value={periodSemester == null ? "all" : String(periodSemester)}
                  onChange={(event) => {
                    setPeriodSemester(event.target.value === "all" ? null : event.target.value === "1" ? 1 : 2);
                    setPeriodQuarter(null);
                    setPage(1);
                  }}
                >
                  <option value="all">{t("allSemesters")}</option>
                  <option value="1">S1</option>
                  <option value="2">S2</option>
                </select>
              </div>
              <div>
                <Label htmlFor="etab-quarter">{t("quarterColumn")}</Label>
                <select
                  id="etab-quarter"
                  className="cam-admin-input w-full"
                  value={periodQuarter == null ? "all" : String(periodQuarter)}
                  onChange={(event) => {
                    setPeriodQuarter(event.target.value === "all" ? null : Number(event.target.value) as Quarter);
                    setPage(1);
                  }}
                >
                  <option value="all">{t("allQuarters")}</option>
                  {quarterOptions.map((quarter) => (
                    <option key={quarter} value={String(quarter)}>Q{quarter}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="etab-status">{t("statusFilterLabel")}</Label>
                <select
                  id="etab-status"
                  className="cam-admin-input w-full"
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                >
                  {ACCOUNT_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>{t(status.labelKey)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="etab-sort">{tRoot("adminDossiersPage.sortLabel")}</Label>
                <select
                  id="etab-sort"
                  className="cam-admin-input w-full"
                  value={sortOrder}
                  onChange={(event) => {
                    setSortOrder(event.target.value === "oldest" ? "oldest" : "newest");
                    setPage(1);
                  }}
                >
                  <option value="newest">{tRoot("adminDossiersPage.sortNewest")}</option>
                  <option value="oldest">{tRoot("adminDossiersPage.sortOldest")}</option>
                </select>
              </div>
            </AdminFilterDisclosure>
          </div>
        }
      >
          <Table className="w-full min-w-[880px] table-fixed">
            <colgroup>
              {[225, 110, 165, 145, 135, 100].map((width, index) => (
                <col key={`etab-column-${index}`} style={{ width }} />
              ))}
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t("establishmentColumn")}</TableHead>
                <TableHead scope="col">{tRoot("companiesDirectory.typeColumn")}</TableHead>
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
                const detailHref = detailIdentifier ? `/admin/etablissement-detail?id=${encodeURIComponent(detailIdentifier)}` : null;
                const territory = [item.region, item.department, item.subdivision].filter(Boolean).join(" / ") || NOT_PROVIDED;
                const contactDisplay = item.responsable ?? item.contactEmail ?? item.contactPhone ?? NOT_PROVIDED;
                const contactTitle = Array.from(new Set(
                  [item.responsable, item.contactEmail, item.contactPhone].filter((value): value is string => Boolean(value)),
                )).join(" · ") || NOT_PROVIDED;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="align-top whitespace-normal py-3">
                      <span className="block truncate font-medium text-foreground" title={item.name ?? NOT_PROVIDED}>
                        {item.name ?? NOT_PROVIDED}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground" title={item.identifier ?? NOT_PROVIDED}>
                        {item.identifier ?? NOT_PROVIDED}
                      </span>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal py-3">
                      <span className="block truncate" title={item.type ? typeDisplay(item.type) : NOT_PROVIDED}>
                        {item.type ? typeDisplay(item.type) : NOT_PROVIDED}
                      </span>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal py-3">
                      <span className="block truncate" title={territory}>{territory}</span>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal py-3">
                      <span className="block truncate" title={contactTitle}>{contactDisplay}</span>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal py-3">
                      <span className="whitespace-nowrap text-muted-foreground">{stamp(item.dateInscription, true, locale)}</span>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal py-3 text-right">
                      {detailHref ? (
                        <Button asChild variant="link" size="sm" className="h-auto px-0">
                          <Link href={detailHref}>{t("viewDetails")}</Link>
                        </Button>
                      ) : (
                        <span aria-disabled="true" className="text-sm text-muted-foreground">{t("viewDetails")}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
      </AdminTablePanel>

      {/* Pager figures, all from the response GET /companies returned. The
          current page is text, not a button: it is where the reader already is. */}
      <div className="flex flex-wrap items-center justify-end gap-2 py-4 text-sm text-muted-foreground">
        <span className="me-2">
          {companiesQuery.isLoading
            ? NOT_PROVIDED
            : localNarrowing
              ? t("localNarrowing", { shown: count(filteredRows.length, locale), page: count(rawRows.length, locale) })
              : filteredTotal === null
                ? NOT_PROVIDED
                : t("showingRange", { from: count(rangeFrom, locale), to: count(rangeTo, locale), total: count(filteredTotal, locale) })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          {t("previousButton")}
        </Button>
        {pageWindow.map((n) =>
          n === page ? (
            <span key={n} aria-current="page" className="px-2 font-medium text-foreground">{count(n, locale)}</span>
          ) : (
            <Button key={n} type="button" variant="outline" size="sm" onClick={() => setPage(n)}>
              {count(n, locale)}
            </Button>
          ),
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          {t("nextButton")}
        </Button>
      </div>
    </div>
  );
}
