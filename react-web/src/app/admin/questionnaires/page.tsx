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
import { formatApiError } from "@/lib/pilotage-targets";

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
          title={t("schemaError", { message: formatApiError(schemaQuery.error, locale) })}
          onRetry={() => schemaQuery.refetch()}
        />
      )}

      {/* One register: the seven questionnaires as rows. The schema version
          is the same for all of them, so it is stated once, in the head. */}
      <section className="cam-admin-section" aria-labelledby="q-register-title">
        <div className="cam-admin-section-head">
          <h2 id="q-register-title" className="cam-admin-h2">{t("registerTitle")}</h2>
          {schemaQuery.data && (
            <span className="cam-admin-meta">
              {t("activeSchema", {
                version: schemaQuery.data.schemaVersion,
                sections: schemaQuery.data.astTotals.sections,
                questions: schemaQuery.data.astTotals.questions,
              })}
            </span>
          )}
        </div>
        <div className="cam-table-wrapper">
          <table className="cam-table">
            <thead>
              <tr>
                <th scope="col">{t("questionnaireColumn")}</th>
                <th scope="col" className="is-num">{t("sectionsColumn")}</th>
                <th scope="col" className="is-num" title={canReadSubmissions ? t("inYourTerritory") : t("notForYourRole")}>
                  {t("totalDeclarations")}
                </th>
                <th scope="col" className="text-right">{t("actionsColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {QUESTIONNAIRES.map((q, i) => {
                const entity = schemaQuery.data?.entities[q.schemaKey];
                const totalQuery = totals[i];
                // A count still loading shows the neutral marker, never "…" (G10).
                const totalLoading = canReadSubmissions && totalQuery.isLoading;
                const total = !canReadSubmissions || totalQuery.isError || !totalQuery.data
                  ? NOT_PROVIDED
                  : count(totalQuery.data.total, locale);
                return (
                  <tr key={q.formType}>
                    <td className="cam-admin-strong">{typeLabel(q.formType)}</td>
                    <td className="is-num" aria-busy={schemaQuery.isLoading || undefined}>
                      {entity
                        ? count(entity.sectionCount, locale)
                        : schemaQuery.isLoading ? NOT_PROVIDED : metricUnavailable(locale)}
                    </td>
                    <td
                      className="is-num"
                      title={canReadSubmissions ? t("inYourTerritory") : t("notForYourRole")}
                      aria-busy={totalLoading || undefined}
                    >
                      {total}
                    </td>
                    <td className="text-right" style={{ whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: "var(--cam-space-2)", alignItems: "center" }}>
                        {canReadSubmissions ? (
                          <Link
                            href={`/admin/dossiers?formType=${q.formType}`}
                            className="cam-button cam-button-secondary cam-button-sm"
                          >
                            {t("viewFiles")}
                          </Link>
                        ) : (
                          <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled>
                            {t("viewFiles")}
                          </button>
                        )}
                        <button
                          type="button"
                          className="cam-button cam-button-secondary cam-button-sm"
                          onClick={() => setSelectedPreview(q)}
                        >
                          {t("preview")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
                  {t("openFiles")}
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
              <div className="cam-admin-meta">{t("exportFormatLine")}</div>
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
                        {/* The schema identifier stays reachable as a tooltip,
                            not as on-screen text. */}
                        <div className="cam-admin-strong" title={sec.id}>
                          {(sec.title ? localized(sec.title, locale) : "") || sec.id}
                        </div>
                        {sec.order !== null && (
                          <div className="cam-admin-meta">{t("sectionOrder", { order: sec.order })}</div>
                        )}
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
