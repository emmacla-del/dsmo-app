/**
 * Renders one table of each renderer type to static HTML, for
 * check-table-typography.mjs. Every renderer draws with the same sample
 * data so "Homme", "Femme", row labels and values can be compared.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import type { OnefopField } from "@/lib/onefop-schema";
import { TableRenderer } from "@/components/onefop/TableRenderer";
import { VtTableRenderer } from "@/components/onefop/VtTableRenderer";
import { ActivitiesTableRenderer } from "@/components/onefop/ActivitiesTableRenderer";
import { StatisticalGridRenderer } from "@/components/onefop/tables/StatisticalGridRenderer";
import { getModernJobsTableDefinition } from "@/components/onefop/tables/definitions/modernJobsTableDefinitions";
import messages from "../../messages/fr.json";

const base = { path: null, required: false, hint: null, instruction: null, options: null, visibility: null };
const noop = () => {};

const classic: OnefopField = {
  ...base, id: "S22Q05", paperCode: "S22Q05", type: "table",
  label: { fr: "Personnes vulnérables recrutées", en: "Vulnerable people recruited" },
  table: { id: "S22Q05", template: "vulnerable_named_rows_table", rowKeys: null, rowCapacity: null, matrix: null },
};

const modern: OnefopField = {
  ...base, id: "S22Q04", paperCode: "S22Q04", type: "table",
  label: { fr: "Personnes en situation de handicap", en: "People with disabilities" },
  table: { id: "S22Q04", template: "csp_status_gender_table", rowKeys: ["foremen", "workers"], rowCapacity: null, matrix: null },
};

const vt: OnefopField = {
  ...base, id: "VT4_1", paperCode: "4.1", type: "table",
  label: { fr: "Effectifs", en: "Headcount" },
  table: {
    id: "VT4_1", template: "vt_matrix", rowKeys: null, rowCapacity: null,
    matrix: [["VT4_1_a_m", "VT4_1_a_f", "VT4_1_a_t"], ["VT4_1_b_m", "VT4_1_b_f", "VT4_1_b_t"]],
    vt: {
      paperCode: "4.1", title: { fr: "Effectifs", en: "Headcount" }, progressNoun: null,
      isRoster: false, progressiveRows: false, singleCellPerRow: false,
      rows: [
        { id: "VT4_1_a", label: { fr: "Agents de Maîtrise", en: "Foremen" }, labelFromCells: null },
        { id: "VT4_1_b", label: { fr: "Agents d'exécution", en: "Workers" }, labelFromCells: null },
      ],
      cells: [
        { key: "m", label: { fr: "Homme", en: "Male" }, kind: "number", required: false, dependsOnKey: null, options: null, formula: null },
        { key: "f", label: { fr: "Femme", en: "Female" }, kind: "number", required: false, dependsOnKey: null, options: null, formula: null },
        { key: "t", label: { fr: "Total", en: "Total" }, kind: "computed", required: false, dependsOnKey: null, options: null, formula: "sum-of-siblings" },
      ],
    },
  },
};

const activities: OnefopField = {
  ...base, id: "S1Q20", paperCode: "S1Q20", type: "table",
  label: { fr: "Activités", en: "Activities" },
  table: { id: "S1Q20", template: "activities_table", rowKeys: null, rowCapacity: 2, matrix: null },
};

const data = { S22Q05_idp_permanent_male: "1", VT4_1_a_m: "3" };

function wrap(name: string, node: React.ReactNode) {
  return `<section data-renderer="${name}">${renderToStaticMarkup(
    <NextIntlClientProvider locale="fr" messages={messages} timeZone="Africa/Douala">
      {node}
    </NextIntlClientProvider>,
  )}</section>`;
}

export function renderAll(): string {
  const modernDef = getModernJobsTableDefinition(modern, {});
  if (!modernDef) throw new Error("no Modern Jobs definition for csp_status_gender_table");
  return [
    wrap("TableRenderer", <TableRenderer field={classic} data={data} onChange={noop} />),
    wrap("StatisticalGridRenderer", <StatisticalGridRenderer definition={modernDef} data={data} onChange={noop} tableFieldId="S22Q04" />),
    wrap("VtTableRenderer", <VtTableRenderer field={vt} data={data} onChange={noop} />),
    wrap("ActivitiesTableRenderer", <ActivitiesTableRenderer field={activities} data={data} onChange={noop} />),
  ].join("\n");
}
