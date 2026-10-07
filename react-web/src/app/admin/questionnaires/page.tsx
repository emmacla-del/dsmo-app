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
import { DataState } from "@/components/admin/DataState";
import { count, NOT_PROVIDED, metricUnavailable } from "@/lib/admin-data-state";
import { APPROVAL_ROLES } from "@/lib/roles";

// UI for the "Questionnaires" frame (collecte/questionnaires.png).
// Every figure here is read from the generated schema or the submission
// counts. The Figma frame's « Homologué » / « En vigueur » badges, the
// « DSMO-ONEFOP-v2 » format and the « arrêté d'homologation » sentence had
// no record behind them and are gone; the schema version is shown instead.
// The export formats line matches what /admin/diffusion offers.
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
        <DataState
          state="error"
          resource={tRoot("adminNav.routes.questionnaires")}
          title={t("schemaError", { message: (schemaQuery.error as Error).message })}
          onRetry={() => schemaQuery.refetch()}
        />
      )}

      {/* Grid of 7 Questionnaires */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--cam-space-4)" }}>
        {QUESTIONNAIRES.map((q, i) => {
          const entity = schemaQuery.data?.entities[q.schemaKey];
          const totalQuery = totals[i];
          // A count still loading shows the neutral marker, never "…" (G10).
          const totalLoading = canReadSubmissions && totalQuery.isLoading;
          const total = !canReadSubmissions || totalQuery.isError || !totalQuery.data
            ? NOT_PROVIDED
            : count(totalQuery.data.total, locale);
          return (
            <section key={q.formType} className="cam-dash-card" aria-labelledby={`q-${q.formType}`} style={{ display: "flex", flexDirection: "column" }}>

              <h3 id={`q-${q.formType}`} className="cam-dash-card-title">
                {typeLabel(q.formType)}
              </h3>
              
              <p className="cam-dash-card-sub" style={{ marginBottom: "var(--cam-space-4)" }}>
                {entity ? t("sectionCount", { count: count(entity.sectionCount, locale) }) : schemaQuery.isLoading ? t("loadingSections") : metricUnavailable(locale)}
              </p>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
                <div className="cam-dash-metric-row">
                  <span className="cam-admin-meta">{t("totalDeclarations")}</span>
                  <strong
                    title={canReadSubmissions ? t("inYourTerritory") : t("notForYourRole")}
                    aria-busy={totalLoading || undefined}
                  >
                    {total}
                  </strong>
                </div>
                <div className="cam-dash-metric-row">
                  <span className="cam-admin-meta">{t("schemaVersion")}</span>
                  <strong aria-busy={schemaQuery.isLoading || undefined}>
                    {schemaQuery.data
                      ? `v${schemaQuery.data.schemaVersion}`
                      : schemaQuery.isLoading ? NOT_PROVIDED : metricUnavailable(locale)}
                  </strong>
                </div>
              </div>

              <div style={{ display: "flex", gap: "var(--cam-space-3)", marginTop: "var(--cam-space-5)" }}>
                {canReadSubmissions ? (
                  <Link
                    href={`/admin/dossiers?formType=${q.formType}`}
                    className="cam-button cam-button-secondary cam-button-sm"
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    {t("viewFiles")}
                  </Link>
                ) : (
                  <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled style={{ flex: 1 }}>
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
      <section className="cam-dash-card" aria-labelledby="q-viewer-title">
        <div className="cam-dash-card-head">
          <h3 id="q-viewer-title" className="cam-dash-card-title">{t("registerTitle")}</h3>
        </div>
        <p className="cam-admin-meta" style={{ margin: 0 }}>
          {t("registerBody")}
        </p>
        {schemaQuery.data && (
          <p className="cam-admin-meta cam-admin-strong" style={{ margin: "var(--cam-space-2) 0 0" }}>
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
            <div>
              <div className="cam-admin-strong">
                {t("nationalQuestionnaire", { type: typeLabel(selectedPreview.formType) })}
              </div>
              <div className="cam-admin-meta">
                {t("entityTypeLine")} <code className="cam-admin-code">{selectedPreview.formType}</code> &middot; {t("exportFormatLine")}
              </div>
            </div>

            <div>
              <div className="cam-admin-label" style={{ marginBottom: "var(--cam-space-2)" }}>
                {t("surveySections")} {schemaQuery.data?.entities[selectedPreview.schemaKey] ? `(${schemaQuery.data.entities[selectedPreview.schemaKey].sections.length})` : ""}
              </div>
              {schemaQuery.data?.entities[selectedPreview.schemaKey]?.sections &&
              schemaQuery.data.entities[selectedPreview.schemaKey].sections.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
                  {schemaQuery.data.entities[selectedPreview.schemaKey].sections.map((sec) => (
                    <div
                      key={sec.id}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--cam-space-3)" }}
                    >
                      <div>
                        {/* The section title is AST data, rendered as the schema
                            carries it in the console locale. */}
                        <div className="cam-admin-strong">
                          {(sec.title ? localized(sec.title, locale) : "") || sec.id}
                        </div>
                        <div className="cam-admin-meta">
                          {t("sectionId")} <code className="cam-admin-code">{sec.id}</code>
                          {sec.order !== null ? t("sectionOrder", { order: sec.order }) : ""}
                        </div>
                      </div>
                      <span className="cam-admin-meta cam-admin-strong" style={{ whiteSpace: "nowrap" }}>
                        {t("fieldCount", { count: sec.fields.length })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="cam-admin-meta" style={{ margin: 0 }}>
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
