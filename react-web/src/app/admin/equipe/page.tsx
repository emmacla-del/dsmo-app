"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale, type UiLocale } from "@/lib/register-i18n";
import { useAuthStore } from "@/lib/auth-store";
import { AUDIT_ROLES, MONITORING_ROLES, hasRole } from "@/lib/roles";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import {
  ACTOR_SUMMARY_PERIODS,
  ACTOR_SUMMARY_QUERY_KEY,
  MONITORED_ROLES,
  NUDGE_TEMPLATE_OPTIONS,
  getActorSummary,
  sendNudge,
  type ActorSummaryActor,
  type ActorSummaryPeriod,
  type NudgeTemplate,
} from "@/lib/actor-summary";
import { nudgePreview } from "@/lib/nudge-preview";

/**
 * Territorial Admin Monitoring Dashboard — Phase 4 of
 * docs/plans/territorial-admin-monitoring.md.
 *
 * Gives central admins, super admins and regional admins visibility into
 * territorial staff activity (field registrations, conversions, coverage vs
 * target, decision throughput and backlog/stale items) plus a "Relancer"
 * nudge action.
 *
 * Role gating: SUPER_ADMIN, ADMIN_ONEFOP, REGIONAL_ADMIN (MONITORING_ROLES).
 * Scoping: REGIONAL_ADMIN is narrowed to its own region server-side.
 */
export default function EquipePage() {
  return (
    <Suspense fallback={null}>
      <EquipeContent />
    </Suspense>
  );
}

function EquipeContent() {
  const { isLoading, forbidden } = useAdminScreenGuard(MONITORING_ROLES);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const t = useTranslations();
  const locale = asUiLocale(useLocale());
  const { regions: territoryRegions } = useTerritoryRegions();

  // Filters
  const [period, setPeriod] = useState<ActorSummaryPeriod>("30d");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<string>("");

  // Nudge modal state
  const [nudgeTarget, setNudgeTarget] = useState<ActorSummaryActor | null>(null);
  const [nudgeTemplate, setNudgeTemplate] = useState<NudgeTemplate>("STALE_BACKLOG");
  const [customMessage, setCustomMessage] = useState<string>("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const isRegional = user?.role === "REGIONAL_ADMIN";

  const summaryQuery = useQuery({
    queryKey: [...ACTOR_SUMMARY_QUERY_KEY, { period, role: roleFilter, region: regionFilter }],
    queryFn: () =>
      getActorSummary({
        period,
        role: roleFilter || undefined,
        region: (isRegional ? undefined : regionFilter) || undefined,
      }),
    enabled: !isLoading && !forbidden,
  });

  const nudgeMutation = useMutation({
    mutationFn: sendNudge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTOR_SUMMARY_QUERY_KEY });
      setNotice({
        tone: "success",
        text: t("adminEquipePage.nudgeSent", { name: nudgeTarget?.displayName ?? t("adminEquipePage.nudgeSentFallbackName") }),
      });
      closeNudgeModal();
    },
    onError: (err: Error) => {
      setNotice({
        tone: "error",
        text: err.message || t("adminEquipePage.nudgeFailed"),
      });
    },
  });

  function openNudgeModal(actor: ActorSummaryActor) {
    setNudgeTarget(actor);
    // Sensible default based on the actor's state
    if (actor.processing.stale > 0) {
      setNudgeTemplate("STALE_BACKLOG");
    } else if (actor.coverage.percent != null && actor.coverage.percent < 0.5) {
      setNudgeTemplate("BEHIND_TARGET");
    } else {
      setNudgeTemplate("NO_RECENT_ACTIVITY");
    }
    setCustomMessage("");
  }

  function closeNudgeModal() {
    setNudgeTarget(null);
    setCustomMessage("");
  }

  function handleSendNudge(e: React.FormEvent) {
    e.preventDefault();
    if (!nudgeTarget) return;
    nudgeMutation.mutate({
      userId: nudgeTarget.userId,
      template: nudgeTemplate,
      customMessage: customMessage.trim() || undefined,
    });
  }

  const actors = summaryQuery.data?.actors ?? [];
  // The server's threshold; the reminder dialog only opens from a loaded summary.
  const staleAfterDays = summaryQuery.data?.staleAfterDays;

  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <p className="cam-admin-lede">{t("adminEquipePage.accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: t("adminNav.hubs.supervision") }, { label: t("adminNav.routes.equipe") }]}
        title={t("adminNav.routes.equipe")}
        subtitle={t("adminEquipePage.subtitle")}
        actions={<AdminHeaderActions showCampaignPill={false} />}
      />

      {/* Notice / Feedback */}
      {notice && (
        <div
          role="alert"
          className={`cam-admin-notice cam-admin-notice--${notice.tone}`}
          style={{ marginBottom: 16 }}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            className="cam-admin-notice-close"
            aria-label={t("adminEquipePage.closeAriaLabel")}
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <section
        aria-label={t("adminEquipePage.filtersAriaLabel")}
        className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs mb-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          {/* Période */}
          <div>
            <label
              htmlFor="filter-period"
              className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5"
            >
              {t("adminEquipePage.periodLabel")}
            </label>
            <div className="relative">
              <select
                id="filter-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value as ActorSummaryPeriod)}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
              >
                {ACTOR_SUMMARY_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {t(`adminEquipePage.period.${p}`)}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1 1 5 5 9 1" />
                </svg>
              </div>
            </div>
          </div>

          {/* Rôle */}
          <div>
            <label
              htmlFor="filter-role"
              className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5"
            >
              {t("adminEquipePage.roleLabel")}
            </label>
            <div className="relative">
              <select
                id="filter-role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
              >
                <option value="">{t("adminEquipePage.allTerritorialRoles")}</option>
                {MONITORED_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {t(`adminEquipePage.roleOption.${r.value}`)}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1 1 5 5 9 1" />
                </svg>
              </div>
            </div>
          </div>

          {/* Région (disabled/hidden for regional admin whose scope is already fixed) */}
          <div>
            <label
              htmlFor="filter-region"
              className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5"
            >
              {t("adminEquipePage.regionLabel")}
            </label>
            <div className="relative">
              <select
                id="filter-region"
                value={isRegional ? user?.region ?? "" : regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                disabled={isRegional}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer disabled:bg-slate-50 disabled:text-slate-500"
              >
                {!isRegional && <option value="">{t("adminEquipePage.allRegions")}</option>}
                {isRegional ? (
                  <option value={user?.region ?? ""}>{user?.region ?? t("adminEquipePage.myRegion")}</option>
                ) : (
                  territoryRegions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1 1 5 5 9 1" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Table / Cards List ── */}
      {summaryQuery.isLoading && <p className="cam-admin-lede">{t("adminEquipePage.loading")}</p>}

      {summaryQuery.isError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          {t("adminEquipePage.loadError")}
        </div>
      )}

      {!summaryQuery.isLoading && !summaryQuery.isError && actors.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
          {t("adminEquipePage.empty")}
        </div>
      )}

      {!summaryQuery.isLoading && !summaryQuery.isError && actors.length > 0 && (
        <div className="space-y-4">
          {actors.map((actor) => (
            <ActorCard key={actor.userId} actor={actor} onNudge={() => openNudgeModal(actor)} />
          ))}
        </div>
      )}

      {/* ── Relancer Modal ── */}
      <AdminDialog
        open={!!nudgeTarget}
        onClose={closeNudgeModal}
        title={t("adminEquipePage.nudgeTitle", { name: nudgeTarget?.displayName ?? "" })}
        eyebrow={t("adminEquipePage.nudgeEyebrow")}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              className="cam-button cam-button-secondary"
              onClick={closeNudgeModal}
              disabled={nudgeMutation.isPending}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              form="nudge-form"
              className="cam-button cam-button-primary"
              disabled={nudgeMutation.isPending}
            >
              {nudgeMutation.isPending ? t("adminEquipePage.sending") : t("adminEquipePage.sendNudge")}
            </button>
          </div>
        }
      >
        {nudgeTarget && staleAfterDays != null && (
          <form id="nudge-form" onSubmit={handleSendNudge} className="space-y-4">
            <div>
              <label htmlFor="nudge-template" className="block text-xs font-semibold text-slate-700 mb-1">
                {t("adminEquipePage.templateLabel")}
              </label>
              <select
                id="nudge-template"
                value={nudgeTemplate}
                onChange={(e) => setNudgeTemplate(e.target.value as NudgeTemplate)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644]"
              >
                {NUDGE_TEMPLATE_OPTIONS.map((template) => (
                  <option key={template} value={template}>
                    {t(`adminEquipePage.template.${template}`, { days: staleAfterDays })}
                  </option>
                ))}
              </select>
            </div>

            {/* Template preview hint. The quoted text previews what the server
                sends, which is French; it is not translated, so the preview
                never shows a message the recipient will not receive. Its
                figures come from the summary (lib/nudge-preview.ts). */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
              <span className="font-semibold text-slate-700 block mb-1">{t("adminEquipePage.previewLabel")}</span>
              {(() => {
                const preview = nudgePreview(nudgeTemplate, nudgeTarget, { staleAfterDays });
                return preview ? <span>&ldquo;{preview}&rdquo;</span> : null;
              })()}
              {nudgeTemplate === "STALE_BACKLOG" && nudgeTarget.processing.stale === 0 && (
                <span className="text-amber-700 block mt-1">
                  {t("adminEquipePage.noStaleWarning", { days: staleAfterDays })}
                </span>
              )}
              {nudgeTemplate === "BEHIND_TARGET" && nudgeTarget.coverage.percent == null && (
                <span className="text-amber-700 block mt-1">
                  {t("adminEquipePage.noTargetWarning")}
                </span>
              )}
              {locale === "en" && (
                <span className="block mt-1 text-slate-500">{t("adminEquipePage.previewNote")}</span>
              )}
            </div>

            <div>
              <label htmlFor="nudge-message" className="block text-xs font-semibold text-slate-700 mb-1">
                {t("adminEquipePage.customMessageLabel")}
              </label>
              <textarea
                id="nudge-message"
                rows={3}
                maxLength={500}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={t("adminEquipePage.customMessagePlaceholder")}
                className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644]"
              />
              <span className="text-[10px] text-slate-400 block text-right">
                {t("adminEquipePage.characterCount", { count: customMessage.length })}
              </span>
            </div>
          </form>
        )}
      </AdminDialog>
    </div>
  );
}

/**
 * Single Admin row/card matching Section 4b layout:
 * - Admin identity & last action
 * - Travail de terrain (registrations made, conversions, last registration)
 * - Ressort — Cible & Couverture (target, current, percentage bar)
 * - Traitement (backlog, stale, decisions, median time)
 * - Actions (Relancer, Voir le journal, Voir les inscriptions)
 */
function ActorCard({ actor, onNudge }: { actor: ActorSummaryActor; onNudge: () => void }) {
  // The journal is AUDIT_ROLES-only; ADMIN_ONEFOP and REGIONAL_ADMIN, who use
  // this page, would land on a refusal.
  const canReadAudit = hasRole(useAuthStore((s) => s.user?.role), AUDIT_ROLES);
  const t = useTranslations("adminEquipePage");
  const locale = asUiLocale(useLocale());
  const roleLabel =
    actor.role === "REGIONAL_ADMIN"
      ? t("roleRegionalAdmin")
      : actor.role === "DIVISIONAL_ADMIN"
        ? t("roleDepartmentalAdmin")
        : actor.role;

  const territoryLabel = [actor.region, actor.department].filter(Boolean).join(" — ") || t("unassigned");

  const percent = actor.coverage.percent;
  const percentText = percent != null ? `${Math.round(percent * 100)}%` : "—";

  return (
    <article className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 hover:border-slate-300 transition-colors">
      {/* Header: Identity + Quick Stats + Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-900">{actor.displayName}</h3>
            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {roleLabel}
            </span>
            <span className="text-xs text-slate-500 font-medium">({territoryLabel})</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {t("lastSystemAction")}{" "}
            <span className="font-semibold text-slate-700">
              {actor.lastActionAt ? formatDateTime(actor.lastActionAt, locale) : t("noActionRecorded")}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onNudge}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors shadow-2xs"
          >
            {t("nudgeButton")}
          </button>
          {canReadAudit && (
            <Link
              href={`/admin/journal-audit?actor=${encodeURIComponent(actor.userId)}`}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              {t("viewLogLink")}
            </Link>
          )}
          <Link
            href={`/admin/inscriptions?createdBy=${encodeURIComponent(actor.userId)}`}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            {t("viewRegistrationsLink")}
          </Link>
        </div>
      </div>

      {/* 3 Metrics Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Section 1: Travail de terrain */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            {t("fieldWorkTitle")}
          </h4>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-600">{t("assistedRegistrations")}</span>
              <strong className="text-slate-900">{actor.field.registrationsMade}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{t("conversions")}</span>
              <strong className="text-slate-900">
                {actor.field.conversions}{" "}
                {actor.field.conversionRate != null && (
                  <span className="text-slate-500 font-normal">
                    ({Math.round(actor.field.conversionRate * 100)}%)
                  </span>
                )}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{t("lastRegistration")}</span>
              <span className="text-slate-700 font-medium">
                {actor.field.lastRegistrationAt
                  ? formatDateOnly(actor.field.lastRegistrationAt, locale)
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Ressort — Cible & Couverture */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            {t("coverageTitle")}
          </h4>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-600">{t("registeredOverTarget")}</span>
              <span className="font-semibold text-slate-900">
                {actor.coverage.current != null ? actor.coverage.current : "—"} /{" "}
                {actor.coverage.target != null ? actor.coverage.target : "—"}
              </span>
            </div>
            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-500">{t("coverageRate")}</span>
                <span className="font-bold text-slate-900">{percentText}</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#006644] h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, (percent ?? 0) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Traitement */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            {t("processingTitle")}
          </h4>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-600">{t("pendingQueue")}</span>
              <span className="font-semibold text-slate-900">
                {t("backlogFiles", { count: actor.processing.backlog })}
                {actor.processing.stale > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                    {t("staleBadge", { count: actor.processing.stale })}
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{t("decisionsMade")}</span>
              <span className="font-medium text-slate-800">
                <span className="text-emerald-700 font-semibold" title={t("approvedTitle")}>
                  {t("approvedShort", { count: actor.processing.decisions.approved })}
                </span>{" "}
                /{" "}
                <span className="text-rose-700 font-semibold" title={t("rejectedTitle")}>
                  {t("rejectedShort", { count: actor.processing.decisions.rejected })}
                </span>{" "}
                /{" "}
                <span className="text-amber-700 font-semibold" title={t("correctionsTitle")}>
                  {t("correctionsShort", { count: actor.processing.decisions.corrections })}
                </span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{t("medianDecisionTime")}</span>
              <span className="font-medium text-slate-700">
                {actor.processing.medianDaysToDecision != null
                  ? t("medianDays", { days: actor.processing.medianDaysToDecision })
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function intlLocale(locale: UiLocale): string {
  return locale === "en" ? "en-GB" : "fr-FR";
}

function formatDateTime(iso: string, locale: UiLocale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(intlLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(iso: string, locale: UiLocale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(intlLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
