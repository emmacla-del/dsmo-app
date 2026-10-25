"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import { useTerritoryDepartments, useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { NOT_PROVIDED, resolveDataState, stamp } from "@/lib/admin-data-state";
import { formatApiError } from "@/lib/pilotage-targets";
import { asUiLocale } from "@/lib/register-i18n";
import {
  GROUP_LINK_DEFAULT_DAYS,
  GROUP_LINK_DEFAULT_USES,
  GROUP_LINK_MAX_DAYS,
  GROUP_LINK_MAX_USES,
  INVITATION_LEVELS,
  LEVEL_ROLE,
  createGroupLink,
  getAllServicePositions,
  getOrganigramme,
  getPositionTypesForRole,
  groupLinkMessage,
  groupLinkUrl,
  levelNeedsDepartment,
  levelNeedsRegion,
  listGroupLinks,
  positionTypesForLevel,
  revokeGroupLink,
  servicesOfferingPosition,
  territoryPhrase,
  whatsappHref,
  type GroupLink,
  type GroupLinkState,
  type InvitationLevel,
} from "@/lib/staff-invitations";

// Group invitation links (src/lib/staff-invitations.ts): one link for a
// group of staff, posted in a WhatsApp group. The administrator fixes the
// post the link is for -- everyone who opens it holds it, typically the
// "Cadre" of one unit -- and each account waits for approval in "Demandes en
// attente" on this page.
//
// The post is chosen the way the MINEFOP wizard asked for it: the POST
// first, then the unit, among the units that offer that post. Picking the
// unit first means reading a 126-service tree to find out which posts it
// has.
//
// The link itself is shown once, right after creation: the server keeps
// only a hash of it. Revoking stops it at once.

const STATE_BADGE: Record<GroupLinkState, string> = {
  active: "cam-badge-success",
  full: "cam-badge-warning",
  expired: "cam-badge-neutral",
  revoked: "cam-badge-neutral",
};

const EMPTY = {
  label: "",
  level: "" as InvitationLevel | "",
  region: "",
  department: "",
  positionType: "",
  serviceCode: "",
  days: String(GROUP_LINK_DEFAULT_DAYS),
  uses: String(GROUP_LINK_DEFAULT_USES),
};

const INDENT = "  ";

export function GroupInvitationLinks() {
  const t = useTranslations("adminGroupLinks");
  const locale = asUiLocale(useLocale());
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [revoking, setRevoking] = useState<GroupLink | null>(null);

  const linksQuery = useQuery({ queryKey: ["staff-invitation-links"], queryFn: listGroupLinks });
  const state = resolveDataState({
    isLoading: linksQuery.isLoading,
    isError: linksQuery.isError,
    error: linksQuery.error,
    rowCount: linksQuery.data?.length ?? null,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeGroupLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-invitation-links"] });
      setRevoking(null);
    },
  });

  return (
    <section className="cam-admin-section" aria-labelledby="group-links-title">
      <div className="cam-admin-section-head">
        <h2 id="group-links-title" className="cam-admin-h2">{t("title")}</h2>
        <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setCreateOpen(true)}>
          {t("createButton")}
        </button>
      </div>
      <p className="cam-admin-meta">{t("intro")}</p>

      <div className="cam-table-wrapper">
        <table className="cam-table">
          <thead>
            <tr>
              <th scope="col">{t("nameColumn")}</th>
              <th scope="col">{t("scopeColumn")}</th>
              <th scope="col" className="is-num">{t("usesColumn")}</th>
              <th scope="col">{t("expiresColumn")}</th>
              <th scope="col">{t("stateColumn")}</th>
              <th scope="col" className="text-right">{t("actionsColumn")}</th>
            </tr>
          </thead>
          <tbody>
            <DataStateRow
              colSpan={6}
              state={state}
              resource={t("resource")}
              error={linksQuery.error}
              onRetry={() => linksQuery.refetch()}
              title={state === "empty" ? t("emptyTitle") : undefined}
              hint={state === "empty" ? t("emptyHint") : undefined}
            />
            {(linksQuery.data ?? []).map((l) => (
              <tr key={l.id}>
                <td>
                  <span className="cam-admin-strong" style={{ display: "block" }}>{l.label}</span>
                  {l.createdByName && <span className="cam-admin-meta">{t("createdBy", { name: l.createdByName })}</span>}
                </td>
                <td>
                  {l.positionTitle && l.serviceName ? (
                    <>
                      <span className="cam-admin-strong" style={{ display: "block" }}>{l.positionTitle}</span>
                      <span className="cam-admin-meta" style={{ display: "block" }}>{l.serviceName}</span>
                    </>
                  ) : (
                    <span style={{ display: "block" }}>{t(`level.${l.level}`)}</span>
                  )}
                  {territoryPhrase(l.region, l.department) && (
                    <span className="cam-admin-meta" style={{ display: "block" }}>{territoryPhrase(l.region, l.department)}</span>
                  )}
                </td>
                <td className="is-num">{l.useCount} / {l.maxUses}</td>
                <td style={{ whiteSpace: "nowrap" }}><span className="cam-admin-meta">{stamp(l.expiresAt, false, locale)}</span></td>
                <td><span className={`cam-badge ${STATE_BADGE[l.state]}`}>{t(`state.${l.state}`)}</span></td>
                <td className="text-right">
                  {l.state === "active" || l.state === "full" ? (
                    <button type="button" className="cam-text-button" onClick={() => setRevoking(l)}>{t("revoke")}</button>
                  ) : (
                    <span className="cam-admin-muted">{NOT_PROVIDED}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateGroupLinkDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["staff-invitation-links"] })}
      />

      {revoking && (
        <AdminDialog
          open
          onClose={() => { setRevoking(null); revokeMutation.reset(); }}
          title={t("revokeTitle", { name: revoking.label })}
          eyebrow={t("title")}
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--cam-space-3)", width: "100%" }}>
              <button type="button" className="cam-button cam-button-secondary" onClick={() => setRevoking(null)}>{t("cancel")}</button>
              <button
                type="button"
                className="cam-button cam-button-danger"
                disabled={revokeMutation.isPending}
                onClick={() => revokeMutation.mutate(revoking.id)}
              >
                {t("revokeConfirm")}
              </button>
            </div>
          }
        >
          {revokeMutation.isError && (
            <div role="alert" className="cam-admin-notice cam-admin-notice--error">
              <span>{formatApiError(revokeMutation.error, locale)}</span>
            </div>
          )}
          <p>{t("revokeBody", { used: revoking.useCount })}</p>
        </AdminDialog>
      )}
    </section>
  );
}

function CreateGroupLinkDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const t = useTranslations("adminGroupLinks");
  const tRoot = useTranslations();
  const locale = asUiLocale(useLocale());
  const [form, setForm] = useState(EMPTY);
  const [created, setCreated] = useState<(GroupLink & { token: string }) | null>(null);
  const [copied, setCopied] = useState(false);
  const { regions } = useTerritoryRegions();
  const { departments } = useTerritoryDepartments(form.region);

  const level = form.level || null;
  const needsRegion = level ? levelNeedsRegion(level) : false;
  const needsDepartment = level ? levelNeedsDepartment(level) : false;

  // The organigramme, and every post in it, once the dialog is open. The
  // post types come from the server so they carry its own generic labels.
  const treeQuery = useQuery({ queryKey: ["minefop-services", "tree"], queryFn: getOrganigramme, enabled: open });
  const postsQuery = useQuery({ queryKey: ["minefop-services", "positions"], queryFn: getAllServicePositions, enabled: open });
  const typeLabelsQuery = useQuery({
    queryKey: ["minefop-services", "position-types", level],
    queryFn: () => getPositionTypesForRole(LEVEL_ROLE[level as InvitationLevel]),
    enabled: open && !!level,
  });

  const posts = postsQuery.data ?? [];
  // The organigramme is the one thing the post fields cannot work without:
  // until both calls are in, the dropdowns say why they are empty.
  const positionTypes =
    level && treeQuery.data ? positionTypesForLevel(treeQuery.data, level, posts, typeLabelsQuery.data ?? [], locale) : [];
  const services =
    level && form.positionType && treeQuery.data
      ? servicesOfferingPosition(treeQuery.data, level, posts, form.positionType, locale)
      : [];
  const organigrammeLoading = treeQuery.isLoading || postsQuery.isLoading;
  const organigrammeState = resolveDataState({
    isLoading: organigrammeLoading,
    isError: treeQuery.isError || postsQuery.isError,
    error: treeQuery.error ?? postsQuery.error,
    rowCount: treeQuery.data && postsQuery.data ? positionTypes.length : null,
  });

  const days = Number(form.days);
  const uses = Number(form.uses);
  const complete =
    !!form.label.trim() &&
    !!level &&
    (!needsRegion || !!form.region) &&
    (!needsDepartment || !!form.department) &&
    !!form.positionType &&
    !!form.serviceCode &&
    Number.isInteger(days) && days >= 1 && days <= GROUP_LINK_MAX_DAYS &&
    Number.isInteger(uses) && uses >= 1 && uses <= GROUP_LINK_MAX_USES;

  const mutation = useMutation({
    mutationFn: () =>
      createGroupLink({
        label: form.label.trim(),
        level: level as InvitationLevel,
        region: needsRegion ? form.region : undefined,
        department: needsDepartment ? form.department : undefined,
        positionType: form.positionType,
        serviceCode: form.serviceCode,
        expiresInDays: days,
        maxUses: uses,
      }),
    onSuccess: (res) => {
      setCreated(res);
      onCreated();
    },
  });

  // Changing the level or the post type empties what depended on it: the
  // services on offer are not the same, and a stale code would be refused by
  // the server rather than by the form.
  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({
      ...f,
      [key]: value,
      ...(key === "level" ? { department: "", positionType: "", serviceCode: "" } : {}),
      ...(key === "region" ? { department: "" } : {}),
      ...(key === "positionType" ? { serviceCode: "" } : {}),
    }));

  const close = () => {
    setForm(EMPTY);
    setCreated(null);
    setCopied(false);
    mutation.reset();
    onClose();
  };

  const url = created && typeof window !== "undefined" ? groupLinkUrl(window.location.origin, created.token) : "";
  const message = created ? groupLinkMessage(created, url, locale) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <AdminDialog
      open={open}
      onClose={close}
      title={t("createTitle")}
      eyebrow={t("createEyebrow")}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--cam-space-3)", width: "100%" }}>
          <button type="button" className="cam-button cam-button-secondary" onClick={close}>
            {created ? t("close") : tRoot("common.cancel")}
          </button>
          {!created && (
            <button
              type="button"
              className="cam-button cam-button-primary"
              disabled={!complete || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? t("creating") : t("create")}
            </button>
          )}
        </div>
      }
    >
      {created ? (
        <>
          <div role="status" className="cam-admin-notice cam-admin-notice--success">
            <div>
              <strong>{t("createdTitle")}</strong>
              <div>{t("createdBody", { uses: created.maxUses, expires: stamp(created.expiresAt, false, locale) })}</div>
            </div>
          </div>
          <div role="note" className="cam-admin-notice cam-admin-notice--warn">
            <span>{t("showOnce")}</span>
          </div>
          <div className="cam-field">
            <label className="cam-admin-label" htmlFor="group-link">{t("linkLabel")}</label>
            <input id="group-link" className="cam-input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          </div>
          <div style={{ display: "flex", gap: "var(--cam-space-3)", alignItems: "center", marginBottom: "var(--cam-space-4)" }}>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={copy}>{t("copy")}</button>
            <span className="cam-admin-meta" aria-live="polite">{copied ? t("copied") : ""}</span>
          </div>
          <a className="cam-button cam-button-primary" href={whatsappHref(message)} target="_blank" rel="noopener noreferrer">
            {t("sendWhatsapp")}
          </a>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (complete) mutation.mutate(); }}>
          {mutation.isError && (
            <div role="alert" className="cam-admin-notice cam-admin-notice--error">
              <span>{formatApiError(mutation.error, locale)}</span>
            </div>
          )}
          <div className="cam-field">
            <label className="cam-admin-label" htmlFor="group-label">{t("nameLabel")} <span aria-hidden="true">*</span></label>
            <input
              id="group-label"
              className="cam-input"
              value={form.label}
              maxLength={120}
              onChange={(e) => set("label")(e.target.value)}
              placeholder={t("namePlaceholder")}
              required
            />
          </div>

          <fieldset style={{ border: "none", margin: "0 0 var(--cam-space-4)", padding: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
            <legend className="cam-admin-label" style={{ padding: 0, marginBottom: "var(--cam-space-1)" }}>{t("levelLegend")} <span aria-hidden="true">*</span></legend>
            {INVITATION_LEVELS.map((l) => (
              <label key={l} className="cam-admin-choice">
                <input type="radio" name="group-level" value={l} checked={form.level === l} onChange={() => set("level")(l)} />
                <span>
                  {t(`level.${l}`)}
                  <span className="cam-admin-choice-hint">{t(`levelHint.${l}`)}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {level && (
            <>
              <DataState
                state={organigrammeState}
                resource={t("organigrammeResource")}
                error={treeQuery.error ?? postsQuery.error}
                onRetry={() => { treeQuery.refetch(); postsQuery.refetch(); }}
                dense
              />
              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="group-position">{t("postLabel")} <span aria-hidden="true">*</span></label>
                <select
                  id="group-position"
                  className="cam-select"
                  value={form.positionType}
                  onChange={(e) => set("positionType")(e.target.value)}
                  disabled={organigrammeState !== "ready"}
                  required
                >
                  <option value="" disabled hidden>{organigrammeLoading ? t("loading") : t("selectPost")}</option>
                  {positionTypes.map((p) => (
                    <option key={p.positionType} value={p.positionType}>{p.label}</option>
                  ))}
                </select>
                <p className="cam-admin-meta">{t("postHint")}</p>
              </div>

              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="group-service">{t("serviceLabel")} <span aria-hidden="true">*</span></label>
                <select
                  id="group-service"
                  className="cam-select"
                  value={form.serviceCode}
                  onChange={(e) => set("serviceCode")(e.target.value)}
                  disabled={!form.positionType || organigrammeState !== "ready"}
                  required
                >
                  <option value="" disabled hidden>{form.positionType ? t("selectService") : t("selectPostFirst")}</option>
                  {services.map((s) => (
                    <option key={s.code} value={s.code}>{INDENT.repeat(s.depth * 2) + s.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {needsRegion && (
            <div className="cam-admin-form-pair">
              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="group-region">{t("regionLabel")} <span aria-hidden="true">*</span></label>
                <select id="group-region" className="cam-select" value={form.region} onChange={(e) => set("region")(e.target.value)} required>
                  <option value="" disabled hidden>{t("selectRegion")}</option>
                  {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {needsDepartment && (
                <div className="cam-field">
                  <label className="cam-admin-label" htmlFor="group-department">{t("departmentLabel")} <span aria-hidden="true">*</span></label>
                  <select
                    id="group-department"
                    className="cam-select"
                    value={form.department}
                    onChange={(e) => set("department")(e.target.value)}
                    disabled={!form.region}
                    required
                  >
                    <option value="" disabled hidden>{form.region ? t("selectDepartment") : t("selectRegionFirst")}</option>
                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="cam-admin-form-pair">
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="group-days">{t("daysLabel")}</label>
              <input
                id="group-days"
                className="cam-input"
                type="number"
                min={1}
                max={GROUP_LINK_MAX_DAYS}
                value={form.days}
                onChange={(e) => set("days")(e.target.value)}
              />
              <p className="cam-admin-meta">{t("daysHint", { max: GROUP_LINK_MAX_DAYS })}</p>
            </div>
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="group-uses">{t("usesLabel")}</label>
              <input
                id="group-uses"
                className="cam-input"
                type="number"
                min={1}
                max={GROUP_LINK_MAX_USES}
                value={form.uses}
                onChange={(e) => set("uses")(e.target.value)}
              />
              <p className="cam-admin-meta">{t("usesHint", { max: GROUP_LINK_MAX_USES })}</p>
            </div>
          </div>
        </form>
      )}
    </AdminDialog>
  );
}
