"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { useAuthStore } from "@/lib/auth-store";
import type { UserRole } from "@/lib/user-types";
import {
  COUNTRY_OPTIONS,
  TIMEZONE_OPTIONS,
  getSystemSettings,
  updateObservatoryIdentity,
} from "@/lib/system-settings";
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
  COMPANY: 5,
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

  const handleSaveIdentity = (e: FormEvent) => {
    e.preventDefault();
    identityMutation.mutate({
      observatoryName: observatoryName.trim(),
      countryCode,
      defaultLanguage,
      timezone,
    });
  };

  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <p className="cam-admin-lede">{t("forbidden")}</p>
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      {/* ── Top Header matching Figma administration/parametres.png ── */}
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

      {saveSuccess && (
        <div role="status" className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium mb-4">
          {t("saved")}
        </div>
      )}

      {/* ── Single column: identity, roles, recent audit ── */}
      <div className="flex flex-col gap-6">

          {/* ── Informations de l'Observatoire ── */}
          <section
            aria-labelledby="obs-info-title"
            className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs"
          >
            <div className="mb-5">
              <h2 id="obs-info-title" className="text-base font-bold text-slate-900">
                {t("identityTitle")}
              </h2>
            </div>

            <form onSubmit={handleSaveIdentity} className="space-y-4">
              {/* Nom de l'observatoire */}
              <div>
                <label htmlFor="obs-name" className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
                  {t("nameLabel")}
                </label>
                <input
                  id="obs-name"
                  type="text"
                  value={observatoryName}
                  onChange={(e) => setObservatoryName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all"
                  placeholder="Observatoire National de l'Emploi"
                />
              </div>

              {/* Pays & Langue row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="obs-country" className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
                    {t("countryLabel")}
                  </label>
                  <div className="relative">
                    <select
                      id="obs-country"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 pr-8 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
                    >
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.value === "CM" ? t("country.CM") : c.label}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 1 5 5 9 1" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="obs-lang" className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
                    {t("languageLabel")}
                  </label>
                  <div className="relative">
                    <select
                      id="obs-lang"
                      value={defaultLanguage}
                      onChange={(e) => setDefaultLanguage(e.target.value)}
                      className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 pr-8 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
                    >
                      <option value="fr">{t("languageFr")}</option>
                      <option value="en">{t("languageEn")}</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 1 5 5 9 1" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fuseau horaire */}
              <div>
                <label htmlFor="obs-timezone" className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
                  {t("timezoneLabel")}
                </label>
                <div className="relative">
                  <select
                    id="obs-timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 pr-8 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
                  >
                    <option value="Africa/Douala">Africa/Douala (GMT+1)</option>
                    {TIMEZONE_OPTIONS.filter((tz) => tz.value !== "Africa/Douala").map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 1 5 5 9 1" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Action button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={identityMutation.isPending}
                  className="bg-[#006644] hover:bg-[#005438] active:bg-[#004730] text-white font-medium text-sm py-2.5 px-6 rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {identityMutation.isPending ? t("saving") : t("save")}
                </button>
              </div>
            </form>
          </section>

          {/* ── Rôles & Permissions ── */}
          <section
            aria-labelledby="roles-permissions-title"
            className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 id="roles-permissions-title" className="text-base font-bold text-slate-900">
                  {t("rolesTitle")}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("rolesSubtitle")}
                </p>
              </div>
              <Link
                href="/admin/utilisateurs"
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs text-decoration-none"
              >
                {t("manageAssignments")}
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {roles.map((id) => (
                <div key={id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-4 font-semibold text-sm text-slate-900 flex items-center gap-2">
                      <span>{t(`role.${id}.name`)}</span>
                      <code className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                        {id}
                      </code>
                    </div>
                    <div className="sm:col-span-8 text-xs text-slate-500">
                      {t(`role.${id}.description`)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Journal d'Audit Récent ── */}
          <section
            aria-labelledby="recent-audit-title"
            className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="recent-audit-title" className="text-base font-bold text-slate-900">
                {t("recentAuditTitle")}
              </h2>
              <Link
                href="/admin/journal-audit"
                className="text-xs font-semibold text-[#006644] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{t("fullLogLink")}</span>
                <span>→</span>
              </Link>
            </div>

            {/* Source: GET /audit/reports?paginate=true, newest first
                (lib/audit-log.ts). Real entries only — no seeded list. */}
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
              <div className="space-y-2">
                {(recentAuditQuery.data?.items ?? []).map((e) => (
                  <div
                    key={e.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 py-2.5 px-3 rounded-lg bg-slate-50/70 border border-slate-100 text-xs items-center"
                  >
                    <div className="sm:col-span-3 text-slate-400">{stamp(e.timestamp, true, locale)}</div>
                    <div className="sm:col-span-3 font-semibold text-slate-800">{auditActorName(e, locale)}</div>
                    <div className="sm:col-span-6 text-slate-600 truncate" title={auditDetailsSummary(e, locale)}>
                      {auditActionLabel(e.action, locale)} — {auditDetailsSummary(e, locale)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

      </div>

    </div>
  );
}
