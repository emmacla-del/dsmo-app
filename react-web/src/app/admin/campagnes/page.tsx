"use client";

import { Suspense, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, Eye, Plus, Search, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  activateCampaign,
  pauseCampaign,
  closeCampaign,
  archiveCampaign,
  deleteCampaign,
  extendCampaignDeadline,
  sendCampaignReminder,
  CAMPAIGN_PERIODICITIES,
  REMINDER_TYPES,
  campaignPeriodicity,
  formatCampaignDate,
  canActivate,
  isRegistrationCampaign,
  type Campaign,
  type CampaignDetail,
  type CampaignPeriodicity,
  type CampaignPurpose,
} from "@/lib/campaigns";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { doualaIsoDate } from "@/lib/douala-date";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { useAuthStore } from "@/lib/auth-store";
import { CAMPAIGN_ROLES, NATIONAL_ROLES, hasRole } from "@/lib/roles";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminFilterPill } from "@/components/admin/AdminFilterPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hrefWith } from "@/lib/admin-url";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { DataState } from "@/components/admin/DataState";
import { count } from "@/lib/admin-data-state";
import { formatCampaignDisplayName } from "@/lib/campaigns";
import { referencePeriodLabel } from "@/lib/onefop-period-label";

// @Roles on POST /campaigns/:id/activate|pause|close|remind (campaign.controller.ts).
// Every other role that reaches this page (REGIONAL_ADMIN) reads only.
// Status, periodicity, purpose, reminder-type and module labels are message
// keys under adminCampagnesPage, keyed by the stored code.
const STATUS_CODES = new Set(["DRAFT", "ACTIVE", "PAUSED", "CLOSED", "ARCHIVED"]);
const MODULE_CODES = new Set(["ONEFOP", "DSMO"]);
const REMINDER_CODES = new Set(REMINDER_TYPES.map((r) => r.value));

type Translate = ReturnType<typeof useTranslations>;

/** Entity type label without administrative codes, as on the other admin pages. */
function typeLabel(tRoot: Translate, type: string): string {
  return ENTITY_TYPE_OPTION_KEYS[type] ? tRoot(ENTITY_TYPE_OPTION_KEYS[type]) : entityTypeLabel(type) || type;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "cam-badge-warning",
  ACTIVE: "cam-badge-success",
  PAUSED: "cam-badge-info",
  CLOSED: "cam-badge-neutral",
  ARCHIVED: "cam-badge-neutral",
};

const fmt = formatCampaignDate;
const effectiveDeadline = (c: Campaign) => c.extendedDeadline ?? c.deadline ?? null;

function daysLeft(c: Campaign, t: Translate): { value: string; hint: string; tone?: "is-alert" | "is-warn" | "is-good" } {
  const deadline = effectiveDeadline(c);
  if (!deadline) return { value: "—", hint: t("noDeadline") };
  const ms = new Date(deadline).getTime() - Date.now();
  if (Number.isNaN(ms)) return { value: "—", hint: t("unreadableDeadline") };
  if (ms < 0) return { value: t("pastDue"), hint: t("pastDueSince", { date: fmt(deadline) }), tone: "is-alert" };
  const days = Math.ceil(ms / 86_400_000);
  return { value: t("daysValue", { days }), hint: t("until", { date: fmt(deadline) }), tone: days <= 7 ? "is-warn" : "is-good" };
}

/** "2026-T3" in French, "2026-Q3" in English. */
function quarterRef(t: Translate, year: number, quarter: number): string {
  return t("quarterRef", { year: String(year), quarter });
}

function moduleLabel(t: Translate, collectionType: string | null | undefined): string {
  if (!collectionType) return "—";
  return MODULE_CODES.has(collectionType) ? t(`module.${collectionType}`) : collectionType;
}

function StatusBadge({ status, registration = false }: { status: string; registration?: boolean }) {
  const t = useTranslations("adminCampagnesPage");
  // A registration campaign is DRAFT for life; "Brouillon" would suggest it is
  // waiting to be launched.
  if (registration) {
    return <span className="cam-badge cam-badge-neutral">{t("registrationStatus")}</span>;
  }
  return (
    <span className={`cam-badge ${STATUS_BADGE[status] ?? "cam-badge-neutral"}`}>
      {STATUS_CODES.has(status) ? t(`status.${status}`) : status}
    </span>
  );
}


// A disabled <button> swallows the pointer without showing its own title, so
// the reason sits on a wrapper span and the disabled button lets the pointer
// through (GATED_OFF) to reach it. Keyboard users get the same reason from the
// read-only notice at the top of the page.
const GATED_OFF: CSSProperties = { pointerEvents: "none" };

function Gated({ allowed, children }: { allowed: boolean; children: (disabled: boolean) => ReactNode }) {
  const t = useTranslations("adminCampagnesPage");
  if (allowed) return <>{children(false)}</>;
  return (
    <span title={t("readOnlyReason")} style={{ display: "inline-flex", cursor: "not-allowed" }}>
      {children(true)}
    </span>
  );
}

type DialogState =
  | { type: "remind"; campaign: Campaign }
  | { type: "extend"; campaign: Campaign }
  | { type: "close"; campaign: Campaign }
  | { type: "archive"; campaign: Campaign }
  | { type: "activate"; campaign: Campaign }
  | { type: "pause"; campaign: Campaign }
  | { type: "delete"; campaign: Campaign }
  | { type: "details"; campaign: Campaign }
  | null;

export default function CampagnesPage() {
  return (
    <Suspense fallback={null}>
      <CampagnesContent />
    </Suspense>
  );
}

// History filters, kept in the URL (G15): ?q=, ?statut=, ?type=.
const HISTORY_STATUSES = ["DRAFT", "PAUSED", "CLOSED", "ARCHIVED"] as const;
const HISTORY_TYPES = ["DSMO", "ONEFOP", "REGISTRATION"] as const;
type HistoryType = (typeof HISTORY_TYPES)[number];

function historyType(c: Campaign): HistoryType | null {
  if (isRegistrationCampaign(c)) return "REGISTRATION";
  if (c.collectionType === "DSMO" || c.collectionType === "ONEFOP") return c.collectionType;
  return null;
}

function CampagnesContent() {
  const { isLoading, forbidden } = useAdminScreenGuard(CAMPAIGN_ROLES);
  const role = useAuthStore((s) => s.user?.role);
  const canMutate = hasRole(role, NATIONAL_ROLES);
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const tRoot = useTranslations();
  const t = useTranslations("adminCampagnesPage");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reminderType, setReminderType] = useState(REMINDER_TYPES[0].value);
  const [extendDate, setExtendDate] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionSuccessCampaignId, setActionSuccessCampaignId] = useState<string | null>(null);

  const setFilters = (changes: Record<string, string | null>) =>
    router.replace(hrefWith(pathname, currentQuery, changes), { scroll: false });
  const urlSearch = searchParams.get("q")?.trim() ?? "";
  const rawStatus = searchParams.get("statut") ?? "";
  const statusFilter = (HISTORY_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : "";
  const rawType = searchParams.get("type") ?? "";
  const typeFilter = (HISTORY_TYPES as readonly string[]).includes(rawType) ? rawType : "";
  const [searchInput, setSearchInput] = useState(urlSearch);
  // The back button or a shared link changes the URL under the box: follow it.
  const [syncedSearch, setSyncedSearch] = useState(urlSearch);
  if (syncedSearch !== urlSearch) {
    setSyncedSearch(urlSearch);
    setSearchInput(urlSearch);
  }
  useEffect(() => {
    const next = searchInput.trim();
    if (next === urlSearch) return;
    const timer = setTimeout(() => {
      router.replace(hrefWith(pathname, currentQuery, { q: next || null }), { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, urlSearch, router, pathname, currentQuery]);

  const allQuery = useQuery({
    queryKey: ["campaigns", "all"],
    queryFn: () => listCampaigns(),
    enabled: !isLoading && !forbidden,
  });

  const done = (message: string, registrationCampaignId?: string) => {
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    setActionSuccess(message);
    setActionSuccessCampaignId(registrationCampaignId ?? null);
    setActionError(null);
    setDialog(null);
    setCreateOpen(false);
  };
  const failed = (e: Error) => {
    setActionError(e.message);
    setDialog(null);
  };

  const activateMutation = useMutation({ mutationFn: activateCampaign, onSuccess: () => done(t("activated")), onError: failed });
  const pauseMutation = useMutation({ mutationFn: pauseCampaign, onSuccess: () => done(t("paused")), onError: failed });
  const closeMutation = useMutation({ mutationFn: closeCampaign, onSuccess: () => done(t("closed")), onError: failed });
  const archiveMutation = useMutation({ mutationFn: archiveCampaign, onSuccess: () => done(t("archived")), onError: failed });
  const deleteMutation = useMutation({ mutationFn: deleteCampaign, onSuccess: () => done(t("deleted")), onError: failed });
  const reminderMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) => sendCampaignReminder(id, type),
    onSuccess: () => done(t("reminderSent")),
    onError: failed,
  });
  const extendMutation = useMutation({
    mutationFn: ({ id, newDeadline }: { id: string; newDeadline: string }) => extendCampaignDeadline(id, newDeadline),
    onSuccess: () => done(t("deadlineExtended")),
    onError: failed,
  });

  const breadcrumb = [{ label: tRoot("adminNav.hubs.collecte") }, { label: tRoot("adminNav.routes.campagnes") }];

  // The screen guard's two non-ready outcomes keep the page chrome and say
  // what is happening. Neither renders nothing (G10).
  if (isLoading || forbidden) {
    return (
      <div className="cam-admin-page">
        <AdminPageHeader breadcrumb={breadcrumb} title={tRoot("adminNav.routes.campagnes")} />
        <DataState
          state={isLoading ? "loading" : "forbidden"}
          resource={tRoot("adminNav.routes.campagnes")}
          title={isLoading ? tRoot("common.loading") : t("forbidden")}
        />
      </div>
    );
  }

  const campaigns: Campaign[] = allQuery.data ?? [];
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");
  const otherCampaigns = campaigns.filter((c) => c.status !== "ACTIVE");
  const needle = urlSearch.toLocaleLowerCase();
  const shownCampaigns = otherCampaigns.filter((c) =>
    (!needle || `${c.name} ${c.code} ${formatCampaignDisplayName(c.name)}`.toLocaleLowerCase().includes(needle))
    && (!statusFilter || c.status === statusFilter)
    && (!typeFilter || historyType(c) === typeFilter));
  const typeOptionLabel = (value: string) => (value === "REGISTRATION" ? t("purpose.REGISTRATION") : t(`module.${value}`));
  const activeFilterLabels = [
    urlSearch ? `« ${urlSearch} »` : null,
    statusFilter ? t(`status.${statusFilter}`) : null,
    typeFilter ? typeOptionLabel(typeFilter) : null,
  ].filter((label): label is string => !!label);
  const hasFilter = activeFilterLabels.length > 0;
  const clearFilters = () => {
    setSearchInput("");
    setFilters({ q: null, statut: null, type: null });
  };
  const openRemind = (campaign: Campaign) => { setReminderType(REMINDER_TYPES[0].value); setDialog({ type: "remind", campaign }); };
  const openExtend = (campaign: Campaign) => { setExtendDate(""); setDialog({ type: "extend", campaign }); };

  return (
    <div className="cam-admin-page cam-campaigns-page">
      <AdminPageHeader
        breadcrumb={breadcrumb}
        title={tRoot("adminNav.routes.campagnes")}
        subtitle={t("pageSubtitle")}
        actions={
          <Gated allowed={canMutate}>
            {(disabled) => (
              <button
                type="button"
                className="cam-button cam-button-primary cam-button-sm"
                disabled={disabled}
                style={disabled ? GATED_OFF : undefined}
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={15} aria-hidden="true" />
                {t("launchButton")}
              </button>
            )}
          </Gated>
        }
      />
      {!canMutate && (
        <div role="note" className="cam-admin-notice cam-admin-notice--info">
          <span>{t("readOnlyNotice")}</span>
        </div>
      )}
      {actionError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>{actionError}</span>
          <button type="button" className="cam-admin-notice-close" aria-label={t("closeAriaLabel")} onClick={() => setActionError(null)}>×</button>
        </div>
      )}
      {actionSuccess && (
        <div role="status" className="cam-admin-notice cam-admin-notice--success">
          <span>{actionSuccess}</span>
          {actionSuccessCampaignId && (
            <Link
              className="cam-button cam-button-secondary cam-button-sm"
              href={`/admin/cibles?vue=quotas&campagne=${encodeURIComponent(actionSuccessCampaignId)}`}
            >
              {t("registrationSetQuotas")}
            </Link>
          )}
          <button
            type="button"
            className="cam-admin-notice-close"
            aria-label={t("closeAriaLabel")}
            onClick={() => {
              setActionSuccess(null);
              setActionSuccessCampaignId(null);
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Running campaigns: one per module can be open at once ── */}
      <section className="cam-campaign-running" aria-labelledby="campagnes-active-title">
        <div className="cam-campaign-section-head">
          <h2 id="campagnes-active-title" className="cam-admin-h2">{t("activeTitle")}</h2>
          {!allQuery.isLoading && !allQuery.isError && (
            <span className="cam-admin-meta">{t("activeCount", { count: activeCampaigns.length })}</span>
          )}
        </div>
        {allQuery.isLoading ? (
          <DataState dense state="loading" resource={tRoot("adminNav.routes.campagnes")} title={tRoot("common.loading")} />
        ) : allQuery.isError ? null : activeCampaigns.length === 0 ? (
          <div className="cam-campaign-card cam-campaign-card--idle">
            <CircleAlert size={20} aria-hidden="true" />
            <div>
              <div className="cam-admin-strong">{t("noActiveTitle")}</div>
              <div className="cam-admin-meta">{t("noActiveHint")}</div>
            </div>
          </div>
        ) : (
          <div className="cam-campaign-running-grid">
            {activeCampaigns.map((c) => (
              <ActiveCampaignCard
                key={c.id}
                campaign={c}
                canMutate={canMutate}
                pausePending={pauseMutation.isPending}
                onDetails={() => setDialog({ type: "details", campaign: c })}
                onRemind={() => openRemind(c)}
                onExtend={() => openExtend(c)}
                onPause={() => setDialog({ type: "pause", campaign: c })}
                onClose={() => setDialog({ type: "close", campaign: c })}
                onArchive={() => setDialog({ type: "archive", campaign: c })}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Every other campaign ── */}
      <AdminTablePanel
        title={t("historyTitle")}
        headingId="campagnes-history-title"
        description={t("historyDescription")}
        meta={allQuery.isSuccess ? (hasFilter
          ? t("filteredCount", { shown: shownCampaigns.length, total: otherCampaigns.length })
          : t("campaignCount", { count: otherCampaigns.length })) : undefined}
        toolbar={
          <div className="cam-filter-bar" role="group" aria-label={tRoot("adminDossiersPage.filtersButton")}>
            <div className="cam-filter-bar-search">
              <label className="cam-sr-only" htmlFor="campagnes-search">{t("searchLabel")}</label>
              <Search aria-hidden="true" className="cam-filter-bar-search-icon" />
              <Input
                id="campagnes-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("searchPlaceholder")}
              />
            </div>
            <AdminFilterPill
              label={t("statusColumn")}
              value={statusFilter}
              allLabel={t("all")}
              clearLabel={tRoot("adminDossiersPage.removeFilterChip", { label: t("statusColumn") })}
              onChange={(value) => setFilters({ statut: value || null })}
              options={HISTORY_STATUSES.map((value) => ({
                value,
                label: t(`status.${value}`),
                count: otherCampaigns.filter((c) => c.status === value).length,
              }))}
            />
            <AdminFilterPill
              label={t("typeColumn")}
              value={typeFilter}
              allLabel={t("all")}
              clearLabel={tRoot("adminDossiersPage.removeFilterChip", { label: t("typeColumn") })}
              onChange={(value) => setFilters({ type: value || null })}
              options={HISTORY_TYPES.map((value) => ({
                value,
                label: typeOptionLabel(value),
                count: otherCampaigns.filter((c) => historyType(c) === value).length,
              }))}
            />
            {hasFilter && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                {tRoot("adminDossiersPage.clearFilters")}
              </Button>
            )}
          </div>
        }
      >
        {allQuery.isLoading ? (
          <DataState dense state="loading" resource={tRoot("adminNav.routes.campagnes")} title={tRoot("common.loading")} />
        ) : allQuery.isError ? (
          <DataState
            dense
            state="error"
            resource={tRoot("adminNav.routes.campagnes")}
            title={t("loadError", { message: (allQuery.error as Error).message })}
            onRetry={() => allQuery.refetch()}
          />
        ) : otherCampaigns.length === 0 ? (
          <DataState dense state="empty" resource={tRoot("adminNav.routes.campagnes")} title={t("noOtherTitle")} hint={t("noOtherHint")} />
        ) : shownCampaigns.length === 0 ? (
          <DataState
            dense
            state="empty"
            resource={tRoot("adminNav.routes.campagnes")}
            title={t("noMatchTitle")}
            hint={t("noMatchHint", { filters: activeFilterLabels.join(", ") })}
          />
        ) : (
          <div className="cam-campaign-table-scroll" role="region" tabIndex={0} aria-labelledby="campagnes-history-title">
            <table className="cam-table cam-campaign-table">
              <thead>
                <tr>
                  <th scope="col">{t("campaignColumn")}</th>
                  <th scope="col">{t("typeColumn")}</th>
                  <th scope="col">{t("openingColumn")}</th>
                  <th scope="col">{t("closingColumn")}</th>
                  <th scope="col">{t("statusColumn")}</th>
                  <th scope="col" className="text-right">{t("actionsColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {shownCampaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cam-campaign-name-cell">
                        <span className="cam-admin-strong" title={`${c.name} (${c.code})`}>{formatCampaignDisplayName(c.name)}</span>
                        <span className="cam-campaign-code">{c.code}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cam-campaign-type-cell">
                        {/* Same name as the collection campaign of the quarter; the tag tells them apart. */}
                        <span className={`cam-badge ${isRegistrationCampaign(c) ? "cam-badge-info" : "cam-badge-neutral"}`}>
                          {historyType(c) ? typeOptionLabel(historyType(c) as string) : (campaignPeriodicity(c) ? t(`periodicity.${campaignPeriodicity(c)}`) : "—")}
                        </span>
                        {c.referenceYear && c.referenceQuarter && (
                          <span className="cam-admin-meta">{quarterRef(t, c.referenceYear, c.referenceQuarter)}</span>
                        )}
                      </div>
                    </td>
                    <td className="cam-campaign-date-cell">{fmt(c.startDate)}</td>
                    <td className="cam-campaign-date-cell">
                      {fmt(effectiveDeadline(c))}
                      {c.extendedDeadline && c.deadline && c.extendedDeadline !== c.deadline && (
                        <div className="cam-admin-meta">{t("extendedWas", { date: fmt(c.deadline) })}</div>
                      )}
                    </td>
                    <td><StatusBadge status={c.status} registration={isRegistrationCampaign(c)} /></td>
                    <td className="text-right">
                      <div className="cam-campaign-row-actions">
                        {canActivate(c.status) && !isRegistrationCampaign(c) && (
                          <Gated allowed={canMutate}>
                            {(disabled) => (
                              <button
                                type="button"
                                className="cam-button cam-button-primary cam-button-sm"
                                onClick={() => setDialog({ type: "activate", campaign: c })}
                                disabled={disabled || activateMutation.isPending}
                                style={disabled ? GATED_OFF : undefined}
                              >
                                {t("activate")}
                              </button>
                            )}
                          </Gated>
                        )}
                        {c.status !== "DRAFT" && c.status !== "ARCHIVED" && !isRegistrationCampaign(c) && (
                          <Gated allowed={canMutate}>
                            {(disabled) => (
                              <button
                                type="button"
                                className="cam-button cam-button-secondary cam-button-sm"
                                onClick={() => setDialog({ type: "archive", campaign: c })}
                                disabled={disabled || archiveMutation.isPending}
                                style={disabled ? GATED_OFF : undefined}
                              >
                                {t("archive")}
                              </button>
                            )}
                          </Gated>
                        )}
                        <button
                          type="button"
                          className="cam-button cam-button-secondary cam-button-sm cam-campaign-icon-button"
                          aria-label={t("viewDetailsOf", { name: c.name })}
                          title={t("viewDetails")}
                          onClick={() => setDialog({ type: "details", campaign: c })}
                        >
                          <Eye size={16} aria-hidden="true" />
                        </button>
                        {c.status === "DRAFT" && (
                          <Gated allowed={canMutate}>
                            {(disabled) => (
                              <button
                                type="button"
                                className="cam-button cam-button-secondary cam-button-sm cam-campaign-icon-button cam-campaign-delete"
                                aria-label={t("deleteOf", { name: c.name })}
                                title={t("delete")}
                                onClick={() => setDialog({ type: "delete", campaign: c })}
                                disabled={disabled || deleteMutation.isPending}
                                style={disabled ? GATED_OFF : undefined}
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </button>
                            )}
                          </Gated>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminTablePanel>
      {/* ── Dialogs ── */}
      <AdminDialog
        open={dialog?.type === "remind"}
        onClose={() => setDialog(null)}
        eyebrow={t("remindEyebrow")}
        title={t("remindTitle")}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setDialog(null)}>{tRoot("common.cancel")}</button>
            <button
              type="button"
              className="cam-button cam-button-primary cam-button-sm"
              disabled={reminderMutation.isPending}
              onClick={() => dialog?.type === "remind" && reminderMutation.mutate({ id: dialog.campaign.id, type: reminderType })}
            >
              {reminderMutation.isPending ? t("sending") : t("send")}
            </button>
          </>
        }
      >
        <div className="cam-field">
          <label className="cam-admin-label" htmlFor="reminder-type">{t("reminderTypeLabel")}</label>
          <select id="reminder-type" className="cam-select" value={reminderType} onChange={(e) => setReminderType(e.target.value)}>
            {REMINDER_TYPES.map((r) => <option key={r.value} value={r.value}>{t(`reminderType.${r.value}`)}</option>)}
          </select>
        </div>
        <p className="cam-admin-meta" style={{ margin: 0 }}>
          {t("reminderHint")}
        </p>
      </AdminDialog>

      <AdminDialog
        open={dialog?.type === "extend"}
        onClose={() => setDialog(null)}
        eyebrow={t("extendEyebrow")}
        title={dialog?.type === "extend" ? t("extendTitle", { name: dialog.campaign.name }) : t("extendTitleFallback")}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setDialog(null)}>{tRoot("common.cancel")}</button>
            <button
              type="button"
              className="cam-button cam-button-primary cam-button-sm"
              disabled={!extendDate || extendMutation.isPending}
              onClick={() => dialog?.type === "extend" && extendMutation.mutate({ id: dialog.campaign.id, newDeadline: new Date(extendDate).toISOString() })}
            >
              {extendMutation.isPending ? t("extending") : t("extend")}
            </button>
          </>
        }
      >
        <div className="cam-field">
          <label className="cam-admin-label" htmlFor="extend-deadline">{t("newDeadline")}</label>
          <input
            id="extend-deadline"
            type="date"
            className="cam-input"
            value={extendDate}
            onChange={(e) => setExtendDate(e.target.value)}
            required
          />
        </div>
        {dialog?.type === "extend" && (
          <p className="cam-admin-meta" style={{ margin: 0 }}>
            {t("currentDeadline", { date: fmt(effectiveDeadline(dialog.campaign)) })}
          </p>
        )}
      </AdminDialog>

      <AdminDialog
        open={dialog?.type === "close"}
        onClose={() => setDialog(null)}
        eyebrow={t("closeEyebrow")}
        title={dialog?.type === "close" ? t("closeTitle", { name: dialog.campaign.name }) : t("closeTitleFallback")}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setDialog(null)}>{tRoot("common.cancel")}</button>
            <button
              type="button"
              className="cam-button cam-button-danger cam-button-sm"
              disabled={closeMutation.isPending}
              onClick={() => dialog?.type === "close" && closeMutation.mutate(dialog.campaign.id)}
            >
              {closeMutation.isPending ? t("closing") : t("closeCampaign")}
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {t("closeBody")}
        </p>
      </AdminDialog>

      <AdminDialog
        open={dialog?.type === "delete"}
        onClose={() => setDialog(null)}
        eyebrow={t("deleteEyebrow")}
        title={dialog?.type === "delete" ? t("deleteTitle", { name: dialog.campaign.name }) : t("deleteTitleFallback")}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setDialog(null)}>{tRoot("common.cancel")}</button>
            <button
              type="button"
              className="cam-button cam-button-danger cam-button-sm"
              disabled={deleteMutation.isPending}
              onClick={() => dialog?.type === "delete" && deleteMutation.mutate(dialog.campaign.id)}
            >
              {deleteMutation.isPending ? t("deleting") : t("deletePermanently")}
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {t("deleteBody")}
        </p>
      </AdminDialog>

      <AdminDialog
        open={dialog?.type === "archive"}
        onClose={() => setDialog(null)}
        eyebrow={t("archiveEyebrow")}
        title={dialog?.type === "archive" ? t("archiveTitle", { name: dialog.campaign.name }) : t("archiveTitleFallback")}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setDialog(null)}>{tRoot("common.cancel")}</button>
            <button
              type="button"
              className="cam-button cam-button-primary cam-button-sm"
              disabled={archiveMutation.isPending}
              onClick={() => dialog?.type === "archive" && archiveMutation.mutate(dialog.campaign.id)}
            >
              {archiveMutation.isPending ? t("archiving") : t("archiveCampaign")}
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {t("archiveBody")}
        </p>
      </AdminDialog>

      {/* Activating opens collection (and, with automatic reminders, emails
          the targeted establishments); pausing closes it until reactivation.
          Both change what declarants can do, so both are confirmed. */}
      <AdminDialog
        open={dialog?.type === "activate"}
        onClose={() => setDialog(null)}
        eyebrow={t("activateEyebrow")}
        title={dialog?.type === "activate" ? t("activateTitle", { name: formatCampaignDisplayName(dialog.campaign.name) }) : t("activateTitleFallback")}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setDialog(null)}>{tRoot("common.cancel")}</button>
            <button
              type="button"
              className="cam-button cam-button-primary cam-button-sm"
              disabled={activateMutation.isPending}
              onClick={() => dialog?.type === "activate" && activateMutation.mutate(dialog.campaign.id)}
            >
              {activateMutation.isPending ? t("activating") : t("activateCampaign")}
            </button>
          </>
        }
      >
        <p className="cam-campaign-dialog-text">{t("activateBody")}</p>
        {dialog?.type === "activate" && dialog.campaign.autoReminders === true && (
          <p className="cam-campaign-dialog-text cam-admin-meta">{t("activateRemindersNote")}</p>
        )}
      </AdminDialog>

      <AdminDialog
        open={dialog?.type === "pause"}
        onClose={() => setDialog(null)}
        eyebrow={t("pauseEyebrow")}
        title={dialog?.type === "pause" ? t("pauseTitle", { name: formatCampaignDisplayName(dialog.campaign.name) }) : t("pauseTitleFallback")}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setDialog(null)}>{tRoot("common.cancel")}</button>
            <button
              type="button"
              className="cam-button cam-button-primary cam-button-sm"
              disabled={pauseMutation.isPending}
              onClick={() => dialog?.type === "pause" && pauseMutation.mutate(dialog.campaign.id)}
            >
              {pauseMutation.isPending ? t("pausing") : t("pauseCampaign")}
            </button>
          </>
        }
      >
        <p className="cam-campaign-dialog-text">{t("pauseBody")}</p>
      </AdminDialog>

      {dialog?.type === "details" && <DetailsDialog campaign={dialog.campaign} onClose={() => setDialog(null)} />}
      <CreateCampaignDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(msg, campaignId) => done(msg, campaignId)}
      />
    </div>
  );
}

// ── Running campaign card ───────────────────────────────────────────────────

/** Share of the collection period already elapsed, from the dates only. */
function elapsedShare(c: Campaign): number | null {
  const start = c.startDate ? new Date(c.startDate).getTime() : NaN;
  const end = effectiveDeadline(c) ? new Date(effectiveDeadline(c) as string).getTime() : NaN;
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.min(1, Math.max(0, (Date.now() - start) / (end - start)));
}

function ActiveCampaignCard({ campaign: c, canMutate, pausePending, onDetails, onRemind, onExtend, onPause, onClose, onArchive }: {
  campaign: Campaign; canMutate: boolean; pausePending: boolean;
  onDetails: () => void; onRemind: () => void; onExtend: () => void; onPause: () => void; onClose: () => void; onArchive: () => void;
}) {
  const tRoot = useTranslations();
  const t = useTranslations("adminCampagnesPage");
  const locale = asUiLocale(useLocale());
  const remaining = daysLeft(c, t);
  const share = elapsedShare(c);
  const percent = share == null ? null : Math.round(share * 100);
  const types = c.targetEntityTypes ?? [];
  const titleId = `campaign-${c.id}-title`;
  const extended = c.extendedDeadline && c.deadline && c.extendedDeadline !== c.deadline;

  return (
    <article className="cam-campaign-card" aria-labelledby={titleId}>
      <header className="cam-campaign-card-head">
        <div className="cam-campaign-card-heading">
          <div className="cam-campaign-card-tags">
            <span className="cam-badge cam-badge-neutral">{moduleLabel(t, c.collectionType)}</span>
            {c.referenceYear && c.referenceQuarter && (
              <span className="cam-badge cam-badge-neutral">{quarterRef(t, c.referenceYear, c.referenceQuarter)}</span>
            )}
            <StatusBadge status={c.status} />
          </div>
          <h3 id={titleId} className="cam-campaign-card-title" title={`${c.name} (${c.code})`}>{formatCampaignDisplayName(c.name)}</h3>
          <span className="cam-campaign-code">{c.code}</span>
        </div>
        <div className={`cam-campaign-remaining ${remaining.tone ?? ""}`}>
          <span className="cam-campaign-remaining-value">{remaining.value}</span>
          <span className="cam-campaign-remaining-label">{t("daysRemaining")}</span>
        </div>
      </header>

      {c.description && <p className="cam-campaign-card-description">{c.description}</p>}

      {percent != null && (
        <div className="cam-campaign-period">
          <div className="cam-campaign-period-labels">
            <span>{t("factOpening")} · {fmt(c.startDate)}</span>
            <span>{t("factDeadline")} · {fmt(effectiveDeadline(c))}</span>
          </div>
          <div
            className="cam-campaign-period-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label={t("periodElapsed", { percent })}
          >
            <span className={`cam-campaign-period-fill ${remaining.tone ?? ""}`} style={{ inlineSize: `${percent}%` }} />
          </div>
          <span className="cam-admin-meta">{t("periodElapsed", { percent })}</span>
        </div>
      )}

      <dl className="cam-campaign-facts">
        {percent == null && (
          <>
            <div><dt>{t("factOpening")}</dt><dd>{fmt(c.startDate)}</dd></div>
            <div><dt>{t("factDeadline")}</dt><dd>{fmt(effectiveDeadline(c))}</dd></div>
          </>
        )}
        <div>
          <dt>{t("targetedEstablishments")}</dt>
          <dd>{count(c.progress?.total, locale)}</dd>
        </div>
        <div>
          <dt>{t("submissionsCollected")}</dt>
          <dd title={t("trackingUnavailable")}>—</dd>
        </div>
        <div className="cam-campaign-facts-wide">
          <dt>{t("targetTypesLabel")}</dt>
          <dd>
            {types.length === 0 ? t("allEstablishmentTypes") : (
              <ul className="cam-campaign-type-list">
                {types.map((type) => <li key={type}>{typeLabel(tRoot, type)}</li>)}
              </ul>
            )}
          </dd>
        </div>
        {extended && (
          <div className="cam-campaign-facts-wide">
            <dt>{t("detailExtension")}</dt>
            <dd>{t("extendedWas", { date: fmt(c.deadline) })}</dd>
          </div>
        )}
      </dl>

      <footer className="cam-campaign-card-actions">
        <div className="cam-campaign-card-actions-main" role="group" aria-label={t("campaignActionsGroup")}>
          <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={onDetails}>{t("viewDetails")}</button>
          <Gated allowed={canMutate}>
            {(disabled) => (
              <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled={disabled} style={disabled ? GATED_OFF : undefined} onClick={onRemind}>
                {t("remindTitle")}
              </button>
            )}
          </Gated>
          {/* POST /campaigns/:id/extend refuses registration campaigns. */}
          {!isRegistrationCampaign(c) && (
            <Gated allowed={canMutate}>
              {(disabled) => (
                <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled={disabled} style={disabled ? GATED_OFF : undefined} onClick={onExtend}>
                  {t("extend")}
                </button>
              )}
            </Gated>
          )}
        </div>
        <div className="cam-campaign-card-actions-lifecycle" role="group" aria-label={t("lifecycleGroup")}>
          <Gated allowed={canMutate}>
            {(disabled) => (
              <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled={disabled || pausePending} style={disabled ? GATED_OFF : undefined} onClick={onPause}>
                {t("pause")}
              </button>
            )}
          </Gated>
          <Gated allowed={canMutate}>
            {(disabled) => (
              <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled={disabled} style={disabled ? GATED_OFF : undefined} onClick={onArchive}>
                {t("archive")}
              </button>
            )}
          </Gated>
          <Gated allowed={canMutate}>
            {(disabled) => (
              <button type="button" className="cam-button cam-button-danger cam-button-sm" disabled={disabled} style={disabled ? GATED_OFF : undefined} onClick={onClose}>
                {t("closeCampaign")}
              </button>
            )}
          </Gated>
        </div>
      </footer>
    </article>
  );
}

// ── Détails (GET /campaigns/:id) ────────────────────────────────────────────

function DetailsDialog({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const detailQuery = useQuery({ queryKey: ["campaigns", "detail", campaign.id], queryFn: () => getCampaign(campaign.id) });
  const d: CampaignDetail | undefined = detailQuery.data;
  const tRoot = useTranslations();
  const t = useTranslations("adminCampagnesPage");
  const locale = asUiLocale(useLocale());
  const list = (values: string[] | undefined, label: (v: string) => string = (v) => v) =>
    values && values.length > 0 ? values.map(label).join(", ") : t("all");
  const creator = d?.creator ? [d.creator.firstName, d.creator.lastName].filter(Boolean).join(" ") || d.creator.email : "—";

  return (
    <AdminDialog
      open
      wide
      onClose={onClose}
      eyebrow={referencePeriodLabel(campaign.code, locale)}
      title={campaign.name}
      footer={<button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={onClose}>{t("close")}</button>}
    >
      {detailQuery.isLoading && <div className="cam-admin-empty">{tRoot("common.loading")}</div>}
      {detailQuery.isError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>{t("detailLoadError", { message: (detailQuery.error as Error).message })}</span>
        </div>
      )}
      {d && (
        <>
          <dl className="cam-admin-kv">
            <div><dt>{t("detailStatus")}</dt><dd><StatusBadge status={d.status} registration={isRegistrationCampaign(d)} /></dd></div>
            <div><dt>{t("detailModule")}</dt><dd>{moduleLabel(t, d.collectionType)}</dd></div>
            {d.referenceYear && d.referenceQuarter && (
              <div><dt>{t("detailReferencePeriod")}</dt><dd>{quarterRef(t, d.referenceYear, d.referenceQuarter)}</dd></div>
            )}
            <div>
              <dt>{t("detailPeriodicity")}</dt>
              <dd>{campaignPeriodicity(d) ? t(`periodicity.${campaignPeriodicity(d)}`) : "—"}</dd>
            </div>
            <div>
              <dt>{t("detailPurpose")}</dt>
              <dd>{d.purpose ? t(`purpose.${d.purpose}`) : "—"}</dd>
            </div>
            <div><dt>{t("detailOpening")}</dt><dd>{fmt(d.startDate)}</dd></div>
            <div><dt>{t("detailDeadline")}</dt><dd>{fmt(d.deadline)}</dd></div>
            <div><dt>{t("detailExtension")}</dt><dd>{d.extendedDeadline ? fmt(d.extendedDeadline) : "—"}</dd></div>
            <div><dt>{t("detailClosedOn")}</dt><dd>{d.closedAt ? fmt(d.closedAt) : "—"}</dd></div>
            <div><dt>{t("detailCreatedBy")}</dt><dd>{creator}</dd></div>
            <div><dt>{t("detailRegions")}</dt><dd>{list(d.targetRegions)}</dd></div>
            <div><dt>{t("detailDepartments")}</dt><dd>{list(d.targetDepartments)}</dd></div>
            <div><dt>{t("detailEntityTypes")}</dt><dd>{list(d.targetEntityTypes, (type) => typeLabel(tRoot, type))}</dd></div>
            <div><dt>{t("targetedEstablishments")}</dt><dd>{count(campaign.progress?.total, locale)}</dd></div>
          </dl>
          {d.description && <p style={{ margin: 0 }}>{d.description}</p>}
          <div>
            <h3 className="cam-admin-label" style={{ margin: "0 0 var(--cam-space-2)" }}>{t("remindersSent")}</h3>
            {d.reminders && d.reminders.length > 0 ? (
              <div className="cam-table-wrapper">
                <table className="cam-table">
                  <thead>
                    <tr><th scope="col">{t("reminderDate")}</th><th scope="col">{t("reminderTypeColumn")}</th><th scope="col">{t("reminderSentCount")}</th><th scope="col">{t("reminderFailedCount")}</th></tr>
                  </thead>
                  <tbody>
                    {d.reminders.map((r) => (
                      <tr key={r.id}>
                        <td>{fmt(r.sentAt)}</td>
                        <td>{REMINDER_CODES.has(r.reminderType) ? t(`reminderType.${r.reminderType}`) : r.reminderType}</td>
                        <td>{r.recipientCount}</td>
                        <td style={{ color: r.failedCount > 0 ? "var(--cam-error)" : undefined }}>{r.failedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="cam-admin-meta" style={{ margin: 0 }}>{t("noReminder")}</p>
            )}
          </div>
        </>
      )}
    </AdminDialog>
  );
}

// ── Création de campagne (POST /campaigns) ─────────────────────────────────

function CreateCampaignDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (msg: string, registrationCampaignId?: string) => void;
}) {
  const tRoot = useTranslations();
  const t = useTranslations("adminCampagnesPage");
  const [purpose, setPurpose] = useState<CampaignPurpose>("COLLECTION");
  const [collectionType, setCollectionType] = useState<"DSMO" | "ONEFOP">("DSMO");
  const [periodicity, setPeriodicity] = useState<CampaignPeriodicity>("QUARTERLY");
  const registration = purpose === "REGISTRATION";
  // Registration targets feed the ONEFOP Couverture roll-up only, so an
  // inscription campaign is always ONEFOP. Derived rather than written into
  // collectionType, so switching back to Collecte restores the user's choice.
  const effectiveModule: "DSMO" | "ONEFOP" = registration ? "ONEFOP" : collectionType;

  // Today and today + 90 days in Cameroon (Africa/Douala), read once when the
  // form mounts. Lazy initialisers, so the clock is not read again on every
  // render. (The UTC date was the day before from 00:00 to 01:00 Douala.)
  const [startDate, setStartDate] = useState(() => doualaIsoDate(new Date()) ?? "");
  const [deadline, setDeadline] = useState(() => doualaIsoDate(new Date(Date.now() + 90 * 86_400_000)) ?? "");
  const [referenceYear, setReferenceYear] = useState("");
  const [referenceQuarter, setReferenceQuarter] = useState("");
  const [description, setDescription] = useState("");
  const [autoReminders, setAutoReminders] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createCampaign({
        collectionType: effectiveModule,
        periodicity,
        purpose,
        startDate: new Date(startDate).toISOString(),
        deadline: new Date(deadline).toISOString(),
        description: description.trim() || undefined,
        // A registration campaign reaches no respondent, so it sends no reminder.
        autoReminders: registration ? false : autoReminders,
        referenceYear: effectiveModule === "ONEFOP" ? Number(referenceYear) : undefined,
        referenceQuarter: effectiveModule === "ONEFOP" ? Number(referenceQuarter) : undefined,
      }),
    onSuccess: (campaign) => {
      onCreated(
        registration ? t("registrationCreated") : t("collectionCreated"),
        registration ? campaign.id : undefined,
      );
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !deadline) {
      setError(t("errorDates"));
      return;
    }
    if (new Date(deadline) <= new Date(startDate)) {
      setError(t("errorDeadlineOrder"));
      return;
    }
    if (effectiveModule === "ONEFOP") {
      if (!referenceYear || !referenceQuarter) {
        setError(t("errorReference"));
        return;
      }
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      eyebrow={registration ? t("newTarget") : t("newCollection")}
      title={registration ? t("defineRegistration") : t("launchCensus")}
      footer={
        <>
          <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={onClose} disabled={mutation.isPending}>
            {tRoot("common.cancel")}
          </button>
          <button
            type="button"
            className="cam-button cam-button-primary cam-button-sm"
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? t("creating") : registration ? t("createCampaign") : t("launchCampaign")}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
        {error && (
          <div role="alert" className="cam-admin-notice cam-admin-notice--error" style={{ marginBottom: "var(--cam-space-2)" }}>
            <span>{error}</span>
          </div>
        )}

        <div className="cam-field">
          <label className="cam-admin-label" htmlFor="cam-purpose">{t("purposeLabel")}</label>
          <select
            id="cam-purpose"
            className="cam-select"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as CampaignPurpose)}
            aria-describedby={registration ? "cam-purpose-hint" : undefined}
          >
            <option value="COLLECTION">{t("purposeCollection")}</option>
            <option value="REGISTRATION">{t("purposeRegistration")}</option>
          </select>
          {registration && (
            <p id="cam-purpose-hint" className="cam-admin-meta" style={{ margin: "var(--cam-space-1) 0 0" }}>
              {t("purposeHint")}
            </p>
          )}
        </div>

        {registration ? (
          <div className="cam-field" role="group" aria-labelledby="cam-col-type-label" aria-describedby="cam-module-registration-hint">
            <span id="cam-col-type-label" className="cam-admin-label">{t("moduleLabel")}</span>
            <p style={{ margin: 0 }}>{t("moduleOnefop")}</p>
            <p id="cam-module-registration-hint" className="cam-admin-meta" style={{ margin: 0 }}>
              {t("registrationOnefopOnly")}
            </p>
          </div>
        ) : (
          <div className="cam-field">
            <label className="cam-admin-label" htmlFor="cam-col-type">{t("moduleLabel")}</label>
            <select
              id="cam-col-type"
              className="cam-select"
              value={collectionType}
              onChange={(e) => setCollectionType(e.target.value as "DSMO" | "ONEFOP")}
            >
              <option value="DSMO">{t("moduleDsmo")}</option>
              <option value="ONEFOP">{t("moduleOnefop")}</option>
            </select>
          </div>
        )}

        {effectiveModule === "ONEFOP" && (
          <section className="cam-admin-form-section" aria-labelledby="cam-reference-period-title">
            <h3 id="cam-reference-period-title" className="cam-admin-form-heading">{t("referencePeriodTitle")}</h3>
            <p className="cam-admin-meta">{t("referencePeriodDescription")}</p>
            <div className="cam-admin-form-pair">
              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="cam-ref-year">{t("referenceYear")}</label>
                <input
                  id="cam-ref-year"
                  type="number"
                  className="cam-input"
                  placeholder={t("referenceYearPlaceholder")}
                  value={referenceYear}
                  onChange={(e) => setReferenceYear(e.target.value)}
                  min={2000}
                  max={2100}
                  required
                />
              </div>
              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="cam-ref-quarter">{t("referenceQuarter")}</label>
                <select
                  id="cam-ref-quarter"
                  className="cam-select"
                  value={referenceQuarter}
                  onChange={(e) => setReferenceQuarter(e.target.value)}
                  required
                >
                  <option value="" hidden>{t("select")}</option>
                  <option value="1">{t("quarter1")}</option>
                  <option value="2">{t("quarter2")}</option>
                  <option value="3">{t("quarter3")}</option>
                  <option value="4">{t("quarter4")}</option>
                </select>
              </div>
            </div>
          </section>
        )}

        <section className="cam-admin-form-section" aria-labelledby="cam-schedule-title">
          <h3 id="cam-schedule-title" className="cam-admin-form-heading">{t("campaignScheduleTitle")}</h3>
          <p className="cam-admin-meta">{t("campaignScheduleDescription")}</p>
          <div className="cam-field">
            <label className="cam-admin-label" htmlFor="cam-freq-type">{t("periodicityLabel")}</label>
            <select
              id="cam-freq-type"
              className="cam-select"
              value={periodicity}
              onChange={(e) => setPeriodicity(e.target.value as CampaignPeriodicity)}
              aria-describedby="cam-periodicity-hint"
            >
              {CAMPAIGN_PERIODICITIES.map((value) => (
                <option key={value} value={value}>
                  {t(`periodicity.${value}`)}
                </option>
              ))}
            </select>
            <p id="cam-periodicity-hint" className="cam-admin-meta">{t("periodicityHint")}</p>
          </div>

          <div className="cam-admin-form-pair">
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="cam-start-date">{t("startDate")} <span aria-hidden="true">*</span></label>
              <input
                id="cam-start-date"
                type="date"
                className="cam-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="cam-deadline">{t("deadlineLabel")} <span aria-hidden="true">*</span></label>
              <input
                id="cam-deadline"
                type="date"
                className="cam-input"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                required
              />
            </div>
          </div>
        </section>

        <div className="cam-field">
          <label className="cam-admin-label" htmlFor="cam-desc">{t("descriptionLabel")}</label>
          <textarea
            id="cam-desc"
            className="cam-textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              registration ? t("descriptionRegistration") : t("descriptionCollection")
            }
          />
        </div>

        {!registration && (
          <label className="cam-admin-choice">
            <input
              type="checkbox"
              checked={autoReminders}
              onChange={(e) => setAutoReminders(e.target.checked)}
            />
            <span>{t("autoReminders")}</span>
          </label>
        )}
      </form>
    </AdminDialog>
  );
}
