"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import { NOT_PROVIDED, count, resolveDataState, stamp } from "@/lib/admin-data-state";
import { AUDIT_ROLES } from "@/lib/roles";
import { ALL, fromAll, toAll } from "@/lib/select-sentinel";
import { FilterBar } from "@/components/admin/FilterBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      { value: ALL, label: t("allUsers") },
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

      <Card>
        <CardContent>
          <FilterBar>
          <div className="grid gap-2">
            <Label htmlFor="filter-period">{t("periodLabel")}</Label>
            <Select value={period} onValueChange={(v) => { setPeriod(v); setCurrentPage(1); }}>
              <SelectTrigger id="filter-period" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>{t(`period.${value}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Acteur — real accounts from GET /auth/users, filtered by id */}
          <div className="grid gap-2">
            <Label htmlFor="filter-actor">{t("actorLabel")}</Label>
            <Select
              value={toAll(actor)}
              onValueChange={(v) => { setActor(fromAll(v)); setCurrentPage(1); }}
              disabled={actorsQuery.isLoading}
            >
              <SelectTrigger id="filter-actor" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {actorOptions.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type d'action — only actions the backend actually writes */}
          <div className="grid gap-2">
            <Label htmlFor="filter-action">{t("actionTypeLabel")}</Label>
            <Select
              value={toAll(action)}
              onValueChange={(v) => { setAction(fromAll(v)); setCurrentPage(1); }}
            >
              <SelectTrigger id="filter-action" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allActions")}</SelectItem>
                {ACTION_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>{auditActionLabel(value, locale)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="filter-resource">{t("resourceLabel")}</Label>
            <Select
              value={toAll(resourceType)}
              onValueChange={(v) => { setResourceType(fromAll(v)); setCurrentPage(1); }}
            >
              <SelectTrigger id="filter-resource" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allResources")}</SelectItem>
                {RESOURCE_TYPE_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>{auditResourceLabel(value, locale)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Identifiant de la ressource — exact match, server-side */}
          <div className="grid gap-2">
            <Label htmlFor="filter-resource-id">{t("idLabel")}</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="filter-resource-id"
                type="text"
                className="pl-9"
                placeholder={t("idPlaceholder")}
                value={resourceIdInput}
                onChange={(e) => setResourceIdInput(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Button type="button" variant="outline" onClick={handleResetFilters}>
              {t("reset")}
            </Button>
          </div>
          </FilterBar>
        </CardContent>

        <CardContent className="border-t pt-6">
          <div role="region" aria-label={t("registerAriaLabel")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("timestampColumn")}</TableHead>
                  <TableHead scope="col">{t("actorColumn")}</TableHead>
                  <TableHead scope="col">{t("actionColumn")}</TableHead>
                  <TableHead scope="col">{t("objectColumn")}</TableHead>
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
                    <TableCell className="whitespace-nowrap text-muted-foreground">
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
                    <TableCell className="whitespace-nowrap font-medium text-foreground">
                      {row.object}
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
        </CardContent>
      </Card>

      {/* Pagination driven by the server-reported `total` for the same
          filtered query. No fixed page buttons: the number of pages is
          whatever the real total implies, and the range reflects the rows
          actually returned. */}
      <div className="flex flex-wrap items-center justify-end gap-4 py-4 text-sm text-muted-foreground">
        <span>
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
          onClick={() => setCurrentPage((prev) => prev + 1)}
        >
          {t("next")}
        </Button>
      </div>
    </div>
  );
}
