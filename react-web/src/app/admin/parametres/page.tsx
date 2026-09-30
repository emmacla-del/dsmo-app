"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { apiFetch } from "@/lib/api-client";
import { directoryRoleLabel } from "@/lib/user-directory";
import { entityTypeLabel } from "@/lib/companies-directory";
import type { UserRole } from "@/lib/user-types";

const ALLOWED_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "SUPER_ADMIN_DSMO"];

// GET /audit/reports is @Roles(SUPER_ADMIN, SUPER_ADMIN_ONEFOP, AUDITOR) —
// SUPER_ADMIN_DSMO can open this page but would get a 403, so don't call it.
const AUDIT_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP"];
// /admin/utilisateurs has its own guard: SUPER_ADMIN, SUPER_ADMIN_ONEFOP.
const AGENTS_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP"];

type Tab = "general" | "utilisateurs" | "territoires" | "etablissements" | "notifications" | "securite" | "integration";

// Figma order, plus "Intégration" retained from the previous tab bar.
const TABS: { key: Tab; label: string }[] = [
  { key: "general",        label: "Général" },
  { key: "utilisateurs",   label: "Utilisateurs & Rôles" },
  { key: "territoires",    label: "Régions & Territoires" },
  { key: "etablissements", label: "Types d'Établissement" },
  { key: "notifications",  label: "Notifications" },
  { key: "securite",       label: "Sécurité & Audit" },
  { key: "integration",    label: "Intégration" },
];

// Territorial hierarchy (CLAUDE.md §14). Read-only reference — role changes
// happen per account on /admin/utilisateurs, never here.
const ROLE_SCOPES: { role: UserRole; scope: string }[] = [
  { role: "SUPER_ADMIN",        scope: "Périmètre plateforme : configuration, comptes et toutes les données." },
  { role: "SUPER_ADMIN_ONEFOP", scope: "Administration du volet ONEFOP à l'échelle nationale." },
  { role: "SUPER_ADMIN_DSMO",   scope: "Administration du volet DSMO à l'échelle nationale." },
  { role: "CENTRAL",            scope: "Périmètre national : visas nationaux et arbitrages." },
  { role: "REGIONAL",           scope: "Périmètre de sa région : contrôle et visas régionaux." },
  { role: "DIVISIONAL",         scope: "Périmètre de son département : premier contrôle des dossiers." },
];

const ENTITY_TYPES = ["ENTREPRISE", "ADMINISTRATION", "PROJECT_PROGRAM", "VOCATIONAL_TRAINING", "COOPERATIVE", "CTD", "ONG"];

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  details: unknown;
  timestamp: string;
  user: { firstName: string | null; lastName: string | null; email: string } | null;
}

function auditWhen(iso: string): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (hours < 48) return `Hier, ${time}`;
  return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}, ${time}`;
}

function auditWho(e: AuditEntry): string {
  if (!e.user) return "Système";
  return [e.user.firstName, e.user.lastName].filter(Boolean).join(" ").trim() || e.user.email;
}

function auditWhat(e: AuditEntry): string {
  if (typeof e.details === "string" && e.details.trim()) return e.details;
  return `${e.action} · ${e.resourceType}`;
}

function RecentAudit({ enabled }: { enabled: boolean }) {
  const auditQuery = useQuery({
    queryKey: ["admin", "parametres", "audit"],
    queryFn: () => apiFetch<AuditEntry[]>("/audit/reports?limit=5"),
    enabled,
  });

  // TODO(frontend, M): Figma "Voir le journal complet →" needs /admin/journal-audit (not built)
  return (
    <section className="cam-admin-section" aria-labelledby="param-audit-title">
      <div className="cam-admin-section-head">
        <h2 className="cam-admin-h2" id="param-audit-title">Journal d&apos;audit récent</h2>
      </div>
      <div className="cam-admin-section-body">
        {!enabled ? (
          <p className="cam-admin-meta">Le journal d&apos;audit est réservé aux super-administrateurs plateforme et ONEFOP.</p>
        ) : auditQuery.isLoading ? (
          <p className="cam-admin-meta">Chargement…</p>
        ) : auditQuery.isError ? (
          <div className="cam-admin-notice cam-admin-notice--error" role="alert">
            <span>Impossible de charger le journal d&apos;audit.</span>
          </div>
        ) : !auditQuery.data?.length ? (
          <p className="cam-admin-meta">Aucune entrée dans le journal d&apos;audit.</p>
        ) : (
          <ol className="cam-param-audit">
            {auditQuery.data.map((e) => (
              <li key={e.id}>
                <time dateTime={e.timestamp}>{auditWhen(e.timestamp)}</time>
                <strong>{auditWho(e)}</strong>
                <span>{auditWhat(e)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function RolesSummary({ canManageAgents }: { canManageAgents: boolean }) {
  return (
    <section className="cam-admin-section" aria-labelledby="param-roles-title">
      <div className="cam-admin-section-head">
        <h2 className="cam-admin-h2" id="param-roles-title">Rôles &amp; permissions</h2>
        {canManageAgents && (
          <Link href="/admin/utilisateurs" className="cam-text-button">Gérer les agents →</Link>
        )}
      </div>
      <div className="cam-admin-section-body">
        <dl className="cam-param-roles">
          {ROLE_SCOPES.map(({ role, scope }) => (
            <div key={role}>
              <dt>{directoryRoleLabel(role)}</dt>
              <dd>{scope}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export default function ParametresPage() {
  const { isLoading, forbidden, user } = useAdminScreenGuard(ALLOWED_ROLES);
  const [activeTab, setActiveTab] = useState<Tab>("general");

  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <p className="cam-admin-lede">Accès restreint aux super-administrateurs.</p>
      </div>
    );
  }

  const role = user?.role;
  const canReadAudit = !!role && AUDIT_ROLES.includes(role);
  const canManageAgents = !!role && AGENTS_ROLES.includes(role);

  return (
    <div className="cam-admin-page">
      <div className="cam-param-layout">
        <div role="tablist" aria-label="Sections des paramètres" aria-orientation="vertical" className="cam-param-nav">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`param-tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`param-panel-${tab.key}`}
              className="cam-param-nav-item"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`param-panel-${activeTab}`} aria-labelledby={`param-tab-${activeTab}`} className="cam-param-panel">
          {activeTab === "general" && (
            <>
              <section className="cam-admin-section" aria-labelledby="param-ident-title">
                <div className="cam-admin-section-head">
                  <h2 className="cam-admin-h2" id="param-ident-title">Informations de l&apos;observatoire</h2>
                </div>
                <div className="cam-admin-section-body">
                  <dl className="cam-admin-kv">
                    <div><dt>Nom de la plateforme</dt><dd>CAM-LEAP · ONEFOP</dd></div>
                    <div><dt>Organisation</dt><dd>ONEFOP / MINEFOP — République du Cameroun</dd></div>
                    <div><dt>Pays</dt><dd>Cameroun</dd></div>
                    <div><dt>Langue par défaut</dt><dd>Français (FR)</dd></div>
                  </dl>
                </div>
              </section>

              <section className="cam-admin-section" aria-labelledby="param-collection-title">
                <div className="cam-admin-section-head">
                  <h2 className="cam-admin-h2" id="param-collection-title">Paramètres de collecte</h2>
                </div>
                <div className="cam-admin-section-body">
                  <dl className="cam-admin-kv">
                    <div><dt>Questionnaire actif</dt><dd>ONEFOP v2.1 (AST)</dd></div>
                    <div><dt>Flux de visa</dt><dd>Divisionnaire → Régional → National</dd></div>
                    <div><dt>Contrôle de cohérence</dt><dd>Consultatif (non bloquant par défaut)</dd></div>
                    <div><dt>Année de référence courante</dt><dd>{new Date().getFullYear() - 1}</dd></div>
                    <div><dt>Période de collecte</dt><dd>Janvier – Décembre</dd></div>
                  </dl>
                  <p className="cam-admin-meta cam-param-note">
                    Les campagnes de collecte (ouverture, échéances, clôture) se gèrent sur la page{" "}
                    <Link href="/admin/campagnes">Campagnes</Link>.
                  </p>
                </div>
              </section>

              <RolesSummary canManageAgents={canManageAgents} />
              <RecentAudit enabled={canReadAudit} />
            </>
          )}

          {activeTab === "utilisateurs" && (
            <>
              <RolesSummary canManageAgents={canManageAgents} />
              <section className="cam-admin-section" aria-labelledby="param-rbac-title">
                <div className="cam-admin-section-head">
                  <h2 className="cam-admin-h2" id="param-rbac-title">Contrôle d&apos;accès (RBAC)</h2>
                </div>
                <div className="cam-admin-section-body">
                  <dl className="cam-admin-kv">
                    <div><dt>Modèle</dt><dd>Rôle unique par compte, frontière géographique stricte</dd></div>
                    <div><dt>Niveaux</dt><dd>SUPER_ADMIN → CENTRAL → REGIONAL → DIVISIONAL</dd></div>
                    <div><dt>Isolation géographique</dt><dd>Appliquée côté serveur (NestJS @Roles + guards)</dd></div>
                  </dl>
                </div>
              </section>
            </>
          )}

          {activeTab === "territoires" && (
            <section className="cam-admin-section" aria-labelledby="param-territ-title">
              <div className="cam-admin-section-head">
                <h2 className="cam-admin-h2" id="param-territ-title">Périmètres géographiques</h2>
              </div>
              <div className="cam-admin-section-body">
                <dl className="cam-admin-kv">
                  <div><dt>Divisionnaire</dt><dd>Département</dd></div>
                  <div><dt>Régional</dt><dd>Région</dd></div>
                  <div><dt>Central</dt><dd>National</dd></div>
                  <div><dt>Super administrateur</dt><dd>Toute la plateforme</dd></div>
                </dl>
                <p className="cam-admin-meta cam-param-note">
                  Les frontières géographiques sont des frontières de sécurité. Le masquage côté client
                  n&apos;est pas une mesure de contrôle d&apos;accès suffisante.
                </p>
              </div>
            </section>
          )}

          {activeTab === "etablissements" && (
            <section className="cam-admin-section" aria-labelledby="param-types-title">
              <div className="cam-admin-section-head">
                <h2 className="cam-admin-h2" id="param-types-title">Types d&apos;établissement pris en charge</h2>
              </div>
              <div className="cam-admin-section-body">
                <ul className="cam-param-list">
                  {ENTITY_TYPES.map((t) => <li key={t}>{entityTypeLabel(t)}</li>)}
                </ul>
                <p className="cam-admin-meta cam-param-note">
                  La liste des types est définie par le questionnaire ONEFOP (AST canonique) et ne se modifie pas depuis cette console.
                </p>
              </div>
            </section>
          )}

          {activeTab === "notifications" && (
            <>
              <section className="cam-admin-section" aria-labelledby="param-email-title">
                <div className="cam-admin-section-head">
                  <h2 className="cam-admin-h2" id="param-email-title">Courriel transactionnel</h2>
                </div>
                <div className="cam-admin-section-body">
                  <dl className="cam-admin-kv">
                    <div><dt>Fournisseur SMTP</dt><dd>Resend (API)</dd></div>
                    <div><dt>Expéditeur</dt><dd>noreply@onefop.cm</dd></div>
                    <div><dt>Domaine vérifié</dt><dd>En attente de vérification</dd></div>
                  </dl>
                  <div className="cam-admin-notice cam-admin-notice--warn cam-param-note">
                    <span>
                      La livraison des courriels est actuellement peu fiable. Le domaine Resend n&apos;est pas encore vérifié
                      et le SMTP est inaccessible depuis Render. Les échecs sont des régressions pré-existantes.
                    </span>
                  </div>
                </div>
              </section>

              <section className="cam-admin-section" aria-labelledby="param-rappels-title">
                <div className="cam-admin-section-head">
                  <h2 className="cam-admin-h2" id="param-rappels-title">Rappels automatiques</h2>
                </div>
                <div className="cam-admin-section-body">
                  <dl className="cam-admin-kv">
                    <div><dt>Types disponibles</dt><dd>Annonce, Approche d&apos;échéance, Dernier rappel, Prorogation</dd></div>
                    <div><dt>Déclenchement manuel</dt><dd>Page Campagnes → bouton &laquo; Envoyer un rappel &raquo;</dd></div>
                    <div><dt>Expiration automatique</dt><dd>Planifié par le scheduler Render à la date de clôture</dd></div>
                  </dl>
                </div>
              </section>
            </>
          )}

          {activeTab === "securite" && (
            <>
              <section className="cam-admin-section" aria-labelledby="param-auth-title">
                <div className="cam-admin-section-head">
                  <h2 className="cam-admin-h2" id="param-auth-title">Authentification</h2>
                </div>
                <div className="cam-admin-section-body">
                  <dl className="cam-admin-kv">
                    <div><dt>Mécanisme</dt><dd>JWT (Bearer token, localStorage)</dd></div>
                    <div><dt>Durée de session</dt><dd>Configurable via variable d&apos;environnement</dd></div>
                    <div><dt>Réinitialisation mot de passe</dt><dd>Par courriel (lien sécurisé)</dd></div>
                  </dl>
                  <div className="cam-admin-notice cam-admin-notice--warn cam-param-note">
                    <span>
                      Le stockage JWT en <code>localStorage</code> est reconnu comme un risque de sécurité.
                      Une migration vers des cookies <code>httpOnly SameSite</code> est planifiée. Toute modification
                      de l&apos;architecture d&apos;authentification requiert une revue de l&apos;équipe sécurité.
                    </span>
                  </div>
                </div>
              </section>
              <RecentAudit enabled={canReadAudit} />
            </>
          )}

          {activeTab === "integration" && (
            <>
              <section className="cam-admin-section" aria-labelledby="param-api-title">
                <div className="cam-admin-section-head">
                  <h2 className="cam-admin-h2" id="param-api-title">API backend</h2>
                </div>
                <div className="cam-admin-section-body">
                  <dl className="cam-admin-kv">
                    <div><dt>Framework</dt><dd>NestJS + TypeScript</dd></div>
                    <div><dt>ORM</dt><dd>Prisma + PostgreSQL (Supabase)</dd></div>
                    <div><dt>Hébergement</dt><dd>Render (production)</dd></div>
                    <div><dt>Authentification API</dt><dd>JWT Bearer</dd></div>
                  </dl>
                </div>
              </section>

              <section className="cam-admin-section" aria-labelledby="param-exports-title">
                <div className="cam-admin-section-head">
                  <h2 className="cam-admin-h2" id="param-exports-title">Formats d&apos;export statistique</h2>
                </div>
                <div className="cam-admin-section-body">
                  <dl className="cam-admin-kv">
                    <div><dt>IBM SPSS</dt><dd>.sav (données) + .sps (syntaxe) — Page &laquo; Données et exports &raquo;</dd></div>
                    <div><dt>Microsoft Excel</dt><dd>.xlsx multifeuillets par type d&apos;entité</dd></div>
                    <div><dt>PDF officiel</dt><dd>Généré à la soumission, re-génération disponible</dd></div>
                  </dl>
                </div>
              </section>

              <section className="cam-admin-section" aria-labelledby="param-observatory-title">
                <div className="cam-admin-section-head">
                  <h2 className="cam-admin-h2" id="param-observatory-title">Observatoire — analyses</h2>
                </div>
                <div className="cam-admin-section-body">
                  <dl className="cam-admin-kv">
                    <div><dt>Statut</dt><dd>En développement</dd></div>
                    <div><dt>Périmètre prévu</dt><dd>Indicateurs, tendances, prévisions, diffusion statistique publique</dd></div>
                    <div><dt>Microservice analytique</dt><dd>Python/R (KOICA — planifié)</dd></div>
                  </dl>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
