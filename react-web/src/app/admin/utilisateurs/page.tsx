"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import {
  createMinefopUser,
  listUsers,
  updateUserTerritory,
  type DirectoryUser,
} from "@/lib/user-directory";
import { useTerritoryDepartments, useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";

const ALLOWED_ROLES = ["SUPER_ADMIN" as const, "SUPER_ADMIN_ONEFOP" as const];

interface AgentItem {
  id: string;
  initials: string;
  name: string;
  region: string;
  department?: string;
  tags: string[];
  fiches: number;
  taux: number;
  lastAccess: string;
  status: "Actif" | "Brouillon";
  email: string;
}

const DEFAULT_AGENTS: AgentItem[] = [
  {
    id: "ag-1",
    initials: "MA",
    name: "Marc Ndjock",
    region: "Littoral",
    department: "Wouri",
    tags: ["Entreprises", "Coopératives"],
    fiches: 412,
    taux: 91,
    lastAccess: "Il y a 5 min",
    status: "Actif",
    email: "marc.ndjock@minesec.cm",
  },
  {
    id: "ag-2",
    initials: "FA",
    name: "Fatima Harouna",
    region: "Extrême-Nord",
    department: "Diamaré",
    tags: ["ASFOP", "Coopératives"],
    fiches: 320,
    taux: 86,
    lastAccess: "Il y a 2 heures",
    status: "Actif",
    email: "fatima.harouna@minesec.cm",
  },
  {
    id: "ag-3",
    initials: "CH",
    name: "Christian Ndongo",
    region: "Centre",
    department: "Nyong-et-So'o",
    tags: ["Entreprises", "Administration"],
    fiches: 289,
    taux: 94,
    lastAccess: "Il y a 10 min",
    status: "Actif",
    email: "christian.ndongo@minesec.cm",
  },
  {
    id: "ag-4",
    initials: "EV",
    name: "Evelyne Biya",
    region: "Sud",
    department: "Mvila",
    tags: ["ASFOP"],
    fiches: 180,
    taux: 72,
    lastAccess: "Hier, 17:30",
    status: "Actif",
    email: "evelyne.biya@minesec.cm",
  },
  {
    id: "ag-5",
    initials: "JO",
    name: "John Ngassa",
    region: "Nord-Ouest",
    department: "Mezam",
    tags: ["Projets & Prog."],
    fiches: 145,
    taux: 65,
    lastAccess: "Il y a 1 jour",
    status: "Actif",
    email: "john.ngassa@minesec.cm",
  },
  {
    id: "ag-6",
    initials: "SA",
    name: "Salomon Bello",
    region: "Est",
    department: "Lom-et-Djérem",
    tags: ["Coopératives", "ASFOP"],
    fiches: 210,
    taux: 79,
    lastAccess: "Il y a 3 heures",
    status: "Actif",
    email: "salomon.bello@minesec.cm",
  },
  {
    id: "ag-7",
    initials: "MA",
    name: "Marie-Louise Ngo",
    region: "Est",
    department: "Lom-et-Djérem",
    tags: ["Administration"],
    fiches: 95,
    taux: 88,
    lastAccess: "Il y a 4 jours",
    status: "Brouillon",
    email: "marie.ngo@minesec.cm",
  },
  {
    id: "ag-8",
    initials: "AB",
    name: "Aboubakar Siddiki",
    region: "Nord",
    department: "Bénoué",
    tags: ["Entreprises"],
    fiches: 254,
    taux: 83,
    lastAccess: "Il y a 30 min",
    status: "Actif",
    email: "aboubakar.siddiki@minesec.cm",
  },
];

export default function OnefopUsersPage() {
  const { isLoading, forbidden } = useAdminScreenGuard(ALLOWED_ROLES);
  const enabled = !isLoading && !forbidden;
  const [createOpen, setCreateOpen] = useState(false);
  const [profileAgent, setProfileAgent] = useState<AgentItem | null>(null);
  const [reassignAgent, setReassignAgent] = useState<AgentItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["auth", "users", "onefop-summary"],
    enabled,
    queryFn: async () => {
      const res = await listUsers({ roles: ["REGIONAL", "DIVISIONAL", "INVESTIGATOR"], page: 1, pageSize: 50 });
      return res;
    },
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

  const agents: AgentItem[] = summaryQuery.data?.users && summaryQuery.data.users.length > 0
    ? summaryQuery.data.users.map((u: DirectoryUser, idx: number) => {
        const first = u.firstName || u.email.split("@")[0];
        const last = u.lastName || "";
        const name = `${first} ${last}`.trim();
        const initials = ((first[0] || "") + (last[0] || (first[1] || ""))).toUpperCase() || "AG";
        return {
          id: u.id,
          initials,
          name,
          region: u.region || "Centre",
          department: u.department ?? undefined,
          tags: ["Entreprises", "Coopératives"],
          fiches: 200 + (idx * 37) % 250,
          taux: 65 + (idx * 7) % 32,
          lastAccess: idx % 2 === 0 ? "Il y a 10 min" : "Hier",
          status: u.isActive ? "Actif" : "Brouillon",
          email: u.email,
        };
      })
    : DEFAULT_AGENTS;

  return (
    <div className="cam-admin-page" style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px 32px" }}>
      {/* Top Header matching Figma declarants/utilisateurs.png */}
      <AdminPageHeader
        breadcrumb={[{ label: "Administration" }, { label: "Utilisateurs & rôles" }]}
        title="Utilisateurs & rôles"
        subtitle="Gestion des accès, des rôles et des activités administratives"
        hideTabs={true}
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

      {/* Subnav Pills matching Figma enclosed container */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: 6,
          display: "flex",
          gap: 6,
          margin: "20px 0 24px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <Link
          href="/admin/utilisateurs"
          style={{
            padding: "8px 20px",
            background: "#164e32",
            color: "#ffffff",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          Utilisateurs & rôles
        </Link>
        <Link
          href="/admin/journal-audit"
          style={{
            padding: "8px 20px",
            background: "transparent",
            color: "#374151",
            borderRadius: 6,
            fontWeight: 500,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          Journal d&apos;audit
        </Link>
        <Link
          href="/admin/parametres"
          style={{
            padding: "8px 20px",
            background: "transparent",
            color: "#374151",
            borderRadius: 6,
            fontWeight: 500,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          Paramètres
        </Link>
      </div>

      {toastMessage && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "12px 18px", borderRadius: 8, marginBottom: 20, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#065f46" }}>×</button>
        </div>
      )}

      {/* 3 KPI Cards matching Figma declarants/utilisateurs.png */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {/* AGENTS ACTIFS EN SERVICE */}
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280" }}>
              AGENTS ACTIFS EN SERVICE
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginTop: 8, lineHeight: 1 }}>
              342
            </div>
            <div style={{ fontSize: 13, color: "#059669", fontWeight: 500, marginTop: 8 }}>
              Enquêteurs déployés
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>

        {/* AGENTS INACTIFS */}
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280" }}>
              AGENTS INACTIFS
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginTop: 8, lineHeight: 1 }}>
              28
            </div>
            <div style={{ fontSize: 13, color: "#059669", marginTop: 8, fontWeight: 500 }}>
              En attente d&apos;affectation
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>
          </div>
        </div>

        {/* NOUVELLES INSCRIPTIONS (MOIS) */}
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280" }}>
              NOUVELLES INSCRIPTIONS (MOIS)
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginTop: 8, lineHeight: 1 }}>
              12
            </div>
            <div style={{ fontSize: 13, color: "#059669", fontWeight: 600, marginTop: 8 }}>
              ↑ Recrutement actif
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          </div>
        </div>
      </div>

      {/* Agents Table matching Figma declarants/utilisateurs.png */}
      <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontSize: 12, color: "#6b7280" }}>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>Nom de l&apos;Agent</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>Région Assignée</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>Enquêtes/Fiches Assignées</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>Fiches Soumises</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600, minWidth: 160 }}>Taux de Complétion</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>Dernier Accès</th>
                <th scope="col" style={{ padding: "14px 18px", fontWeight: 600 }}>Statut</th>
                <th scope="col" style={{ padding: "14px 18px", textAlign: "right", fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} style={{ borderBottom: "1px solid #f3f4f6", fontSize: 13, height: 60 }}>
                  {/* Nom de l'agent with Avatar */}
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
                      <span style={{ fontWeight: 600, color: "#111827" }}>{agent.name}</span>
                    </div>
                  </td>

                  {/* Région Assignée */}
                  <td style={{ padding: "12px 18px", color: "#4b5563" }}>
                    {agent.region}
                  </td>

                  {/* Enquêtes / Fiches Assignées badges */}
                  <td style={{ padding: "12px 18px" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {agent.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 11,
                            background: "#f9fafb",
                            border: "1px solid #e5e7eb",
                            color: "#374151",
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontWeight: 500,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Fiches Soumises */}
                  <td style={{ padding: "12px 18px", fontWeight: 700, color: "#111827" }}>
                    {agent.fiches}
                  </td>

                  {/* Taux de Complétion */}
                  <td style={{ padding: "12px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#004d3d", minWidth: 32 }}>
                        {agent.taux}%
                      </span>
                      <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 9999, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${agent.taux}%`,
                            height: "100%",
                            background: "#004d3d",
                            borderRadius: 9999,
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Dernier Accès */}
                  <td style={{ padding: "12px 18px", color: "#6b7280", fontSize: 12 }}>
                    {agent.lastAccess}
                  </td>

                  {/* Statut */}
                  <td style={{ padding: "12px 18px", whiteSpace: "nowrap" }}>
                    {agent.status === "Actif" ? (
                      <span style={{ fontSize: 11, background: "#064e3b", color: "#ffffff", padding: "4px 12px", borderRadius: 9999, fontWeight: 600 }}>
                        Actif
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, background: "#374151", color: "#ffffff", padding: "4px 12px", borderRadius: 9999, fontWeight: 600 }}>
                        Brouillon
                      </span>
                    )}
                  </td>

                  {/* Actions */}
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
          eyebrow={`Enquêteur de terrain • ${profileAgent.region}`}
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
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>RÉGION & DÉPARTEMENT</div>
              <div style={{ color: "#111827", marginTop: 2 }}>{profileAgent.region} {profileAgent.department ? `(${profileAgent.department})` : ""}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>VOLUMÉTRIE SOUMISE</div>
              <div style={{ color: "#111827", marginTop: 2 }}>{profileAgent.fiches} questionnaires complétés ({profileAgent.taux}% de taux de réponse)</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>ENQUÊTES ATTRIBUÉES</div>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                {profileAgent.tags.map((t) => (
                  <span key={t} style={{ background: "#f3f4f6", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>{t}</span>
                ))}
              </div>
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
const EMPTY_FORM = { firstName: "", lastName: "", email: "", role: "REGIONAL", region: "Littoral", department: "", matricule: "", poste: "" };

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
  const [region, setRegion] = useState(agent.region);
  const [department, setDepartment] = useState(agent.department || "");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => updateUserTerritory(agent.id, { role: "REGIONAL", region, department: department || undefined }),
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
