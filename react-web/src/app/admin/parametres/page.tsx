"use client";

import { Suspense, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

interface RolePermissionItem {
  name: string;
  description: string;
}

/**
 * Statutory description of each role, for the read-only roles card.
 *
 * Typed as a total Record over UserRole (@/lib/roles) rather than held as a
 * second hand-written list of role identifiers: adding or removing a value in
 * the Prisma enum then becomes a type error here instead of a silently stale
 * card. Declaration order is the card's display order — widest authority
 * first, the declarant last.
 *
 * The names below are the long statutory titles this card shows, which are
 * deliberately not directoryRoleLabel()'s compact badge labels.
 */
const SYSTEM_ROLE_DETAILS: Record<UserRole, RolePermissionItem> = {
  SUPER_ADMIN: {
    name: "Super administrateur",
    description:
      "Accès complet à la plateforme, gestion des administrateurs, des rôles et des paramètres système. Seul rôle pouvant créer ou promouvoir un administrateur ONEFOP.",
  },
  ADMIN_ONEFOP: {
    name: "Administrateur ONEFOP",
    description:
      "Supervision nationale des enquêtes ONEFOP et des déclarations : instruction de second niveau, contrôle de conformité, gestion des campagnes, des nomenclatures et des équipes de collecte. Exploitation des données agrégées et production des indicateurs.",
  },
  REGIONAL_ADMIN: {
    name: "Délégation Régionale",
    description: "Supervision des soumissions et contrôle de conformité dans le ressort de la région.",
  },
  DIVISIONAL_ADMIN: {
    name: "Délégation Départementale",
    description: "Supervision locale des enquêtes dans le ressort du département.",
  },
  AUDITOR: {
    name: "Auditeur",
    description: "Consultation intégrale du journal d'audit et contrôle de conformité procédurale. Aucun droit d'écriture.",
  },
  COMPANY: {
    name: "Déclarant",
    description: "Dépôt et suivi des déclarations de l'établissement. Aucun accès aux écrans d'administration.",
  },
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

  // Observatory Form state
  const [observatoryName, setObservatoryName] = useState("Observatoire National de l'Emploi");
  const [countryCode, setCountryCode] = useState(COUNTRY_OPTIONS[0].value);
  const [defaultLanguage, setDefaultLanguage] = useState("fr");
  const [timezone, setTimezone] = useState("Africa/Douala");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Authoritative statutory system roles, in declaration order.
  const roles = Object.entries(SYSTEM_ROLE_DETAILS) as Array<[UserRole, RolePermissionItem]>;

  // Sync initial stored settings
  useMemo(() => {
    if (settingsQuery.data) {
      if (settingsQuery.data.observatoryName) setObservatoryName(settingsQuery.data.observatoryName);
      if (settingsQuery.data.countryCode) setCountryCode(settingsQuery.data.countryCode);
      if (settingsQuery.data.defaultLanguage) setDefaultLanguage(settingsQuery.data.defaultLanguage);
      if (settingsQuery.data.timezone) setTimezone(settingsQuery.data.timezone);
    }
  }, [settingsQuery.data]);

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
        <p className="cam-admin-lede">Accès restreint aux super-administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      {/* ── Top Header matching Figma administration/parametres.png ── */}
      <AdminPageHeader
        breadcrumb={[{ label: "Administration" }, { label: "Paramètres" }]}
        title="Paramètres"
        subtitle="Identité de l'observatoire, rôles et journal d'audit"
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
          Modifications des paramètres enregistrées avec succès.
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
                Informations de l&apos;Observatoire
              </h2>
            </div>

            <form onSubmit={handleSaveIdentity} className="space-y-4">
              {/* Nom de l'observatoire */}
              <div>
                <label htmlFor="obs-name" className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
                  Nom de l&apos;observatoire
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
                    Pays
                  </label>
                  <div className="relative">
                    <select
                      id="obs-country"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 pr-8 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
                    >
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
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
                    Langue par défaut
                  </label>
                  <div className="relative">
                    <select
                      id="obs-lang"
                      value={defaultLanguage}
                      onChange={(e) => setDefaultLanguage(e.target.value)}
                      className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 pr-8 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
                    >
                      <option value="fr">Français (FR)</option>
                      <option value="en">Anglais (EN)</option>
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
                  Fuseau horaire
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
                  {identityMutation.isPending ? "Enregistrement…" : "Enregistrer les modifications"}
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
                  Rôles Réglementaires &amp; Habilitations
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nomenclature statutaire des habilitations CAM-LEAP/ONEFOP
                </p>
              </div>
              <Link
                href="/admin/utilisateurs"
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs text-decoration-none"
              >
                Gérer les affectations →
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {roles.map(([id, r]) => (
                <div key={id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-4 font-semibold text-sm text-slate-900 flex items-center gap-2">
                      <span>{r.name}</span>
                      <code className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                        {id}
                      </code>
                    </div>
                    <div className="sm:col-span-8 text-xs text-slate-500">
                      {r.description}
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
                Journal d&apos;Audit Récent
              </h2>
              <Link
                href="/admin/journal-audit"
                className="text-xs font-semibold text-[#006644] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Voir le journal complet</span>
                <span>→</span>
              </Link>
            </div>

            {/* Source: GET /audit/reports?paginate=true, newest first
                (lib/audit-log.ts). Real entries only — no seeded list. */}
            {recentAuditState !== "ready" ? (
              <DataState
                dense
                state={recentAuditState}
                resource="le journal d'audit"
                error={recentAuditQuery.error}
                onRetry={() => recentAuditQuery.refetch()}
                title={
                  recentAuditState === "empty"
                    ? "Aucun historique d'audit disponible"
                    : recentAuditState === "forbidden"
                      ? "Journal d'audit non accessible à votre rôle"
                      : undefined
                }
                hint={
                  recentAuditState === "empty"
                    ? "Les événements enregistrés par le système apparaîtront ici."
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
                    <div className="sm:col-span-3 text-slate-400">{stamp(e.timestamp)}</div>
                    <div className="sm:col-span-3 font-semibold text-slate-800">{auditActorName(e)}</div>
                    <div className="sm:col-span-6 text-slate-600 truncate" title={auditDetailsSummary(e)}>
                      {auditActionLabel(e.action)} — {auditDetailsSummary(e)}
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
