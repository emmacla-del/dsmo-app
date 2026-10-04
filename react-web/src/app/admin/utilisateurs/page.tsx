"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const label = registrationMethodLabel(method);
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
        <h1 className="cam-admin-h1">Accès restreint</h1>
        <p className="cam-admin-lede">La gestion des comptes ONEFOP est réservée aux administrateurs ONEFOP.</p>
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
        breadcrumb={[{ label: "Administration" }, { label: "Utilisateurs & rôles" }]}
        title="Utilisateurs & rôles"
        subtitle="Gestion des accès, des rôles et des activités administratives"
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
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Ajouter Agent
          </button>
        }
      />

      {toastMessage && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "12px 18px", borderRadius: 8, marginBottom: 20, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#065f46" }}>×</button>
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
            AGENTS ACTIFS
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginTop: 8, lineHeight: 1 }}>
            {activeCountQuery.isLoading ? "…" : count(activeCountQuery.data?.total ?? null)}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500, marginTop: 8 }}>
            Comptes ONEFOP actifs (central, régional, départemental)
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280" }}>
            AGENTS INACTIFS
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginTop: 8, lineHeight: 1 }}>
            {inactiveCountQuery.isLoading ? "…" : count(inactiveCountQuery.data?.total ?? null)}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8, fontWeight: 500 }}>
            Comptes désactivés ou en attente d&apos;activation
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280" }}>
            NOUVELLES INSCRIPTIONS (MOIS)
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginTop: 8, lineHeight: 1 }}>
            {newThisMonthQuery.isLoading ? "…" : count(newThisMonthQuery.data?.total ?? null)}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8, fontWeight: 500 }}>
            Inscriptions enregistrées depuis le début du mois
          </div>
        </div>
      </div>

      {/* Agent table.
          Columns are sourced directly from GET /auth/users (AuthService.listUsers),
          including authoritative lastLoginAt and submissionsCount relations. */}
      <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #e5e7eb", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
            Agents ONEFOP
          </h2>
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            {tableState === "ready"
              ? `${count(agents.length)} affiché(s) sur ${count(agentsQuery.data?.total ?? null)}`
              : NOT_PROVIDED}
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontSize: 12, color: "#6b7280" }}>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>Nom de l&apos;agent</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>Rôle</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>Ressort assigné</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>Matricule</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>Formulaires collectés</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>Dernière connexion</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>Compte créé le</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>Enregistré par</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>Statut</th>
                <th scope="col" style={{ padding: "14px 18px", textAlign: "right", fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <DataStateRow
                colSpan={10}
                state={tableState}
                resource="les agents ONEFOP"
                error={agentsQuery.error}
                onRetry={() => agentsQuery.refetch()}
                title={tableState === "empty" ? "Aucun agent enregistré" : undefined}
                hint={
                  tableState === "empty"
                    ? "Aucun compte ONEFOP central, régional ou départemental n'est enregistré dans votre périmètre d'administration."
                    : undefined
                }
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
                    {directoryRoleLabel(agent.role)}
                  </td>

                  {/* Territory exactly as stored. An account whose role is
                      territorial but whose territory is unset is reported as
                      unassigned — the backend fails that scope closed. */}
                  <td style={{ padding: "12px 18px", color: "#4b5563" }}>
                    {agent.region ?? (hasRole(agent.role, TERRITORIAL_ROLES) ? "Ressort non affecté" : NOT_PROVIDED)}
                    {agent.department && (
                      <span style={{ display: "block", fontSize: 11, color: "#6b7280" }}>{agent.department}</span>
                    )}
                  </td>

                  <td style={{ padding: "12px 18px", color: "#4b5563", fontFamily: "ui-monospace, monospace" }}>
                    {agent.matricule ?? NOT_PROVIDED}
                  </td>

                  <td style={{ padding: "12px 18px", color: "#111827", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {count(agent.submissionsCount)}
                  </td>

                  <td style={{ padding: "12px 18px", color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>
                    {agent.lastLoginAt ? elapsedSince(agent.lastLoginAt) : NOT_PROVIDED}
                  </td>

                  <td style={{ padding: "12px 18px", color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>
                    {stamp(agent.createdAt, false)}
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
                      {agent.isActive ? "Actif" : "Inactif"}
                    </span>
                    {/* Registration state as stored, when it is not simply
                        ACTIVE — e.g. PENDING_APPROVAL, REJECTED. */}
                    {agent.status && agent.status !== "ACTIVE" && (
                      <span style={{ display: "block", fontSize: 11, color: "#6b7280", marginTop: 3 }}>
                        {agent.status}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: "12px 18px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      onClick={() => setProfileAgent(agent)}
                      style={{ background: "none", border: "none", color: "#004d3d", fontWeight: 600, fontSize: 13, cursor: "pointer", padding: "2px 6px" }}
                    >
                      Profil
                    </button>
                    <span style={{ color: "#d1d5db", margin: "0 6px" }}>|</span>
                    <button
                      type="button"
                      onClick={() => setReassignAgent(agent)}
                      style={{ background: "none", border: "none", color: "#004d3d", fontWeight: 600, fontSize: 13, cursor: "pointer", padding: "2px 6px" }}
                    >
                      Réassigner
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ajouter Agent Dialog */}
      <CreateAgentDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => showToast("Nouvel agent créé avec succès.")} />

      {/* Profil Agent Dialog */}
      {profileAgent && (
        <AdminDialog
          open={!!profileAgent}
          onClose={() => setProfileAgent(null)}
          title={`Profil — ${profileAgent.name}`}
          eyebrow={`${directoryRoleLabel(profileAgent.role)}${profileAgent.region ? ` • ${profileAgent.region}` : ""}`}
          footer={
            <button
              type="button"
              className="cam-button cam-button-secondary"
              onClick={() => setProfileAgent(null)}
            >
              Fermer
            </button>
          }
        >
          <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>EMAIL</div>
              <div style={{ fontWeight: 600, color: "#111827", marginTop: 2 }}>{profileAgent.email}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>RÔLE</div>
              <div style={{ color: "#111827", marginTop: 2 }}>{directoryRoleLabel(profileAgent.role)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>RESSORT ASSIGNÉ</div>
              <div style={{ color: "#111827", marginTop: 2 }}>
                {profileAgent.region ?? (hasRole(profileAgent.role, TERRITORIAL_ROLES) ? "Ressort non affecté" : NOT_PROVIDED)}
                {profileAgent.department ? ` (${profileAgent.department})` : ""}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>MATRICULE</div>
              <div style={{ color: "#111827", marginTop: 2 }}>{profileAgent.matricule ?? NOT_PROVIDED}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>COMPTE CRÉÉ LE</div>
              <div style={{ color: "#111827", marginTop: 2 }}>{stamp(profileAgent.createdAt, false)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>FORMULAIRES COLLECTÉS</div>
              <div style={{ color: "#111827", marginTop: 2, fontWeight: 600 }}>{count(profileAgent.submissionsCount)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>DERNIÈRE CONNEXION</div>
              <div style={{ color: "#111827", marginTop: 2 }}>{profileAgent.lastLoginAt ? stamp(profileAgent.lastLoginAt, true) : NOT_PROVIDED}</div>
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
            showToast(`Territoire réassigné pour ${reassignAgent.name}.`);
          }}
        />
      )}
    </div>
  );
}

// ── Ajouter Agent Dialog ────────────────────────────────────────────────────────
const EMPTY_FORM = { firstName: "", lastName: "", email: "", role: "REGIONAL_ADMIN", region: "Littoral", department: "", matricule: "", poste: "" };

function CreateAgentDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const queryClient = useQueryClient();
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
        department: form.department || undefined,
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
    setForm((f) => ({ ...f, [key]: value, ...(key === "region" ? { department: "" } : {}) }));

  const { regions } = useTerritoryRegions();
  const { departments } = useTerritoryDepartments(form.region);

  return (
    <AdminDialog
      open={open}
      onClose={close}
      title="Ajouter un Agent ONEFOP"
      eyebrow="Création de compte administratif ou enquêteur"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, width: "100%" }}>
          <button type="button" className="cam-button cam-button-secondary" onClick={close}>
            {created ? "Fermer" : "Annuler"}
          </button>
          {!created && (
            <button
              type="button"
              className="cam-button cam-button-primary"
              disabled={mutation.isPending || !form.email || !form.firstName || !form.lastName}
              onClick={() => mutation.mutate()}
              style={{ background: "#004d3d" }}
            >
              {mutation.isPending ? "Création…" : "Créer l'Agent"}
            </button>
          )}
        </div>
      }
    >
      {created ? (
        <div style={{ fontSize: 13, background: "#ecfdf5", border: "1px solid #a7f3d0", padding: 16, borderRadius: 8 }}>
          <div style={{ fontWeight: 700, color: "#065f46", fontSize: 14 }}>Compte agent créé avec succès !</div>
          <div style={{ marginTop: 8, color: "#065f46" }}>Email : <strong>{created.email}</strong></div>
          <div style={{ marginTop: 4, color: "#065f46" }}>Mot de passe temporaire : <code style={{ background: "#d1fae5", padding: "2px 6px", borderRadius: 4 }}>{created.temporaryPassword}</code></div>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Prénom</label>
              <input type="text" className="cam-input" value={form.firstName} onChange={(e) => set("firstName")(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Nom</label>
              <input type="text" className="cam-input" value={form.lastName} onChange={(e) => set("lastName")(e.target.value)} required />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Email officiel</label>
            <input type="email" className="cam-input" value={form.email} onChange={(e) => set("email")(e.target.value)} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Région</label>
              <select className="cam-input" value={form.region} onChange={(e) => set("region")(e.target.value)}>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Département</label>
              <select className="cam-input" value={form.department} onChange={(e) => set("department")(e.target.value)}>
                <option value="">Tous les départements</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
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
      title={`Réassigner le territoire — ${agent.name}`}
      eyebrow="Affectation géographique de l'agent"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, width: "100%" }}>
          <button type="button" className="cam-button cam-button-secondary" onClick={onClose}>Annuler</button>
          <button
            type="button"
            className="cam-button cam-button-primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={{ background: "#004d3d" }}
          >
            {mutation.isPending ? "Enregistrement…" : "Confirmer l'affectation"}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Région d&apos;affectation</label>
          <select className="cam-input" value={region} onChange={(e) => { setRegion(e.target.value); setDepartment(""); }}>
            <option value="">Aucune région affectée</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Département</label>
          <select className="cam-input" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">Tous les départements de la région</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
    </AdminDialog>
  );
}
