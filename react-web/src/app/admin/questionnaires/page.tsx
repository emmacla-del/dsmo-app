"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import { listAdminQuestionnaires } from "@/lib/api-client";
import { useOnefopSchema } from "@/lib/use-onefop-schema";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { localized } from "@/lib/onefop-schema";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";

import { count, NOT_PROVIDED, metricUnavailable } from "@/lib/admin-data-state";
import { APPROVAL_ROLES } from "@/lib/roles";

// UI for the "Questionnaires" frame (collecte/questionnaires.png).
// "Homologué", "En vigueur", the regulatory format and the export formats are
// fixed text, not read from any record (flagged for domain review).
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
  const tRoot = useTranslations();
  const t = useTranslations("adminQuestionnairesPage");
  const locale = asUiLocale(useLocale());
  const typeLabel = (formType: string) =>
    ENTITY_TYPE_OPTION_KEYS[formType] ? tRoot(ENTITY_TYPE_OPTION_KEYS[formType]) : entityTypeLabel(formType);
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
        breadcrumb={[{ label: tRoot("adminNav.hubs.collecte") }, { label: tRoot("adminNav.routes.questionnaires") }]}
        title={tRoot("adminNav.routes.questionnaires")}
        subtitle={t("subtitle")}
        actions={<AdminHeaderActions />}
      />

      {schemaQuery.isError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>{t("schemaError", { message: (schemaQuery.error as Error).message })}</span>
        </div>
      )}

      {/* Grid of 7 Questionnaires */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--cam-space-4)" }}>
        {QUESTIONNAIRES.map((q, i) => {
          const entity = schemaQuery.data?.entities[q.schemaKey];
          const totalQuery = totals[i];
          const total = !canReadSubmissions || totalQuery.isError
            ? NOT_PROVIDED
            : totalQuery.data ? count(totalQuery.data.total, locale) : "…";
          return (
            <section key={q.formType} className="cam-dash-card" aria-labelledby={`q-${q.formType}`} style={{ display: "flex", flexDirection: "column" }}>
              <div className="cam-pilot-kpi-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <FileIcon />
                <span
                  className="cam-pilot-badge"
                  style={{ background: "#e8f7f3", color: "#007a5e", fontWeight: 700 }}
                >
                  {t("certified")}
                </span>
              </div>

              <h3 id={`q-${q.formType}`} className="cam-dash-card-title" style={{ marginTop: "var(--cam-space-3)" }}>
                {typeLabel(q.formType)}
              </h3>
              
              <p className="cam-admin-meta" style={{ margin: "var(--cam-space-1) 0 var(--cam-space-4)" }}>
                {entity ? t("sectionCount", { count: count(entity.sectionCount, locale) }) : schemaQuery.isLoading ? t("loadingSections") : metricUnavailable(locale)}
              </p>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
                <div className="cam-dash-metric-row" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="cam-admin-meta">{t("totalDeclarations")}</span>
                  <strong style={{ color: "var(--cam-text)" }} title={canReadSubmissions ? t("inYourTerritory") : t("notForYourRole")}>
                    {total}
                  </strong>
                </div>
                <div className="cam-dash-metric-row" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="cam-admin-meta">{t("regulatoryFormat")}</span>
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
                    {t("viewFiles")}
                  </Link>
                ) : (
                  <button type="button" className="cam-button cam-button-primary cam-button-sm" disabled style={{ flex: 1 }}>
                    {t("viewFiles")}
                  </button>
                )}
                <button
                  type="button"
                  className="cam-button cam-button-secondary cam-button-sm"
                  style={{ flex: 1 }}
                  onClick={() => setSelectedPreview(q)}
                >
                  {t("preview")}
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {/* Structure Information Card */}
      <section className="cam-dash-card" aria-labelledby="q-viewer-title" style={{ marginTop: "var(--cam-space-5)" }}>
        <div className="cam-dash-card-head">
          <h3 id="q-viewer-title" className="cam-dash-card-title">{t("registerTitle")}</h3>
        </div>
        <p className="cam-admin-meta" style={{ margin: 0 }}>
          {t("registerBody")}
        </p>
        {schemaQuery.data && (
          <p className="cam-admin-meta" style={{ marginTop: "var(--cam-space-2)", fontWeight: 600 }}>
            {t("activeSchema", {
              version: schemaQuery.data.schemaVersion,
              sections: schemaQuery.data.astTotals.sections,
              questions: schemaQuery.data.astTotals.questions,
            })}
          </p>
        )}
      </section>

      {/* Preview Modal */}
      {selectedPreview && (
        <AdminDialog
          open={!!selectedPreview}
          onClose={() => setSelectedPreview(null)}
          eyebrow={t("previewEyebrow")}
          title={t("previewTitle", { type: typeLabel(selectedPreview.formType) })}
          wide
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--cam-space-3)" }}>
              <button
                type="button"
                className="cam-button cam-button-secondary"
                onClick={() => setSelectedPreview(null)}
              >
                {t("close")}
              </button>
              {canReadSubmissions && (
                <Link
                  href={`/admin/dossiers?formType=${selectedPreview.formType}`}
                  className="cam-button cam-button-primary"
                  onClick={() => setSelectedPreview(null)}
                >
                  {t("openFiles", { code: selectedPreview.formType })}
                </Link>
              )}
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
            <div style={{ background: "var(--cam-surface-subtle)", padding: "0.75rem 1rem", borderRadius: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                  {t("nationalQuestionnaire", { type: typeLabel(selectedPreview.formType) })}
                </span>
                <span className="cam-pilot-badge" style={{ background: "#e8f7f3", color: "#007a5e", fontWeight: 700 }}>
                  {t("inForce")}
                </span>
              </div>
              <div className="cam-admin-meta" style={{ marginTop: "4px" }}>
                {t("entityTypeLine")} <code>{selectedPreview.formType}</code> &middot; {t("exportFormatLine")}
              </div>
            </div>

            <div>
              <div className="cam-admin-label" style={{ marginBottom: "var(--cam-space-2)" }}>
                {t("certifiedSections")} {schemaQuery.data?.entities[selectedPreview.schemaKey] ? `(${schemaQuery.data.entities[selectedPreview.schemaKey].sections.length})` : ""}
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
                        background: "var(--cam-surface)",
                        border: "1px solid var(--cam-border)",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--cam-text)" }}>
                          {(sec.title ? localized(sec.title, locale) : "") || sec.id}
                        </div>
                        <div className="cam-admin-meta" style={{ fontSize: "0.75rem" }}>
                          {t("sectionId")} <code>{sec.id}</code>
                          {sec.order !== null ? t("sectionOrder", { order: sec.order }) : ""}
                        </div>
                      </div>
                      <span className="cam-admin-meta" style={{ fontWeight: 600 }}>
                        {t("fieldCount", { count: sec.fields.length })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="cam-admin-meta">
                  {schemaQuery.isLoading
                    ? t("loadingStructure")
                    : t("noStructure")}
                </p>
              )}
            </div>
          </div>
        </AdminDialog>
      )}
    </div>
  );
}
