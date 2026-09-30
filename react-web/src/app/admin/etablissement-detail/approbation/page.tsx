"use client";

import { Suspense, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { approveUser, rejectUser } from "@/lib/user-directory";
import { dash, entityTypeLabel, formatDate, listCompanies, type Company } from "@/lib/companies-directory";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";

// UI shell for the account-validation frame
// (declarants/etablissements/_id/approbation.png). The frame draws the
// decision as a modal over the detail page; here it is the page's main panel.
// Wiring gaps: docs/admin-replacement/ui-wiring-todo.md. No page-level role
// gate is added: calls are made only for the roles their endpoints accept.
//
// ?id=<establishmentId>, resolved like /admin/etablissement-detail: there is
// no GET-by-id, so GET /dsmo/companies?search=<id> and keep the exact match.

const DIRECTORY_ROLES = ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP"]; // GET /dsmo/companies
// PATCH /auth/approve-user|reject-user on a COMPANY account: SUPER_ADMIN only
// (assertCanApproveRegistration limits every other role to ONEFOP staff).
const DECISION_ROLES = ["SUPER_ADMIN"];

type Decision = "approve" | "reject" | "complements";

const DIMMED = { opacity: 0.55, cursor: "not-allowed" } as const;

export default function ApprobationPage() {
  return (
    <Suspense fallback={null}>
      <Approbation />
    </Suspense>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cam-dash-card" aria-label={title}>
      <div className="cam-dash-card-head"><h3 className="cam-dash-card-title">{title}</h3></div>
      {children}
    </section>
  );
}

function statusBadge(c: Company) {
  if (!c.user) return <AdminStatusBadge label="Sans compte" variant="neutral" />;
  if (c.user.status === "PENDING_APPROVAL") return <AdminStatusBadge label="En attente" variant="pending" />;
  if (c.user.status === "REJECTED") return <AdminStatusBadge label="Rejeté" variant="rejected" />;
  return c.user.isActive ? <AdminStatusBadge label="Actif" variant="active" /> : <AdminStatusBadge label="Suspendu" variant="rejected" />;
}

function Approbation() {
  const id = useSearchParams().get("id")?.trim() ?? "";
  const role = useAuthStore((s) => s.user?.role);
  const canRead = !!role && DIRECTORY_ROLES.includes(role);
  const canDecide = !!role && DECISION_ROLES.includes(role);
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comment, setComment] = useState("");
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const companyQuery = useQuery({
    queryKey: ["dsmo", "companies", "by-establishment-id", id],
    queryFn: async () => {
      const res = await listCompanies({ search: id, pageSize: 20 });
      return res.companies.find((c) => c.establishmentId === id) ?? null;
    },
    enabled: canRead && !!id,
  });
  const company = companyQuery.data ?? null;
  const detailHref = `/admin/etablissement-detail?id=${encodeURIComponent(id)}`;

  const mutation = useMutation({
    mutationFn: async (d: Decision) => {
      const userId = company!.user!.id;
      if (d === "approve") return approveUser(userId);
      return rejectUser(userId, comment.trim() || undefined);
    },
    onSuccess: (_r, d) => {
      queryClient.invalidateQueries({ queryKey: ["dsmo", "companies"] });
      setResult({ tone: "success", text: d === "approve" ? "Compte approuvé." : "Compte rejeté." });
      setDecision(null);
      setComment("");
    },
    onError: (e: Error) => setResult({ tone: "error", text: e.message }),
  });

  const header = (
    <AdminPageHeader
      backHref={id ? detailHref : "/home/annuaire"}
      breadcrumb={[{ label: "Déclarants" }, { label: "Établissements", href: "/home/annuaire" }, { label: "Validation du compte" }]}
      title={company?.name ? `Établissements › ${company.name}` : "Validation du compte"}
      subtitle="Registre officiel et détails de l'établissement agréé"
      actions={<AdminHeaderActions />}
    />
  );

  if (!canRead) {
    return (
      <div className="cam-admin-page">
        {header}
        <div role="note" className="cam-admin-notice cam-admin-notice--info">
          <span>Le registre des établissements est réservé aux super-administrateurs.</span>
        </div>
      </div>
    );
  }
  if (!id) {
    return (
      <div className="cam-admin-page">
        {header}
        <p className="cam-admin-empty">— Ouvrez cette page depuis la fiche d&apos;un établissement (paramètre « id » manquant).</p>
      </div>
    );
  }
  if (companyQuery.isLoading) return <div className="cam-admin-page">{header}<p className="cam-admin-empty">Chargement…</p></div>;
  if (companyQuery.isError || !company) {
    return (
      <div className="cam-admin-page">
        {header}
        <div role="alert" className="cam-admin-notice cam-admin-notice--warn">
          <span>
            {companyQuery.isError
              ? `Impossible de charger l'établissement : ${(companyQuery.error as Error).message}`
              : `Aucun établissement ne porte l'identifiant « ${id} ».`}
          </span>
        </div>
      </div>
    );
  }

  const pending = company.user?.status === "PENDING_APPROVAL";
  const blockedReason = !company.user
    ? "Aucun compte n'est rattaché à cet établissement."
    : !canDecide
      ? "La décision sur un compte d'établissement est réservée au super-administrateur plateforme."
      : !pending
        ? "Ce compte n'est pas en attente d'approbation."
        : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!blockedReason && (decision === "approve" || decision === "reject")) mutation.mutate(decision);
  };

  return (
    <div className="cam-admin-page">
      {header}

      <section className="cam-dash-card" aria-label="Établissement">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--cam-space-3)" }}>
          <h2 className="cam-admin-h1" style={{ margin: 0 }}>{dash(company.name)}</h2>
          {company.entityType && <span className="cam-badge cam-badge-neutral">{entityTypeLabel(company.entityType)}</span>}
          {statusBadge(company)}
        </div>
        <p className="cam-admin-meta" style={{ margin: "var(--cam-space-2) 0 0" }}>
          N° RCCM : {dash(company.registrationNumber)} · Secteur : {dash(company.sector?.name)} · Taille : {dash(company.enterpriseSize)}
        </p>
      </section>

      {result && (
        <div role={result.tone === "error" ? "alert" : "status"} className={`cam-admin-notice cam-admin-notice--${result.tone}`}>
          <span>{result.text}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer" onClick={() => setResult(null)}>×</button>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--cam-space-4)", alignItems: "flex-start" }}>
        <section className="cam-dash-card" style={{ flex: "3 1 520px", minWidth: 0 }} aria-labelledby="approb-title">
          <div className="cam-dash-card-head">
            <div>
              <h3 id="approb-title" className="cam-dash-card-title">Validation du compte — {dash(company.name)}</h3>
              <p className="cam-admin-meta" style={{ margin: "var(--cam-space-1) 0 0" }}>Dossier d&apos;inscription en attente d&apos;approbation</p>
            </div>
          </div>

          <p className="cam-admin-meta" style={{ margin: "0 0 var(--cam-space-4)" }}>
            Type : <strong>{dash(entityTypeLabel(company.entityType))}</strong> · Région :{" "}
            <strong>{dash([company.region, company.department].filter(Boolean).join(" / ") || null)}</strong> · Inscrit le :{" "}
            <strong>{formatDate(company.createdAt)}</strong> · Créé par : <strong title="registrationMethod n'est renseigné par aucun flux.">—</strong>
          </p>

          <h4 className="cam-admin-dialog-eyebrow">Documents fournis</h4>
          <p className="cam-admin-meta">— Les pièces d&apos;inscription ne sont pas encore consultables.</p>

          <form onSubmit={submit}>
            <fieldset style={{ border: 0, padding: 0, margin: "var(--cam-space-4) 0", display: "grid", gap: "var(--cam-space-2)" }}>
              <legend className="cam-admin-dialog-eyebrow" style={{ padding: 0, marginBottom: "var(--cam-space-2)" }}>Décision</legend>
              <label className="cam-admin-choice" style={blockedReason ? DIMMED : undefined}>
                <input type="radio" name="decision" value="approve" checked={decision === "approve"} disabled={!!blockedReason} onChange={() => setDecision("approve")} />
                <span>Approuver le compte</span>
              </label>
              <label className="cam-admin-choice" style={blockedReason ? DIMMED : undefined}>
                <input type="radio" name="decision" value="reject" checked={decision === "reject"} disabled={!!blockedReason} onChange={() => setDecision("reject")} />
                <span>Rejeter le compte</span>
              </label>
              <label className="cam-admin-choice" title="Aucun circuit « compléments demandés » n'existe côté serveur." style={DIMMED}>
                <input type="radio" name="decision" value="complements" disabled />
                <span>Demander des compléments</span>
              </label>
            </fieldset>

            <div className="cam-field">
              <label className="cam-label" htmlFor="approb-comment">Motif ou commentaire</label>
              <textarea id="approb-comment" className="cam-admin-textarea" value={comment} disabled={!!blockedReason} onChange={(e) => setComment(e.target.value)} />
              <p className="cam-admin-meta" style={{ margin: "var(--cam-space-1) 0 0" }}>
                Le serveur n&apos;enregistre pas encore ce motif.
              </p>
            </div>

            {blockedReason && <p className="cam-admin-meta" role="status">{blockedReason}</p>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--cam-space-3)", marginTop: "var(--cam-space-4)" }}>
              <Link href={detailHref} className="cam-button cam-button-secondary">Annuler</Link>
              <button
                type="submit"
                className="cam-button cam-button-primary"
                disabled={!!blockedReason || !decision || mutation.isPending}
              >
                {mutation.isPending ? "Enregistrement…" : "Confirmer la décision"}
              </button>
            </div>
          </form>
        </section>

        <div style={{ flex: "2 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
          <Card title="Informations générales">
            <dl className="cam-admin-kv" style={{ gridTemplateColumns: "1fr" }}>
              <div><dt>Raison sociale</dt><dd>{dash(company.name)}</dd></div>
              <div><dt>Année de création</dt><dd>{dash(company.yearOfCreation)}</dd></div>
            </dl>
          </Card>
          <Card title="Informations du compte">
            <dl className="cam-admin-kv" style={{ gridTemplateColumns: "1fr" }}>
              <div><dt>Date d&apos;inscription</dt><dd>{formatDate(company.createdAt)}</dd></div>
              <div><dt>Compte</dt><dd>{dash(company.user?.email)}</dd></div>
              <div><dt>Créé par</dt><dd title="registrationMethod n'est renseigné par aucun flux.">—</dd></div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
