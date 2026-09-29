"use client";

import { useState } from "react";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import type { UserRole } from "@/lib/user-types";

const ALLOWED_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "SUPER_ADMIN_DSMO"];

type Tab = "plateforme" | "securite" | "notifications" | "integration";

const TABS: { key: Tab; label: string }[] = [
  { key: "plateforme", label: "Plateforme" },
  { key: "securite",   label: "Sécurité" },
  { key: "notifications", label: "Notifications" },
  { key: "integration",  label: "Intégration" },
];

export default function ParametresPage() {
  const { isLoading, forbidden } = useAdminScreenGuard(ALLOWED_ROLES);
  const [activeTab, setActiveTab] = useState<Tab>("plateforme");

  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <p className="cam-admin-lede">Accès restreint aux super-administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      {/* Tab bar */}
      <div role="tablist" aria-label="Sections des paramètres" className="cam-admin-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`param-tab-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={`param-panel-${tab.key}`}
            className="cam-admin-tab"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Plateforme */}
      {activeTab === "plateforme" && (
        <div role="tabpanel" id="param-panel-plateforme" aria-labelledby="param-tab-plateforme">
          <div className="cam-param-grid">
            <section className="cam-admin-section" aria-labelledby="param-ident-title">
              <div className="cam-admin-section-head">
                <h2 className="cam-admin-h2" id="param-ident-title">Identité de la plateforme</h2>
              </div>
              <div className="cam-admin-section-body">
                <dl className="cam-admin-kv">
                  <div><dt>Nom de la plateforme</dt><dd>CAM-LEAP · ONEFOP</dd></div>
                  <div><dt>Organisation</dt><dd>ONEFOP / MINEFOP — République du Cameroun</dd></div>
                  <div><dt>Pays</dt><dd>Cameroun 🇨🇲</dd></div>
                  <div><dt>Langue par défaut</dt><dd>Français (FR)</dd></div>
                </dl>
              </div>
            </section>

            <section className="cam-admin-section" aria-labelledby="param-collection-title">
              <div className="cam-admin-section-head">
                <h2 className="cam-admin-h2" id="param-collection-title">Collecte statistique</h2>
              </div>
              <div className="cam-admin-section-body">
                <dl className="cam-admin-kv">
                  <div><dt>Questionnaire actif</dt><dd>ONEFOP v2.1 (AST)</dd></div>
                  <div><dt>Types d'entités pris en charge</dt><dd>6 types employeurs + Formation professionnelle</dd></div>
                  <div><dt>Flux de visa</dt><dd>Divisionnaire → Régional → National</dd></div>
                  <div><dt>Contrôle de cohérence</dt><dd>Consultatif (non bloquant par défaut)</dd></div>
                </dl>
              </div>
            </section>

            <section className="cam-admin-section" aria-labelledby="param-annee-title">
              <div className="cam-admin-section-head">
                <h2 className="cam-admin-h2" id="param-annee-title">Exercice statistique</h2>
              </div>
              <div className="cam-admin-section-body">
                <dl className="cam-admin-kv">
                  <div><dt>Année de référence courante</dt><dd>{new Date().getFullYear() - 1}</dd></div>
                  <div><dt>Période de collecte</dt><dd>Janvier – Décembre</dd></div>
                </dl>
                <p className="cam-admin-meta" style={{ margin: "var(--cam-space-3) 0 0", lineHeight: "var(--cam-line-height-base)" }}>
                  Les paramètres d&apos;exercice sont gérés via la console de gestion des campagnes.
                  Activez une campagne sur la page <strong>Campagnes</strong> pour ouvrir une collecte.
                </p>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Sécurité */}
      {activeTab === "securite" && (
        <div role="tabpanel" id="param-panel-securite" aria-labelledby="param-tab-securite">
          <div className="cam-param-grid">
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
                <div className="cam-admin-notice cam-admin-notice--warning" style={{ marginTop: "var(--cam-space-4)" }}>
                  <span>
                    Le stockage JWT en <code>localStorage</code> est reconnu comme un risque de sécurité.
                    Une migration vers des cookies <code>httpOnly SameSite</code> est planifiée. Toute modification
                    de l&apos;architecture d&apos;authentification requiert une revue de l&apos;équipe sécurité.
                  </span>
                </div>
              </div>
            </section>

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
                <p className="cam-admin-meta" style={{ margin: "var(--cam-space-3) 0 0", lineHeight: "var(--cam-line-height-base)" }}>
                  Les frontières géographiques sont des frontières de sécurité. Le masquage côté client
                  n&apos;est pas une mesure de contrôle d&apos;accès suffisante.
                </p>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Notifications */}
      {activeTab === "notifications" && (
        <div role="tabpanel" id="param-panel-notifications" aria-labelledby="param-tab-notifications">
          <div className="cam-param-grid">
            <section className="cam-admin-section" aria-labelledby="param-email-title">
              <div className="cam-admin-section-head">
                <h2 className="cam-admin-h2" id="param-email-title">Courriel transactionnel</h2>
              </div>
              <div className="cam-admin-section-body">
                <dl className="cam-admin-kv">
                  <div><dt>Fournisseur SMTP</dt><dd>Resend (API)</dd></div>
                  <div><dt>Expéditeur</dt><dd>noreply@onefop.cm</dd></div>
                  <div><dt>Domaine vérifié</dt><dd><span className="cam-pilot-badge" style={{ color: "#b8860b", background: "#fef9e7" }}>En attente de vérification</span></dd></div>
                </dl>
                <div className="cam-admin-notice cam-admin-notice--warning" style={{ marginTop: "var(--cam-space-4)" }}>
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
          </div>
        </div>
      )}

      {/* Intégration */}
      {activeTab === "integration" && (
        <div role="tabpanel" id="param-panel-integration" aria-labelledby="param-tab-integration">
          <div className="cam-param-grid">
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
                <h2 className="cam-admin-h2" id="param-observatory-title">Observatory analytics</h2>
              </div>
              <div className="cam-admin-section-body">
                <dl className="cam-admin-kv">
                  <div><dt>Statut</dt><dd><span className="cam-pilot-badge" style={{ color: "#1a6896", background: "#e8f2ff" }}>En développement</span></dd></div>
                  <div><dt>Périmètre prévu</dt><dd>Indicateurs, tendances, prévisions, diffusion statistique publique</dd></div>
                  <div><dt>Microservice analytique</dt><dd>Python/R (KOICA — planifié)</dd></div>
                </dl>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
