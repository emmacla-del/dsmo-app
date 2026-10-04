"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { MONITORING_ROLES } from "@/lib/roles";
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
        text: `Relance envoyée avec succès à ${nudgeTarget?.displayName ?? "l'administrateur"}.`,
      });
      closeNudgeModal();
    },
    onError: (err: Error) => {
      setNotice({
        tone: "error",
        text: err.message || "Échec de l'envoi de la relance.",
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

  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <p className="cam-admin-lede">
          Accès réservé aux administrateurs centraux et régionaux.
        </p>
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Administration" }, { label: "Équipe" }]}
        title="Supervision de l'Équipe Territoriale"
        subtitle="Activité de terrain, couverture des ressorts et débit de traitement des administrateurs régionaux et départementaux."
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
            aria-label="Fermer"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <section
        aria-label="Filtres de supervision"
        className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs mb-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          {/* Période */}
          <div>
            <label
              htmlFor="filter-period"
              className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5"
            >
              Période
            </label>
            <div className="relative">
              <select
                id="filter-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value as ActorSummaryPeriod)}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
              >
                {ACTOR_SUMMARY_PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
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
              Rôle
            </label>
            <div className="relative">
              <select
                id="filter-role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
              >
                <option value="">Tous les rôles territoriaux</option>
                {MONITORED_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
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
              Région
            </label>
            <div className="relative">
              <select
                id="filter-region"
                value={isRegional ? user?.region ?? "" : regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                disabled={isRegional}
                className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer disabled:bg-slate-50 disabled:text-slate-500"
              >
                {!isRegional && <option value="">Toutes les régions</option>}
                {isRegional ? (
                  <option value={user?.region ?? ""}>{user?.region ?? "Ma région"}</option>
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
      {summaryQuery.isLoading && <p className="cam-admin-lede">Chargement des données d&apos;activité…</p>}

      {summaryQuery.isError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          Impossible de charger le tableau de bord de supervision.
        </div>
      )}

      {!summaryQuery.isLoading && !summaryQuery.isError && actors.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
          Aucun administrateur territorial trouvé pour ces filtres.
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
        title={`Relancer ${nudgeTarget?.displayName ?? ""}`}
        eyebrow="Communication interne"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              className="cam-button cam-button-secondary"
              onClick={closeNudgeModal}
              disabled={nudgeMutation.isPending}
            >
              Annuler
            </button>
            <button
              type="submit"
              form="nudge-form"
              className="cam-button cam-button-primary"
              disabled={nudgeMutation.isPending}
            >
              {nudgeMutation.isPending ? "Envoi en cours…" : "Envoyer la relance"}
            </button>
          </div>
        }
      >
        {nudgeTarget && (
          <form id="nudge-form" onSubmit={handleSendNudge} className="space-y-4">
            <div>
              <label htmlFor="nudge-template" className="block text-xs font-semibold text-slate-700 mb-1">
                Modèle de notification
              </label>
              <select
                id="nudge-template"
                value={nudgeTemplate}
                onChange={(e) => setNudgeTemplate(e.target.value as NudgeTemplate)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644]"
              >
                {NUDGE_TEMPLATE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Template preview hint */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
              <span className="font-semibold text-slate-700 block mb-1">Aperçu du message généré :</span>
              {nudgeTemplate === "STALE_BACKLOG" && (
                <span>
                  &ldquo;Vous avez {nudgeTarget.processing.stale} dossier
                  {nudgeTarget.processing.stale > 1 ? "s" : ""} en attente depuis plus de 7 jours.&rdquo;
                  {nudgeTarget.processing.stale === 0 && (
                    <span className="text-amber-700 block mt-1">
                      Attention : cet administrateur n&apos;a aucun dossier en attente depuis plus de 7 jours.
                    </span>
                  )}
                </span>
              )}
              {nudgeTemplate === "BEHIND_TARGET" && (
                <span>
                  &ldquo;
                  {nudgeTarget.role === "DIVISIONAL_ADMIN" ? "Votre département" : "Votre région"} est à{" "}
                  {nudgeTarget.coverage.percent != null
                    ? `${Math.round(nudgeTarget.coverage.percent * 100)}%`
                    : "—"}{" "}
                  de la cible 2026.&rdquo;
                  {nudgeTarget.coverage.percent == null && (
                    <span className="text-amber-700 block mt-1">
                      Attention : aucune cible n&apos;est définie pour ce ressort.
                    </span>
                  )}
                </span>
              )}
              {nudgeTemplate === "NO_RECENT_ACTIVITY" && (
                <span>
                  &ldquo;Aucune décision enregistrée sur votre compte depuis N jours.&rdquo;
                </span>
              )}
            </div>

            <div>
              <label htmlFor="nudge-message" className="block text-xs font-semibold text-slate-700 mb-1">
                Message personnalisé complémentaire (facultatif)
              </label>
              <textarea
                id="nudge-message"
                rows={3}
                maxLength={500}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Ajoutez des précisions ou consignes particulières…"
                className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644]"
              />
              <span className="text-[10px] text-slate-400 block text-right">
                {customMessage.length} / 500 caractères
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
  const roleLabel =
    actor.role === "REGIONAL_ADMIN"
      ? "Admin Régional"
      : actor.role === "DIVISIONAL_ADMIN"
        ? "Admin Départemental"
        : actor.role;

  const territoryLabel = [actor.region, actor.department].filter(Boolean).join(" — ") || "Non assigné";

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
            Dernière action système :{" "}
            <span className="font-semibold text-slate-700">
              {actor.lastActionAt ? formatDateTime(actor.lastActionAt) : "Aucune action enregistrée"}
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
            Relancer
          </button>
          <Link
            href={`/admin/journal-audit?actor=${encodeURIComponent(actor.userId)}`}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Voir le journal
          </Link>
          <Link
            href={`/admin/inscriptions?createdBy=${encodeURIComponent(actor.userId)}`}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Voir les inscriptions
          </Link>
        </div>
      </div>

      {/* 3 Metrics Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Section 1: Travail de terrain */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Travail de terrain
          </h4>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-600">Inscriptions assistées :</span>
              <strong className="text-slate-900">{actor.field.registrationsMade}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Conversions (ONEFOP) :</span>
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
              <span className="text-slate-600">Dernière inscription :</span>
              <span className="text-slate-700 font-medium">
                {actor.field.lastRegistrationAt
                  ? formatDateOnly(actor.field.lastRegistrationAt)
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Ressort — Cible & Couverture */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Ressort — Cible &amp; Couverture
          </h4>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-600">Inscrits / Cible :</span>
              <span className="font-semibold text-slate-900">
                {actor.coverage.current != null ? actor.coverage.current : "—"} /{" "}
                {actor.coverage.target != null ? actor.coverage.target : "—"}
              </span>
            </div>
            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-500">Taux de couverture</span>
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
            Traitement &amp; Files
          </h4>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-600">File en attente :</span>
              <span className="font-semibold text-slate-900">
                {actor.processing.backlog} dossier{actor.processing.backlog > 1 ? "s" : ""}
                {actor.processing.stale > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                    {actor.processing.stale} &gt; 7j
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Décisions prises :</span>
              <span className="font-medium text-slate-800">
                <span className="text-emerald-700 font-semibold" title="Validées">
                  {actor.processing.decisions.approved} val.
                </span>{" "}
                /{" "}
                <span className="text-rose-700 font-semibold" title="Rejetées">
                  {actor.processing.decisions.rejected} rej.
                </span>{" "}
                /{" "}
                <span className="text-amber-700 font-semibold" title="Compléments demandés">
                  {actor.processing.decisions.corrections} corr.
                </span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Délai médian de décision :</span>
              <span className="font-medium text-slate-700">
                {actor.processing.medianDaysToDecision != null
                  ? `${actor.processing.medianDaysToDecision} j`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
