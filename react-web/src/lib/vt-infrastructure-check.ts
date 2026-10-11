// 5.3 (infrastructure by condition): on the paper form the condition columns
// break down the same buildings as "Nombre total de locaux" — Définitif (bon
// état, mauvais état) and Provisoire — under the one heading "Nombre de
// locaux selon les matériaux de construction et l'état", and the
// instructions give every room a construction type and every permanent room
// a condition. A row whose total differs from that sum blocks Suivant and
// submission (owner, 2026-10-11, constitution §7). The typed total is never
// overwritten: the respondent corrects one side or the other.

import type { FormData, LocalizedText, OnefopField } from "@/lib/onefop-schema";
import { isVtCentreClosed } from "@/lib/vt-quiz";

export const VT53_FIELD_ID = "VT5_6";

const TOTAL = "totalCount";
const PARTS = ["permanentGoodCount", "permanentBadCount", "temporaryCount"] as const;

export interface Vt53Mismatch {
  rowId: string;
  /** The row's label, as in the schema. */
  label: LocalizedText;
  total: number;
  parts: [number, number, number];
}

function count(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Rows with all four cells filled whose total is not Good + Bad + Temporary. */
export function vt53TotalMismatches(field: OnefopField, data: FormData): Vt53Mismatch[] {
  const vt = field.table?.vt;
  if (field.id !== VT53_FIELD_ID || !vt) return [];
  const col = (key: string) => vt.cells.findIndex((c) => c.key === key);
  const totalIdx = col(TOTAL);
  const partIdx = PARTS.map(col);
  if (totalIdx < 0 || partIdx.some((j) => j < 0)) return [];

  const out: Vt53Mismatch[] = [];
  vt.rows.forEach((row, i) => {
    const key = (j: number) => field.table?.matrix?.[i]?.[j] ?? `${row.id}_${vt.cells[j].key}`;
    const total = count(data[key(totalIdx)]);
    const parts = partIdx.map((j) => count(data[key(j)]));
    if (total === null || parts.some((p) => p === null)) return;
    const [good, bad, temporary] = parts as [number, number, number];
    if (good + bad + temporary !== total) {
      out.push({ rowId: row.id, label: row.label ?? { fr: row.id, en: row.id }, total, parts: [good, bad, temporary] });
    }
  });
  return out;
}

/**
 * 5.3's disagreeing rows as one blocking issue on the table, or null. Applies
 * only when 5.3 is among `fields` (its section, or the whole entity).
 */
export function vt53Issue(
  fields: readonly OnefopField[],
  data: FormData,
): { fieldId: string; fr: string; en: string } | null {
  if (isVtCentreClosed(data)) return null;
  const field = fields.find((f) => f.id === VT53_FIELD_ID);
  if (!field) return null;
  const mismatches = vt53TotalMismatches(field, data);
  if (mismatches.length === 0) return null;
  const rows = (lang: "fr" | "en") =>
    mismatches
      .map((m) => {
        const [good, bad, temporary] = m.parts;
        const sum = good + bad + temporary;
        return lang === "fr"
          ? `${m.label.fr} : total ${m.total}, mais ${good} + ${bad} + ${temporary} = ${sum}`
          : `${m.label.en}: total ${m.total}, but ${good} + ${bad} + ${temporary} = ${sum}`;
      })
      .join(lang === "fr" ? " ; " : "; ");
  return {
    fieldId: field.id,
    fr: `Le nombre total de locaux doit être la somme des trois états (définitif bon état, définitif mauvais état, provisoire). ${rows("fr")}.`,
    en: `The total number of rooms must be the sum of the three conditions (permanent good, permanent bad, temporary). ${rows("en")}.`,
  };
}
