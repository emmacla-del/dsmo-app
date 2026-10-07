"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import {
  TERRITORIAL_ROLES,
  createMinefopUser,
  directoryRoleLabel,
  listUsers,
  updateUserTerritory,
  type DirectoryUser,
} from "@/lib/user-directory";
import { useTerritoryDepartments, useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataStateRow } from "@/components/admin/DataState";
import { NOT_PROVIDED, count, elapsedSince, resolveDataState, stamp } from "@/lib/admin-data-state";
import { USER_ADMIN_ROLES, hasRole } from "@/lib/roles";
import { registrationMethodLabel, registrationMethodTone } from "@/lib/inscriptions";

const AGENTS_PAGE_SIZE = 50;

// The field roles listed on this screen are TERRITORIAL_ROLES (@/lib/roles,
// re-exported by @/lib/user-directory) — the roles whose authorised scope is
// a ressort rather than the whole country.
//
// They must be values of the Prisma `UserRole` enum: GET /auth/users rejects
// any unknown role with 400 "Rôle inconnu". The screen previously asked for
// "INVESTIGATOR", which is not in the enum, so every request failed and the
// table could only ever render its sample dataset. Taking the set from
// @/lib/roles instead of a local copy keeps that class of drift out.
//
// ADMIN_ONEFOP is deliberately outside the group: it is no longer a field
// role, and it sits outside ONEFOP_STAFF_ROLES so no actor here may manage
// it (src/auth/staff-scope.ts).

/**
 * One agent row.
 *
 * Mapped from a GET /auth/users record, whose select is:
 * id, email, firstName, lastName, role, status, isActive, region, department,
 * matricule, serviceCode, createdAt, lastLoginAt, submissionsCount (AuthService.listUsers).
 */
interface AgentItem {
  id: string;
  initials: string;
  name: string;
  email: string;
  role: string;
  region: string | null;
  department: string | null;
  matricule: string | null;
  isActive: boolean;
  status: string;
  createdAt: string | null;
  lastLoginAt: string | null;
  submissionsCount: number | null;
  // Phase 2 attribution. createdByName is resolved server-side; null on an
  // account that self-registered or that predates the tracking.
  registrationMethod: string | null;
  createdByName: string | null;
}

/** The registration-method badge, or a dash for an account that predates tracking. */
function MethodBadge({ method }: { method: string | null }) {
  const label = registrationMethodLabel(method, asUiLocale(useLocale()));
  if (!label) return <span style={{ color: "#9ca3af" }}>{NOT_PROVIDED}</span>;
  const tone = registrationMethodTone(method);
  return (
    <span style={{ fontSize: 11, background: tone.bg, color: tone.color, padding: "3px 9px", borderRadius: 9999, fontWeight: 600, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

/** Initials from the parts of the name the record actually carries. */
function initialsOf(first: string, last: string): string {
  const a = first.trim()[0] ?? "";
  const b = last.trim()[0] ?? first.trim()[1] ?? "";
  return (a + b).toUpperCase() || "—";
}

export default function OnefopUsersPage() {
  const { isLoading, forbidden } = useAdminScreenGuard(USER_ADMIN_ROLES);
  const tRoot = useTranslations();
  const t = useTranslations("adminUtilisateursPage");
  const locale = asUiLocale(useLocale());
  const enabled = !isLoading && !forbidden;
  const [createOpen, setCreateOpen] = useState(false);
  const [profileAgent, setProfileAgent] = useState<AgentItem | null>(null);
  const [reassignAgent, setReassignAgent] = useState<AgentItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /**
   * Agent list.
   *
   * Source: GET /auth/users?roles=REGIONAL_ADMIN,DIVISIONAL_ADMIN
   * (AuthService.listUsers). `total` counts the whole filtered query; the
   * roles the caller may see are additionally capped server-side by
   * manageableRolesFor(actorRole), so an ADMIN_ONEFOP sees ONEFOP staff
   * only. COMPANY accounts are never returned by this endpoint.
   */
  const agentsQuery = useQuery({
    queryKey: ["auth", "users", "onefop-agents"],
    enabled,
    queryFn: () => listUsers({ roles: TERRITORIAL_ROLES, page: 1, pageSize: AGENTS_PAGE_SIZE }),
  });

  /**
   * Headcount tiles.
   *
   * Each is the server-reported `total` of its own filtered query, not a count
   * of rows on a page: `isActive=true` and `isActive=false` over the same role
   * set. `pageSize: 1` because only the total is needed.
   */
  const activeCountQuery = useQuery({
    queryKey: ["auth", "users", "onefop-agents", "active"],
    enabled,
    queryFn: () => listUsers({ roles: TERRITORIAL_ROLES, isActive: true, page: 1, pageSize: 1 }),
  });

  const inactiveCountQuery = useQuery({
    queryKey: ["auth", "users", "onefop-agents", "inactive"],
    enabled,
    queryFn: () => listUsers({ roles: TERRITORIAL_ROLES, isActive: false, page: 1, pageSize: 1 }),
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const newThisMonthQuery = useQuery({
    queryKey: ["auth", "users", "onefop-agents", "new-this-month", startOfMonth],
    enabled,
    queryFn: () => listUsers({ roles: TERRITORIAL_ROLES, fromCreatedAt: startOfMonth, page: 1, pageSize: 1 }),
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page" style={{ padding: "32px" }}>
        <h1 className="cam-admin-h1">{t("forbiddenTitle")}</h1>
        <p className="cam-admin-lede">{t("forbiddenBody")}</p>
      </div>
    );
  }

  /**
   * Real accounts only, mapped field for field. A record with no region or
   * department keeps `null`: the territory is an authorization-sensitive fact,
   * and the previous version defaulted a missing region to "Centre".
   */
  const agents: AgentItem[] = (agentsQuery.data?.users ?? []).map((u: DirectoryUser) => {
    const first = u.firstName?.trim() || u.email.split("@")[0];
    const last = u.lastName?.trim() || "";
    return {
      id: u.id,
      initials: initialsOf(first, last),
      name: `${first} ${last}`.trim(),
      email: u.email,
      role: u.role,
      region: u.region ?? null,
      department: u.department ?? null,
      matricule: u.matricule ?? null,
      isActive: u.isActive,
      status: u.status,
      createdAt: u.createdAt ?? null,
      lastLoginAt: u.lastLoginAt ? String(u.lastLoginAt) : null,
      submissionsCount: typeof u.submissionsCount === "number" ? u.submissionsCount : null,
      registrationMethod: u.registrationMethod ?? null,
      createdByName: u.createdByName ?? null,
    };
  });

  const tableState = resolveDataState({
    isLoading: agentsQuery.isLoading,
    isError: agentsQuery.isError,
    error: agentsQuery.error,
    rowCount: agentsQuery.data?.users.length ?? null,
  });

  return (
    <div className="cam-admin-page" style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px 32px" }}>
      {/* Top Header matching Figma declarants/utilisateurs.png */}
      <AdminPageHeader
        breadcrumb={[{ label: tRoot("adminNav.hubs.administration") }, { label: tRoot("adminNav.routes.utilisateurs") }]}
        title={tRoot("adminNav.routes.utilisateurs")}
        subtitle={t("subtitle")}
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 20px",
              background: "#164e32",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> {t("addOfficer")}
          </button>
        }
      />

      {toastMessage && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "12px 18px", borderRadius: 8, marginBottom: 20, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{toastMessage}</span>
          <button type="button" aria-label={t("closeAriaLabel")} onClick={() => setToastMessage(null)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#065f46" }}>×</button>
        </div>
      )}

      {/* Headcount. The two figures with a source are the server-reported
          totals of the active and inactive role-filtered queries. "Nouvelles
          inscriptions (mois)" has none: /auth/users accepts no createdAt range
          filter, so a monthly figure cannot be computed server-side and a
          count over one page would not be a monthly total. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280" }}>
            {t("kpiActive")}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginTop: 8, lineHeight: 1 }}>
            {activeCountQuery.isLoading ? "…" : count(activeCountQuery.data?.total ?? null, locale)}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500, marginTop: 8 }}>
            {t("kpiActiveHint")}
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280" }}>
            {t("kpiInactive")}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginTop: 8, lineHeight: 1 }}>
            {inactiveCountQuery.isLoading ? "…" : count(inactiveCountQuery.data?.total ?? null, locale)}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8, fontWeight: 500 }}>
            {t("kpiInactiveHint")}
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280" }}>
            {t("kpiNew")}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginTop: 8, lineHeight: 1 }}>
            {newThisMonthQuery.isLoading ? "…" : count(newThisMonthQuery.data?.total ?? null, locale)}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8, fontWeight: 500 }}>
            {t("kpiNewHint")}
          </div>
        </div>
      </div>

      {/* Agent table.
          Columns are sourced directly from GET /auth/users (AuthService.listUsers),
          including authoritative lastLoginAt and submissionsCount relations. */}
      <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #e5e7eb", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
            {t("tableTitle")}
          </h2>
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            {tableState === "ready"
              ? t("shownOf", { shown: count(agents.length, locale), total: count(agentsQuery.data?.total ?? null, locale) })
              : NOT_PROVIDED}
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontSize: 12, color: "#6b7280" }}>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>{t("nameColumn")}</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>{t("roleColumn")}</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>{t("territoryColumn")}</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>{t("staffNumberColumn")}</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>{t("formsColumn")}</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>{t("lastSignInColumn")}</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>{t("createdColumn")}</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>{t("registeredByColumn")}</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>{t("statusColumn")}</th>
                <th scope="col" style={{ padding: "14px 18px", textAlign: "right", fontWeight: 600 }}>{t("actionsColumn")}</th>
              </tr>
            </thead>
            <tbody>
              <DataStateRow
                colSpan={10}
                state={tableState}
                resource={t("resource")}
                error={agentsQuery.error}
                onRetry={() => agentsQuery.refetch()}
                title={tableState === "empty" ? t("emptyTitle") : undefined}
                hint={tableState === "empty" ? t("emptyHint") : undefined}
              />
              {agents.map((agent) => (
                <tr key={agent.id} style={{ borderBottom: "1px solid #f3f4f6", fontSize: 13, height: 60 }}>
                  <td style={{ padding: "12px 18px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "#004d3d",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {agent.initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#111827" }}>{agent.name}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{agent.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Role label from the stored role value. */}
                  <td style={{ padding: "12px 18px", color: "#4b5563", whiteSpace: "nowrap" }}>
                    {directoryRoleLabel(agent.role, locale)}
                  </td>

                  {/* Territory exactly as stored. An account whose role is
                      territorial but whose territory is unset is reported as
                      unassigned — the backend fails that scope closed. */}
                  <td style={{ padding: "12px 18px", color: "#4b5563" }}>
                    {agent.region ?? (hasRole(agent.role, TERRITORIAL_ROLES) ? t("noTerritory") : NOT_PROVIDED)}
                    {agent.department && (
                      <span style={{ display: "block", fontSize: 11, color: "#6b7280" }}>{agent.department}</span>
                    )}
                  </td>

                  <td style={{ padding: "12px 18px", color: "#4b5563", fontFamily: "ui-monospace, monospace" }}>
                    {agent.matricule ?? NOT_PROVIDED}
                  </td>

                  <td style={{ padding: "12px 18px", color: "#111827", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {count(agent.submissionsCount, locale)}
                  </td>

                  <td style={{ padding: "12px 18px", color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>
                    {agent.lastLoginAt ? elapsedSince(agent.lastLoginAt, locale) : NOT_PROVIDED}
                  </td>

                  <td style={{ padding: "12px 18px", color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>
                    {stamp(agent.createdAt, false, locale)}
                  </td>

                  {/* Who minted the account and how. An account created by an
                      admin names that admin; one that self-registered carries
                      the method badge alone. */}
                  <td style={{ padding: "12px 18px", color: "#4b5563", fontSize: 12 }}>
                    {agent.createdByName && (
                      <div style={{ marginBottom: 3 }}>{agent.createdByName}</div>
                    )}
                    <MethodBadge method={agent.registrationMethod} />
                  </td>

                  <td style={{ padding: "12px 18px", whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        fontSize: 11,
                        background: agent.isActive ? "#064e3b" : "#6b7280",
                        color: "#ffffff",
                        padding: "4px 12px",
                        borderRadius: 9999,
                        fontWeight: 600,
                      }}
                    >
                      {agent.isActive ? t("active") : t("inactive")}
                    </span>
                    {/* Registration state as stored, when it is not simply
                        ACTIVE — e.g. PENDING_APPROVAL, REJECTED. */}
                    {agent.status && agent.status !== "ACTIVE" && (
                      <span style={{ display: "block", fontSize: 11, color: "#6b7280", marginTop: 3 }}>
                        {ACCOUNT_STATUS_CODES.has(agent.status) ? t(`accountStatus.${agent.status}`) : agent.status}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: "12px 18px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      onClick={() => setProfileAgent(agent)}
                      style={{ background: "none", border: "none", color: "#004d3d", fontWeight: 600, fontSize: 13, cursor: "pointer", padding: "2px 6px" }}
                    >
                      {t("profile")}
                    </button>
                    <span style={{ color: "#d1d5db", margin: "0 6px" }}>|</span>
                    <button
                      type="button"
                      onClick={() => setReassignAgent(agent)}
                      style={{ background: "none", border: "none", color: "#004d3d", fontWeight: 600, fontSize: 13, cursor: "pointer", padding: "2px 6px" }}
                    >
                      {t("reassign")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ajouter Agent Dialog */}
      <CreateAgentDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => showToast(t("officerCreated"))} />

      {/* Profil Agent Dialog */}
      {profileAgent && (
        <AdminDialog
          open={!!profileAgent}
          onClose={() => setProfileAgent(null)}
          title={t("profileTitle", { name: profileAgent.name })}
          eyebrow={`${directoryRoleLabel(profileAgent.role, locale)}${profileAgent.region ? ` • ${profileAgent.region}` : ""}`}
          footer={
            <button
              type="button"
              className="cam-button cam-button-secondary"
              onClick={() => setProfileAgent(null)}
            >
              {t("close")}
            </button>
          }
        >
          <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{t("emailLabel")}</div>
              <div style={{ fontWeight: 600, color: "#111827", marginTop: 2 }}>{profileAgent.email}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{t("roleLabel")}</div>
              <div style={{ color: "#111827", marginTop: 2 }}>{directoryRoleLabel(profileAgent.role, locale)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{t("territoryLabel")}</div>
              <div style={{ color: "#111827", marginTop: 2 }}>
                {profileAgent.region ?? (hasRole(profileAgent.role, TERRITORIAL_ROLES) ? t("noTerritory") : NOT_PROVIDED)}
                {profileAgent.department ? ` (${profileAgent.department})` : ""}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{t("staffNumberLabel")}</div>
              <div style={{ color: "#111827", marginTop: 2 }}>{profileAgent.matricule ?? NOT_PROVIDED}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{t("createdLabel")}</div>
              <div style={{ color: "#111827", marginTop: 2 }}>{stamp(profileAgent.createdAt, false, locale)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{t("formsLabel")}</div>
              <div style={{ color: "#111827", marginTop: 2, fontWeight: 600 }}>{count(profileAgent.submissionsCount, locale)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{t("lastSignInLabel")}</div>
              <div style={{ color: "#111827", marginTop: 2 }}>{profileAgent.lastLoginAt ? stamp(profileAgent.lastLoginAt, true, locale) : NOT_PROVIDED}</div>
            </div>
          </div>
        </AdminDialog>
      )}

      {/* Réassigner Dialog */}
      {reassignAgent && (
        <ReassignDialog
          agent={reassignAgent}
          onClose={() => setReassignAgent(null)}
          onSuccess={() => {
            setReassignAgent(null);
            showToast(t("territoryReassigned", { name: reassignAgent.name }));
          }}
        />
      )}
    </div>
  );
}

// Registration states (other than ACTIVE) with a label under
// adminUtilisateursPage.accountStatus; any other value shows as stored.
const ACCOUNT_STATUS_CODES = new Set(["PENDING_APPROVAL", "REJECTED", "COMPLEMENTS_REQUESTED"]);

// ── Ajouter Agent Dialog ────────────────────────────────────────────────────────
// No default region: the server requires one for a regional officer, and a
// preselected « Littoral » turned a careless submit into a Littoral account.
//
// The two roles the server creates directly (AuthService.MINEFOP_FIELD_ROLES);
// assertCanManageRole and resolveStaffTerritory enforce who may create them
// and their territory. A regional officer covers the whole region — the
// server stores no department for one — so the department is asked only for
// a departmental officer, where it is required.
const OFFICER_ROLES = ["REGIONAL_ADMIN", "DIVISIONAL_ADMIN"] as const;
const EMPTY_FORM = { firstName: "", lastName: "", email: "", role: "REGIONAL_ADMIN", region: "", department: "", matricule: "", poste: "" };

function CreateAgentDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const queryClient = useQueryClient();
  const tRoot = useTranslations();
  const t = useTranslations("adminUtilisateursPage");
  const locale = asUiLocale(useLocale());
  const [form, setForm] = useState(EMPTY_FORM);
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createMinefopUser({
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        role: form.role,
        region: form.region || undefined,
        department: form.role === "DIVISIONAL_ADMIN" ? form.department || undefined : undefined,
        matricule: form.matricule.trim() || undefined,
        poste: form.poste.trim() || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["auth", "users"] });
      setCreated({ email: res.user.email, temporaryPassword: res.temporaryPassword });
      onCreated();
    },
  });

  const close = () => {
    setForm(EMPTY_FORM);
    setCreated(null);
    mutation.reset();
    onClose();
  };

  const set = (key: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value, ...(key === "region" || key === "role" ? { department: "" } : {}) }));

  const { regions } = useTerritoryRegions();
  const { departments } = useTerritoryDepartments(form.region);
  const isDivisional = form.role === "DIVISIONAL_ADMIN";
  const territoryComplete = !!form.region && (!isDivisional || !!form.department);

  return (
    <AdminDialog
      open={open}
      onClose={close}
      title={t("createTitle")}
      eyebrow={t("createEyebrow")}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, width: "100%" }}>
          <button type="button" className="cam-button cam-button-secondary" onClick={close}>
            {created ? t("close") : tRoot("common.cancel")}
          </button>
          {!created && (
            <button
              type="button"
              className="cam-button cam-button-primary"
              disabled={mutation.isPending || !form.email || !form.firstName || !form.lastName || !territoryComplete}
              onClick={() => mutation.mutate()}
              style={{ background: "#004d3d" }}
            >
              {mutation.isPending ? t("creating") : t("createOfficer")}
            </button>
          )}
        </div>
      }
    >
      {created ? (
        <div style={{ fontSize: 13, background: "#ecfdf5", border: "1px solid #a7f3d0", padding: 16, borderRadius: 8 }}>
          <div style={{ fontWeight: 700, color: "#065f46", fontSize: 14 }}>{t("createdTitle")}</div>
          <div style={{ marginTop: 8, color: "#065f46" }}>{t("createdEmail")} <strong>{created.email}</strong></div>
          <div style={{ marginTop: 4, color: "#065f46" }}>{t("temporaryPassword")} <code style={{ background: "#d1fae5", padding: "2px 6px", borderRadius: 4 }}>{created.temporaryPassword}</code></div>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>{t("firstName")}</label>
              <input type="text" className="cam-input" value={form.firstName} onChange={(e) => set("firstName")(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>{t("lastName")}</label>
              <input type="text" className="cam-input" value={form.lastName} onChange={(e) => set("lastName")(e.target.value)} required />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>{t("officialEmail")}</label>
            <input type="email" className="cam-input" value={form.email} onChange={(e) => set("email")(e.target.value)} required />
          </div>
          <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <legend style={{ padding: 0, fontSize: "var(--cam-font-size-3xs)", fontWeight: 700, color: "var(--cam-text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{t("officerRole")}</legend>
            {OFFICER_ROLES.map((role) => (
              <label key={role} className="cam-admin-choice">
                <input
                  type="radio"
                  name="officer-role"
                  value={role}
                  checked={form.role === role}
                  onChange={() => set("role")(role)}
                />
                <span>
                  {directoryRoleLabel(role, locale)}
                  <span className="cam-admin-choice-hint">
                    {t(role === "REGIONAL_ADMIN" ? "roleRegionalHint" : "roleDivisionalHint")}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div style={{ display: "grid", gridTemplateColumns: isDivisional ? "1fr 1fr" : "1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>{t("region")}</label>
              <select className="cam-input" value={form.region} onChange={(e) => set("region")(e.target.value)} required>
                <option value="" disabled>{t("selectRegion")}</option>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {isDivisional && (
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>{t("department")}</label>
                <select
                  className="cam-input"
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
        </form>
      )}
    </AdminDialog>
  );
}

// ── Réassigner Dialog ──────────────────────────────────────────────────────────
function ReassignDialog({ agent, onClose, onSuccess }: { agent: AgentItem; onClose: () => void; onSuccess: () => void }) {
  // Starts from the account's stored territory. An unassigned account starts
  // empty rather than pre-selecting a region the record does not hold.
  const tRoot = useTranslations();
  const t = useTranslations("adminUtilisateursPage");
  const [region, setRegion] = useState(agent.region ?? "");
  const [department, setDepartment] = useState(agent.department ?? "");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    // The account keeps its own role: this dialog reassigns a territory, and
    // writing "REGIONAL_ADMIN" would silently re-role a DIVISIONAL_ADMIN agent.
    mutationFn: () =>
      updateUserTerritory(agent.id, {
        role: agent.role,
        region: region || undefined,
        department: department || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "users"] });
      onSuccess();
    },
  });

  const { regions } = useTerritoryRegions();
  const { departments } = useTerritoryDepartments(region);

  return (
    <AdminDialog
      open={true}
      onClose={onClose}
      title={t("reassignTitle", { name: agent.name })}
      eyebrow={t("reassignEyebrow")}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, width: "100%" }}>
          <button type="button" className="cam-button cam-button-secondary" onClick={onClose}>{tRoot("common.cancel")}</button>
          <button
            type="button"
            className="cam-button cam-button-primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={{ background: "#004d3d" }}
          >
            {mutation.isPending ? t("saving") : t("confirmAssignment")}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>{t("assignedRegion")}</label>
          <select className="cam-input" value={region} onChange={(e) => { setRegion(e.target.value); setDepartment(""); }}>
            <option value="">{t("noRegionAssigned")}</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>{t("department")}</label>
          <select className="cam-input" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">{t("allRegionDepartments")}</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
    </AdminDialog>
  );
}
