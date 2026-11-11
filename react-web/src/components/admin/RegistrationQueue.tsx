"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { MoreHorizontal, Search, X } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import {
  applyRegistrationClaim,
  archiveUser,
  assignRegistrationUser,
  decidedOrganisation,
  listCompanyRegistrations,
  restoreUser,
  type CompanyRegistrationItem,
} from "@/lib/user-directory";
import { APPROVAL_ROLES, USER_ARCHIVE_ROLES, hasRole } from "@/lib/roles";
import { asUiLocale } from "@/lib/register-i18n";
import { ENTITY_TYPE_OPTION_KEYS } from "@/lib/companies-directory";
import { REGISTRATION_ENTITY_TYPES } from "@/lib/inscriptions";
import { count, resolveDataState, stamp } from "@/lib/admin-data-state";
import { registrationReviewHref, saveRegistrationTrail } from "@/lib/registration-trail";
import {
  REGISTRATION_QUEUE_PAGE_SIZE as PAGE_SIZE,
  geoLevelFor,
  hasActiveQueueFilters,
  isClaimConflict,
  parseQueueUrl,
  queueHref,
  queueListParams,
  queueSummaryParams,
  receiptStamp,
  rowInView,
  territoryParts,
  waitingDuration,
  claimTimeLeft,
  type RegistrationStatusFilter,
  type QueueOwnership,
  type QueueUrlState,
} from "@/lib/registration-queue";
import { useTerritoryStructure } from "@/hooks/useTerritoryStructure";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { AdminKpiStrip, type KpiItem } from "@/components/admin/AdminKpiStrip";
import { OwnClaimLapseNote } from "@/components/admin/OwnClaimLapseNote";
import { ArchiveActions } from "@/components/admin/ArchiveActions";
import { ConfirmDialog } from "@/components/auth/ConfirmDialog";
import { AdminNumberedPager } from "@/components/admin/AdminPager";
import { AdminLiveResultCount } from "@/components/admin/AdminLiveResultCount";
import { DataStateRow } from "@/components/admin/DataState";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/**
 * Writes the queue state to the address at once. Through the router the
 * address changed only once the navigation settled, so a second change made
 * meanwhile was built on the old query; Next keeps useSearchParams in step
 * with the history API.
 */
function writeUrl(href: string, history: "push" | "replace" = "push") {
  if (`${window.location.pathname}${window.location.search}` === href) return;
  if (history === "push") window.history.pushState(null, "", href);
  else window.history.replaceState(null, "", href);
}

/**
 * The registration queue: registrations pending review only, in the
 * officer's territory, as « À réclamer », « Réclamées par moi » or
 * « Réclamées par un collègue » (with the colleague's name). A claim lasts
 * 2 hours (CLAUDE.md §21, 2026-11-09); the time left is shown beside it.
 * The server decides what each view holds (status, ownership, territory);
 * see lib/registration-queue.ts.
 */
export function RegistrationQueue() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const t = useTranslations("adminRegistrationQueue");
  const tRoot = useTranslations();
  const locale = asUiLocale(useLocale());
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const userId = user?.id;
  const canRead = hasRole(role, APPROVAL_ROLES);
  const level = geoLevelFor(role);

  const queryString = searchParams.toString();
  const urlState = useMemo(() => parseQueueUrl(queryString, role), [queryString, role]);
  const territory = useTerritoryStructure(canRead && level !== null);

  // The geography options, one level below the officer's own territory.
  const geoOptions = useMemo(() => {
    if (!territory.isSuccess) return null;
    const tree = territory.data;
    if (level === "region") return tree.map((region) => region.name);
    const ownRegion = tree.find((region) => region.name === user?.region);
    if (level === "department") return ownRegion?.departments.map((department) => department.name) ?? [];
    if (level === "subdivision") {
      return ownRegion?.departments.find((department) => department.name === user?.department)
        ?.subdivisions.map((subdivision) => subdivision.name) ?? [];
    }
    return [];
  }, [level, territory.data, territory.isSuccess, user?.department, user?.region]);
  // A value the officer cannot pick (a stale link) is not sent: the server
  // would refuse a territory outside the officer's scope.
  const geoValid = !urlState.geo || geoOptions === null || geoOptions.includes(urlState.geo);
  const state: QueueUrlState = useMemo(() => (geoValid ? urlState : { ...urlState, geo: "" }), [geoValid, urlState]);
  const geoPending = !!urlState.geo && geoOptions === null && !territory.isError;
  const currentHref = queueHref(state, role);
  const isPendingQueue = state.status === "PENDING_APPROVAL";

  // Canonical address (defaults out, legacy parameters gone, invalid geography
  // dropped), without a history entry.
  useEffect(() => {
    if (!canRead || geoPending) return;
    writeUrl(currentHref, "replace");
  }, [canRead, currentHref, geoPending]);

  const update = useCallback((changes: Partial<QueueUrlState>, history: "push" | "replace" = "push") => {
    writeUrl(queueHref({ ...state, page: 1, ...changes }, role), history);
  }, [role, state]);

  // Search applies 300 ms after typing stops, without a history entry per key.
  const [searchInput, setSearchInput] = useState(state.search);
  const [syncedSearch, setSyncedSearch] = useState(state.search);
  if (syncedSearch !== state.search) {
    // Back / forward moved the address: the box follows it.
    setSyncedSearch(state.search);
    setSearchInput(state.search);
  }
  useEffect(() => {
    const next = searchInput.trim();
    if (next === state.search) return;
    const timer = setTimeout(() => update({ search: next }, "replace"), 300);
    return () => clearTimeout(timer);
  }, [searchInput, state.search, update]);

  // Waiting times move on while the page is open.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // The review page comes back with the decision it recorded.
  const arrivedDecision = searchParams.get("decisionNotice");
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(() => {
    if (arrivedDecision !== "approved" && arrivedDecision !== "rejected" && arrivedDecision !== "complements") return null;
    const organisation = decidedOrganisation(queryClient, searchParams.get("decidedFile"));
    return {
      tone: "success",
      text: organisation
        ? tRoot(`adminRegistrationReview.decidedNotice.${arrivedDecision}`, { organisation })
        : tRoot(`adminInscriptionsPage.${arrivedDecision === "approved" ? "approvedNotice" : arrivedDecision === "rejected" ? "rejectedNotice" : "complementsNotice"}`),
    };
  });
  const [archiveTarget, setArchiveTarget] = useState<CompanyRegistrationItem | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<CompanyRegistrationItem | null>(null);
  const archiveMutation = useMutation({
    mutationFn: ({ item, reason }: { item: CompanyRegistrationItem; reason: string }) => archiveUser(item.id, reason),
    onSuccess: (_data, { item }) => {
      setNotice({ tone: "success", text: t("archiveDone", { organisation: item.organisation }) });
      void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] });
    },
    onError: (error) => setNotice({ tone: "error", text: `${t("archiveFailed")} ${error instanceof Error ? error.message : ""}`.trim() }),
  });
  const restoreMutation = useMutation({
    mutationFn: (item: CompanyRegistrationItem) => restoreUser(item.id),
    onSuccess: (_data, item) => {
      setNotice({ tone: "success", text: t("restoreDone", { organisation: item.organisation }) });
      void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] });
    },
    onError: (error) => setNotice({ tone: "error", text: `${t("restoreFailed")} ${error instanceof Error ? error.message : ""}`.trim() }),
  });

  const enabled = canRead && !!userId && !geoPending;
  const summaryEnabled = enabled && isPendingQueue;
  const summaryQuery = (ownership: QueueOwnership) => ({
    queryKey: ["auth", "company-registrations", "pending-queue-summary", ownership, level, state.geo] as const,
    queryFn: () => listCompanyRegistrations(queueSummaryParams(ownership, state.geo, role)),
    enabled: summaryEnabled,
    staleTime: 15_000,
  });
  const availableQuery = useQuery(summaryQuery("available"));
  const mineQuery = useQuery(summaryQuery("mine"));
  const othersQuery = useQuery(summaryQuery("others"));
  const summaryQueries = [availableQuery, mineQuery, othersQuery];
  const listParams = queueListParams(state, role);
  const listQuery = useQuery({
    queryKey: ["auth", "company-registrations", "pending-queue", state.ownership, listParams, state.page] as const,
    queryFn: () => listCompanyRegistrations({ ...listParams, page: state.page, pageSize: PAGE_SIZE }),
    enabled,
    // Keep the rows on screen while a filter or page changes, but not across
    // ownership views: the other view's rows are not this view's records.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3] === state.ownership
        && (previousQuery.queryKey[4] as { status?: string } | undefined)?.status === listParams.status
        ? keepPreviousData(previous)
        : undefined,
    staleTime: 15_000,
  });

  // A page beyond the last (a file claimed meanwhile) moves back to the last.
  useEffect(() => {
    const data = listQuery.data;
    if (!data || listQuery.isPlaceholderData) return;
    const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
    if (state.page > lastPage) update({ page: lastPage }, "replace");
  }, [listQuery.data, listQuery.isPlaceholderData, state.page, update]);

  const rows = isPendingQueue
    ? (listQuery.data?.items ?? []).filter((row) => rowInView(row, state.ownership, userId))
    : (listQuery.data?.items ?? []);
  // Rows the server sent but the view excludes: only an older server that
  // ignores `unassigned` or `assignedToOthers` does this.
  const hiddenRows = !isPendingQueue || listQuery.isPlaceholderData ? 0 : (listQuery.data?.items.length ?? 0) - rows.length;
  const total = listQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const displayedPage = listQuery.data?.page ?? state.page;
  const filtersActive = hasActiveQueueFilters(state);
  const listNarrowed = Boolean(state.search || state.geo || state.type || state.includeArchived || state.createdBy);

  // ── Claim and open ──────────────────────────────────────────────────────
  // One claim at a time, on the server, before leaving the page. The claim
  // changes the holder only; the file stays pending review.
  const claimLock = useRef(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const openReview = (item: CompanyRegistrationItem) => {
    saveRegistrationTrail({
      returnTo: currentHref,
      params: listParams,
      page: displayedPage,
      pageSize: PAGE_SIZE,
      total,
      ids: rows.map((row) => row.id),
    });
    router.push(registrationReviewHref(item.id, currentHref));
  };
  const claimAndOpen = async (item: CompanyRegistrationItem) => {
    if (claimLock.current || !userId) return;
    claimLock.current = true;
    setClaimingId(item.id);
    setNotice(null);
    try {
      const claim = await assignRegistrationUser(item.id, userId, item.assigneeId);
      applyRegistrationClaim(queryClient, item.id, claim);
      void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] });
      openReview(item);
    } catch (error) {
      claimLock.current = false;
      setClaimingId(null);
      setNotice(isClaimConflict(error)
        ? { tone: "warning", text: t("conflict") }
        : { tone: "error", text: `${t("claimFailed")} ${error instanceof Error ? error.message : ""}`.trim() });
      void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] });
    }
  };

  // The decision notice was read into state; a reload must not repeat it.
  useEffect(() => {
    if (!arrivedDecision) return;
    router.replace(currentHref, { scroll: false });
  }, [arrivedDecision, currentHref, router]);

  useEffect(() => {
    document.title = `${t("title")} | CAMLEAP`;
  }, [t]);

  // ── Summary bar ─────────────────────────────────────────────────────────
  const selectedSummary = state.ownership === "mine" ? mineQuery.data : state.ownership === "others" ? othersQuery.data : availableQuery.data;
  const oldest = selectedSummary && selectedSummary.total > 0 ? selectedSummary.items[0] ?? null : null;
  const oldestValue = !selectedSummary || selectedSummary.total === 0 || !oldest
    ? "—"
    : waitingDuration(oldest.submittedAt, now, locale) ?? t("unavailable");
  const oldestStamp = oldest ? receiptStamp(oldest.submittedAt, locale) : null;
  const summaryItems: KpiItem[] = availableQuery.data && mineQuery.data && othersQuery.data ? [
    {
      key: "available",
      label: t("available"),
      value: count(availableQuery.data.total, locale),
      tone: "warning",
      pressed: state.ownership === "available",
      onSelect: () => update({ ownership: "available" }),
      selectHint: t("availableHint"),
    },
    {
      key: "mine",
      label: t("mine"),
      value: count(mineQuery.data.total, locale),
      tone: "neutral",
      pressed: state.ownership === "mine",
      onSelect: () => update({ ownership: "mine" }),
      selectHint: t("mineHint"),
    },
    {
      key: "others",
      label: t("others"),
      value: count(othersQuery.data.total, locale),
      tone: "neutral",
      pressed: state.ownership === "others",
      onSelect: () => update({ ownership: "others" }),
      selectHint: t("othersHint"),
    },
    {
      key: "oldest",
      label: t("oldest"),
      value: oldestValue,
      hint: oldestStamp ? t("receivedAt", { stamp: oldestStamp }) : undefined,
      tone: "info",
    },
  ] : [];

  // ── States ──────────────────────────────────────────────────────────────
  const tableState = resolveDataState({
    roleAllowed: canRead,
    isLoading: listQuery.isLoading || geoPending || (!userId && canRead),
    isError: listQuery.isError || (geoPending && territory.isError),
    error: listQuery.error ?? territory.error,
    rowCount: listQuery.data ? rows.length : null,
  });
  const emptyTitle = listNarrowed
    ? t("noMatch")
    : !isPendingQueue
      ? t("emptyStatus")
      : state.ownership === "mine" ? t("emptyMine") : state.ownership === "others" ? t("emptyOthers") : t("emptyAvailable");
  const clearFilters = () => {
    setSearchInput("");
    update({ status: "PENDING_APPROVAL", ownership: "available", search: "", geo: "", type: "", sort: "oldest", includeArchived: false, createdBy: "" });
  };

  const entityLabel = (value: string | null) =>
    value && ENTITY_TYPE_OPTION_KEYS[value] ? tRoot(ENTITY_TYPE_OPTION_KEYS[value]) : value ?? "";
  const entityShort = (value: string | null) =>
    value && ENTITY_TYPE_OPTION_KEYS[value] ? tRoot(`adminInscriptionsPage.entityShort.${value}`) : value ?? "";
  const statusLabel = (status: string) => status === "REJECTED"
    ? t("statusRejected")
    : status === "COMPLEMENTS_REQUESTED"
      ? t("statusComplements")
      : status === "ACTIVE"
        ? t("statusApproved")
        : status === "DRAFT"
          ? t("statusDraft")
          : status === "UNDER_REVIEW"
            ? t("statusUnderReview")
            : status === "DOCUMENTS_INCOMPLETE"
              ? t("statusDocumentsIncomplete")
        : t("statusPending");
  const statusTone = (status: string): "success" | "danger" | "info" | "warning" => status === "REJECTED"
    ? "danger"
    : status === "ACTIVE"
      ? "success"
      : status === "COMPLEMENTS_REQUESTED"
        ? "info"
        : status === "UNDER_REVIEW"
          ? "info"
        : "warning";
  const selectedListTitle = state.status === "REJECTED"
    ? t("rejectedTitle")
    : state.status === "COMPLEMENTS_REQUESTED"
      ? t("complementsTitle")
      : state.status === "ACTIVE"
        ? t("approvedTitle")
      : state.status === "ALL"
        ? t("allTitle")
        : state.ownership === "mine"
          ? t("mine")
          : state.ownership === "others"
            ? t("others")
            : t("available");

  const geoLabel = level === "region" ? t("geoRegion") : level === "department" ? t("geoDepartment") : t("geoSubdivision");
  const geoAll = level === "region" ? t("allRegions") : level === "department" ? t("allDepartments") : t("allSubdivisions");
  const busy = listQuery.isFetching && listQuery.data !== undefined;

  return (
    <div className="cam-admin-page cam-admin-workflow-page cam-registration-queue-page">
      <AdminPageHeader
        breadcrumb={[
          { label: tRoot("adminNav.hubs.inscriptions"), href: "/admin/inscriptions" },
          { label: t("title") },
        ]}
        // The purpose sits beside the title, in brackets, so the table gets
        // the height (owner, 2026-11-09). The masthead already names the scope.
        title={<>
          {t("title")}{" "}
          <span className="cam-admin-page-title-note">({t("description")})</span>
        </>}
        hideTabs
      />

      {canRead && isPendingQueue && (
        <AdminKpiStrip
          items={summaryItems}
          label={t("summaryLabel")}
          loading={enabled && summaryQueries.some((query) => query.isPending) && !summaryQueries.some((query) => query.isError)}
          loadingLabel={t("summaryLoading")}
          error={summaryQueries.some((query) => query.isError)}
          errorLabel={t("summaryError")}
          note={t("summaryCaption")}
        />
      )}
      {canRead && isPendingQueue && <OwnClaimLapseNote kind="registrations" enabled={enabled} />}

      {notice && (
        <Alert
          role={notice.tone === "success" ? "status" : "alert"}
          variant={notice.tone === "error" ? "destructive" : notice.tone === "warning" ? "warning" : "success"}
          className="my-4 flex items-center gap-3"
        >
          <span>{notice.text}</span>
          <Button type="button" variant="ghost" size="icon" className="ms-auto size-7" aria-label={t("close")} onClick={() => setNotice(null)}>
            <X aria-hidden="true" />
          </Button>
        </Alert>
      )}

      {canRead && (
        <AdminTablePanel
          title={selectedListTitle}
          headingId="registration-queue-table-title"
          busy={busy}
          busyLabel={t("updating")}
          meta={listQuery.data && !listQuery.isError ? (
            <AdminLiveResultCount announce={!listQuery.isPlaceholderData}>{t("resultCount", { count: total })}</AdminLiveResultCount>
          ) : undefined}
          footer={listQuery.data && total > PAGE_SIZE ? (
            <AdminNumberedPager
              page={displayedPage}
              pageCount={pageCount}
              range={t("showingRange", {
                start: count((displayedPage - 1) * PAGE_SIZE + 1, locale),
                end: count(Math.min(displayedPage * PAGE_SIZE, total), locale),
                total: count(total, locale),
              })}
              previousLabel={t("previous")}
              nextLabel={t("next")}
              label={t("pagerLabel")}
              pageLabel={(page) => t("pageButton", { page })}
              disabled={busy}
              onPage={(page) => update({ page })}
            />
          ) : undefined}
        >
          <div className="cam-admin-table-panel-body">
            <div className="cam-queue-toolbar" role="group" aria-label={t("filtersLabel")}>
              <div className="cam-queue-field cam-queue-field-search">
                <Label htmlFor="queue-search">{t("searchLabel")}</Label>
                <div className="cam-filter-bar-search">
                  <Search aria-hidden="true" className="cam-filter-bar-search-icon" />
                  <Input id="queue-search" type="search" value={searchInput} placeholder={t("searchPlaceholder")} onChange={(event) => setSearchInput(event.target.value)} />
                </div>
              </div>
              <div className="cam-queue-field">
                <Label htmlFor="queue-status">{t("statusLabel")}</Label>
                <select
                  id="queue-status"
                  className="cam-admin-input"
                  value={state.status}
                  onChange={(event) => {
                    const status = event.target.value as RegistrationStatusFilter;
                    update({
                      status,
                      ownership: "available",
                      includeArchived: false,
                      sort: status === "PENDING_APPROVAL" ? "oldest" : "newest",
                    });
                  }}
                >
                  <option value="PENDING_APPROVAL">{t("statusPending")}</option>
                  <option value="COMPLEMENTS_REQUESTED">{t("statusComplements")}</option>
                  {state.status === "ACTIVE" && <option value="ACTIVE">{t("statusApproved")}</option>}
                  <option value="REJECTED">{t("statusRejected")}</option>
                  <option value="ALL">{t("statusAll")}</option>
                </select>
              </div>
              {level && (
                <div className="cam-queue-field">
                  <Label htmlFor="queue-geo">{geoLabel}</Label>
                  <select id="queue-geo" className="cam-admin-input" value={state.geo} disabled={geoOptions === null} onChange={(event) => update({ geo: event.target.value })}>
                    <option value="">{geoAll}</option>
                    {(geoOptions ?? []).map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
              )}
              <div className="cam-queue-field">
                <Label htmlFor="queue-type">{t("typeLabel")}</Label>
                <select id="queue-type" className="cam-admin-input" value={state.type} onChange={(event) => update({ type: event.target.value })}>
                  <option value="">{t("allTypes")}</option>
                  {REGISTRATION_ENTITY_TYPES.map((value) => <option key={value} value={value}>{entityLabel(value)}</option>)}
                </select>
              </div>
              <div className="cam-queue-field">
                <Label htmlFor="queue-sort">{t("sortLabel")}</Label>
                <select id="queue-sort" className="cam-admin-input" value={state.sort} onChange={(event) => update({ sort: event.target.value === "newest" ? "newest" : "oldest" })}>
                  <option value="oldest">{t("sortOldest")}</option>
                  <option value="newest">{t("sortNewest")}</option>
                </select>
              </div>
              {!isPendingQueue && (
                <div className="cam-queue-field cam-filter-more-check">
                  <Checkbox
                    id="queue-include-archived"
                    checked={state.includeArchived}
                    onCheckedChange={(checked) => update({ includeArchived: checked === true })}
                  />
                  <Label htmlFor="queue-include-archived" className="!mb-0 cursor-pointer">{t("showArchived")}</Label>
                </div>
              )}
              {filtersActive && (
                <Button type="button" variant="ghost" size="sm" className="cam-queue-clear" onClick={clearFilters}>{t("clearFilters")}</Button>
              )}
            </div>

            {state.createdBy && <p className="cam-dash-context">{t("createdByNotice")}</p>}

            {hiddenRows > 0 && (
              <Alert role="status" variant="warning" className="my-3 flex">{t("hiddenClaimed")}</Alert>
            )}

            {isPendingQueue ? <Table className="cam-registration-queue-table cam-table-stack" aria-labelledby="registration-queue-table-title">
              <TableHeader><TableRow>
                <TableHead scope="col">{t("colOrganisation")}</TableHead>
                <TableHead scope="col">{t("colTerritory")}</TableHead>
                <TableHead scope="col" aria-sort={state.sort === "oldest" ? "descending" : "ascending"}>
                  <span title={t("waitingHelp")}>{t("colWaiting")}</span>
                  <span className="sr-only">. {t("waitingHelp")}</span>
                </TableHead>
                <TableHead scope="col">{t("colAssigned")}</TableHead>
                <TableHead scope="col" className="text-right">{t("colAction")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                <DataStateRow
                  colSpan={5}
                  state={tableState}
                  resource={t("resource")}
                  error={listQuery.error ?? territory.error}
                  onRetry={() => { if (territory.isError) void territory.refetch(); void listQuery.refetch(); }}
                  title={tableState === "loading" ? t("loading") : tableState === "error" ? t("loadError") : tableState === "forbidden" ? t("noAccess") : tableState === "empty" ? emptyTitle : undefined}
                  hint={tableState === "empty" && listNarrowed ? (
                    <>
                      {t("noMatchHint")}{" "}
                      <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={clearFilters}>{t("clearFilters")}</Button>
                    </>
                  ) : undefined}
                />
                {tableState === "ready" && rows.map((item) => {
                  const duration = waitingDuration(item.submittedAt, now, locale);
                  const stampText = receiptStamp(item.submittedAt, locale);
                  const place = territoryParts(item, role).join(" · ");
                  const mine = item.assigneeId != null && item.assigneeId === userId;
                  const colleague = item.assigneeId != null && !mine;
                  const claiming = claimingId === item.id;
                  const left = item.assigneeId ? claimTimeLeft(item.claimExpiresAt, now, locale) : null;
                  return (
                    <TableRow key={item.id}>
                      <TableHead scope="row">
                        <span className="cam-record-cell">
                          <span className="cam-record-cell-name" title={item.organisation}>{item.organisation}</span>
                          <span className="cam-record-cell-meta">
                            <span className="cam-record-cell-ref">{item.establishmentId || t("noReference")}</span>
                            {item.entityType && <span className="cam-tag" title={entityLabel(item.entityType)}>{entityShort(item.entityType)}</span>}
                          </span>
                        </span>
                      </TableHead>
                      <TableCell data-label={t("colTerritory")}>{place || "—"}</TableCell>
                      <TableCell data-label={t("colWaiting")} className="cam-cell-nowrap">
                        {duration && stampText ? (
                          <time dateTime={item.submittedAt} title={t("receivedAt", { stamp: stampText })}>
                            {duration}
                            <span className="sr-only"> ({t("receivedAt", { stamp: stampText })})</span>
                          </time>
                        ) : (
                          <span className="cam-cell-muted" title={t("receiptUnavailable")}>{t("unavailable")}</span>
                        )}
                      </TableCell>
                      <TableCell data-label={t("colAssigned")}>
                        <span className="cam-cell-stack">
                          <span className={mine || colleague ? undefined : "cam-cell-muted"}>
                            {mine ? t("you") : colleague ? item.assigneeName || t("colleagueUnnamed") : t("unassigned")}
                          </span>
                          {/* The claim's deadline, in words; amber in its last 30 minutes. */}
                          {left && (
                            <span className={left.urgent ? "cam-claim-time is-urgent" : "cam-claim-time"} title={t("timeLeftHelp")}>
                              {left.lapsed ? t("claimLapsed") : t("timeLeft", { time: left.label })}
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="cam-cell-action">
                        {mine ? (
                          <Button type="button" size="sm" variant="outline" aria-label={t("openAria", { organisation: item.organisation })} onClick={() => openReview(item)}>
                            {t("openReview")}
                          </Button>
                        ) : colleague ? (
                          // A colleague's file opens read-only; the review page
                          // offers the confirmed, logged takeover.
                          <Button type="button" size="sm" variant="outline" aria-label={t("openColleagueAria", { organisation: item.organisation, name: item.assigneeName || t("colleagueUnnamed") })} onClick={() => openReview(item)}>
                            {t("openColleague")}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-label={t("claimAria", { organisation: item.organisation })}
                            aria-busy={claiming || undefined}
                            disabled={claimingId !== null}
                            onClick={() => void claimAndOpen(item)}
                          >
                            {claiming ? t("claiming") : t("claimAndOpen")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table> : <Table className="cam-registration-queue-table cam-table-stack" aria-labelledby="registration-queue-table-title">
              <TableHeader><TableRow>
                <TableHead scope="col">{t("colOrganisation")}</TableHead>
                <TableHead scope="col">{t("statusLabel")}</TableHead>
                <TableHead scope="col">{t("colTerritory")}</TableHead>
                <TableHead scope="col">{t("colDecision")}</TableHead>
                <TableHead scope="col" className="text-right">{t("colAction")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                <DataStateRow
                  colSpan={5}
                  state={tableState}
                  resource={t("resource")}
                  error={listQuery.error ?? territory.error}
                  onRetry={() => { if (territory.isError) void territory.refetch(); void listQuery.refetch(); }}
                  title={tableState === "loading" ? t("loading") : tableState === "error" ? t("loadError") : tableState === "forbidden" ? t("noAccess") : tableState === "empty" ? emptyTitle : undefined}
                  hint={tableState === "empty" && listNarrowed ? (
                    <>
                      {t("noMatchHint")}{" "}
                      <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={clearFilters}>{t("clearFilters")}</Button>
                    </>
                  ) : undefined}
                />
                {tableState === "ready" && rows.map((item) => {
                  const place = territoryParts(item, role).join(" · ");
                  const decisionAt = item.status === "REJECTED" ? item.rejectedAt : item.status === "ACTIVE" ? item.approvedAt : item.updatedAt;
                  const decisionBy = item.status === "REJECTED" ? item.rejectedByName : item.status === "ACTIVE" ? item.approvedByName : null;
                  const canArchive = hasRole(role, USER_ARCHIVE_ROLES) && item.status === "REJECTED";
                  return (
                    <TableRow key={item.id}>
                      <TableHead scope="row">
                        <span className="cam-record-cell">
                          <span className="cam-record-cell-name" title={item.organisation}>{item.organisation}</span>
                          <span className="cam-record-cell-meta">
                            <span className="cam-record-cell-ref">{item.establishmentId || item.registrationNumber || t("noReference")}</span>
                            {item.entityType && <span className="cam-tag" title={entityLabel(item.entityType)}>{entityShort(item.entityType)}</span>}
                          </span>
                        </span>
                      </TableHead>
                      <TableCell data-label={t("statusLabel")}>
                        <span className="cam-cell-stack">
                          <span className="flex flex-wrap gap-1.5">
                            <Badge variant={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                            {item.archivedAt && <Badge variant="neutral">{t("archived")}</Badge>}
                          </span>
                          {item.status === "REJECTED" && item.rejectionReason && <span className="cam-cell-sub">{item.rejectionReason}</span>}
                        </span>
                      </TableCell>
                      <TableCell data-label={t("colTerritory")}>{place || "—"}</TableCell>
                      <TableCell data-label={t("colDecision")}>
                        <span className="cam-cell-stack">
                          <span className="cam-cell-nowrap">{stamp(decisionAt, false, locale)}</span>
                          {decisionBy && <span className="cam-cell-sub">{decisionBy}</span>}
                        </span>
                      </TableCell>
                      <TableCell className="cam-cell-action">
                        <div className="flex items-center justify-end gap-1">
                          {item.archivedAt ? (
                            <span aria-disabled="true" className="cam-button cam-button-secondary cam-button-sm">{t("openReview")}</span>
                          ) : (
                            <Button type="button" size="sm" variant="outline" aria-label={t("openAria", { organisation: item.organisation })} onClick={() => openReview(item)}>
                              {t("openReview")}
                            </Button>
                          )}
                          {canArchive && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" size="icon-sm" variant="ghost" aria-label={t("moreActions", { organisation: item.organisation })}>
                                  <MoreHorizontal aria-hidden="true" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {item.archivedAt ? (
                                  <DropdownMenuItem disabled={restoreMutation.isPending} onSelect={() => setRestoreTarget(item)}>{t("restore")}</DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onSelect={() => setArchiveTarget(item)}>{t("archive")}</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>}
          </div>
        </AdminTablePanel>
      )}
      {archiveTarget && <ArchiveActions
        archived={false}
        canManage={hasRole(role, USER_ARCHIVE_ROLES)}
        resourceName={archiveTarget.organisation}
        archiveLabel={t("archive")}
        restoreLabel={t("restore")}
        confirmTitle={t("archiveConfirmTitle")}
        reasonLabel={t("archiveReason")}
        cancelLabel={tRoot("common.cancel")}
        hideTrigger
        dialogOpen
        onDialogOpenChange={(open) => { if (!open) setArchiveTarget(null); }}
        onArchive={(reason) => { archiveMutation.mutate({ item: archiveTarget, reason }); setArchiveTarget(null); }}
        onRestore={() => {}}
      />}
      {restoreTarget && <ConfirmDialog
        id="restore-registration"
        title={t("restoreConfirmTitle", { organisation: restoreTarget.organisation })}
        body={t("restoreConfirmBody")}
        cancelLabel={tRoot("common.cancel")}
        confirmLabel={t("restore")}
        onCancel={() => setRestoreTarget(null)}
        onConfirm={() => { restoreMutation.mutate(restoreTarget); setRestoreTarget(null); }}
      />}
      {!canRead && role && (
        <Alert role="status" variant="warning" className="my-4">{t("noAccess")}</Alert>
      )}
    </div>
  );
}
