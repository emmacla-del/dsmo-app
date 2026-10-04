"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { listAdminQuestionnaires } from "@/lib/api-client";
import { useOnefopSchema } from "@/lib/use-onefop-schema";
import { entityTypeLabel } from "@/lib/companies-directory";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";

import { count, NOT_PROVIDED, METRIC_UNAVAILABLE } from "@/lib/admin-data-state";
import { APPROVAL_ROLES } from "@/lib/roles";

// UI for the "Questionnaires" frame (collecte/questionnaires.png).
// The questionnaire structure is owned by the canonical AST
// (lib/core/focus/compiler/onefop_ast.dart); this page reads the
// generated public/schemas/onefop.schema.json for section counts and schema details.

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

function FileIcon() {
  return (
    <span className="cam-pilot-kpi-icon" aria-hidden="true" style={{ background: "rgba(30,107,58,0.12)", color: "var(--cam-green)" }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    </span>
  );
}

export default function QuestionnairesPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canReadSubmissions = !!role && APPROVAL_ROLES.includes(role);
  const schemaQuery = useOnefopSchema();
  const [selectedPreview, setSelectedPreview] = useState<{ schemaKey: string; formType: string } | null>(null);

  // Queries for totals
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
        title="Questionnaires Homologués ONEFOP"
        subtitle="Modèles nationaux de fiches d'enquête et de déclaration pour le recueil statistique DSMO"
        actions={<AdminHeaderActions />}
      />

      {schemaQuery.isError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>Le schéma ONEFOP n&apos;a pas pu être chargé : {(schemaQuery.error as Error).message}</span>
        </div>
      )}

      {/* Grid of 7 Questionnaires */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--cam-space-4)" }}>
        {QUESTIONNAIRES.map((q, i) => {
          const entity = schemaQuery.data?.entities[q.schemaKey];
          const totalQuery = totals[i];
          const total = !canReadSubmissions || totalQuery.isError
            ? NOT_PROVIDED
            : totalQuery.data ? count(totalQuery.data.total) : "…";
          return (
            <section key={q.formType} className="cam-dash-card" aria-labelledby={`q-${q.formType}`} style={{ display: "flex", flexDirection: "column" }}>
              <div className="cam-pilot-kpi-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <FileIcon />
                <span
                  className="cam-pilot-badge"
                  style={{ background: "#e8f7f3", color: "#007a5e", fontWeight: 700 }}
                >
                  Homologué
                </span>
              </div>

              <h3 id={`q-${q.formType}`} className="cam-dash-card-title" style={{ marginTop: "var(--cam-space-3)" }}>
                {entityTypeLabel(q.formType)}
              </h3>
              
              <p className="cam-admin-meta" style={{ margin: "var(--cam-space-1) 0 var(--cam-space-4)" }}>
                {entity ? `${count(entity.sectionCount)} sections d'enquête homologuées` : schemaQuery.isLoading ? "Chargement des sections…" : METRIC_UNAVAILABLE}
              </p>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
                <div className="cam-dash-metric-row" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="cam-admin-meta">Total déclarations déposées</span>
                  <strong style={{ color: "var(--cam-text)" }} title={canReadSubmissions ? "Dans votre ressort" : "Non accessible à votre rôle"}>
                    {total}
                  </strong>
                </div>
                <div className="cam-dash-metric-row" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="cam-admin-meta">Format réglementaire</span>
                  <strong style={{ color: "var(--cam-green)" }}>DSMO-ONEFOP-v2</strong>
                </div>
              </div>

              <div style={{ display: "flex", gap: "var(--cam-space-3)", marginTop: "var(--cam-space-5)" }}>
                {canReadSubmissions ? (
                  <Link
                    href={`/admin/dossiers?formType=${q.formType}`}
                    className="cam-button cam-button-primary cam-button-sm"
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    Voir dossiers
                  </Link>
                ) : (
                  <button type="button" className="cam-button cam-button-primary cam-button-sm" disabled style={{ flex: 1 }}>
                    Voir dossiers
                  </button>
                )}
                <button
                  type="button"
                  className="cam-button cam-button-secondary cam-button-sm"
                  style={{ flex: 1 }}
                  onClick={() => setSelectedPreview(q)}
                >
                  Aperçu
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {/* Structure Information Card */}
      <section className="cam-dash-card" aria-labelledby="q-viewer-title" style={{ marginTop: "var(--cam-space-5)" }}>
        <div className="cam-dash-card-head">
          <h3 id="q-viewer-title" className="cam-dash-card-title">Référentiel des Questionnaires Canoniques</h3>
        </div>
        <p className="cam-admin-meta" style={{ margin: 0 }}>
          Les modèles de fiches de collecte ONEFOP sont compilés à partir de l&apos;AST canonique institutionnel. Toute modification structurelle requiert un arrêté d&apos;homologation ministériel.
        </p>
        {schemaQuery.data && (
          <p className="cam-admin-meta" style={{ marginTop: "var(--cam-space-2)", fontWeight: 600 }}>
            Schéma canonique actif v{schemaQuery.data.schemaVersion} : {schemaQuery.data.astTotals.sections} sections,{" "}
            {schemaQuery.data.astTotals.questions} questions recensées au niveau national.
          </p>
        )}
      </section>

      {/* Preview Modal */}
      {selectedPreview && (
        <AdminDialog
          open={!!selectedPreview}
          onClose={() => setSelectedPreview(null)}
          eyebrow="Structure Règlementaire &middot; ONEFOP"
          title={`Aperçu : ${entityTypeLabel(selectedPreview.formType)}`}
          wide
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--cam-space-3)" }}>
              <button
                type="button"
                className="cam-button cam-button-secondary"
                onClick={() => setSelectedPreview(null)}
              >
                Fermer
              </button>
              {canReadSubmissions && (
                <Link
                  href={`/admin/dossiers?formType=${selectedPreview.formType}`}
                  className="cam-button cam-button-primary"
                  onClick={() => setSelectedPreview(null)}
                >
                  Consulter les dossiers ({selectedPreview.formType})
                </Link>
              )}
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
            <div style={{ background: "var(--cam-surface-subtle)", padding: "0.75rem 1rem", borderRadius: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                  Questionnaire national pour : {entityTypeLabel(selectedPreview.formType)}
                </span>
                <span className="cam-pilot-badge" style={{ background: "#e8f7f3", color: "#007a5e", fontWeight: 700 }}>
                  En vigueur
                </span>
              </div>
              <div className="cam-admin-meta" style={{ marginTop: "4px" }}>
                Type d&apos;entité : <code>{selectedPreview.formType}</code> &middot; Format d&apos;export : SPSS / CSV / Excel
              </div>
            </div>

            <div>
              <div className="cam-admin-label" style={{ marginBottom: "var(--cam-space-2)" }}>
                Sections d&apos;enquête homologuées {schemaQuery.data?.entities[selectedPreview.schemaKey] ? `(${schemaQuery.data.entities[selectedPreview.schemaKey].sections.length})` : ""}
              </div>
              {schemaQuery.data?.entities[selectedPreview.schemaKey]?.sections &&
              schemaQuery.data.entities[selectedPreview.schemaKey].sections.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
                  {schemaQuery.data.entities[selectedPreview.schemaKey].sections.map((sec) => (
                    <div
                      key={sec.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.75rem",
                        borderRadius: "6px",
                        background: "var(--cam-surface-card)",
                        border: "1px solid var(--cam-border)",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--cam-text)" }}>
                          {sec.title?.fr || sec.id}
                        </div>
                        <div className="cam-admin-meta" style={{ fontSize: "0.75rem" }}>
                          Identifiant : <code>{sec.id}</code>
                          {sec.order !== null ? ` · Ordre : ${sec.order}` : ""}
                        </div>
                      </div>
                      <span className="cam-admin-meta" style={{ fontWeight: 600 }}>
                        {sec.fields.length} {sec.fields.length > 1 ? "questions / champs" : "question / champ"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="cam-admin-meta">
                  {schemaQuery.isLoading
                    ? "Chargement de la structure réglementaire…"
                    : "Structure de sections non disponible pour ce questionnaire."}
                </p>
              )}
            </div>
          </div>
        </AdminDialog>
      )}
    </div>
  );
}
