"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listCampaigns,
  getCampaign,
  createCampaign,
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

// @Roles on POST /campaigns/:id/activate|pause|close|remind (campaign.controller.ts).
// Every other role that reaches this page (REGIONAL) reads only.
const MUTATE_ROLES: string[] = ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP", "CENTRAL"];
const READ_ONLY_REASON = "Action réservée aux administrateurs et au niveau central : votre rôle permet la consultation seulement.";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "cam-badge-warning",
  ACTIVE: "cam-badge-success",
  PAUSED: "cam-badge-info",
  CLOSED: "cam-badge-neutral",
  ARCHIVED: "cam-badge-neutral",
};

const MODULE_LABELS: Record<string, string> = { ONEFOP: "Questionnaire ONEFOP", DSMO: "Déclaration DSMO" };

const fmt = formatCampaignDate;
const effectiveDeadline = (c: Campaign) => c.extendedDeadline ?? c.deadline ?? null;
const isPast = (iso: string | null | undefined) => !!iso && new Date(iso).getTime() < Date.now();

function daysLeft(c: Campaign): { value: string; hint: string; tone?: "is-alert" | "is-warn" | "is-good" } {
  const deadline = effectiveDeadline(c);
  if (!deadline) return { value: "—", hint: "Aucune échéance fixée" };
  const ms = new Date(deadline).getTime() - Date.now();
  if (Number.isNaN(ms)) return { value: "—", hint: "Échéance illisible" };
  if (ms < 0) return { value: "Échue", hint: `depuis le ${fmt(deadline)}`, tone: "is-alert" };
  const days = Math.ceil(ms / 86_400_000);
  return { value: `${days} jour${days > 1 ? "s" : ""}`, hint: `jusqu'au ${fmt(deadline)}`, tone: days <= 7 ? "is-warn" : "is-good" };
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`cam-badge ${STATUS_BADGE[status] ?? "cam-badge-neutral"}`}>
      {CAMPAIGN_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function formatCampaignDisplayName(name: string): string {
  if (!name) return "—";
  if (name.includes("COLLECTE DES DONNEES SUR LES EMPLOIS") || name.includes("SECTEUR MODERNE")) {
    return "Collecte des données sur les emplois (Secteur moderne)";
  }
  if (name.includes("DECLARATION SUR LA SITUATION DE LA MAIN D'OEUVRE") || name.includes("MAIN D'OEUVRE")) {
    return "Déclaration sur la situation de la main d'œuvre (DSMO)";
  }
  if (name.length > 40 && name === name.toUpperCase()) {
    return name.charAt(0) + name.slice(1).toLowerCase();
  }
  return name;
}

// A disabled <button> swallows the pointer without showing its own title, so
// the reason sits on a wrapper span and the disabled button lets the pointer
// through (GATED_OFF) to reach it. Keyboard users get the same reason from the
// read-only notice at the top of the page.
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
  const [createOpen, setCreateOpen] = useState(false);
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
    setCreateOpen(false);
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

  const campaigns: Campaign[] = allQuery.data ?? [];
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");
  const otherCampaigns = campaigns.filter((c) => c.status !== "ACTIVE");
  const openRemind = (campaign: Campaign) => { setReminderType(REMINDER_TYPES[0].value); setDialog({ type: "remind", campaign }); };

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Collecte" }, { label: "Campagnes" }]}
        title="Campagnes Nationales de Recensement"
        actions={
          <div style={{ display: "flex", gap: "var(--cam-space-2)", alignItems: "center" }}>
            <AdminHeaderActions />
            <Gated allowed={canMutate}>
              {(disabled) => (
                <button
                  type="button"
                  className="cam-button cam-button-primary cam-button-sm"
                  disabled={disabled}
                  style={disabled ? GATED_OFF : undefined}
                  onClick={() => setCreateOpen(true)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 6 }}>
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Lancer une campagne
                </button>
              )}
            </Gated>
          </div>
        }
      />
      {!canMutate && (
        <div role="note" className="cam-admin-notice cam-admin-notice--info">
          <span>Consultation seule : l&apos;activation, la pause, la clôture et les rappels sont réservés aux administrateurs et au niveau central.</span>
        </div>
      )}
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

      {/* ── Active campaign(s): one per module can be open at once ── */}
      {allQuery.isLoading ? null : activeCampaigns.length === 0 ? (
        <div className="cam-campaign-banner cam-campaign-banner--idle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <div className="cam-campaign-banner-title">Aucune campagne active</div>
            <div className="cam-campaign-banner-meta">Activez une campagne en brouillon ci-dessous, ou lancez-en une nouvelle avec le bouton ci-dessus.</div>
          </div>
        </div>
      ) : (
        activeCampaigns.map((c) => (
          <ActiveCampaignCard
            key={c.id}
            campaign={c}
            canMutate={canMutate}
            pausePending={pauseMutation.isPending}
            onDetails={() => setDialog({ type: "details", campaign: c })}
            onRemind={() => openRemind(c)}
            onPause={() => pauseMutation.mutate(c.id)}
            onClose={() => setDialog({ type: "close", campaign: c })}
          />
        ))
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--cam-space-4)", alignItems: "flex-start" }}>
        {/* ── History ── */}
        <section className="cam-pilot-panel" style={{ flex: "3 1 640px", minWidth: 0, overflow: "hidden" }} aria-labelledby="campagnes-history-title">
          <div className="cam-pilot-panel-head">
            <h2 className="cam-admin-h2" id="campagnes-history-title">Historique des campagnes</h2>
            <span className="cam-admin-meta">{otherCampaigns.length} campagne{otherCampaigns.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="cam-pilot-panel-body" style={otherCampaigns.length > 0 && !allQuery.isError ? { padding: 0 } : undefined}>
            {allQuery.isLoading ? (
              <div className="cam-admin-empty">Chargement…</div>
            ) : allQuery.isError ? (
              <div role="alert" className="cam-admin-notice cam-admin-notice--error">
                <span>Impossible de charger les campagnes : {(allQuery.error as Error).message}</span>
              </div>
            ) : otherCampaigns.length === 0 ? (
              <div className="cam-admin-empty">
                <strong>Aucune autre campagne</strong>
                Créez et activez une campagne avec le bouton « Lancer une campagne » ci-dessus.
              </div>
            ) : (
              // Wide tables scroll horizontally inside the panel; no second bordered box.
              <div style={{ overflowX: "auto" }}>
                <table className="cam-table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: "42%" }}>Campagne</th>
                      <th scope="col">Type</th>
                      <th scope="col">Ouverture</th>
                      <th scope="col">Clôture</th>
                      <th scope="col">Statut</th>
                      <th scope="col" style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherCampaigns.map((c) => (
                      <tr key={c.id}>
                        <td style={{ maxWidth: 360, padding: "10px 14px", verticalAlign: "middle" }}>
                          <div
                            className="cam-admin-strong"
                            title={c.name}
                            style={{
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "var(--cam-text)",
                            }}
                          >
                            {formatCampaignDisplayName(c.name)}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                            <span className="cam-admin-code cam-admin-muted" style={{ fontSize: "11px" }}>{c.code}</span>
                          </div>
                        </td>
                        <td className="cam-admin-meta" style={{ whiteSpace: "nowrap", padding: "10px 14px", verticalAlign: "middle" }}>
                          <span className="cam-badge cam-badge-neutral" style={{ fontSize: "11px", fontWeight: 600 }}>
                            {c.collectionType ?? c.type ?? "—"}
                          </span>
                        </td>
                        <td className="cam-admin-meta" style={{ whiteSpace: "nowrap", padding: "10px 14px", verticalAlign: "middle" }}>{fmt(c.startDate)}</td>
                        <td className="cam-admin-meta" style={{ whiteSpace: "nowrap", padding: "10px 14px", verticalAlign: "middle" }}>
                          {fmt(effectiveDeadline(c))}
                          {c.extendedDeadline && c.deadline && c.extendedDeadline !== c.deadline && (
                            <div className="cam-admin-meta" style={{ color: "var(--cam-info)", fontSize: "11px" }}>Prorogée (était {fmt(c.deadline)})</div>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", verticalAlign: "middle" }}><StatusBadge status={c.status} /></td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap", padding: "10px 14px", verticalAlign: "middle" }}>
                          <div style={{ display: "inline-flex", gap: "var(--cam-space-3)", alignItems: "center", justifyContent: "flex-end" }}>
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
                              className="cam-text-button"
                              aria-label={`Voir les détails de ${c.name}`}
                              title="Voir les détails"
                              onClick={() => setDialog({ type: "details", campaign: c })}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ── Side panels (first active campaign) ── */}
        {activeCampaigns[0] && (
          <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "var(--cam-space-4)", minWidth: 0 }}>
            <TargetsPanel campaign={activeCampaigns[0]} />
            <SchedulePanel campaign={activeCampaigns[0]} />
          </div>
        )}
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

      {dialog?.type === "details" && <DetailsDialog campaign={dialog.campaign} onClose={() => setDialog(null)} />}
      <CreateCampaignDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(msg) => done(msg)}
      />
    </div>
  );
}

// ── Active campaign card ────────────────────────────────────────────────────

function ActiveCampaignCard({ campaign: c, canMutate, pausePending, onDetails, onRemind, onPause, onClose }: {
  campaign: Campaign; canMutate: boolean; pausePending: boolean;
  onDetails: () => void; onRemind: () => void; onPause: () => void; onClose: () => void;
}) {
  const remaining = daysLeft(c);
  const expected = c.progress?.total;
  return (
    <section className="cam-admin-section" style={{ borderLeft: "4px solid var(--cam-green)" }} aria-label={`Campagne active : ${c.name}`}>
      <div className="cam-admin-section-body" style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--cam-space-3)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--cam-space-3)" }}>
            <h2 className="cam-admin-h2" style={{ margin: 0 }} title={c.name}>{formatCampaignDisplayName(c.name)}</h2>
            <span className="cam-admin-code" style={{ fontSize: "12px", background: "var(--cam-surface-subtle)", padding: "2px 8px", borderRadius: "4px" }}>
              {c.code}
            </span>
            <StatusBadge status={c.status} />
          </div>
          <span className="cam-admin-meta">
            Date début : {fmt(c.startDate)} │ Date fin : {fmt(effectiveDeadline(c))}
            {c.extendedDeadline && c.deadline && c.extendedDeadline !== c.deadline && <> (prorogée, était {fmt(c.deadline)})</>}
          </span>
        </div>
        {c.description && <p className="cam-admin-meta" style={{ margin: 0 }}>{c.description}</p>}

        {/* Figma separates the figures with rules only: keep the strip's dividers, drop its box. */}
        <div className="cam-admin-stats" style={{ border: "none", background: "transparent" }}>
          <div className="cam-admin-stat">
            <div className="cam-admin-stat-label">Jours restants</div>
            <div className={`cam-admin-stat-value ${remaining.tone ?? ""}`}>{remaining.value}</div>
            <div className="cam-admin-stat-hint">{remaining.hint}</div>
          </div>
          <div className="cam-admin-stat">
            <div className="cam-admin-stat-label">Établissements ciblés</div>
            <div className="cam-admin-stat-value">{typeof expected === "number" ? expected.toLocaleString("fr-FR") : "—"}</div>
            <div className="cam-admin-stat-hint">Déclarations attendues à l&apos;activation</div>
          </div>
          <div className="cam-admin-stat">
            <div className="cam-admin-stat-label">Soumissions collectées</div>
            <div className="cam-admin-stat-value">—</div>
            <div className="cam-admin-stat-hint">Suivi non disponible : le serveur ne met pas encore à jour les soumissions de campagne</div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "var(--cam-space-2)" }}>
          <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={onDetails}>Voir les détails</button>
          <Gated allowed={canMutate}>
            {(disabled) => (
              <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled={disabled} style={disabled ? GATED_OFF : undefined} onClick={onRemind}>
                Envoyer un rappel
              </button>
            )}
          </Gated>
          <Gated allowed={canMutate}>
            {(disabled) => (
              <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled={disabled || pausePending} style={disabled ? GATED_OFF : undefined} onClick={onPause}>
                Mettre en pause
              </button>
            )}
          </Gated>
          <Gated allowed={canMutate}>
            {(disabled) => (
              <button type="button" className="cam-button cam-button-danger cam-button-sm" disabled={disabled} style={disabled ? GATED_OFF : undefined} onClick={onClose}>
                Clôturer la campagne
              </button>
            )}
          </Gated>
        </div>
      </div>
    </section>
  );
}

// ── Side panels ─────────────────────────────────────────────────────────────

function TargetsPanel({ campaign: c }: { campaign: Campaign }) {
  const types = c.targetEntityTypes ?? [];
  return (
    <section className="cam-pilot-panel" aria-labelledby="campagnes-targets-title">
      <div className="cam-pilot-panel-head">
        <h2 className="cam-admin-h2" id="campagnes-targets-title">Questionnaires assignés</h2>
      </div>
      <div className="cam-pilot-panel-body">
        <p className="cam-admin-meta" style={{ margin: "0 0 var(--cam-space-2)" }}>
          {MODULE_LABELS[c.collectionType ?? ""] ?? c.collectionType ?? "—"}
        </p>
        {types.length === 0 ? (
          <p style={{ margin: 0 }}>Tous les types d&apos;établissement</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {types.map((t) => (
              <li key={t} style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", padding: "var(--cam-space-2) 0", borderBottom: "var(--cam-border-width) solid var(--cam-border)" }}>
                <span aria-hidden="true" style={{ color: "var(--cam-green)", fontWeight: 700 }}>✓</span>
                <span className="cam-admin-strong">{entityTypeLabel(t) || t}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SchedulePanel({ campaign: c }: { campaign: Campaign }) {
  const deadline = effectiveDeadline(c);
  const steps = [
    { label: "Lancement de la collecte", date: c.startDate ?? null },
    { label: "Date limite de déclaration", date: deadline },
  ];
  return (
    <section className="cam-pilot-panel" aria-labelledby="campagnes-schedule-title">
      <div className="cam-pilot-panel-head">
        <h2 className="cam-admin-h2" id="campagnes-schedule-title">Échéancier de la campagne</h2>
      </div>
      <div className="cam-pilot-panel-body">
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
          {steps.map((s) => {
            const done = isPast(s.date);
            return (
              <li key={s.label} style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)" }}>
                <span className="cam-admin-strong" style={{ flex: 1 }}>{s.label}</span>
                <span className="cam-admin-meta" style={{ whiteSpace: "nowrap" }}>{fmt(s.date)}</span>
                {s.date && (
                  <span className={`cam-badge ${done ? "cam-badge-success" : "cam-badge-warning"}`}>{done ? "Terminé" : "En cours"}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ── Détails (GET /campaigns/:id) ────────────────────────────────────────────

function DetailsDialog({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const detailQuery = useQuery({ queryKey: ["campaigns", "detail", campaign.id], queryFn: () => getCampaign(campaign.id) });
  const d: CampaignDetail | undefined = detailQuery.data;
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
      footer={<button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={onClose}>Fermer</button>}
    >
      {detailQuery.isLoading && <div className="cam-admin-empty">Chargement…</div>}
      {detailQuery.isError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>Impossible de charger le détail : {(detailQuery.error as Error).message}</span>
        </div>
      )}
      {d && (
        <>
          <dl className="cam-admin-kv">
            <div><dt>Statut</dt><dd><StatusBadge status={d.status} /></dd></div>
            <div><dt>Module</dt><dd>{MODULE_LABELS[d.collectionType ?? ""] ?? d.collectionType ?? "—"}</dd></div>
            <div><dt>Type</dt><dd>{d.type ?? "—"}</dd></div>
            <div><dt>Ouverture</dt><dd>{fmt(d.startDate)}</dd></div>
            <div><dt>Échéance</dt><dd>{fmt(d.deadline)}</dd></div>
            <div><dt>Prorogation</dt><dd>{d.extendedDeadline ? fmt(d.extendedDeadline) : "—"}</dd></div>
            <div><dt>Clôturée le</dt><dd>{d.closedAt ? fmt(d.closedAt) : "—"}</dd></div>
            <div><dt>Créée par</dt><dd>{creator}</dd></div>
            <div><dt>Régions ciblées</dt><dd>{list(d.targetRegions)}</dd></div>
            <div><dt>Départements ciblés</dt><dd>{list(d.targetDepartments)}</dd></div>
            <div><dt>Types d&apos;établissement</dt><dd>{list(d.targetEntityTypes, (t) => entityTypeLabel(t) || t)}</dd></div>
            <div><dt>Établissements ciblés</dt><dd>{typeof campaign.progress?.total === "number" ? campaign.progress.total.toLocaleString("fr-FR") : "—"}</dd></div>
          </dl>
          {d.description && <p style={{ margin: 0 }}>{d.description}</p>}
          <div>
            <h3 className="cam-admin-label" style={{ margin: "0 0 var(--cam-space-2)" }}>Rappels envoyés (10 derniers)</h3>
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
        </>
      )}
    </AdminDialog>
  );
}

// ── Création de campagne (POST /campaigns) ─────────────────────────────────

function CreateCampaignDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (msg: string) => void;
}) {
  const [collectionType, setCollectionType] = useState<"DSMO" | "ONEFOP">("DSMO");
  const [type, setType] = useState<"QUARTERLY" | "ANNUAL" | "SPECIAL">("QUARTERLY");

  const todayStr = new Date().toISOString().split("T")[0];
  const defaultDeadline = new Date(Date.now() + 90 * 86_400_000).toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(todayStr);
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [description, setDescription] = useState("");
  const [autoReminders, setAutoReminders] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createCampaign({
        collectionType,
        type,
        startDate: new Date(startDate).toISOString(),
        deadline: new Date(deadline).toISOString(),
        description: description.trim() || undefined,
        autoReminders,
      }),
    onSuccess: () => {
      onCreated("Campagne créée et activée avec succès.");
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !deadline) {
      setError("Veuillez renseigner les dates de début et d'échéance.");
      return;
    }
    if (new Date(deadline) <= new Date(startDate)) {
      setError("La date limite doit être postérieure à la date de début.");
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      eyebrow="Nouvelle collecte"
      title="Lancer une campagne de recensement"
      footer={
        <>
          <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </button>
          <button
            type="button"
            className="cam-button cam-button-primary cam-button-sm"
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Création en cours…" : "Lancer la campagne"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
        {error && (
          <div role="alert" className="cam-admin-notice cam-admin-notice--error" style={{ marginBottom: "var(--cam-space-2)" }}>
            <span>{error}</span>
          </div>
        )}

        <div className="cam-field">
          <label className="cam-admin-label" htmlFor="cam-col-type">Module de collecte</label>
          <select
            id="cam-col-type"
            className="cam-select"
            value={collectionType}
            onChange={(e) => setCollectionType(e.target.value as "DSMO" | "ONEFOP")}
          >
            <option value="DSMO">Déclaration sur la situation de la main d&apos;œuvre (DSMO)</option>
            <option value="ONEFOP">Questionnaire ONEFOP (Emplois créés)</option>
          </select>
        </div>

        <div className="cam-field">
          <label className="cam-admin-label" htmlFor="cam-freq-type">Périodicité</label>
          <select
            id="cam-freq-type"
            className="cam-select"
            value={type}
            onChange={(e) => setType(e.target.value as "QUARTERLY" | "ANNUAL" | "SPECIAL")}
          >
            <option value="QUARTERLY">Trimestrielle</option>
            <option value="ANNUAL">Annuelle</option>
            <option value="SPECIAL">Spéciale / Ponctuelle</option>
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--cam-space-3)" }}>
          <div className="cam-field">
            <label className="cam-admin-label" htmlFor="cam-start-date">Date de début</label>
            <input
              id="cam-start-date"
              type="date"
              className="cam-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="cam-field">
            <label className="cam-admin-label" htmlFor="cam-deadline">Date limite (Échéance)</label>
            <input
              id="cam-deadline"
              type="date"
              className="cam-input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="cam-field">
          <label className="cam-admin-label" htmlFor="cam-desc">Description ou instructions (optionnel)</label>
          <textarea
            id="cam-desc"
            className="cam-textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Instructions particulières communiquées aux établissements déclarant…"
          />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", cursor: "pointer", fontSize: "13px", marginTop: "var(--cam-space-1)" }}>
          <input
            type="checkbox"
            checked={autoReminders}
            onChange={(e) => setAutoReminders(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span>Activer les rappels automatiques (relances envoyées à J-7, J-3 et J-1 de l&apos;échéance)</span>
        </label>
      </form>
    </AdminDialog>
  );
}

