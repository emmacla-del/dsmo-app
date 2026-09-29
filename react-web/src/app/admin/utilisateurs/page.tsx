"use client";

import { useQuery } from "@tanstack/react-query";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import {
  ONEFOP_STAFF_ROLES,
  TERRITORIAL_ROLES,
  directoryRoleLabel,
  listUsers,
  type DirectoryUser,
} from "@/lib/user-directory";
import { CAMEROON_ADMIN_HIERARCHY } from "@/components/onefop/vt-cameroon-admin-data";
import { UsersDirectory, type RoleScope } from "@/components/admin/UsersDirectory";

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

export default function OnefopUsersPage() {
  const { isLoading, forbidden } = useAdminScreenGuard(ALLOWED_ROLES);
  const enabled = !isLoading && !forbidden;

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

  return (
    <div className="cam-admin-page">

      <div className="cam-admin-page-toolbar">
        <span />
        <button
          className="cam-button cam-button-primary cam-button-sm"
          disabled
          title="Fonctionnalité disponible depuis la console Flutter"
        >
          Ajouter Agent
        </button>
      </div>

      <div className="cam-pilot-kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }} aria-label="Synthèse des comptes">

        {/* Agents Actifs en Service */}
        <div className="cam-pilot-kpi">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="cam-admin-meta">Agents Actifs en Service</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(30,107,58,0.12)", display: "grid", placeItems: "center", flexShrink: 0, color: "var(--cam-green)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
          </div>
          <div className="cam-pilot-kpi-value">{summaryQuery.isError ? "—" : summary?.active ?? "…"}</div>
          <div className="cam-admin-meta">Enquêteurs déployés</div>
        </div>

        {/* Agents Inactifs */}
        <div className="cam-pilot-kpi">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="cam-admin-meta">Agents Inactifs</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(220,38,38,0.1)", display: "grid", placeItems: "center", flexShrink: 0, color: "#dc2626" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/>
              </svg>
            </div>
          </div>
          <div className="cam-pilot-kpi-value">{summaryQuery.isError ? "—" : summary?.suspended ?? "…"}</div>
          <div className="cam-admin-meta">En attente d&apos;affectation</div>
        </div>

        {/* Nouvelles Inscriptions */}
        <div className="cam-pilot-kpi">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="cam-admin-meta">Nouvelles Inscriptions (Mois)</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(30,107,58,0.12)", display: "grid", placeItems: "center", flexShrink: 0, color: "var(--cam-green)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
            </div>
          </div>
          <div className="cam-pilot-kpi-value">{summaryQuery.isError ? "—" : summary?.pending ?? "…"}</div>
          <div className="cam-admin-meta">↑ Recrutement actif</div>
        </div>

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

      <section className="cam-admin-section">
        <div className="cam-admin-section-body">
          <UsersDirectory roleScopes={ROLE_SCOPES} defaultRoleScope="territorial" defaultStatus="all" showRegionFilter assignableRoles={ONEFOP_STAFF_ROLES} />
        </div>
      </section>
    </div>
  );
}
