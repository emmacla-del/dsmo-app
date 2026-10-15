"use client";

import { useLocale, useTranslations } from "next-intl";
import { DataState } from "@/components/admin/DataState";
import { asUiLocale } from "@/lib/register-i18n";
import type { FormData, OnefopSchema } from "@/lib/onefop-schema";
import { buildVtSections, type VtItem, type VtSectionView, type VtTableItem } from "@/lib/dossier-vt-answers";

/**
 * The nine sections of a VT file, read-only, as the respondent answered them
 * (lib/dossier-vt-answers.ts). Native <details> disclosures, Section 1 open;
 * several may be open at once, since a reviewer compares sections.
 */
export function DossierVtSections({
  schema,
  data,
  canSeeStaffNames,
}: {
  schema: OnefopSchema;
  data: FormData;
  canSeeStaffNames: boolean;
}) {
  const t = useTranslations("adminDossierPage.vt");
  const locale = asUiLocale(useLocale());
  const entity = schema.entities.vocationalTraining;
  const sections = entity
    ? buildVtSections(entity, data, locale, { yes: t("yes"), no: t("no"), row: (n) => t("row", { n }) }, canSeeStaffNames)
    : [];

  if (sections.length === 0) {
    return <DataState dense state="unavailable" resource={t("resource")} title={t("schemaUnavailable")} />;
  }
  return (
    <>
      {sections.map((section, i) => (
        <VtSection key={section.id} section={section} defaultOpen={i === 0} />
      ))}
    </>
  );
}

function VtSection({ section, defaultOpen }: { section: VtSectionView; defaultOpen: boolean }) {
  const t = useTranslations("adminDossierPage.vt");
  // The prop never changes, so React never resets it: the reader opens and
  // closes sections freely.
  return (
    <details className="cam-dossier-section" open={defaultOpen}>
      <summary>{section.title}</summary>
      <div className="cam-dossier-section-body">
        {section.waived ? (
          <p className="cam-admin-meta">{t("sectionWaived")}</p>
        ) : section.items.length === 0 ? (
          <p className="cam-admin-meta">{t("sectionEmpty")}</p>
        ) : (
          <dl className="cam-dossier-fields">
            {section.items.map((item, i) => (
              <VtItemRow key={item.kind === "heading" ? `h${i}` : item.id} item={item} />
            ))}
          </dl>
        )}
      </div>
    </details>
  );
}

function coded(code: string | null, label: string): string {
  return code && !label.startsWith(code) ? `${code} ${label}` : label;
}

function VtItemRow({ item }: { item: VtItem }) {
  const t = useTranslations("adminDossierPage.vt");
  if (item.kind === "heading") {
    return (
      <div>
        <dt className="cam-admin-label">{item.title}</dt>
      </div>
    );
  }
  if (item.kind === "table") {
    return (
      <div>
        <dt>{coded(item.code, item.title)}</dt>
        <dd>
          <VtTable table={item} />
        </dd>
      </div>
    );
  }
  return (
    <div>
      <dt>{coded(item.code, item.label)}</dt>
      {item.values === null ? (
        <dd className="cam-admin-meta">{t("notAnswered")}</dd>
      ) : (
        <dd>
          {item.values.map((v, i) => (
            <div key={i}>{v}</div>
          ))}
        </dd>
      )}
    </div>
  );
}

function VtTable({ table }: { table: VtTableItem }) {
  const t = useTranslations("adminDossierPage.vt");
  if (table.restricted) {
    return <p className="cam-admin-meta">{table.empty ? t("tableEmpty") : t("staffListRestricted")}</p>;
  }
  if (table.empty) return <p className="cam-admin-meta">{t("tableEmpty")}</p>;
  return (
    <div className="cam-table-wrapper">
      <table className="cam-table">
        <thead>
          <tr>
            <th scope="col">{t("rowHeader")}</th>
            {table.columns.map((c) => (
              <th key={c.key} scope="col" className={c.numeric ? "is-num" : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              <th scope="row">{row.label}</th>
              {row.cells.map((cell, c) => (
                <td key={table.columns[c].key} className={table.columns[c].numeric ? "is-num" : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
