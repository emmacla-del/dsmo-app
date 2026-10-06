"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  API_BASE_URL,
  bulkVisaDeclarations,
  bulkRejectDeclarations,
  getPilotageQueues,
  getToken,
  listAdminQuestionnaires,
} from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { resolveEntityName } from "@/lib/onefop-entity-name";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataStateRow } from "@/components/admin/DataState";
import { useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import {
  NOT_PROVIDED,
  count,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";
import { NATIONAL_ROLES, hasRole } from "@/lib/roles";
import { hrefWith, parseDossierStatus, type DossierStatus } from "@/lib/admin-url";
import { ViewSwitch } from "@/components/admin/ViewSwitch";

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
  adminStatus: "PENDING_REVIEW" | "APPROVED" | "CORRECTION_REQUESTED" | "REJECTED" | null;
  blockingCount: number;
  warningCount: number;
  submittedAt: string | null;
}

const PAGE_SIZE = 10;

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
        : hasRole(user?.role, NATIONAL_ROLES)
          ? t("scopeNational")
          : t("scopeUnassigned");
  const { regions: territoryRegions } = useTerritoryRegions();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // The status filter is URL state (?status=): read here, written by
  // setStatus. Other parameters (?companyId=, ?formType=, ?q=) are kept.
  const statusFilter = parseDossierStatus(searchParams.get("status"));
  const companyIdFilter = searchParams.get("companyId") ?? "";
  // The header search box pushes /admin/dossiers?q=<query>, so `q` seeds the
  // search box on arrival instead of being dropped.
  const requestedQuery = searchParams.get("q") ?? "";
  // /admin/questionnaires links here with ?formType= ("Voir dossiers").
  const requestedFormType = searchParams.get("formType") ?? "";

  // searchInput is what the user types; search is what is sent, 300 ms after
  // the last keystroke (each request runs a multi-column contains query).
  const [searchInput, setSearchInput] = useState(requestedQuery);
  const [search, setSearch] = useState(requestedQuery.trim());
  const [regionFilter, setRegionFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState(FORM_TYPES.includes(requestedFormType) ? requestedFormType : "");
  const [periodFilter, setPeriodFilter] = useState("");
  const [offset, setOffset] = useState(0);

  // A status change from anywhere — this control, a pilotage tile, the
  // browser's back button — starts again at the first page.
  const [offsetStatus, setOffsetStatus] = useState(statusFilter);
  if (offsetStatus !== statusFilter) {
    setOffsetStatus(statusFilter);
    setOffset(0);
  }

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // A new ?q= (the header search box pushing while already on this page)
  // replaces the box contents. Both searchInput and `search` are set together
  // so the debounce effect below sees no pending change and stays quiet.
  useEffect(() => {
    setSearchInput(requestedQuery);
    setSearch(requestedQuery.trim());
    setOffset(0);
    setSelectedIds(new Set());
  }, [requestedQuery]);

  // Modal / Drawer state — bulk visa
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [certifiedBulk, setCertifiedBulk] = useState(false);
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkResult, setBulkResult] = useState<any | null>(null);

  // Modal state — bulk reject
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [certifiedReject, setCertifiedReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectResult, setRejectResult] = useState<any | null>(null);

  // TODO(backend, S): known limitation — CTD dossiers are searchable only by ID or respondent name (OnefopCtdDetail has no name column; server search no longer reads rawData)
  // TODO(design, S): what is "ASFOP" in the Figma's questionnaire types? Labels use entityTypeLabel until the domain answers (VOCATIONAL_TRAINING?)
  // Every filter is applied server-side (drafts excluded), so `total` is the
  // count of the filtered query and paging never hides matching rows.
  const questionnairesQuery = useQuery({
    queryKey: ["admin", "questionnaires", "list", { statusFilter, typeFilter, regionFilter, periodFilter, search, companyIdFilter, offset }],
    queryFn: () =>
      listAdminQuestionnaires({
        status: statusFilter || undefined,
        formType: typeFilter || undefined,
        period: periodFilter || undefined,
        region: regionFilter || undefined,
        search: search || undefined,
        companyId: companyIdFilter || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: keepPreviousData,
  });

  /**
   * Queue counters for the tab row. Source: GET /admin/questionnaires/
   * pilotage/queues, territory-scoped server-side. `null` until the server
   * answers — an unreachable queue is not an empty queue, so a tab badge shows
   * an em dash rather than a number the server never gave.
   */
  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues"],
    queryFn: getPilotageQueues,
  });
  const queues = queuesQuery.data ?? null;

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

  // A selection only means something for the rows currently shown — drop it
  // whenever the filters or the page change so the count never includes
  // hidden rows. Any filter change also returns to the first page.
  const changeFilter = (apply: () => void) => {
    apply();
    setOffset(0);
    setSelectedIds(new Set());
  };

  // Writes ?status=, keeping every other parameter. The list follows from the
  // URL (statusFilter above), so a reload reopens the same status.
  const setStatus = (status: DossierStatus | "") =>
    router.replace(hrefWith(pathname, searchParams.toString(), { status }));

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
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const page = questionnairesQuery.data;

  const rawItems = page?.items ?? [];
  // Real rows only. An empty result renders an empty state; there is no
  // sample dataset to substitute, and an error never becomes "no dossiers".
  const dossiers: DossierItem[] = rawItems.map((sub: any) => {
    const blockingCount = sub.anomalies?.filter((a: any) => a.isBlocking && a.status === "OPEN").length ?? 0;
    const warningCount = sub.anomalies?.filter((a: any) => !a.isBlocking && a.status === "OPEN").length ?? 0;
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
      blockingCount,
      warningCount,
      submittedAt: sub.submissionDate ?? null,
    };
  });

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

  const cleanPendingSelected = dossiers.filter(
    (d) => selectedIds.has(d.id) && d.adminStatus === "PENDING_REVIEW" && d.blockingCount === 0
  );

  const rejectableSelected = dossiers.filter(
    (d) => selectedIds.has(d.id) && (d.adminStatus === "PENDING_REVIEW" || d.adminStatus === "CORRECTION_REQUESTED")
  );

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(dossiers.map((d) => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

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

  const allShownSelected = dossiers.length > 0 && dossiers.every((d) => selectedIds.has(d.id));

  const [exportInProgress, setExportInProgress] = useState(false);

  async function handleExport(fmt: "csv" | "xlsx") {
    if (exportInProgress) return;
    setExportInProgress(true);
    try {
      const params = new URLSearchParams({ format: fmt });
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("formType", typeFilter);
      if (regionFilter) params.set("region", regionFilter);
      if (periodFilter) params.set("period", periodFilter);
      if (search) params.set("search", search);
      const token = getToken();
      const resp = await fetch(
        `${API_BASE_URL}/admin/questionnaires/export?${params.toString()}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
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

  return (
    <div className="cam-admin-page">
      {/* ── Page Header matching Figma supervision/dossiers.png ── */}
      <AdminPageHeader
        breadcrumb={[{ label: tRoot("adminNav.hubs.supervision") }, { label: tRoot("adminNav.routes.dossiers") }]}
        title={tRoot("adminNav.routes.dossiers")}
        subtitle={t("subtitle")}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* The actor's scope, stated — not a selector. It carried a
                chevron and a pointer cursor while doing nothing on click. */}
            <span
              style={{
                background: "#ffffff",
                border: "1px solid #111827",
                color: "#111827",
                padding: "4px 12px",
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {t("scopeChip", { scope: scopeLabel })}
            </span>
            <div style={{ position: "relative", width: 220 }}>
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{
                  width: "100%",
                  height: 32,
                  padding: "4px 10px 4px 30px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  background: "#ffffff",
                }}
              />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: 9 }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                overflow: "hidden",
                display: "flex",
                position: "relative",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.1)",
                flexShrink: 0,
              }}
            >
              <span style={{ flex: 1, background: "#007a5e" }} />
              <span style={{ flex: 1, background: "#b3261e", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#f0b429", fontSize: 9, lineHeight: 1, position: "absolute" }}>★</span>
              </span>
              <span style={{ flex: 1, background: "#f0b429" }} />
            </span>
          </div>
        }
      />

      {/* ── Status filter: one control, URL-backed (?status=) ── */}
      <ViewSwitch
        label={t("statusFilterAriaLabel")}
        items={STATUS_VIEWS.map((view) => ({
          key: view.status || "ALL",
          label: t(view.labelKey),
          active: statusFilter === view.status,
          count: queues ? (view.status ? queues.statusCounts[view.status] : queues.totalSubmissionsCount) : null,
          onClick: () => changeFilter(() => setStatus(view.status)),
        }))}
      />

      {/* The queue's own note, carried over from /admin/files-attente. Shown
          only for the status it describes. */}
      {STATUS_VIEWS.filter((view) => view.noteKey && view.status === statusFilter).map((view) => (
        <p
          key={view.labelKey}
          style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.45, color: "#6b7280", maxWidth: 820 }}
        >
          {view.noteKey && t(view.noteKey)}
        </p>
      ))}

      {/* ── 4-Column Filter Card. Statut left it: the control above sets it. ── */}
      <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 6 }}>
              {t("formTypeLabel")}
            </label>
            <select
              style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#ffffff", color: "#111827" }}
              value={typeFilter}
              onChange={(e) => changeFilter(() => setTypeFilter(e.target.value))}
            >
              <option value="">{t("allFormTypes")}</option>
              {FORM_TYPES.map((type) => (
                <option key={type} value={type}>{typeLabel(type)}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 6 }}>
              {t("regionLabel")}
            </label>
            <select
              style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#ffffff", color: "#111827" }}
              value={regionFilter}
              onChange={(e) => changeFilter(() => setRegionFilter(e.target.value))}
            >
              <option value="">{t("allRegions")}</option>
              {territoryRegions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 6 }}>
              {t("periodLabel")}
            </label>
            <select
              style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#ffffff", color: "#111827" }}
              value={periodFilter}
              onChange={(e) => changeFilter(() => setPeriodFilter(e.target.value))}
            >
              {/* "" is the default (see PERIODS): an option of its own, so the
                  select shows it. A hard-coded 30-day option stood here
                  instead — a duplicate of PERIODS' own — so the control read
                  "Derniers 30 jours" while every period was listed. */}
              <option value="">{t("allPeriods")}</option>
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{t(p.labelKey)}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 6 }}>
              {t("freeSearchLabel")}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="search"
                placeholder={t("freeSearchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 32px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  background: "#ffffff",
                  color: "#111827",
                }}
              />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: 10 }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ── Action Toolbar matching Figma ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={handleOpenBulkModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 6,
              background: "#007a5e",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            <span>✓</span> {t("endorseSelectionButton")}
          </button>
          <button
            type="button"
            onClick={handleOpenRejectModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 6,
              background: "#8b1e1b",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            <span>✕</span> {t("rejectSelectionButton")}
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleExport("csv")}
          disabled={exportInProgress}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 6,
            background: "#ffffff",
            border: "1px solid #d1d5db",
            color: "#374151",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t("exportButton")}
        </button>
      </div>

      {/* ── Table Section matching Figma ── */}
      <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#ffffff", fontSize: 12, color: "#6b7280" }}>
              <th style={{ width: 44, padding: "12px 14px", textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={allShownSelected}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  style={{ accentColor: "#007a5e", width: 16, height: 16, cursor: "pointer" }}
                />
              </th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>{t("formIdColumn")}</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>{t("respondentColumn")}</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>{t("organisationColumn")}</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>{t("typeColumn")}</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>{t("regionColumn")}</th>
              <th style={{ padding: "12px 14px", fontWeight: 600, textAlign: "center" }}>{t("endorsementColumn")}</th>
              <th style={{ padding: "12px 14px", fontWeight: 600 }}>{t("dataQualityColumn")}</th>
              <th style={{ padding: "12px 14px", fontWeight: 600, textAlign: "center" }}>{t("eligibilityColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {/* Loading, error, authorization refusal and "no dossiers" are
                reported separately; no branch substitutes sample rows. */}
            <DataStateRow
              colSpan={9}
              state={tableState}
              resource={t("filesResource")}
              error={questionnairesQuery.error}
              onRetry={() => questionnairesQuery.refetch()}
              title={tableState === "empty" ? t("noFilesTitle") : undefined}
              hint={tableState === "empty" ? t("noFilesHint") : undefined}
            />
            {dossiers.map((d) => {
              const visaBadge =
                d.adminStatus === "APPROVED" ? { label: t("badgeEndorsed"), dot: "#047857", bg: "#ecfdf5", border: "#d1fae5", text: "#047857" } :
                d.adminStatus === "CORRECTION_REQUESTED" ? { label: t("badgeCorrection"), dot: "#c2410c", bg: "#fff7ed", border: "#ffedd5", text: "#c2410c" } :
                d.adminStatus === "REJECTED" ? { label: t("badgeRejected"), dot: "#b91c1c", bg: "#fef2f2", border: "#fee2e2", text: "#b91c1c" } :
                d.adminStatus === "PENDING_REVIEW" ? { label: t("badgePending"), dot: "#b45309", bg: "#fef9e7", border: "#fef3c7", text: "#b45309" } :
                // An item with no stored status is reported as such rather
                // than defaulted into the pending queue.
                { label: t("badgeNoStatus"), dot: "#9ca3af", bg: "#f3f4f6", border: "#e5e7eb", text: "#6b7280" };

              /**
               * Data quality, derived from the dossier's own anomaly rows
               * (`anomalies`, included by QuestionnairesService.listForAdmin):
               *   blockingCount = OPEN && isBlocking
               *   warningCount  = OPEN && !isBlocking
               *
               * An empty anomaly list means "no anomaly recorded", which is
               * not the same claim as "conforme" — nothing has certified this
               * dossier, and detection results are not persisted today
               * (docs/admin-data-integrity-inventory.md §7.1).
               */
              const quality =
                d.blockingCount > 0
                  ? { tone: "blocking" as const, text: t("blockingAnomalies", { count: d.blockingCount }) }
                  : d.warningCount > 0
                    ? { tone: "warning" as const, text: t("warnings", { count: d.warningCount }) }
                    : { tone: "none" as const, text: t("noAnomaly") };

              /**
               * Statistical eligibility, mirroring the backend's own rule
               * (EligibilityEngineService.isStatisticallyEligible): APPROVED
               * **and** zero open blocking anomalies. Any other status is
               * pending; a rejected dossier is excluded. A dossier with no
               * stored status yields no claim at all.
               */
              const eligibility: "eligible" | "notEligible" | "pending" | null =
                d.adminStatus === null
                  ? null
                  : d.adminStatus === "REJECTED"
                    ? "notEligible"
                    : d.adminStatus === "APPROVED"
                      ? (d.blockingCount === 0 ? "eligible" : "notEligible")
                      : "pending";
              const eligibilityLabel =
                eligibility === "eligible" ? t("eligible")
                  : eligibility === "notEligible" ? t("notEligible")
                    : eligibility === "pending" ? t("eligibilityPending")
                      : null;

              return (
                <tr key={d.id} style={{ borderBottom: "1px solid #f3f4f6", fontSize: 13 }}>
                  <td style={{ padding: "14px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={(e) => toggleSelect(d.id, e.target.checked)}
                      style={{ accentColor: "#007a5e", width: 16, height: 16, cursor: "pointer" }}
                    />
                  </td>
                  <td style={{ padding: "14px" }}>
                    <Link
                      href={`/admin/dossiers/${encodeURIComponent(d.id)}`}
                      style={{ color: "#111827", fontWeight: 700, textDecoration: "none" }}
                    >
                      {d.submissionId}
                    </Link>
                  </td>
                  <td style={{ padding: "14px", fontWeight: 600, color: "#111827" }}>
                    {d.respondentName ?? NOT_PROVIDED}
                  </td>
                  <td style={{ padding: "14px", color: "#374151" }}>
                    {d.companyName ?? NOT_PROVIDED}
                  </td>
                  <td style={{ padding: "14px", color: "#374151" }}>
                    {d.formType ? typeLabel(d.formType) : NOT_PROVIDED}
                  </td>
                  <td style={{ padding: "14px", color: "#374151" }}>
                    {/* Territory as stored on the submission. A dossier with
                        no region is reported as such: inferring one would
                        invent an authorization-sensitive fact. */}
                    {d.region ?? NOT_PROVIDED}
                    {d.department && (
                      <span style={{ display: "block", fontSize: 11, color: "#6b7280" }}>{d.department}</span>
                    )}
                  </td>
                  <td style={{ padding: "14px", textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "3px 10px",
                        borderRadius: 9999,
                        background: visaBadge.bg,
                        border: `1px solid ${visaBadge.border}`,
                        color: visaBadge.text,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: visaBadge.dot }} />
                      {visaBadge.label}
                    </span>
                  </td>
                  <td style={{ padding: "14px" }}>
                    <span
                      style={{
                        color: quality.tone === "blocking" ? "#b91c1c" : quality.tone === "warning" ? "#b45309" : "#6b7280",
                        fontWeight: quality.tone === "none" ? 500 : 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {quality.tone === "blocking" && <span>▲</span>}
                      {quality.tone === "warning" && <span>⚐</span>}
                      {quality.text}
                    </span>
                  </td>
                  <td style={{ padding: "14px", textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 9999,
                        fontSize: 11.5,
                        fontWeight: 600,
                        background:
                          eligibility === "eligible" ? "#ecfdf5" :
                          eligibility === "pending" ? "#fef9e7" :
                          "#f3f4f6",
                        color:
                          eligibility === "eligible" ? "#047857" :
                          eligibility === "pending" ? "#b45309" :
                          "#6b7280",
                      }}
                    >
                      {eligibilityLabel ?? NOT_PROVIDED}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination driven by the server-reported `total` for the same
            filtered query. The range reflects the rows actually returned, and
            the page count is whatever the real total implies. */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "1px solid #e5e7eb", background: "#ffffff", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#6b7280" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => goToOffset(Math.max(0, offset - PAGE_SIZE))}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#ffffff",
                color: "#374151",
                fontSize: 13,
                fontWeight: 500,
                cursor: offset === 0 ? "not-allowed" : "pointer",
                opacity: offset === 0 ? 0.4 : 1,
              }}
            >
              {t("previousButton")}
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
              {pageCount === null ? t("pageNumber", { page: currentPage }) : t("pageOf", { page: currentPage, pages: pageCount })}
            </span>
            <button
              type="button"
              disabled={pageCount === null || currentPage >= pageCount}
              onClick={() => goToOffset(offset + PAGE_SIZE)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#ffffff",
                color: "#374151",
                fontSize: 13,
                fontWeight: 500,
                cursor: pageCount === null || currentPage >= pageCount ? "not-allowed" : "pointer",
                opacity: pageCount === null || currentPage >= pageCount ? 0.4 : 1,
              }}
            >
              {t("nextButton")}
            </button>
          </div>
        </div>
      </section>

      {/* ── Figma Bulk Visa Confirmation Modal ── */}
      {isBulkModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 540,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "24px 28px 20px" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>
                {t("bulkEndorseTitle")}
              </h2>
              <p style={{ margin: "4px 0 20px", fontSize: 13, color: "#6b7280" }}>
                {t("bulkEndorseCount", { count: cleanPendingSelected.length })}
              </p>

              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 13, color: "#374151", marginBottom: 20 }}>
                <input
                  type="checkbox"
                  checked={certifiedBulk}
                  onChange={(e) => setCertifiedBulk(e.target.checked)}
                  style={{ marginTop: 2, accentColor: "#007a5e", width: 16, height: 16 }}
                />
                <span>
                  {t("bulkEndorseCertify")}
                </span>
              </label>

              {/* Signatory is the signed-in actor. The authoritative
                  timestamp is the one the server returns with the operation,
                  so none is predicted before confirmation. */}
              <div style={{ padding: "14px 16px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>{t("signatoryLabel")}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginTop: 4 }}>
                  {signatoryLabel}
                </div>
              </div>

              {/* The real outcome of the operation, as reported by the server. */}
              {bulkResult && (
                <div
                  style={{
                    marginTop: 14,
                    padding: "14px 16px",
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    borderRadius: 6,
                    color: "#065f46",
                    fontSize: 13,
                  }}
                >
                  <strong>
                    {t("bulkEndorseResult", {
                      endorsed: count(bulkResult.processedCount, locale),
                      skipped: count(bulkResult.rejectedCount, locale),
                    })}
                  </strong>
                  <div style={{ marginTop: 4 }}>{t("operationTimestamped", { date: stamp(bulkResult.timestamp, true, locale) })}</div>
                  {bulkResult.rejectedItems?.length > 0 && (
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                      {bulkResult.rejectedItems.map((item: { id: string; reason: string }) => (
                        <li key={item.id}>{item.id} — {item.reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {bulkMutation.isError && (
                <div
                  style={{
                    marginTop: 14,
                    padding: "14px 16px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 6,
                    color: "#991b1b",
                    fontSize: 13,
                  }}
                >
                  {t("bulkEndorseFailed", { message: (bulkMutation.error as Error)?.message ?? t("unknownError") })}
                </div>
              )}

              <p style={{ margin: "14px 0 0", fontSize: 11, color: "#6b7280" }}>
                {t("bulkEndorseAudit")}
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "16px 28px", background: "#ffffff", borderTop: "1px solid #f3f4f6" }}>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {tRoot("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkVisa}
                disabled={!certifiedBulk || bulkMutation.isPending}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  border: "none",
                  background: certifiedBulk ? "#5ba897" : "#a7d1c7",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: certifiedBulk ? "pointer" : "not-allowed",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                {bulkMutation.isPending ? t("validating") : t("confirmEndorsement")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Reject Modal (Retained Widget) ── */}
      {isRejectModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setIsRejectModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 540,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>
                  {t("bulkRejectTitle")}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    border: "1.5px solid #9ca3af",
                    background: "transparent",
                    color: "#6b7280",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                  aria-label={t("closeAriaLabel")}
                >
                  ✕
                </button>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                {t("territoryLine", { scope: scopeLabel })}
              </p>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {rejectResult ? (
                <div
                  style={{
                    padding: "14px 16px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 6,
                    color: "#991b1b",
                    fontSize: 14,
                  }}
                >
                  <strong>{t("bulkRejectResult", { count: count(rejectResult.rejectedCount ?? rejectResult.processedCount, locale) })}</strong>{" "}
                  {t("bulkRejectLogged", { date: stamp(rejectResult.timestamp, true, locale) })}
                </div>
              ) : rejectableSelected.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
                  {t("noneRejectable")}
                </p>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                    {t("bulkRejectIntroBefore")} <strong>{t("bulkRejectIntroCount", { count: rejectableSelected.length })}</strong>{" "}
                    {t("bulkRejectIntroAfter", { count: rejectableSelected.length })}
                  </p>

                  <div>
                    <label
                      htmlFor="bulk-reject-reason"
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#374151",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 6,
                      }}
                    >
                      {t("bulkRejectReasonLabel")} <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <textarea
                      id="bulk-reject-reason"
                      rows={3}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder={t("bulkRejectReasonPlaceholder")}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                        lineHeight: 1.4,
                        color: "#111827",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                    {rejectReason.trim().length > 0 && rejectReason.trim().length < 10 && (
                      <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>
                        {t("reasonTooShort", { length: rejectReason.trim().length })}
                      </p>
                    )}
                  </div>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      fontSize: 13,
                      color: "#374151",
                      cursor: "pointer",
                      padding: 10,
                      background: "#fff5f5",
                      border: "1px solid #fecaca",
                      borderRadius: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={certifiedReject}
                      onChange={(e) => setCertifiedReject(e.target.checked)}
                      style={{ marginTop: 2, cursor: "pointer" }}
                    />
                    <span>
                      <strong>{t("certifyStrong")}</strong> {t("bulkRejectCertifyRest", { count: rejectableSelected.length })}
                    </span>
                  </label>
                  {rejectMutation.isError && (
                    <div
                      role="alert"
                      style={{
                        padding: 12,
                        borderRadius: 6,
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#b91c1c",
                        fontSize: 13,
                        marginTop: 12,
                      }}
                    >
                      {t("bulkRejectFailed", { message: (rejectMutation.error as Error)?.message ?? t("unknownErrorCapital") })}
                    </div>
                  )}
                </>
              )}
            </div>

            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e5e7eb",
                background: "#f9fafb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {rejectResult ? t("closeButton") : tRoot("common.cancel")}
              </button>
              {!rejectResult && rejectableSelected.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmBulkReject}
                  disabled={!certifiedReject || rejectReason.trim().length < 10 || rejectMutation.isPending}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 6,
                    border: "none",
                    background: certifiedReject && rejectReason.trim().length >= 10 ? "#dc2626" : "#fca5a5",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: certifiedReject && rejectReason.trim().length >= 10 ? "pointer" : "not-allowed",
                  }}
                >
                  {rejectMutation.isPending ? t("rejecting") : t("rejectCountButton", { count: rejectableSelected.length })}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
