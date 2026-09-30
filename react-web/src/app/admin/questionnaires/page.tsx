"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { listAdminQuestionnaires } from "@/lib/api-client";
import { useOnefopSchema } from "@/lib/use-onefop-schema";
import { entityTypeLabel } from "@/lib/companies-directory";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";

// UI shell for the "Questionnaires" frame (collecte/questionnaires.png).
// The questionnaire structure is owned by the canonical AST
// (lib/core/focus/compiler/onefop_ast.dart); this page only READS the
// generated public/schemas/onefop.schema.json for section counts and never
// edits it. Wiring gaps: docs/admin-replacement/ui-wiring-todo.md.
// No page-level role gate is added.

// Class-level @Roles on AdminQuestionnairesController (GET /admin/questionnaires).
const SUBMISSION_ROLES = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "CENTRAL", "REGIONAL", "DIVISIONAL"];

// Generated schema entity key → OnefopSubmission.formType.
const QUESTIONNAIRES: { schemaKey: string; formType: string }[] = [
  { schemaKey: "enterprise", formType: "ENTREPRISE" },
  { schemaKey: "cooperative", formType: "COOPERATIVE" },
  { schemaKey: "administration", formType: "ADMINISTRATION" },
  { schemaKey: "projectProgram", formType: "PROJECT_PROGRAM" },
  { schemaKey: "ctd", formType: "CTD" },
  { schemaKey: "ong", formType: "ONG" },
  { schemaKey: "vocationalTraining", formType: "VOCATIONAL_TRAINING" },
];

const DISABLED = { opacity: 0.55, cursor: "not-allowed" } as const;

function FileIcon() {
  return (
    <span className="cam-pilot-kpi-icon" aria-hidden="true" style={{ background: "var(--cam-accent-soft)", color: "var(--cam-green)" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    </span>
  );
}

export default function QuestionnairesPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canReadSubmissions = !!role && SUBMISSION_ROLES.includes(role);
  const schemaQuery = useOnefopSchema();

  // limit=1: only `total` is used (territory-scoped server-side, drafts excluded).
  const totals = useQueries({
    queries: QUESTIONNAIRES.map((q) => ({
      queryKey: ["admin", "questionnaires", "total", q.formType],
      queryFn: () => listAdminQuestionnaires({ formType: q.formType, limit: 1 }),
      enabled: canReadSubmissions,
    })),
  });

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Collecte" }, { label: "Questionnaires" }]}
        title="Questionnaires"
        subtitle="Types de fiches de déclaration nationale gérées par l'ONEFOP"
        actions={
          <>
            <AdminHeaderActions />
            <button
              type="button"
              className="cam-button cam-button-primary"
              disabled
              style={DISABLED}
              title="La structure des questionnaires est définie par l'AST canonique, pas depuis cette console."
            >
              + Nouveau questionnaire
            </button>
          </>
        }
      />

      {schemaQuery.isError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>Le schéma ONEFOP n&apos;a pas pu être chargé : {(schemaQuery.error as Error).message}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--cam-space-4)" }}>
        {QUESTIONNAIRES.map((q, i) => {
          const entity = schemaQuery.data?.entities[q.schemaKey];
          const totalQuery = totals[i];
          const total = !canReadSubmissions || totalQuery.isError
            ? "—"
            : totalQuery.data ? totalQuery.data.total.toLocaleString("fr-FR") : "…";
          return (
            <section key={q.formType} className="cam-dash-card" aria-labelledby={`q-${q.formType}`}>
              <div className="cam-pilot-kpi-top">
                <FileIcon />
                {/* Questionnaire status lives in the canonical AST, not in any endpoint. */}
                <span className="cam-badge cam-badge-neutral" title="Le statut du questionnaire n'est exposé par aucune source.">Statut —</span>
              </div>
              <h3 id={`q-${q.formType}`} className="cam-dash-card-title" style={{ marginTop: "var(--cam-space-3)" }}>
                {entityTypeLabel(q.formType)}
              </h3>
              <p className="cam-admin-meta" style={{ margin: "var(--cam-space-1) 0 var(--cam-space-4)" }}>
                {entity ? `${entity.sectionCount} sections d'enquête` : schemaQuery.isLoading ? "…" : "— sections"}
              </p>
              <div className="cam-dash-metric-row">
                <span>Total soumissions</span>
                <strong title={canReadSubmissions ? "Dans votre ressort, brouillons exclus" : "Non accessible à votre rôle"}>{total}</strong>
              </div>
              <div className="cam-dash-metric-row" style={{ marginTop: "var(--cam-space-2)" }}>
                <span>Taux de complétion</span>
                <strong title="Aucune définition ni donnée du taux de complétion par questionnaire.">—</strong>
              </div>
              <div style={{ display: "flex", gap: "var(--cam-space-3)", marginTop: "var(--cam-space-5)" }}>
                {canReadSubmissions ? (
                  <Link href="/admin/dossiers" className="cam-button cam-button-primary cam-button-sm" style={{ flex: 1, justifyContent: "center" }}>
                    Voir soumissions
                  </Link>
                ) : (
                  <button type="button" className="cam-button cam-button-primary cam-button-sm" disabled style={{ ...DISABLED, flex: 1 }} title="Liste des dossiers non accessible à votre rôle.">
                    Voir soumissions
                  </button>
                )}
                <button
                  type="button"
                  className="cam-button cam-button-secondary cam-button-sm"
                  disabled
                  style={{ ...DISABLED, flex: 1 }}
                  title="Visionneuse de l'AST canonique non disponible."
                >
                  Aperçu
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {/* Placeholder for the AST viewer (wiring row Type=DECISION). */}
      <section className="cam-dash-card" aria-labelledby="q-viewer-title">
        <div className="cam-dash-card-head">
          <h3 id="q-viewer-title" className="cam-dash-card-title">Aperçu du questionnaire</h3>
        </div>
        <p className="cam-dash-empty">
          — La visionneuse de l&apos;AST canonique n&apos;existe pas encore : son contenu et son modèle doivent d&apos;abord
          être arbitrés.
        </p>
        {schemaQuery.data && (
          <p className="cam-admin-meta">
            Schéma généré v{schemaQuery.data.schemaVersion} : {schemaQuery.data.astTotals.sections} sections,{" "}
            {schemaQuery.data.astTotals.questions} questions au total.
          </p>
        )}
      </section>
    </div>
  );
}
