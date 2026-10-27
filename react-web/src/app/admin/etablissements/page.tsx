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
import { DIRECTORY_READ_ROLES, isReadOnlyRole } from "@/lib/roles";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatStrip } from "@/components/admin/StatStrip";
import { DataStateRow } from "@/components/admin/DataState";
import {
  NOT_PROVIDED,
  count,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";
import { useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { FilterTableHead, FilterTableOptions } from "@/components/admin/FilterTableHead";
import { YEAR_MIN } from "@/lib/pilotage-targets";
import { doualaIsoDate, doualaYear } from "@/lib/douala-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
 * entityTypeLabel() helper so this list and the row badges can never
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
// ACTIVE and PENDING_APPROVAL are literal UserStatus values and go to the
// server as-is. SUSPENDED is not a UserStatus at all — suspension is
// User.isActive === false — so GET /companies has no way to express it and
// it stays a page-local narrowing. See SERVER_FILTERABLE_STATUSES.
// `labelKey` is under adminEtablissementsPage.
const ACCOUNT_STATUSES = [
  { value: "ALL", labelKey: "allMasculine" },
  { value: "ACTIVE", labelKey: "status.ACTIF" },
  { value: "PENDING_APPROVAL", labelKey: "status.EN_ATTENTE" },
  { value: "SUSPENDED", labelKey: "status.SUSPENDU" },
];

const SERVER_FILTERABLE_STATUSES = ["ACTIVE", "PENDING_APPROVAL"];

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
  regionCity: string | null;
  responsable: string | null;
  dateInscription: string | null;
  year: number | null;
  semester: Semester | null;
  quarter: Quarter | null;
  status: "ACTIF" | "EN_ATTENTE" | "SUSPENDU" | "INCONNU";
}

// French status values for the CSV export. On screen the status renders
// through adminEtablissementsPage.status.<code>.
const STATUS_LABELS: Record<EtabItem["status"], string> = {
  ACTIF: "Actif",
  EN_ATTENTE: "En attente",
  SUSPENDU: "Suspendu",
  INCONNU: "Aucun compte lié",
};

// The derived account state decides the badge tone. A company with no linked
// account is neutral, not folded into "suspendu".
const STATUS_TONE: Record<EtabItem["status"], "success" | "warning" | "danger" | "neutral"> = {
  ACTIF: "success",
  EN_ATTENTE: "warning",
  SUSPENDU: "danger",
  INCONNU: "neutral",
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
    regionCity: [c.region, c.department ?? c.subdivision].filter(Boolean).join(" / ") || null,
    responsable:
      [c.respondentFirstName, c.respondentLastName].filter(Boolean).join(" ").trim() ||
      c.user?.email ||
      null,
    dateInscription: c.createdAt ?? null,
    ...registrationPeriod(c.createdAt),
    // Derived from the linked account's own stored state. A company with no
    // linked account yields "INCONNU" rather than being called suspended.
    status: !c.user
      ? "INCONNU"
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
          cell(r.regionCity),
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
        tabs={[
          { label: tRoot("adminInscriptionsPage.viewQueue"), href: "/admin/inscriptions" },
          { label: tRoot("adminInscriptionsPage.viewCoverage"), href: "/admin/inscriptions?vue=coverage" },
          { label: tRoot("adminNav.routes.etablissements"), href: "/admin/etablissements", isActive: true },
        ]}
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

      <StatStrip
        label={tStats("keyFigures")}
        loadingLabel={tStats("loadingFigures")}
        loading={volume.some((k) => k.loading)}
        error={companyStatsQuery.isError || statsQuery.isError}
        errorLabel={tStats("figuresUnavailable")}
        items={volume.map((k) => ({ key: k.key, value: count(k.value, locale), label: k.label, hint: k.hint }))}
      />

      <Card>

        <CardContent className="border-t pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <FilterTableHead
                  label={t("establishmentColumn")}
                  filterLabel={t("filterColumn", { column: t("establishmentColumn") })}
                  active={!!searchInput.trim() || selectedType !== "ALL"}
                  contentClassName="w-72 p-3"
                >
                  {(close) => (
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="etab-search">{t("searchLabel")}</Label>
                        <Input
                          id="etab-search"
                          value={searchInput}
                          onChange={(event) => setSearchInput(event.target.value)}
                          placeholder={t("searchPlaceholder")}
                          onKeyDown={(event) => { if (event.key === "Enter") close(); }}
                        />
                      </div>
                      <div className="border-t pt-2">
                        <FilterTableOptions
                          label={t("typeFilterLabel")}
                          value={selectedType}
                          onChange={setSelectedType}
                          onSelect={close}
                          options={[
                            { value: "ALL", label: t("allMasculine") },
                            ...ENTITY_TYPE_VALUES.map((value) => ({ value, label: typeDisplay(value) })),
                          ]}
                        />
                      </div>
                    </div>
                  )}
                </FilterTableHead>
                <TableHead scope="col">{t("idColumn")}</TableHead>
                <FilterTableHead
                  label={t("regionCityColumn")}
                  filterLabel={t("filterColumn", { column: t("regionCityColumn") })}
                  active={selectedRegion !== "Toutes"}
                >
                  {(close) => (
                    <FilterTableOptions
                      label={t("regionFilterLabel")}
                      value={selectedRegion}
                      onChange={setSelectedRegion}
                      onSelect={close}
                      options={CAMEROON_REGIONS.map((region) => ({
                        value: region,
                        label: region === "Toutes" ? t("allRegions") : region,
                      }))}
                    />
                  )}
                </FilterTableHead>
                <TableHead scope="col">{t("contactColumn")}</TableHead>
                <FilterTableHead
                  label={t("registrationDateColumn")}
                  filterLabel={t("filterColumn", { column: t("registrationDateColumn") })}
                  active={sortOrder !== "newest"}
                >
                  {(close) => (
                    <FilterTableOptions
                      label={tRoot("adminDossiersPage.sortLabel")}
                      value={sortOrder}
                      onChange={(value) => {
                        setSortOrder(value === "oldest" ? "oldest" : "newest");
                        setPage(1);
                      }}
                      onSelect={close}
                      options={[
                        { value: "newest", label: tRoot("adminDossiersPage.sortNewest") },
                        { value: "oldest", label: tRoot("adminDossiersPage.sortOldest") },
                      ]}
                    />
                  )}
                </FilterTableHead>
                <FilterTableHead
                  label={t("yearColumn")}
                  filterLabel={t("filterColumn", { column: t("yearColumn") })}
                  active={periodYear != null}
                  centered
                >
                  {(close) => (
                    <FilterTableOptions
                      label={t("yearColumn")}
                      value={periodYear == null ? "all" : String(periodYear)}
                      onChange={(value) => {
                        setPeriodYear(value === "all" ? null : Number(value));
                        setPage(1);
                      }}
                      onSelect={close}
                      options={[
                        { value: "all", label: t("allYears") },
                        ...yearOptions.map((year) => ({ value: String(year), label: String(year) })),
                      ]}
                    />
                  )}
                </FilterTableHead>
                <FilterTableHead
                  label={t("semesterColumn")}
                  filterLabel={t("filterColumn", { column: t("semesterColumn") })}
                  active={periodSemester != null}
                  centered
                >
                  {(close) => (
                    <FilterTableOptions
                      label={t("semesterColumn")}
                      value={periodSemester == null ? "all" : String(periodSemester)}
                      onChange={(value) => {
                        setPeriodSemester(value === "all" ? null : value === "1" ? 1 : 2);
                        setPeriodQuarter(null);
                        setPage(1);
                      }}
                      onSelect={close}
                      options={[
                        { value: "all", label: t("allSemesters") },
                        { value: "1", label: "S1" },
                        { value: "2", label: "S2" },
                      ]}
                    />
                  )}
                </FilterTableHead>
                <FilterTableHead
                  label={t("quarterColumn")}
                  filterLabel={t("filterColumn", { column: t("quarterColumn") })}
                  active={periodQuarter != null}
                  centered
                >
                  {(close) => (
                    <FilterTableOptions
                      label={t("quarterColumn")}
                      value={periodQuarter == null ? "all" : String(periodQuarter)}
                      onChange={(value) => {
                        setPeriodQuarter(value === "all" ? null : Number(value) as Quarter);
                        setPage(1);
                      }}
                      onSelect={close}
                      options={[
                        { value: "all", label: t("allQuarters") },
                        ...quarterOptions.map((quarter) => ({ value: String(quarter), label: `Q${quarter}` })),
                      ]}
                    />
                  )}
                </FilterTableHead>
                {/* "Créé par" removed: the Company model records no creator,
                    so the column could only ever be filled with a guess. */}
                <FilterTableHead
                  label={t("accountStatusColumn")}
                  filterLabel={t("filterColumn", { column: t("accountStatusColumn") })}
                  active={selectedStatus !== "ALL"}
                >
                  {(close) => (
                    <FilterTableOptions
                      label={t("statusFilterLabel")}
                      value={selectedStatus}
                      onChange={setSelectedStatus}
                      onSelect={close}
                      options={ACCOUNT_STATUSES.map((status) => ({ value: status.value, label: t(status.labelKey) }))}
                    />
                  )}
                </FilterTableHead>
                <TableHead scope="col" className="text-right">{t("actionsColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <DataStateRow
                colSpan={10}
                state={tableState}
                resource={t("registerResource")}
                error={companiesQuery.error}
                onRetry={() => companiesQuery.refetch()}
                title={tableState === "empty" ? t("noEstablishmentTitle") : undefined}
                hint={tableState === "empty" ? t("noEstablishmentHint") : undefined}
              />
              {filteredRows.map((item) => {
                const detailHref = `/admin/etablissement-detail?id=${encodeURIComponent(item.id)}`;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-[260px]">
                      <Button asChild variant="link" size="sm" className="block h-auto px-0 py-0 text-left">
                        <Link href={detailHref}>{item.name ?? NOT_PROVIDED}</Link>
                      </Button>
                      {/* Entity type badge only when the record carries one. */}
                      {item.type && item.typeLabel && (
                        <Badge variant="neutral">{typeDisplay(item.type)}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="cam-admin-code font-medium text-foreground">{item.identifier ?? NOT_PROVIDED}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{item.regionCity ?? NOT_PROVIDED}</TableCell>
                    <TableCell className="whitespace-nowrap">{item.responsable ?? NOT_PROVIDED}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {stamp(item.dateInscription, true, locale)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{item.year ?? NOT_PROVIDED}</TableCell>
                    <TableCell className="text-center tabular-nums">{item.semester == null ? NOT_PROVIDED : `S${item.semester}`}</TableCell>
                    <TableCell className="text-center tabular-nums">{item.quarter == null ? NOT_PROVIDED : `Q${item.quarter}`}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_TONE[item.status]}>{t(`status.${item.status}`)}</Badge>
                    </TableCell>
                    {/* Two plain links. They replace a "···" popover that had no
                        menu role, no Escape, no outside-click close and no focus
                        handling. */}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-3 whitespace-nowrap">
                        <Button asChild variant="link" size="sm" className="h-auto px-0">
                          <Link href={detailHref}>{t("viewDetails")}</Link>
                        </Button>
                        {!readOnly && (
                          <Button asChild variant="link" size="sm" className="h-auto px-0">
                            <Link href={`${detailHref}&manage=true`}>{t("manageUsers")}</Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
