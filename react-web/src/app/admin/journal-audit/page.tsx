"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
 * `period` parameter at all.
 */
const PERIOD_OPTIONS = [
  { value: "7d", label: "Derniers 7 jours" },
  { value: "30d", label: "Derniers 30 jours" },
  { value: "3m", label: "3 derniers mois" },
  { value: "12m", label: "12 derniers mois" },
  { value: "all", label: "Toutes les dates" },
];

/**
 * Resource-type filter, keyed on the values the backend actually stores in
 * AuditLog.resourceType (AUDIT_RESOURCE_TYPES in lib/audit-log.ts, derived by
 * reading every auditLog.create call site in src/).
 */
const RESOURCE_TYPE_OPTIONS = [
  { value: "", label: "Toutes les ressources" },
  ...Object.entries(AUDIT_RESOURCE_TYPES).map(([value, label]) => ({ value, label })),
];

/**
 * Action filter, keyed on the action strings the backend actually writes
 * (AUDIT_ACTIONS in lib/audit-log.ts). An action missing from that map still
 * lists and renders under its raw code; it simply cannot be picked here.
 */
const ACTION_OPTIONS = [
  { value: "", label: "Toutes les actions" },
  ...Object.entries(AUDIT_ACTIONS).map(([value, meta]) => ({ value, label: meta.label })),
];

export default function JournalAuditPage() {
  const { isLoading, forbidden } = useAdminScreenGuard(AUDIT_ROLES);

  // Filters. `actor` holds a real User.id, not a display name: the backend
  // filters AuditLog.userId, so a free-text name could never match.
  const [period, setPeriod] = useState("7d");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [resourceIdInput, setResourceIdInput] = useState("");
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
    return [
      { value: "", label: "Tous les utilisateurs" },
      ...users
        .map((u) => ({
          value: u.id,
          label: `${[u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email} — ${directoryRoleLabel(u.role)}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "fr")),
    ];
  }, [actorsQuery.data]);

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
      const transition = auditTransition(e);
      return {
        id: e.id,
        timestamp: stamp(e.timestamp),
        actor: auditActorName(e),
        actorRole: e.user ? directoryRoleLabel(e.user.role) : null,
        action: auditActionLabel(e.action),
        actionTone: tone,
        object: e.resourceId ?? auditResourceLabel(e.resourceType),
        details: auditDetailsSummary(e),
        transition,
        transitionTone: transition ? tone : undefined,
      };
    });
  }, [auditQuery.data]);

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
        <p className="cam-admin-lede">Accès réservé aux super-administrateurs plateforme et ONEFOP, et aux auditeurs.</p>
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      {/* ── Top Header matching Figma administration/journal-audit.png ── */}
      <AdminPageHeader
        breadcrumb={[{ label: "Administration" }, { label: "Journal d'audit" }]}
        title="Journal d'Audit Systémique"
      />

      {/* ── Filter Bar matching Figma ── */}
      <section
        aria-label="Filtres d'audit"
        className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Période */}
          <div className="lg:col-span-2">
            <label htmlFor="filter-period" className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              Période
            </label>
            <div className="relative">
              <select
                id="filter-period"
                value={period}
                onChange={(e) => { setPeriod(e.target.value); setCurrentPage(1); }}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
              >
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
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
              Acteur
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
              Type d&apos;action
            </label>
            <div className="relative">
              <select
                id="filter-action"
                value={action}
                onChange={(e) => { setAction(e.target.value); setCurrentPage(1); }}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
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
              Ressource
            </label>
            <div className="relative">
              <select
                id="filter-resource"
                value={resourceType}
                onChange={(e) => { setResourceType(e.target.value); setCurrentPage(1); }}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
              >
                {RESOURCE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
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
              Identifiant
            </label>
            <div className="relative">
              <input
                id="filter-resource-id"
                type="text"
                placeholder="ID exact de la ressource"
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
              Réinitialiser
            </button>
          </div>
        </div>
      </section>

      {/* ── Table Card matching Figma administration/journal-audit.png ── */}
      <section
        aria-label="Registre d'audit"
        className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Horodatage</th>
                <th className="py-3.5 px-4">Acteur</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Objet</th>
                <th className="py-3.5 px-4">Détails</th>
                <th className="py-3.5 px-4 text-right">État précédent → Nouveau</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-700 divide-y divide-slate-50">
              {/* Loading, error, authorization refusal and "no records" stay
                  distinct. There is no branch that renders sample rows. */}
              <DataStateRow
                colSpan={6}
                state={tableState}
                resource="le journal d'audit"
                error={auditQuery.error}
                onRetry={() => auditQuery.refetch()}
                title={tableState === "empty" ? "Aucun historique d'audit disponible" : undefined}
                hint={
                  tableState === "empty"
                    ? "Aucun événement enregistré ne correspond aux filtres sélectionnés. Les événements consignés par le système apparaîtront ici."
                    : undefined
                }
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
                ? "0 événement"
                : `Affichage ${count(firstShown)}-${count(lastShown)} sur ${count(totalEvents)} événement${totalEvents > 1 ? "s" : ""}`}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700 font-medium"
            >
              Précédent
            </button>
            <span className="px-2 font-semibold text-slate-700">
              {pageCount === null ? `Page ${currentPage}` : `Page ${currentPage} / ${pageCount}`}
            </span>
            <button
              type="button"
              disabled={pageCount === null || currentPage >= pageCount}
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700 font-medium"
            >
              Suivant
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
