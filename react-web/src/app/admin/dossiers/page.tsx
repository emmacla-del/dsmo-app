"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL, bulkVisaDeclarations, bulkRejectDeclarations, getPilotageQueues, getToken, listAdminQuestionnaires, localeHeader } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { resolveEntityName } from "@/lib/onefop-entity-name";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataStateRow } from "@/components/admin/DataState";
import { useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import {
  NOT_PROVIDED,
  count,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";
import { NATIONAL_READ_ROLES, hasRole, isReadOnlyRole } from "@/lib/roles";
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
  // Central agents consult: no selection column, no visa / reject / export
  // toolbar. The server refuses all three to the role regardless.
  const readOnly = isReadOnlyRole(user?.role);
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

  return (
    <div className="cam-admin-page">
      {/* ── Page Header matching Figma supervision/dossiers.png ── */}
      <AdminPageHeader
        breadcrumb={[{ label: tRoot("adminNav.hubs.supervision") }, { label: tRoot("adminNav.routes.dossiers") }]}
        title={tRoot("adminNav.routes.dossiers")}
        subtitle={t("subtitle")}
        actions={<AdminHeaderActions />}
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
          className="cam-admin-notice cam-admin-notice--info"
        >
          {view.noteKey && t(view.noteKey)}
        </p>
      ))}

      {/* ── Filters. Statut is not here: the control above sets it. ──
          .cam-admin-filters is auto-fit/minmax, so the row reflows instead of
          overflowing the way the fixed four-column grid it replaces did. */}
      <section className="cam-admin-section">
        <div className="cam-admin-section-body">
          <div className="cam-admin-filters">
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="dossiers-type">{t("formTypeLabel")}</label>
              <select
                id="dossiers-type"
                className="cam-select"
                value={typeFilter}
                onChange={(e) => changeFilter(() => setTypeFilter(e.target.value))}
              >
                <option value="">{t("allFormTypes")}</option>
                {FORM_TYPES.map((type) => (
                  <option key={type} value={type}>{typeLabel(type)}</option>
                ))}
              </select>
            </div>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="dossiers-region">{t("regionLabel")}</label>
              <select
                id="dossiers-region"
                className="cam-select"
                value={regionFilter}
                onChange={(e) => changeFilter(() => setRegionFilter(e.target.value))}
              >
                <option value="">{t("allRegions")}</option>
                {territoryRegions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="dossiers-period">{t("periodLabel")}</label>
              <select
                id="dossiers-period"
                className="cam-select"
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

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="dossiers-search">{t("freeSearchLabel")}</label>
              <input
                id="dossiers-search"
                type="search"
                className="cam-input"
                placeholder={t("freeSearchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Action toolbar. One primary action (the visa); reject is the
          danger variant and export the secondary one. ── */}
      {!readOnly && (
      <div className="cam-admin-selection">
        <button
          type="button"
          className="cam-button cam-button-primary cam-button-sm"
          onClick={handleOpenBulkModal}
        >
          <span aria-hidden="true">✓</span> {t("endorseSelectionButton")}
        </button>
        <button
          type="button"
          className="cam-button cam-button-danger cam-button-sm"
          onClick={handleOpenRejectModal}
        >
          <span aria-hidden="true">✕</span> {t("rejectSelectionButton")}
        </button>

        <button
          type="button"
          className="cam-button cam-button-secondary cam-button-sm"
          onClick={() => handleExport("csv")}
          disabled={exportInProgress}
          style={{ marginInlineStart: "auto" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t("exportButton")}
        </button>
      </div>
      )}

      {/* ── Table. .cam-table-wrapper carries the surface, border, radius
          and the horizontal scroll this nine-column table needs on a narrow
          viewport; the inline card it replaces had no scroll at all. ── */}
      <div className="cam-table-wrapper">
        <table className="cam-table">
          <thead>
            <tr>
              {!readOnly && (
                <th scope="col" className="text-center">
                  <input
                    type="checkbox"
                    className="cam-admin-table-check"
                    checked={allShownSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                </th>
              )}
              <th scope="col">{t("formIdColumn")}</th>
              <th scope="col">{t("respondentColumn")}</th>
              <th scope="col">{t("organisationColumn")}</th>
              <th scope="col">{t("typeColumn")}</th>
              <th scope="col">{t("regionColumn")}</th>
              <th scope="col" className="text-center">{t("endorsementColumn")}</th>
              <th scope="col">{t("dataQualityColumn")}</th>
              <th scope="col" className="text-center">{t("eligibilityColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {/* Loading, error, authorization refusal and "no dossiers" are
                reported separately; no branch substitutes sample rows. */}
            <DataStateRow
              colSpan={readOnly ? 8 : 9}
              state={tableState}
              resource={t("filesResource")}
              error={questionnairesQuery.error}
              onRetry={() => questionnairesQuery.refetch()}
              title={tableState === "empty" ? t("noFilesTitle") : undefined}
              hint={tableState === "empty" ? t("noFilesHint") : undefined}
            />
            {dossiers.map((d) => {
              /**
               * Visa state, mapped from the stored enum to one badge tone
               * each. Five states, five tones: CORRECTION_REQUESTED is
               * `info` rather than a second amber because the dossier is
               * waiting on the respondent, while PENDING_REVIEW is the one
               * waiting on the reviewer reading this row.
               */
              const visaBadge =
                d.adminStatus === "APPROVED" ? { label: t("badgeEndorsed"), tone: "success" } :
                d.adminStatus === "CORRECTION_REQUESTED" ? { label: t("badgeCorrection"), tone: "info" } :
                d.adminStatus === "REJECTED" ? { label: t("badgeRejected"), tone: "error" } :
                d.adminStatus === "PENDING_REVIEW" ? { label: t("badgePending"), tone: "warning" } :
                // An item with no stored status is reported as such rather
                // than defaulted into the pending queue.
                { label: t("badgeNoStatus"), tone: "neutral" };

              /**
               * Data quality, derived from the dossier own anomaly rows
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
                  ? { tone: "error" as const, glyph: "▲", text: t("blockingAnomalies", { count: d.blockingCount }) }
                  : d.warningCount > 0
                    ? { tone: "warning" as const, glyph: "⚐", text: t("warnings", { count: d.warningCount }) }
                    : { tone: "neutral" as const, glyph: null, text: t("noAnomaly") };

              /**
               * Statistical eligibility, mirroring the backend own rule
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
              const eligibilityTone =
                eligibility === "eligible" ? "success"
                  : eligibility === "pending" ? "warning"
                    : "neutral";

              return (
                <tr key={d.id}>
                  {!readOnly && (
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="cam-admin-table-check"
                        checked={selectedIds.has(d.id)}
                        onChange={(e) => toggleSelect(d.id, e.target.checked)}
                      />
                    </td>
                  )}
                  <td>
                    <Link
                      href={`/admin/dossiers/${encodeURIComponent(d.id)}`}
                      className="cam-admin-code cam-admin-strong"
                    >
                      {d.submissionId}
                    </Link>
                  </td>
                  <td className="cam-admin-strong">
                    {d.respondentName ?? NOT_PROVIDED}
                  </td>
                  <td>
                    {d.companyName ?? NOT_PROVIDED}
                  </td>
                  <td>
                    {d.formType ? typeLabel(d.formType) : NOT_PROVIDED}
                  </td>
                  <td>
                    {/* Territory as stored on the submission. A dossier with
                        no region is reported as such: inferring one would
                        invent an authorization-sensitive fact. */}
                    {d.region ?? NOT_PROVIDED}
                    {d.department && (
                      <span className="cam-admin-meta" style={{ display: "block" }}>{d.department}</span>
                    )}
                  </td>
                  <td className="text-center">
                    <span className={`cam-badge cam-badge-${visaBadge.tone}`}>
                      {visaBadge.label}
                    </span>
                  </td>
                  <td>
                    <span className={`cam-badge cam-badge-${quality.tone}`}>
                      {quality.glyph && <span aria-hidden="true">{quality.glyph}</span>}
                      {quality.text}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className={`cam-badge cam-badge-${eligibilityTone}`}>
                      {eligibilityLabel ?? NOT_PROVIDED}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination driven by the server-reported `total` for the same
          filtered query. The range reflects the rows actually returned, and
          the page count is whatever the real total implies. */}
      <div className="cam-pagination">
        <span className="cam-pagination-info">
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
        <button
          type="button"
          className="cam-pagination-btn"
          disabled={offset === 0}
          onClick={() => goToOffset(Math.max(0, offset - PAGE_SIZE))}
        >
          {t("previousButton")}
        </button>
        <span className="cam-pagination-info">
          {pageCount === null ? t("pageNumber", { page: currentPage }) : t("pageOf", { page: currentPage, pages: pageCount })}
        </span>
        <button
          type="button"
          className="cam-pagination-btn"
          disabled={pageCount === null || currentPage >= pageCount}
          onClick={() => goToOffset(offset + PAGE_SIZE)}
        >
          {t("nextButton")}
        </button>
      </div>

      {/* ── Bulk visa. AdminDialog is a native <dialog>, so the focus trap,
          Escape, inert background and focus return that the fixed-position
          overlay here declared with aria-modal but never implemented now
          actually hold. ── */}
      <AdminDialog
        open={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title={t("bulkEndorseTitle")}
        eyebrow={t("bulkEndorseCount", { count: cleanPendingSelected.length })}
        footer={
          <>
            <button
              type="button"
              className="cam-button cam-button-secondary cam-button-sm"
              onClick={() => setIsBulkModalOpen(false)}
            >
              {tRoot("common.cancel")}
            </button>
            <button
              type="button"
              className="cam-button cam-button-primary cam-button-sm"
              onClick={handleConfirmBulkVisa}
              disabled={!certifiedBulk || bulkMutation.isPending}
            >
              {bulkMutation.isPending ? t("validating") : t("confirmEndorsement")}
            </button>
          </>
        }
      >
        <label className="cam-admin-choice">
          <input
            type="checkbox"
            checked={certifiedBulk}
            onChange={(e) => setCertifiedBulk(e.target.checked)}
          />
          <span>{t("bulkEndorseCertify")}</span>
        </label>

        {/* Signatory is the signed-in actor. The authoritative timestamp is
            the one the server returns with the operation, so none is
            predicted before confirmation. */}
        <div className="cam-admin-section" style={{ marginTop: "var(--cam-space-4)" }}>
          <div className="cam-admin-section-body">
            <div className="cam-admin-label">{t("signatoryLabel")}</div>
            <div className="cam-admin-strong">{signatoryLabel}</div>
          </div>
        </div>

        {/* The real outcome of the operation, as reported by the server. */}
        {bulkResult && (
          <div
            className="cam-admin-notice cam-admin-notice--success"
            style={{ marginTop: "var(--cam-space-3)" }}
          >
            <div>
              <strong>
                {t("bulkEndorseResult", {
                  endorsed: count(bulkResult.processedCount, locale),
                  skipped: count(bulkResult.rejectedCount, locale),
                })}
              </strong>
              <div>{t("operationTimestamped", { date: stamp(bulkResult.timestamp, true, locale) })}</div>
              {bulkResult.rejectedItems?.length > 0 && (
                <ul style={{ margin: "var(--cam-space-2) 0 0", paddingLeft: "var(--cam-space-4)" }}>
                  {bulkResult.rejectedItems.map((item: { id: string; reason: string }) => (
                    <li key={item.id}>{item.id} — {item.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {bulkMutation.isError && (
          <div
            role="alert"
            className="cam-admin-notice cam-admin-notice--error"
            style={{ marginTop: "var(--cam-space-3)" }}
          >
            {t("bulkEndorseFailed", { message: (bulkMutation.error as Error)?.message ?? t("unknownError") })}
          </div>
        )}

        <p className="cam-admin-meta" style={{ marginTop: "var(--cam-space-3)", marginBottom: 0 }}>
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
            <button
              type="button"
              className="cam-button cam-button-secondary cam-button-sm"
              onClick={() => setIsRejectModalOpen(false)}
            >
              {rejectResult ? t("closeButton") : tRoot("common.cancel")}
            </button>
            {!rejectResult && rejectableSelected.length > 0 && (
              <button
                type="button"
                className="cam-button cam-button-danger cam-button-sm"
                onClick={handleConfirmBulkReject}
                disabled={!certifiedReject || rejectReason.trim().length < 10 || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? t("rejecting") : t("rejectCountButton", { count: rejectableSelected.length })}
              </button>
            )}
          </>
        }
      >
        {rejectResult ? (
          <div className="cam-admin-notice cam-admin-notice--error">
            <div>
              <strong>{t("bulkRejectResult", { count: count(rejectResult.rejectedCount ?? rejectResult.processedCount, locale) })}</strong>{" "}
              {t("bulkRejectLogged", { date: stamp(rejectResult.timestamp, true, locale) })}
            </div>
          </div>
        ) : rejectableSelected.length === 0 ? (
          <p className="cam-admin-empty">{t("noneRejectable")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
            <p style={{ margin: 0 }}>
              {t("bulkRejectIntroBefore")} <strong>{t("bulkRejectIntroCount", { count: rejectableSelected.length })}</strong>{" "}
              {t("bulkRejectIntroAfter", { count: rejectableSelected.length })}
            </p>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="bulk-reject-reason">
                {t("bulkRejectReasonLabel")} <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="bulk-reject-reason"
                className="cam-admin-textarea"
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("bulkRejectReasonPlaceholder")}
              />
              {rejectReason.trim().length > 0 && rejectReason.trim().length < 10 && (
                <p className="cam-field-error" style={{ margin: "var(--cam-space-1) 0 0" }}>
                  {t("reasonTooShort", { length: rejectReason.trim().length })}
                </p>
              )}
            </div>

            <label className="cam-admin-choice">
              <input
                type="checkbox"
                checked={certifiedReject}
                onChange={(e) => setCertifiedReject(e.target.checked)}
              />
              <span>
                <strong>{t("certifyStrong")}</strong> {t("bulkRejectCertifyRest", { count: rejectableSelected.length })}
              </span>
            </label>

            {rejectMutation.isError && (
              <div role="alert" className="cam-admin-notice cam-admin-notice--error">
                {t("bulkRejectFailed", { message: (rejectMutation.error as Error)?.message ?? t("unknownErrorCapital") })}
              </div>
            )}
          </div>
        )}
      </AdminDialog>
    </div>
  );
}
