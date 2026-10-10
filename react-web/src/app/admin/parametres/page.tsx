"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { formatApiError } from "@/lib/pilotage-targets";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { useAuthStore } from "@/lib/auth-store";
import type { UserRole } from "@/lib/user-types";
import {
  COUNTRY_OPTIONS,
  REGISTRATION_OVERDUE_MAX_DAYS,
  REGISTRATION_OVERDUE_MIN_DAYS,
  TIMEZONE_OPTIONS,
  getSystemSettings,
  updateObservatoryIdentity,
  updateRegistrationOverdueDays,
} from "@/lib/system-settings";
import { REGISTRATION_OVERDUE_DEFAULT_DAYS } from "@/lib/inscriptions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { DataState } from "@/components/admin/DataState";
import {
  auditActionLabel,
  auditActorName,
  auditDetailsSummary,
  listAuditLog,
} from "@/lib/audit-log";
import { resolveDataState, stamp } from "@/lib/admin-data-state";
import { AUDIT_ROLES, SETTINGS_ROLES } from "@/lib/roles";

const RECENT_AUDIT_LIMIT = 6;

// Roles the backend lets read GET /audit/reports: AUDIT_ROLES in @/lib/roles.

/**
 * The roles on the read-only statutory card, in display order — widest
 * authority first, the declarant last.
 *
 * Typed as a total Record over UserRole (@/lib/roles) rather than held as a
 * plain list of role identifiers: adding or removing a value in the Prisma
 * enum then becomes a type error here instead of a silently stale card. Each
 * role's long statutory title and description are message keys
 * (adminParametresPage.role.<ROLE>.name / .description), deliberately not
 * directoryRoleLabel()'s compact badge labels.
 */
const SYSTEM_ROLE_ORDER: Record<UserRole, number> = {
  SUPER_ADMIN: 0,
  ADMIN_ONEFOP: 1,
  REGIONAL_ADMIN: 2,
  DIVISIONAL_ADMIN: 3,
  AUDITOR: 4,
  CENTRAL_AGENT: 5,
  COMPANY: 6,
};

export default function ParametresPage() {
  return (
    <Suspense fallback={null}>
      <ParametresContent />
    </Suspense>
  );
}

function ParametresContent() {
  const { isLoading, forbidden } = useAdminScreenGuard(SETTINGS_ROLES);
  const queryClient = useQueryClient();
  const tRoot = useTranslations();
  const t = useTranslations("adminParametresPage");
  const locale = asUiLocale(useLocale());

  const role = useAuthStore((s) => s.user?.role);
  const canReadAudit = !!role && AUDIT_ROLES.includes(role);

  // Settings query
  const settingsQuery = useQuery({
    queryKey: ["system-settings"],
    queryFn: getSystemSettings,
  });

  /**
   * Recent audit entries. Source: GET /audit/reports?paginate=true, newest
   * first. Platform-wide by design, hence the role gate; a role that cannot
   * read it gets an authorization state rather than a substitute list.
   */
  const recentAuditQuery = useQuery({
    queryKey: ["admin", "audit", "recent", RECENT_AUDIT_LIMIT],
    queryFn: () => listAuditLog({ limit: RECENT_AUDIT_LIMIT, offset: 0 }),
    enabled: !isLoading && !forbidden && canReadAudit,
  });

  const recentAuditState = resolveDataState({
    roleAllowed: canReadAudit,
    isLoading: recentAuditQuery.isLoading,
    isError: recentAuditQuery.isError,
    error: recentAuditQuery.error,
    rowCount: recentAuditQuery.data?.items.length ?? null,
  });

  // Observatory form. Each field is the actor's edit if they have made one,
  // else the stored setting, else the default. Derived rather than copied
  // into state when the settings arrive, so no setState runs in render. The
  // default name is the official French title of a stored setting, so it is
  // not translated.
  const stored = settingsQuery.data;
  const [nameDraft, setObservatoryName] = useState<string | null>(null);
  const [countryDraft, setCountryCode] = useState<string | null>(null);
  const [languageDraft, setDefaultLanguage] = useState<string | null>(null);
  const [timezoneDraft, setTimezone] = useState<string | null>(null);
  const observatoryName = nameDraft ?? (stored?.observatoryName || "Observatoire National de l'Emploi");
  const countryCode = countryDraft ?? (stored?.countryCode || COUNTRY_OPTIONS[0].value);
  const defaultLanguage = languageDraft ?? (stored?.defaultLanguage || "fr");
  const timezone = timezoneDraft ?? (stored?.timezone || "Africa/Douala");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Authoritative statutory system roles, in display order.
  const roles = (Object.keys(SYSTEM_ROLE_ORDER) as UserRole[]).sort((a, b) => SYSTEM_ROLE_ORDER[a] - SYSTEM_ROLE_ORDER[b]);

  const identityMutation = useMutation({
    mutationFn: updateObservatoryIdentity,
    onSuccess: (data) => {
      queryClient.setQueryData(["system-settings"], data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    },
  });

  // Registration follow-up: the overdue threshold. Its own form and its own
  // (secondary) save, so changing it never resubmits the identity fields.
  const [overdueDraft, setOverdueDraft] = useState<string | null>(null);
  const overdueInput = overdueDraft ?? String(stored?.registrationOverdueDays ?? REGISTRATION_OVERDUE_DEFAULT_DAYS);
  const overdueValue = Number(overdueInput);
  const overdueValid =
    /^\d+$/.test(overdueInput) &&
    overdueValue >= REGISTRATION_OVERDUE_MIN_DAYS &&
    overdueValue <= REGISTRATION_OVERDUE_MAX_DAYS;

  const overdueMutation = useMutation({
    mutationFn: updateRegistrationOverdueDays,
    onSuccess: (data) => {
      queryClient.setQueryData(["system-settings"], data);
      // The queue's labels and flags follow the new threshold on next view.
      queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] });
      setOverdueDraft(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    },
  });

  const handleSaveOverdue = (e: FormEvent) => {
    e.preventDefault();
    if (!overdueValid) return;
    overdueMutation.mutate(overdueValue);
  };

  const handleSaveIdentity = (e: FormEvent) => {
    e.preventDefault();
    identityMutation.mutate({
      observatoryName: observatoryName.trim(),
      countryCode,
      defaultLanguage,
      timezone,
    });
  };

  const header = (
    <AdminPageHeader
      breadcrumb={[{ label: tRoot("adminNav.hubs.administration") }, { label: tRoot("adminNav.routes.parametres") }]}
      title={tRoot("adminNav.routes.parametres")}
      subtitle={t("subtitle")}
      actions={
        <AdminHeaderActions
          showCampaignPill={false}
          showBell={false}
          showSearchInput={true}
        />
      }
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
          resource={t("auditResource")}
          title={isLoading ? tRoot("common.loading") : t("forbidden")}
        />
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      {header}

      {saveSuccess && (
        <div role="status" className="cam-admin-notice cam-admin-notice--success">
          <span>{t("saved")}</span>
        </div>
      )}

      {/* ── Informations de l'Observatoire ── */}
      <section className="cam-admin-section" aria-labelledby="obs-info-title">
        <div className="cam-admin-section-head">
          <h2 id="obs-info-title" className="cam-admin-h2">{t("identityTitle")}</h2>
        </div>

        <form onSubmit={handleSaveIdentity} className="cam-admin-section-body">
          <div className="cam-field">
            <label className="cam-admin-label" htmlFor="obs-name">{t("nameLabel")}</label>
            <input
              id="obs-name"
              type="text"
              className="cam-input"
              value={observatoryName}
              onChange={(e) => setObservatoryName(e.target.value)}
              placeholder="Observatoire National de l'Emploi"
            />
          </div>

          <div className="cam-admin-filters">
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="obs-country">{t("countryLabel")}</label>
              <select
                id="obs-country"
                className="cam-select"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.value === "CM" ? t("country.CM") : c.label}</option>
                ))}
              </select>
            </div>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="obs-lang">{t("languageLabel")}</label>
              <select
                id="obs-lang"
                className="cam-select"
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
              >
                <option value="fr">{t("languageFr")}</option>
                <option value="en">{t("languageEn")}</option>
              </select>
            </div>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="obs-timezone">{t("timezoneLabel")}</label>
              <select
                id="obs-timezone"
                className="cam-select"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="Africa/Douala">Africa/Douala (GMT+1)</option>
                {TIMEZONE_OPTIONS.filter((tz) => tz.value !== "Africa/Douala").map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--cam-space-5)" }}>
            <button type="submit" className="cam-button cam-button-primary" disabled={identityMutation.isPending}>
              {identityMutation.isPending ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </section>

      {/* ── Suivi des inscriptions ── */}
      <section className="cam-admin-section" aria-labelledby="registration-followup-title">
        <div className="cam-admin-section-head">
          <h2 id="registration-followup-title" className="cam-admin-h2">{t("registrationTitle")}</h2>
        </div>

        <form onSubmit={handleSaveOverdue} className="cam-admin-section-body" noValidate>
          {overdueMutation.isError && (
            <div role="alert" className="cam-admin-notice cam-admin-notice--error">
              <span>{formatApiError(overdueMutation.error, locale)}</span>
            </div>
          )}

          <div className="cam-field">
            <label className="cam-admin-label" htmlFor="registration-overdue-days">{t("overdueDaysLabel")}</label>
            <input
              id="registration-overdue-days"
              type="number"
              inputMode="numeric"
              className="cam-input"
              style={{ maxWidth: "8rem" }}
              min={REGISTRATION_OVERDUE_MIN_DAYS}
              max={REGISTRATION_OVERDUE_MAX_DAYS}
              step={1}
              value={overdueInput}
              onChange={(e) => setOverdueDraft(e.target.value)}
              aria-invalid={!overdueValid || undefined}
              aria-describedby="registration-overdue-days-hint"
            />
            <p id="registration-overdue-days-hint" className="cam-admin-meta" style={{ margin: "var(--cam-space-1) 0 0" }}>
              {overdueValid
                ? t("overdueDaysHint")
                : t("overdueDaysInvalid", { min: REGISTRATION_OVERDUE_MIN_DAYS, max: REGISTRATION_OVERDUE_MAX_DAYS })}
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--cam-space-5)" }}>
            <button
              type="submit"
              className="cam-button cam-button-secondary"
              disabled={!overdueValid || overdueMutation.isPending || settingsQuery.isLoading}
            >
              {overdueMutation.isPending ? t("saving") : t("saveOverdue")}
            </button>
          </div>
        </form>
      </section>

      {/* ── Rôles & Permissions ── */}
      <section className="cam-admin-section" aria-labelledby="roles-permissions-title">
        <div className="cam-admin-section-head">
          <div>
            <h2 id="roles-permissions-title" className="cam-admin-h2">{t("rolesTitle")}</h2>
            <p className="cam-admin-meta" style={{ margin: "var(--cam-space-1) 0 0" }}>{t("rolesSubtitle")}</p>
          </div>
          <Link href="/admin/utilisateurs" className="cam-button cam-button-secondary cam-button-sm">
            {t("manageAssignments")}
          </Link>
        </div>

        <div className="cam-admin-section-body">
          <dl className="cam-param-roles">
            {roles.map((id) => (
              <div key={id}>
                <dt>
                  {t(`role.${id}.name`)}
                  <span className="cam-admin-code cam-admin-muted" style={{ display: "block" }}>{id}</span>
                </dt>
                <dd>{t(`role.${id}.description`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Journal d'Audit Récent ── */}
      <section className="cam-admin-section" aria-labelledby="recent-audit-title">
        <div className="cam-admin-section-head">
          <h2 id="recent-audit-title" className="cam-admin-h2">{t("recentAuditTitle")}</h2>
          <Link href="/admin/journal-audit" className="cam-text-button">
            {t("fullLogLink")} →
          </Link>
        </div>

        {/* Source: GET /audit/reports?paginate=true, newest first
            (lib/audit-log.ts). Real entries only — no seeded list. */}
        <div className="cam-admin-section-body">
          {recentAuditState !== "ready" ? (
            <DataState
              dense
              state={recentAuditState}
              resource={t("auditResource")}
              error={recentAuditQuery.error}
              onRetry={() => recentAuditQuery.refetch()}
              title={
                recentAuditState === "empty"
                  ? t("auditEmptyTitle")
                  : recentAuditState === "forbidden"
                    ? t("auditForbiddenTitle")
                    : undefined
              }
              hint={
                recentAuditState === "empty"
                  ? t("auditEmptyHint")
                  : undefined
              }
            />
          ) : (
            <ul className="cam-param-audit">
              {(recentAuditQuery.data?.items ?? []).map((e) => (
                <li key={e.id}>
                  <time dateTime={e.timestamp}>{stamp(e.timestamp, true, locale)}</time>
                  <strong>{auditActorName(e, locale)}</strong>
                  <span title={auditDetailsSummary(e, locale)}>
                    {auditActionLabel(e.action, locale)} — {auditDetailsSummary(e, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
