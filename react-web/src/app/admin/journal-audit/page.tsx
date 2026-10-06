"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { directoryRoleLabel } from "@/lib/user-directory";
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  auditActionLabel,
  auditActionTone,
  auditActorName,
  auditDetailsSummary,
  auditResourceLabel,
  auditTransition,
  listAuditLog,
} from "@/lib/audit-log";
import { listUsers } from "@/lib/user-directory";
import type { UserRole } from "@/lib/user-types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataStateRow } from "@/components/admin/DataState";
import { NOT_PROVIDED, count, resolveDataState, stamp } from "@/lib/admin-data-state";
import { AUDIT_ROLES } from "@/lib/roles";

const PAGE_SIZE = 12;

/**
 * One audit row as rendered. Every field is mapped from an AuditLogEntry the
 * backend returned; `transition` is null when the entry records no state
 * change, which renders as an em dash rather than an invented transition.
 */
interface DisplayAuditItem {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string | null;
  action: string;
  actionTone: "neutral" | "success" | "warn" | "danger";
  object: string;
  details: string;
  transition: string | null;
  transitionTone?: "neutral" | "success" | "warn" | "danger";
}

/**
 * Period windows accepted by the backend (ADMIN_LIST_PERIODS). "all" means no
 * `period` parameter at all. Labels: adminJournalAuditPage.period.<value>.
 */
const PERIOD_VALUES = ["7d", "30d", "3m", "12m", "all"];

/**
 * Resource-type filter, keyed on the values the backend actually stores in
 * AuditLog.resourceType (AUDIT_RESOURCE_TYPES in lib/audit-log.ts, derived by
 * reading every auditLog.create call site in src/).
 */
const RESOURCE_TYPE_VALUES = Object.keys(AUDIT_RESOURCE_TYPES);

/**
 * Action filter, keyed on the action strings the backend actually writes
 * (AUDIT_ACTIONS in lib/audit-log.ts). An action missing from that map still
 * lists and renders under its raw code; it simply cannot be picked here.
 */
const ACTION_VALUES = Object.keys(AUDIT_ACTIONS);

// Suspense because useSearchParams() requires it in the app router.
export default function JournalAuditPage() {
  return (
    <Suspense fallback={null}>
      <JournalAuditContent />
    </Suspense>
  );
}

function JournalAuditContent() {
  const { isLoading, forbidden } = useAdminScreenGuard(AUDIT_ROLES);
  const tRoot = useTranslations();
  const t = useTranslations("adminJournalAuditPage");
  const locale = asUiLocale(useLocale());

  // Deep links from a dossier, an establishment or /admin/equipe arrive with
  // ?resourceId= or ?actor= and seed the matching filter. Such a link asks for
  // that record's whole history, so the period widens to "all" — the default
  // 7-day window would hide every older event.
  const searchParams = useSearchParams();
  const requestedActor = searchParams.get("actor")?.trim() ?? "";
  const requestedResourceId = searchParams.get("resourceId")?.trim() ?? "";
  const isDeepLink = !!(requestedActor || requestedResourceId);

  // Filters. `actor` holds a real User.id, not a display name: the backend
  // filters AuditLog.userId, so a free-text name could never match.
  const [period, setPeriod] = useState(isDeepLink ? "all" : "7d");
  const [actor, setActor] = useState(requestedActor);
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [resourceId, setResourceId] = useState(requestedResourceId);
  const [resourceIdInput, setResourceIdInput] = useState(requestedResourceId);
  const [currentPage, setCurrentPage] = useState(1);

  // Debounced so each keystroke does not run a new audit query.
  useEffect(() => {
    const trimmed = resourceIdInput.trim();
    if (trimmed === resourceId) return;
    const timer = setTimeout(() => {
      setResourceId(trimmed);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [resourceIdInput, resourceId]);

  /**
   * Source: GET /audit/reports?paginate=true (src/report/audit.controller.ts).
   * Every filter is applied server-side, so `total` is the count of the
   * filtered query and paging cannot hide matching rows.
   *
   * This endpoint is platform-wide by design, which is why this screen is
   * guarded to AUDIT_ROLES (SUPER_ADMIN / AUDITOR).
   */
  const auditQuery = useQuery({
    queryKey: ["admin", "audit", "list", { period, actor, action, resourceType, resourceId, currentPage }],
    queryFn: () =>
      listAuditLog({
        period: period === "all" ? undefined : period,
        actor: actor || undefined,
        action: action || undefined,
        resourceType: resourceType || undefined,
        resourceId: resourceId || undefined,
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
      }),
    enabled: !isLoading && !forbidden,
    placeholderData: keepPreviousData,
  });

  /**
   * Actor filter options. Source: GET /auth/users — real accounts only, keyed
   * by id. Hardcoding names here would offer filters that match nothing and
   * would assert that those people exist.
   */
  const actorsQuery = useQuery({
    queryKey: ["admin", "audit", "actors"],
    queryFn: () => listUsers({ page: 1, pageSize: 100 }),
    enabled: !isLoading && !forbidden,
  });

  const actorOptions = useMemo(() => {
    const users = actorsQuery.data?.users ?? [];
    const options = [
      { value: "", label: t("allUsers") },
      ...users
        .map((u) => ({
          value: u.id,
          label: `${[u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email} — ${directoryRoleLabel(u.role, locale)}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    ];
    // An actor id from a deep link may fall outside the first 100 accounts
    // listed above. Without its own option the select would display "Tous les
    // utilisateurs" while the query is in fact filtered by that id.
    if (actor && !options.some((o) => o.value === actor)) {
      options.push({ value: actor, label: t("deepLinkActor") });
    }
    return options;
  }, [actorsQuery.data, actor, t, locale]);

  const handleResetFilters = () => {
    setPeriod("7d");
    setActor("");
    setAction("");
    setResourceType("");
    setResourceIdInput("");
    setResourceId("");
    setCurrentPage(1);
  };

  /**
   * Audit rows, mapped one-to-one from the backend entries.
   *
   * There is no fallback dataset. The audit journal is an evidence screen: an
   * invented actor, action or state transition here would be indistinguishable
   * from a real administrative record.
   */
  const displayItems: DisplayAuditItem[] = useMemo(() => {
    const items = auditQuery.data?.items ?? [];
    return items.map((e) => {
      const rawTone = auditActionTone(e.action);
      const tone: DisplayAuditItem["actionTone"] =
        rawTone === "success" ? "success" : rawTone === "warning" ? "warn" : rawTone === "error" ? "danger" : "neutral";
      const transition = auditTransition(e, locale);
      return {
        id: e.id,
        timestamp: stamp(e.timestamp, true, locale),
        actor: auditActorName(e, locale),
        actorRole: e.user ? directoryRoleLabel(e.user.role, locale) : null,
        action: auditActionLabel(e.action, locale),
        actionTone: tone,
        object: e.resourceId ?? auditResourceLabel(e.resourceType, locale),
        details: auditDetailsSummary(e, locale),
        transition,
        transitionTone: transition ? tone : undefined,
      };
    });
  }, [auditQuery.data, locale]);

  const totalEvents = auditQuery.data?.total ?? null;
  const pageCount = totalEvents === null ? null : Math.max(1, Math.ceil(totalEvents / PAGE_SIZE));
  const firstShown = displayItems.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastShown = (currentPage - 1) * PAGE_SIZE + displayItems.length;

  const tableState = resolveDataState({
    isLoading: auditQuery.isLoading,
    isError: auditQuery.isError,
    error: auditQuery.error,
    rowCount: auditQuery.data?.items.length ?? null,
  });

  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <p className="cam-admin-lede">{t("forbidden")}</p>
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      {/* ── Top Header matching Figma administration/journal-audit.png ── */}
      <AdminPageHeader
        breadcrumb={[{ label: tRoot("adminNav.hubs.administration") }, { label: tRoot("adminNav.routes.journalAudit") }]}
        title={tRoot("adminNav.routes.journalAudit")}
      />

      {/* ── Filter Bar matching Figma ── */}
      <section
        aria-label={t("filtersAriaLabel")}
        className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Période */}
          <div className="lg:col-span-2">
            <label htmlFor="filter-period" className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              {t("periodLabel")}
            </label>
            <div className="relative">
              <select
                id="filter-period"
                value={period}
                onChange={(e) => { setPeriod(e.target.value); setCurrentPage(1); }}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
              >
                {PERIOD_VALUES.map((value) => (
                  <option key={value} value={value}>{t(`period.${value}`)}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 1 5 5 9 1" />
                </svg>
              </div>
            </div>
          </div>

          {/* Acteur — real accounts from GET /auth/users, filtered by id */}
          <div className="lg:col-span-3">
            <label htmlFor="filter-actor" className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              {t("actorLabel")}
            </label>
            <div className="relative">
              <select
                id="filter-actor"
                value={actor}
                onChange={(e) => { setActor(e.target.value); setCurrentPage(1); }}
                disabled={actorsQuery.isLoading}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
              >
                {actorOptions.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 1 5 5 9 1" />
                </svg>
              </div>
            </div>
          </div>

          {/* Type d'action — only actions the backend actually writes */}
          <div className="lg:col-span-2">
            <label htmlFor="filter-action" className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              {t("actionTypeLabel")}
            </label>
            <div className="relative">
              <select
                id="filter-action"
                value={action}
                onChange={(e) => { setAction(e.target.value); setCurrentPage(1); }}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
              >
                <option value="">{t("allActions")}</option>
                {ACTION_VALUES.map((value) => (
                  <option key={value} value={value}>{auditActionLabel(value, locale)}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 1 5 5 9 1" />
                </svg>
              </div>
            </div>
          </div>

          {/* Ressource */}
          <div className="lg:col-span-2">
            <label htmlFor="filter-resource" className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              {t("resourceLabel")}
            </label>
            <div className="relative">
              <select
                id="filter-resource"
                value={resourceType}
                onChange={(e) => { setResourceType(e.target.value); setCurrentPage(1); }}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
              >
                <option value="">{t("allResources")}</option>
                {RESOURCE_TYPE_VALUES.map((value) => (
                  <option key={value} value={value}>{auditResourceLabel(value, locale)}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 1 5 5 9 1" />
                </svg>
              </div>
            </div>
          </div>

          {/* Identifiant de la ressource — exact match, server-side */}
          <div className="lg:col-span-2">
            <label htmlFor="filter-resource-id" className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              {t("idLabel")}
            </label>
            <div className="relative">
              <input
                id="filter-resource-id"
                type="text"
                placeholder={t("idPlaceholder")}
                value={resourceIdInput}
                onChange={(e) => setResourceIdInput(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            </div>
          </div>

          {/* Réinitialiser */}
          <div className="lg:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full sm:w-auto px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              {t("reset")}
            </button>
          </div>
        </div>
      </section>

      {/* ── Table Card matching Figma administration/journal-audit.png ── */}
      <section
        aria-label={t("registerAriaLabel")}
        className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">{t("timestampColumn")}</th>
                <th className="py-3.5 px-4">{t("actorColumn")}</th>
                <th className="py-3.5 px-4">{t("actionColumn")}</th>
                <th className="py-3.5 px-4">{t("objectColumn")}</th>
                <th className="py-3.5 px-4">{t("detailsColumn")}</th>
                <th className="py-3.5 px-4 text-right">{t("transitionColumn")}</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-700 divide-y divide-slate-50">
              {/* Loading, error, authorization refusal and "no records" stay
                  distinct. There is no branch that renders sample rows. */}
              <DataStateRow
                colSpan={6}
                state={tableState}
                resource={t("resource")}
                error={auditQuery.error}
                onRetry={() => auditQuery.refetch()}
                title={tableState === "empty" ? t("emptyTitle") : undefined}
                hint={tableState === "empty" ? t("emptyHint") : undefined}
              />
              {displayItems.map((row) => {
                const actionBadgeClass =
                  row.actionTone === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : row.actionTone === "warn"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : row.actionTone === "danger"
                        ? "bg-rose-50 text-rose-800 border-rose-200"
                        : "bg-slate-100 text-slate-700 border-slate-200";

                const transitionTextClass =
                  row.transitionTone === "success"
                    ? "text-emerald-700 font-semibold"
                    : row.transitionTone === "warn"
                      ? "text-amber-700 font-semibold"
                      : row.transitionTone === "danger"
                        ? "text-rose-700 font-semibold"
                        : "text-slate-600";

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      row.actionTone === "danger" ? "bg-rose-50/50 hover:bg-rose-50/80" : "hover:bg-slate-50/60"
                    }`}
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {row.timestamp}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-slate-900">{row.actor}</span>
                      {/* Role comes from the audit entry's joined user record;
                          omitted entirely for system-generated entries. */}
                      {row.actorRole && (
                        <span className="block text-[11px] font-normal text-slate-500">{row.actorRole}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-medium border ${actionBadgeClass}`}>
                        {row.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {row.object}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-md truncate" title={row.details}>
                      {row.details}
                    </td>
                    <td className={`py-3 px-4 text-right whitespace-nowrap ${transitionTextClass}`}>
                      {row.transition ?? NOT_PROVIDED}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination driven by the server-reported `total` for the same
            filtered query. No fixed page buttons: the number of pages is
            whatever the real total implies, and the range reflects the rows
            actually returned. */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 border-t border-slate-100 text-xs text-slate-500">
          <div>
            {totalEvents === null
              ? NOT_PROVIDED
              : totalEvents === 0
                ? t("zeroEvents")
                : t("showingRange", {
                    first: count(firstShown, locale),
                    last: count(lastShown, locale),
                    total: count(totalEvents, locale),
                    count: totalEvents,
                  })}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700 font-medium"
            >
              {t("previous")}
            </button>
            <span className="px-2 font-semibold text-slate-700">
              {pageCount === null ? t("pageNumber", { page: currentPage }) : t("pageOf", { page: currentPage, pages: pageCount })}
            </span>
            <button
              type="button"
              disabled={pageCount === null || currentPage >= pageCount}
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700 font-medium"
            >
              {t("next")}
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
