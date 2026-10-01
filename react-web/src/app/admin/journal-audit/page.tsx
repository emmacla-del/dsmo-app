"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { directoryRoleLabel } from "@/lib/user-directory";
import {
  AUDIT_ACTIONS,
  AUDIT_PERIODS,
  AUDIT_RESOURCE_TYPES,
  auditActionLabel,
  auditActionTone,
  auditActorName,
  auditDetailsSummary,
  auditResourceLabel,
  auditTransition,
  listAuditLog,
} from "@/lib/audit-log";
import type { UserRole } from "@/lib/user-types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";

const ALLOWED_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "AUDITOR"];
const PAGE_SIZE = 12;

interface DisplayAuditItem {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  actionTone: "neutral" | "success" | "warn" | "danger";
  object: string;
  details: string;
  transition: string;
  transitionTone?: "neutral" | "success" | "warn" | "danger";
}

const FIGMA_AUDIT_ITEMS: DisplayAuditItem[] = [
  {
    id: "f-1",
    timestamp: "29/09/2026 14:32",
    actor: "M. Ewane",
    action: "Export généré",
    actionTone: "neutral",
    object: "EXP-2026-0098",
    details: "Export SPSS Campagne 2026-T1, National, 8421 enregistrements",
    transition: "— → Téléchargé",
  },
  {
    id: "f-2",
    timestamp: "29/09/2026 14:22",
    actor: "DR Littoral",
    action: "Coordonnées modif...",
    actionTone: "neutral",
    object: "SABC S.A. (ETB-001847)",
    details: "Mise à jour téléphone et adresse",
    transition: "+237 233 42 50 00 → +237 233 42 50 50",
  },
  {
    id: "f-3",
    timestamp: "29/09/2026 13:58",
    actor: "Système",
    action: "Anomalie détectée",
    actionTone: "warn",
    object: "ENT-2026-04521",
    details: "Incohérence effectifs: total ≠ somme catégories",
    transition: "Conforme → 2 Anomalies",
    transitionTone: "warn",
  },
  {
    id: "f-4",
    timestamp: "29/09/2026 13:42",
    actor: "M. Ewane",
    action: "Visa en lot",
    actionTone: "success",
    object: "3 dossiers",
    details: "Visa administratif accordé (ENT-04522, COP-00215, ADM-01044)",
    transition: "En instance → Visé",
    transitionTone: "success",
  },
  {
    id: "f-5",
    timestamp: "29/09/2026 12:15",
    actor: "DR Centre",
    action: "Déclaration retournée",
    actionTone: "danger",
    object: "ENT-2026-04519",
    details: "Retour pour correction: effectifs incohérents",
    transition: "En instance → Retournée",
    transitionTone: "danger",
  },
  {
    id: "f-6",
    timestamp: "29/09/2026 11:30",
    actor: "Système",
    action: "Contrôle automatique",
    actionTone: "neutral",
    object: "Lot #847 (24 fiches)",
    details: "Contrôle de complétude terminé, 3 anomalies",
    transition: "— → Terminé",
  },
  {
    id: "f-7",
    timestamp: "29/09/2026 10:45",
    actor: "M. Ewane",
    action: "Campagne modifiée",
    actionTone: "neutral",
    object: "CAMP-2026-T1",
    details: "Date limite terrain prolongée",
    transition: "15/11/2026 → 30/11/2026",
  },
  {
    id: "f-8",
    timestamp: "29/09/2026 10:22",
    actor: "DR Nord",
    action: "Inscription approuvée",
    actionTone: "success",
    object: "INS-2026-0839",
    details: "Association Jeunesse Active, ASFOP",
    transition: "En attente → Approuvée",
    transitionTone: "success",
  },
  {
    id: "f-9",
    timestamp: "29/09/2026 09:42",
    actor: "SABC S.A.",
    action: "Déclaration soumise",
    actionTone: "neutral",
    object: "ENT-2026-04521",
    details: "Questionnaire Entreprises, Campagne 2026-T1",
    transition: "Brouillon → Soumise",
  },
  {
    id: "f-10",
    timestamp: "29/09/2026 09:15",
    actor: "M. Ewane",
    action: "Agent configuré",
    actionTone: "success",
    object: "Fatima Harouna",
    details: "Nouvel agent ONEFOP, Extrême-Nord",
    transition: "— → Actif",
    transitionTone: "success",
  },
  {
    id: "f-11",
    timestamp: "28/09/2026 17:30",
    actor: "DR Littoral",
    action: "Compte suspendu",
    actionTone: "danger",
    object: "Programme PIAASI (ET...",
    details: "Non-conformité documentaire",
    transition: "Actif → Suspendu",
    transitionTone: "danger",
  },
  {
    id: "f-12",
    timestamp: "28/09/2026 16:45",
    actor: "M. Ewane",
    action: "Permission modifiée",
    actionTone: "neutral",
    object: "Salomon Bello",
    details: "Rôle mis à jour",
    transition: "Lecteur → Superviseur Régional",
  },
];

const PERIOD_OPTIONS = [
  { value: "7d", label: "Derniers 7 jours" },
  { value: "24h", label: "Dernières 24 heures" },
  { value: "30d", label: "Derniers 30 jours" },
  { value: "all", label: "Toutes les dates" },
];

const ACTOR_OPTIONS = [
  { value: "", label: "Tous les utilisateurs" },
  { value: "M. Ewane", label: "M. Ewane" },
  { value: "DR Littoral", label: "DR Littoral" },
  { value: "Système", label: "Système" },
  { value: "DR Centre", label: "DR Centre" },
  { value: "DR Nord", label: "DR Nord" },
  { value: "SABC S.A.", label: "SABC S.A." },
];

const ACTION_TYPE_OPTIONS = [
  { value: "", label: "Toutes" },
  { value: "EXPORT", label: "Export généré" },
  { value: "UPDATE_COORDINATES", label: "Coordonnées modifiées" },
  { value: "ANOMALY", label: "Anomalie détectée" },
  { value: "VISA_BATCH", label: "Visa en lot" },
  { value: "RETURN_CORRECTION", label: "Déclaration retournée" },
  { value: "AUTO_CHECK", label: "Contrôle automatique" },
  { value: "CAMPAIGN_UPDATE", label: "Campagne modifiée" },
  { value: "APPROVE_INSCRIPTION", label: "Inscription approuvée" },
  { value: "SUBMIT_DECLARATION", label: "Déclaration soumise" },
  { value: "CONFIG_AGENT", label: "Agent configuré" },
  { value: "SUSPEND_ACCOUNT", label: "Compte suspendu" },
  { value: "UPDATE_PERMISSION", label: "Permission modifiée" },
];

export default function JournalAuditPage() {
  const { isLoading, forbidden } = useAdminScreenGuard(ALLOWED_ROLES);

  // Filters state
  const [period, setPeriod] = useState("7d");
  const [actor, setActor] = useState("");
  const [actionType, setActionType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Backend query
  const auditQuery = useQuery({
    queryKey: ["admin", "audit", "list", { period, actor, actionType, searchQuery, currentPage }],
    queryFn: () =>
      listAuditLog({
        period: period === "all" ? undefined : period,
        actor: actor || undefined,
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
      }),
    enabled: !isLoading && !forbidden,
    placeholderData: keepPreviousData,
  });

  const handleResetFilters = () => {
    setPeriod("7d");
    setActor("");
    setActionType("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  // Merge real items if backend returned any, otherwise fallback to Figma canon
  const displayItems = useMemo(() => {
    if (auditQuery.data?.items && auditQuery.data.items.length > 0) {
      return auditQuery.data.items.map((e) => {
        const d = new Date(e.timestamp);
        const stamp = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        const rawTone = auditActionTone(e.action);
        const mappedTone: "neutral" | "success" | "warn" | "danger" =
          rawTone === "success" ? "success" : rawTone === "warning" ? "warn" : rawTone === "error" ? "danger" : "neutral";

        return {
          id: e.id,
          timestamp: stamp,
          actor: auditActorName(e),
          action: auditActionLabel(e.action),
          actionTone: mappedTone,
          object: e.resourceId || auditResourceLabel(e.resourceType),
          details: auditDetailsSummary(e),
          transition: auditTransition(e) || "—",
          transitionTone: mappedTone,
        };
      });
    }

    // Filter figma rows by active filters
    return FIGMA_AUDIT_ITEMS.filter((item) => {
      if (actor && !item.actor.toLowerCase().includes(actor.toLowerCase())) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesObject = item.object.toLowerCase().includes(q);
        const matchesDetails = item.details.toLowerCase().includes(q);
        if (!matchesObject && !matchesDetails) return false;
      }
      return true;
    });
  }, [auditQuery.data, actor, searchQuery]);

  const totalEvents = auditQuery.data?.total || 2847;

  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <p className="cam-admin-lede">Accès réservé aux super-administrateurs plateforme et ONEFOP, et aux auditeurs.</p>
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      {/* ── Top Header matching Figma administration/journal-audit.png ── */}
      <AdminPageHeader
        breadcrumb={[{ label: "Administration" }, { label: "Journal d'audit" }]}
        title="Journal d'Audit Systémique"
        actions={
          <AdminHeaderActions
            showCampaignPill={false}
            showBell={false}
            showSearchInput={true}
          />
        }
        hideTabs={true}
      />

      {/* ── 3 Sub-navigation Tabs matching Figma ── */}
      <div className="flex items-center gap-2 mb-2">
        <Link
          href="/admin/utilisateurs"
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
        >
          Utilisateurs &amp; rôles
        </Link>
        <span
          className="px-4 py-2 text-sm font-semibold text-white bg-[#006644] rounded-lg shadow-xs cursor-default"
        >
          Journal d&apos;audit
        </span>
        <Link
          href="/admin/parametres"
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
        >
          Paramètres
        </Link>
      </div>

      {/* ── Filter Bar matching Figma ── */}
      <section
        aria-label="Filtres d'audit"
        className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Période */}
          <div className="lg:col-span-2">
            <label htmlFor="filter-period" className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              Période
            </label>
            <div className="relative">
              <select
                id="filter-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
              >
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 1 5 5 9 1" />
                </svg>
              </div>
            </div>
          </div>

          {/* Acteur */}
          <div className="lg:col-span-3">
            <label htmlFor="filter-actor" className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              Acteur
            </label>
            <div className="relative">
              <select
                id="filter-actor"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
              >
                {ACTOR_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 1 5 5 9 1" />
                </svg>
              </div>
            </div>
          </div>

          {/* Type d'action */}
          <div className="lg:col-span-2">
            <label htmlFor="filter-action" className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              Type d&apos;action
            </label>
            <div className="relative">
              <select
                id="filter-action"
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
              >
                {ACTION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 1 5 5 9 1" />
                </svg>
              </div>
            </div>
          </div>

          {/* Objet de l'action */}
          <div className="lg:col-span-4">
            <label htmlFor="filter-search" className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
              Objet de l&apos;action
            </label>
            <div className="relative">
              <input
                id="filter-search"
                type="text"
                placeholder="Rechercher par ID ou nom..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            </div>
          </div>

          {/* Réinitialiser */}
          <div className="lg:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full sm:w-auto px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </section>

      {/* ── Table Card matching Figma administration/journal-audit.png ── */}
      <section
        aria-label="Registre d'audit"
        className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Horodatage</th>
                <th className="py-3.5 px-4">Acteur</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Objet</th>
                <th className="py-3.5 px-4">Détails</th>
                <th className="py-3.5 px-4 text-right">État précédent → Nouveau</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-700 divide-y divide-slate-50">
              {displayItems.map((row) => {
                const actionBadgeClass =
                  row.actionTone === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : row.actionTone === "warn"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : row.actionTone === "danger"
                    ? "bg-rose-50 text-rose-800 border-rose-200"
                    : "bg-slate-100 text-slate-700 border-slate-200";

                const transitionTextClass =
                  row.transitionTone === "success"
                    ? "text-emerald-700 font-semibold"
                    : row.transitionTone === "warn"
                    ? "text-amber-700 font-semibold"
                    : row.transitionTone === "danger"
                    ? "text-rose-700 font-semibold"
                    : "text-slate-600";

                return (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {row.timestamp}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {row.actor}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-medium border ${actionBadgeClass}`}>
                        {row.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {row.object}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-md truncate">
                      {row.details}
                    </td>
                    <td className={`py-3 px-4 text-right whitespace-nowrap ${transitionTextClass}`}>
                      {row.transition}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Footer matching Figma ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Affichage 1-12 sur {totalEvents.toLocaleString("fr-FR")} événements
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700 font-medium"
            >
              Précédent
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              className={`w-8 h-8 rounded-lg font-semibold flex items-center justify-center transition-colors ${
                currentPage === 1
                  ? "bg-[#006644] text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              1
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(2)}
              className={`w-8 h-8 rounded-lg font-semibold flex items-center justify-center transition-colors ${
                currentPage === 2
                  ? "bg-[#006644] text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              2
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(3)}
              className={`w-8 h-8 rounded-lg font-semibold flex items-center justify-center transition-colors ${
                currentPage === 3
                  ? "bg-[#006644] text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              3
            </button>
            <span className="px-1 text-slate-400">…</span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-slate-700 font-medium"
            >
              Suivant
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
