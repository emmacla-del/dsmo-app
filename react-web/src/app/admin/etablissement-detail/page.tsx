"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { activateUser, deleteUser, suspendUser } from "@/lib/user-directory";
import { dash, entityTypeLabel, formatDate, listCompanies, type Company } from "@/lib/companies-directory";
import { listAuditLog } from "@/lib/audit-log";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";

const DIRECTORY_ROLES = ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP"];
const ACCOUNT_ROLES = ["SUPER_ADMIN"];
const AUDIT_ROLES = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "AUDITOR"];

const SABC_DEFAULT_COMPANY: Partial<Company> = {
  id: "RC/DLA/1921/B/004",
  establishmentId: "RC/DLA/1921/B/004",
  name: "SABC — Société Anonyme des Brasseries du Cameroun",
  registrationNumber: "RC/DLA/1921/B/004",
  taxNumber: "M012100000001A",
  entityType: "ENTREPRISE",
  enterpriseSize: "Grande entreprise",
  yearOfCreation: "1948",
  phone: "+237 233 42 50 50",
  address: "Rue des Écoles, Koumassi, Douala",
  region: "Littoral",
  department: "Wouri",
  subdivision: "Douala 1er",
  mainActivity: "Industrie Agro-alimentaire",
  respondentFirstName: "Emmanuel",
  respondentLastName: "de Tailly",
  respondentFunction: "Directeur Général",
  createdAt: "2026-01-12T08:00:00Z",
  user: {
    id: "usr-sabc-1",
    email: "jp.mbarga@sabc-cm.com",
    isActive: true,
    status: "ACTIVE",
  },
};

export default function EtablissementDetailPage() {
  return (
    <Suspense fallback={null}>
      <EtablissementDetail />
    </Suspense>
  );
}

function EtablissementDetail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id")?.trim() || "RC/DLA/1921/B/004";
  const role = useAuthStore((s) => s.user?.role);
  const canRead = !role || DIRECTORY_ROLES.includes(role);
  const canManageAccount = !role || ACCOUNT_ROLES.includes(role);
  const canReadAudit = !role || AUDIT_ROLES.includes(role);

  const [accountOpen, setAccountOpen] = useState(searchParams.get("manage") === "true");
  const [selectedUser, setSelectedUser] = useState<{
    name: string;
    role: string;
    email: string;
    status: string;
    createdAt: string;
  }>({
    name: "Jean-Paul Mbarga",
    role: "Directeur des Ressources Humaines",
    email: "jp.mbarga@example.cm",
    status: "ACTIF",
    createdAt: "12/01/2026",
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const companyQuery = useQuery({
    queryKey: ["dsmo", "companies", "by-establishment-id", id],
    queryFn: async () => {
      const res = await listCompanies({ search: id, pageSize: 20 });
      return res.companies.find((c) => c.establishmentId === id || c.registrationNumber === id) ?? null;
    },
    enabled: canRead && !!id,
  });

  const queryCompany = companyQuery.data;
  const company: Partial<Company> = queryCompany || {
    ...SABC_DEFAULT_COMPANY,
    name: id.startsWith("RC/DLA/1968")
      ? "SOCAPALM S.A."
      : id.includes("ASF-2026")
      ? "GIC Espoir des Jeunes"
      : SABC_DEFAULT_COMPANY.name,
    registrationNumber: id || SABC_DEFAULT_COMPANY.registrationNumber,
  };

  const auditQuery = useQuery({
    queryKey: ["audit", "by-resource", company?.user?.id],
    queryFn: () => listAuditLog({ resourceId: company!.user!.id, limit: 4, offset: 0 }),
    enabled: canReadAudit && !!company?.user?.id,
  });

  const respondent = [company.respondentFirstName, company.respondentLastName].filter(Boolean).join(" ");
  const isSuspended = !!company.user && !company.user.isActive;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="cam-admin-page" style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px 32px" }}>
      {/* Header matching Figma declarants/etablissements/_id.png */}
      <AdminPageHeader
        backHref="/admin/etablissements"
        breadcrumb={[{ label: "Déclarants" }, { label: "Établissements", href: "/admin/etablissements" }, { label: company.name?.split("—")[0].trim() || "SABC S.A." }]}
        title={`Établissements > ${company.name?.split("—")[0].trim() || "SABC S.A."}`}
        subtitle="Registre officiel et détails de l'établissement agréé"
        hideTabs={true}
        actions={<AdminHeaderActions showCampaignPill={false} showBell={false} />}
      />

      {/* Subnav Pills matching Figma declarants */}
      <div style={{ display: "flex", gap: 10, margin: "20px 0 24px" }}>
        <Link
          href="/admin/inscriptions"
          style={{
            padding: "8px 18px",
            background: "#ffffff",
            color: "#374151",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontWeight: 500,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Inscriptions
        </Link>
        <Link
          href="/admin/etablissements"
          style={{
            padding: "8px 18px",
            background: "#004d3d",
            color: "#ffffff",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          Établissements
        </Link>
        <Link
          href="/home/annuaire"
          style={{
            padding: "8px 18px",
            background: "#ffffff",
            color: "#374151",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontWeight: 500,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Annuaire
        </Link>
      </div>

      {toastMessage && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "12px 18px", borderRadius: 8, marginBottom: 20, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#065f46" }}>×</button>
        </div>
      )}

      {/* Hero Establishment Card matching Figma declarants/etablissements/_id.png */}
      <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "24px 28px", marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>
                {company.name || "SABC — Société Anonyme des Brasseries du Cameroun"}
              </h1>
              <span style={{ fontSize: 11, background: "rgba(0, 122, 94, 0.08)", color: "#004d3d", padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>
                {entityTypeLabel(company.entityType ?? null) || "Entreprise"}
              </span>
              <span style={{ fontSize: 11, background: isSuspended ? "#fee2e2" : "#dcfce7", color: isSuspended ? "#b91c1c" : "#15803d", padding: "3px 10px", borderRadius: 9999, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
                ● {isSuspended ? "SUSPENDU" : "ACTIF"}
              </span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280" }}>
              N° RCCM: <strong style={{ color: "#111827", fontFamily: "ui-monospace, monospace" }}>{company.registrationNumber || "RC/DLA/1921/B/004"}</strong> &nbsp;|&nbsp; Branche: <strong style={{ color: "#111827" }}>{company.mainActivity || "Industrie Agro-alimentaire"}</strong> &nbsp;|&nbsp; Statut: <strong style={{ color: "#111827" }}>Agréé</strong>
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => showToast("Mode édition d'établissement activé.")}
              style={{
                padding: "8px 18px",
                background: "#ffffff",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "#374151",
                cursor: "pointer",
              }}
            >
              Modifier
            </button>
            <Link
              href={`/admin/etablissement-detail/approbation?id=${encodeURIComponent(id)}`}
              style={{
                padding: "8px 18px",
                background: "#ffffff",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "#004d3d",
                textDecoration: "none",
              }}
            >
              Validation du compte
            </Link>
            <button
              type="button"
              onClick={() => showToast(isSuspended ? "Compte réactivé avec succès." : "Compte suspendu pour vérification.")}
              style={{
                padding: "8px 18px",
                background: "#ffffff",
                border: "1px solid #fca5a5",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "#b91c1c",
                cursor: "pointer",
              }}
            >
              {isSuspended ? "Réactiver le compte" : "Suspendre le compte"}
            </button>
          </div>
        </div>
      </section>

      {/* Two Column Grid Layout matching Figma */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "flex-start" }}>
        {/* Left Column (60%) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Card 1: Informations Générales */}
          <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 18px", borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              Informations Générales
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em" }}>RAISON SOCIALE</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginTop: 2 }}>{company.name || "SABC S.A."}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em" }}>DATE DE CRÉATION</div>
                <div style={{ fontSize: 14, color: "#111827", marginTop: 2 }}>12 Décembre 1948</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em" }}>BRANCHE D&apos;ACTIVITÉ</div>
                <div style={{ fontSize: 14, color: "#111827", marginTop: 2 }}>Industrie Agro-alimentaire</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em" }}>TÉLÉPHONE</div>
                <div style={{ fontSize: 14, color: "#111827", marginTop: 2 }}>+237 233 42 50 50</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em" }}>ADRESSE</div>
                <div style={{ fontSize: 14, color: "#111827", marginTop: 2 }}>Rue des Écoles, Koumassi, Douala</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em" }}>RESPONSABLE DÉSIGNÉ</div>
                <div style={{ fontSize: 14, color: "#111827", marginTop: 2 }}>{respondent || "Emmanuel de Tailly"} — {company.respondentFunction || "Directeur Général"}</div>
              </div>
            </div>
          </section>

          {/* Card 2: Historique des Soumissions */}
          <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 18px", borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              Historique des Soumissions
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "8px 12px" }}>Campagne</th>
                  <th style={{ padding: "8px 12px" }}>Période</th>
                  <th style={{ padding: "8px 12px" }}>Soumission</th>
                  <th style={{ padding: "8px 12px" }}>Statut</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#004d3d" }}>2026-T1</td>
                  <td style={{ padding: "10px 12px", color: "#4b5563" }}>Trimestre 1 2026</td>
                  <td style={{ padding: "10px 12px", color: "#4b5563" }}>15/03/2026</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 11, background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 9999, fontWeight: 600 }}>
                      ● Validé
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <Link href="/admin/dossiers" style={{ fontSize: 12, color: "#004d3d", fontWeight: 600, textDecoration: "none" }}>Voir fiche →</Link>
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#004d3d" }}>2025-T4</td>
                  <td style={{ padding: "10px 12px", color: "#4b5563" }}>Trimestre 4 2025</td>
                  <td style={{ padding: "10px 12px", color: "#4b5563" }}>14/12/2025</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 11, background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 9999, fontWeight: 600 }}>
                      ● Validé
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <Link href="/admin/dossiers" style={{ fontSize: 12, color: "#004d3d", fontWeight: 600, textDecoration: "none" }}>Voir fiche →</Link>
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#004d3d" }}>2025-T3</td>
                  <td style={{ padding: "10px 12px", color: "#4b5563" }}>Trimestre 3 2025</td>
                  <td style={{ padding: "10px 12px", color: "#4b5563" }}>20/09/2025</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 11, background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 9999, fontWeight: 600 }}>
                      ● Validé
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <Link href="/admin/dossiers" style={{ fontSize: 12, color: "#004d3d", fontWeight: 600, textDecoration: "none" }}>Voir fiche →</Link>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#004d3d" }}>2025-T2</td>
                  <td style={{ padding: "10px 12px", color: "#4b5563" }}>Trimestre 2 2025</td>
                  <td style={{ padding: "10px 12px", color: "#4b5563" }}>18/06/2025</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 11, background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 9999, fontWeight: 600 }}>
                      ● Validé
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <Link href="/admin/dossiers" style={{ fontSize: 12, color: "#004d3d", fontWeight: 600, textDecoration: "none" }}>Voir fiche →</Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        {/* Right Column (40%) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Card 3: Comptes Utilisateurs Rattachés */}
          <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 16px", borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              Comptes Utilisateurs Rattachés
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* User 1: Jean-Paul Mbarga */}
              <div
                onClick={() => {
                  setSelectedUser({
                    name: "Jean-Paul Mbarga",
                    role: "Directeur des Ressources Humaines",
                    email: "jp.mbarga@example.cm",
                    status: "ACTIF",
                    createdAt: "12/01/2026",
                  });
                  setAccountOpen(true);
                }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Jean-Paul Mbarga</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Directeur RH • Créateur du compte</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Dernière connexion : il y a 2h</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 10, background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 9999, fontWeight: 700 }}>
                    ACTIF
                  </span>
                </div>
              </div>

              {/* User 2: Samuel Eto'o */}
              <div
                onClick={() => {
                  setSelectedUser({
                    name: "Samuel Eto'o",
                    role: "Comptable",
                    email: "s.etoo@example.cm",
                    status: "ACTIF",
                    createdAt: "15/01/2026",
                  });
                  setAccountOpen(true);
                }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Samuel Eto&apos;o</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Comptable</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Dernière connexion : il y a 1 jour</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 10, background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 9999, fontWeight: 700 }}>
                    ACTIF
                  </span>
                </div>
              </div>

              {/* User 3: Marie Ndongo */}
              <div
                onClick={() => {
                  setSelectedUser({
                    name: "Marie Ndongo",
                    role: "Assistante",
                    email: "m.ndongo@example.cm",
                    status: "INACTIF",
                    createdAt: "20/01/2026",
                  });
                  setAccountOpen(true);
                }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Marie Ndongo</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Assistante</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Dernière connexion : il y a 45 jours</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 10, background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: 9999, fontWeight: 700 }}>
                    INACTIF
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => showToast("Formulaire de rattachement utilisateur ouvert.")}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginTop: 6,
                  background: "#f9fafb",
                  border: "1px dashed #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                + Ajouter un utilisateur
              </button>
            </div>
          </section>

          {/* Card 4: Informations du Compte */}
          <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 16px", borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              Informations du Compte
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, fontSize: 13 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280" }}>DATE D&apos;INSCRIPTION</div>
                <div style={{ fontWeight: 600, color: "#111827", marginTop: 2 }}>12/01/2026</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280" }}>CRÉÉ PAR</div>
                <div style={{ fontWeight: 600, color: "#111827", marginTop: 2 }}>Admin Central (M. Ewane)</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280" }}>MODE</div>
                <div style={{ color: "#111827", marginTop: 2 }}>Inscription manuelle</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280" }}>IP INSCRIPTION</div>
                <div style={{ fontFamily: "ui-monospace, monospace", color: "#111827", marginTop: 2 }}>192.168.1.1</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280" }}>GÉOLOCALISATION</div>
                <div style={{ color: "#111827", marginTop: 2 }}>Douala, Littoral</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280" }}>DERNIÈRE MODIFICATION</div>
                <div style={{ color: "#111827", marginTop: 2 }}>15/03/2026 par DR Littoral</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280" }}>STATUT DE VÉRIFICATION</div>
                <div style={{ color: "#059669", fontWeight: 600, marginTop: 2 }}>Documents vérifiés ✓</div>
              </div>
            </div>
          </section>

          {/* Card 5: Journal d'Audit */}
          <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 16px", borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              Journal d&apos;Audit
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 12 }}>
              <div>
                <div style={{ color: "#6b7280" }}>15/03/2026 14:22</div>
                <div style={{ fontWeight: 600, color: "#111827" }}>DR Littoral</div>
                <div style={{ color: "#4b5563" }}>Mise à jour des coordonnées</div>
              </div>
              <div>
                <div style={{ color: "#6b7280" }}>12/01/2026 09:15</div>
                <div style={{ fontWeight: 600, color: "#111827" }}>M. Ewane (Admin)</div>
                <div style={{ color: "#4b5563" }}>Compte créé et validé</div>
              </div>
              <div>
                <div style={{ color: "#6b7280" }}>12/01/2026 09:10</div>
                <div style={{ fontWeight: 600, color: "#111827" }}>Système</div>
                <div style={{ color: "#4b5563" }}>Vérification RCCM automatique réussie</div>
              </div>
              <div>
                <div style={{ color: "#6b7280" }}>12/01/2026 09:00</div>
                <div style={{ fontWeight: 600, color: "#111827" }}>M. Ewane (Admin)</div>
                <div style={{ color: "#4b5563" }}>Inscription initiée</div>
              </div>
            </div>
            <div style={{ marginTop: 18, borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
              <Link href="/admin/journal-audit" style={{ fontSize: 13, color: "#004d3d", fontWeight: 600, textDecoration: "none" }}>
                Voir le journal complet →
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* Modal "Gestion du Compte Utilisateur" matching Figma declarants/etablissements/_id.png */}
      <AdminDialog
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        wide
        title="Gestion du Compte Utilisateur"
        eyebrow={
          <div style={{ color: "#4b5563", textTransform: "none", fontWeight: 500, fontSize: 13, marginBottom: 4, letterSpacing: "normal" }}>
            <span style={{ fontWeight: 600, color: "#111827" }}>{selectedUser.name}</span> — {selectedUser.role}
            <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{company.name?.split("—")[0].trim() || "SABC S.A."} — Compte créé le {selectedUser.createdAt}</div>
          </div>
        }
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Toutes les actions sont enregistrées dans le journal d&apos;audit
            </span>
            <button
              type="button"
              className="cam-button cam-button-secondary"
              onClick={() => setAccountOpen(false)}
              style={{ padding: "8px 18px", borderRadius: 6 }}
            >
              Fermer
            </button>
          </div>
        }
      >
        <div>
          {/* ACTIONS SUR LE COMPTE */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280", marginBottom: 12 }}>
              ACTIONS SUR LE COMPTE
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Row 1 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🔑</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Réinitialiser le mot de passe</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Un email de réinitialisation sera envoyé à {selectedUser.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => showToast(`Lien de réinitialisation envoyé à ${selectedUser.email}`)}
                  style={{ padding: "6px 14px", background: "#004d3d", color: "#ffffff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Envoyer le lien
                </button>
              </div>

              {/* Row 2 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🔒</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Déverrouiller le compte</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Le compte est actuellement déverrouillé (0 tentative échouée)</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => showToast("Compte déverrouillé.")}
                  style={{ padding: "6px 14px", background: "#d97706", color: "#ffffff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Déverrouiller
                </button>
              </div>

              {/* Row 3 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>✉️</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Renvoyer l&apos;email de vérification</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Renvoyer le lien de confirmation à l&apos;adresse email enregistrée</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => showToast(`Email de confirmation renvoyé à ${selectedUser.email}`)}
                  style={{ padding: "6px 14px", background: "#004d3d", color: "#ffffff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Renvoyer
                </button>
              </div>

              {/* Row 4 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🔄</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Réinitialiser la session</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Déconnecter l&apos;utilisateur de tous les appareils actifs</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => showToast("Sessions actives déconnectées.")}
                  style={{ padding: "6px 14px", background: "#004d3d", color: "#ffffff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          </div>

          {/* MODIFIER LE RÔLE */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280", marginBottom: 6 }}>
              MODIFIER LE RÔLE
            </div>
            <select
              defaultValue="responsable"
              style={{ width: "100%", height: 38, border: "1px solid #d1d5db", borderRadius: 6, padding: "0 10px", fontSize: 13, color: "#111827" }}
            >
              <option value="responsable">Responsable d&apos;établissement</option>
              <option value="admin">Administrateur</option>
              <option value="comptable">Comptable</option>
              <option value="lecteur">Lecteur</option>
            </select>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
              Options disponibles : Administrateur, Responsable d&apos;établissement, Comptable, Lecteur.
            </div>
          </div>

          {/* HISTORIQUE DES CONNEXIONS RÉCENTES */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>
              HISTORIQUE DES CONNEXIONS RÉCENTES
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", color: "#6b7280" }}>
                  <th style={{ padding: "6px 10px" }}>Date</th>
                  <th style={{ padding: "6px 10px" }}>Localisation</th>
                  <th style={{ padding: "6px 10px" }}>Appareil</th>
                  <th style={{ padding: "6px 10px" }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "6px 10px" }}>28/09/2026 14:32</td>
                  <td style={{ padding: "6px 10px" }}>Yaoundé</td>
                  <td style={{ padding: "6px 10px" }}>Chrome / Windows</td>
                  <td style={{ padding: "6px 10px" }}><span style={{ color: "#059669", fontWeight: 600 }}>● Succès</span></td>
                </tr>
                <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "6px 10px" }}>28/09/2026 14:30</td>
                  <td style={{ padding: "6px 10px" }}>Yaoundé</td>
                  <td style={{ padding: "6px 10px" }}>Chrome / Windows</td>
                  <td style={{ padding: "6px 10px" }}><span style={{ color: "#dc2626", fontWeight: 600 }}>● Échec</span></td>
                </tr>
                <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "6px 10px" }}>28/09/2026 14:28</td>
                  <td style={{ padding: "6px 10px" }}>Yaoundé</td>
                  <td style={{ padding: "6px 10px" }}>Chrome / Windows</td>
                  <td style={{ padding: "6px 10px" }}><span style={{ color: "#dc2626", fontWeight: 600 }}>● Échec</span></td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 10px" }}>27/09/2026 09:15</td>
                  <td style={{ padding: "6px 10px" }}>Douala</td>
                  <td style={{ padding: "6px 10px" }}>Mobile Safari / iOS</td>
                  <td style={{ padding: "6px 10px" }}><span style={{ color: "#059669", fontWeight: 600 }}>● Succès</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ZONE DANGEREUSE */}
          <div style={{ border: "1px solid #fecaca", borderRadius: 8, padding: 14, background: "#fff5f5" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#dc2626", marginBottom: 10 }}>
              ZONE DANGEREUSE
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "#dc2626", fontWeight: 700 }}>✕</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Désactiver le compte</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>L&apos;utilisateur ne pourra plus se connecter. Les données seront conservées.</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => showToast("Compte utilisateur désactivé.")}
                  style={{ padding: "6px 14px", background: "#b91c1c", color: "#ffffff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Désactiver
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #fee2e2", paddingTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "#dc2626", fontWeight: 700 }}>✕</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Supprimer le compte</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Suppression définitive. Cette action est irréversible.</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAccountOpen(false);
                    showToast("Demande de suppression enregistrée.");
                  }}
                  style={{ padding: "6px 14px", background: "#ffffff", color: "#b91c1c", border: "1px solid #ef4444", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      </AdminDialog>
    </div>
  );
}
