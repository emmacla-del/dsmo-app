"use client";

import { useLocale, useTranslations } from "next-intl";
import type { FormData, OnefopEntity, OnefopSection } from "@/lib/onefop-schema";
import { buildVtSections, type VtItem, type VtTableItem } from "@/lib/dossier-vt-answers";
import { asUiLocale } from "@/lib/register-i18n";
import { Cell, CellValue, CornerHeader, DataTable, LeafHeader, RowHeader } from "./table/DataTable";

/**
 * One section's answers, read-only, for the review screen ("Check your
 * answers"). The same reader as the admin file page (lib/dossier-vt-answers):
 * "Not answered" apart from No, questions a gateway skipped left out, every
 * table as entered. The respondent sees their own 8.8 staff list.
 */
export function VtSectionAnswers({
  entity,
  section,
  data,
}: {
  entity: OnefopEntity;
  section: OnefopSection;
  data: FormData;
}) {
  const t = useTranslations("vtValidationScreen.answers");
  const locale = asUiLocale(useLocale());
  const [view] = buildVtSections(
    { ...entity, sections: [section] },
    data,
    locale,
    { yes: t("yes"), no: t("no"), row: (n) => t("row", { n }) },
    true,
  );
  if (!view) return null;
  if (view.waived) return <p style={{ margin: 0, color: "var(--cam-text-muted)" }}>{t("sectionWaived")}</p>;
  if (view.items.length === 0) return <p style={{ margin: 0, color: "var(--cam-text-muted)" }}>{t("sectionEmpty")}</p>;
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "var(--cam-space-3)", margin: 0 }}>
      {view.items.map((item, i) => (
        <AnswerRow key={item.kind === "heading" ? `h${i}` : item.id} item={item} />
      ))}
    </dl>
  );
}

function coded(code: string | null, label: string): string {
  return code && !label.startsWith(code) ? `${code} ${label}` : label;
}

function AnswerRow({ item }: { item: VtItem }) {
  const t = useTranslations("vtValidationScreen.answers");
  if (item.kind === "heading") {
    return (
      <div>
        <dt>
          <strong>{item.title}</strong>
        </dt>
      </div>
    );
  }
  const label = coded(item.code, item.kind === "table" ? item.title : item.label);
  return (
    <div>
      <dt style={{ color: "var(--cam-text-muted)" }}>{label}</dt>
      <dd style={{ margin: 0 }}>
        {item.kind === "table" ? (
          <AnswerTable table={item} />
        ) : item.values === null ? (
          <span style={{ color: "var(--cam-text-muted)" }}>{t("notAnswered")}</span>
        ) : (
          item.values.map((v, i) => <div key={i}>{v}</div>)
        )}
      </dd>
    </div>
  );
}

function AnswerTable({ table }: { table: VtTableItem }) {
  const t = useTranslations("vtValidationScreen.answers");
  if (table.empty) return <span style={{ color: "var(--cam-text-muted)" }}>{t("tableEmpty")}</span>;
  return (
    <div style={{ overflowX: "auto" }}>
      <DataTable>
        <thead>
          <tr>
            <CornerHeader>{t("rowHeader")}</CornerHeader>
            {table.columns.map((c) => (
              <LeafHeader key={c.key}>{c.label}</LeafHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              <RowHeader>{row.label}</RowHeader>
              {row.cells.map((cell, c) => (
                <Cell key={table.columns[c].key}>
                  <CellValue value={cell} />
                </Cell>
              ))}
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
