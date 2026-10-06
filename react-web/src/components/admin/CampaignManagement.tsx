"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_PURPOSE_LABELS,
  REGISTRATION_STATUS_LABEL,
  REMINDER_TYPES,
  isRegistrationCampaign,
  type Campaign,
  activateCampaign,
  canActivate,
  canClose,
  canDeactivate,
  canExtend,
  canRemind,
  closeCampaign,
  deleteCampaign,
  extendCampaignDeadline,
  formatCampaignDate,
  listCampaigns,
  pauseCampaign,
  sendCampaignReminder,
} from "@/lib/campaigns";

type Modal =
  | { type: "extend"; campaign: Campaign }
  | { type: "remind"; campaign: Campaign }
  | { type: "delete"; campaign: Campaign }
  | { type: "not-migrated"; label: string };

const chipStyle = (active: boolean, color: string): React.CSSProperties => ({
  padding: "var(--cam-space-1) var(--cam-space-3)",
  borderRadius: 20,
  fontSize: "var(--cam-font-size-sm)",
  fontWeight: 500,
  cursor: "pointer",
  border: `1px solid ${active ? color : "var(--cam-border)"}`,
  background: active ? color : "var(--cam-surface)",
  color: active ? "#fff" : "var(--cam-text-muted)",
  whiteSpace: "nowrap",
});

const actionBtnStyle: React.CSSProperties = {
  border: "1px solid var(--cam-border-strong)",
  borderRadius: "var(--cam-radius-sm)",
  background: "var(--cam-surface)",
  padding: "2px 8px",
  fontSize: "var(--cam-font-size-sm)",
  cursor: "pointer",
};

/**
 * Campaign lifecycle management — the real production control surface for
 * the whole declaration system's availability (activateCampaign opens the
 * exact SubmissionRound this app's own ONEFOP submission flow checks
 * elsewhere; see campaigns.ts's header comment). This slice covers the
 * list, status filter, and lifecycle actions (activate/pause/close/
 * extend/remind/delete) on EXISTING campaigns — faithfully ported from
 * campaign_management_screen.dart.
 *
 * Deliberately deferred to a follow-up slice, each shown as an honest
 * "not yet migrated" note rather than built shallow: "Nouvelle campagne"
 * (a complex form with a region/department cascade selector and a
 * conflict-check-before-create flow), "Modifier" (EditCampaignDialog,
 * defined inside the 1054-line campaign_detail_screen.dart), and clicking
 * a campaign to view its detail/compliance stats (also that same file).
 */
export function CampaignManagement() {
  const t = useTranslations();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["campaigns", statusFilter],
    queryFn: () => listCampaigns(statusFilter ?? undefined),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["campaigns"] });
  const [busyId, setBusyId] = useState<string | null>(null);

  const activateMutation = useMutation({
    mutationFn: (id: string) => activateCampaign(id),
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: invalidate,
  });
  const pauseMutation = useMutation({
    mutationFn: (id: string) => pauseCampaign(id),
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: invalidate,
  });
  const closeMutation = useMutation({
    mutationFn: (id: string) => closeCampaign(id),
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: invalidate,
  });
  const extendMutation = useMutation({
    mutationFn: ({ id, newDeadline }: { id: string; newDeadline: string }) => extendCampaignDeadline(id, newDeadline),
    onSuccess: () => { invalidate(); setModal(null); },
  });
  const remindMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) => sendCampaignReminder(id, type),
    onSuccess: () => setModal(null),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onSuccess: () => { invalidate(); setModal(null); },
  });

  useEffect(() => {
    if (modal) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [modal]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--cam-space-3)" }}>
        <div style={{ display: "flex", gap: "var(--cam-space-2)", flexWrap: "wrap" }}>
          <span onClick={() => setStatusFilter(null)} style={chipStyle(statusFilter === null, "var(--cam-green)")}>{t("campaignManagement.statusAll")}</span>
          {CAMPAIGN_STATUSES.map((s) => (
            <span key={s} onClick={() => setStatusFilter(s)} style={chipStyle(statusFilter === s, CAMPAIGN_STATUS_COLORS[s])}>
              {CAMPAIGN_STATUS_LABELS[s]}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setModal({ type: "not-migrated", label: t("campaignManagement.newCampaignTitle") })}
          style={{ height: "var(--cam-form-field-height)", padding: "0 var(--cam-space-4)", border: "none", color: "#fff", background: "var(--cam-green)", borderRadius: "var(--cam-radius-sm)", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {t("campaignManagement.newCampaignButton")}
        </button>
      </div>

      {query.isLoading && <p>{t("common.loading")}</p>}
      {query.isError && <div role="alert" style={{ color: "var(--cam-error)" }}>{t("campaignManagement.loadError", { error: (query.error as Error).message })}</div>}
      {query.data && query.data.length === 0 && <p style={{ color: "var(--cam-text-muted)" }}>{t("campaignManagement.emptyState")}</p>}

      {query.data?.map((c) => {
        const busy = busyId === c.id;
        // Registration campaigns are target containers (DRAFT for life): no
        // lifecycle action applies, the backend refuses them all.
        const registration = isRegistrationCampaign(c);
        return (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--cam-space-3)", border: "var(--cam-border-width) solid var(--cam-border)", borderRadius: "var(--cam-radius-md)", padding: "var(--cam-space-3)", marginBottom: "var(--cam-space-2)", background: "var(--cam-surface)", flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)" }}>{c.code}</div>
              <button
                type="button"
                onClick={() => setModal({ type: "not-migrated", label: t("campaignManagement.campaignDetailTitle") })}
                style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontWeight: 600, textAlign: "left", color: "var(--cam-text)" }}
              >
                {c.name}
              </button>
              {registration && (
                <span className="cam-badge cam-badge-info" style={{ marginLeft: "var(--cam-space-2)" }}>
                  {CAMPAIGN_PURPOSE_LABELS.REGISTRATION}
                </span>
              )}
              <div style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)" }}>
                {t("campaignManagement.deadlineLabel", { date: formatCampaignDate(c.extendedDeadline || c.deadline) })}
              </div>
              {registration ? (
                <span className="cam-badge cam-badge-neutral" style={{ marginTop: "var(--cam-space-1)" }}>
                  {REGISTRATION_STATUS_LABEL}
                </span>
              ) : (
                <span style={{ display: "inline-block", marginTop: "var(--cam-space-1)", padding: "2px 10px", borderRadius: 20, fontSize: "var(--cam-font-size-sm)", fontWeight: 600, background: `${CAMPAIGN_STATUS_COLORS[c.status] ?? "var(--cam-text-muted)"}1A`, color: CAMPAIGN_STATUS_COLORS[c.status] ?? "var(--cam-text-muted)" }}>
                  {CAMPAIGN_STATUS_LABELS[c.status] ?? c.status}
                </span>
              )}
            </div>

            {busy ? (
              <span style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)" }}>…</span>
            ) : (
              <div style={{ display: "flex", gap: "var(--cam-space-2)", flexWrap: "wrap" }}>
                {!registration && canActivate(c.status) && (
                  <button type="button" style={{ ...actionBtnStyle, color: "var(--cam-success)" }} onClick={() => activateMutation.mutate(c.id)}>
                    {t("campaignManagement.activate")}
                  </button>
                )}
                {!registration && canDeactivate(c.status) && (
                  <button type="button" style={{ ...actionBtnStyle, color: "var(--cam-warning)" }} onClick={() => pauseMutation.mutate(c.id)}>
                    {t("campaignManagement.pause")}
                  </button>
                )}
                <button type="button" style={actionBtnStyle} onClick={() => setModal({ type: "not-migrated", label: t("campaignManagement.editCampaignTitle") })}>
                  {t("campaignManagement.edit")}
                </button>
                {!registration && canClose(c.status) && (
                  <button type="button" style={actionBtnStyle} onClick={() => closeMutation.mutate(c.id)}>
                    {t("campaignManagement.close")}
                  </button>
                )}
                {!registration && canExtend(c.status) && (
                  <button type="button" style={actionBtnStyle} onClick={() => setModal({ type: "extend", campaign: c })}>
                    {t("campaignManagement.extend")}
                  </button>
                )}
                {!registration && canRemind(c.status) && (
                  <button type="button" style={actionBtnStyle} onClick={() => setModal({ type: "remind", campaign: c })}>
                    {t("campaignManagement.remind")}
                  </button>
                )}
                <button type="button" style={{ ...actionBtnStyle, color: "var(--cam-error)" }} onClick={() => setModal({ type: "delete", campaign: c })}>
                  {t("campaignManagement.delete")}
                </button>
              </div>
            )}
          </div>
        );
      })}

      <dialog
        ref={dialogRef}
        onClose={() => setModal(null)}
        style={{ border: "var(--cam-border-width) solid var(--cam-border)", borderRadius: "var(--cam-radius-md)", padding: 0, maxWidth: 440, width: "90vw" }}
      >
        {modal?.type === "not-migrated" && (
          <div style={{ padding: "var(--cam-space-5)" }}>
            <h2 style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: 700, margin: "0 0 var(--cam-space-3)" }}>{modal.label}</h2>
            <p style={{ color: "var(--cam-text-muted)" }}>
              {t("campaignManagement.notMigratedBody")}
            </p>
            <button type="button" onClick={() => setModal(null)} style={{ marginTop: "var(--cam-space-3)", width: "100%", height: "var(--cam-form-field-height)", border: "1px solid var(--cam-border-strong)", background: "none", borderRadius: "var(--cam-radius-sm)", cursor: "pointer" }}>
              {t("campaignManagement.closeModalButton")}
            </button>
          </div>
        )}

        {modal?.type === "extend" && (
          <ExtendModal
            campaign={modal.campaign}
            pending={extendMutation.isPending}
            error={extendMutation.error as Error | null}
            onCancel={() => setModal(null)}
            onConfirm={(newDeadline) => extendMutation.mutate({ id: modal.campaign.id, newDeadline })}
          />
        )}

        {modal?.type === "remind" && (
          <RemindModal
            campaign={modal.campaign}
            pending={remindMutation.isPending}
            error={remindMutation.error as Error | null}
            onCancel={() => setModal(null)}
            onConfirm={(type) => remindMutation.mutate({ id: modal.campaign.id, type })}
          />
        )}

        {modal?.type === "delete" && (
          <div style={{ padding: "var(--cam-space-5)" }}>
            <h2 style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: 700, margin: "0 0 var(--cam-space-2)" }}>
              {t("campaignManagement.deleteCampaignTitle")}
            </h2>
            <p style={{ color: "var(--cam-text-muted)" }}>{modal.campaign.name}</p>
            <div style={{ display: "flex", gap: "var(--cam-space-3)", marginTop: "var(--cam-space-4)" }}>
              <button type="button" onClick={() => setModal(null)} style={{ flex: 1, height: "var(--cam-form-field-height)", border: "1px solid var(--cam-border-strong)", background: "none", borderRadius: "var(--cam-radius-sm)", cursor: "pointer" }}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(modal.campaign.id)}
                style={{ flex: 1, height: "var(--cam-form-field-height)", border: "none", color: "#fff", background: "var(--cam-error)", borderRadius: "var(--cam-radius-sm)", cursor: "pointer" }}
              >
                {deleteMutation.isPending ? "…" : t("campaignManagement.delete")}
              </button>
            </div>
            {deleteMutation.isError && <p role="alert" style={{ color: "var(--cam-error)", marginTop: "var(--cam-space-3)" }}>{t("campaignManagement.actionError", { error: (deleteMutation.error as Error).message })}</p>}
          </div>
        )}
      </dialog>
    </div>
  );
}

function ExtendModal({ campaign, pending, error, onCancel, onConfirm }: { campaign: Campaign; pending: boolean; error: Error | null; onCancel: () => void; onConfirm: (newDeadline: string) => void }) {
  const t = useTranslations();
  const [date, setDate] = useState("");
  return (
    <div style={{ padding: "var(--cam-space-5)" }}>
      <h2 style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: 700, margin: "0 0 var(--cam-space-1)" }}>{t("campaignManagement.extendTitle")}</h2>
      <p style={{ color: "var(--cam-text-muted)", fontSize: "var(--cam-font-size-sm)", margin: "0 0 var(--cam-space-3)" }}>{campaign.name}</p>
      <label style={{ display: "block", fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
        {t("campaignManagement.newDeadlineLabel")}
      </label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{ width: "100%", height: "var(--cam-form-field-height)", border: "1px solid var(--cam-border-strong)", borderRadius: "var(--cam-radius-sm)", padding: "0 var(--cam-space-3)" }}
      />
      <div style={{ display: "flex", gap: "var(--cam-space-3)", marginTop: "var(--cam-space-4)" }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, height: "var(--cam-form-field-height)", border: "1px solid var(--cam-border-strong)", background: "none", borderRadius: "var(--cam-radius-sm)", cursor: "pointer" }}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          disabled={!date || pending}
          onClick={() => onConfirm(new Date(date).toISOString())}
          style={{ flex: 1, height: "var(--cam-form-field-height)", border: "none", color: "#fff", background: date ? "var(--cam-green)" : "var(--cam-border-strong)", borderRadius: "var(--cam-radius-sm)", cursor: date ? "pointer" : "not-allowed" }}
        >
          {pending ? "…" : t("campaignManagement.confirm")}
        </button>
      </div>
      {error && <p role="alert" style={{ color: "var(--cam-error)", marginTop: "var(--cam-space-3)" }}>{t("campaignManagement.actionError", { error: error.message })}</p>}
    </div>
  );
}

function RemindModal({ campaign, pending, error, onCancel, onConfirm }: { campaign: Campaign; pending: boolean; error: Error | null; onCancel: () => void; onConfirm: (type: string) => void }) {
  const t = useTranslations();
  const [type, setType] = useState(REMINDER_TYPES[0].value);
  return (
    <div style={{ padding: "var(--cam-space-5)" }}>
      <h2 style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: 700, margin: "0 0 var(--cam-space-1)" }}>{t("campaignManagement.remindTitle")}</h2>
      <p style={{ color: "var(--cam-text-muted)", fontSize: "var(--cam-font-size-sm)", margin: "0 0 var(--cam-space-3)" }}>{campaign.name}</p>
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        style={{ width: "100%", height: "var(--cam-form-field-height)", border: "1px solid var(--cam-border-strong)", borderRadius: "var(--cam-radius-sm)", padding: "0 var(--cam-space-3)" }}
      >
        {REMINDER_TYPES.map((rt) => (
          <option key={rt.value} value={rt.value}>{rt.label}</option>
        ))}
      </select>
      <div style={{ display: "flex", gap: "var(--cam-space-3)", marginTop: "var(--cam-space-4)" }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, height: "var(--cam-form-field-height)", border: "1px solid var(--cam-border-strong)", background: "none", borderRadius: "var(--cam-radius-sm)", cursor: "pointer" }}>
          {t("common.cancel")}
        </button>
        <button type="button" disabled={pending} onClick={() => onConfirm(type)} style={{ flex: 1, height: "var(--cam-form-field-height)", border: "none", color: "#fff", background: "var(--cam-green)", borderRadius: "var(--cam-radius-sm)", cursor: "pointer" }}>
          {pending ? "…" : t("campaignManagement.send")}
        </button>
      </div>
      {error && <p role="alert" style={{ color: "var(--cam-error)", marginTop: "var(--cam-space-3)" }}>{t("campaignManagement.actionError", { error: error.message })}</p>}
    </div>
  );
}
