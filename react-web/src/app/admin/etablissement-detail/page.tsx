"use client";

import { Suspense, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { activateUser, deleteUser, suspendUser } from "@/lib/user-directory";
import { dash, entityTypeLabel, formatDate, listCompanies, type Company } from "@/lib/companies-directory";
import { auditActionLabel, auditActorName, auditDetailsSummary, listAuditLog } from "@/lib/audit-log";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";

// UI shell for the establishment detail frame (declarants/etablissements/_id.png)
// and its "Gestion du compte utilisateur" dialog. D5: no company-side roles,
// no admin user creation for a company — the multi-user section is a
// placeholder. Wiring gaps: docs/admin-replacement/ui-wiring-todo.md.
// No page-level role gate is added: each call is made only for the roles its
// endpoint accepts.
//
// ?id=<establishmentId>. There is no GET-by-id for companies: the page uses
// GET /dsmo/companies?search=<id> and keeps the exact establishmentId match.

const DIRECTORY_ROLES = ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP"]; // GET /dsmo/companies
const ACCOUNT_ROLES = ["SUPER_ADMIN"]; // /auth/users/:id/* on a COMPANY account (staff-scope.ts)
const AUDIT_ROLES = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "AUDITOR"]; // GET /audit/reports

const DISABLED = { opacity: 0.55, cursor: "not-allowed" } as const;

export default function EtablissementDetailPage() {
  return (
    <Suspense fallback={null}>
      <EtablissementDetail />
    </Suspense>
  );
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="cam-dash-card" aria-label={title}>
      <div className="cam-dash-card-head">
        <h3 className="cam-dash-card-title">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kv({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="cam-admin-kv" style={{ gridTemplateColumns: "1fr" }}>
      {rows.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

const Missing = ({ reason }: { reason: string }) => <span title={reason} className="cam-admin-muted">—</span>;

function accountBadge(c: Company) {
  if (!c.user) return <AdminStatusBadge label="Sans compte" variant="neutral" />;
  if (c.user.status === "PENDING_APPROVAL") return <AdminStatusBadge label="En attente" variant="pending" />;
  if (c.user.status === "REJECTED") return <AdminStatusBadge label="Rejeté" variant="rejected" />;
  return c.user.isActive
    ? <AdminStatusBadge label="Actif" variant="active" />
    : <AdminStatusBadge label="Suspendu" variant="rejected" />;
}

function Lookup({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) router.push(`/admin/etablissement-detail?id=${encodeURIComponent(value.trim())}`);
  };
  return (
    <form onSubmit={submit} className="cam-admin-filters" style={{ maxWidth: 560 }}>
      <div className="cam-field">
        <label className="cam-label" htmlFor="etab-id">Identifiant de l&apos;établissement</label>
        <input id="etab-id" className="cam-input" placeholder="ENT-2026-…" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <div><button type="submit" className="cam-button cam-button-primary" disabled={!value.trim()}>Afficher</button></div>
    </form>
  );
}

function EtablissementDetail() {
  const id = useSearchParams().get("id")?.trim() ?? "";
  const role = useAuthStore((s) => s.user?.role);
  const canRead = !!role && DIRECTORY_ROLES.includes(role);
  const canManageAccount = !!role && ACCOUNT_ROLES.includes(role);
  const canReadAudit = !!role && AUDIT_ROLES.includes(role);
  const [accountOpen, setAccountOpen] = useState(false);

  const companyQuery = useQuery({
    queryKey: ["dsmo", "companies", "by-establishment-id", id],
    queryFn: async () => {
      const res = await listCompanies({ search: id, pageSize: 20 });
      return res.companies.find((c) => c.establishmentId === id) ?? null;
    },
    enabled: canRead && !!id,
  });
  const company = companyQuery.data ?? null;

  const auditQuery = useQuery({
    queryKey: ["audit", "by-resource", company?.user?.id],
    queryFn: () => listAuditLog({ resourceId: company!.user!.id, limit: 4, offset: 0 }),
    enabled: canReadAudit && !!company?.user?.id,
  });

  const header = (
    <AdminPageHeader
      backHref="/home/annuaire"
      breadcrumb={[{ label: "Déclarants" }, { label: "Établissements", href: "/home/annuaire" }, { label: company?.name ?? "Détail" }]}
      title={company?.name ? `Établissements › ${company.name}` : "Détail de l'établissement"}
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

  if (!id || companyQuery.data === null) {
    return (
      <div className="cam-admin-page">
        {header}
        {id && <div role="alert" className="cam-admin-notice cam-admin-notice--warn"><span>Aucun établissement ne porte l&apos;identifiant « {id} ».</span></div>}
        <Lookup initial={id} />
      </div>
    );
  }

  if (companyQuery.isLoading) return <div className="cam-admin-page">{header}<p className="cam-admin-empty">Chargement…</p></div>;
  if (companyQuery.isError || !company) {
    return (
      <div className="cam-admin-page">
        {header}
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>Impossible de charger l&apos;établissement : {(companyQuery.error as Error | null)?.message ?? "—"}</span>
        </div>
      </div>
    );
  }

  const respondent = [company.respondentFirstName, company.respondentLastName].filter(Boolean).join(" ");
  const suspended = !!company.user && company.user.status === "ACTIVE" && !company.user.isActive;

  return (
    <div className="cam-admin-page">
      {header}

      <section className="cam-dash-card" aria-label="Établissement">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "var(--cam-space-4)", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--cam-space-3)" }}>
              <h2 className="cam-admin-h1" style={{ margin: 0 }}>{dash(company.name)}</h2>
              {company.entityType && <span className="cam-badge cam-badge-neutral">{entityTypeLabel(company.entityType)}</span>}
              {accountBadge(company)}
            </div>
            <p className="cam-admin-meta" style={{ margin: "var(--cam-space-2) 0 0" }}>
              N° RCCM : {dash(company.registrationNumber)} · Identifiant : {dash(company.establishmentId)} · NIU : {dash(company.taxNumber)}
            </p>
          </div>
          <div style={{ display: "flex", gap: "var(--cam-space-3)" }}>
            <button type="button" className="cam-button cam-button-secondary" disabled style={DISABLED} title="Aucun endpoint d'édition d'établissement pour l'administration.">
              Modifier
            </button>
            <Link
              href={`/admin/etablissement-detail/approbation?id=${encodeURIComponent(id)}`}
              className="cam-button cam-button-secondary"
            >
              Validation du compte
            </Link>
          </div>
        </div>
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--cam-space-4)", alignItems: "flex-start" }}>
        <div style={{ flex: "3 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
          <Card title="Informations générales">
            <Kv rows={[
              ["Raison sociale", dash(company.name)],
              ["Année de création", dash(company.yearOfCreation)],
              ["Branche d'activité", dash(company.sector?.name ?? company.mainActivity)],
              ["Téléphone", dash(company.phone)],
              ["Adresse", dash([company.address, company.subdivision].filter(Boolean).join(", ") || null)],
              ["Responsable", respondent ? `${respondent}${company.respondentFunction ? ` — ${company.respondentFunction}` : ""}` : "—"],
            ]} />
          </Card>
          <Card title="Historique des soumissions">
            <p className="cam-dash-empty">— Aucun endpoint ne liste les soumissions d&apos;un établissement donné.</p>
          </Card>
        </div>

        <div style={{ flex: "2 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
          <Card title="Comptes utilisateurs rattachés">
            {company.user ? (
              <div className="cam-dash-metric-row" style={{ alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{respondent || company.user.email}</div>
                  <div className="cam-admin-meta">{company.user.email} · Dernière connexion : <Missing reason="lastLoginAt n'est pas encore écrit à la connexion." /></div>
                </div>
                <button type="button" className="cam-text-button" onClick={() => setAccountOpen(true)}>Gérer</button>
              </div>
            ) : (
              <p className="cam-dash-empty">Aucun compte rattaché.</p>
            )}
            {/* Placeholder: multi-user establishments (wiring row Type=DECISION, D5). */}
            <p className="cam-admin-meta" style={{ marginTop: "var(--cam-space-3)" }}>
              — Un établissement n&apos;a qu&apos;un compte aujourd&apos;hui ; plusieurs comptes rattachés nécessitent une décision de modèle.
            </p>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled style={DISABLED} title="Pas de modèle multi-utilisateurs (D5).">
              + Ajouter un utilisateur
            </button>
          </Card>

          <Card title="Informations du compte">
            <Kv rows={[
              ["Date d'inscription", formatDate(company.createdAt)],
              ["Créé par", <Missing key="c" reason="createdBy n'est renseigné par aucun flux." />],
              ["Méthode", <Missing key="m" reason="registrationMethod n'est renseigné par aucun flux." />],
              ["Localisation", dash([company.department, company.region].filter(Boolean).join(", ") || null)],
              ["Dernière modification", <Missing key="u" reason="Aucun champ updatedBy sur l'établissement." />],
              ["Statut de vérification", <Missing key="v" reason="Pas de vérification des pièces enregistrée." />],
            ]} />
          </Card>

          <Card
            title="Journal d'audit"
            action={canReadAudit ? <Link href="/admin/journal-audit" className="cam-dash-link">Voir le journal complet →</Link> : undefined}
          >
            {!canReadAudit ? (
              <p className="cam-dash-empty">— Le journal d&apos;audit n&apos;est pas accessible à votre rôle.</p>
            ) : !company.user ? (
              <p className="cam-dash-empty">—</p>
            ) : auditQuery.isLoading ? (
              <p className="cam-dash-empty">Chargement…</p>
            ) : auditQuery.isError ? (
              <p className="cam-dash-empty">Impossible de charger le journal : {(auditQuery.error as Error).message}</p>
            ) : !auditQuery.data?.items.length ? (
              <p className="cam-dash-empty">Aucune entrée pour ce compte.</p>
            ) : (
              <ol className="cam-dash-timeline">
                {auditQuery.data.items.map((e) => (
                  <li key={e.id}>
                    <span className="cam-dash-timeline-time">{formatDate(e.timestamp)}</span>
                    <span className="cam-dash-timeline-dot" style={{ background: "var(--cam-green)" }} aria-hidden="true" />
                    <span className="cam-dash-timeline-body">
                      <strong>{auditActorName(e)}</strong> — {auditActionLabel(e.action)}
                      <span className="cam-dash-tag">{auditDetailsSummary(e)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      {company.user && (
        <AccountDialog
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          company={company}
          canManage={canManageAccount}
          suspended={suspended}
        />
      )}
    </div>
  );
}

function ActionRow({ title, text, children }: { title: string; text: ReactNode; children: ReactNode }) {
  return (
    <div className="cam-dash-metric-row" style={{ alignItems: "center", padding: "var(--cam-space-3) 0", borderBottom: "var(--cam-border-width) solid var(--cam-border)" }}>
      <div>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div className="cam-admin-meta">{text}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function AccountDialog({ open, onClose, company, canManage, suspended }: {
  open: boolean; onClose: () => void; company: Company; canManage: boolean; suspended: boolean;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const user = company.user!;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["dsmo", "companies"] });

  const toggleMutation = useMutation({
    mutationFn: () => (suspended ? activateUser(user.id) : suspendUser(user.id)),
    onSuccess: () => { setError(null); refresh(); },
    onError: (e: Error) => setError(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(user.id),
    onSuccess: () => { refresh(); router.push("/home/annuaire"); },
    onError: (e: Error) => setError(e.message),
  });
  const notAllowed = "Action réservée au super-administrateur plateforme.";
  const gate = canManage ? {} : { disabled: true, style: DISABLED, title: notAllowed };

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      wide
      eyebrow={`${company.name ?? "—"} — compte créé le ${formatDate(company.createdAt)}`}
      title="Gestion du compte utilisateur"
      footer={
        <>
          <span className="cam-admin-meta" style={{ marginRight: "auto" }}>Les actions sont enregistrées dans le journal d&apos;audit.</span>
          <button type="button" className="cam-button cam-button-secondary" onClick={onClose}>Fermer</button>
        </>
      }
    >
      <p className="cam-admin-meta">{user.email}</p>
      {error && <div role="alert" className="cam-admin-notice cam-admin-notice--error"><span>{error}</span></div>}

      <h4 className="cam-admin-dialog-eyebrow">Actions sur le compte</h4>
      <ActionRow title="Réinitialiser le mot de passe" text="La réinitialisation par administrateur est désactivée côté serveur.">
        <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled style={DISABLED} title="POST /auth/admin/reset-password est temporairement indisponible.">Envoyer le lien</button>
      </ActionRow>
      <ActionRow title="Déverrouiller le compte" text="—">
        <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled style={DISABLED} title="Aucun endpoint de déverrouillage.">Déverrouiller</button>
      </ActionRow>
      <ActionRow title="Renvoyer l'e-mail de vérification" text="—">
        <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled style={DISABLED} title="Le renvoi n'existe que pour l'utilisateur connecté lui-même.">Renvoyer</button>
      </ActionRow>
      <ActionRow title="Réinitialiser la session" text="—">
        <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled style={DISABLED} title="Invalidation de session non prise en charge.">Réinitialiser</button>
      </ActionRow>

      <h4 className="cam-admin-dialog-eyebrow">Historique des connexions récentes</h4>
      <p className="cam-admin-meta">— Aucun historique de connexion n&apos;est enregistré.</p>

      <h4 className="cam-admin-dialog-eyebrow" style={{ color: "var(--cam-error)" }}>Zone dangereuse</h4>
      <ActionRow
        title={suspended ? "Réactiver le compte" : "Désactiver le compte"}
        text={suspended ? "L'utilisateur pourra de nouveau se connecter." : "L'utilisateur ne pourra plus se connecter. Les données sont conservées."}
      >
        <button type="button" className={`cam-button cam-button-sm ${suspended ? "cam-button-primary" : "cam-button-danger"}`} {...gate}
          disabled={!canManage || toggleMutation.isPending} onClick={() => toggleMutation.mutate()}>
          {suspended ? "Réactiver" : "Désactiver"}
        </button>
      </ActionRow>
      <ActionRow title="Supprimer le compte" text="Suppression définitive. Refusée par le serveur si des données sont liées.">
        {confirmDelete ? (
          <span style={{ display: "inline-flex", gap: "var(--cam-space-2)" }}>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setConfirmDelete(false)}>Annuler</button>
            <button type="button" className="cam-button cam-button-danger cam-button-sm" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>Confirmer</button>
          </span>
        ) : (
          <button type="button" className="cam-button cam-button-secondary cam-button-sm" {...gate} onClick={() => setConfirmDelete(true)}>Supprimer</button>
        )}
      </ActionRow>
    </AdminDialog>
  );
}
