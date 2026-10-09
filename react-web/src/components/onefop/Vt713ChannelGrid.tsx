"use client";

// 7.1.3 — communication channels, one grid for the five stakeholder rows
// of the paper form (VT7_7..VT7_11). Channels are the rows and stakeholders
// the columns, like the form's other statistical tables: nine long channel
// names read as row labels, where as column headers they would not fit.
// Each stakeholder's ticks are stored exactly as its own checkbox field
// would store them (the option values, in option order; undefined when
// none). Ticking 96 « Autre » shows that stakeholder's « précisez » field
// under the grid (its *_OTHER field, required while shown).
import { useLocale } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import type { FormData, OnefopField } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { DataTable, CornerHeader, LeafHeader, RowHeader, Cell } from "./table/DataTable";
import { Checkbox } from "./form/Checkbox";
import { VtWizardField } from "./VtWizardFields";

/** "Canaux de communication — Élèves" → "Élèves". */
function stakeholderName(field: OnefopField, locale: "fr" | "en"): string {
  const label = localized(field.label, locale);
  const at = label.lastIndexOf("—");
  return at >= 0 ? label.slice(at + 1).trim() : label;
}

export function Vt713ChannelGrid({
  stakeholders,
  otherFields,
  data,
  onChange,
  issueByFieldId,
  sectionId,
  compact,
}: {
  /** VT7_7..VT7_11, the visible ones, in form order. */
  stakeholders: OnefopField[];
  /** Each stakeholder's "précisez" field, by stakeholder id. */
  otherFields: Map<string, OnefopField>;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  issueByFieldId: Map<string, string>;
  sectionId: string;
  compact: boolean;
}) {
  const locale = asUiLocale(useLocale());
  const isEn = locale === "en";
  const options = stakeholders[0]?.options ?? [];
  if (stakeholders.length === 0 || options.length === 0) return null;

  const ticked = (fieldId: string): string[] => {
    const raw = data[fieldId];
    return Array.isArray(raw) ? raw.map(String) : [];
  };

  const toggle = (fieldId: string, code: string, next: boolean) => {
    const set = new Set(ticked(fieldId));
    if (next) set.add(code);
    else set.delete(code);
    const ordered = options.map((o) => o.value).filter((v) => set.has(v));
    onChange(fieldId, ordered.length ? ordered : undefined);
  };

  const caption = isEn
    ? "Means of communication used for each group of stakeholders (tick every one that applies)"
    : "Modes de communication utilisés pour chaque catégorie de parties prenantes (cochez tous ceux qui s'appliquent)";

  const others = stakeholders
    .filter((s) => ticked(s.id).includes("96"))
    .map((s) => otherFields.get(s.id))
    .filter((f): f is OnefopField => Boolean(f));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
      <div className="w-full overflow-x-auto">
        <DataTable className="w-full border-collapse" style={{ minWidth: 560 }}>
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-[var(--cam-table-head-bg)] text-[var(--cam-table-text)] border-b-2 border-[var(--cam-table-strong)]">
            <tr>
              <CornerHeader className="px-3 py-2.5 border-r border-b border-[var(--cam-table-frame)]">
                {isEn ? "Means of communication" : "Mode de communication"}
              </CornerHeader>
              {stakeholders.map((s) => (
                <LeafHeader key={s.id} className="px-2 py-2 border-r border-b border-[var(--cam-table-frame)] last:border-r-0">
                  {stakeholderName(s, locale)}
                </LeafHeader>
              ))}
            </tr>
          </thead>
          <tbody>
            {options.map((opt) => {
              const optionLabel = localized(opt.label, locale);
              return (
                <tr key={opt.value} className="hover:bg-[var(--cam-table-hover)]">
                  <RowHeader className="px-3 py-1 border-r border-b border-[var(--cam-table-frame)]">
                    {optionLabel}
                  </RowHeader>
                  {stakeholders.map((s) => (
                    <Cell key={s.id} className="px-1 py-0 border-r border-b border-[var(--cam-table-line)] last:border-r-0">
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <Checkbox
                          id={`${s.id}-${opt.value}`}
                          checked={ticked(s.id).includes(opt.value)}
                          onChange={(next) => toggle(s.id, opt.value, next)}
                          label={<span className="sr-only">{`${stakeholderName(s, locale)} — ${optionLabel}`}</span>}
                        />
                      </div>
                    </Cell>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </div>

      {others.map((f) => (
        <VtWizardField
          key={f.id}
          field={f}
          value={data[f.id]}
          onChange={onChange}
          sectionId={sectionId}
          errorMessage={issueByFieldId.get(f.id)}
          compact={compact}
          data={data}
        />
      ))}
    </div>
  );
}
