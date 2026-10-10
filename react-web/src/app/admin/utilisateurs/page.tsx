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
import { GroupInvitationLinks } from "@/components/admin/GroupInvitationLinks";
import { InviteAgentDialog } from "@/components/admin/InviteAgentDialog";
import { PendingStaffRequests } from "@/components/admin/PendingStaffRequests";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import { NOT_PROVIDED, count, elapsedSince, resolveDataState, stamp } from "@/lib/admin-data-state";
import { READ_ONLY_ROLES, USER_ADMIN_ROLES, hasRole } from "@/lib/roles";
import { registrationMethodBadgeClass, registrationMethodLabel } from "@/lib/inscriptions";

const AGENTS_PAGE_SIZE = 50;

// The staff this screen lists: territorial officers and the read-only
// central agents, i.e. the roles an ADMIN_ONEFOP manages (backend
// ONEFOP_STAFF_ROLES, AUDITOR aside). ADMIN_ONEFOP itself stays off the list.
const LISTED_STAFF_ROLES = [...TERRITORIAL_ROLES, ...READ_ONLY_ROLES];

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
  if (!label) return <span className="cam-admin-muted">{NOT_PROVIDED}</span>;
  return <span className={`cam-badge ${registrationMethodBadgeClass(method)}`}>{label}</span>;
}

export default function OnefopUsersPage() {
  const { isLoading, forbidden, user } = useAdminScreenGuard(USER_ADMIN_ROLES);
  const tRoot = useTranslations();
  const t = useTranslations("adminUtilisateursPage");
  const locale = asUiLocale(useLocale());
  const enabled = !isLoading && !forbidden;
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
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
    queryFn: () => listUsers({ roles: LISTED_STAFF_ROLES, page: 1, pageSize: AGENTS_PAGE_SIZE }),
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
    queryFn: () => listUsers({ roles: LISTED_STAFF_ROLES, isActive: true, page: 1, pageSize: 1 }),
  });

  const inactiveCountQuery = useQuery({
    queryKey: ["auth", "users", "onefop-agents", "inactive"],
    enabled,
    queryFn: () => listUsers({ roles: LISTED_STAFF_ROLES, isActive: false, page: 1, pageSize: 1 }),
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const newThisMonthQuery = useQuery({
    queryKey: ["auth", "users", "onefop-agents", "new-this-month", startOfMonth],
    enabled,
    queryFn: () => listUsers({ roles: LISTED_STAFF_ROLES, fromCreatedAt: startOfMonth, page: 1, pageSize: 1 }),
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const header = (
    <AdminPageHeader
      breadcrumb={[{ label: tRoot("adminNav.hubs.administration") }, { label: tRoot("adminNav.routes.utilisateurs") }]}
      title={tRoot("adminNav.routes.utilisateurs")}
      subtitle={t("subtitle")}
      actions={
        <div style={{ display: "flex", gap: "var(--cam-space-2)", alignItems: "center" }}>
          <AdminHeaderActions />
          {/* Inviting is the primary way in: the agent sets their own
              password. Direct creation, which hands the admin a temporary
              password to pass on, stays as the secondary path. */}
          {enabled && (
            <button
              type="button"
              className="cam-button cam-button-secondary cam-button-sm"
              onClick={() => setCreateOpen(true)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: "var(--cam-space-1)" }}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t("addOfficer")}
            </button>
          )}
          {enabled && (
            <button
              type="button"
              className="cam-button cam-button-primary cam-button-sm"
              onClick={() => setInviteOpen(true)}
            >
              {tRoot("adminStaffInvitation.openButton")}
            </button>
          )}
        </div>
      }
    />
  );

  // The screen guard's two non-ready outcomes keep the page chrome and say
  // what is happening. Neither renders nothing (G10).
  if (isLoading || forbidden) {
    return (
      <div className="cam-admin-page">
        {header}
        <DataState
          state={isLoading ? "loading" : "forbidden"}
          resource={t("resource")}
          title={forbidden ? t("forbiddenTitle") : undefined}
          hint={forbidden ? t("forbiddenBody") : undefined}
        />
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

  // Headcount. Each figure is the server-reported total of its own
  // role-filtered query; "new this month" filters on createdAt server-side.
  const headcount = [
    { key: "active", label: t("kpiActive"), query: activeCountQuery, hint: t("kpiActiveHint") },
    { key: "inactive", label: t("kpiInactive"), query: inactiveCountQuery, hint: t("kpiInactiveHint") },
    { key: "new", label: t("kpiNew"), query: newThisMonthQuery, hint: t("kpiNewHint") },
  ];

  return (
    <div className="cam-admin-page">
      {header}

      {toastMessage && (
        <div role="status" className="cam-admin-notice cam-admin-notice--success">
          <span>{toastMessage}</span>
          <button type="button" className="cam-admin-notice-close" aria-label={t("closeAriaLabel")} onClick={() => setToastMessage(null)}>×</button>
        </div>
      )}

      {/* Three tiles, so the four-column .cam-pilot-kpis grid is widened to
          auto-fit rather than leaving an empty fourth column. */}
      <div className="cam-pilot-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {headcount.map((k) => (
          <div key={k.key} className="cam-pilot-kpi">
            <span className="cam-pilot-kpi-label">{k.label}</span>
            <span className="cam-pilot-kpi-value" aria-busy={k.query.isLoading || undefined}>
              {k.query.isLoading ? NOT_PROVIDED : count(k.query.data?.total ?? null, locale)}
            </span>
            <span className="cam-pilot-kpi-trend">{k.hint}</span>
          </div>
        ))}
      </div>

      {/* Agent table.
          Columns are sourced directly from GET /auth/users (AuthService.listUsers),
          including authoritative lastLoginAt and submissionsCount relations. */}
      <section className="cam-admin-section" aria-labelledby="agents-table-title">
        <div className="cam-admin-section-head">
          <h2 id="agents-table-title" className="cam-admin-h2">{t("tableTitle")}</h2>
          <span className="cam-admin-meta">
            {tableState === "ready"
              ? t("shownOf", { shown: count(agents.length, locale), total: count(agentsQuery.data?.total ?? null, locale) })
              : NOT_PROVIDED}
          </span>
        </div>
        <div className="cam-table-wrapper">
          <table className="cam-table">
            <thead>
              <tr>
                <th scope="col">{t("nameColumn")}</th>
                <th scope="col">{t("roleColumn")}</th>
                <th scope="col">{t("territoryColumn")}</th>
                <th scope="col">{t("staffNumberColumn")}</th>
                <th scope="col" className="text-right">{t("formsColumn")}</th>
                <th scope="col">{t("lastSignInColumn")}</th>
                <th scope="col">{t("createdColumn")}</th>
                <th scope="col">{t("registeredByColumn")}</th>
                <th scope="col">{t("statusColumn")}</th>
                <th scope="col" className="text-right">{t("actionsColumn")}</th>
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
                <tr key={agent.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className="cam-admin-strong" style={{ display: "block" }}>{agent.name}</span>
                    <span className="cam-admin-meta">{agent.email}</span>
                  </td>

                  {/* Role label from the stored role value. */}
                  <td style={{ whiteSpace: "nowrap" }}>{directoryRoleLabel(agent.role, locale)}</td>

                  {/* Territory exactly as stored. An account whose role is
                      territorial but whose territory is unset is reported as
                      unassigned — the backend fails that scope closed. */}
                  <td>
                    {agent.region ?? (hasRole(agent.role, TERRITORIAL_ROLES) ? t("noTerritory") : NOT_PROVIDED)}
                    {agent.department && (
                      <span className="cam-admin-meta" style={{ display: "block" }}>{agent.department}</span>
                    )}
                  </td>

                  <td>
                    <span className="cam-admin-code">{agent.matricule ?? NOT_PROVIDED}</span>
                  </td>

                  <td className="text-right">
                    <span className="cam-admin-strong">{count(agent.submissionsCount, locale)}</span>
                  </td>

                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className="cam-admin-meta">
                      {agent.lastLoginAt ? elapsedSince(agent.lastLoginAt, locale) : NOT_PROVIDED}
                    </span>
                  </td>

                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className="cam-admin-meta">{stamp(agent.createdAt, false, locale)}</span>
                  </td>

                  {/* Who minted the account and how. An account created by an
                      admin names that admin; one that self-registered carries
                      the method badge alone. */}
                  <td>
                    {agent.createdByName && (
                      <span className="cam-admin-meta" style={{ display: "block" }}>{agent.createdByName}</span>
                    )}
                    <MethodBadge method={agent.registrationMethod} />
                  </td>

                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className={`cam-badge ${agent.isActive ? "cam-badge-success" : "cam-badge-neutral"}`}>
                      {agent.isActive ? t("active") : t("inactive")}
                    </span>
                    {/* Registration state as stored, when it is not simply
                        ACTIVE — e.g. PENDING_APPROVAL, REJECTED. */}
                    {agent.status && agent.status !== "ACTIVE" && (
                      <span className="cam-admin-meta" style={{ display: "block" }}>
                        {ACCOUNT_STATUS_CODES.has(agent.status) ? t(`accountStatus.${agent.status}`) : agent.status}
                      </span>
                    )}
                  </td>

                  <td className="text-right">
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--cam-space-3)", whiteSpace: "nowrap" }}>
                      <button type="button" className="cam-text-button" onClick={() => setProfileAgent(agent)}>
                        {t("profile")}
                      </button>
                      <button type="button" className="cam-text-button" onClick={() => setReassignAgent(agent)}>
                        {t("reassign")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Accounts requested through a group link wait here for approval;
          the links themselves are managed in the section below. */}
      <PendingStaffRequests roles={LISTED_STAFF_ROLES} />
      <GroupInvitationLinks />

      <InviteAgentDialog open={inviteOpen} onClose={() => setInviteOpen(false)} actorRole={user?.role} />

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
          <dl className="cam-admin-kv">
            <div>
              <dt>{t("emailLabel")}</dt>
              <dd>{profileAgent.email}</dd>
            </div>
            <div>
              <dt>{t("roleLabel")}</dt>
              <dd>{directoryRoleLabel(profileAgent.role, locale)}</dd>
            </div>
            <div>
              <dt>{t("territoryLabel")}</dt>
              <dd>
                {profileAgent.region ?? (hasRole(profileAgent.role, TERRITORIAL_ROLES) ? t("noTerritory") : NOT_PROVIDED)}
                {profileAgent.department ? ` (${profileAgent.department})` : ""}
              </dd>
            </div>
            <div>
              <dt>{t("staffNumberLabel")}</dt>
              <dd>{profileAgent.matricule ?? NOT_PROVIDED}</dd>
            </div>
            <div>
              <dt>{t("createdLabel")}</dt>
              <dd>{stamp(profileAgent.createdAt, false, locale)}</dd>
            </div>
            <div>
              <dt>{t("formsLabel")}</dt>
              <dd>{count(profileAgent.submissionsCount, locale)}</dd>
            </div>
            <div>
              <dt>{t("lastSignInLabel")}</dt>
              <dd>{profileAgent.lastLoginAt ? stamp(profileAgent.lastLoginAt, true, locale) : NOT_PROVIDED}</dd>
            </div>
          </dl>
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
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--cam-space-3)", width: "100%" }}>
          <button type="button" className="cam-button cam-button-secondary" onClick={close}>
            {created ? t("close") : tRoot("common.cancel")}
          </button>
          {!created && (
            <button
              type="button"
              className="cam-button cam-button-primary"
              disabled={mutation.isPending || !form.email || !form.firstName || !form.lastName || !territoryComplete}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? t("creating") : t("createOfficer")}
            </button>
          )}
        </div>
      }
    >
      {created ? (
        <div role="status" className="cam-admin-notice cam-admin-notice--success">
          <div>
            <strong>{t("createdTitle")}</strong>
            <div>{t("createdEmail")} <strong>{created.email}</strong></div>
            <div>{t("temporaryPassword")} <code className="cam-admin-code">{created.temporaryPassword}</code></div>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 var(--cam-space-3)" }}>
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="officer-first-name">{t("firstName")}</label>
              <input id="officer-first-name" type="text" className="cam-input" value={form.firstName} onChange={(e) => set("firstName")(e.target.value)} required />
            </div>
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="officer-last-name">{t("lastName")}</label>
              <input id="officer-last-name" type="text" className="cam-input" value={form.lastName} onChange={(e) => set("lastName")(e.target.value)} required />
            </div>
          </div>
          <div className="cam-field">
            <label className="cam-admin-label" htmlFor="officer-email">{t("officialEmail")}</label>
            <input id="officer-email" type="email" className="cam-input" value={form.email} onChange={(e) => set("email")(e.target.value)} required />
          </div>
          <fieldset style={{ border: "none", margin: "0 0 var(--cam-space-4)", padding: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
            <legend className="cam-admin-label" style={{ padding: 0, marginBottom: "var(--cam-space-1)" }}>{t("officerRole")}</legend>
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
          <div style={{ display: "grid", gridTemplateColumns: isDivisional ? "1fr 1fr" : "1fr", gap: "0 var(--cam-space-3)" }}>
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="officer-region">{t("region")}</label>
              <select id="officer-region" className="cam-select" value={form.region} onChange={(e) => set("region")(e.target.value)} required>
                <option value="" disabled>{t("selectRegion")}</option>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {isDivisional && (
              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="officer-department">{t("department")}</label>
                <select
                  id="officer-department"
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
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--cam-space-3)", width: "100%" }}>
          <button type="button" className="cam-button cam-button-secondary" onClick={onClose}>{tRoot("common.cancel")}</button>
          <button
            type="button"
            className="cam-button cam-button-primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? t("saving") : t("confirmAssignment")}
          </button>
        </div>
      }
    >
      <div className="cam-field">
        <label className="cam-admin-label" htmlFor="reassign-region">{t("assignedRegion")}</label>
        <select id="reassign-region" className="cam-select" value={region} onChange={(e) => { setRegion(e.target.value); setDepartment(""); }}>
          <option value="">{t("noRegionAssigned")}</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="cam-field">
        <label className="cam-admin-label" htmlFor="reassign-department">{t("department")}</label>
        <select id="reassign-department" className="cam-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">{t("allRegionDepartments")}</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
    </AdminDialog>
  );
}
