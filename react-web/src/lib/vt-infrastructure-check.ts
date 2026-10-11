// 5.3 (infrastructure by condition): on the paper form the condition columns
// break down the same buildings as "Nombre total de locaux" — Définitif (bon
// état, mauvais état) and Provisoire. A row whose total differs from that sum
// is flagged to the respondent as advisory only (constitution §7): it never
// blocks Suivant or submission, and the typed total is never overwritten.

import type { FormData, LocalizedText, OnefopField } from "@/lib/onefop-schema";

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
