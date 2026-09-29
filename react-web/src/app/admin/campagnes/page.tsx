"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listCampaigns,
  activateCampaign,
  pauseCampaign,
  closeCampaign,
  sendCampaignReminder,
  CAMPAIGN_STATUS_LABELS,
  REMINDER_TYPES,
  formatCampaignDate,
  canActivate,
  type Campaign,
} from "@/lib/campaigns";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import type { UserRole } from "@/lib/user-types";

const ALLOWED_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP", "CENTRAL", "REGIONAL", "CAMPAIGN_MANAGER"];

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:    { label: "Brouillon",  color: "#b8860b", bg: "#fef9e7" },
  ACTIVE:   { label: "Active",     color: "#1e6b3a", bg: "#e8f5ef" },
  PAUSED:   { label: "En pause",   color: "#1a6896", bg: "#e8f2ff" },
  CLOSED:   { label: "Clôturée",  color: "#4a5a50", bg: "#f0f2ef" },
  ARCHIVED: { label: "Archivée",  color: "#4a5a50", bg: "#f0f2ef" },
};

function fmt(iso: string | null | undefined) {
  return formatCampaignDate(iso);
}

export default function CampagnesPage() {
  const { isLoading, forbidden } = useAdminScreenGuard(ALLOWED_ROLES);
  const queryClient = useQueryClient();
  const [reminderCampaignId, setReminderCampaignId] = useState<string | null>(null);
  const [reminderType, setReminderType] = useState(REMINDER_TYPES[0].value);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const allQuery = useQuery({
    queryKey: ["campaigns", "all"],
    queryFn: () => listCampaigns(),
    enabled: !isLoading && !forbidden,
  });

  const activateMutation = useMutation({
    mutationFn: activateCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setActionSuccess("Campagne activée avec succès.");
      setActionError(null);
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const pauseMutation = useMutation({
    mutationFn: pauseCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setActionSuccess("Campagne mise en pause.");
      setActionError(null);
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const closeMutation = useMutation({
    mutationFn: closeCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setActionSuccess("Campagne clôturée.");
      setActionError(null);
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const reminderMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) => sendCampaignReminder(id, type),
    onSuccess: () => {
      setReminderCampaignId(null);
      setActionSuccess("Rappel envoyé.");
      setActionError(null);
    },
    onError: (e: Error) => setActionError(e.message),
  });

  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <p className="cam-admin-lede">Accès restreint aux responsables de campagnes.</p>
      </div>
    );
  }

  const campaigns: Campaign[] = allQuery.data ?? [];
  const activeCampaign = campaigns.find((c) => c.status === "ACTIVE");
  const otherCampaigns = campaigns.filter((c) => c.status !== "ACTIVE");

  return (
    <div className="cam-admin-page">
      {actionError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>{actionError}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer" onClick={() => setActionError(null)}>×</button>
        </div>
      )}
      {actionSuccess && (
        <div role="status" className="cam-admin-notice cam-admin-notice--success">
          <span>{actionSuccess}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer" onClick={() => setActionSuccess(null)}>×</button>
        </div>
      )}

      {/* Active campaign banner */}
      {activeCampaign ? (
        <div className="cam-campaign-banner">
          <div className="cam-campaign-banner-dot" aria-hidden="true" />
          <div className="cam-campaign-banner-body">
            <div className="cam-campaign-banner-title">{activeCampaign.name}</div>
            <div className="cam-campaign-banner-meta">
              Ouverture : {fmt(activeCampaign.startDate)} · Clôture : {fmt(activeCampaign.extendedDeadline ?? activeCampaign.deadline)}
              {activeCampaign.description && <> · {activeCampaign.description}</>}
            </div>
          </div>
          <div className="cam-campaign-banner-actions">
            <button
              type="button"
              className="cam-button cam-button-secondary cam-button-sm"
              onClick={() => { setReminderCampaignId(activeCampaign.id); setReminderType(REMINDER_TYPES[0].value); }}
            >
              Envoyer un rappel
            </button>
            <button
              type="button"
              className="cam-button cam-button-secondary cam-button-sm"
              onClick={() => pauseMutation.mutate(activeCampaign.id)}
              disabled={pauseMutation.isPending}
            >
              Mettre en pause
            </button>
            <button
              type="button"
              className="cam-button cam-button-sm"
              style={{ background: "var(--cam-error)", color: "#fff", border: "none" }}
              onClick={() => { if (window.confirm("Clôturer cette campagne ?")) closeMutation.mutate(activeCampaign.id); }}
              disabled={closeMutation.isPending}
            >
              Clôturer
            </button>
          </div>
        </div>
      ) : (
        <div className="cam-campaign-banner cam-campaign-banner--idle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <div className="cam-campaign-banner-title">Aucune campagne active</div>
            <div className="cam-campaign-banner-meta">Activez une campagne BROUILLON ou créez-en une depuis la console Flutter.</div>
          </div>
        </div>
      )}

      {/* Campaigns history table */}
      <section className="cam-admin-section" aria-labelledby="campagnes-title">
        <div className="cam-admin-section-head">
          <h2 className="cam-admin-h2" id="campagnes-title">Historique des campagnes</h2>
          <span className="cam-admin-meta">{campaigns.length} campagne{campaigns.length !== 1 ? "s" : ""}</span>
        </div>
        {allQuery.isLoading ? (
          <div className="cam-admin-empty">Chargement…</div>
        ) : allQuery.isError ? (
          <div className="cam-admin-empty">Impossible de charger les campagnes.</div>
        ) : campaigns.length === 0 ? (
          <div className="cam-admin-empty">
            <strong>Aucune campagne</strong>
            Les campagnes sont créées depuis la console de gestion Flutter.
          </div>
        ) : (
          <div className="cam-table-wrapper">
            <table className="cam-table">
              <thead>
                <tr>
                  <th>Nom de la campagne</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Ouverture</th>
                  <th>Clôture</th>
                  <th>Statut</th>
                  <th className="text-right"><span className="cam-sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.CLOSED;
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="cam-admin-strong">{c.name}</div>
                        {c.description && <div className="cam-admin-meta">{c.description}</div>}
                      </td>
                      <td><span className="cam-admin-code">{c.code}</span></td>
                      <td className="cam-admin-meta">{c.collectionType ?? c.type ?? "—"}</td>
                      <td className="cam-admin-meta" style={{ whiteSpace: "nowrap" }}>{fmt(c.startDate)}</td>
                      <td className="cam-admin-meta" style={{ whiteSpace: "nowrap" }}>
                        {fmt(c.extendedDeadline ?? c.deadline)}
                        {c.extendedDeadline && c.deadline && c.extendedDeadline !== c.deadline && (
                          <div className="cam-admin-meta" style={{ color: "var(--cam-info)" }}>
                            Prorogée (était {fmt(c.deadline)})
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="cam-pilot-badge" style={{ color: badge.color, background: badge.bg }}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="text-right">
                        <div style={{ display: "flex", gap: "var(--cam-space-2)", justifyContent: "flex-end" }}>
                          {canActivate(c.status) && (
                            <button
                              type="button"
                              className="cam-button cam-button-primary cam-button-sm"
                              onClick={() => activateMutation.mutate(c.id)}
                              disabled={activateMutation.isPending}
                            >
                              Activer
                            </button>
                          )}
                          {c.status === "ACTIVE" && (
                            <button
                              type="button"
                              className="cam-button cam-button-secondary cam-button-sm"
                              onClick={() => { setReminderCampaignId(c.id); setReminderType(REMINDER_TYPES[0].value); }}
                            >
                              Rappel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Reminder modal */}
      {reminderCampaignId && (
        <div className="cam-admin-dialog-backdrop" onClick={() => setReminderCampaignId(null)} aria-hidden="true" />
      )}
      {reminderCampaignId && (
        <div className="cam-admin-dialog cam-admin-dialog--sm" role="dialog" aria-modal="true" aria-label="Envoyer un rappel">
          <div className="cam-admin-dialog-head">
            <div className="cam-admin-dialog-eyebrow">Communication</div>
            <h2 className="cam-admin-dialog-title">Envoyer un rappel</h2>
          </div>
          <div className="cam-admin-dialog-body">
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="reminder-type">Type de rappel</label>
              <select id="reminder-type" className="cam-select" value={reminderType} onChange={(e) => setReminderType(e.target.value)}>
                {REMINDER_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <p className="cam-admin-meta" style={{ margin: 0 }}>
              Le rappel sera envoyé par courriel à tous les établissements dont la déclaration est encore en brouillon ou non soumise pour cette campagne.
            </p>
          </div>
          <div className="cam-admin-dialog-foot">
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setReminderCampaignId(null)}>
              Annuler
            </button>
            <button
              type="button"
              className="cam-button cam-button-primary cam-button-sm"
              onClick={() => reminderMutation.mutate({ id: reminderCampaignId, type: reminderType })}
              disabled={reminderMutation.isPending}
            >
              {reminderMutation.isPending ? "Envoi…" : "Envoyer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
