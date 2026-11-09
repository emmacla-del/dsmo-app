"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { useAuthStore } from "@/lib/auth-store";
import { AUDIT_ROLES, MONITORING_ROLES, hasRole } from "@/lib/roles";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { AdminFilterPill } from "@/components/admin/AdminFilterPill";
import { AdminScopePill } from "@/components/admin/AdminFilterBarParts";
import { Button } from "@/components/ui/button";
import { hrefWith } from "@/lib/admin-url";
import { organisationsListHref } from "@/lib/inscriptions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import { NOT_PROVIDED, count, percent, resolveDataState, stamp } from "@/lib/admin-data-state";
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
import { formatApiError } from "@/lib/pilotage-targets";

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

/** A 0–1 ratio from the summary as a percent label, or the neutral marker. */
const DEFAULT_PERIOD: ActorSummaryPeriod = "30d";

function ratioLabel(ratio: number | null | undefined, locale: ReturnType<typeof asUiLocale>): string {
  return ratio == null ? NOT_PROVIDED : percent(ratio * 100, 0, locale);
}

function EquipeContent() {
  const { isLoading, forbidden } = useAdminScreenGuard(MONITORING_ROLES);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const t = useTranslations();
  const locale = asUiLocale(useLocale());
  const { regions: territoryRegions } = useTerritoryRegions();

  // Filters live in the URL (G15): ?periode=, ?role=, ?region=. The
  // period defaults to 30 days, the window the « Période » pill shows as off.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const rawPeriod = searchParams.get("periode") ?? "";
  const period: ActorSummaryPeriod = (ACTOR_SUMMARY_PERIODS as readonly string[]).includes(rawPeriod) ? rawPeriod as ActorSummaryPeriod : DEFAULT_PERIOD;
  const rawRole = searchParams.get("role") ?? "";
  const roleFilter = MONITORED_ROLES.some((r) => r.value === rawRole) ? rawRole : "";
  const regionFilter = searchParams.get("region")?.trim() ?? "";
  const setFilters = (changes: Record<string, string | null>) =>
    router.replace(hrefWith(pathname, currentQuery, changes), { scroll: false });

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
    onError: (err: unknown) => {
      setNotice({
        tone: "error",
        text: `${t("adminEquipePage.nudgeFailed")} ${formatApiError(err, locale)}`,
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
  // Missed claim deadlines: for supervisors only, as the server decides.
  const lapsesVisible = summaryQuery.data?.claimLapsesVisible === true;

  const header = (
    <AdminPageHeader
      breadcrumb={[{ label: t("adminNav.hubs.equipe") }, { label: t("adminNav.routes.equipe") }]}
      title={t("adminNav.routes.equipe")}
      subtitle={t("adminEquipePage.subtitle")}
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
          resource={t("adminNav.routes.equipe")}
          title={isLoading ? t("common.loading") : t("adminEquipePage.accessDenied")}
        />
      </div>
    );
  }

  // Loading, failure and "no one matches these filters" are three distinct
  // renders. Every state carries its own page-level title.
  const summaryState = resolveDataState({
    isLoading: summaryQuery.isLoading,
    isError: summaryQuery.isError,
    error: summaryQuery.error,
    rowCount: summaryQuery.data ? actors.length : null,
  });

  return (
    <div className="cam-admin-page">
      {header}

      {notice && (
        <div role="alert" className={`cam-admin-notice cam-admin-notice--${notice.tone}`}>
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

      {/* Filters and roster are one section: a national view lists every
          territorial actor as one row, so they can be compared column by
          column. */}
      <AdminTablePanel
        title={t("adminEquipePage.rosterTitle")}
        headingId="equipe-roster-title"
        description={t("adminEquipePage.rosterDescription")}
        meta={summaryState === "ready" ? t("adminEquipePage.rosterCount", { count: actors.length }) : undefined}
        toolbar={
          <div className="cam-filter-bar" role="group" aria-label={t("adminEquipePage.filtersAriaLabel")}>
            <AdminFilterPill
              label={t("adminEquipePage.periodLabel")}
              value={period === DEFAULT_PERIOD ? "" : period}
              allLabel={t(`adminEquipePage.period.${DEFAULT_PERIOD}`)}
              clearLabel={t("adminDossiersPage.removeFilterChip", { label: t("adminEquipePage.periodLabel") })}
              onChange={(value) => setFilters({ periode: value || null })}
              options={ACTOR_SUMMARY_PERIODS.filter((p) => p !== DEFAULT_PERIOD).map((p) => ({ value: p, label: t(`adminEquipePage.period.${p}`) }))}
            />
            <AdminFilterPill
              label={t("adminEquipePage.roleLabel")}
              value={roleFilter}
              allLabel={t("adminEquipePage.allTerritorialRoles")}
              clearLabel={t("adminDossiersPage.removeFilterChip", { label: t("adminEquipePage.roleLabel") })}
              onChange={(value) => setFilters({ role: value || null })}
              options={MONITORED_ROLES.map((r) => ({ value: r.value, label: t(`adminEquipePage.roleOption.${r.value}`) }))}
            />
            {/* A regional admin's scope is fixed server-side: it is shown
                locked instead of a region filter they cannot use. */}
            {isRegional ? <AdminScopePill /> : (
              <AdminFilterPill
                label={t("adminEquipePage.regionLabel")}
                value={regionFilter}
                allLabel={t("adminEquipePage.allRegions")}
                clearLabel={t("adminDossiersPage.removeFilterChip", { label: t("adminEquipePage.regionLabel") })}
                onChange={(value) => setFilters({ region: value || null })}
                options={territoryRegions.map((value) => ({ value, label: value }))}
              />
            )}
            {(period !== DEFAULT_PERIOD || roleFilter || (!isRegional && regionFilter)) && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setFilters({ periode: null, role: null, region: null })}>
                {t("adminDossiersPage.clearFilters")}
              </Button>
            )}
          </div>
        }
      >
        <div className="cam-equipe-table-scroll" role="region" tabIndex={0} aria-labelledby="equipe-roster-title">
          <table className="cam-table cam-equipe-table">
            <thead>
              <tr>
                <th scope="col">{t("adminEquipePage.column.actor")}</th>
                <th scope="col">{t("adminEquipePage.column.territory")}</th>
                <th scope="col" className="is-num">{t("adminEquipePage.column.registrations")}</th>
                <th scope="col" className="is-num">{t("adminEquipePage.column.conversions")}</th>
                <th scope="col" className="is-num">{t("adminEquipePage.column.coverage")}</th>
                <th scope="col" className="is-num">{t("adminEquipePage.column.backlog")}</th>
                <th scope="col" className="is-num">
                  {staleAfterDays != null
                    ? t("adminEquipePage.column.staleDays", { days: staleAfterDays })
                    : t("adminEquipePage.column.stale")}
                </th>
                {lapsesVisible && <th scope="col" className="is-num" title={t("adminEquipePage.claimLapsesTitle")}>{t("adminEquipePage.column.claimLapses")}</th>}
                <th scope="col">{t("adminEquipePage.column.decisions")}</th>
                <th scope="col" className="is-num">{t("adminEquipePage.column.medianDays")}</th>
                <th scope="col" className="text-right">{t("adminEquipePage.column.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {/* Loading, failure and "no one matches these filters" stay
                  three distinct renders. */}
              <DataStateRow
                colSpan={lapsesVisible ? 11 : 10}
                state={summaryState}
                resource={t("adminNav.routes.equipe")}
                error={summaryQuery.error}
                onRetry={() => summaryQuery.refetch()}
                title={
                  summaryState === "loading"
                    ? t("adminEquipePage.loading")
                    : summaryState === "error"
                      ? t("adminEquipePage.loadError")
                      : summaryState === "empty"
                        ? t("adminEquipePage.empty")
                        : undefined
                }
              />
              {summaryState === "ready" &&
                actors.map((actor) => (
                  <ActorRow key={actor.userId} actor={actor} showLapses={lapsesVisible} onNudge={() => openNudgeModal(actor)} />
                ))}
            </tbody>
          </table>
        </div>
      </AdminTablePanel>

      {/* ── Relancer Modal ── */}
      <AdminDialog
        open={!!nudgeTarget}
        onClose={closeNudgeModal}
        title={t("adminEquipePage.nudgeTitle", { name: nudgeTarget?.displayName ?? "" })}
        eyebrow={t("adminEquipePage.nudgeEyebrow")}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--cam-space-3)", width: "100%" }}>
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
          <form id="nudge-form" onSubmit={handleSendNudge}>
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="nudge-template">{t("adminEquipePage.templateLabel")}</label>
              <select
                id="nudge-template"
                className="cam-select"
                value={nudgeTemplate}
                onChange={(e) => setNudgeTemplate(e.target.value as NudgeTemplate)}
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
            <div className="cam-admin-notice cam-admin-notice--info" style={{ marginBottom: "var(--cam-space-4)" }}>
              <div>
                <strong style={{ display: "block" }}>{t("adminEquipePage.previewLabel")}</strong>
                {(() => {
                  const preview = nudgePreview(nudgeTemplate, nudgeTarget, { staleAfterDays });
                  return preview ? <span>&ldquo;{preview}&rdquo;</span> : null;
                })()}
                {nudgeTemplate === "STALE_BACKLOG" && nudgeTarget.processing.stale === 0 && (
                  <span className="cam-field-error" style={{ display: "block" }}>
                    {t("adminEquipePage.noStaleWarning", { days: staleAfterDays })}
                  </span>
                )}
                {nudgeTemplate === "BEHIND_TARGET" && nudgeTarget.coverage.percent == null && (
                  <span className="cam-field-error" style={{ display: "block" }}>
                    {t("adminEquipePage.noTargetWarning")}
                  </span>
                )}
                {locale === "en" && (
                  <span className="cam-admin-meta" style={{ display: "block" }}>{t("adminEquipePage.previewNote")}</span>
                )}
              </div>
            </div>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="nudge-message">{t("adminEquipePage.customMessageLabel")}</label>
              <textarea
                id="nudge-message"
                className="cam-admin-textarea"
                rows={3}
                maxLength={500}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={t("adminEquipePage.customMessagePlaceholder")}
              />
              <span className="cam-admin-meta" style={{ textAlign: "right" }}>
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
 * One territorial admin as one roster row: identity and last action, field
 * work (registrations, conversions), coverage against the quota, processing
 * (backlog, stale, decisions, median time), and the row's actions.
 */
function ActorRow({ actor, showLapses, onNudge }: { actor: ActorSummaryActor; showLapses: boolean; onNudge: () => void }) {
  // The journal is AUDIT_ROLES-only; ADMIN_ONEFOP and REGIONAL_ADMIN, who use
  // this page, would land on a refusal.
  const canReadAudit = hasRole(useAuthStore((s) => s.user?.role), AUDIT_ROLES);
  const t = useTranslations("adminEquipePage");
  const locale = asUiLocale(useLocale());
  const roleLabel = MONITORED_ROLES.some((r) => r.value === actor.role)
    ? t(`roleOption.${actor.role}`)
    : t("otherRole");

  const { decisions } = actor.processing;

  return (
    <tr>
      <td>
        <span className="cam-equipe-cell">
          <span className="cam-admin-strong">{actor.displayName}</span>
          <span className="cam-admin-meta">{roleLabel}</span>
          <span className="cam-admin-meta">
            {t("lastSystemAction")}{" "}
            {actor.lastActionAt ? stamp(actor.lastActionAt, true, locale) : t("noActionRecorded")}
          </span>
        </span>
      </td>
      <td>
        <span className="cam-equipe-cell">
          <span>{actor.region ?? t("unassigned")}</span>
          {actor.role === "DIVISIONAL_ADMIN" && <span className="cam-admin-meta">{actor.department ?? t("unassigned")}</span>}
        </span>
      </td>
      <td className="is-num">
        {count(actor.field.registrationsMade, locale)}
        <span className="cam-admin-meta cam-equipe-sub">
          {t("lastRegistrationShort", { date: stamp(actor.field.lastRegistrationAt, false, locale) })}
        </span>
      </td>
      <td className="is-num">
        {count(actor.field.conversions, locale)}
        {actor.field.conversionRate != null && (
          <span className="cam-admin-meta cam-equipe-sub">{ratioLabel(actor.field.conversionRate, locale)}</span>
        )}
      </td>
      <td className="is-num cam-equipe-nowrap">
        {count(actor.coverage.current, locale)} / {count(actor.coverage.target, locale)}
        <span className="cam-admin-meta cam-equipe-sub">{ratioLabel(actor.coverage.percent, locale)}</span>
      </td>
      <td className="is-num">{count(actor.processing.backlog, locale)}</td>
      <td className="is-num">
        {actor.processing.stale > 0 ? (
          <span className="cam-badge cam-badge-info" title={t("staleTitle")}>{count(actor.processing.stale, locale)}</span>
        ) : (
          count(actor.processing.stale, locale)
        )}
      </td>
      {showLapses && (
        <td className="is-num">
          {(() => {
            const lapses = actor.claimLapses;
            if (!lapses) return NOT_PROVIDED;
            const total = lapses.registrations + lapses.submissions;
            const detail = t("claimLapsesDetail", { registrations: lapses.registrations, submissions: lapses.submissions });
            // Amber with its number and a worded title: a missed deadline, not an error.
            return total > 0
              ? <span className="cam-badge cam-badge-warning" title={detail}>{count(total, locale)}</span>
              : <span title={detail}>{count(0, locale)}</span>;
          })()}
        </td>
      )}
      <td>
        <span className="cam-equipe-decisions">
          <span className="cam-badge cam-badge-success" title={t("approvedTitle")}>
            {t("approvedShort", { count: decisions.approved })}
          </span>
          <span className="cam-badge cam-badge-error" title={t("rejectedTitle")}>
            {t("rejectedShort", { count: decisions.rejected })}
          </span>
          <span className="cam-badge cam-badge-warning" title={t("correctionsTitle")}>
            {t("correctionsShort", { count: decisions.corrections })}
          </span>
        </span>
      </td>
      <td className="is-num cam-equipe-nowrap">
        {actor.processing.medianDaysToDecision != null
          ? t("medianDays", { days: actor.processing.medianDaysToDecision })
          : NOT_PROVIDED}
      </td>
      <td className="text-right">
        <div className="cam-equipe-actions">
          <button
            type="button"
            className="cam-button cam-button-secondary cam-button-sm"
            onClick={onNudge}
            aria-label={t("nudgeAriaLabel", { name: actor.displayName })}
          >
            {t("nudgeButton")}
          </button>
          {canReadAudit && (
            <Link href={`/admin/journal-audit?actor=${encodeURIComponent(actor.userId)}`} className="cam-text-button">
              {t("viewLogLink")}
            </Link>
          )}
          <Link href={organisationsListHref({ createdBy: actor.userId })} className="cam-text-button">
            {t("viewRegistrationsLink")}
          </Link>
        </div>
      </td>
    </tr>
  );
}
