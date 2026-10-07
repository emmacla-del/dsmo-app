"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataState } from "@/components/admin/DataState";
import { resolveDataState } from "@/lib/admin-data-state";
import { useTerritoryDepartments, useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { formatApiError } from "@/lib/pilotage-targets";
import { asUiLocale } from "@/lib/register-i18n";
import {
  GENERIC_POSITION_TYPE,
  canGrantAdminOnefop,
  createStaffInvitation,
  getOrganigramme,
  getServicePositions,
  invitationLevelsFor,
  invitationMessage,
  invitationUrl,
  levelNeedsDepartment,
  levelNeedsRegion,
  servicesForLevel,
  territoryPhrase,
  whatsappHref,
  type InvitationLevel,
  type StaffInvitation,
} from "@/lib/staff-invitations";

// Invite an agent by link (src/lib/staff-invitations.ts).
//
// The administrator places the agent in the MINEFOP organigramme -- level,
// service, post -- and, for a delegation, its territory. The role is not
// asked for: the server takes it from the service. The result is a link to
// send over WhatsApp; the agent sets their own password, so no temporary
// password ever travels.
//
// Levels follow the server's rule: both administrator roles reach every
// level, and a central post gives a read-only CENTRAL_AGENT. Making the
// invitee an ADMIN_ONEFOP instead is an explicit, SUPER_ADMIN-only box.

const EMPTY = {
  level: "" as InvitationLevel | "",
  serviceCode: "",
  positionType: "",
  region: "",
  department: "",
  email: "",
  grantAdminOnefop: false,
};

// Visual indentation of a sub-service in a native <select>, which cannot be
// styled per option: two no-break spaces per organigramme level.
const INDENT = "  ";

export function InviteAgentDialog({
  open,
  onClose,
  actorRole,
}: {
  open: boolean;
  onClose: () => void;
  actorRole: string | null | undefined;
}) {
  const tRoot = useTranslations();
  const t = useTranslations("adminStaffInvitation");
  const locale = asUiLocale(useLocale());
  const levels = invitationLevelsFor(actorRole);
  const [form, setForm] = useState({ ...EMPTY, level: levels.length === 1 ? levels[0] : EMPTY.level });
  const [phone, setPhone] = useState("");
  const [created, setCreated] = useState<StaffInvitation | null>(null);
  const [copied, setCopied] = useState(false);

  const treeQuery = useQuery({ queryKey: ["minefop-services", "tree"], queryFn: getOrganigramme, enabled: open });
  const positionsQuery = useQuery({
    queryKey: ["minefop-services", form.serviceCode, "positions"],
    queryFn: () => getServicePositions(form.serviceCode),
    enabled: open && !!form.serviceCode,
  });
  const { regions } = useTerritoryRegions();
  const { departments } = useTerritoryDepartments(form.region);

  const level = form.level || null;
  const services = level && treeQuery.data ? servicesForLevel(treeQuery.data, level, locale) : [];
  const needsRegion = level ? levelNeedsRegion(level) : false;
  const needsDepartment = level ? levelNeedsDepartment(level) : false;
  const canGrant = canGrantAdminOnefop(actorRole, level);
  // The organigramme is the one thing the form cannot work without: until it
  // is here, the service list says why it is not (loading, failed, empty).
  const treeState = resolveDataState({
    isLoading: treeQuery.isLoading,
    isError: treeQuery.isError,
    error: treeQuery.error,
    rowCount: treeQuery.data ? services.length : null,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createStaffInvitation({
        email: form.email.trim(),
        serviceCode: form.serviceCode,
        positionType: form.positionType,
        region: needsRegion ? form.region : undefined,
        department: needsDepartment ? form.department : undefined,
        grantAdminOnefop: canGrant && form.grantAdminOnefop ? true : undefined,
      }),
    onSuccess: (res) => setCreated(res),
  });

  // Changing a choice clears what depended on it: a new level empties the
  // service, a new service the post, a new region the department.
  const set = (key: Exclude<keyof typeof EMPTY, "grantAdminOnefop">) => (value: string) =>
    setForm((f) => ({
      ...f,
      [key]: value,
      ...(key === "level" ? { serviceCode: "", positionType: "", department: "", grantAdminOnefop: false } : {}),
      ...(key === "serviceCode" ? { positionType: "" } : {}),
      ...(key === "region" ? { department: "" } : {}),
    }));

  const complete =
    !!level &&
    !!form.serviceCode &&
    !!form.positionType &&
    (!needsRegion || !!form.region) &&
    (!needsDepartment || !!form.department) &&
    form.email.trim().includes("@");

  const close = () => {
    setForm({ ...EMPTY, level: levels.length === 1 ? levels[0] : EMPTY.level });
    setPhone("");
    setCreated(null);
    setCopied(false);
    mutation.reset();
    onClose();
  };

  const link = created && typeof window !== "undefined" ? invitationUrl(window.location.origin, created.token) : "";
  const message = created ? invitationMessage(created, link, locale) : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard is unavailable over plain HTTP and in some locked-down
      // browsers; the link stays selectable in its field.
      setCopied(false);
    }
  }

  const levelLabel = (l: InvitationLevel) => t(`level.${l}`);

  return (
    <AdminDialog
      open={open}
      onClose={close}
      title={t("title")}
      eyebrow={t("eyebrow")}
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
              <div>
                {t("createdBody", {
                  email: created.email,
                  expires: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date(created.expiresAt)),
                })}
              </div>
            </div>
          </div>

          <dl className="cam-admin-kv">
            <div>
              <dt>{t("postLabel")}</dt>
              <dd>{created.positionTitle}</dd>
            </div>
            <div>
              <dt>{t("serviceLabel")}</dt>
              <dd>{created.serviceName}</dd>
            </div>
            {created.region && (
              <div>
                <dt>{t("territoryLabel")}</dt>
                <dd>{territoryPhrase(created.region, created.department)}</dd>
              </div>
            )}
          </dl>

          <dl className="cam-admin-kv">
            <div>
              <dt>{t("accessLabel")}</dt>
              <dd>{t(`access.${created.role}`)}</dd>
            </div>
          </dl>

          <div className="cam-field">
            <label className="cam-admin-label" htmlFor="invite-link">{t("linkLabel")}</label>
            <input id="invite-link" className="cam-input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          </div>
          <div style={{ display: "flex", gap: "var(--cam-space-3)", alignItems: "center", marginBottom: "var(--cam-space-4)" }}>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={copyLink}>
              {t("copy")}
            </button>
            <span className="cam-admin-meta" aria-live="polite">{copied ? t("copied") : ""}</span>
          </div>

          <div className="cam-field">
            <label className="cam-admin-label" htmlFor="invite-phone">{t("phoneLabel")}</label>
            <input
              id="invite-phone"
              type="tel"
              className="cam-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("phonePlaceholder")}
            />
            <p className="cam-admin-meta">{t("phoneHint")}</p>
          </div>
          <a
            className="cam-button cam-button-primary"
            href={whatsappHref(message, phone)}
            target="_blank"
            rel="noopener noreferrer"
          >
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

          <fieldset style={{ border: "none", margin: "0 0 var(--cam-space-4)", padding: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
            <legend className="cam-admin-label" style={{ padding: 0, marginBottom: "var(--cam-space-1)" }}>{t("levelLegend")}</legend>
            {levels.map((l) => (
              <label key={l} className="cam-admin-choice">
                <input type="radio" name="invite-level" value={l} checked={form.level === l} onChange={() => set("level")(l)} />
                <span>
                  {levelLabel(l)}
                  <span className="cam-admin-choice-hint">{t(`levelHint.${l}`)}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {level && (
            <>
              <DataState
                state={treeState}
                resource={t("organigrammeResource")}
                error={treeQuery.error}
                onRetry={() => treeQuery.refetch()}
                dense
              />
              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="invite-service">{t("serviceLabel")}</label>
                <select
                  id="invite-service"
                  className="cam-select"
                  value={form.serviceCode}
                  onChange={(e) => set("serviceCode")(e.target.value)}
                  disabled={treeState !== "ready"}
                  required
                >
                  <option value="" disabled>{t("selectService")}</option>
                  {services.map((s) => (
                    <option key={s.code} value={s.code}>{INDENT.repeat(s.depth * 2) + s.label}</option>
                  ))}
                </select>
              </div>

              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="invite-position">{t("postLabel")}</label>
                <select
                  id="invite-position"
                  className="cam-select"
                  value={form.positionType}
                  onChange={(e) => set("positionType")(e.target.value)}
                  disabled={!form.serviceCode || positionsQuery.isLoading}
                  required
                >
                  <option value="" disabled>
                    {!form.serviceCode ? t("selectServiceFirst") : positionsQuery.isLoading ? t("loading") : t("selectPost")}
                  </option>
                  {(positionsQuery.data ?? []).map((p) => (
                    <option key={p.id} value={p.positionType}>{locale === "en" && p.titleEn ? p.titleEn : p.title}</option>
                  ))}
                  {form.serviceCode && <option value={GENERIC_POSITION_TYPE}>{t("genericPost")}</option>}
                </select>
              </div>

              {needsRegion && (
                <div style={{ display: "grid", gridTemplateColumns: needsDepartment ? "1fr 1fr" : "1fr", gap: "0 var(--cam-space-3)" }}>
                  <div className="cam-field">
                    <label className="cam-admin-label" htmlFor="invite-region">{t("regionLabel")}</label>
                    <select id="invite-region" className="cam-select" value={form.region} onChange={(e) => set("region")(e.target.value)} required>
                      <option value="" disabled>{t("selectRegion")}</option>
                      {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  {needsDepartment && (
                    <div className="cam-field">
                      <label className="cam-admin-label" htmlFor="invite-department">{t("departmentLabel")}</label>
                      <select
                        id="invite-department"
                        className="cam-select"
                        value={form.department}
                        onChange={(e) => set("department")(e.target.value)}
                        disabled={!form.region}
                        required
                      >
                        <option value="" disabled>{form.region ? t("selectDepartment") : t("selectRegionFirst")}</option>
                        {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {canGrant && (
                <label className="cam-admin-choice" style={{ marginBottom: "var(--cam-space-4)" }}>
                  <input
                    type="checkbox"
                    checked={form.grantAdminOnefop}
                    onChange={(e) => setForm((f) => ({ ...f, grantAdminOnefop: e.target.checked }))}
                  />
                  <span>
                    {t("grantAdmin")}
                    <span className="cam-admin-choice-hint">{t("grantAdminHint")}</span>
                  </span>
                </label>
              )}

              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="invite-email">{t("emailLabel")}</label>
                <input
                  id="invite-email"
                  type="email"
                  className="cam-input"
                  value={form.email}
                  onChange={(e) => set("email")(e.target.value)}
                  required
                />
                <p className="cam-admin-meta">{t("emailHint")}</p>
              </div>
            </>
          )}
        </form>
      )}
    </AdminDialog>
  );
}
