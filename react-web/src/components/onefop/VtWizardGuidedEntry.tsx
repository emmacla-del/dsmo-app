"use client";

import { memo, useId, useState, type CSSProperties, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData, LocalizedText, OnefopField, VtCellDef, VtCellOption, VtRowDef, VtTableMeta } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { CodedLabel } from "@/components/onefop/ui/QuestionCode";
import { supportsGuidedEntry } from "./vt-wizard-utils";

/** Single-language noun for interpolation into an already-localized sentence
 * — unlike bilingual(), which always shows both languages together for
 * schema-sourced labels shown on their own. */
function localizedNoun(text: LocalizedText | null, locale: string, fallbackFr: string, fallbackEn: string): string {
  if (!text) return locale.startsWith("en") ? fallbackEn : fallbackFr;
  return locale.startsWith("en") ? text.en : text.fr;
}

/** Single-language schema text for on-screen display (table titles, cell
 * labels) — the VT wizard shows one language at a time, unlike bilingual(). */
function cellLabelText(text: LocalizedText | null, locale: string): string {
  return localized(text, locale.startsWith("en") ? "en" : "fr");
}

const accentGreen = "var(--cam-green)";
const cardBorder = "var(--cam-border)";
const ink = "var(--cam-text)";
const inkSoft = "var(--cam-text-muted)";
const cardRadius = 4;

const guidedHeaderBoxStyle: CSSProperties = {
  width: "100%",
  padding: "8px 16px",
  backgroundColor: "var(--cam-success-bg)",
  border: `1px solid ${cardBorder}`,
  borderRadius: "var(--cam-radius-sm)",
};

const guidedEntryContainerStyle: CSSProperties = {
  width: "100%",
  padding: 16,
  backgroundColor: "var(--cam-bg)",
  border: `1px solid ${cardBorder}`,
  borderRadius: cardRadius,
};

const numberBoxContainerStyle: CSSProperties = ({
  display: "flex",
  flexDirection: "column",
  gap: 6,
});

const numberBoxInputStyle = {
  width: "100%",
  height: "var(--cam-form-field-height)",
  padding: "0 var(--cam-space-3)",
  border: `1px solid ${cardBorder}`,
  borderRadius: "var(--cam-radius-sm)",
  fontFamily: "var(--cam-font-sans)",
  fontWeight: "var(--cam-font-weight-regular)",
  fontSize: "var(--cam-answer-size)",
  fontVariantNumeric: "tabular-nums",
  color: ink,
  background: "#ffffff",
  outline: "none",
  boxSizing: "border-box" as const,
};

const numberBoxInputErrorStyle: CSSProperties = {
  ...numberBoxInputStyle,
  background: "var(--cam-error-bg)",
  borderColor: "var(--cam-error)",
};

const addButtonStyle: CSSProperties = {
  width: "100%",
  height: "var(--cam-form-field-height)",
  padding: "0 var(--cam-space-5)",
  backgroundColor: accentGreen,
  color: "#ffffff",
  border: "none",
  borderRadius: "var(--cam-radius-sm)",
  fontFamily: "var(--cam-font-sans)",
  fontWeight: 600,
  fontSize: "var(--cam-font-size-base)",
  cursor: "pointer",
};

const summaryRowStyle: CSSProperties = {
  padding: 12,
  backgroundColor: "#ffffff",
  border: `1px solid ${cardBorder}`,
  borderRadius: "var(--cam-radius-sm)",
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
};

const statBoxStyle: CSSProperties = {
  padding: 12,
  backgroundColor: "var(--cam-bg)",
  border: `1px solid ${cardBorder}`,
  borderRadius: "var(--cam-radius-sm)",
};

function cellLabel(cell: VtCellDef, locale: string): string {
  return localized(cell.label, locale.startsWith("en") ? "en" : "fr") || cell.key;
}

function cellId(row: VRow, cell: VtCellDef): string {
  return (row.rowDef.id || "") + "_" + cell.key;
}

interface VRow {
  rowDef: VtRowDef;
  idx: number;
}

function getRows(vt: VtTableMeta): VRow[] {
  return vt.rows.map((r, i) => ({ rowDef: r, idx: i }));
}

function sumReported(values: (number | null)[]): number | null {
  const reported = values.filter((v) => v != null) as number[];
  return reported.length === 0 ? null : reported.reduce((a, b) => a + b, 0);
}

const guidedNumberDisplay = (v: number | null, locale: string): string =>
  v != null ? String(v) : locale.startsWith("en") ? "Not provided" : "Non renseigné";

interface GuidedHeaderBoxProps {
  title: ReactNode;
  tinted?: boolean;
}

const GuidedHeaderBox = memo(function GuidedHeaderBox({ title, tinted = true }: GuidedHeaderBoxProps) {
  if (!tinted) {
    return (
      <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: 800, fontSize: 15, color: ink, margin: 0 }}>
        {title}
      </p>
    );
  }
  return (
    <div style={guidedHeaderBoxStyle}>
      <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: 600, fontSize: 14, color: accentGreen, margin: 0 }}>
        {title}
      </p>
    </div>
  );
});

const GuidedNumberBox = memo(function GuidedNumberBox({
  label,
  value,
  onChange,
  numeric = true,
  errorText,
  onCommit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  errorText?: string;
  onCommit?: () => void;
}) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  return (
    <div style={numberBoxContainerStyle}>
      <label htmlFor={inputId} style={{ fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-question-weight)", fontSize: "var(--cam-question-size)", color: ink }}>
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={errorText != null || undefined}
        aria-describedby={errorText ? errorId : undefined}
        type={numeric ? "number" : "text"}
        min={numeric ? 0 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onCommit?.(); }}
        style={{
          ...(errorText != null ? numberBoxInputErrorStyle : numberBoxInputStyle),
          // Number entries centred (same as the tables); free text stays left.
          textAlign: numeric ? "center" : "left",
        }}
        inputMode={numeric ? "numeric" : "text"}
      />
      {errorText && (
        <p id={errorId} style={{ fontSize: 11, color: "var(--cam-error)", fontFamily: "var(--cam-font-sans)", margin: 0 }}>
          {errorText}
        </p>
      )}
    </div>
  );
});

const GuidedStatBox = memo(function GuidedStatBox({
  label,
  value,
}: { label: string; value: number | null }) {
  const locale = useLocale();
  return (
    <div style={statBoxStyle}>
      <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-question-weight)", fontSize: "var(--cam-question-size)", color: ink, margin: 0 }}>
        {label}
      </p>
      <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-font-weight-regular)", fontSize: "var(--cam-answer-size)", color: ink, margin: 0 }}>
        {guidedNumberDisplay(value, locale)}
      </p>
    </div>
  );
});

/** Accessible name for a summary row's edit/delete button: says which row
 * (its 1-based position, plus its label when it has one), since several of
 * these buttons sit on the same screen. */
function rowActionLabel(
  t: ReturnType<typeof useTranslations>,
  action: "edit" | "remove",
  row: VRow,
  name: string,
): string {
  const index = row.idx + 1;
  const trimmed = name.trim();
  if (action === "edit") {
    return trimmed
      ? t("vtWizard.editRowNamed", { default: "Modifier la ligne {index} : {name}", index, name: trimmed })
      : t("vtWizard.editRow", { default: "Modifier la ligne {index}", index });
  }
  return trimmed
    ? t("vtWizard.removeRowNamed", { default: "Supprimer la ligne {index} : {name}", index, name: trimmed })
    : t("vtWizard.removeRow", { default: "Supprimer la ligne {index}", index });
}

/** Icon-only edit/delete button. The glyph is decorative (aria-hidden); the
 * accessible name comes from `label`, which is also shown as a tooltip.
 * Keyboard focus gets the page-wide :focus-visible ring (globals.css). */
// A short visible word ("Modifier" / "Supprimer") rather than an emoji;
// the accessible name keeps the row it acts on and starts with that word.
const IconButton = memo(function IconButton({
  text,
  label,
  onTap,
}: { text: string; label: string; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={label}
      title={label}
      style={{
        minHeight: 28,
        padding: "0 var(--cam-space-2)",
        background: "transparent",
        border: `1px solid ${cardBorder}`,
        borderRadius: "var(--cam-radius-sm)",
        fontSize: "var(--cam-font-size-xs)",
        color: inkSoft,
        cursor: "pointer",
      }}
    >
      {text}
    </button>
  );
});

const TotalBar = memo(function TotalBar({
  totalsText,
  countText,
}: { totalsText: string; countText: string }) {
  return (
    <div style={{ width: "100%", padding: 16, backgroundColor: "var(--cam-success-bg)", border: `1px solid ${cardBorder}`, borderRadius: "var(--cam-radius-sm)" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--cam-font-sans)", fontWeight: 700, fontSize: 13, color: accentGreen, flex: 1 }}>
          {totalsText}
        </span>
        <span style={{ fontFamily: "var(--cam-font-sans)", fontWeight: 700, fontSize: 11, color: "#ffffff", padding: "4px 8px", backgroundColor: accentGreen, borderRadius: "var(--cam-radius-sm)" }}>
          {countText}
        </span>
      </div>
    </div>
  );
});

export interface GuidedFieldSet {
  vt: VtTableMeta;
  rows: VRow[];
  data: FormData;
  onChange: (cellId: string, value: unknown, recalculate?: boolean) => void;
}

export function VtWizardFixedRowMultiNumberEntry({
  field, data, onChange,
}: { field: OnefopField; data: FormData; onChange: (cellId: string, value: unknown, recalculate?: boolean) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const vt = field.table!.vt!;
  const rows = getRows(vt);
  const numberCells = vt.cells.filter((c) => c.kind === "number");
  const [selectedRow, setSelectedRow] = useState<VRow | null>(null);
  const [controls, setControls] = useState<Record<string, string>>({});

  const rowHasData = (row: VRow): boolean => {
    return numberCells.some((c) => {
      const v = data[cellId(row, c)];
      return v !== undefined && v !== "" && v !== null;
    });
  };

  const filledRows = rows.filter(rowHasData);
  const entered = filledRows.filter((r) => r !== selectedRow);
  const available = rows.filter((r) => !rowHasData(r) || r === selectedRow);

  const totals = numberCells.map((c) => {
    const vals = filledRows.map((r) => {
      const v = data[cellId(r, c)];
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    });
    return sumReported(vals);
  });

  const handleAdd = () => {
    if (!selectedRow) return;
    for (const cell of numberCells) {
      const val = controls[cell.key];
      const parsed = val === undefined || val === "" ? null : Number(val);
      onChange(cellId(selectedRow, cell), parsed ?? null, true);
    }
    setSelectedRow(null);
    setControls({});
  };

  const handleRemove = (row: VRow) => {
    for (const cell of numberCells) {
      onChange(cellId(row, cell), null, true);
    }
    if (selectedRow === row) {
      setSelectedRow(null);
      setControls({});
    }
  };

  const handleEdit = (row: VRow) => {
    setSelectedRow(row);
    const newControls: Record<string, string> = {};
    for (const cell of numberCells) {
      const v = data[cellId(row, cell)];
      newControls[cell.key] = v == null ? "" : String(v);
    }
    setControls(newControls);
  };

  const title = <CodedLabel code={field.paperCode} text={cellLabelText(vt.title, locale)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <GuidedHeaderBox title={title} />
      <div style={guidedEntryContainerStyle}>
        <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: 800, fontSize: 14, color: accentGreen, margin: "0 0 4px" }}>
          {t("vtWizard.stepByStep", { default: "Saisie progressive" })}
        </p>
        <p style={{ fontSize: "var(--cam-microcopy-size)", color: inkSoft, fontFamily: "var(--cam-font-sans)", margin: "0 0 16px" }}>
          {cellLabelText(vt.progressNoun, locale) || t("vtWizard.rowsNoun", { default: "Lignes" })}
        </p>
        <div style={{ marginBottom: 12 }}>
          <select
            value={selectedRow ? selectedRow.idx : ""}
            onChange={(e) => {
              const idx = Number(e.target.value);
              if (e.target.value === "") { setSelectedRow(null); setControls({}); return; }
              setSelectedRow(rows[idx]);
              const newControls: Record<string, string> = {};
              for (const cell of numberCells) {
                const v = data[cellId(rows[idx], cell)];
                newControls[cell.key] = v == null ? "" : String(v);
              }
              setControls(newControls);
            }}
            style={{ width: "100%", height: "var(--cam-form-field-height)", padding: "0 var(--cam-space-3)", border: `1px solid ${cardBorder}`, borderRadius: "var(--cam-radius-sm)", fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-font-weight-regular)", fontSize: "var(--cam-answer-size)", color: ink, background: "#ffffff", outline: "none", boxSizing: "border-box" }}
          >
            <option value="">{t("vtWizard.select", { default: "Sélectionner…" })}</option>
            {available.map((row) => (
              <option key={row.idx} value={row.idx}>
                {cellLabelText(row.rowDef.label, locale) || `${row.rowDef.id}`}
              </option>
            ))}
          </select>
        </div>
        {numberCells.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {numberCells.reduce((acc, cell, i) => {
              if (i % 2 === 0) {
                acc.push(
                  <div key={cell.key} style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <GuidedNumberBox
                        label={cellLabel(cell, locale)}
                        value={controls[cell.key] ?? ""}
                        onChange={(v) => setControls({ ...controls, [cell.key]: v })}
                      />
                    </div>
                    {numberCells[i + 1] && (
                      <div style={{ flex: 1 }}>
                        <GuidedNumberBox
                          label={cellLabel(numberCells[i + 1], locale)}
                          value={controls[numberCells[i + 1].key] ?? ""}
                          onChange={(v) => setControls({ ...controls, [numberCells[i + 1].key]: v })}
                        />
                      </div>
                    )}
                  </div>,
                );
              }
              return acc;
            }, [] as ReactNode[])}
          </div>
        )}
        <button
          type="button"
          onClick={handleAdd}
          disabled={selectedRow == null}
          style={{ ...addButtonStyle, opacity: selectedRow == null ? 0.5 : 1, cursor: selectedRow == null ? "default" : "pointer" }}
        >
          {t("vtWizard.add", { default: "Ajouter" })}
        </button>
      </div>

      <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: 800, fontSize: 14, color: accentGreen, margin: 0 }}>
        {t("vtWizard.summary", { default: "Résumé des lignes saisies" })}
      </p>
      <p style={{ fontSize: "var(--cam-microcopy-size)", color: inkSoft, fontFamily: "var(--cam-font-sans)", margin: "4px 0" }}>
        {t("vtWizard.rowsFilledNote", {
          default: "{count} {noun} renseigné(s) sur {total}. Les lignes peuvent être éditées ou supprimées avant validation.",
          count: entered.length,
          total: rows.length,
          noun: localizedNoun(vt.progressNoun, locale, "lignes", "rows"),
        })}
      </p>

      {entered.length === 0 ? (
        <p style={{ fontSize: "var(--cam-microcopy-size)", color: inkSoft, fontFamily: "var(--cam-font-sans)" }}>
          {t("vtWizard.noRows", { default: "Aucune ligne saisie pour le moment." })}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entered.map((row) => (
            <FixedSummaryRow key={row.idx} row={row} data={data} numberCells={numberCells} onEdit={handleEdit} onRemove={handleRemove} />
          ))}
        </div>
      )}

      {filledRows.length > 0 && (
        <TotalBar
          totalsText={numberCells.map((c, i) => `${cellLabel(c, locale)}: ${guidedNumberDisplay(totals[i], locale)}`).join(" · ")}
          countText={t("vtWizard.filledOfTotalNoun", {
            default: "{count}/{total} {noun} renseignées",
            count: filledRows.length,
            total: rows.length,
            noun: localizedNoun(vt.progressNoun, locale, "lignes", "rows"),
          })}
        />
      )}
    </div>
  );
}

function FixedSummaryRow({
  row, data, numberCells, onEdit, onRemove,
}: {
  row: VRow; data: FormData;
  numberCells: VtCellDef[]; onEdit: (row: VRow) => void; onRemove: (row: VRow) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const label = cellLabelText(row.rowDef.label, locale) || "";
  const vals = numberCells.map((c) => {
    const v = data[cellId(row, c)];
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });
  const total = vals.filter((v) => v != null).length === vals.length && vals.length > 0
    ? vals.reduce((a, b) => (a ?? 0) + (b ?? 0), 0)
    : null;
  return (
    <div style={summaryRowStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-question-weight)", fontSize: "var(--cam-question-size)", color: ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </p>
        <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-font-weight-regular)", fontSize: "var(--cam-answer-size)", color: ink, margin: "2px 0 0" }}>
          {numberCells.map((c, i) => `${cellLabel(c, locale)}: ${guidedNumberDisplay(vals[i], locale)}`).join(" · ")}
        </p>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {vals.length === 2 && (
          <span style={{ fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-font-weight-regular)", fontSize: "var(--cam-answer-size)", color: ink, minWidth: 56, textAlign: "center" }}>
            {guidedNumberDisplay(total, locale)}
          </span>
        )}
        <IconButton text={t("vtWizard.editShort")} label={rowActionLabel(t, "edit", row, label)} onTap={() => onEdit(row)} />
        <IconButton text={t("vtWizard.removeShort")} label={rowActionLabel(t, "remove", row, label)} onTap={() => onRemove(row)} />
      </div>
    </div>
  );
}

export function VtWizardProgressiveGuidedTableEntry({
  field, data, onChange,
}: { field: OnefopField; data: FormData; onChange: (cellId: string, value: unknown, recalculate?: boolean) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const vt = field.table!.vt!;
  const rows = getRows(vt);
  const labelCell = vt.cells[0];
  const numberCells = vt.cells.slice(1).filter((c) => c.kind === "number");
  const computedCell = vt.cells.slice(1).find((c) => c.kind === "computed");
  const [selectedRow, setSelectedRow] = useState<VRow | null>(null);
  const [labelValue, setLabelValue] = useState("");
  const [controls, setControls] = useState<Record<string, string>>({});
  const [labelError, setLabelError] = useState(false);

  const rowHasLabel = (row: VRow): boolean => {
    const v = data[cellId(row, labelCell)];
    return v !== undefined && v !== "" && v !== null;
  };

  const filledRows = rows.filter(rowHasLabel);
  const entered = filledRows.filter((r) => r !== selectedRow);
  const atCapacity = selectedRow == null && rows.every(rowHasLabel);

  const totals = numberCells.map((c) => {
    const vals = filledRows.map((r) => {
      const v = data[cellId(r, c)];
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    });
    return sumReported(vals);
  });

  const handleAdd = () => {
    if (!labelValue.trim()) { setLabelError(true); return; }
    const row = selectedRow ?? (rows.find((r) => !rowHasLabel(r)) || rows[rows.length - 1]);
    onChange(cellId(row, labelCell), labelValue.trim(), false);
    for (const cell of numberCells) {
      const val = controls[cell.key];
      onChange(cellId(row, cell), val === undefined || val === "" ? null : Number(val), true);
    }
    setSelectedRow(null);
    setLabelValue("");
    setControls({});
    setLabelError(false);
  };

  const handleRemove = (row: VRow) => {
    onChange(cellId(row, labelCell), null, false);
    for (const cell of numberCells) {
      onChange(cellId(row, cell), null, true);
    }
    if (selectedRow === row) {
      setSelectedRow(null);
      setLabelValue("");
      setControls({});
      setLabelError(false);
    }
  };

  const handleEdit = (row: VRow) => {
    setSelectedRow(row);
    setLabelValue((data[cellId(row, labelCell)] as string) ?? "");
    const newControls: Record<string, string> = {};
    for (const cell of numberCells) {
      const v = data[cellId(row, cell)];
      newControls[cell.key] = v == null ? "" : String(v);
    }
    setControls(newControls);
    setLabelError(false);
  };

  const title = <CodedLabel code={field.paperCode} text={cellLabelText(vt.title, locale)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <GuidedHeaderBox title={title} tinted={false} />
      <div style={guidedEntryContainerStyle}>
        <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: 800, fontSize: 14, color: accentGreen, margin: "0 0 4px" }}>
          {t("vtWizard.stepByStep", { default: "Saisie progressive" })}
        </p>
        <p style={{ fontSize: "var(--cam-microcopy-size)", color: inkSoft, fontFamily: "var(--cam-font-sans)", margin: "0 0 16px" }}>
          {cellLabelText(vt.progressNoun, locale) || t("vtWizard.rowsNoun", { default: "Lignes" })}
        </p>
        <GuidedNumberBox
          label={cellLabel(labelCell, locale)}
          value={labelValue}
          onChange={setLabelValue}
          numeric={false}
          errorText={labelError ? t("vtWizard.enterName", { default: "Saisissez un intitulé avant d'enregistrer la ligne." }) : undefined}
          onCommit={handleAdd}
        />
        {numberCells.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            {numberCells.reduce((acc, cell, i) => {
              if (i % 2 === 0) {
                acc.push(
                  <div key={cell.key} style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <GuidedNumberBox
                        label={cellLabel(cell, locale)}
                        value={controls[cell.key] ?? ""}
                        onChange={(v) => setControls({ ...controls, [cell.key]: v })}
                      />
                    </div>
                    {numberCells[i + 1] && (
                      <div style={{ flex: 1 }}>
                        <GuidedNumberBox
                          label={cellLabel(numberCells[i + 1], locale)}
                          value={controls[numberCells[i + 1].key] ?? ""}
                          onChange={(v) => setControls({ ...controls, [numberCells[i + 1].key]: v })}
                        />
                      </div>
                    )}
                  </div>,
                );
              }
              return acc;
            }, [] as ReactNode[])}
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={handleAdd}
            disabled={atCapacity}
            style={{ ...addButtonStyle, maxWidth: 180, opacity: atCapacity ? 0.5 : 1 }}
          >
            {t("vtWizard.saveRow", { default: "Enregistrer la ligne" })}
          </button>
        </div>
      </div>

      <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: 800, fontSize: 14, color: accentGreen, margin: 0 }}>
        {t("vtWizard.summary", { default: "Résumé des lignes saisies" })}
      </p>
      <p style={{ fontSize: "var(--cam-microcopy-size)", color: inkSoft, fontFamily: "var(--cam-font-sans)", margin: "4px 0" }}>
        {t("vtWizard.rowsFilledNote", {
          default: "{count} {noun} renseigné(s) sur {total}. Les lignes peuvent être éditées ou supprimées avant validation.",
          count: entered.length,
          total: rows.length,
          noun: localizedNoun(vt.progressNoun, locale, "lignes", "rows"),
        })}
      </p>

      {entered.length === 0 ? (
        <p style={{ fontSize: "var(--cam-microcopy-size)", color: inkSoft, fontFamily: "var(--cam-font-sans)" }}>
          {t("vtWizard.noRows", { default: "Aucune ligne saisie pour le moment." })}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entered.map((row) => (
            <ProgressiveSummaryRow
              key={row.idx} row={row} vt={vt} data={data}
              numberCells={numberCells} computedCell={computedCell}
              onEdit={handleEdit} onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {filledRows.length > 0 && (
        <div>
          <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: 800, fontSize: 14, color: accentGreen, margin: 0 }}>
            {t("vtWizard.runningTotal", { default: "Total en cours" })}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            {numberCells.map((cell, i) => (
              <div key={cell.key} style={{ minWidth: 140, flex: 1 }}>
                <GuidedStatBox label={cellLabel(cell, locale)} value={totals[i]} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressiveSummaryRow({
  row, vt, data, numberCells, computedCell, onEdit, onRemove,
}: {
  row: VRow; vt: VtTableMeta; data: FormData;
  numberCells: VtCellDef[]; computedCell?: VtCellDef;
  onEdit: (row: VRow) => void; onRemove: (row: VRow) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const label = (data[cellId(row, vt.cells[0])] as string) ?? "";
  const vals = numberCells.map((c) => {
    const v = data[cellId(row, c)];
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });
  const computedVal = computedCell
    ? (() => {
        const v = data[cellId(row, computedCell!)];
        return v != null ? Number(v) : null;
      })()
    : null;
  const detail = numberCells.map((c, i) => `${cellLabel(c, locale)}: ${guidedNumberDisplay(vals[i], locale)}`).join(" · ");

  return (
    <div style={summaryRowStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-question-weight)", fontSize: "var(--cam-question-size)", color: ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </p>
        {detail && (
          <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-font-weight-regular)", fontSize: "var(--cam-answer-size)", color: ink, margin: "2px 0 0" }}>
            {detail}
          </p>
        )}
      </div>
      {computedCell && computedVal != null && (
        <span style={{ fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-font-weight-regular)", fontSize: "var(--cam-answer-size)", color: ink, minWidth: 60, textAlign: "right" }}>
          {computedVal}
        </span>
      )}
      <IconButton text={t("vtWizard.editShort")} label={rowActionLabel(t, "edit", row, label)} onTap={() => onEdit(row)} />
      <IconButton text={t("vtWizard.removeShort")} label={rowActionLabel(t, "remove", row, label)} onTap={() => onRemove(row)} />
    </div>
  );
}

export function VtWizardProgressiveBooleanTableEntry({
  field, data, onChange,
}: { field: OnefopField; data: FormData; onChange: (cellId: string, value: unknown, recalculate?: boolean) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const vt = field.table!.vt!;
  const rows = getRows(vt);
  const labelCell = vt.cells[0];
  const boolCells = vt.cells.slice(1);
  const [selectedRow, setSelectedRow] = useState<VRow | null>(null);
  const [labelValue, setLabelValue] = useState("");
  const [boolValues, setBoolValues] = useState<Record<string, boolean | null>>({});
  const groupIdPrefix = useId();

  const rowHasLabel = (row: VRow): boolean => {
    const v = data[cellId(row, labelCell)];
    return v !== undefined && v !== "" && v !== null;
  };

  const filledCount = rows.filter(rowHasLabel).length;
  const entered = rows.filter(rowHasLabel).filter((r) => r !== selectedRow);
  const atCapacity = selectedRow == null && rows.every(rowHasLabel);

  const handleAdd = () => {
    if (!labelValue.trim()) return;
    const row = selectedRow ?? (rows.find((r) => !rowHasLabel(r)) || rows[rows.length - 1]);
    onChange(cellId(row, labelCell), labelValue.trim(), false);
    for (const cell of boolCells) {
      const v = boolValues[cell.key];
      onChange(cellId(row, cell), v == null ? null : String(v), false);
    }
    setSelectedRow(null);
    setLabelValue("");
    setBoolValues({});
  };

  const handleRemove = (row: VRow) => {
    onChange(cellId(row, labelCell), null, false);
    for (const cell of boolCells) {
      onChange(cellId(row, cell), null, false);
    }
    if (selectedRow === row) {
      setSelectedRow(null);
      setLabelValue("");
      setBoolValues({});
    }
  };

  const handleEdit = (row: VRow) => {
    setSelectedRow(row);
    setLabelValue((data[cellId(row, labelCell)] as string) ?? "");
    const newBools: Record<string, boolean | null> = {};
    for (const cell of boolCells) {
      const v = data[cellId(row, cell)];
      if (v === null || v === undefined || v === "") newBools[cell.key] = null;
      else if (typeof v === "boolean") newBools[cell.key] = v;
      else newBools[cell.key] = v === "true";
    }
    setBoolValues(newBools);
  };

  const title = <CodedLabel code={field.paperCode} text={cellLabelText(vt.title, locale)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <GuidedHeaderBox title={title} tinted={false} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <GuidedNumberBox
          label={cellLabel(labelCell, locale)}
          value={labelValue}
          onChange={setLabelValue}
          numeric={false}
        />
        {boolCells.map((cell) => {
          const dependsOn = cell.dependsOnKey;
          const gateValue = dependsOn ? boolValues[dependsOn] : true;
          if (!gateValue) return null;
          const val = boolValues[cell.key] ?? null;
          // Native radio group: no option is checked until the respondent
          // picks one, so "not answered" (null) stays distinct from Non.
          const groupName = `${groupIdPrefix}-${cell.key}`;
          return (
            <GuidedYesNoRadioGroup
              key={cell.key}
              name={groupName}
              label={cellLabel(cell, locale)}
              value={val}
              onChange={(answer) => setBoolValues({ ...boolValues, [cell.key]: answer })}
            />
          );
        })}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
          <span style={{ fontFamily: "var(--cam-font-sans)", fontWeight: 800, fontSize: 13, color: accentGreen, flex: 1 }}>
            {t("vtWizard.total", { default: "Total" })}{"   "}
            {t("vtWizard.totalAdded", {
              default: "{count} {noun} ajoutés",
              count: filledCount,
              noun: localizedNoun(vt.progressNoun, locale, "entrés", "added"),
            })}
          </span>
          <button
            type="button"
            onClick={handleAdd}
            disabled={atCapacity}
            style={{ ...addButtonStyle, maxWidth: 180, opacity: atCapacity ? 0.5 : 1 }}
          >
            {t("vtWizard.add", { default: "Ajouter" })}
          </button>
        </div>
      </div>

      {entered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entered.map((row) => {
            const label = (data[cellId(row, labelCell)] as string) ?? "";
            // Unanswered cells (null/undefined/"") are left out rather than
            // shown as "Non".
            const detailParts = boolCells
              .filter((c) => {
                const v = data[cellId(row, c)];
                return v !== null && v !== undefined && v !== "";
              })
              .map((c) => {
                const v = data[cellId(row, c)];
                const boolVal = typeof v === "boolean" ? v : v === "true";
                return `${cellLabel(c, locale)} : ${boolVal ? t("vtTableRenderer.booleanYes") : t("vtTableRenderer.booleanNo")}`;
              });
            return (
              <div key={row.idx} style={{ ...summaryRowStyle, justifyContent: "space-between" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-question-weight)", fontSize: "var(--cam-question-size)", color: ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {label}
                  </p>
                  {detailParts.length > 0 && (
                    <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-font-weight-regular)", fontSize: "var(--cam-answer-size)", color: ink, margin: "2px 0 0" }}>
                      {detailParts.join(" • ")}
                    </p>
                  )}
                </div>
                <IconButton text={t("vtWizard.editShort")} label={rowActionLabel(t, "edit", row, label)} onTap={() => handleEdit(row)} />
                <IconButton text={t("vtWizard.removeShort")} label={rowActionLabel(t, "remove", row, label)} onTap={() => handleRemove(row)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Named-roster guided entry — port of Flutter's VtWizardRosterGuidedEntry
 * (vt_wizard_table_guided_entry.dart:1586). There is exactly one roster
 * table in the schema today (section 8.8, "Liste nominative des
 * formateurs"): two text identity cells (lastName/firstName), a 2-option
 * sex code, a multi-option status code, a boolean admin-staff flag, and
 * two diploma code cells. Like Flutter's version, this is deliberately
 * shaped to that cell set rather than fully generic — a second roster
 * shape would need its own widget, same as Flutter does.
 */
export function VtWizardRosterGuidedEntry({
  field, data, onChange,
}: { field: OnefopField; data: FormData; onChange: (cellId: string, value: unknown, recalculate?: boolean) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const vt = field.table!.vt!;
  const rows = getRows(vt);
  const lastNameCell = vt.cells.find((c) => c.key === "lastName") ?? vt.cells[0];
  const firstNameCell = vt.cells.find((c) => c.key === "firstName") ?? vt.cells[1];
  const sexCell = vt.cells.find((c) => c.key === "sex");
  const statusCell = vt.cells.find((c) => c.key === "trainerStatus");
  const adminCell = vt.cells.find((c) => c.key === "isAdminPersonnel");
  const diplomaCells = vt.cells.filter((c) => c.key.toLowerCase().endsWith("diploma"));

  const [selectedRow, setSelectedRow] = useState<VRow | null>(null);
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [radioValues, setRadioValues] = useState<Record<string, string | null>>({});
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const adminGroupName = useId();
  const [lastNameError, setLastNameError] = useState(false);

  const rowFilled = (row: VRow): boolean => {
    const v = data[cellId(row, lastNameCell)];
    return v !== undefined && v !== null && v !== "";
  };

  const filledRows = rows.filter(rowFilled);
  const entered = filledRows.filter((r) => r !== selectedRow);
  const atCapacity = selectedRow == null && rows.every(rowFilled);

  const clearForm = () => {
    setSelectedRow(null);
    setLastNameError(false);
    setLastName("");
    setFirstName("");
    setRadioValues({});
    setIsAdmin(null);
  };

  const handleAdd = () => {
    const trimmed = lastName.trim();
    if (!trimmed) {
      setLastNameError(true);
      return;
    }
    const row = selectedRow ?? rows.find((r) => !rowFilled(r)) ?? rows[rows.length - 1];
    onChange(cellId(row, lastNameCell), trimmed);
    onChange(cellId(row, firstNameCell), firstName.trim());
    for (const cell of [sexCell, statusCell, ...diplomaCells]) {
      if (!cell) continue;
      onChange(cellId(row, cell), radioValues[cell.key] ?? null);
    }
    if (adminCell) onChange(cellId(row, adminCell), isAdmin);
    clearForm();
  };

  const handleRemove = (row: VRow) => {
    for (const cell of vt.cells) {
      onChange(cellId(row, cell), null);
    }
    if (selectedRow === row) clearForm();
  };

  const handleEdit = (row: VRow) => {
    setSelectedRow(row);
    setLastName((data[cellId(row, lastNameCell)] as string) ?? "");
    setFirstName((data[cellId(row, firstNameCell)] as string) ?? "");
    const newRadios: Record<string, string | null> = {};
    for (const cell of [sexCell, statusCell, ...diplomaCells]) {
      if (!cell) continue;
      newRadios[cell.key] = (data[cellId(row, cell)] as string) ?? null;
    }
    setRadioValues(newRadios);
    if (adminCell) {
      const adminVal = data[cellId(row, adminCell)];
      setIsAdmin(
        adminVal === null || adminVal === undefined
          ? null
          : typeof adminVal === "boolean" ? adminVal : adminVal === "true",
      );
    }
    setLastNameError(false);
  };

  const title = <CodedLabel code={field.paperCode} text={cellLabelText(vt.title, locale)} />;

  const optionLabel = (cell: VtCellDef | undefined, value: unknown): string | null => {
    if (!cell || value == null) return null;
    const opt = cell.options?.find((o) => o.value === value);
    return opt ? cellLabelText(opt.label, locale) : null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <GuidedHeaderBox title={title} />
      <div style={guidedEntryContainerStyle}>
        <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: 800, fontSize: 14, color: accentGreen, margin: "0 0 16px" }}>
          {t("vtWizard.addTrainer", { default: "Ajouter un formateur" })}
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <GuidedNumberBox
              label={cellLabel(lastNameCell, locale)}
              value={lastName}
              onChange={(v) => {
                setLastName(v);
                if (lastNameError) setLastNameError(false);
              }}
              numeric={false}
              errorText={
                lastNameError
                  ? t("vtWizard.enterSurname", { default: "Saisissez le nom avant d'enregistrer le formateur." })
                  : undefined
              }
            />
          </div>
          <div style={{ flex: 1 }}>
            <GuidedNumberBox label={cellLabel(firstNameCell, locale)} value={firstName} onChange={setFirstName} numeric={false} />
          </div>
        </div>
        {(statusCell || sexCell) && (
          <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "flex-end" }}>
            {statusCell && (
              <div style={{ flex: 1 }}>
                <GuidedRadioDropdown
                  label={cellLabel(statusCell, locale)}
                  options={statusCell.options ?? []}
                  value={radioValues[statusCell.key] ?? null}
                  onChange={(v) => setRadioValues({ ...radioValues, [statusCell.key]: v })}
                />
              </div>
            )}
            {sexCell && (
              <div style={{ width: 180 }}>
                <GuidedSexToggle
                  label={cellLabel(sexCell, locale)}
                  options={sexCell.options ?? []}
                  value={radioValues[sexCell.key] ?? null}
                  onChange={(v) => setRadioValues({ ...radioValues, [sexCell.key]: v })}
                />
              </div>
            )}
          </div>
        )}
        {diplomaCells.map((cell) => (
          <div key={cell.key} style={{ marginTop: 12 }}>
            <GuidedRadioDropdown
              label={cellLabel(cell, locale)}
              options={cell.options ?? []}
              value={radioValues[cell.key] ?? null}
              onChange={(v) => setRadioValues({ ...radioValues, [cell.key]: v })}
            />
          </div>
        ))}
        {adminCell && (
          <GuidedYesNoRadioGroup
            name={adminGroupName}
            label={cellLabel(adminCell, locale)}
            value={isAdmin}
            onChange={setIsAdmin}
            style={{ marginTop: 16 }}
          />
        )}
        <button
          type="button"
          onClick={handleAdd}
          disabled={atCapacity}
          style={{ ...addButtonStyle, marginTop: 16, opacity: atCapacity ? 0.5 : 1, cursor: atCapacity ? "default" : "pointer" }}
        >
          {t("vtWizard.saveTrainer", { default: "Enregistrer le formateur" })}
        </button>
      </div>

      <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: 800, fontSize: 14, color: accentGreen, margin: 0 }}>
        {t("vtWizard.registeredTrainers", { default: "Formateurs enregistrés" })}
      </p>
      <p style={{ fontSize: "var(--cam-microcopy-size)", color: inkSoft, fontFamily: "var(--cam-font-sans)", margin: "4px 0" }}>
        {t("vtWizard.countOfTotalNoun", {
          default: "{count} {noun} sur {total}.",
          count: filledRows.length,
          total: rows.length,
          noun: localizedNoun(vt.progressNoun, locale, "formateurs", "trainers"),
        })}
      </p>

      {entered.length === 0 ? (
        <p style={{ fontSize: "var(--cam-microcopy-size)", color: inkSoft, fontFamily: "var(--cam-font-sans)" }}>
          {t("vtWizard.noTrainers", { default: "Aucun formateur enregistré pour le moment." })}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entered.map((row) => {
            const label = `${(data[cellId(row, lastNameCell)] as string) ?? ""} ${(data[cellId(row, firstNameCell)] as string) ?? ""}`.trim();
            const adminVal = adminCell ? data[cellId(row, adminCell)] : null;
            const isAdminVal = adminVal === null || adminVal === undefined ? null : typeof adminVal === "boolean" ? adminVal : adminVal === "true";
            const detailParts = [
              statusCell ? optionLabel(statusCell, data[cellId(row, statusCell)]) : null,
              isAdminVal ? t("vtWizard.adminStaff", { default: "Personnel administratif" }) : null,
            ].filter((part): part is string => !!part);

            return (
              <div key={row.idx} style={summaryRowStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-question-weight)", fontSize: "var(--cam-question-size)", color: ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {label}
                  </p>
                  {detailParts.length > 0 && (
                    <p style={{ fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-font-weight-regular)", fontSize: "var(--cam-answer-size)", color: ink, margin: "2px 0 0" }}>
                      {detailParts.join(" · ")}
                    </p>
                  )}
                </div>
                <IconButton text={t("vtWizard.editShort")} label={rowActionLabel(t, "edit", row, label)} onTap={() => handleEdit(row)} />
                <IconButton text={t("vtWizard.removeShort")} label={rowActionLabel(t, "remove", row, label)} onTap={() => handleRemove(row)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const GuidedRadioDropdown = memo(function GuidedRadioDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: VtCellOption[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <div style={numberBoxContainerStyle}>
      <label style={{ fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-question-weight)", fontSize: "var(--cam-question-size)", color: ink }}>
        {label}
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        style={{ ...numberBoxInputStyle, cursor: "pointer" }}
      >
        <option value="">{t("vtWizard.select", { default: "Sélectionner…" })}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {cellLabelText(opt.label, locale)}
          </option>
        ))}
      </select>
    </div>
  );
});

const GuidedSexToggle = memo(function GuidedSexToggle({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: VtCellOption[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  const locale = useLocale();
  return (
    <div style={numberBoxContainerStyle}>
      <label style={{ fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-question-weight)", fontSize: "var(--cam-question-size)", color: ink }}>
        {label}
      </label>
      <div style={{ display: "flex", height: "var(--cam-form-field-height)", padding: 2, background: "var(--cam-bg)", border: `1px solid ${cardBorder}`, borderRadius: "var(--cam-radius-sm)" }}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                flex: 1,
                border: "none",
                cursor: "pointer",
                borderRadius: "var(--cam-radius-sm)",
                background: active ? accentGreen : "transparent",
                color: active ? "#ffffff" : inkSoft,
                fontFamily: "var(--cam-font-sans)",
                fontWeight: 600,
                fontSize: 12,
                textTransform: "uppercase",
              }}
            >
              {cellLabelText(opt.label, locale)}
            </button>
          );
        })}
      </div>
    </div>
  );
});

/** Oui/Non question as a native radio group: a fieldset named by the
 * question (legend), one shared `name`, the whole label clickable. Nothing is
 * checked while `value` is null, so "not answered" stays distinct from Non. */
const GuidedYesNoRadioGroup = memo(function GuidedYesNoRadioGroup({
  name,
  label,
  value,
  onChange,
  style,
}: {
  name: string;
  label: ReactNode;
  value: boolean | null;
  onChange: (v: boolean) => void;
  style?: CSSProperties;
}) {
  const t = useTranslations();
  return (
    <fieldset
      style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, border: "none", margin: 0, padding: 0, minWidth: 0, ...style }}
    >
      <legend style={{ float: "left", padding: 0, fontFamily: "var(--cam-font-sans)", fontWeight: "var(--cam-question-weight)", fontSize: "var(--cam-question-size)", lineHeight: "var(--cam-question-line-height)", color: ink, margin: 0 }}>
        {label}
      </legend>
      <div style={{ display: "flex", gap: 16 }}>
        {([true, false] as const).map((answer) => {
          const selected = value === answer;
          return (
            <label
              key={String(answer)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                minHeight: 32, cursor: "pointer",
                fontFamily: "var(--cam-font-sans)",
                fontWeight: selected ? 600 : 400, fontSize: "var(--cam-answer-size)",
                color: selected ? ink : inkSoft,
              }}
            >
              <input
                type="radio"
                name={name}
                value={String(answer)}
                checked={selected}
                onChange={() => onChange(answer)}
                style={{ margin: 0, accentColor: accentGreen, cursor: "pointer" }}
              />
              {answer ? t("vtTableRenderer.booleanYes") : t("vtTableRenderer.booleanNo")}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
});

export const vtWizardSupportsGuidedEntryEntry = supportsGuidedEntry;
