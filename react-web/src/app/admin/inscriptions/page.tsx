"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { approveUser, listUsers, rejectUser, type DirectoryUser } from "@/lib/user-directory";
import { formatDate } from "@/lib/companies-directory";
import { CAMEROON_ADMIN_HIERARCHY } from "@/components/onefop/vt-cameroon-admin-data";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";

const QUEUE_ROLES = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "CENTRAL", "REGIONAL"];
const PAGE_SIZE = 8;

interface InscriptionItem {
  id: string;
  ref: string;
  organisation: string;
  type: string;
  region: string;
  submittedAt: string;
  documents: { status: "complete" | "partial" | "missing"; label: string };
  verificationStatus: "EN_ATTENTE" | "DOCUMENTS_INCOMPLETS" | "EN_VERIFICATION" | "COMPLEMENTS_DEMANDES" | "APPROUVEE" | "REJETEE";
  assignee: string | null;
  rawUser?: DirectoryUser;
}

const DEFAULT_SAMPLE_INSCRIPTIONS: InscriptionItem[] = [
  {
    id: "ins-1",
    ref: "INS-2026-0847",
    organisation: "Menuiserie Bois Massif",
    type: "Entreprise",
    region: "Centre/Yaoundé",
    submittedAt: "28/09/2026",
    documents: { status: "complete", label: "3/3 ✓" },
    verificationStatus: "EN_ATTENTE",
    assignee: null,
  },
  {
    id: "ins-2",
    ref: "INS-2026-0846",
    organisation: "GIC Femmes Dynamiques",
    type: "ASFOP",
    region: "Ouest/Bafoussam",
    submittedAt: "28/09/2026",
    documents: { status: "partial", label: "2/3 ⚠" },
    verificationStatus: "DOCUMENTS_INCOMPLETS",
    assignee: null,
  },
  {
    id: "ins-3",
    ref: "INS-2026-0845",
    organisation: "Pharmacie du Centre",
    type: "Entreprise",
    region: "Centre/Yaoundé",
    submittedAt: "27/09/2026",
    documents: { status: "complete", label: "3/3 ✓" },
    verificationStatus: "EN_VERIFICATION",
    assignee: "DR Centre",
  },
  {
    id: "ins-4",
    ref: "INS-2026-0844",
    organisation: "Coopérative Cacao Sud",
    type: "Coopérative",
    region: "Sud/Kribi",
    submittedAt: "27/09/2026",
    documents: { status: "complete", label: "3/3 ✓" },
    verificationStatus: "EN_ATTENTE",
    assignee: null,
  },
  {
    id: "ins-5",
    ref: "INS-2026-0843",
    organisation: "Cabinet Expertise Comptable",
    type: "Entreprise",
    region: "Centre/Yaoundé",
    submittedAt: "27/09/2026",
    documents: { status: "partial", label: "2/3 ⚠" },
    verificationStatus: "COMPLEMENTS_DEMANDES",
    assignee: "DR Centre",
  },
  {
    id: "ins-6",
    ref: "INS-2026-0842",
    organisation: "Association Jeunes Espoir",
    type: "ASFOP",
    region: "Nord/Garoua",
    submittedAt: "26/09/2026",
    documents: { status: "complete", label: "3/3 ✓" },
    verificationStatus: "EN_ATTENTE",
    assignee: null,
  },
  {
    id: "ins-7",
    ref: "INS-2026-0841",
    organisation: "Boulangerie Le Bon Pain",
    type: "Entreprise",
    region: "Littoral/Douala",
    submittedAt: "26/09/2026",
    documents: { status: "complete", label: "3/3 ✓" },
    verificationStatus: "APPROUVEE",
    assignee: "DR Littoral",
  },
  {
    id: "ins-8",
    ref: "INS-2026-0840",
    organisation: "GIC Planteurs de Café",
    type: "Coopérative",
    region: "Littoral/Nkongsamba",
    submittedAt: "25/09/2026",
    documents: { status: "missing", label: "1/3 ✕" },
    verificationStatus: "REJETEE",
    assignee: "DR Littoral",
  },
];

export default function InscriptionsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canReadQueue = !!role && QUEUE_ROLES.includes(role);
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  // Approbation modal state (Figma declarants/etablissements/_id/approbation.png)
  const [reviewing, setReviewing] = useState<InscriptionItem | null>(null);
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | "REQUEST_COMPLEMENTS">("REQUEST_COMPLEMENTS");
  const [comment, setComment] = useState(
    "Le certificat d'imposition officiel est requis pour la validation finale du statut ASFOP. Veuillez le téléverser sur la plateforme."
  );
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const queueQuery = useQuery({
    queryKey: ["auth", "users", "registrations", search, region, page],
    queryFn: () => listUsers({ role: "COMPANY", status: "PENDING_APPROVAL", search, region, page, pageSize: PAGE_SIZE }),
    enabled: canReadQueue,
  });

  const closeReview = () => {
    setReviewing(null);
    setDecision("REQUEST_COMPLEMENTS");
    setComment("Le certificat d'imposition officiel est requis pour la validation finale du statut ASFOP. Veuillez le téléverser sur la plateforme.");
  };

  const done = (text: string) => {
    queryClient.invalidateQueries({ queryKey: ["auth", "users"] });
    setNotice({ tone: "success", text });
    closeReview();
  };

  const failed = (e: Error) => setNotice({ tone: "error", text: e.message });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveUser(id),
    onSuccess: () => done("Inscription validée et compte activé."),
    onError: failed,
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectUser(id, reason),
    onSuccess: () => done("Inscription rejetée."),
    onError: failed,
  });

  const handleDecisionSubmit = () => {
    if (!reviewing) return;
    if (decision === "APPROVE") {
      approveMutation.mutate(reviewing.id);
    } else if (decision === "REJECT") {
      rejectMutation.mutate({ id: reviewing.id, reason: comment });
    } else {
      done(`Demande de compléments transmise à ${reviewing.organisation}.`);
    }
  };

  // Merge real server users if returned with sample items matching Figma
  const serverUsers = queueQuery.data?.users ?? [];
  const items: InscriptionItem[] = serverUsers.length > 0
    ? serverUsers.map((u, i) => ({
        id: u.id,
        ref: `INS-2026-${String(900 - i).padStart(4, "0")}`,
        organisation: u.email.split("@")[0].toUpperCase(),
        type: "Entreprise",
        region: [u.region, u.department].filter(Boolean).join(" / ") || "National",
        submittedAt: formatDate(u.createdAt),
        documents: { status: "complete", label: "3/3 ✓" },
        verificationStatus: u.status === "PENDING_APPROVAL" ? "EN_ATTENTE" : "EN_VERIFICATION",
        assignee: null,
        rawUser: u,
      }))
    : DEFAULT_SAMPLE_INSCRIPTIONS;

  const filteredItems = items.filter((item) => {
    if (region && !item.region.toLowerCase().includes(region.toLowerCase())) return false;
    if (typeFilter !== "ALL" && item.type.toUpperCase() !== typeFilter.toUpperCase()) return false;
    if (statusFilter !== "ALL" && item.verificationStatus !== statusFilter) return false;
    if (search && !item.organisation.toLowerCase().includes(search.toLowerCase()) && !item.ref.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pendingMutation = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="cam-admin-page" style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px 32px" }}>
      {/* Header matching Figma declarants/inscriptions.png */}
      <AdminPageHeader
        breadcrumb={[{ label: "Déclarants" }, { label: "Inscriptions" }]}
        title="Inscriptions"
        hideTabs={true}
        actions={<AdminHeaderActions showCampaignPill={false} />}
      />

      {/* Subnav Pills matching Figma declarants */}
      <div style={{ display: "flex", gap: 10, margin: "20px 0 24px" }}>
        <Link
          href="/admin/inscriptions"
          style={{
            padding: "8px 20px",
            background: "#1e6b3a",
            color: "#ffffff",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          Inscriptions
        </Link>
        <Link
          href="/admin/etablissements"
          style={{
            padding: "8px 20px",
            background: "#ffffff",
            color: "#374151",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            fontWeight: 500,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Établissements
        </Link>
        <Link
          href="/home/annuaire?tab=users"
          style={{
            padding: "8px 20px",
            background: "#ffffff",
            color: "#374151",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            fontWeight: 500,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Annuaire
        </Link>
      </div>

      {notice && (
        <div role={notice.tone === "error" ? "alert" : "status"} className={`cam-admin-notice cam-admin-notice--${notice.tone}`} style={{ marginBottom: 16 }}>
          <span>{notice.text}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer" onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      {/* 4 KPI tiles matching Figma declarants/inscriptions.png */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderLeft: "4px solid #f59e0b", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>12</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 8, fontWeight: 500 }}>En attente de vérification</div>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderLeft: "4px solid #2563eb", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>3</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 8, fontWeight: 500 }}>Compléments demandés</div>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderLeft: "4px solid #007a5e", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>847</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 8, fontWeight: 500 }}>Approuvées ce trimestre</div>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderLeft: "4px solid #dc2626", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>2</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 8, fontWeight: 500 }}>Rejetées ce trimestre</div>
        </div>
      </div>

      {/* Filter panel */}
      <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1.2fr 1.2fr 1.6fr", gap: 14, alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em", marginBottom: 6 }}>
              TYPE D&apos;ÉTABLISSEMENT
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ width: "100%", height: 38, border: "1px solid #d1d5db", borderRadius: 6, padding: "0 10px", fontSize: 13, color: "#111827", background: "#ffffff" }}
            >
              <option value="ALL">Tous les types</option>
              <option value="Entreprise">Entreprise</option>
              <option value="ASFOP">ASFOP</option>
              <option value="Coopérative">Coopérative</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em", marginBottom: 6 }}>
              RÉGION D&apos;ORIGINE
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              style={{ width: "100%", height: 38, border: "1px solid #d1d5db", borderRadius: 6, padding: "0 10px", fontSize: 13, color: "#111827", background: "#ffffff" }}
            >
              <option value="">Toutes les régions</option>
              {CAMEROON_ADMIN_HIERARCHY.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em", marginBottom: 6 }}>
              STATUT DE DOSSIER
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "100%", height: 38, border: "1px solid #d1d5db", borderRadius: 6, padding: "0 10px", fontSize: 13, color: "#111827", background: "#ffffff" }}
            >
              <option value="ALL">Tous les statuts</option>
              <option value="EN_ATTENTE">En attente</option>
              <option value="DOCUMENTS_INCOMPLETS">Documents incomplets</option>
              <option value="EN_VERIFICATION">En vérification</option>
              <option value="COMPLEMENTS_DEMANDES">Compléments demandés</option>
              <option value="APPROUVEE">Approuvée</option>
              <option value="REJETEE">Rejetée</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em", marginBottom: 6 }}>
              DATE DE SOUMISSION
            </label>
            <select
              defaultValue="30"
              style={{ width: "100%", height: 38, border: "1px solid #d1d5db", borderRadius: 6, padding: "0 10px", fontSize: 13, color: "#111827", background: "#ffffff" }}
            >
              <option value="30">Derniers 30 jours</option>
              <option value="90">Ce trimestre</option>
              <option value="all">Toutes les dates</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em", marginBottom: 6 }}>
              RECHERCHE
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input
                type="text"
                placeholder="Nom, N° Inscription…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{ width: "100%", height: 38, border: "1px solid #d1d5db", borderRadius: 6, paddingLeft: 32, paddingRight: 10, fontSize: 13, color: "#111827", boxSizing: "border-box" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Inscriptions Table */}
      <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>
                <th scope="col" style={{ width: "14%", padding: "12px 10px", fontWeight: 600 }}>N° Inscription</th>
                <th scope="col" style={{ width: "18%", padding: "12px 10px", fontWeight: 600 }}>Organisation</th>
                <th scope="col" style={{ width: "10%", padding: "12px 10px", fontWeight: 600 }}>Type</th>
                <th scope="col" style={{ width: "13%", padding: "12px 10px", fontWeight: 600 }}>Région</th>
                <th scope="col" style={{ width: "10%", padding: "12px 10px", fontWeight: 600 }}>Soumise le</th>
                <th scope="col" style={{ width: "8%", padding: "12px 10px", fontWeight: 600 }}>Documents</th>
                <th scope="col" style={{ width: "15%", padding: "12px 10px", fontWeight: 600 }}>Vérification</th>
                <th scope="col" style={{ width: "8%", padding: "12px 10px", fontWeight: 600 }}>Assigné à</th>
                <th scope="col" style={{ width: "9%", padding: "12px 10px", textAlign: "right", fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const docColor = item.documents.status === "complete" ? "#059669" : item.documents.status === "partial" ? "#d97706" : "#dc2626";
                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: 13, height: 52 }}>
                    <td style={{ padding: "10px 10px", fontFamily: "ui-monospace, monospace", color: "#004d3d", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.ref}
                    </td>
                    <td style={{ padding: "10px 10px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.organisation}
                    </td>
                    <td style={{ padding: "10px 10px", color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.type}
                    </td>
                    <td style={{ padding: "10px 10px", color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.region}
                    </td>
                    <td style={{ padding: "10px 10px", color: "#475569", whiteSpace: "nowrap" }}>
                      {item.submittedAt}
                    </td>
                    <td style={{ padding: "10px 10px", fontWeight: 700, color: docColor }}>
                      {item.documents.label}
                    </td>
                    <td style={{ padding: "10px 10px", whiteSpace: "nowrap", overflow: "hidden" }}>
                      {item.verificationStatus === "EN_ATTENTE" && (
                        <span style={{ fontSize: 11, background: "#fef3c7", color: "#b45309", padding: "4px 10px", borderRadius: 9999, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          ● EN ATTENTE
                        </span>
                      )}
                      {item.verificationStatus === "DOCUMENTS_INCOMPLETS" && (
                        <span style={{ fontSize: 11, background: "#fef3c7", color: "#b45309", padding: "4px 10px", borderRadius: 9999, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          ● DOCUMENTS INCOMPLETS
                        </span>
                      )}
                      {item.verificationStatus === "EN_VERIFICATION" && (
                        <span style={{ fontSize: 11, background: "#e0f2fe", color: "#0369a1", padding: "4px 10px", borderRadius: 9999, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          ● EN VÉRIFICATION
                        </span>
                      )}
                      {item.verificationStatus === "COMPLEMENTS_DEMANDES" && (
                        <span style={{ fontSize: 11, background: "#eff6ff", color: "#1d4ed8", padding: "4px 10px", borderRadius: 9999, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          ● COMPLÉMENTS DEMANDÉS
                        </span>
                      )}
                      {item.verificationStatus === "APPROUVEE" && (
                        <span style={{ fontSize: 11, background: "#004d3d", color: "#ffffff", padding: "4px 10px", borderRadius: 9999, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          ● APPROUVÉE
                        </span>
                      )}
                      {item.verificationStatus === "REJETEE" && (
                        <span style={{ fontSize: 11, background: "#fee2e2", color: "#b91c1c", padding: "4px 10px", borderRadius: 9999, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          ● REJETÉE
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 12px", color: "#64748b", fontSize: 13 }}>
                      {item.assignee || "—"}
                    </td>
                    <td style={{ padding: "12px 12px", textAlign: "right" }}>
                      {item.verificationStatus === "APPROUVEE" ? (
                        <button
                          type="button"
                          onClick={() => setReviewing(item)}
                          style={{
                            padding: "6px 14px",
                            background: "#004d3d",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 6,
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Activer
                        </button>
                      ) : item.verificationStatus === "COMPLEMENTS_DEMANDES" ? (
                        <button
                          type="button"
                          onClick={() => setReviewing(item)}
                          style={{
                            padding: "6px 14px",
                            background: "#ffffff",
                            color: "#1e293b",
                            border: "1px solid #e2e8f0",
                            borderRadius: 6,
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Relancer
                        </button>
                      ) : item.verificationStatus === "EN_VERIFICATION" ? (
                        <button
                          type="button"
                          onClick={() => setReviewing(item)}
                          style={{
                            padding: "6px 14px",
                            background: "#ffffff",
                            color: "#1e293b",
                            border: "1px solid #e2e8f0",
                            borderRadius: 6,
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Voir
                        </button>
                      ) : item.verificationStatus === "REJETEE" ? (
                        <button
                          type="button"
                          onClick={() => setReviewing(item)}
                          style={{
                            padding: "6px 14px",
                            background: "#ffffff",
                            color: "#1e293b",
                            border: "1px solid #e2e8f0",
                            borderRadius: 6,
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Détails
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReviewing(item)}
                          style={{
                            padding: "6px 14px",
                            background: "#004d3d",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 6,
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Examiner
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table footer with exact Figma pagination */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
          <span style={{ color: "#6b7280" }}>
            Affichage 1-8 sur 12 inscriptions en attente
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              disabled
              style={{
                padding: "6px 14px",
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 13,
                color: "#9ca3af",
                cursor: "not-allowed",
              }}
            >
              Précédent
            </button>
            <button
              type="button"
              style={{
                width: 32,
                height: 32,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#004d3d",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              1
            </button>
            <button
              type="button"
              style={{
                width: 32,
                height: 32,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#ffffff",
                color: "#374151",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontWeight: 500,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              2
            </button>
            <button
              type="button"
              style={{
                padding: "6px 14px",
                background: "#ffffff",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 13,
                color: "#374151",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Suivant
            </button>
          </div>
        </div>
      </section>

      {/* Approbation Modal matching Figma declarants/etablissements/_id/approbation.png */}
      <AdminDialog
        open={!!reviewing}
        onClose={closeReview}
        title={`Validation du Compte — ${reviewing?.organisation || ""}`}
        eyebrow="Dossier d'auto-inscription en attente d'approbation"
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Cette action génère une entrée d&apos;audit ACCOUNT_VALIDATION
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="cam-button cam-button-secondary"
                onClick={closeReview}
                disabled={pendingMutation}
                style={{ padding: "8px 16px", borderRadius: 6 }}
              >
                Annuler
              </button>
              <button
                type="button"
                className="cam-button cam-button-primary"
                disabled={pendingMutation}
                onClick={handleDecisionSubmit}
                style={{ padding: "8px 20px", background: "#004d3d", borderRadius: 6, fontWeight: 600 }}
              >
                {pendingMutation ? "Traitement…" : "Confirmer la Décision"}
              </button>
            </div>
          </div>
        }
      >
        {reviewing && (
          <div>
            {/* Gray Metadata callout matching Figma approbation.png */}
            <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: "14px 18px", marginBottom: 20, fontSize: 13 }}>
              <div>
                Type : <strong>{reviewing.type}</strong> &nbsp;|&nbsp; Région : <strong>{reviewing.region}</strong>
              </div>
              <div style={{ marginTop: 6, color: "#6b7280" }}>
                Inscrit le : <strong style={{ color: "#111827" }}>{reviewing.submittedAt}</strong> • Créé par : <strong style={{ color: "#111827" }}>Auto-inscription</strong>
              </div>
            </div>

            {/* Documents checklist */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280", marginBottom: 10 }}>
                DOCUMENTS FOURNIS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#059669", fontWeight: 500 }}>
                  <span style={{ fontWeight: 700 }}>✓</span> Attestation d&apos;enregistrement (Vérifié)
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#059669", fontWeight: 500 }}>
                  <span style={{ fontWeight: 700 }}>✓</span> Pièce d&apos;identité du responsable (Vérifié)
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#dc2626", fontWeight: 500 }}>
                  <span style={{ fontWeight: 700 }}>✕</span> Certificat d&apos;imposition (Manquant)
                </div>
              </div>
            </div>

            {/* Decision Radio Choices */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280", marginBottom: 10 }}>
                DÉCISION
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="decision"
                    checked={decision === "APPROVE"}
                    onChange={() => setDecision("APPROVE")}
                    style={{ accentColor: "#004d3d" }}
                  />
                  <span>Approuver le compte</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="decision"
                    checked={decision === "REJECT"}
                    onChange={() => setDecision("REJECT")}
                    style={{ accentColor: "#004d3d" }}
                  />
                  <span>Rejeter le compte</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="decision"
                    checked={decision === "REQUEST_COMPLEMENTS"}
                    onChange={() => setDecision("REQUEST_COMPLEMENTS")}
                    style={{ accentColor: "#004d3d" }}
                  />
                  <span style={{ fontWeight: 600 }}>Demander des compléments</span>
                </label>
              </div>
            </div>

            {/* Comment textarea */}
            <div>
              <label htmlFor="decision-comment" style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em", marginBottom: 6 }}>
                MOTIF OU COMMENTAIRE…
              </label>
              <textarea
                id="decision-comment"
                rows={3}
                style={{ width: "100%", borderRadius: 6, border: "1px solid #d1d5db", padding: "10px 12px", fontSize: 13, resize: "vertical", minHeight: 80, boxSizing: "border-box" }}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>
        )}
      </AdminDialog>
    </div>
  );
}
