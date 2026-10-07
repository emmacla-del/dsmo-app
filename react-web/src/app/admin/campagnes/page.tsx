"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
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
  canArchive,
  canDelete,
  isRegistrationCampaign,
  type Campaign,
  type CampaignDetail,
  type CampaignPeriodicity,
  type CampaignPurpose,
} from "@/lib/campaigns";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { asUiLocale, type UiLocale } from "@/lib/register-i18n";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { useAuthStore } from "@/lib/auth-store";
import { CAMPAIGN_ROLES, NATIONAL_ROLES, hasRole } from "@/lib/roles";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";

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
const isPast = (iso: string | null | undefined) => !!iso && new Date(iso).getTime() < Date.now();

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

export function formatCampaignDisplayName(name: string): string {
  if (!name) return "—";
  if (name.includes("COLLECTE DES DONNEES SUR LES EMPLOIS") || name.includes("SECTEUR MODERNE")) {
    return "Collecte des données sur les emplois (Secteur moderne)";
  }
  if (name.includes("DECLARATION SUR LA SITUATION DE LA MAIN D'OEUVRE") || name.includes("MAIN D'OEUVRE")) {
    return "Déclaration sur la situation de la main d'œuvre (DSMO)";
  }
  if (name.length > 40 && name === name.toUpperCase()) {
    return name.charAt(0) + name.slice(1).toLowerCase();
  }
  return name;
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
  | { type: "delete"; campaign: Campaign }
  | { type: "details"; campaign: Campaign }
  | null;

export default function CampagnesPage() {
  const { isLoading, forbidden } = useAdminScreenGuard(CAMPAIGN_ROLES);
  const role = useAuthStore((s) => s.user?.role);
  const canMutate = hasRole(role, NATIONAL_ROLES);
  const queryClient = useQueryClient();
  const tRoot = useTranslations();
  const t = useTranslations("adminCampagnesPage");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reminderType, setReminderType] = useState(REMINDER_TYPES[0].value);
  const [extendDate, setExtendDate] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const allQuery = useQuery({
    queryKey: ["campaigns", "all"],
    queryFn: () => listCampaigns(),
    enabled: !isLoading && !forbidden,
  });

  const done = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    setActionSuccess(message);
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

  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <p className="cam-admin-lede">{t("forbidden")}</p>
      </div>
    );
  }

  const campaigns: Campaign[] = allQuery.data ?? [];
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");
  const otherCampaigns = campaigns.filter((c) => c.status !== "ACTIVE");
  const openRemind = (campaign: Campaign) => { setReminderType(REMINDER_TYPES[0].value); setDialog({ type: "remind", campaign }); };
  const openExtend = (campaign: Campaign) => { setExtendDate(""); setDialog({ type: "extend", campaign }); };

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: tRoot("adminNav.hubs.collecte") }, { label: tRoot("adminNav.routes.campagnes") }]}
        title={tRoot("adminNav.routes.campagnes")}
        actions={
          <div style={{ display: "flex", gap: "var(--cam-space-2)", alignItems: "center" }}>
            <AdminHeaderActions />
            <Gated allowed={canMutate}>
              {(disabled) => (
                <button
                  type="button"
                  className="cam-button cam-button-primary cam-button-sm"
                  disabled={disabled}
                  style={disabled ? GATED_OFF : undefined}
                  onClick={() => setCreateOpen(true)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 6 }}>
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  {t("launchButton")}
                </button>
              )}
            </Gated>
          </div>
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
          <button type="button" className="cam-admin-notice-close" aria-label={t("closeAriaLabel")} onClick={() => setActionSuccess(null)}>×</button>
        </div>
      )}

      {/* ── Active campaign(s): one per module can be open at once ── */}
      {allQuery.isLoading ? null : activeCampaigns.length === 0 ? (
        <div className="cam-campaign-banner cam-campaign-banner--idle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <div className="cam-campaign-banner-title">{t("noActiveTitle")}</div>
            <div className="cam-campaign-banner-meta">{t("noActiveHint")}</div>
          </div>
        </div>
      ) : (
        activeCampaigns.map((c) => (
          <ActiveCampaignCard
            key={c.id}
            campaign={c}
            canMutate={canMutate}
            pausePending={pauseMutation.isPending}
            onDetails={() => setDialog({ type: "details", campaign: c })}
            onRemind={() => openRemind(c)}
            onExtend={() => openExtend(c)}
            onPause={() => pauseMutation.mutate(c.id)}
            onClose={() => setDialog({ type: "close", campaign: c })}
            onArchive={() => setDialog({ type: "archive", campaign: c })}
          />
        ))
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--cam-space-4)", alignItems: "flex-start" }}>
        {/* ── History ── */}
        <section className="cam-pilot-panel" style={{ flex: "3 1 640px", minWidth: 0, overflow: "hidden" }} aria-labelledby="campagnes-history-title">
          <div className="cam-pilot-panel-head">
            <h2 className="cam-admin-h2" id="campagnes-history-title">{t("historyTitle")}</h2>
            <span className="cam-admin-meta">{t("campaignCount", { count: otherCampaigns.length })}</span>
          </div>
          <div className="cam-pilot-panel-body" style={otherCampaigns.length > 0 && !allQuery.isError ? { padding: 0 } : undefined}>
            {allQuery.isLoading ? (
              <div className="cam-admin-empty">{tRoot("common.loading")}</div>
            ) : allQuery.isError ? (
              <div role="alert" className="cam-admin-notice cam-admin-notice--error">
                <span>{t("loadError", { message: (allQuery.error as Error).message })}</span>
              </div>
            ) : otherCampaigns.length === 0 ? (
              <div className="cam-admin-empty">
                <strong>{t("noOtherTitle")}</strong>
                {t("noOtherHint")}
              </div>
            ) : (
              // Wide tables scroll horizontally inside the panel; no second bordered box.
              <div style={{ overflowX: "auto" }}>
                <table className="cam-table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: "42%" }}>{t("campaignColumn")}</th>
                      <th scope="col">{t("typeColumn")}</th>
                      <th scope="col">{t("openingColumn")}</th>
                      <th scope="col">{t("closingColumn")}</th>
                      <th scope="col">{t("statusColumn")}</th>
                      <th scope="col" style={{ textAlign: "right" }}>{t("actionsColumn")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherCampaigns.map((c) => (
                      <tr key={c.id}>
                        <td style={{ maxWidth: 360, padding: "10px 14px", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                            <div
                              className="cam-admin-strong"
                              title={c.name}
                              style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "var(--cam-text)",
                                minWidth: 0,
                              }}
                            >
                              {formatCampaignDisplayName(c.name)}
                            </div>
                            {/* Same name as the collection campaign of the quarter; the tag tells them apart. Collection rows stay untagged. */}
                            {isRegistrationCampaign(c) && (
                              <span className="cam-badge cam-badge-info" style={{ fontSize: "11px", fontWeight: 600, flexShrink: 0 }}>
                                {t("purpose.REGISTRATION")}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                            <span className="cam-admin-code cam-admin-muted" style={{ fontSize: "11px" }}>{c.code}</span>
                          </div>
                        </td>
                        <td className="cam-admin-meta" style={{ whiteSpace: "nowrap", padding: "10px 14px", verticalAlign: "middle" }}>
                          <span className="cam-badge cam-badge-neutral" style={{ fontSize: "11px", fontWeight: 600 }}>
                            {c.collectionType ?? (campaignPeriodicity(c) ? t(`periodicity.${campaignPeriodicity(c)}`) : "—")}
                          </span>
                          {c.referenceYear && c.referenceQuarter && (
                            <div style={{ fontSize: "11px", color: "var(--cam-text-muted)", marginTop: "2px" }}>
                              {quarterRef(t, c.referenceYear, c.referenceQuarter)}
                            </div>
                          )}
                        </td>
                        <td className="cam-admin-meta" style={{ whiteSpace: "nowrap", padding: "10px 14px", verticalAlign: "middle" }}>{fmt(c.startDate)}</td>
                        <td className="cam-admin-meta" style={{ whiteSpace: "nowrap", padding: "10px 14px", verticalAlign: "middle" }}>
                          {fmt(effectiveDeadline(c))}
                          {c.extendedDeadline && c.deadline && c.extendedDeadline !== c.deadline && (
                            <div className="cam-admin-meta" style={{ color: "var(--cam-info)", fontSize: "11px" }}>{t("extendedWas", { date: fmt(c.deadline) })}</div>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", verticalAlign: "middle" }}><StatusBadge status={c.status} registration={isRegistrationCampaign(c)} /></td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap", padding: "10px 14px", verticalAlign: "middle" }}>
                          <div style={{ display: "inline-flex", gap: "var(--cam-space-2)", alignItems: "center", justifyContent: "flex-end" }}>
                            {canActivate(c.status) && !isRegistrationCampaign(c) && (
                              <Gated allowed={canMutate}>
                                {(disabled) => (
                                  <button
                                    type="button"
                                    className="cam-button cam-button-primary cam-button-sm"
                                    onClick={() => activateMutation.mutate(c.id)}
                                    disabled={disabled || activateMutation.isPending}
                                    style={disabled ? GATED_OFF : undefined}
                                  >
                                    {t("activate")}
                                  </button>
                                )}
                              </Gated>
                            )}
                            {c.status === "DRAFT" && (
                              <Gated allowed={canMutate}>
                                {(disabled) => (
                                  <button
                                    type="button"
                                    className="cam-button cam-button-danger cam-button-sm"
                                    onClick={() => setDialog({ type: "delete", campaign: c })}
                                    disabled={disabled || deleteMutation.isPending}
                                    style={disabled ? GATED_OFF : undefined}
                                  >
                                    {t("delete")}
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
                              className="cam-text-button"
                              aria-label={t("viewDetailsOf", { name: c.name })}
                              title={t("viewDetails")}
                              onClick={() => setDialog({ type: "details", campaign: c })}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ── Side panels (first active campaign) ── */}
        {activeCampaigns[0] && (
          <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "var(--cam-space-4)", minWidth: 0 }}>
            <TargetsPanel campaign={activeCampaigns[0]} />
            <SchedulePanel campaign={activeCampaigns[0]} />
          </div>
        )}
      </div>

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

      {dialog?.type === "details" && <DetailsDialog campaign={dialog.campaign} onClose={() => setDialog(null)} />}
      <CreateCampaignDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(msg) => done(msg)}
      />
    </div>
  );
}

// ── Active campaign card ────────────────────────────────────────────────────

function ActiveCampaignCard({ campaign: c, canMutate, pausePending, onDetails, onRemind, onExtend, onPause, onClose, onArchive }: {
  campaign: Campaign; canMutate: boolean; pausePending: boolean;
  onDetails: () => void; onRemind: () => void; onExtend: () => void; onPause: () => void; onClose: () => void; onArchive: () => void;
}) {
  const t = useTranslations("adminCampagnesPage");
  const locale = asUiLocale(useLocale());
  const remaining = daysLeft(c, t);
  const expected = c.progress?.total;
  return (
    <section className="cam-admin-section" style={{ borderLeft: "4px solid var(--cam-green)" }} aria-label={t("activeCampaignAriaLabel", { name: c.name })}>
      <div className="cam-admin-section-body" style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--cam-space-3)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--cam-space-3)" }}>
            <h2 className="cam-admin-h2" style={{ margin: 0 }} title={c.name}>{formatCampaignDisplayName(c.name)}</h2>
            <span className="cam-admin-code" style={{ fontSize: "12px", background: "var(--cam-surface-subtle)", padding: "2px 8px", borderRadius: "4px" }}>
              {c.code}
            </span>
            {c.referenceYear && c.referenceQuarter && (
              <span className="cam-badge cam-badge-neutral" style={{ fontSize: "11px", fontWeight: 600 }}>
                {quarterRef(t, c.referenceYear, c.referenceQuarter)}
              </span>
            )}
            <StatusBadge status={c.status} />
          </div>
          <span className="cam-admin-meta">
            {t("dateRange", { start: fmt(c.startDate), end: fmt(effectiveDeadline(c)) })}
            {c.extendedDeadline && c.deadline && c.extendedDeadline !== c.deadline && <> {t("extendedWasInline", { date: fmt(c.deadline) })}</>}
          </span>
        </div>
        {c.description && <p className="cam-admin-meta" style={{ margin: 0 }}>{c.description}</p>}

        {/* Figma separates the figures with rules only: keep the strip's dividers, drop its box. */}
        <div className="cam-admin-stats" style={{ border: "none", background: "transparent" }}>
          <div className="cam-admin-stat">
            <div className="cam-admin-stat-label">{t("daysRemaining")}</div>
            <div className={`cam-admin-stat-value ${remaining.tone ?? ""}`}>{remaining.value}</div>
            <div className="cam-admin-stat-hint">{remaining.hint}</div>
          </div>
          <div className="cam-admin-stat">
            <div className="cam-admin-stat-label">{t("targetedEstablishments")}</div>
            <div className="cam-admin-stat-value">{typeof expected === "number" ? intlNumber(expected, locale) : "—"}</div>
            <div className="cam-admin-stat-hint">{t("expectedAtActivation")}</div>
          </div>
          <div className="cam-admin-stat">
            <div className="cam-admin-stat-label">{t("submissionsCollected")}</div>
            <div className="cam-admin-stat-value">—</div>
            <div className="cam-admin-stat-hint">{t("trackingUnavailable")}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "var(--cam-space-2)" }}>
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
      </div>
    </section>
  );
}

// ── Side panels ─────────────────────────────────────────────────────────────

function TargetsPanel({ campaign: c }: { campaign: Campaign }) {
  const tRoot = useTranslations();
  const t = useTranslations("adminCampagnesPage");
  const types = c.targetEntityTypes ?? [];
  return (
    <section className="cam-pilot-panel" aria-labelledby="campagnes-targets-title">
      <div className="cam-pilot-panel-head">
        <h2 className="cam-admin-h2" id="campagnes-targets-title">{t("assignedQuestionnaires")}</h2>
      </div>
      <div className="cam-pilot-panel-body">
        <p className="cam-admin-meta" style={{ margin: "0 0 var(--cam-space-2)" }}>
          {moduleLabel(t, c.collectionType)}
        </p>
        {types.length === 0 ? (
          <p style={{ margin: 0 }}>{t("allEstablishmentTypes")}</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {types.map((type) => (
              <li key={type} style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", padding: "var(--cam-space-2) 0", borderBottom: "var(--cam-border-width) solid var(--cam-border)" }}>
                <span aria-hidden="true" style={{ color: "var(--cam-green)", fontWeight: 700 }}>✓</span>
                <span className="cam-admin-strong">{typeLabel(tRoot, type)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SchedulePanel({ campaign: c }: { campaign: Campaign }) {
  const t = useTranslations("adminCampagnesPage");
  const deadline = effectiveDeadline(c);
  const steps = [
    { label: t("collectionLaunch"), date: c.startDate ?? null },
    { label: t("declarationDeadline"), date: deadline },
  ];
  return (
    <section className="cam-pilot-panel" aria-labelledby="campagnes-schedule-title">
      <div className="cam-pilot-panel-head">
        <h2 className="cam-admin-h2" id="campagnes-schedule-title">{t("scheduleTitle")}</h2>
      </div>
      <div className="cam-pilot-panel-body">
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
          {steps.map((s) => {
            const done = isPast(s.date);
            return (
              <li key={s.label} style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)" }}>
                <span className="cam-admin-strong" style={{ flex: 1 }}>{s.label}</span>
                <span className="cam-admin-meta" style={{ whiteSpace: "nowrap" }}>{fmt(s.date)}</span>
                {s.date && (
                  <span className={`cam-badge ${done ? "cam-badge-success" : "cam-badge-warning"}`}>{done ? t("done") : t("inProgress")}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
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
      eyebrow={campaign.code}
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
            <div><dt>{t("targetedEstablishments")}</dt><dd>{typeof campaign.progress?.total === "number" ? intlNumber(campaign.progress.total, locale) : "—"}</dd></div>
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
  onCreated: (msg: string) => void;
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

  // Today and today + 90 days, read once when the form mounts. Lazy
  // initialisers, so the clock is not read again on every render.
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [deadline, setDeadline] = useState(() => new Date(Date.now() + 90 * 86_400_000).toISOString().split("T")[0]);
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
    onSuccess: () => {
      onCreated(
        registration ? t("registrationCreated") : t("collectionCreated"),
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
            aria-describedby="cam-purpose-hint"
          >
            <option value="COLLECTION">{t("purposeCollection")}</option>
            <option value="REGISTRATION">{t("purposeRegistration")}</option>
          </select>
          <p id="cam-purpose-hint" className="cam-admin-meta" style={{ margin: "4px 0 0", fontSize: "12px" }}>
            {t("purposeHint")}
          </p>
        </div>

        {/* A disabled <select> shows no tooltip of its own, so the reason sits on the field wrapper. */}
        <div
          className="cam-field"
          title={registration ? t("registrationOnefopOnly") : undefined}
        >
          <label className="cam-admin-label" htmlFor="cam-col-type">{t("moduleLabel")}</label>
          <select
            id="cam-col-type"
            className="cam-select"
            value={effectiveModule}
            onChange={(e) => setCollectionType(e.target.value as "DSMO" | "ONEFOP")}
            disabled={registration}
            style={registration ? { pointerEvents: "none" } : undefined}
          >
            <option value="DSMO">{t("moduleDsmo")}</option>
            <option value="ONEFOP">{t("moduleOnefop")}</option>
          </select>
        </div>

        {effectiveModule === "ONEFOP" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--cam-space-3)" }}>
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
                  <option value="">{t("select")}</option>
                  <option value="1">{t("quarter1")}</option>
                  <option value="2">{t("quarter2")}</option>
                  <option value="3">{t("quarter3")}</option>
                  <option value="4">{t("quarter4")}</option>
                </select>
              </div>
            </div>
            <p className="cam-admin-meta" style={{ margin: "4px 0 0", fontSize: "12px" }}>
              {t("referenceHint")}
            </p>
          </div>
        )}

        <div className="cam-field">
          <label className="cam-admin-label" htmlFor="cam-freq-type">{t("periodicityLabel")}</label>
          <select
            id="cam-freq-type"
            className="cam-select"
            value={periodicity}
            onChange={(e) => setPeriodicity(e.target.value as CampaignPeriodicity)}
          >
            {CAMPAIGN_PERIODICITIES.map((value) => (
              <option key={value} value={value}>
                {t(`periodicity.${value}`)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--cam-space-3)" }}>
          <div className="cam-field">
            <label className="cam-admin-label" htmlFor="cam-start-date">{t("startDate")}</label>
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
            <label className="cam-admin-label" htmlFor="cam-deadline">{t("deadlineLabel")}</label>
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
          <label style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", cursor: "pointer", fontSize: "13px", marginTop: "var(--cam-space-1)" }}>
            <input
              type="checkbox"
              checked={autoReminders}
              onChange={(e) => setAutoReminders(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span>{t("autoReminders")}</span>
          </label>
        )}
      </form>
    </AdminDialog>
  );
}

function intlNumber(value: number, locale: UiLocale): string {
  return value.toLocaleString(locale === "en" ? "en-GB" : "fr-FR");
}
