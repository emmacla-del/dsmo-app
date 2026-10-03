"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { approveUser, rejectUser, requestComplements, getUserDocuments, verifyUserDocument } from "@/lib/user-directory";
import { entityTypeLabel, listCompanies, type Company } from "@/lib/companies-directory";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { DataState } from "@/components/admin/DataState";
import { NOT_PROVIDED, fact, resolveDataState, stamp } from "@/lib/admin-data-state";
import { NATIONAL_ROLES, SETTINGS_ROLES, hasRole } from "@/lib/roles";

// Fails closed: a role that has not loaded is not authorised.
// Read: GET /companies is DIRECTORY_ROLES, territory-scoped server-side;
// this screen is gated to NATIONAL_ROLES.
// Decide: SUPER_ADMIN alone (SETTINGS_ROLES membership).

type Decision = "approve" | "reject" | "complements";

const KEY: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#6b7280",
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
  // No default identifier: a hardcoded one would open the approval screen for
  // an unrelated real establishment.
  const id = searchParams.get("id")?.trim() ?? "";

  const role = useAuthStore((s) => s.user?.role);
  const canRead = hasRole(role, NATIONAL_ROLES);
  const canDecide = hasRole(role, SETTINGS_ROLES);
  const queryClient = useQueryClient();

  const [decision, setDecision] = useState<Decision>("complements");
  // Not pre-filled: this text is persisted as the official motive and sent to
  // the applicant, so a prepared sentence about documents this file may not be
  // missing would become a real administrative finding.
  const [comment, setComment] = useState("");
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  /**
   * Source: GET /companies?search=<id>, matched exactly on
   * establishmentId or registrationNumber. `null` means no such establishment;
   * there is no template record, so nothing is inherited from another company.
   */
  const companyQuery = useQuery({
    queryKey: ["dsmo", "companies", "by-establishment-id", id],
    queryFn: async () => {
      const res = await listCompanies({ search: id, pageSize: 20 });
      return (
        res.companies.find((c) => c.establishmentId === id || c.registrationNumber === id) ?? null
      );
    },
    enabled: canRead && !!id,
  });

  const company: Company | null = companyQuery.data ?? null;
  const account = company?.user ?? null;
  const detailHref = id ? `/admin/etablissement-detail?id=${encodeURIComponent(id)}` : "/admin/etablissements";

  const pageState = resolveDataState({
    roleAllowed: canRead,
    isLoading: companyQuery.isLoading,
    isError: companyQuery.isError,
    error: companyQuery.error,
  });

  const documentsQuery = useQuery({
    queryKey: ["auth", "users", account?.id, "documents"],
    queryFn: () => (account?.id ? getUserDocuments(account.id) : null),
    enabled: canRead && !!account?.id,
  });

  const verifyMutation = useMutation({
    mutationFn: ({ kind, state }: { kind: string; state: "VERIFIED" | "PENDING" | "REJECTED" }) => {
      if (!account?.id) throw new Error("Aucun compte rattaché.");
      return verifyUserDocument(account.id, kind, state);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "users", account?.id, "documents"] });
    },
  });

  /**
   * Every decision targets the establishment's real linked account id. The
   * previous version fell back to an invented id, which would have approved or
   * rejected whatever account happened to carry it.
   *
   * "Demander des compléments" calls PATCH /auth/request-complements/:id — it
   * used to report success without contacting the server at all.
   */
  const mutation = useMutation({
    mutationFn: async (d: Decision) => {
      if (!account) throw new Error("Cet établissement n'a pas de compte utilisateur à valider.");
      if (d === "approve") return approveUser(account.id);
      if (d === "reject") return rejectUser(account.id, comment.trim() || undefined);
      return requestComplements(account.id, comment.trim());
    },
    onSuccess: (_r, d) => {
      queryClient.invalidateQueries({ queryKey: ["dsmo", "companies"] });
      setResult({
        tone: "success",
        text:
          d === "approve"
            ? "Compte approuvé."
            : d === "reject"
              ? "Compte rejeté."
              : "Demande de compléments transmise.",
      });
      setTimeout(() => router.push(detailHref), 1500);
    },
    onError: (e: Error) => setResult({ tone: "error", text: e.message }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (decision !== "approve" && !comment.trim()) {
      setResult({ tone: "error", text: "Un motif est requis pour un rejet ou une demande de compléments." });
      return;
    }
    setResult(null);
    mutation.mutate(decision);
  };

  if (!company) {
    return (
      <div className="cam-admin-page" style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px 32px" }}>
        <Link href="/admin/etablissements" style={{ fontSize: 13, fontWeight: 600, color: "#004d3d", textDecoration: "none" }}>
          ← Retour aux établissements
        </Link>
        <div style={{ marginTop: 20, maxWidth: 820 }}>
          <DataState
            state={!id || pageState === "ready" ? "notFound" : pageState}
            resource="ce dossier d'inscription"
            error={companyQuery.error}
            onRetry={() => companyQuery.refetch()}
            title={
              !id
                ? "Aucun dossier demandé"
                : pageState === "forbidden"
                  ? "Accès non autorisé"
                  : pageState === "error"
                    ? undefined
                    : "Dossier introuvable"
            }
            hint={
              !id
                ? "Ouvrez une fiche depuis le répertoire des établissements."
                : pageState === "error"
                  ? undefined
                  : "Aucun établissement enregistré ne porte cet identifiant."
            }
          />
        </div>
      </div>
    );
  }

  const territory = [company.region, company.department, company.subdivision].filter(Boolean).join(" / ");

  return (
    <div className="cam-admin-page" style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px 32px" }}>
      <AdminPageHeader
        backHref={detailHref}
        breadcrumb={[
          { label: "Déclarants" },
          { label: "Établissements", href: "/admin/etablissements" },
          { label: "Validation du compte" },
        ]}
        title="Validation du compte déclarant"
        subtitle="Décision administrative sur un dossier d'inscription"
        hideTabs={true}
        actions={<AdminHeaderActions showCampaignPill={false} showBell={false} />}
      />

      <div style={{ maxWidth: 720, marginTop: 24 }}>
        <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid #f3f4f6" }}>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: "#004d3d", margin: 0 }}>
              {fact(company.name)}
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
              {/* The applicant's own account status, or an explicit absence. */}
              {account
                ? `Compte ${fact(account.email)} — statut ${fact(account.status)}`
                : "Aucun compte utilisateur rattaché à cet établissement"}
            </p>
          </div>

          {result && (
            <div
              role={result.tone === "error" ? "alert" : "status"}
              style={{
                margin: "16px 28px 0",
                padding: "10px 14px",
                borderRadius: 6,
                background: result.tone === "error" ? "#fef2f2" : "#ecfdf5",
                color: result.tone === "error" ? "#b91c1c" : "#059669",
                fontSize: 13,
              }}
            >
              {result.text}
            </div>
          )}

          <form onSubmit={submit} style={{ padding: "20px 28px 24px" }}>
            {/* Identification, from the establishment's own stored fields. */}
            <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: "14px 18px", marginBottom: 20, fontSize: 13, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <div>
                <div style={KEY}>Type d&apos;entité</div>
                <div style={{ color: "#111827", marginTop: 2 }}>
                  {company.entityType ? entityTypeLabel(company.entityType) : NOT_PROVIDED}
                </div>
              </div>
              <div>
                <div style={KEY}>Ressort</div>
                <div style={{ color: "#111827", marginTop: 2 }}>{territory || NOT_PROVIDED}</div>
              </div>
              <div>
                <div style={KEY}>N° RCCM</div>
                <div style={{ color: "#111827", marginTop: 2, fontFamily: "ui-monospace, monospace" }}>
                  {fact(company.registrationNumber)}
                </div>
              </div>
              <div>
                <div style={KEY}>Enregistré le</div>
                <div style={{ color: "#111827", marginTop: 2 }}>{stamp(company.createdAt, false)}</div>
              </div>
            </div>

            {/* Document checklist backed by RegistrationDocument model. */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ ...KEY, marginBottom: 10 }}>PIÈCES JUSTIFICATIVES</div>
              {documentsQuery.isLoading ? (
                <p style={{ fontSize: 13, color: "#64748b" }}>Chargement des pièces justificatives…</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(documentsQuery.data?.items ?? []).map((doc) => {
                    const isVerified = doc.state === "VERIFIED";
                    return (
                      <div
                        key={doc.kind}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: isVerified ? "1px solid #a7f3d0" : "1px solid #e5e7eb",
                          background: isVerified ? "#f0fdf4" : "#ffffff",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                            {doc.label}
                          </div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                            {isVerified && doc.verifiedBy
                              ? `Vérifié par ${doc.verifiedBy} le ${stamp(doc.verifiedAt, false)}`
                              : "En attente de vérification formelle"}
                          </div>
                        </div>

                        {canDecide && (
                          <button
                            type="button"
                            disabled={verifyMutation.isPending}
                            onClick={() =>
                              verifyMutation.mutate({
                                kind: doc.kind,
                                state: isVerified ? "PENDING" : "VERIFIED",
                              })
                            }
                            style={{
                              padding: "4px 12px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              border: isVerified ? "1px solid #059669" : "1px solid #d1d5db",
                              background: isVerified ? "#059669" : "#ffffff",
                              color: isVerified ? "#ffffff" : "#374151",
                            }}
                          >
                            {isVerified ? "✓ Vérifié" : "Marquer vérifié"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {!canDecide ? (
              <DataState
                state="forbidden"
                resource="la décision de validation"
                title="Décision réservée au super-administrateur plateforme"
                hint="Vous pouvez consulter ce dossier, mais la décision d'approbation ou de rejet relève du super-administrateur."
              />
            ) : !account ? (
              <DataState
                state="empty"
                resource="le compte à valider"
                title="Aucun compte à valider"
                hint="Cet établissement n'a pas de compte utilisateur rattaché : il n'y a pas de dossier d'inscription à instruire."
              />
            ) : (
              <>
                <fieldset style={{ border: "none", margin: "0 0 20px", padding: 0 }}>
                  <legend style={{ ...KEY, marginBottom: 10, padding: 0 }}>DÉCISION</legend>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(
                      [
                        { value: "approve", label: "Approuver le compte" },
                        { value: "reject", label: "Rejeter le compte" },
                        { value: "complements", label: "Demander des compléments" },
                      ] as Array<{ value: Decision; label: string }>
                    ).map((opt) => (
                      <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="decision"
                          value={opt.value}
                          checked={decision === opt.value}
                          onChange={() => setDecision(opt.value)}
                          style={{ accentColor: "#004d3d" }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div style={{ marginBottom: 18 }}>
                  <label htmlFor="approb-comment" style={{ ...KEY, display: "block", marginBottom: 6 }}>
                    MOTIF OU COMMENTAIRE
                    {decision !== "approve" && <span style={{ color: "#dc2626" }}> *</span>}
                  </label>
                  <textarea
                    id="approb-comment"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={
                      decision === "reject"
                        ? "Motif du rejet, transmis au déclarant."
                        : decision === "complements"
                          ? "Pièces ou informations à fournir, transmises au déclarant."
                          : "Observation facultative."
                    }
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
                      cursor: mutation.isPending ? "not-allowed" : "pointer",
                      opacity: mutation.isPending ? 0.6 : 1,
                    }}
                  >
                    {mutation.isPending ? "Enregistrement…" : "Confirmer la décision"}
                  </button>
                </div>
              </>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}
