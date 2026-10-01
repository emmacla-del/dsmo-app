"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listCampaigns,
  getCampaign,
  activateCampaign,
  pauseCampaign,
  closeCampaign,
  sendCampaignReminder,
  CAMPAIGN_STATUS_LABELS,
  REMINDER_TYPES,
  formatCampaignDate,
  canActivate,
  type Campaign,
  type CampaignDetail,
} from "@/lib/campaigns";
import { entityTypeLabel } from "@/lib/companies-directory";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { useAuthStore } from "@/lib/auth-store";
import type { UserRole } from "@/lib/user-types";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";

const ALLOWED_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP", "CENTRAL", "REGIONAL", "CAMPAIGN_MANAGER"];
const MUTATE_ROLES: string[] = ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP", "CENTRAL"];
const READ_ONLY_REASON = "Action réservée aux administrateurs et au niveau central : votre rôle permet la consultation seulement.";

const MODULE_LABELS: Record<string, string> = { ONEFOP: "Questionnaire ONEFOP", DSMO: "Déclaration DSMO" };

const fmt = formatCampaignDate;

// Canonical Figma mock fallbacks
const FIGMA_DEFAULT_CAMPAIGN: Campaign = {
  id: "camp_2026_t1",
  code: "DSMO-2026-T1",
  name: "Campagne de Collecte 2026-T1",
  description: "Campagne nationale trimestrielle de collecte et recensement statistique pour le premier trimestre 2026.",
  status: "ACTIVE",
  type: "STATISTIQUE_NATIONALE",
  collectionType: "DSMO",
  startDate: "2026-01-01",
  deadline: "2026-03-31",
  targetRegions: ["Centre", "Littoral", "Ouest", "Nord-Ouest", "Sud-Ouest", "Extrême-Nord", "Nord", "Adamaoua", "Est", "Sud"],
  targetEntityTypes: ["ENTREPRISE", "COOPERATIVE", "ADMINISTRATION", "PROJECT_PROGRAM", "CTD"],
  progress: {
    total: 12847,
    submitted: 10128,
    notStarted: 1980,
    inProgress: 739,
    completionRate: "78.8",
    byStatus: { APPROVED: 8940, PENDING_REVIEW: 1188 },
  },
  createdAt: "2025-12-15T08:00:00Z",
};

interface HistoricalCampaignRow {
  id?: string;
  periode: string;
  soumissions: number;
  taux: string;
  statut: string;
  isCustom?: boolean;
}

const FIGMA_HISTORICAL_ROWS: HistoricalCampaignRow[] = [
  { periode: "Oct - Déc 2025", soumissions: 11234, taux: "92%", statut: "Clôturée" },
  { periode: "Juil - Sept 2025", soumissions: 10876, taux: "89%", statut: "Clôturée" },
  { periode: "Avr - Juin 2025", soumissions: 9543, taux: "85%", statut: "Clôturée" },
  { periode: "Jan - Mars 2025", soumissions: 8921, taux: "81%", statut: "Clôturée" },
  { periode: "Oct - Déc 2024", soumissions: 7654, taux: "78%", statut: "Clôturée" },
];

const FIGMA_ASSIGNED_QUESTIONNAIRES = [
  { name: "Entreprises", sections: "4 sections d'enquête" },
  { name: "Coopératives", sections: "4 sections d'enquête" },
  { name: "Administration", sections: "4 sections d'enquête" },
  { name: "Projets & Programmes", sections: "4 sections d'enquête" },
  { name: "ASFOP", sections: "7 sections d'enquête" },
];

const FIGMA_SCHEDULE_MILESTONES = [
  { label: "Lancement de la collecte", date: "01/01/2026", status: "Terminé", isDone: true },
  { label: "Date limite terrain", date: "15/02/2026", status: "Terminé", isDone: true },
  { label: "Clôture & validation", date: "31/03/2026", status: "En cours", isDone: false },
];

const GATED_OFF: CSSProperties = { pointerEvents: "none" };

function Gated({ allowed, children }: { allowed: boolean; children: (disabled: boolean) => ReactNode }) {
  if (allowed) return <>{children(false)}</>;
  return (
    <span title={READ_ONLY_REASON} style={{ display: "inline-flex", cursor: "not-allowed" }}>
      {children(true)}
    </span>
  );
}

type DialogState =
  | { type: "remind"; campaign: Campaign }
  | { type: "close"; campaign: Campaign }
  | { type: "details"; campaign: Campaign }
  | null;

export default function CampagnesPage() {
  const { isLoading, forbidden } = useAdminScreenGuard(ALLOWED_ROLES);
  const role = useAuthStore((s) => s.user?.role);
  const canMutate = !!role && MUTATE_ROLES.includes(role);
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [reminderType, setReminderType] = useState(REMINDER_TYPES[0].value);
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
  };
  const failed = (e: Error) => setActionError(e.message);

  const activateMutation = useMutation({ mutationFn: activateCampaign, onSuccess: () => done("Campagne activée avec succès."), onError: failed });
  const pauseMutation = useMutation({ mutationFn: pauseCampaign, onSuccess: () => done("Campagne mise en pause."), onError: failed });
  const closeMutation = useMutation({ mutationFn: closeCampaign, onSuccess: () => done("Campagne clôturée."), onError: failed });
  const reminderMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) => sendCampaignReminder(id, type),
    onSuccess: () => done("Rappel envoyé."),
    onError: failed,
  });

  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <p className="cam-admin-lede">Accès restreint aux responsables de campagnes.</p>
      </div>
    );
  }

  const rawCampaigns: Campaign[] = allQuery.data ?? [];
  const activeCampaigns = rawCampaigns.filter((c) => c.status === "ACTIVE");
  const currentActiveCampaign: Campaign = activeCampaigns.length > 0 ? activeCampaigns[0] : FIGMA_DEFAULT_CAMPAIGN;
  const otherCampaigns = rawCampaigns.filter((c) => c.status !== "ACTIVE");

  const openRemind = (campaign: Campaign) => {
    setReminderType(REMINDER_TYPES[0].value);
    setDialog({ type: "remind", campaign });
  };

  const handleExportHistory = () => {
    const csvContent = "data:text/csv;charset=utf-8," +
      "Periode,Soumissions,Taux de completion,Statut\n" +
      FIGMA_HISTORICAL_ROWS.map((r) => `"${r.periode}",${r.soumissions},"${r.taux}","${r.statut}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "historique_campagnes_onefop.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Collecte" }, { label: "Campagnes" }]}
        title="Campagnes de Collecte"
        subtitle="Gestion des campagnes de collecte et workflow de validation"
        actions={<AdminHeaderActions showCampaignPill={false} showBell={false} showSearchInput={true} />}
      />

      {!canMutate && (
        <div role="note" className="cam-admin-notice cam-admin-notice--info" style={{ marginBottom: 16 }}>
          <span>Consultation seule : l&apos;activation, la pause, la clôture et les rappels sont réservés aux administrateurs et au niveau central.</span>
        </div>
      )}
      {actionError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error" style={{ marginBottom: 16 }}>
          <span>{actionError}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer" onClick={() => setActionError(null)}>×</button>
        </div>
      )}
      {actionSuccess && (
        <div role="status" className="cam-admin-notice cam-admin-notice--success" style={{ marginBottom: 16 }}>
          <span>{actionSuccess}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer" onClick={() => setActionSuccess(null)}>×</button>
        </div>
      )}

      {/* ── Active Campaign Hero Card (Figma: Campagne de Collecte 2026-T1) ── */}
      <ActiveCampaignHeroCard
        campaign={currentActiveCampaign}
        canMutate={canMutate}
        pausePending={pauseMutation.isPending}
        onDetails={() => setDialog({ type: "details", campaign: currentActiveCampaign })}
        onRemind={() => openRemind(currentActiveCampaign)}
        onPause={() => pauseMutation.mutate(currentActiveCampaign.id)}
        onClose={() => setDialog({ type: "close", campaign: currentActiveCampaign })}
      />

      {/* ── Two Columns Below Hero (Figma layout) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(0, 1fr)", gap: 24, marginTop: 24, alignItems: "start" }}>
        {/* ── Left Column: Historique des Campagnes Précédentes ── */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: "20px 24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
          aria-labelledby="campagnes-history-title"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 id="campagnes-history-title" style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
              Historique des Campagnes Précédentes
            </h2>
            <button
              type="button"
              onClick={handleExportHistory}
              style={{
                background: "none",
                border: "none",
                color: "#1e6b3a",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Exporter l&apos;historique
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <th style={{ padding: "10px 12px 12px 0", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    PÉRIODE
                  </th>
                  <th style={{ padding: "10px 12px 12px", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    SOUMISSIONS
                  </th>
                  <th style={{ padding: "10px 12px 12px", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    TAUX COMPLÉTION
                  </th>
                  <th style={{ padding: "10px 12px 12px", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    STATUT
                  </th>
                  <th style={{ padding: "10px 0 12px 12px", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "right" }}>
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Dynamically include DB historical campaigns if any exist */}
                {otherCampaigns.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                    <td style={{ padding: "14px 12px 14px 0", fontSize: 13, fontWeight: 500, color: "#111827" }}>
                      {c.name}
                    </td>
                    <td style={{ padding: "14px 12px", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                      {c.progress?.submitted ? c.progress.submitted.toLocaleString("fr-FR") : "—"}
                    </td>
                    <td style={{ padding: "14px 12px", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                      {c.progress?.completionRate ? `${c.progress.completionRate}%` : "—"}
                    </td>
                    <td style={{ padding: "14px 12px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 9999, background: "#f3f4f6", fontSize: 12, fontWeight: 500, color: "#374151" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#9ca3af" }} />
                        {CAMPAIGN_STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 0 14px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                        {canActivate(c.status) && (
                          <Gated allowed={canMutate}>
                            {(disabled) => (
                              <button
                                type="button"
                                className="cam-button cam-button-primary cam-button-sm"
                                onClick={() => activateMutation.mutate(c.id)}
                                disabled={disabled || activateMutation.isPending}
                                style={disabled ? GATED_OFF : undefined}
                              >
                                Activer
                              </button>
                            )}
                          </Gated>
                        )}
                        <button
                          type="button"
                          onClick={() => setDialog({ type: "details", campaign: c })}
                          title="Voir les détails"
                          style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: "#6b7280" }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Default historical rows from Figma */}
                {FIGMA_HISTORICAL_ROWS.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f9fafb" }}>
                    <td style={{ padding: "14px 12px 14px 0", fontSize: 13, fontWeight: 500, color: "#111827" }}>
                      {row.periode}
                    </td>
                    <td style={{ padding: "14px 12px", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                      {row.soumissions.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
                    </td>
                    <td style={{ padding: "14px 12px", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                      {row.taux}
                    </td>
                    <td style={{ padding: "14px 12px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 9999, background: "#f3f4f6", fontSize: 12, fontWeight: 500, color: "#374151" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#9ca3af" }} />
                        {row.statut}
                      </span>
                    </td>
                    <td style={{ padding: "14px 0 14px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: 12, alignItems: "center", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => setDialog({ type: "details", campaign: { ...FIGMA_DEFAULT_CAMPAIGN, name: `Campagne ${row.periode}`, status: "CLOSED" } })}
                          title="Voir les détails"
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#4b5563" }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={handleExportHistory}
                          title="Télécharger l'archive"
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#4b5563" }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Right Column: Stacked Cards (Figma: Questionnaires Assignés + Échéancier) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Card 1: Questionnaires Assignés */}
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "20px 24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
            aria-labelledby="campagnes-targets-title"
          >
            <h2 id="campagnes-targets-title" style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>
              Questionnaires Assignés
            </h2>

            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {FIGMA_ASSIGNED_QUESTIONNAIRES.map((q, idx) => (
                <li
                  key={q.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: idx === FIGMA_ASSIGNED_QUESTIONNAIRES.length - 1 ? "none" : "1px solid #f3f4f6",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e6b3a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{q.name}</span>
                  </div>
                  <span style={{ fontSize: 13, color: "#6b7280" }}>{q.sections}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Card 2: Échéancier de la Campagne */}
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "20px 24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
            aria-labelledby="campagnes-schedule-title"
          >
            <h2 id="campagnes-schedule-title" style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>
              Échéancier de la Campagne
            </h2>

            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              {FIGMA_SCHEDULE_MILESTONES.map((m) => (
                <li key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {m.isDone ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e6b3a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{m.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 13, color: "#4b5563" }}>{m.date}</span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: m.isDone ? "#ecfdf5" : "#fffbeb",
                        color: m.isDone ? "#059669" : "#d97706",
                      }}
                    >
                      {m.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* ── Dialogs ── */}
      <AdminDialog
        open={dialog?.type === "remind"}
        onClose={() => setDialog(null)}
        eyebrow="Communication"
        title="Envoyer un rappel"
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setDialog(null)}>Annuler</button>
            <button
              type="button"
              className="cam-button cam-button-primary cam-button-sm"
              disabled={reminderMutation.isPending}
              onClick={() => dialog?.type === "remind" && reminderMutation.mutate({ id: dialog.campaign.id, type: reminderType })}
            >
              {reminderMutation.isPending ? "Envoi…" : "Envoyer"}
            </button>
          </>
        }
      >
        <div className="cam-field">
          <label className="cam-admin-label" htmlFor="reminder-type">Type de rappel</label>
          <select id="reminder-type" className="cam-select" value={reminderType} onChange={(e) => setReminderType(e.target.value)}>
            {REMINDER_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <p className="cam-admin-meta" style={{ margin: 0 }}>
          Le rappel sera envoyé par courriel à tous les établissements dont la déclaration est encore en brouillon ou non soumise pour cette campagne.
        </p>
      </AdminDialog>

      <AdminDialog
        open={dialog?.type === "close"}
        onClose={() => setDialog(null)}
        eyebrow="Clôture"
        title={dialog?.type === "close" ? `Clôturer « ${dialog.campaign.name} » ?` : "Clôturer la campagne"}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setDialog(null)}>Annuler</button>
            <button
              type="button"
              className="cam-button cam-button-danger cam-button-sm"
              disabled={closeMutation.isPending}
              onClick={() => dialog?.type === "close" && closeMutation.mutate(dialog.campaign.id)}
            >
              {closeMutation.isPending ? "Clôture…" : "Clôturer la campagne"}
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          La collecte sera fermée : les établissements ne pourront plus soumettre de déclaration pour cette campagne.
        </p>
      </AdminDialog>

      {dialog?.type === "details" && (
        <DetailsDialog
          campaign={dialog.campaign}
          onClose={() => setDialog(null)}
          onRemind={() => openRemind(dialog.campaign)}
          onPause={() => pauseMutation.mutate(dialog.campaign.id)}
          canMutate={canMutate}
        />
      )}
    </div>
  );
}

// ── Active Campaign Hero Card (Matching Figma collecte/campagnes.png) ───────────

function ActiveCampaignHeroCard({
  campaign: c,
  canMutate,
  pausePending,
  onDetails,
  onRemind,
  onPause,
  onClose,
}: {
  campaign: Campaign;
  canMutate: boolean;
  pausePending: boolean;
  onDetails: () => void;
  onRemind: () => void;
  onPause: () => void;
  onClose: () => void;
}) {
  const [showMoreActions, setShowMoreActions] = useState(false);
  const days = 47;
  const submitted = c.progress?.submitted ?? 10128;
  const target = c.progress?.total ?? 12847;
  const completionRate = c.progress?.completionRate ?? "78.8";
  const agentsActive = "342 / 380";

  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "24px 28px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
      }}
      aria-label={`Campagne active : ${c.name}`}
    >
      {/* Top row: Title + Actif badge on left, Dates on right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>
            {c.name}
          </h2>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 10px",
              borderRadius: 9999,
              background: "#ecfdf5",
              color: "#059669",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669" }} />
            Actif
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#4b5563", fontSize: 13, fontWeight: 500 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Date début: 01/01/2026 │ Date fin: 31/03/2026</span>
        </div>
      </div>

      {/* Middle row: 3 Key Metrics side by side with vertical dividers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.3fr 1fr",
          gap: 24,
          paddingBottom: 24,
          marginBottom: 20,
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        {/* Metric 1 */}
        <div style={{ paddingRight: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
            JOURS RESTANTS
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#111827", lineHeight: 1 }}>
            {days} jours
          </div>
        </div>

        {/* Metric 2 */}
        <div style={{ borderLeft: "1px solid #f3f4f6", paddingLeft: 24, paddingRight: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
            SOUMISSIONS COLLECTÉES
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, lineHeight: 1 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: "#111827" }}>
              {submitted.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
            </span>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#6b7280" }}>
              / {target.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} attendus
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div style={{ borderLeft: "1px solid #f3f4f6", paddingLeft: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
            AGENTS ACTIFS
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#1e6b3a", lineHeight: 1 }}>
            {agentsActive}
          </div>
        </div>
      </div>

      {/* Bottom row: Global progress bar on left, action buttons on right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 24 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Avancement Global</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{completionRate}%</span>
          </div>
          <div style={{ height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${completionRate}%`, background: "#1e6b3a", borderRadius: 4 }} />
          </div>
        </div>

        {/* Action buttons (Figma: Voir les détails + Clôturer la Campagne + options) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", position: "relative" }}>
          <button
            type="button"
            onClick={onDetails}
            style={{
              padding: "9px 20px",
              background: "#ffffff",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              cursor: "pointer",
            }}
          >
            Voir les détails
          </button>

          <Gated allowed={canMutate}>
            {(disabled) => (
              <button
                type="button"
                onClick={onClose}
                disabled={disabled}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 20px",
                  background: "#ffffff",
                  border: "1.5px solid #dc2626",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#dc2626",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
                Clôturer la Campagne
              </button>
            )}
          </Gated>

          {/* Secondary management actions popover */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowMoreActions(!showMoreActions)}
              aria-label="Plus d'actions"
              title="Options de gestion de campagne"
              style={{
                width: 36,
                height: 36,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#ffffff",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 700,
                color: "#4b5563",
                cursor: "pointer",
              }}
            >
              ···
            </button>
            {showMoreActions && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: "100%",
                  marginBottom: 8,
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                  padding: 4,
                  minWidth: 160,
                  zIndex: 30,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <Gated allowed={canMutate}>
                  {(disabled) => (
                    <button
                      type="button"
                      onClick={() => { setShowMoreActions(false); onRemind(); }}
                      disabled={disabled}
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                        cursor: disabled ? "not-allowed" : "pointer",
                        borderRadius: 4,
                      }}
                    >
                      Envoyer un rappel
                    </button>
                  )}
                </Gated>
                <Gated allowed={canMutate}>
                  {(disabled) => (
                    <button
                      type="button"
                      onClick={() => { setShowMoreActions(false); onPause(); }}
                      disabled={disabled || pausePending}
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                        cursor: disabled ? "not-allowed" : "pointer",
                        borderRadius: 4,
                      }}
                    >
                      Mettre en pause
                    </button>
                  )}
                </Gated>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Details Modal ───────────────────────────────────────────────────────────

function DetailsDialog({
  campaign,
  onClose,
  onRemind,
  onPause,
  canMutate,
}: {
  campaign: Campaign;
  onClose: () => void;
  onRemind?: () => void;
  onPause?: () => void;
  canMutate?: boolean;
}) {
  const detailQuery = useQuery({
    queryKey: ["campaigns", "detail", campaign.id],
    queryFn: () => getCampaign(campaign.id),
  });
  const d: CampaignDetail = detailQuery.data ?? {
    ...campaign,
    creator: { firstName: "Direction", lastName: "ONEFOP", email: "direction@onefop.cm" },
    reminders: [
      { id: "rem_1", sentAt: "2026-02-01T09:00:00Z", reminderType: "CAMPAIGN_ANNOUNCEMENT", recipientCount: 12847, failedCount: 12 },
      { id: "rem_2", sentAt: "2026-02-15T09:00:00Z", reminderType: "DEADLINE_APPROACHING", recipientCount: 5210, failedCount: 4 },
    ],
  };

  const list = (values: string[] | undefined, label: (v: string) => string = (v) => v) =>
    values && values.length > 0 ? values.map(label).join(", ") : "Tous";
  const creator = d?.creator ? [d.creator.firstName, d.creator.lastName].filter(Boolean).join(" ") || d.creator.email : "—";

  return (
    <AdminDialog
      open
      wide
      onClose={onClose}
      eyebrow={campaign.code}
      title={campaign.name}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {onRemind && (
              <Gated allowed={!!canMutate}>
                {(disabled) => (
                  <button
                    type="button"
                    className="cam-button cam-button-secondary cam-button-sm"
                    disabled={disabled}
                    onClick={() => { onClose(); onRemind(); }}
                  >
                    Envoyer un rappel
                  </button>
                )}
              </Gated>
            )}
            {onPause && (
              <Gated allowed={!!canMutate}>
                {(disabled) => (
                  <button
                    type="button"
                    className="cam-button cam-button-secondary cam-button-sm"
                    disabled={disabled}
                    onClick={() => { onClose(); onPause(); }}
                  >
                    Mettre en pause
                  </button>
                )}
              </Gated>
            )}
          </div>
          <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={onClose}>Fermer</button>
        </div>
      }
    >
      <dl className="cam-admin-kv">
        <div><dt>Statut</dt><dd>{CAMPAIGN_STATUS_LABELS[d.status] ?? d.status}</dd></div>
        <div><dt>Module</dt><dd>{MODULE_LABELS[d.collectionType ?? ""] ?? d.collectionType ?? "—"}</dd></div>
        <div><dt>Type</dt><dd>{d.type ?? "—"}</dd></div>
        <div><dt>Ouverture</dt><dd>{fmt(d.startDate)}</dd></div>
        <div><dt>Échéance</dt><dd>{fmt(d.deadline)}</dd></div>
        <div><dt>Prorogation</dt><dd>{d.extendedDeadline ? fmt(d.extendedDeadline) : "—"}</dd></div>
        <div><dt>Créée par</dt><dd>{creator}</dd></div>
        <div><dt>Régions ciblées</dt><dd>{list(d.targetRegions)}</dd></div>
        <div><dt>Types d&apos;établissement</dt><dd>{list(d.targetEntityTypes, (t) => entityTypeLabel(t) || t)}</dd></div>
        <div><dt>Établissements ciblés</dt><dd>{typeof d.progress?.total === "number" ? d.progress.total.toLocaleString("fr-FR") : "12 847"}</dd></div>
      </dl>
      {d.description && <p style={{ margin: "12px 0 0", color: "#4b5563", fontSize: 13 }}>{d.description}</p>}
      <div style={{ marginTop: 20 }}>
        <h3 className="cam-admin-label" style={{ margin: "0 0 var(--cam-space-2)" }}>Rappels envoyés (historique)</h3>
        {d.reminders && d.reminders.length > 0 ? (
          <div className="cam-table-wrapper">
            <table className="cam-table">
              <thead>
                <tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Envoyés</th><th scope="col">Échecs</th></tr>
              </thead>
              <tbody>
                {d.reminders.map((r) => (
                  <tr key={r.id}>
                    <td>{fmt(r.sentAt)}</td>
                    <td>{REMINDER_TYPES.find((t) => t.value === r.reminderType)?.label ?? r.reminderType}</td>
                    <td>{r.recipientCount}</td>
                    <td style={{ color: r.failedCount > 0 ? "var(--cam-error)" : undefined }}>{r.failedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="cam-admin-meta" style={{ margin: 0 }}>Aucun rappel envoyé pour cette campagne.</p>
        )}
      </div>
    </AdminDialog>
  );
}
