"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { approveUser, listUsers, rejectUser, type DirectoryUser } from "@/lib/user-directory";
import { formatDate } from "@/lib/companies-directory";
import { CAMEROON_ADMIN_HIERARCHY } from "@/components/onefop/vt-cameroon-admin-data";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { KpiTile } from "@/components/admin/KpiTile";

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
    organisation: "Menuiserie Bois & Déco Sarl",
    type: "Entreprise",
    region: "Centre / Yaoundé",
    submittedAt: "28/09/2026",
    documents: { status: "complete", label: "3/3 ✓" },
    verificationStatus: "EN_ATTENTE",
    assignee: null,
  },
  {
    id: "ins-2",
    ref: "INS-2026-0846",
    organisation: "GIC Femmes Dynamiques de l'Ouest",
    type: "ASFOP",
    region: "Ouest / Bafoussam",
    submittedAt: "28/09/2026",
    documents: { status: "partial", label: "2/3 ⚠" },
    verificationStatus: "DOCUMENTS_INCOMPLETS",
    assignee: null,
  },
  {
    id: "ins-3",
    ref: "INS-2026-0845",
    organisation: "Pharmacie du Centre Mbalmayo",
    type: "Entreprise",
    region: "Centre / Yaoundé",
    submittedAt: "27/09/2026",
    documents: { status: "complete", label: "3/3 ✓" },
    verificationStatus: "EN_VERIFICATION",
    assignee: "DR Centre",
  },
  {
    id: "ins-4",
    ref: "INS-2026-0844",
    organisation: "Coopérative Cacaoyère du Sud",
    type: "Coopérative",
    region: "Sud / Kribi",
    submittedAt: "27/09/2026",
    documents: { status: "complete", label: "3/3 ✓" },
    verificationStatus: "EN_ATTENTE",
    assignee: null,
  },
  {
    id: "ins-5",
    ref: "INS-2026-0843",
    organisation: "Cabinet Expertise Comptable & Audit",
    type: "Entreprise",
    region: "Centre / Yaoundé",
    submittedAt: "27/09/2026",
    documents: { status: "partial", label: "2/3 ⚠" },
    verificationStatus: "COMPLEMENTS_DEMANDES",
    assignee: "DR Centre",
  },
  {
    id: "ins-6",
    ref: "INS-2026-0842",
    organisation: "Association Jeunesse & Progrès Nord",
    type: "ASFOP",
    region: "Nord / Garoua",
    submittedAt: "26/09/2026",
    documents: { status: "complete", label: "3/3 ✓" },
    verificationStatus: "EN_ATTENTE",
    assignee: null,
  },
  {
    id: "ins-7",
    ref: "INS-2026-0841",
    organisation: "Boulangerie Le Pain d'Or",
    type: "Entreprise",
    region: "Littoral / Douala",
    submittedAt: "26/09/2026",
    documents: { status: "complete", label: "3/3 ✓" },
    verificationStatus: "APPROUVEE",
    assignee: "DR Littoral",
  },
  {
    id: "ins-8",
    ref: "INS-2026-0840",
    organisation: "GIC Planteurs de Café du Moungo",
    type: "Coopérative",
    region: "Littoral / Nkongsamba",
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
    "Le certificat d'imposition officiel est requis pour la validation finale du statut. Veuillez le téléverser sur la plateforme."
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
    setComment("Le certificat d'imposition officiel est requis pour la validation finale du statut. Veuillez le téléverser sur la plateforme.");
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
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Déclarants" }, { label: "Inscriptions" }]}
        title="File d'attente des inscriptions"
        subtitle="Validation des dossiers d'auto-inscription des établissements et centres"
        actions={<AdminHeaderActions />}
      />

      {notice && (
        <div role={notice.tone === "error" ? "alert" : "status"} className={`cam-admin-notice cam-admin-notice--${notice.tone}`}>
          <span>{notice.text}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer" onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      {/* 4 KPI tiles matching Figma declarants/inscriptions.png */}
      <div className="cam-dash-kpis">
        <KpiTile tone="warning" label="En attente de vérification" value={12} />
        <KpiTile tone="info" label="Compléments demandés" value={3} />
        <KpiTile tone="info" label="Approuvées ce trimestre" value={847} />
        <KpiTile tone="error" label="Rejetées ce trimestre" value={2} />
      </div>

      {/* Filter panel */}
      <section className="cam-dash-card" style={{ padding: "var(--cam-space-4)", marginTop: "var(--cam-space-4)", marginBottom: "var(--cam-space-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "flex-end" }}>
          <div>
            <label className="cam-admin-label" style={{ fontSize: 11, fontWeight: 600 }}>TYPE D&apos;ÉTABLISSEMENT</label>
            <select className="cam-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: "100%", marginTop: 4 }}>
              <option value="ALL">Tous les types</option>
              <option value="Entreprise">Entreprise</option>
              <option value="ASFOP">ASFOP</option>
              <option value="Coopérative">Coopérative</option>
            </select>
          </div>

          <div>
            <label className="cam-admin-label" style={{ fontSize: 11, fontWeight: 600 }}>RÉGION D&apos;ORIGINE</label>
            <select className="cam-input" value={region} onChange={(e) => setRegion(e.target.value)} style={{ width: "100%", marginTop: 4 }}>
              <option value="">Toutes les régions</option>
              {CAMEROON_ADMIN_HIERARCHY.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
          </div>

          <div>
            <label className="cam-admin-label" style={{ fontSize: 11, fontWeight: 600 }}>STATUT DE DOSSIER</label>
            <select className="cam-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: "100%", marginTop: 4 }}>
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
            <label className="cam-admin-label" style={{ fontSize: 11, fontWeight: 600 }}>DATE DE SOUMISSION</label>
            <select className="cam-input" defaultValue="30" style={{ width: "100%", marginTop: 4 }}>
              <option value="30">Derniers 30 jours</option>
              <option value="90">Ce trimestre</option>
              <option value="all">Toutes les dates</option>
            </select>
          </div>

          <div>
            <label className="cam-admin-label" style={{ fontSize: 11, fontWeight: 600 }}>RECHERCHE</label>
            <input
              type="text"
              className="cam-input"
              placeholder="Nom, N° Inscription…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ width: "100%", marginTop: 4 }}
            />
          </div>
        </div>
      </section>

      {/* Inscriptions Table */}
      <section className="cam-dash-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="cam-dash-table-wrap">
          <table className="cam-dash-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.02)", borderBottom: "1px solid var(--cam-border)", textAlign: "left", fontSize: 12, color: "var(--cam-text-muted)" }}>
                <th scope="col" style={{ padding: "10px 14px" }}>N° Inscription</th>
                <th scope="col" style={{ padding: "10px 14px" }}>Organisation</th>
                <th scope="col" style={{ padding: "10px 14px" }}>Type</th>
                <th scope="col" style={{ padding: "10px 14px" }}>Région</th>
                <th scope="col" style={{ padding: "10px 14px" }}>Soumise le</th>
                <th scope="col" style={{ padding: "10px 14px" }}>Documents</th>
                <th scope="col" style={{ padding: "10px 14px" }}>Vérification</th>
                <th scope="col" style={{ padding: "10px 14px" }}>Assigné à</th>
                <th scope="col" style={{ padding: "10px 14px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const docColor = item.documents.status === "complete" ? "var(--cam-green)" : item.documents.status === "partial" ? "#b8860b" : "var(--cam-error)";
                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid var(--cam-border-subtle, rgba(0,0,0,0.04))", fontSize: 13 }}>
                    <td style={{ padding: "12px 14px", fontFamily: "monospace", color: "var(--cam-green-dark)", fontWeight: 700 }}>
                      {item.ref}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--cam-text)" }}>
                      {item.organisation}
                    </td>
                    <td style={{ padding: "12px 14px", color: "var(--cam-text-muted)" }}>
                      {item.type}
                    </td>
                    <td style={{ padding: "12px 14px", color: "var(--cam-text-muted)" }}>
                      {item.region}
                    </td>
                    <td style={{ padding: "12px 14px", color: "var(--cam-text-muted)" }}>
                      {item.submittedAt}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: docColor }}>
                      {item.documents.label}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {item.verificationStatus === "EN_ATTENTE" && (
                        <span style={{ fontSize: 11, background: "#fef3c7", color: "#b45309", padding: "3px 8px", borderRadius: 12, fontWeight: 600 }}>
                          ● EN ATTENTE
                        </span>
                      )}
                      {item.verificationStatus === "DOCUMENTS_INCOMPLETS" && (
                        <span style={{ fontSize: 11, background: "#ffedd5", color: "#c2410c", padding: "3px 8px", borderRadius: 12, fontWeight: 600 }}>
                          ● DOCUMENTS INCOMPLETS
                        </span>
                      )}
                      {item.verificationStatus === "EN_VERIFICATION" && (
                        <span style={{ fontSize: 11, background: "#e0f2fe", color: "#0369a1", padding: "3px 8px", borderRadius: 12, fontWeight: 600 }}>
                          ● EN VÉRIFICATION
                        </span>
                      )}
                      {item.verificationStatus === "COMPLEMENTS_DEMANDES" && (
                        <span style={{ fontSize: 11, background: "#eff6ff", color: "#1d4ed8", padding: "3px 8px", borderRadius: 12, fontWeight: 600 }}>
                          ● COMPLÉMENTS DEMANDÉS
                        </span>
                      )}
                      {item.verificationStatus === "APPROUVEE" && (
                        <span style={{ fontSize: 11, background: "#dcfce7", color: "#15803d", padding: "3px 8px", borderRadius: 12, fontWeight: 600 }}>
                          ● APPROUVÉE
                        </span>
                      )}
                      {item.verificationStatus === "REJETEE" && (
                        <span style={{ fontSize: 11, background: "#fee2e2", color: "#b91c1c", padding: "3px 8px", borderRadius: 12, fontWeight: 600 }}>
                          ● REJETÉE
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", color: "var(--cam-text-muted)", fontSize: 12 }}>
                      {item.assignee || "—"}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      {item.verificationStatus === "APPROUVEE" ? (
                        <button
                          type="button"
                          className="cam-button cam-button-primary cam-button-sm"
                          style={{ padding: "4px 10px" }}
                          onClick={() => setReviewing(item)}
                        >
                          Activer
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="cam-button cam-button-sm"
                          style={{
                            padding: "4px 10px",
                            background: item.verificationStatus === "COMPLEMENTS_DEMANDES" ? "var(--cam-surface)" : "var(--cam-green-dark)",
                            borderColor: item.verificationStatus === "COMPLEMENTS_DEMANDES" ? "var(--cam-border)" : "var(--cam-green-dark)",
                            color: item.verificationStatus === "COMPLEMENTS_DEMANDES" ? "var(--cam-text)" : "#fff",
                            fontWeight: 600,
                          }}
                          onClick={() => setReviewing(item)}
                        >
                          {item.verificationStatus === "COMPLEMENTS_DEMANDES" ? "Relancer" : "Examiner"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--cam-border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
          <span style={{ color: "var(--cam-text-muted)" }}>
            Affichage 1–{filteredItems.length} sur 12 inscriptions en attente
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled>
              Précédent
            </button>
            <span style={{ display: "inline-flex", alignItems: "center", padding: "0 8px", fontWeight: 600 }}>
              1 / 2
            </span>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm">
              Suivant
            </button>
          </div>
        </div>
      </section>

      {/* Approbation Modal (Figma declarants/etablissements/_id/approbation.png) */}
      <AdminDialog
        open={!!reviewing}
        onClose={closeReview}
        title={`Validation du Compte — ${reviewing?.organisation || ""}`}
        eyebrow="Dossier d'auto-inscription en attente d'approbation"
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <span className="cam-dossier-note" style={{ fontSize: 11, color: "var(--cam-text-muted)" }}>
              Cette action génère une entrée d&apos;audit ACCOUNT_VALIDATION
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={closeReview} disabled={pendingMutation}>
                Annuler
              </button>
              <button
                type="button"
                className="cam-button cam-button-primary cam-button-sm"
                disabled={pendingMutation}
                onClick={handleDecisionSubmit}
              >
                {pendingMutation ? "Traitement…" : "Confirmer la Décision"}
              </button>
            </div>
          </div>
        }
      >
        {reviewing && (
          <div>
            {/* Meta summary card */}
            <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid var(--cam-border)", borderRadius: 6, padding: "10px 14px", marginBottom: "var(--cam-space-4)", fontSize: 13 }}>
              <div>
                <strong>Type :</strong> {reviewing.type} &nbsp;|&nbsp; <strong>Région :</strong> {reviewing.region}
              </div>
              <div style={{ marginTop: 4, color: "var(--cam-text-muted)" }}>
                Inscrit le : <strong>{reviewing.submittedAt}</strong> • Créé par : <strong>Auto-inscription</strong>
              </div>
            </div>

            {/* Documents checklist */}
            <div style={{ marginBottom: "var(--cam-space-4)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--cam-text-muted)", marginBottom: 8 }}>
                DOCUMENTS FOURNIS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cam-green)" }}>
                  <span>✓</span> Attestation d&apos;enregistrement (Vérifié)
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cam-green)" }}>
                  <span>✓</span> Pièce d&apos;identité du responsable (Vérifié)
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cam-error)" }}>
                  <span>✕</span> Certificat d&apos;imposition (Manquant)
                </div>
              </div>
            </div>

            {/* Decision Radio Choices */}
            <div style={{ marginBottom: "var(--cam-space-4)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--cam-text-muted)", marginBottom: 8 }}>
                DÉCISION
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label className="cam-admin-choice" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input
                    type="radio"
                    name="decision"
                    checked={decision === "APPROVE"}
                    onChange={() => setDecision("APPROVE")}
                  />
                  <span>Approuver le compte</span>
                </label>
                <label className="cam-admin-choice" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input
                    type="radio"
                    name="decision"
                    checked={decision === "REJECT"}
                    onChange={() => setDecision("REJECT")}
                  />
                  <span>Rejeter le compte</span>
                </label>
                <label className="cam-admin-choice" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input
                    type="radio"
                    name="decision"
                    checked={decision === "REQUEST_COMPLEMENTS"}
                    onChange={() => setDecision("REQUEST_COMPLEMENTS")}
                  />
                  <span>Demander des compléments</span>
                </label>
              </div>
            </div>

            {/* Comment textarea */}
            <div>
              <label htmlFor="decision-comment" className="cam-admin-label" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                MOTIF OU COMMENTAIRE…
              </label>
              <textarea
                id="decision-comment"
                rows={3}
                className="cam-input"
                style={{ width: "100%", resize: "vertical", minHeight: 70, boxSizing: "border-box", marginTop: 4 }}
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
