"use client";

import { useLocale, useTranslations } from "next-intl";
import type { FormData, OnefopField } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { CSP_ROW_LABELS, KPI_PERIODS, KPI_ROW_KEYS, KPI_ROW_LABELS } from "@/lib/onefop-tables";
import { kpiPeriodLabels } from "@/lib/campaign-period";
import { ACTIVITIES_ROW_CAPACITY, ACTIVITIES_TABLE_FIELDS } from "@/lib/onefop-activities";
import { StatisticalGridRenderer } from "@/components/onefop/tables/StatisticalGridRenderer";
import type { FixedMatrixDefinition } from "@/components/onefop/tables/StatisticalTableDefinition";
import {
  getGuidedOnlyTableDefinition,
  getModernJobsTableDefinition,
} from "@/components/onefop/tables/definitions/modernJobsTableDefinitions";
import { CellValue, DataTable } from "@/components/onefop/table/DataTable";

const noop = () => {};

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/** The respondent's answer to « Avez-vous des chiffres ? » for this table. */
export function tableResponseStatus(field: OnefopField, data: FormData): string | null {
  const value = data[`${field.id}_RESPONSE_STATUS`]
    ?? data[`${field.id.toUpperCase()}_RESPONSE_STATUS`]
    ?? data[`${field.id.toLowerCase()}_RESPONSE_STATUS`];
  return typeof value === "string" && value ? value : null;
}

/** The table definition the respondent's wizard used, so the reviewer reads the same labels. */
export function reviewTableDefinition(field: OnefopField, data: FormData): FixedMatrixDefinition | null {
  return getModernJobsTableDefinition(field, data) ?? getGuidedOnlyTableDefinition(field, data);
}

function hasAnyValue(definition: FixedMatrixDefinition, data: FormData): boolean {
  return definition.rows.some((row) => Object.values(row.cells).some((cell) => !isBlank(data[cell.fieldKey])));
}

function ActivitiesTable({ field, data, locale }: { field: OnefopField; data: FormData; locale: "fr" | "en" }) {
  const t = useTranslations("adminDossierPage");
  const prefix = field.table?.id ?? field.id;
  const capacity = field.table?.rowCapacity ?? ACTIVITIES_ROW_CAPACITY;
  const lines = Array.from({ length: capacity }, (_, index) => index + 1)
    .filter((n) => ACTIVITIES_TABLE_FIELDS.some((column) => !isBlank(data[`${prefix}_row${n}_${column.key}`])));
  if (lines.length === 0) return <p className="cam-admin-meta">{t("tableNoFigures")}</p>;
  const display = (key: string, value: unknown) => {
    if (isBlank(value)) return null;
    const option = ACTIVITIES_TABLE_FIELDS.find((column) => column.key === key)?.options?.find((item) => item.value === String(value));
    return option ? localized(option.label, locale) : String(value);
  };
  return (
    <div className="cam-table-wrapper" role="region" tabIndex={0} aria-label={localized(field.label, locale) || field.id}>
      <DataTable>
        <thead>
          <tr>
            <th scope="col">{t("tableLineColumn")}</th>
            {ACTIVITIES_TABLE_FIELDS.map((column) => <th scope="col" key={column.key}>{localized(column.label, locale)}</th>)}
          </tr>
        </thead>
        <tbody>
          {lines.map((n) => (
            <tr key={n}>
              <th scope="row">{n}</th>
              {ACTIVITIES_TABLE_FIELDS.map((column) => (
                <td key={column.key}><CellValue value={display(column.key, data[`${prefix}_row${n}_${column.key}`])} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

function OutcomesTable({ field, data, locale, quarterCode }: { field: OnefopField; data: FormData; locale: "fr" | "en"; quarterCode: string | null }) {
  const prefix = field.table?.id ?? field.id;
  const periods = kpiPeriodLabels({ start: null, end: null, code: quarterCode });
  return (
    <div className="cam-table-wrapper" role="region" tabIndex={0} aria-label={localized(field.label, locale) || field.id}>
      <DataTable>
        <thead>
          <tr>
            <th scope="col" />
            {periods.map((label, index) => <th scope="col" key={KPI_PERIODS[index]}>{localized(label, locale)}</th>)}
          </tr>
        </thead>
        <tbody>
          {KPI_ROW_KEYS.map((row, rowIndex) => (
            <tr key={row}>
              <th scope="row">{localized(KPI_ROW_LABELS[rowIndex], locale)}</th>
              {KPI_PERIODS.map((period) => {
                const value = data[`${prefix}_${row}_${period}`];
                return <td key={period}><CellValue value={isBlank(value) ? null : String(value)} /></td>;
              })}
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

/**
 * A statistical table as the respondent filled it, read-only: the wizard's own
 * definition (row and column labels, groups, totals) with the stored figures.
 * A blank cell reads « — », never 0. The respondent's « néant » or « non
 * concerné » is said in words instead of drawing an empty grid.
 */
export function ReviewStatisticalTable({ field, data, quarterCode = null }: {
  field: OnefopField;
  data: FormData;
  quarterCode?: string | null;
}) {
  const t = useTranslations("adminDossierPage");
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const status = tableResponseStatus(field, data);
  if (status === "NONE") return <p className="cam-admin-meta">{t("tableNoneDeclared")}</p>;
  if (status === "NOT_APPLICABLE") return <p className="cam-admin-meta">{t("tableNotApplicable")}</p>;

  const template = field.table?.template;
  if (template === "activities_table") return <ActivitiesTable field={field} data={data} locale={locale} />;
  if (template === "kpi_period_table") return <OutcomesTable field={field} data={data} locale={locale} quarterCode={quarterCode} />;

  const definition = reviewTableDefinition(field, data);
  if (!definition) return null;

  if (definition.cspSlices?.length && definition.buildRowsForCsp) {
    // One grid per staff category that holds figures (S22Q03 diploma × category).
    const slices = definition.cspSlices
      .map((csp) => ({ csp, slice: { ...definition, rows: definition.buildRowsForCsp!(csp), activeCsp: csp } }))
      .filter(({ slice }) => hasAnyValue(slice, data));
    if (slices.length === 0) return <p className="cam-admin-meta">{t("tableNoFigures")}</p>;
    return (
      <>
        {slices.map(({ csp, slice }) => (
          <div key={csp} className="cam-dossier-table-slice">
            <h4 className="cam-admin-label">{localized(CSP_ROW_LABELS[csp] ?? { fr: csp, en: csp }, locale)}</h4>
            <StatisticalGridRenderer definition={slice} data={data} onChange={noop} tableFieldId={field.id} readOnly className="cam-grid-readonly" />
          </div>
        ))}
      </>
    );
  }

  if (!hasAnyValue(definition, data)) return <p className="cam-admin-meta">{t("tableNoFigures")}</p>;
  return <StatisticalGridRenderer definition={definition} data={data} onChange={noop} tableFieldId={field.id} readOnly className="cam-grid-readonly" />;
}
