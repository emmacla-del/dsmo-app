"use client";

import { useLocale, useTranslations } from "next-intl";
import type { PlacedFlag } from "@/lib/finding-targets";
import { PlacedFlagNotice } from "./DossierAnswerSections";
import { DataState } from "@/components/admin/DataState";
import { asUiLocale } from "@/lib/register-i18n";
import type { FormData, OnefopSchema } from "@/lib/onefop-schema";
import { buildVtSections, type VtItem, type VtSectionView, type VtTableItem } from "@/lib/dossier-vt-answers";

/**
 * The nine sections of a VT file, read-only, as the respondent answered them
 * (lib/dossier-vt-answers.ts). Every section is open, one after the other,
 * so a reviewer reads the file in one column (plan, Phase 3).
 */
export function DossierVtSections({
  schema,
  data,
  canSeeStaffNames,
  flags = {},
}: {
  schema: OnefopSchema;
  data: FormData;
  canSeeStaffNames: boolean;
  /** Findings placed on this file (placeFindings), keyed by anchor. */
  flags?: Record<string, PlacedFlag[]>;
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
      {sections.map((section) => (
        <VtSection key={section.id} section={section} flags={flags[`dossier-section-${section.id}`]} />
      ))}
    </>
  );
}

function VtSection({ section, flags }: { section: VtSectionView; flags?: PlacedFlag[] }) {
  const t = useTranslations("adminDossierPage.vt");
  const tPage = useTranslations("adminDossierPage");
  // The prop never changes, so React never resets it: the reader opens and
  // closes sections freely.
  return (
    <section className="cam-dossier-section" id={`dossier-section-${section.id}`}>
      <h2>{section.title}</h2>
      {flags && flags.length > 0 && <PlacedFlagNotice flags={flags} label={tPage("flaggedHere")} back={tPage("flaggedBack")} />}
      <div className="cam-dossier-section-body">
        {section.waived ? (
          <p className="cam-admin-meta">{t("sectionWaived")}</p>
        ) : section.items.length === 0 ? (
          <p className="cam-admin-meta">{t("sectionEmpty")}</p>
        ) : (
          // minmax(0, 1fr): the list's one grid track otherwise grows to the
          // widest table (4.8, nine columns), stretching every table past the
          // section, which clips it. Each wide table scrolls in its wrapper.
          <dl className="cam-dossier-fields" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
            {section.items.map((item, i) => (
              <VtItemRow key={item.kind === "heading" ? `h${i}` : item.id} item={item} />
            ))}
          </dl>
        )}
      </div>
    </section>
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
