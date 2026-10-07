"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { useAuthStore } from "@/lib/auth-store";
import { AUDIT_ROLES, MONITORING_ROLES, hasRole } from "@/lib/roles";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataState } from "@/components/admin/DataState";
import { NOT_PROVIDED, count, meterWidth, percent, resolveDataState, stamp } from "@/lib/admin-data-state";
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

/** A 0–1 ratio from the summary as a percent label, or the neutral marker. */
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

  const header = (
    <AdminPageHeader
      breadcrumb={[{ label: t("adminNav.hubs.supervision") }, { label: t("adminNav.routes.equipe") }]}
      title={t("adminNav.routes.equipe")}
      subtitle={t("adminEquipePage.subtitle")}
      actions={<AdminHeaderActions showCampaignPill={false} />}
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

      <section className="cam-admin-section" aria-label={t("adminEquipePage.filtersAriaLabel")}>
        <div className="cam-admin-section-body">
          <div className="cam-admin-filters">
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="filter-period">{t("adminEquipePage.periodLabel")}</label>
              <select
                id="filter-period"
                className="cam-select"
                value={period}
                onChange={(e) => setPeriod(e.target.value as ActorSummaryPeriod)}
              >
                {ACTOR_SUMMARY_PERIODS.map((p) => (
                  <option key={p} value={p}>{t(`adminEquipePage.period.${p}`)}</option>
                ))}
              </select>
            </div>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="filter-role">{t("adminEquipePage.roleLabel")}</label>
              <select
                id="filter-role"
                className="cam-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">{t("adminEquipePage.allTerritorialRoles")}</option>
                {MONITORED_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{t(`adminEquipePage.roleOption.${r.value}`)}</option>
                ))}
              </select>
            </div>

            {/* A regional admin's scope is fixed server-side, so the region
                is shown but cannot be changed. */}
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="filter-region">{t("adminEquipePage.regionLabel")}</label>
              <select
                id="filter-region"
                className="cam-select"
                value={isRegional ? user?.region ?? "" : regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                disabled={isRegional}
              >
                {!isRegional && <option value="">{t("adminEquipePage.allRegions")}</option>}
                {isRegional ? (
                  <option value={user?.region ?? ""}>{user?.region ?? t("adminEquipePage.myRegion")}</option>
                ) : (
                  territoryRegions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>
      </section>

      {summaryState !== "ready" ? (
        <DataState
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
      ) : (
        actors.map((actor) => (
          <ActorCard key={actor.userId} actor={actor} onNudge={() => openNudgeModal(actor)} />
        ))
      )}

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
 * One territorial admin:
 * - identity, role, territory and last action, with the row's actions
 * - Travail de terrain (registrations made, conversions, last registration)
 * - Ressort — Cible & Couverture (target, current, percentage bar)
 * - Traitement (backlog, stale, decisions, median time)
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
  const titleId = `actor-${actor.userId}-title`;

  return (
    <section className="cam-admin-section" aria-labelledby={titleId}>
      <div className="cam-admin-section-head" style={{ alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", flexWrap: "wrap" }}>
            <h3 id={titleId} className="cam-admin-h2">{actor.displayName}</h3>
            <span className="cam-badge cam-badge-neutral">{roleLabel}</span>
            <span className="cam-admin-meta">{territoryLabel}</span>
          </div>
          <div className="cam-admin-meta">
            {t("lastSystemAction")}{" "}
            <span className="cam-admin-strong">
              {actor.lastActionAt ? stamp(actor.lastActionAt, true, locale) : t("noActionRecorded")}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)", flexWrap: "wrap" }}>
          <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={onNudge}>
            {t("nudgeButton")}
          </button>
          {canReadAudit && (
            <Link href={`/admin/journal-audit?actor=${encodeURIComponent(actor.userId)}`} className="cam-text-button">
              {t("viewLogLink")}
            </Link>
          )}
          <Link href={`/admin/inscriptions?createdBy=${encodeURIComponent(actor.userId)}`} className="cam-text-button">
            {t("viewRegistrationsLink")}
          </Link>
        </div>
      </div>

      {/* Three metric groups side by side, stacking on narrow screens. No
          box around each group: the section is already the card. */}
      <div className="cam-admin-section-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--cam-space-5)" }}>
        <div>
          <h4 className="cam-admin-label" style={{ margin: "0 0 var(--cam-space-3)" }}>{t("fieldWorkTitle")}</h4>
          <dl className="cam-admin-kv" style={{ gridTemplateColumns: "minmax(0, 1fr)", gap: "var(--cam-space-3)" }}>
            <div>
              <dt>{t("assistedRegistrations")}</dt>
              <dd>{count(actor.field.registrationsMade, locale)}</dd>
            </div>
            <div>
              <dt>{t("conversions")}</dt>
              <dd>
                {count(actor.field.conversions, locale)}
                {actor.field.conversionRate != null && (
                  <span className="cam-admin-meta"> ({ratioLabel(actor.field.conversionRate, locale)})</span>
                )}
              </dd>
            </div>
            <div>
              <dt>{t("lastRegistration")}</dt>
              <dd>{stamp(actor.field.lastRegistrationAt, false, locale)}</dd>
            </div>
          </dl>
        </div>

        <div>
          <h4 className="cam-admin-label" style={{ margin: "0 0 var(--cam-space-3)" }}>{t("coverageTitle")}</h4>
          <dl className="cam-admin-kv" style={{ gridTemplateColumns: "minmax(0, 1fr)", gap: "var(--cam-space-3)" }}>
            <div>
              <dt>{t("registeredOverTarget")}</dt>
              <dd>{count(actor.coverage.current, locale)} / {count(actor.coverage.target, locale)}</dd>
            </div>
            <div>
              <dt>{t("coverageRate")}</dt>
              <dd>{ratioLabel(actor.coverage.percent, locale)}</dd>
            </div>
          </dl>
          <div className="cam-admin-bar-track" style={{ marginTop: "var(--cam-space-2)" }}>
            <div
              className="cam-admin-bar-fill"
              style={{ width: meterWidth(actor.coverage.percent == null ? null : actor.coverage.percent * 100) }}
            />
          </div>
        </div>

        <div>
          <h4 className="cam-admin-label" style={{ margin: "0 0 var(--cam-space-3)" }}>{t("processingTitle")}</h4>
          <dl className="cam-admin-kv" style={{ gridTemplateColumns: "minmax(0, 1fr)", gap: "var(--cam-space-3)" }}>
            <div>
              <dt>{t("pendingQueue")}</dt>
              <dd>
                {t("backlogFiles", { count: actor.processing.backlog })}
                {actor.processing.stale > 0 && (
                  <>
                    {" "}
                    <span className="cam-badge cam-badge-error">{t("staleBadge", { count: actor.processing.stale })}</span>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>{t("decisionsMade")}</dt>
              <dd style={{ display: "flex", flexWrap: "wrap", gap: "var(--cam-space-1)" }}>
                <span className="cam-badge cam-badge-success" title={t("approvedTitle")}>
                  {t("approvedShort", { count: actor.processing.decisions.approved })}
                </span>
                <span className="cam-badge cam-badge-error" title={t("rejectedTitle")}>
                  {t("rejectedShort", { count: actor.processing.decisions.rejected })}
                </span>
                <span className="cam-badge cam-badge-warning" title={t("correctionsTitle")}>
                  {t("correctionsShort", { count: actor.processing.decisions.corrections })}
                </span>
              </dd>
            </div>
            <div>
              <dt>{t("medianDecisionTime")}</dt>
              <dd>
                {actor.processing.medianDaysToDecision != null
                  ? t("medianDays", { days: actor.processing.medianDaysToDecision })
                  : NOT_PROVIDED}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
