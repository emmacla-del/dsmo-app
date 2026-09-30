"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import {
  MINEFOP_FIELD_ROLES,
  ONEFOP_STAFF_ROLES,
  TERRITORIAL_ROLES,
  createMinefopUser,
  directoryRoleLabel,
  listUsers,
  type DirectoryUser,
} from "@/lib/user-directory";
import { CAMEROON_ADMIN_HIERARCHY } from "@/components/onefop/vt-cameroon-admin-data";
import { UsersDirectory, type RoleScope } from "@/components/admin/UsersDirectory";
import { AdminDialog } from "@/components/admin/AdminDialog";

// /auth/users* accept SUPER_ADMIN and SUPER_ADMIN_ONEFOP; the server limits
// the latter to ONEFOP personnel (src/auth/staff-scope.ts).
const ALLOWED_ROLES = ["SUPER_ADMIN" as const, "SUPER_ADMIN_ONEFOP" as const];

const ROLE_SCOPES: RoleScope[] = [
  { key: "territorial", label: "Régionaux et divisionnaires", roles: TERRITORIAL_ROLES },
  { key: "all", label: "Tous les rôles ONEFOP", roles: ONEFOP_STAFF_ROLES },
  ...ONEFOP_STAFF_ROLES.map((r) => ({ key: r, label: directoryRoleLabel(r), roles: [r] })),
];

// Department names in user accounts are free text; compare without case or accents.
const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

async function listAllActiveDivisional(): Promise<DirectoryUser[]> {
  const all: DirectoryUser[] = [];
  for (let page = 1; ; page++) {
    const res = await listUsers({ roles: ["DIVISIONAL"], isActive: true, page, pageSize: 100 });
    all.push(...res.users);
    if (all.length >= res.total || res.users.length === 0) return all;
  }
}

const countOf = (params: Parameters<typeof listUsers>[0]) =>
  listUsers({ ...params, roles: ONEFOP_STAFF_ROLES, page: 1, pageSize: 1 }).then((r) => r.total);

const ICON_PATHS = {
  active: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  inactive: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
      <line x1="18" y1="8" x2="23" y2="13" /><line x1="23" y1="8" x2="18" y2="13" />
    </>
  ),
  pending: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
    </>
  ),
};

function Kpi({ label, value, trend, icon, tone }: {
  label: string; value: ReactNode; trend: string; icon: keyof typeof ICON_PATHS; tone: "green" | "neutral";
}) {
  return (
    <div className="cam-pilot-kpi">
      <div className="cam-pilot-kpi-top">
        <span className="cam-pilot-kpi-label" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
        <span
          className="cam-pilot-kpi-icon"
          aria-hidden="true"
          style={tone === "green"
            ? { background: "var(--cam-accent-soft)", color: "var(--cam-green)" }
            : { background: "var(--cam-bg)", color: "var(--cam-text-muted)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {ICON_PATHS[icon]}
          </svg>
        </span>
      </div>
      <div className="cam-pilot-kpi-value">{value}</div>
      <div className="cam-pilot-kpi-trend" style={{ color: "var(--cam-green)" }}>{trend}</div>
    </div>
  );
}

export default function OnefopUsersPage() {
  const { isLoading, forbidden } = useAdminScreenGuard(ALLOWED_ROLES);
  const enabled = !isLoading && !forbidden;
  const [createOpen, setCreateOpen] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ["auth", "users", "onefop-summary"],
    enabled,
    queryFn: async () => {
      const [active, suspended, pending, divisional] = await Promise.all([
        countOf({ isActive: true }),
        countOf({ isActive: false }),
        countOf({ status: "PENDING_APPROVAL" }),
        listAllActiveDivisional(),
      ]);
      // A backend without ?roles= support returns every staff account here.
      if (divisional.some((u) => u.role !== "DIVISIONAL")) {
        throw new Error("le serveur ne prend pas encore en charge le filtre par rôle");
      }
      const covered = new Set(divisional.map((u) => normalize(u.department ?? "")).filter(Boolean));
      const uncovered = CAMEROON_ADMIN_HIERARCHY.flatMap((r) =>
        r.departments
          .filter((d) => !covered.has(normalize(d.name)))
          .map((d) => ({ region: r.name, department: d.name })),
      );
      return { active, suspended, pending, uncovered };
    },
  });

  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <div>
          <h1 className="cam-admin-h1">Accès restreint</h1>
          <p className="cam-admin-lede">La gestion des comptes ONEFOP est réservée aux administrateurs ONEFOP.</p>
        </div>
      </div>
    );
  }

  const summary = summaryQuery.data;
  const kpiValue = (n: number | undefined) => (summaryQuery.isError ? "—" : n?.toLocaleString("fr-FR") ?? "…");

  return (
    <div className="cam-admin-page">

      <div className="cam-admin-page-toolbar">
        <span />
        <button type="button" className="cam-button cam-button-primary" onClick={() => setCreateOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Ajouter Agent
        </button>
      </div>

      <div className="cam-pilot-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }} aria-label="Synthèse des comptes">
        <Kpi label="Agents actifs en service" value={kpiValue(summary?.active)} trend="Enquêteurs déployés" icon="active" tone="green" />
        {/* Counts isActive=false accounts (suspended): there is no "awaiting assignment" state server-side. */}
        <Kpi label="Agents inactifs" value={kpiValue(summary?.suspended)} trend="Comptes suspendus" icon="inactive" tone="neutral" />
        {/* All PENDING_APPROVAL staff accounts: /auth/users has no creation-date filter, so no monthly count. */}
        <Kpi label="Inscriptions en attente" value={kpiValue(summary?.pending)} trend="Comptes à valider" icon="pending" tone="green" />
      </div>

      {summaryQuery.isError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>La synthèse n&apos;a pas pu être chargée : {(summaryQuery.error as Error).message}</span>
        </div>
      )}

      {summary && summary.uncovered.length > 0 && (
        <details className="cam-admin-notice cam-admin-notice--warn" style={{ display: "block" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            {summary.uncovered.length} département{summary.uncovered.length > 1 ? "s" : ""} sans divisionnaire actif
          </summary>
          <p className="cam-admin-meta" style={{ margin: "var(--cam-space-2) 0" }}>
            Calculé à partir du champ « département » des comptes divisionnaires actifs : un nom saisi différemment peut
            faire apparaître un département à tort.
          </p>
          <ul style={{ columns: "220px", margin: 0, paddingLeft: "var(--cam-space-5)" }}>
            {summary.uncovered.map((d) => (
              <li key={`${d.region}-${d.department}`}>
                {d.department} <span className="cam-admin-muted">({d.region})</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <UsersDirectory
        roleScopes={ROLE_SCOPES}
        defaultRoleScope="territorial"
        defaultStatus="all"
        showRegionFilter
        assignableRoles={ONEFOP_STAFF_ROLES}
        reassignRoles={ONEFOP_STAFF_ROLES}
        agentRoster
      />

      <CreateAgentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

// ── Ajouter Agent ───────────────────────────────────────────────────────────
// POST /auth/admin/create-minefop-user (SUPER_ADMIN, SUPER_ADMIN_ONEFOP per D1).
// The server accepts CENTRAL, REGIONAL and DIVISIONAL only, requires a region
// for REGIONAL and a region + department for DIVISIONAL, and returns a one-time
// temporary password (the account must change it at first login).

const EMPTY_FORM = { firstName: "", lastName: "", email: "", role: "REGIONAL", region: "", department: "", matricule: "", poste: "" };

function CreateAgentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

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
    },
  });

  const close = () => {
    setForm(EMPTY_FORM);
    setCreated(null);
    setCopied(false);
    mutation.reset();
    onClose();
  };

  const set = (key: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value, ...(key === "region" ? { department: "" } : {}) }));

  const departments = CAMEROON_ADMIN_HIERARCHY.find((r) => r.name === form.region)?.departments ?? [];
  const missing =
    !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()
      ? "Renseignez le prénom, le nom et l'adresse e-mail."
      : (form.role === "REGIONAL" || form.role === "DIVISIONAL") && !form.region
        ? "Une région est requise pour ce rôle."
        : form.role === "DIVISIONAL" && !form.department
          ? "Un département est requis pour un divisionnaire."
          : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!missing) mutation.mutate();
  };

  if (created) {
    return (
      <AdminDialog
        open={open}
        onClose={close}
        eyebrow="Agent créé"
        title="Mot de passe temporaire"
        footer={<button type="button" className="cam-button cam-button-primary" onClick={close}>Terminer</button>}
      >
        <p>
          Le compte <strong>{created.email}</strong> est actif. Transmettez ce mot de passe à l&apos;agent par un canal
          sûr : il ne sera plus jamais affiché, et l&apos;agent devra le changer à sa première connexion.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)", flexWrap: "wrap" }}>
          <code className="cam-admin-code" style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: 700, letterSpacing: "0.06em" }}>
            {created.temporaryPassword}
          </code>
          <button
            type="button"
            className="cam-button cam-button-secondary cam-button-sm"
            onClick={() => {
              navigator.clipboard?.writeText(created.temporaryPassword).then(() => setCopied(true), () => setCopied(false));
            }}
          >
            {copied ? "Copié" : "Copier"}
          </button>
        </div>
      </AdminDialog>
    );
  }

  return (
    <AdminDialog
      open={open}
      onClose={close}
      eyebrow="Utilisateurs ONEFOP"
      title="Ajouter un agent"
      footer={
        <>
          <button type="button" className="cam-button cam-button-secondary" onClick={close}>Annuler</button>
          <button type="submit" form="create-agent-form" className="cam-button cam-button-primary" disabled={!!missing || mutation.isPending}>
            {mutation.isPending ? "Création…" : "Créer le compte"}
          </button>
        </>
      }
    >
      <form id="create-agent-form" onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--cam-space-3)" }}>
        <Field id="agent-first-name" label="Prénom">
          <input id="agent-first-name" className="cam-input" value={form.firstName} onChange={(e) => set("firstName")(e.target.value)} required />
        </Field>
        <Field id="agent-last-name" label="Nom">
          <input id="agent-last-name" className="cam-input" value={form.lastName} onChange={(e) => set("lastName")(e.target.value)} required />
        </Field>
        <Field id="agent-email" label="Adresse e-mail">
          <input id="agent-email" type="email" className="cam-input" value={form.email} onChange={(e) => set("email")(e.target.value)} required />
        </Field>
        <Field id="agent-role" label="Rôle">
          <select id="agent-role" className="cam-select" value={form.role} onChange={(e) => set("role")(e.target.value)}>
            {MINEFOP_FIELD_ROLES.map((r) => <option key={r} value={r}>{directoryRoleLabel(r)}</option>)}
          </select>
        </Field>
        <Field id="agent-region" label="Région">
          <select id="agent-region" className="cam-select" value={form.region} onChange={(e) => set("region")(e.target.value)}>
            <option value="">— Aucune —</option>
            {CAMEROON_ADMIN_HIERARCHY.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
        </Field>
        <Field id="agent-department" label="Département">
          <select id="agent-department" className="cam-select" value={form.department} disabled={!form.region} onChange={(e) => set("department")(e.target.value)}>
            <option value="">— Aucun —</option>
            {departments.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
        </Field>
        <Field id="agent-matricule" label="Matricule (optionnel)">
          <input id="agent-matricule" className="cam-input" value={form.matricule} onChange={(e) => set("matricule")(e.target.value)} />
        </Field>
        <Field id="agent-poste" label="Poste (optionnel)">
          <input id="agent-poste" className="cam-input" value={form.poste} onChange={(e) => set("poste")(e.target.value)} />
        </Field>
      </form>
      {missing && <p className="cam-admin-meta" role="status">{missing}</p>}
      {mutation.isError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>La création a échoué : {(mutation.error as Error).message}</span>
        </div>
      )}
    </AdminDialog>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="cam-field">
      <label className="cam-label" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
