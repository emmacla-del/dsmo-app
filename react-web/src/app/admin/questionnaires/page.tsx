"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, FileText } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import { listAdminQuestionnaires } from "@/lib/api-client";
import { useOnefopSchema } from "@/lib/use-onefop-schema";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { localized } from "@/lib/onefop-schema";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { DataState } from "@/components/admin/DataState";
import { count, NOT_PROVIDED, metricUnavailable } from "@/lib/admin-data-state";
import { SURVEY_ROLES } from "@/lib/roles";
import { formatApiError } from "@/lib/pilotage-targets";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  const canReadSubmissions = !!role && SURVEY_ROLES.includes(role);
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
      // limit: 0 returns the count and no rows. With limit: 1 each of these
      // seven queries pulled back a whole declaration, rawData included,
      // only to read `total`.
      queryFn: () => listAdminQuestionnaires({ formType: q.formType, limit: 0 }),
      enabled: canReadSubmissions,
    })),
  });

  const previewEntity = selectedPreview ? schemaQuery.data?.entities[selectedPreview.schemaKey] : undefined;

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: tRoot("adminNav.hubs.collecte") }, { label: tRoot("adminNav.routes.questionnaires") }]}
        title={tRoot("adminNav.routes.questionnaires")}
        subtitle={t("subtitle")}
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
      <AdminTablePanel
        title={t("registerTitle")}
        headingId="q-register-title"
        description={t("registerDescription")}
        meta={schemaQuery.data ? t("activeSchema", {
          version: schemaQuery.data.schemaVersion,
          sections: schemaQuery.data.astTotals.sections,
          questions: schemaQuery.data.astTotals.questions,
        }) : undefined}
      >
        <div className="cam-questionnaire-table-scroll" role="region" tabIndex={0} aria-labelledby="q-register-title">
          <Table className="cam-admin-data-table cam-questionnaire-table">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t("questionnaireColumn")}</TableHead>
                <TableHead scope="col" className="text-right">{t("sectionsColumn")}</TableHead>
                <TableHead scope="col" className="text-right">{t("fieldsColumn")}</TableHead>
                <TableHead scope="col" className="text-right" title={canReadSubmissions ? t("inYourTerritory") : t("notForYourRole")}>
                  {t("totalDeclarations")}
                </TableHead>
                <TableHead scope="col" className="text-right">{t("actionsColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {QUESTIONNAIRES.map((q, i) => {
                const entity = schemaQuery.data?.entities[q.schemaKey];
                const fields = entity?.sections.reduce((sum, section) => sum + section.fields.length, 0);
                const totalQuery = totals[i];
                // A count still loading shows the neutral marker, never "…" (G10).
                const totalLoading = canReadSubmissions && totalQuery.isLoading;
                const total = !canReadSubmissions || totalQuery.isError || !totalQuery.data
                  ? NOT_PROVIDED
                  : count(totalQuery.data.total, locale);
                const schemaFigure = (value: number | undefined) => (value != null
                  ? count(value, locale)
                  : schemaQuery.isLoading ? NOT_PROVIDED : metricUnavailable(locale));
                return (
                  <TableRow key={q.formType}>
                    <TableCell>
                      <div className="cam-questionnaire-name">
                        <span className="cam-questionnaire-icon" aria-hidden="true"><FileText size={16} /></span>
                        <span className="cam-admin-strong">{typeLabel(q.formType)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums" aria-busy={schemaQuery.isLoading || undefined}>
                      {schemaFigure(entity?.sectionCount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums" aria-busy={schemaQuery.isLoading || undefined}>
                      {schemaFigure(fields)}
                    </TableCell>
                    <TableCell
                      className="text-right tabular-nums"
                      title={canReadSubmissions ? t("inYourTerritory") : t("notForYourRole")}
                      aria-busy={totalLoading || undefined}
                    >
                      {total}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="cam-questionnaire-actions">
                        <button
                          type="button"
                          className="cam-button cam-button-secondary cam-button-sm"
                          onClick={() => setSelectedPreview(q)}
                          aria-label={t("previewOf", { type: typeLabel(q.formType) })}
                        >
                          <Eye size={15} aria-hidden="true" />
                          {t("preview")}
                        </button>
                        {canReadSubmissions ? (
                          <Link
                            href={`/admin/dossiers?formType=${q.formType}`}
                            className="cam-button cam-button-secondary cam-button-sm"
                            aria-label={t("viewFilesOf", { type: typeLabel(q.formType) })}
                          >
                            {t("viewFiles")}
                          </Link>
                        ) : (
                          <button type="button" className="cam-button cam-button-secondary cam-button-sm" disabled title={t("notForYourRole")}>
                            {t("viewFiles")}
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </AdminTablePanel>

      {selectedPreview && (
        <AdminDialog
          open={!!selectedPreview}
          onClose={() => setSelectedPreview(null)}
          eyebrow={t("previewEyebrow")}
          title={t("previewTitle", { type: typeLabel(selectedPreview.formType) })}
          wide
          footer={
            <>
              <button type="button" className="cam-button cam-button-secondary" onClick={() => setSelectedPreview(null)}>
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
            </>
          }
        >
          <div className="cam-questionnaire-preview">
            <div className="cam-questionnaire-preview-head">
              <div className="cam-admin-strong">{t("nationalQuestionnaire", { type: typeLabel(selectedPreview.formType) })}</div>
              <div className="cam-admin-meta">{t("exportFormatLine")}</div>
            </div>

            <h3 className="cam-admin-label cam-questionnaire-preview-title">
              {t("surveySections")} {previewEntity ? `(${previewEntity.sections.length})` : ""}
            </h3>
            {previewEntity?.sections && previewEntity.sections.length > 0 ? (
              <ol className="cam-questionnaire-sections">
                {previewEntity.sections.map((sec, index) => (
                  <li key={sec.id}>
                    <span className="cam-questionnaire-section-number" aria-hidden="true">{sec.order ?? index + 1}</span>
                    {/* The section title is AST data, rendered as the schema carries
                        it in the console locale; the identifier stays a tooltip. */}
                    <span className="cam-questionnaire-section-title" title={sec.id}>
                      {(sec.title ? localized(sec.title, locale) : "") || sec.id}
                      {sec.order !== null && <span className="cam-sr-only"> — {t("sectionOrder", { order: sec.order })}</span>}
                    </span>
                    <span className="cam-questionnaire-section-count">{t("fieldCount", { count: sec.fields.length })}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="cam-admin-meta cam-questionnaire-preview-empty">
                {schemaQuery.isLoading ? t("loadingStructure") : t("noStructure")}
              </p>
            )}
          </div>
        </AdminDialog>
      )}
    </div>
  );
}
