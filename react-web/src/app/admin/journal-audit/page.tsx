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
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import { NOT_PROVIDED, count, resolveDataState, stamp } from "@/lib/admin-data-state";
import { AUDIT_ROLES } from "@/lib/roles";

const PAGE_SIZE = 12;

// The tone an audit action maps to decides its badge class (G1).
const TONE_BADGE: Record<"neutral" | "success" | "warn" | "danger", string> = {
  neutral: "cam-badge-neutral",
  success: "cam-badge-success",
  warn: "cam-badge-warning",
  danger: "cam-badge-error",
};

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

  const header = (
    <AdminPageHeader
      breadcrumb={[{ label: tRoot("adminNav.hubs.administration") }, { label: tRoot("adminNav.routes.journalAudit") }]}
      title={tRoot("adminNav.routes.journalAudit")}
      actions={<AdminHeaderActions />}
    />
  );

  // The screen guard's two non-ready outcomes keep the page chrome and say
  // what is happening. Neither renders nothing (G10).
  if (isLoading || forbidden) {
    return (
      <div className="cam-admin-page">
        {header}
        <DataState
          state={isLoading ? "loading" : "forbidden"}
          resource={t("resource")}
          title={isLoading ? tRoot("common.loading") : t("forbidden")}
        />
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      {header}

      <section className="cam-admin-section">
        <div className="cam-admin-section-body">
          <div className="cam-admin-filters">
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="filter-period">{t("periodLabel")}</label>
              <select
                id="filter-period"
                className="cam-select"
                value={period}
                onChange={(e) => { setPeriod(e.target.value); setCurrentPage(1); }}
              >
                {PERIOD_VALUES.map((value) => (
                  <option key={value} value={value}>{t(`period.${value}`)}</option>
                ))}
              </select>
            </div>

            {/* Acteur — real accounts from GET /auth/users, filtered by id */}
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="filter-actor">{t("actorLabel")}</label>
              <select
                id="filter-actor"
                className="cam-select"
                value={actor}
                onChange={(e) => { setActor(e.target.value); setCurrentPage(1); }}
                disabled={actorsQuery.isLoading}
              >
                {actorOptions.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>

            {/* Type d'action — only actions the backend actually writes */}
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="filter-action">{t("actionTypeLabel")}</label>
              <select
                id="filter-action"
                className="cam-select"
                value={action}
                onChange={(e) => { setAction(e.target.value); setCurrentPage(1); }}
              >
                <option value="">{t("allActions")}</option>
                {ACTION_VALUES.map((value) => (
                  <option key={value} value={value}>{auditActionLabel(value, locale)}</option>
                ))}
              </select>
            </div>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="filter-resource">{t("resourceLabel")}</label>
              <select
                id="filter-resource"
                className="cam-select"
                value={resourceType}
                onChange={(e) => { setResourceType(e.target.value); setCurrentPage(1); }}
              >
                <option value="">{t("allResources")}</option>
                {RESOURCE_TYPE_VALUES.map((value) => (
                  <option key={value} value={value}>{auditResourceLabel(value, locale)}</option>
                ))}
              </select>
            </div>

            {/* Identifiant de la ressource — exact match, server-side */}
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="filter-resource-id">{t("idLabel")}</label>
              <div className="cam-admin-search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  id="filter-resource-id"
                  type="text"
                  className="cam-input"
                  placeholder={t("idPlaceholder")}
                  value={resourceIdInput}
                  onChange={(e) => setResourceIdInput(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button type="button" className="cam-button cam-button-secondary" onClick={handleResetFilters}>
                {t("reset")}
              </button>
            </div>
          </div>
        </div>

      <div className="cam-table-wrapper" role="region" aria-label={t("registerAriaLabel")}>
        <table className="cam-table">
          <thead>
            <tr>
              <th scope="col">{t("timestampColumn")}</th>
              <th scope="col">{t("actorColumn")}</th>
              <th scope="col">{t("actionColumn")}</th>
              <th scope="col">{t("objectColumn")}</th>
              <th scope="col">{t("detailsColumn")}</th>
              <th scope="col" className="text-right">{t("transitionColumn")}</th>
            </tr>
          </thead>
          <tbody>
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
            {displayItems.map((row) => (
              // The action badge carries the tone; the row is not tinted a
              // second time.
              <tr key={row.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <span className="cam-admin-meta">{row.timestamp}</span>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <span className="cam-admin-strong">{row.actor}</span>
                  {/* Role comes from the audit entry's joined user record;
                      omitted entirely for system-generated entries. */}
                  {row.actorRole && (
                    <span className="cam-admin-meta" style={{ display: "block" }}>{row.actorRole}</span>
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <span className={`cam-badge ${TONE_BADGE[row.actionTone]}`}>{row.action}</span>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <span className="cam-admin-strong">{row.object}</span>
                </td>
                <td
                  title={row.details}
                  style={{ maxWidth: 448, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {row.details}
                </td>
                <td className="text-right" style={{ whiteSpace: "nowrap" }}>
                  {row.transition ? (
                    <span className={`cam-badge ${TONE_BADGE[row.transitionTone ?? "neutral"]}`}>{row.transition}</span>
                  ) : (
                    <span className="cam-admin-muted">{NOT_PROVIDED}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </section>

      {/* Pagination driven by the server-reported `total` for the same
          filtered query. No fixed page buttons: the number of pages is
          whatever the real total implies, and the range reflects the rows
          actually returned. */}
      <div className="cam-pagination">
        <span className="cam-pagination-info">
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
        </span>
        <button
          type="button"
          className="cam-pagination-btn"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
        >
          {t("previous")}
        </button>
        <span className="cam-pagination-info">
          {pageCount === null ? t("pageNumber", { page: currentPage }) : t("pageOf", { page: currentPage, pages: pageCount })}
        </span>
        <button
          type="button"
          className="cam-pagination-btn"
          disabled={pageCount === null || currentPage >= pageCount}
          onClick={() => setCurrentPage((prev) => prev + 1)}
        >
          {t("next")}
        </button>
      </div>
    </div>
  );
}
