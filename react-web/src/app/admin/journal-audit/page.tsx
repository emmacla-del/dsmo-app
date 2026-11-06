"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";
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
import { AdminFilterPill } from "@/components/admin/AdminFilterPill";
import { hrefWith, parseAdminListPage } from "@/lib/admin-url";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import { NOT_PROVIDED, count, resolveDataState, stamp } from "@/lib/admin-data-state";
import { AUDIT_ROLES } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
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

const PAGE_SIZE = 12;

// The tone an audit action maps to decides its badge variant (G1).
const TONE_VARIANT: Record<
  "neutral" | "success" | "warn" | "danger",
  "neutral" | "success" | "warning" | "danger"
> = {
  neutral: "neutral",
  success: "success",
  warn: "warning",
  danger: "danger",
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
  resourceType: string;
  resourceId: string;
  details: string;
  transition: string | null;
  transitionTone?: "neutral" | "success" | "warn" | "danger";
}

/**
 * Period windows accepted by the backend (ADMIN_LIST_PERIODS). "all" means no
 * `period` parameter at all. Labels: adminJournalAuditPage.period.<value>.
 */
const PERIOD_VALUES = ["7d", "30d", "3m", "12m", "all"];
/** The bounded windows, offered by the « Période » pill; "all" is the pill switched off. */
const PERIOD_WINDOWS = PERIOD_VALUES.filter((value) => value !== "all");

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();

  // Every filter and the page live in the URL (G15). Deep links from a
  // dossier, an establishment or /admin/equipe arrive with ?resourceId= or
  // ?actor=. Such a link asks for that record's whole history, so the period
  // defaults to "all" there — the 7-day window would hide every older event.
  const actor = searchParams.get("actor")?.trim() ?? "";
  const resourceId = searchParams.get("resourceId")?.trim() ?? "";
  const isDeepLink = !!(actor || resourceId);
  const rawPeriod = searchParams.get("periode") ?? "";
  const period = PERIOD_WINDOWS.includes(rawPeriod) ? rawPeriod : rawPeriod === "tout" ? "all" : isDeepLink ? "all" : "7d";
  const rawAction = searchParams.get("action") ?? "";
  const action = ACTION_VALUES.includes(rawAction) ? rawAction : "";
  const rawResourceType = searchParams.get("type") ?? "";
  const resourceType = RESOURCE_TYPE_VALUES.includes(rawResourceType) ? rawResourceType : "";
  const currentPage = parseAdminListPage(searchParams.get("page"));
  const setFilters = (changes: Record<string, string | number | null>) =>
    router.replace(hrefWith(pathname, currentQuery, { page: null, ...changes }), { scroll: false });
  const setPage = (next: number) =>
    router.replace(hrefWith(pathname, currentQuery, { page: next <= 1 ? null : next }), { scroll: false });

  // The identifier box keeps a draft, written to the URL after a pause, so
  // each keystroke does not run a new audit query.
  const [resourceIdInput, setResourceIdInput] = useState(resourceId);
  const [syncedResourceId, setSyncedResourceId] = useState(resourceId);
  if (syncedResourceId !== resourceId) {
    setSyncedResourceId(resourceId);
    setResourceIdInput(resourceId);
  }
  useEffect(() => {
    const trimmed = resourceIdInput.trim();
    if (trimmed === resourceId) return;
    const timer = setTimeout(() => {
      router.replace(hrefWith(pathname, currentQuery, { page: null, resourceId: trimmed || null }), { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [resourceIdInput, resourceId, router, pathname, currentQuery]);

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
    const options = users
      .map((u) => ({
        value: u.id,
        label: `${[u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email} — ${directoryRoleLabel(u.role, locale)}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
    // An actor id from a deep link may fall outside the first 100 accounts
    // listed above. Without its own option the pill would read as off while
    // the query is in fact filtered by that id.
    if (actor && !options.some((o) => o.value === actor)) {
      options.push({ value: actor, label: t("deepLinkActor") });
    }
    return options;
  }, [actorsQuery.data, actor, t, locale]);

  const defaultPeriod = isDeepLink ? "all" : "7d";
  const hasFilter = period !== defaultPeriod || !!actor || !!action || !!resourceType || !!resourceId;
  const handleResetFilters = () => {
    setResourceIdInput("");
    router.replace(hrefWith(pathname, currentQuery, { page: null, periode: null, actor: null, action: null, type: null, resourceId: null }), { scroll: false });
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
        resourceType: auditResourceLabel(e.resourceType, locale),
        resourceId: e.resourceId ?? NOT_PROVIDED,
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
      subtitle={t("subtitle")}
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

  const removeLabel = (label: string) => tRoot("adminDossiersPage.removeFilterChip", { label });

  return (
    <div className="cam-admin-page">
      {header}

      <AdminTablePanel
        title={t("registerAriaLabel")}
        headingId="audit-register-heading"
        description={t("registerDescription")}
        meta={totalEvents === null ? undefined : (
          <span role="status">
            {totalEvents === 0
              ? t("zeroEvents")
              : t("showingRange", {
                  first: count(firstShown, locale),
                  last: count(lastShown, locale),
                  total: count(totalEvents, locale),
                  count: totalEvents,
                })}
          </span>
        )}
        busy={auditQuery.isFetching && !auditQuery.isLoading}
        toolbar={
          <div className="cam-filter-bar" role="group" aria-label={t("filtersAriaLabel")}>
            <div className="cam-filter-bar-search">
              <Label className="cam-sr-only" htmlFor="filter-resource-id">{t("idLabel")}</Label>
              <Search aria-hidden="true" className="cam-filter-bar-search-icon" />
              <Input id="filter-resource-id" type="search" value={resourceIdInput} onChange={(event) => setResourceIdInput(event.target.value)} placeholder={t("idPlaceholder")} />
            </div>
            <AdminFilterPill
              label={t("periodLabel")}
              value={period === "all" ? "" : period}
              allLabel={t("period.all")}
              clearLabel={removeLabel(t("periodLabel"))}
              onChange={(value) => setFilters({ periode: value || "tout" })}
              options={PERIOD_WINDOWS.map((value) => ({ value, label: t(`period.${value}`) }))}
            />
            <AdminFilterPill
              label={t("actorLabel")}
              value={actor}
              allLabel={t("allUsers")}
              clearLabel={removeLabel(t("actorLabel"))}
              onChange={(value) => setFilters({ actor: value || null })}
              options={actorOptions}
            />
            <AdminFilterPill
              label={t("actionTypeLabel")}
              value={action}
              allLabel={t("allActions")}
              clearLabel={removeLabel(t("actionTypeLabel"))}
              onChange={(value) => setFilters({ action: value || null })}
              options={ACTION_VALUES.map((value) => ({ value, label: auditActionLabel(value, locale) }))}
            />
            <AdminFilterPill
              label={t("resourceLabel")}
              value={resourceType}
              allLabel={t("allResources")}
              clearLabel={removeLabel(t("resourceLabel"))}
              onChange={(value) => setFilters({ type: value || null })}
              options={RESOURCE_TYPE_VALUES.map((value) => ({ value, label: auditResourceLabel(value, locale) }))}
            />
            {hasFilter && (
              <Button type="button" variant="ghost" size="sm" onClick={handleResetFilters}>
                {t("reset")}
              </Button>
            )}
          </div>
        }
        footer={
          <div className="cam-audit-pager">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              {t("previous")}
            </Button>
            <span>
              {pageCount === null ? t("pageNumber", { page: currentPage }) : t("pageOf", { page: currentPage, pages: pageCount })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageCount === null || currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              {t("next")}
            </Button>
          </div>
        }
      >
        <div className="cam-audit-table-scroll" role="region" tabIndex={0} aria-labelledby="audit-register-heading">
          <Table className="cam-audit-table">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t("timestampColumn")}</TableHead>
                <TableHead scope="col">{t("actorColumn")}</TableHead>
                <TableHead scope="col">{t("actionColumn")}</TableHead>
                <TableHead scope="col">{t("resourceLabel")}</TableHead>
                <TableHead scope="col">{t("detailsColumn")}</TableHead>
                <TableHead scope="col" className="text-right">{t("transitionColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {row.timestamp}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="font-medium text-foreground">{row.actor}</span>
                    {/* Role comes from the audit entry's joined user record;
                        omitted entirely for system-generated entries. */}
                    {row.actorRole && (
                      <span className="block text-muted-foreground">{row.actorRole}</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={TONE_VARIANT[row.actionTone]}>{row.action}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="font-medium text-foreground">{row.resourceType}</span>
                    {/* The identifier is secondary monospace text, as for rule codes. */}
                    <span className="cam-audit-resource-id">{row.resourceId}</span>
                  </TableCell>
                  <TableCell title={row.details} className="max-w-md truncate">
                    {row.details}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {row.transition ? (
                      <Badge variant={TONE_VARIANT[row.transitionTone ?? "neutral"]}>{row.transition}</Badge>
                    ) : (
                      <span className="text-muted-foreground">{NOT_PROVIDED}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </AdminTablePanel>
    </div>
  );
}
