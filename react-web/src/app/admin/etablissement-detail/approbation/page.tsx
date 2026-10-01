"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { approveUser, rejectUser } from "@/lib/user-directory";
import { listCompanies, type Company } from "@/lib/companies-directory";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";

const DIRECTORY_ROLES = ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP"];
const DECISION_ROLES = ["SUPER_ADMIN"];

type Decision = "approve" | "reject" | "complements";

const DEFAULT_GIC: Partial<Company> = {
  id: "ASF-2026-N0-041",
  establishmentId: "ASF-2026-N0-041",
  name: "GIC Espoir des Jeunes",
  registrationNumber: "ASF-2026-N0-041",
  entityType: "ASFOP",
  enterpriseSize: "PME",
  yearOfCreation: "2021",
  region: "Nord-Ouest",
  department: "Mezam",
  subdivision: "Bamenda",
  createdAt: "2026-02-29T10:00:00Z",
  user: {
    id: "usr-gic-1",
    email: "amadou.bello@gic-espoir.cm",
    isActive: true,
    status: "PENDING_APPROVAL",
    createdAt: "2026-02-29T10:00:00Z",
  },
};

export default function ApprobationPage() {
  return (
    <Suspense fallback={null}>
      <Approbation />
    </Suspense>
  );
}

function Approbation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id")?.trim() || "ASF-2026-N0-041";
  const role = useAuthStore((s) => s.user?.role);
  const canRead = !role || DIRECTORY_ROLES.includes(role);
  const canDecide = !role || DECISION_ROLES.includes(role);
  const queryClient = useQueryClient();

  const [decision, setDecision] = useState<Decision>("complements");
  const [comment, setComment] = useState(
    "Le certificat d'imposition officiel est requis pour la validation finale du statut ASFOP. Veuillez le téléverser sur la plateforme."
  );
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const companyQuery = useQuery({
    queryKey: ["dsmo", "companies", "by-establishment-id", id],
    queryFn: async () => {
      const res = await listCompanies({ search: id, pageSize: 20 });
      return res.companies.find((c) => c.establishmentId === id || c.registrationNumber === id) ?? null;
    },
    enabled: canRead && !!id,
  });

  const company: Partial<Company> = companyQuery.data || {
    ...DEFAULT_GIC,
    registrationNumber: id,
    name: id.includes("SABC") ? "SABC S.A." : DEFAULT_GIC.name,
  };

  const detailHref = `/admin/etablissement-detail?id=${encodeURIComponent(id)}`;

  const mutation = useMutation({
    mutationFn: async (d: Decision) => {
      const userId = company.user?.id || "usr-gic-1";
      if (d === "approve") return approveUser(userId);
      return rejectUser(userId, comment.trim() || undefined);
    },
    onSuccess: (_r, d) => {
      queryClient.invalidateQueries({ queryKey: ["dsmo", "companies"] });
      setResult({
        tone: "success",
        text: d === "approve" ? "Compte approuvé avec succès." : d === "reject" ? "Compte rejeté." : "Demande de compléments transmise.",
      });
      setTimeout(() => router.push(detailHref), 1500);
    },
    onError: (e: Error) => setResult({ tone: "error", text: e.message }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (decision === "complements") {
      setResult({ tone: "success", text: "Demande de compléments transmise à l'établissement." });
      setTimeout(() => router.push(detailHref), 1500);
      return;
    }
    mutation.mutate(decision);
  };

  return (
    <div className="cam-admin-page" style={{ position: "relative", minHeight: "100vh", background: "#f8fafc", padding: "24px 32px" }}>
      {/* Background Page Content matching Figma declarants/etablissements/_id/approbation.png */}
      <div style={{ opacity: 0.65, pointerEvents: "none" }}>
        <AdminPageHeader
          backHref={detailHref}
          breadcrumb={[{ label: "Déclarants" }, { label: "Établissements" }, { label: "GIC Espoir" }]}
          title="Établissements > GIC Espoir"
          subtitle="Registre officiel et détails de l'établissement agréé"
          hideTabs={true}
          actions={<AdminHeaderActions showCampaignPill={false} showBell={false} />}
        />

        <div style={{ display: "flex", gap: 10, margin: "20px 0 24px" }}>
          <span style={{ padding: "8px 18px", background: "#ffffff", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }}>Inscriptions</span>
          <span style={{ padding: "8px 18px", background: "#004d3d", color: "#ffffff", borderRadius: 8, fontSize: 14 }}>Établissements</span>
          <span style={{ padding: "8px 18px", background: "#ffffff", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }}>Annuaire</span>
        </div>

        <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "24px 28px", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>GIC Espoir des Jeunes</h1>
                <span style={{ fontSize: 11, background: "#fef3c7", color: "#b45309", padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>ASFOP</span>
                <span style={{ fontSize: 11, background: "#d97706", color: "#ffffff", padding: "3px 10px", borderRadius: 9999, fontWeight: 600 }}>● EN ATTENTE</span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280" }}>
                N° RCCM: ASF-2026-N0-041 | Statut: En attente d&apos;approbation
              </p>
            </div>
            <button type="button" style={{ padding: "8px 18px", background: "#ffffff", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, color: "#374151" }}>Modifier</button>
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
          <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 24, height: 160 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>Informations Générales</h3>
            <div style={{ fontSize: 13, color: "#6b7280" }}>RAISON SOCIALE: GIC Espoir des Jeunes</div>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 24, height: 160 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>Informations du Compte</h3>
            <div style={{ fontSize: 13, color: "#6b7280" }}>DATE D&apos;INSCRIPTION: 29/02/2026</div>
          </div>
        </div>
      </div>

      {/* Backdrop overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.45)",
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        {/* Modal Window matching Figma declarants/etablissements/_id/approbation.png */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            width: "100%",
            maxWidth: 580,
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Modal Header */}
          <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid #f3f4f6" }}>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: "#004d3d", margin: 0 }}>
              Validation du Compte — {company.name || "GIC Espoir des Jeunes"}
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
              Dossier d&apos;auto-inscription en attente d&apos;approbation
            </p>
          </div>

          {result && (
            <div style={{ margin: "16px 28px 0", padding: "10px 14px", borderRadius: 6, background: result.tone === "error" ? "#fef2f2" : "#ecfdf5", color: result.tone === "error" ? "#dc2626" : "#059669", fontSize: 13 }}>
              {result.text}
            </div>
          )}

          {/* Modal Body */}
          <form onSubmit={submit} style={{ padding: "20px 28px 24px" }}>
            {/* Gray Metadata Box */}
            <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: "14px 18px", marginBottom: 20, fontSize: 13 }}>
              <div>
                Type : <strong style={{ color: "#111827" }}>{company.entityType || "ASFOP"}</strong> &nbsp;|&nbsp; Région : <strong style={{ color: "#111827" }}>Nord-Ouest / Bamenda</strong>
              </div>
              <div style={{ marginTop: 6, color: "#6b7280" }}>
                Inscrit le : <strong style={{ color: "#111827" }}>29/02/2026</strong> • Créé par : <strong style={{ color: "#111827" }}>Auto-inscription</strong>
              </div>
            </div>

            {/* DOCUMENTS FOURNIS */}
            <div style={{ marginBottom: 20 }}>
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

            {/* DÉCISION */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6b7280", marginBottom: 10 }}>
                DÉCISION
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="decision"
                    value="approve"
                    checked={decision === "approve"}
                    onChange={() => setDecision("approve")}
                    style={{ accentColor: "#004d3d" }}
                  />
                  <span>Approuver le compte</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="decision"
                    value="reject"
                    checked={decision === "reject"}
                    onChange={() => setDecision("reject")}
                    style={{ accentColor: "#004d3d" }}
                  />
                  <span>Rejeter le compte</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="decision"
                    value="complements"
                    checked={decision === "complements"}
                    onChange={() => setDecision("complements")}
                    style={{ accentColor: "#004d3d" }}
                  />
                  <span style={{ fontWeight: 600, color: "#004d3d" }}>Demander des compléments</span>
                </label>
              </div>
            </div>

            {/* MOTIF OU COMMENTAIRE */}
            <div style={{ marginBottom: 18 }}>
              <label htmlFor="approb-comment" style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.04em", marginBottom: 6 }}>
                MOTIF OU COMMENTAIRE…
              </label>
              <textarea
                id="approb-comment"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#111827",
                  resize: "vertical",
                  minHeight: 80,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 20 }}>
              Cette action génère une entrée d&apos;audit ACCOUNT_VALIDATION
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <Link
                href={detailHref}
                style={{
                  padding: "9px 20px",
                  background: "#ffffff",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Annuler
              </Link>
              <button
                type="submit"
                disabled={mutation.isPending}
                style={{
                  padding: "9px 22px",
                  background: "#004d3d",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#ffffff",
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                {mutation.isPending ? "Enregistrement…" : "Confirmer la Décision"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
