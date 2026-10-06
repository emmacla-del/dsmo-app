"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { activateUser, deleteUser, suspendUser } from "@/lib/user-directory";
import { entityTypeLabel, hasRealNiu, listCompanies, type Company } from "@/lib/companies-directory";
import { listAdminQuestionnaires } from "@/lib/api-client";
import {
  auditActionLabel,
  auditActorName,
  auditDetailsSummary,
  auditTransition,
  listAuditLog,
} from "@/lib/audit-log";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataState } from "@/components/admin/DataState";
import {
  NOT_PROVIDED,
  count,
  fact,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";
import { AUDIT_ROLES, NATIONAL_ROLES, SETTINGS_ROLES, hasRole } from "@/lib/roles";

// GET /companies is restricted to DIRECTORY_ROLES server-side
// (NATIONAL_ROLES); the check here fails closed, so a role that has not
// loaded yet is not treated as authorised. Account management is SUPER_ADMIN
// alone (SETTINGS_ROLES membership).

const CARD: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 24,
};

const KEY: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  color: "#6b7280",
  letterSpacing: "0.04em",
};

const VAL: React.CSSProperties = { fontSize: 14, color: "#111827", marginTop: 2 };

/** One label/value pair; absent values print the neutral marker. */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={KEY}>{label}</div>
      <div style={VAL}>{fact(value)}</div>
    </div>
  );
}

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
  // No default identifier: without one there is no establishment to show, and
  // substituting a known RCCM would load an unrelated real company.
  const id = searchParams.get("id")?.trim() ?? "";

  const role = useAuthStore((s) => s.user?.role);
  const canRead = hasRole(role, NATIONAL_ROLES);
  const canManageAccount = hasRole(role, SETTINGS_ROLES);
  const canReadAudit = hasRole(role, AUDIT_ROLES);

  const queryClient = useQueryClient();
  const [accountOpen, setAccountOpen] = useState(searchParams.get("manage") === "true");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setActionError(null);
    setTimeout(() => setToastMessage(null), 4000);
  };

  /**
   * Source: GET /companies?search=<id> (DsmoService.listCompanies), then
   * the row whose establishmentId or registrationNumber matches exactly.
   *
   * `null` means the search returned no matching establishment. There is no
   * template record: a company is rendered from its own fields or not at all,
   * so a missing field can never inherit another company's value.
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
  const linkedAccount = company?.user ?? null;

  const pageState = resolveDataState({
    roleAllowed: canRead,
    isLoading: companyQuery.isLoading,
    isError: companyQuery.isError,
    error: companyQuery.error,
  });

  /**
   * Audit trail for this establishment's linked account.
   *
   * Source: GET /audit/reports?resourceId=<User.id>. Only events the system
   * actually recorded for that account; there is no reconstructed history.
   */
  const auditQuery = useQuery({
    queryKey: ["audit", "by-resource", linkedAccount?.id],
    queryFn: () => listAuditLog({ resourceId: linkedAccount!.id, limit: 8, offset: 0 }),
    enabled: canReadAudit && !!linkedAccount?.id,
  });

  const auditState = resolveDataState({
    roleAllowed: canReadAudit,
    isLoading: auditQuery.isLoading,
    isError: auditQuery.isError,
    error: auditQuery.error,
    rowCount: auditQuery.data?.items.length ?? null,
  });

  const submissionsQuery = useQuery({
    queryKey: ["admin", "questionnaires", "by-company", company?.id],
    queryFn: () => listAdminQuestionnaires({ companyId: company!.id, limit: 10 }),
    enabled: canRead && !!company?.id,
  });

  const submissionsState = resolveDataState({
    roleAllowed: canRead,
    isLoading: submissionsQuery.isLoading,
    isError: submissionsQuery.isError,
    error: submissionsQuery.error,
    rowCount: submissionsQuery.data?.items.length ?? null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dsmo", "companies"] });
    queryClient.invalidateQueries({ queryKey: ["audit", "by-resource"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "questionnaires", "by-company"] });
  };

  const suspendMutation = useMutation({
    mutationFn: () => suspendUser(linkedAccount!.id),
    onSuccess: () => {
      invalidate();
      showToast("Compte suspendu.");
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const activateMutation = useMutation({
    mutationFn: () => activateUser(linkedAccount!.id),
    onSuccess: () => {
      invalidate();
      showToast("Compte réactivé.");
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(linkedAccount!.id),
    onSuccess: () => {
      invalidate();
      setAccountOpen(false);
      showToast("Compte supprimé.");
      router.push("/admin/etablissements");
    },
    onError: (e: Error) => setActionError(e.message),
  });

  // ── Nothing renders without an authoritative record ─────────────────────
  if (!company) {
    return (
      <div className="cam-admin-page" style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px 32px" }}>
        <Link href="/admin/etablissements" style={{ fontSize: 13, fontWeight: 600, color: "#004d3d", textDecoration: "none" }}>
          ← Retour aux établissements
        </Link>
        <div style={{ marginTop: 20, maxWidth: 820 }}>
          <DataState
            state={!id ? "notFound" : pageState === "ready" ? "notFound" : pageState}
            resource="cet établissement"
            error={companyQuery.error}
            onRetry={() => companyQuery.refetch()}
            title={
              !id
                ? "Aucun établissement demandé"
                : pageState === "forbidden"
                  ? "Accès non autorisé"
                  : pageState === "error"
                    ? undefined
                    : "Établissement introuvable"
            }
            hint={
              !id
                ? "Ouvrez une fiche depuis le répertoire des établissements."
                : pageState === "forbidden"
                  ? "Le répertoire des établissements est réservé aux administrateurs plateforme."
                  : pageState === "error"
                    ? undefined
                    : "Aucun établissement enregistré ne porte cet identifiant."
            }
          />
        </div>
      </div>
    );
  }

  const respondent = [company.respondentFirstName, company.respondentLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const isSuspended = !!linkedAccount && !linkedAccount.isActive;
  const shortName = company.name?.split("—")[0].trim() || null;

  return (
    <div className="cam-admin-page" style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px 32px" }}>
      <AdminPageHeader
        backHref="/admin/etablissements"
        breadcrumb={[
          { label: "Déclarants" },
          { label: "Établissements", href: "/admin/etablissements" },
          { label: shortName ?? NOT_PROVIDED },
        ]}
        title={shortName ?? "Établissement"}
        subtitle="Registre officiel et détails de l'établissement"
        hideTabs={true}
        actions={<AdminHeaderActions showCampaignPill={false} showBell={false} />}
      />


      {toastMessage && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "12px 18px", borderRadius: 8, marginBottom: 20, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#065f46" }}>×</button>
        </div>
      )}

      {actionError && (
        <div role="alert" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "12px 18px", borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
          {actionError}
        </div>
      )}

      {/* ── Hero: every value is this establishment's own stored field ── */}
      <section style={{ ...CARD, padding: "24px 28px", marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>
                {fact(company.name)}
              </h1>
              {company.entityType && (
                <span style={{ fontSize: 11, background: "rgba(0, 122, 94, 0.08)", color: "#004d3d", padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>
                  {entityTypeLabel(company.entityType)}
                </span>
              )}
              {/* Account state, or an explicit "no linked account". */}
              <span
                style={{
                  fontSize: 11,
                  background: !linkedAccount ? "#f3f4f6" : isSuspended ? "#fee2e2" : "#dcfce7",
                  color: !linkedAccount ? "#6b7280" : isSuspended ? "#b91c1c" : "#15803d",
                  padding: "3px 10px",
                  borderRadius: 9999,
                  fontWeight: 600,
                }}
              >
                {!linkedAccount ? "AUCUN COMPTE LIÉ" : isSuspended ? "COMPTE SUSPENDU" : "COMPTE ACTIF"}
              </span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280" }}>
              Identifiant : <strong style={{ color: "#111827", fontFamily: "ui-monospace, monospace" }}>{fact(company.establishmentId)}</strong>
              {" | "}
              Activité principale : <strong style={{ color: "#111827" }}>{fact(company.mainActivity)}</strong>
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* Shown only when there is a real account to act on and the role
                may act on it. The button performs the real call. */}
            {linkedAccount && canManageAccount && (
              <button
                type="button"
                disabled={suspendMutation.isPending || activateMutation.isPending}
                onClick={() => (isSuspended ? activateMutation.mutate() : suspendMutation.mutate())}
                style={{ padding: "8px 18px", background: "#ffffff", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#b91c1c", cursor: "pointer" }}
              >
                {isSuspended ? "Réactiver le compte" : "Suspendre le compte"}
              </button>
            )}
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "flex-start" }}>
        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Identification: Company model fields only. */}
          <section style={CARD}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 18px", borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              Informations Générales
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <Field label="Raison sociale" value={company.name} />
              <Field label="Type d'entité" value={company.entityType ? entityTypeLabel(company.entityType) : null} />
              <Field label="N° d'enregistrement (agrément)" value={company.registrationNumber} />
              <Field label="Numéro fiscal (NIU)" value={hasRealNiu(company.taxNumber) ? company.taxNumber : null} />
              <Field label="Numéro CNPS" value={company.cnpsNumber} />
              <Field label="Identifiant établissement" value={company.establishmentId} />
              <Field label="Année de création" value={company.yearOfCreation} />
              <Field label="Forme juridique" value={company.legalStatus} />
              <Field label="Taille" value={company.enterpriseSize} />
              <Field label="Activité principale" value={company.mainActivity} />
              <Field label="Secteur" value={company.sector?.name} />
              <Field label="Téléphone" value={company.phone} />
              <Field label="Adresse" value={company.address} />
              <Field label="Région" value={company.region} />
              <Field label="Département" value={company.department} />
              <Field label="Arrondissement" value={company.subdivision} />
              <Field
                label="Responsable désigné"
                value={respondent ? `${respondent}${company.respondentFunction ? ` — ${company.respondentFunction}` : ""}` : null}
              />
              <Field label="Téléphone du responsable" value={company.respondentPhone} />
            </div>
          </section>

          {/* Workforce as last declared on the Company record. */}
          <section style={CARD}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 18px", borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              Effectifs déclarés
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              <div>
                <div style={KEY}>Effectif total</div>
                <div style={VAL}>{count(company.totalEmployees)}</div>
              </div>
              <div>
                <div style={KEY}>Hommes</div>
                <div style={VAL}>{count(company.menCount)}</div>
              </div>
              <div>
                <div style={KEY}>Femmes</div>
                <div style={VAL}>{count(company.womenCount)}</div>
              </div>
              <div>
                <div style={KEY}>Effectif exercice précédent</div>
                <div style={VAL}>{count(company.lastYearTotal)}</div>
              </div>
            </div>
          </section>

          {/* Submission history for this company */}
          <section style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
                Historique des Soumissions{submissionsQuery.data?.total !== undefined ? ` (${count(submissionsQuery.data.total)})` : ""}
              </h2>
              {company && (
                <Link
                  href={`/admin/dossiers?companyId=${encodeURIComponent(company.id)}`}
                  style={{ fontSize: 12, color: "#004d3d", fontWeight: 600, textDecoration: "none" }}
                >
                  Tous les dossiers →
                </Link>
              )}
            </div>

            {submissionsState !== "ready" ? (
              <DataState
                dense
                state={submissionsState}
                resource="l'historique des soumissions"
                error={submissionsQuery.error}
                onRetry={() => submissionsQuery.refetch()}
                title={submissionsState === "empty" ? "Aucune déclaration soumise" : undefined}
                hint={submissionsState === "empty" ? "Cet établissement n'a pas encore soumis de déclaration administrative." : undefined}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {submissionsQuery.data?.items.map((sub) => (
                  <div
                    key={sub.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      border: "1px solid #f1f5f9",
                      borderRadius: 6,
                      background: "#f8fafc",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                        {sub.submissionId || sub.id}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        Reçu le {stamp(sub.submissionDate || sub.createdAt)} • Type : {entityTypeLabel(sub.formType)}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          background:
                            sub.status === "APPROVED"
                              ? "#dcfce7"
                              : sub.status === "PENDING_REVIEW"
                                ? "#fef3c7"
                                : sub.status === "REJECTED"
                                  ? "#fee2e2"
                                  : "#f1f5f9",
                          color:
                            sub.status === "APPROVED"
                              ? "#15803d"
                              : sub.status === "PENDING_REVIEW"
                                ? "#b45309"
                                : sub.status === "REJECTED"
                                  ? "#b91c1c"
                                  : "#475569",
                        }}
                      >
                        {sub.status}
                      </span>
                      <Link
                        href={`/admin/dossiers/${encodeURIComponent(sub.id)}`}
                        style={{
                          fontSize: 12,
                          color: "#004d3d",
                          fontWeight: 600,
                          textDecoration: "none",
                          padding: "4px 8px",
                          borderRadius: 4,
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                        }}
                      >
                        Consulter
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Exactly one account can be linked: Company.user is singular. */}
          <section style={CARD}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 16px", borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              Compte Utilisateur Rattaché
            </h2>
            {!linkedAccount ? (
              <DataState
                dense
                state="empty"
                resource="le compte rattaché"
                title="Aucun compte rattaché"
                hint="Cet établissement n'a pas de compte utilisateur enregistré."
              />
            ) : (
              <button
                type="button"
                onClick={() => setAccountOpen(true)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  background: "#ffffff",
                  cursor: "pointer",
                }}
              >
                <div>
                  {/* The account's own email. No display name is invented:
                      /companies returns only id, email, status and
                      isActive for the linked user. */}
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{fact(linkedAccount.email)}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Statut : {fact(linkedAccount.status)}</div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    background: linkedAccount.isActive ? "#dcfce7" : "#f3f4f6",
                    color: linkedAccount.isActive ? "#15803d" : "#6b7280",
                    padding: "2px 8px",
                    borderRadius: 9999,
                    fontWeight: 700,
                  }}
                >
                  {linkedAccount.isActive ? "ACTIF" : "INACTIF"}
                </span>
              </button>
            )}
          </section>

          {/* Registration metadata.
              `createdAt` is the only field the Company model records here. The
              Figma frame also shows the creating agent, the registration mode,
              the registration IP, a geolocation, a last-modified stamp and a
              document-verification status; none of those is stored anywhere,
              so none is shown. */}
          <section style={CARD}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 16px", borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              Informations du Compte
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              <Field label="Date d'enregistrement" value={stamp(company.createdAt, false)} />
            </div>
            <div style={{ marginTop: 14 }}>
              <DataState
                dense
                state="unavailable"
                resource="les métadonnées d'inscription"
                title="Métadonnées d'inscription non conservées"
                hint="Le système n'enregistre ni l'agent créateur, ni le mode d'inscription, ni l'adresse IP, ni la géolocalisation, ni l'état de vérification documentaire de cet établissement."
              />
            </div>
          </section>

          {/* Real audit entries for the linked account. */}
          <section style={CARD}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 16px", borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
              Journal d&apos;Audit
            </h2>
            {!linkedAccount ? (
              <DataState
                dense
                state="empty"
                resource="le journal d'audit"
                title="Aucun compte rattaché"
                hint="Les événements d'audit sont rattachés au compte utilisateur de l'établissement."
              />
            ) : auditState !== "ready" ? (
              <DataState
                dense
                state={auditState}
                resource="le journal d'audit"
                error={auditQuery.error}
                onRetry={() => auditQuery.refetch()}
                title={
                  auditState === "empty"
                    ? "Aucun historique d'audit disponible"
                    : auditState === "forbidden"
                      ? "Journal d'audit non accessible à votre rôle"
                      : undefined
                }
                hint={auditState === "empty" ? "Les événements enregistrés apparaîtront ici." : undefined}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 12 }}>
                {(auditQuery.data?.items ?? []).map((e) => (
                  <div key={e.id}>
                    <div style={{ color: "#6b7280" }}>{stamp(e.timestamp)}</div>
                    <div style={{ fontWeight: 600, color: "#111827" }}>{auditActorName(e)}</div>
                    <div style={{ color: "#4b5563" }}>{auditActionLabel(e.action)}</div>
                    <div style={{ color: "#6b7280" }}>{auditDetailsSummary(e)}</div>
                    {auditTransition(e) && (
                      <div style={{ color: "#6b7280", fontStyle: "italic" }}>{auditTransition(e)}</div>
                    )}
                  </div>
                ))}
                <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
                  <Link
                    href={`/admin/journal-audit?resourceId=${encodeURIComponent(linkedAccount.id)}`}
                    style={{ fontSize: 13, color: "#004d3d", fontWeight: 600, textDecoration: "none" }}
                  >
                    Voir le journal complet →
                  </Link>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── Account management.
          Only actions with a real endpoint are offered. The Figma frame also
          shows "unlock account", "resend verification email", "reset session",
          a role selector and a recent-login table; none of those has a backend
          operation or a stored source, and the previous version reported each
          as done after merely showing a toast. ── */}
      <AdminDialog
        open={accountOpen && !!linkedAccount}
        onClose={() => setAccountOpen(false)}
        wide
        title="Gestion du Compte Utilisateur"
        eyebrow={
          <div style={{ color: "#4b5563", textTransform: "none", fontWeight: 500, fontSize: 13, marginBottom: 4, letterSpacing: "normal" }}>
            <span style={{ fontWeight: 600, color: "#111827" }}>{fact(linkedAccount?.email)}</span>
            <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
              {fact(shortName)} — enregistré le {stamp(company.createdAt, false)}
            </div>
          </div>
        }
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Les actions effectuées sont consignées au journal d&apos;audit.
            </span>
            <button type="button" className="cam-button cam-button-secondary" onClick={() => setAccountOpen(false)} style={{ padding: "8px 18px", borderRadius: 6 }}>
              Fermer
            </button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {actionError && (
            <div role="alert" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "10px 14px", borderRadius: 6, fontSize: 13 }}>
              {actionError}
            </div>
          )}

          {!canManageAccount ? (
            <DataState
              dense
              state="forbidden"
              resource="la gestion du compte"
              title="Gestion du compte réservée au super-administrateur plateforme"
            />
          ) : (
            <>
              <div>
                <div style={{ ...KEY, marginBottom: 12 }}>ACTIONS SUR LE COMPTE</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 6, gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                      {isSuspended ? "Réactiver le compte" : "Suspendre le compte"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {isSuspended
                        ? "Le titulaire pourra à nouveau se connecter et déclarer."
                        : "Le titulaire ne pourra plus se connecter. Les données sont conservées."}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={suspendMutation.isPending || activateMutation.isPending}
                    onClick={() => (isSuspended ? activateMutation.mutate() : suspendMutation.mutate())}
                    style={{ padding: "6px 14px", background: isSuspended ? "#004d3d" : "#d97706", color: "#ffffff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    {suspendMutation.isPending || activateMutation.isPending
                      ? "Enregistrement…"
                      : isSuspended
                        ? "Réactiver"
                        : "Suspendre"}
                  </button>
                </div>
              </div>

              <div>
                <div style={{ ...KEY, marginBottom: 8 }}>HISTORIQUE DES CONNEXIONS</div>
                <DataState
                  dense
                  state="unavailable"
                  resource="l'historique des connexions"
                  title="Connexions non journalisées"
                  hint="Le système n'enregistre ni les connexions réussies, ni les tentatives échouées, ni les appareils utilisés pour ce compte."
                />
              </div>

              <div style={{ border: "1px solid #fecaca", borderRadius: 8, padding: 14, background: "#fff5f5" }}>
                <div style={{ ...KEY, color: "#dc2626", marginBottom: 10 }}>ZONE DANGEREUSE</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Supprimer le compte</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      Suppression définitive du compte utilisateur. Cette action est irréversible.
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate()}
                    style={{ padding: "6px 14px", background: "#ffffff", color: "#b91c1c", border: "1px solid #ef4444", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    {deleteMutation.isPending ? "Suppression…" : "Supprimer"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </AdminDialog>
    </div>
  );
}
