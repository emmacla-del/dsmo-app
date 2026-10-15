// What a reviewer reads on the admin file page of a VT (vocational training
// centre) file: every section, question and table of the questionnaire, with
// the respondent's answers, in schema order.
//
// Source: the file's rawData, the respondent's flat form data keyed by the
// schema's own ids (VT2_1, s4q1_licence_male, s8q8_row1_lastName). The
// official PDF is built from the same data. Titles, labels, options, rows
// and columns come from the generated schema (onefop_ast.dart), never from
// this file, so the page cannot drift from the questionnaire.
//
// "Not answered" is its own value (null), never folded into "No" (§9).
import type { FormData, OnefopEntity, OnefopField, OnefopSection, VtCellDef } from "./onefop-schema";
import { isFieldVisible, isVtSectionWaived, localized } from "./onefop-schema";

type Locale = "fr" | "en";

export interface AnswerLabels {
  yes: string;
  no: string;
  /** Label of a table row that has none of its own ("Row 3"). */
  row: (n: number) => string;
}

export interface VtAnswerItem {
  kind: "answer";
  id: string;
  code: string | null;
  label: string;
  /** One entry per selected option or line; null when not answered. */
  values: string[] | null;
}

export interface VtHeadingItem {
  kind: "heading";
  title: string;
}

export interface VtTableColumn {
  key: string;
  label: string;
  numeric: boolean;
}

export interface VtTableItem {
  kind: "table";
  id: string;
  code: string | null;
  title: string;
  columns: VtTableColumn[];
  /** `cells[i]` belongs to `columns[i]`; "" is an empty cell. */
  rows: { label: string; cells: string[] }[];
  /** No cell of the table holds a value. */
  empty: boolean;
  /** 8.8 named staff list withheld from this reviewer (rows are empty). */
  restricted: boolean;
}

export type VtItem = VtAnswerItem | VtHeadingItem | VtTableItem;

export interface VtSectionView {
  id: string;
  title: string;
  /** French title, the value stored in a correction request. */
  titleFr: string;
  /** Sections 2–9 of a closed or non-functional centre are not asked. */
  waived: boolean;
  items: VtItem[];
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

// A VT option is stored as its bilingual label, "fr/ en" ("Oui/ Yes"). When a
// stored value matches no schema option, the half in the reader's language is
// shown; anything else is shown as stored. It is still the respondent's answer.
export function localHalf(value: string, locale: Locale): string {
  const parts = value.split("/ ");
  return parts.length === 2 ? parts[locale === "en" ? 1 : 0].trim() : value;
}

function optionLabel(field: OnefopField, value: string, locale: Locale): string {
  const option = field.options?.find((o) => o.value === value);
  return option?.label ? localized(option.label, locale) : localHalf(value, locale);
}

export function formatAnswer(field: OnefopField, value: unknown, locale: Locale, labels: AnswerLabels): string[] | null {
  if (isBlank(value)) return null;
  if (typeof value === "boolean") return [value ? labels.yes : labels.no];
  const list = Array.isArray(value) ? value : [value];
  const out = list
    .map((v) => String(v ?? "").trim())
    .filter((v) => v !== "")
    .map((v) => (field.options?.length ? optionLabel(field, v, locale) : v));
  return out.length ? out : null;
}

// "Incoming — Total (computed)" -> "Incoming — Total": the reviewer sees no
// input, so the note meant for the respondent is noise here.
function columnLabel(cell: VtCellDef, locale: Locale): string {
  return localized(cell.label, locale).replace(/\s*\((computed|calculé)\)\s*$/i, "");
}

function cellText(cell: VtCellDef, value: unknown, locale: Locale, labels: AnswerLabels): string {
  if (isBlank(value)) return "";
  const text = String(value).trim();
  if (cell.kind === "boolean") {
    if (value === true || text === "true") return labels.yes;
    if (value === false || text === "false") return labels.no;
    return localHalf(text, locale);
  }
  if (cell.kind === "radioCode" && cell.options) {
    const option = cell.options.find((o) => o.value === text || o.code === text);
    return option?.label ? localized(option.label, locale) : localHalf(text, locale);
  }
  return text;
}

// A computed cell missing from the data (an older save) is the sum of the
// number cells of its own group: entrant_total = entrant_male +
// entrant_female; a plain "total" sums the row's number cells.
function derivedTotal(cells: VtCellDef[], rowIds: string[], index: number, data: FormData): string {
  const key = cells[index].key;
  const group = key.includes("_") ? key.slice(0, key.lastIndexOf("_") + 1) : "";
  let sum = 0;
  let any = false;
  cells.forEach((cell, i) => {
    if (cell.kind !== "number" || !cell.key.startsWith(group)) return;
    const v = data[rowIds[i]];
    if (isBlank(v)) return;
    const n = Number(v);
    if (Number.isFinite(n)) {
      sum += n;
      any = true;
    }
  });
  return any ? String(sum) : "";
}

export function buildVtTable(
  field: OnefopField,
  data: FormData,
  locale: Locale,
  labels: AnswerLabels,
  canSeeStaffNames: boolean,
): VtTableItem {
  const table = field.table;
  const vt = table?.vt;
  const matrix = table?.matrix ?? [];
  const title = localized(vt?.title ?? null, locale) || localized(field.label, locale);
  const base = { kind: "table" as const, id: field.id, code: field.paperCode, title };
  if (!vt) return { ...base, columns: [], rows: [], empty: true, restricted: false };

  const restricted = vt.isRoster && !canSeeStaffNames;
  // Cells that name the row (a specialty, a person) become its label, not a column.
  const labelKeys = new Set(vt.rows.flatMap((r) => r.labelFromCells ?? []));
  const shown = vt.cells.map((cell, i) => ({ cell, i })).filter(({ cell }) => !labelKeys.has(cell.key));
  const columns = shown.map(({ cell }) => ({
    key: cell.key,
    label: columnLabel(cell, locale),
    numeric: cell.kind === "number" || cell.kind === "computed",
  }));

  const filled = (ids: string[]) => ids.some((id) => !isBlank(data[id]));
  const empty = !matrix.some(filled);
  if (restricted) return { ...base, columns, rows: [], empty, restricted };

  // Fixed rows (diplomas, age bands, rooms) are all shown, as on the paper
  // form; rows the respondent adds one by one are shown only when used.
  const growing = vt.isRoster || vt.progressiveRows;
  const rows = matrix.flatMap((rowIds, r) => {
    if (growing && !filled(rowIds)) return [];
    const def = vt.rows[r];
    let label = def?.label ? localized(def.label, locale) : "";
    if (!label && def?.labelFromCells) {
      label = def.labelFromCells
        .map((key) => {
          const i = vt.cells.findIndex((c) => c.key === key);
          return i >= 0 ? String(data[rowIds[i]] ?? "").trim() : "";
        })
        .filter(Boolean)
        .join(" ");
    }
    const cells = shown.map(({ cell, i }) => {
      const value = data[rowIds[i]];
      if (cell.kind === "computed" && isBlank(value)) return derivedTotal(vt.cells, rowIds, i, data);
      return cellText(cell, value, locale, labels);
    });
    return [{ label: label || labels.row(r + 1), cells }];
  });

  return { ...base, columns, rows, empty, restricted };
}

function sectionItems(
  section: OnefopSection,
  data: FormData,
  locale: Locale,
  labels: AnswerLabels,
  canSeeStaffNames: boolean,
): VtItem[] {
  // A subsection heading is worth a line only when it groups several
  // questions; a one-table subsection repeats the table's own title.
  const headingAt = new Map<string, string>();
  for (const sub of section.subsections) {
    const title = localized(sub.title, locale);
    const ids = sub.fieldIds.filter((id) => {
      const field = section.fields.find((f) => f.id === id);
      return field && isFieldVisible(field, data);
    });
    if (title && ids.length > 1) headingAt.set(ids[0], title);
  }

  const items: VtItem[] = [];
  for (const field of section.fields) {
    // A question its gateway did not ask is left out, not shown as unanswered.
    if (!isFieldVisible(field, data)) continue;
    const heading = headingAt.get(field.id);
    if (heading) items.push({ kind: "heading", title: heading });
    if (field.table?.matrix) {
      items.push(buildVtTable(field, data, locale, labels, canSeeStaffNames));
      continue;
    }
    items.push({
      kind: "answer",
      id: field.id,
      code: field.paperCode,
      label: localized(field.label, locale),
      values: formatAnswer(field, data[field.id], locale, labels),
    });
  }
  return items;
}

// The schema prints section titles in capitals, as on the paper form
// ("SECTION 4. INFORMATIONS SUR LES APPRENANTS"). On screen they read in
// sentence case; an acronym keeps its capitals.
const ACRONYMS = new Set(["MINEFOP", "ONEFOP", "VIH", "HIV", "IST", "STI"]);

export function sentenceCaseTitle(title: string): string {
  const lower = title
    .split(/(\s+)/)
    .map((word) => (ACRONYMS.has(word.replace(/[^\p{L}]/gu, "")) ? word : word.toLocaleLowerCase("fr")))
    .join("");
  // Capital at the start and after the section number ("Section 4. Informations").
  return lower.replace(/^(\p{L})|(\d\.\s+)(\p{L})/gu, (_m, first, num, next) =>
    first ? first.toLocaleUpperCase("fr") : `${num}${next.toLocaleUpperCase("fr")}`,
  );
}

export function buildVtSections(
  entity: OnefopEntity,
  data: FormData,
  locale: Locale,
  labels: AnswerLabels,
  canSeeStaffNames: boolean,
): VtSectionView[] {
  return entity.sections.map((section) => {
    const waived = isVtSectionWaived(section.id, data);
    return {
      id: section.id,
      title: sentenceCaseTitle(localized(section.title, locale)),
      titleFr: sentenceCaseTitle(localized(section.title, "fr")),
      waived,
      items: waived ? [] : sectionItems(section, data, locale, labels, canSeeStaffNames),
    };
  });
}
