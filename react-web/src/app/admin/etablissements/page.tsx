"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
import { DIRECTORY_ROLES } from "@/lib/roles";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { DataStateRow } from "@/components/admin/DataState";
import {
  NOT_PROVIDED,
  count,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";
import { useTerritoryRegions } from "@/hooks/useTerritoryStructure";

const PAGE_SIZE = 8;

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

// The derived account state decides the badge class. A company with no linked
// account is neutral, not folded into "suspendu".
const STATUS_BADGE: Record<EtabItem["status"], string> = {
  ACTIF: "cam-badge-success",
  EN_ATTENTE: "cam-badge-warning",
  SUSPENDU: "cam-badge-error",
  INCONNU: "cam-badge-neutral",
};

export default function EtablissementsPage() {
  const router = useRouter();
  const tRoot = useTranslations();
  const t = useTranslations("adminEtablissementsPage");
  const locale = asUiLocale(useLocale());
  const typeDisplay = (type: string) =>
    ENTITY_TYPE_OPTION_KEYS[type] ? tRoot(ENTITY_TYPE_OPTION_KEYS[type]) : entityTypeLabel(type);
  const role = useAuthStore((s) => s.user?.role);
  // Fails closed: an unknown or not-yet-loaded role is not authorised. The
  // previous `!role ||` made a missing role read as permitted.
  const canRead = !!role && DIRECTORY_ROLES.includes(role);

  const { regions: territoryRegions } = useTerritoryRegions();
  const CAMEROON_REGIONS: string[] = useMemo(() => ["Toutes", ...territoryRegions], [territoryRegions]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedRegion, setSelectedRegion] = useState("Toutes");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [page, setPage] = useState(1);

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
    queryKey: ["dsmo", "companies", search, serverStatus ?? "ALL", serverRegion ?? "ALL", page],
    queryFn: () =>
      listCompanies({
        search: search || undefined,
        status: serverStatus,
        region: serverRegion,
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
    const headers = ["Nom", "Identifiant", "Type", "Région / Ville", "Responsable", "Date d'inscription", "Statut"];
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
          cell(r.dateInscription ? stamp(r.dateInscription, false) : null),
          cell(STATUS_LABELS[r.status]),
        ].join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
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
      {/* Page actions sit in the header. The hand-made Inscriptions /
          Établissements / Annuaire pills are gone: the header's hub tabs
          carry the Déclarants navigation, and Annuaire moved to
          Administration. */}
      <AdminPageHeader
        breadcrumb={[{ label: tRoot("adminNav.hubs.declarants") }, { label: tRoot("adminNav.routes.etablissements") }]}
        title={tRoot("adminNav.routes.etablissements")}
        subtitle={t("subtitle")}
        actions={
          <div style={{ display: "flex", gap: "var(--cam-space-2)", alignItems: "center", flexWrap: "wrap" }}>
            <AdminHeaderActions showCampaignPill={false} showBell={false} showSearchInput={true} />
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={exportCsv}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ marginRight: "var(--cam-space-1)" }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {t("exportButton")}
            </button>
            <button
              type="button"
              className="cam-button cam-button-primary cam-button-sm"
              // Admin-assisted registration, inside the console. This used to
              // open the public /register self-signup, which left the console
              // and recorded no admin attribution (createdBy).
              onClick={() => router.push("/admin/inscriptions/nouvelle")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: "var(--cam-space-1)" }}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {tRoot("adminNav.routes.nouvelleInscription")}
            </button>
          </div>
        }
      />

      <div className="cam-pilot-kpis" style={{ marginBottom: 0 }}>
        {volume.map((k) => (
          <div key={k.key} className="cam-pilot-kpi">
            <span className="cam-pilot-kpi-label">{k.label}</span>
            <span className="cam-pilot-kpi-value" aria-busy={k.loading || undefined}>
              {k.loading ? NOT_PROVIDED : count(k.value, locale)}
            </span>
            <span className="cam-pilot-kpi-trend">{k.hint}</span>
          </div>
        ))}
      </div>

      <section className="cam-admin-section">
        <div className="cam-admin-section-body">
          <div className="cam-admin-filters">
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="etab-type">{t("typeFilterLabel")}</label>
              <select id="etab-type" className="cam-select" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                <option value="ALL">{t("allMasculine")}</option>
                {ENTITY_TYPE_VALUES.map((value) => <option key={value} value={value}>{typeDisplay(value)}</option>)}
              </select>
            </div>
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="etab-region">{t("regionFilterLabel")}</label>
              <select id="etab-region" className="cam-select" value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}>
                {CAMEROON_REGIONS.map((r) => <option key={r} value={r}>{r === "Toutes" ? t("allRegions") : r}</option>)}
              </select>
            </div>
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="etab-status">{t("statusFilterLabel")}</label>
              <select id="etab-status" className="cam-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                {ACCOUNT_STATUSES.map((s) => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
              </select>
            </div>
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="etab-search">{t("searchLabel")}</label>
              <div className="cam-admin-search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  id="etab-search"
                  type="text"
                  className="cam-input"
                  placeholder={t("searchPlaceholder")}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="cam-table-wrapper">
        <table className="cam-table">
          <thead>
            <tr>
              <th scope="col">{t("establishmentColumn")}</th>
              <th scope="col">{t("idColumn")}</th>
              <th scope="col">{t("regionCityColumn")}</th>
              <th scope="col">{t("contactColumn")}</th>
              <th scope="col">{t("registrationDateColumn")}</th>
              {/* "Créé par" removed: the Company model records no creator,
                  so the column could only ever be filled with a guess. */}
              <th scope="col">{t("accountStatusColumn")}</th>
              <th scope="col" className="text-right">{t("actionsColumn")}</th>
            </tr>
          </thead>
          <tbody>
            <DataStateRow
              colSpan={7}
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
                <tr key={item.id}>
                  <td style={{ maxWidth: 260 }}>
                    <Link href={detailHref} className="cam-text-button" style={{ display: "block" }}>
                      {item.name ?? NOT_PROVIDED}
                    </Link>
                    {/* Entity type badge only when the record carries one. */}
                    {item.type && item.typeLabel && (
                      <span className="cam-badge cam-badge-neutral">{typeDisplay(item.type)}</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className="cam-admin-code cam-admin-strong">{item.identifier ?? NOT_PROVIDED}</span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{item.regionCity ?? NOT_PROVIDED}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{item.responsable ?? NOT_PROVIDED}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className="cam-admin-meta">{stamp(item.dateInscription, false, locale)}</span>
                  </td>
                  <td>
                    <span className={`cam-badge ${STATUS_BADGE[item.status]}`}>{t(`status.${item.status}`)}</span>
                  </td>
                  {/* Two plain links. They replace a "···" popover that had no
                      menu role, no Escape, no outside-click close and no focus
                      handling. */}
                  <td className="text-right">
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--cam-space-3)", whiteSpace: "nowrap" }}>
                      <Link href={detailHref} className="cam-text-button">{t("viewDetails")}</Link>
                      <Link href={`${detailHref}&manage=true`} className="cam-text-button">{t("manageUsers")}</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pager figures, all from the response GET /companies returned. The
          current page is text, not a button: it is where the reader already is. */}
      <div className="cam-pagination">
        <span className="cam-pagination-info">
          {companiesQuery.isLoading
            ? NOT_PROVIDED
            : localNarrowing
              ? t("localNarrowing", { shown: count(filteredRows.length, locale), page: count(rawRows.length, locale) })
              : filteredTotal === null
                ? NOT_PROVIDED
                : t("showingRange", { from: count(rangeFrom, locale), to: count(rangeTo, locale), total: count(filteredTotal, locale) })}
        </span>
        <button
          type="button"
          className="cam-pagination-btn"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          {t("previousButton")}
        </button>
        {pageWindow.map((n) =>
          n === page ? (
            <span key={n} className="cam-pagination-info" aria-current="page">{count(n, locale)}</span>
          ) : (
            <button key={n} type="button" className="cam-pagination-btn" onClick={() => setPage(n)}>
              {count(n, locale)}
            </button>
          ),
        )}
        <button
          type="button"
          className="cam-pagination-btn"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          {t("nextButton")}
        </button>
      </div>
    </div>
  );
}
