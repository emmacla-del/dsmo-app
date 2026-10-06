"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import {
  listCompanies,
  getCompanyStats,
  entityTypeLabel,
  type Company,
} from "@/lib/companies-directory";
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

const ENTITY_TYPES = [
  { value: "ALL", label: "Tous" },
  ...ENTITY_TYPE_VALUES.map((value) => ({ value, label: entityTypeLabel(value) })),
];

// Only states a linked account can actually be in, derived from User.status /
// User.isActive. "Incomplet" was offered but no record ever carries it, so
// that filter could only ever return nothing.
//
// ACTIVE and PENDING_APPROVAL are literal UserStatus values and go to the
// server as-is. SUSPENDED is not a UserStatus at all — suspension is
// User.isActive === false — so GET /companies has no way to express it and
// it stays a page-local narrowing. See SERVER_FILTERABLE_STATUSES.
const ACCOUNT_STATUSES = [
  { value: "ALL", label: "Tous" },
  { value: "ACTIVE", label: "Actif" },
  { value: "PENDING_APPROVAL", label: "En attente" },
  { value: "SUSPENDED", label: "Suspendu" },
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
  typeLabel: string | null;
  identifier: string | null;
  regionCity: string | null;
  responsable: string | null;
  dateInscription: string | null;
  status: "ACTIF" | "EN_ATTENTE" | "SUSPENDU" | "INCONNU";
}

const STATUS_LABELS: Record<EtabItem["status"], string> = {
  ACTIF: "Actif",
  EN_ATTENTE: "En attente",
  SUSPENDU: "Suspendu",
  INCONNU: "Aucun compte lié",
};

export default function EtablissementsPage() {
  const router = useRouter();
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  return (
    <div className="cam-admin-page" style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px 32px" }}>
      {/* Top Header matching Figma */}
      <AdminPageHeader
        breadcrumb={[{ label: "Déclarants" }, { label: "Établissements" }]}
        title="Établissements"
        subtitle="Registre des entités déclarantes et gestion des comptes"
        actions={<AdminHeaderActions showCampaignPill={false} showBell={false} showSearchInput={true} />}
      />

      {/* Page actions. The hand-made Inscriptions / Établissements / Annuaire
          pills that sat on the left are gone: the header's hub tabs carry
          the Déclarants navigation, and Annuaire moved to Administration. */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            type="button"
            onClick={exportCsv}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              background: "#ffffff",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              cursor: "pointer",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exporter
          </button>
          <button
            type="button"
            // Admin-assisted registration, inside the console. This used to
            // open the public /register self-signup, which left the console
            // and recorded no admin attribution (createdBy).
            onClick={() => router.push("/admin/inscriptions/nouvelle")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 18px",
              background: "#004d3d",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nouvelle inscription
          </button>
        </div>
      </div>

      {/* Register volume. Authoritative metrics sourced from GET /companies/stats. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280" }}>
            TOTAL ÉTABLISSEMENTS
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginTop: 8, lineHeight: 1 }}>
            {companyStatsQuery.isLoading || statsQuery.isLoading ? "…" : count(totalEtablissements)}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500, marginTop: 8 }}>
            Entités enregistrées au répertoire
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280" }}>
            COMPTES ACTIFS
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginTop: 8, lineHeight: 1 }}>
            {companyStatsQuery.isLoading ? "…" : count(companyStats?.active)}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500, marginTop: 8 }}>
            Comptes déclarants validés et actifs
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280" }}>
            EN ATTENTE DE VALIDATION
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginTop: 8, lineHeight: 1 }}>
            {companyStatsQuery.isLoading ? "…" : count(companyStats?.pendingValidation)}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500, marginTop: 8 }}>
            Dossiers soumis en attente d&apos;approbation
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280" }}>
            COMPTES SUSPENDUS
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginTop: 8, lineHeight: 1 }}>
            {companyStatsQuery.isLoading ? "…" : count(companyStats?.suspended)}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500, marginTop: 8 }}>
            Comptes désactivés ou suspendus
          </div>
        </div>
      </div>

      {/* Filter controls matching Figma */}
      <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1.2fr 1.6fr", gap: 14, alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em", marginBottom: 6 }}>
              TYPE D&apos;ÉTABLISSEMENT
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{ width: "100%", height: 38, border: "1px solid #d1d5db", borderRadius: 6, padding: "0 10px", fontSize: 13, color: "#111827", background: "#ffffff" }}
            >
              {ENTITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em", marginBottom: 6 }}>
              RÉGION
            </label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={{ width: "100%", height: 38, border: "1px solid #d1d5db", borderRadius: 6, padding: "0 10px", fontSize: 13, color: "#111827", background: "#ffffff" }}
            >
              {CAMEROON_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em", marginBottom: 6 }}>
              STATUT DU COMPTE
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ width: "100%", height: 38, border: "1px solid #d1d5db", borderRadius: 6, padding: "0 10px", fontSize: 13, color: "#111827", background: "#ffffff" }}
            >
              {ACCOUNT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em", marginBottom: 6 }}>
              RECHERCHE LIBRE
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input
                type="text"
                placeholder="Rechercher…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{ width: "100%", height: 38, border: "1px solid #d1d5db", borderRadius: 6, paddingLeft: 32, paddingRight: 10, fontSize: 13, color: "#111827", boxSizing: "border-box" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Directory Table matching Figma */}
      <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>
                <th scope="col" style={{ padding: "12px 12px", fontWeight: 600 }}>Établissement</th>
                <th scope="col" style={{ padding: "12px 12px", fontWeight: 600 }}>Identifiant</th>
                <th scope="col" style={{ padding: "12px 12px", fontWeight: 600 }}>Région / Ville</th>
                <th scope="col" style={{ padding: "12px 12px", fontWeight: 600 }}>Responsable</th>
                <th scope="col" style={{ padding: "12px 12px", fontWeight: 600 }}>Date d&apos;inscription</th>
                {/* "Créé par" removed: the Company model records no creator,
                    so the column could only ever be filled with a guess. */}
                <th scope="col" style={{ padding: "12px 12px", fontWeight: 600 }}>Statut du compte</th>
                <th scope="col" style={{ padding: "12px 12px", textAlign: "right", fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <DataStateRow
                colSpan={7}
                state={tableState}
                resource="le répertoire des établissements"
                error={companiesQuery.error}
                onRetry={() => companiesQuery.refetch()}
                title={tableState === "empty" ? "Aucun établissement trouvé" : undefined}
                hint={
                  tableState === "empty"
                    ? "Aucun établissement ne correspond à la recherche en cours."
                    : undefined
                }
              />
              {filteredRows.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: 13, height: 58 }}>
                  <td style={{ padding: "12px 12px", maxWidth: 260 }}>
                    <Link
                      href={`/admin/etablissement-detail?id=${encodeURIComponent(item.id)}`}
                      style={{ fontWeight: 600, color: "#111827", textDecoration: "none", display: "block" }}
                    >
                      {item.name ?? NOT_PROVIDED}
                    </Link>
                    {/* Entity type badge only when the record carries one. */}
                    {item.typeLabel && (
                      <div style={{ marginTop: 4 }}>
                        <span
                          style={{
                            fontSize: 10,
                            background: "rgba(0, 122, 94, 0.08)",
                            color: "#004d3d",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          {item.typeLabel}
                        </span>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 12px", fontFamily: "ui-monospace, monospace", color: "#004d3d", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {item.identifier ?? NOT_PROVIDED}
                  </td>
                  <td style={{ padding: "12px 12px", color: "#475569", whiteSpace: "nowrap" }}>
                    {item.regionCity ?? NOT_PROVIDED}
                  </td>
                  <td style={{ padding: "12px 12px", fontWeight: 500, color: "#111827", whiteSpace: "nowrap" }}>
                    {item.responsable ?? NOT_PROVIDED}
                  </td>
                  <td style={{ padding: "12px 12px", color: "#475569", whiteSpace: "nowrap" }}>
                    {stamp(item.dateInscription, false)}
                  </td>
                  <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                    {item.status === "ACTIF" && (
                      <span style={{ fontSize: 11, background: "#1e6b3a", color: "#ffffff", padding: "4px 12px", borderRadius: 9999, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>
                        Actif
                      </span>
                    )}
                    {item.status === "EN_ATTENTE" && (
                      <span style={{ fontSize: 11, background: "#d97706", color: "#ffffff", padding: "4px 12px", borderRadius: 9999, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>
                        En attente
                      </span>
                    )}
                    {/* A company with no linked account is reported as such,
                        not folded into "suspendu". */}
                    {item.status === "INCONNU" && (
                      <span style={{ fontSize: 11, background: "#e2e8f0", color: "#475569", padding: "4px 12px", borderRadius: 9999, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
                        {STATUS_LABELS.INCONNU}
                      </span>
                    )}
                    {item.status === "SUSPENDU" && (
                      <span style={{ fontSize: 11, background: "#b91c1c", color: "#ffffff", padding: "4px 12px", borderRadius: 9999, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>
                        Suspendu
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 12px", textAlign: "right", position: "relative" }}>
                    <button
                      type="button"
                      aria-label="Actions"
                      onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#6b7280",
                        fontSize: 18,
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: "4px 8px",
                        letterSpacing: 2,
                      }}
                    >
                      ···
                    </button>
                    {openMenuId === item.id && (
                      <div
                        style={{
                          position: "absolute",
                          right: 16,
                          top: 45,
                          zIndex: 50,
                          background: "#ffffff",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                          padding: "6px 0",
                          minWidth: 170,
                          textAlign: "left",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            router.push(`/admin/etablissement-detail?id=${encodeURIComponent(item.id)}`);
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "8px 14px",
                            fontSize: 13,
                            color: "#111827",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Voir les détails
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            router.push(`/admin/etablissement-detail/approbation?id=${encodeURIComponent(item.id)}`);
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "8px 14px",
                            fontSize: 13,
                            color: "#111827",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Validation du compte
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            router.push(`/admin/etablissement-detail?id=${encodeURIComponent(item.id)}&manage=true`);
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "8px 14px",
                            fontSize: 13,
                            color: "#111827",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Gérer les utilisateurs
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table pagination footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
          <span style={{ color: "#6b7280" }}>
            {companiesQuery.isLoading
              ? "…"
              : localNarrowing
                ? `${filteredRows.length} sur ${rawRows.length} établissement(s) de cette page (type / suspendu filtrés localement)`
                : filteredTotal === null
                  ? NOT_PROVIDED
                  : `Affichage ${rangeFrom}-${rangeTo} sur ${count(filteredTotal)} établissement(s)`}
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                padding: "6px 14px",
                background: "#ffffff",
                border: `1px solid ${page <= 1 ? "#e5e7eb" : "#d1d5db"}`,
                borderRadius: 6,
                fontSize: 13,
                color: page <= 1 ? "#9ca3af" : "#374151",
                cursor: page <= 1 ? "not-allowed" : "pointer",
              }}
            >
              Précédent
            </button>
            {pageWindow.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === page ? "page" : undefined}
                style={{
                  width: 32,
                  height: 32,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: n === page ? "#004d3d" : "#ffffff",
                  color: n === page ? "#ffffff" : "#374151",
                  border: n === page ? "none" : "1px solid #d1d5db",
                  borderRadius: 6,
                  fontWeight: n === page ? 600 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{
                padding: "6px 14px",
                background: "#ffffff",
                border: `1px solid ${page >= totalPages ? "#e5e7eb" : "#d1d5db"}`,
                borderRadius: 6,
                fontSize: 13,
                color: page >= totalPages ? "#9ca3af" : "#374151",
                cursor: page >= totalPages ? "not-allowed" : "pointer",
                fontWeight: 500,
              }}
            >
              Suivant
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
