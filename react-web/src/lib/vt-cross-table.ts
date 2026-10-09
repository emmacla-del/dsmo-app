// Training-centre (VT) cross-table coherence.
//
// The VT form counts the same people several times, each breakdown in its
// own table: the learners by academic diploma (4.1), by professional diploma
// (4.2), by specialty (4.5) and — for initial training — by year of study
// (4.6); the trainers by academic diploma (8.1), by professional diploma
// (8.2), by age (8.3) and by status (8.5). The auto-calculation totals each
// table on its own; nothing derives one table from another, so the
// breakdowns only agree if the respondent's numbers do. A disagreement is
// shown on the later table and blocks Suivant / submission until it is
// corrected (product decision, 2026-10-09).
//
// Only comparisons of the same population are made. The server's other
// checks — 4.2 against the entrants of 4.7/4.8, and 4.7 leavers against the
// previous year's leavers in 4.10 — compare different populations and await
// domain review; they are deliberately absent here.
//
// A comparison waits until both of its tables are complete: while a table
// still has cells to fill, that is the only thing reported about it.
import type { FormData, OnefopField } from "./onefop-schema";
import { isVtCentreClosed, missingVtTableCells } from "./vt-quiz";

export interface VtCrossTableIssue {
  /** The later table, which carries the message. */
  fieldId: string;
  fr: string;
  en: string;
}

type Sex = "male" | "female";
const SEX_LABEL: Record<Sex, { fr: string; en: string }> = {
  male: { fr: "hommes", en: "men" },
  female: { fr: "femmes", en: "women" },
};

/** One side of a comparison: which table (or fields) and which cells count each sex. */
interface Side {
  code: string;
  fieldId: string;
  /** Cell keys (table) or field ids (plain number fields) summed for each sex. */
  keys: Record<Sex, string[]>;
  /** Plain number fields rather than a table. */
  plain?: boolean;
}

const BY_SEX = { male: ["male"], female: ["female"] };

const RULES: Array<{ anchor: Side; checked: Side; population: { fr: string; en: string } }> = [
  {
    anchor: { code: "4.1", fieldId: "VT4_1", keys: BY_SEX },
    checked: { code: "4.2", fieldId: "VT4_2", keys: BY_SEX },
    population: { fr: "apprenants", en: "learners" },
  },
  {
    anchor: { code: "4.2", fieldId: "VT4_2", keys: BY_SEX },
    checked: { code: "4.5", fieldId: "VT4_5", keys: { male: ["fiMale", "fcMale"], female: ["fiFemale", "fcFemale"] } },
    population: { fr: "apprenants", en: "learners" },
  },
  {
    anchor: { code: "4.5 (FI)", fieldId: "VT4_5", keys: { male: ["fiMale"], female: ["fiFemale"] } },
    checked: { code: "4.6", fieldId: "VT4_6", keys: { male: ["year1Male", "year2Male"], female: ["year1Female", "year2Female"] } },
    population: { fr: "apprenants en formation initiale", en: "initial-training learners" },
  },
  {
    anchor: { code: "8.1", fieldId: "VT8_1", keys: BY_SEX },
    checked: { code: "8.2", fieldId: "VT8_2", keys: BY_SEX },
    population: { fr: "formateurs", en: "trainers" },
  },
  {
    anchor: { code: "8.1", fieldId: "VT8_1", keys: BY_SEX },
    checked: { code: "8.3", fieldId: "VT8_3", keys: BY_SEX },
    population: { fr: "formateurs", en: "trainers" },
  },
  {
    anchor: { code: "8.1", fieldId: "VT8_1", keys: BY_SEX },
    checked: {
      code: "8.5",
      fieldId: "VT8_5_VP_M",
      plain: true,
      keys: { male: ["VT8_5_VP_M", "VT8_5_VNP_M", "VT8_5_PERM_M"], female: ["VT8_5_VP_F", "VT8_5_VNP_F", "VT8_5_PERM_F"] },
    },
    population: { fr: "formateurs", en: "trainers" },
  },
];

function isEntered(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** The side's count for one sex, or null while the side is incomplete. */
function sideTotal(side: Side, sex: Sex, fieldsById: Map<string, OnefopField>, data: FormData): number | null {
  if (side.plain) {
    const all = [...side.keys.male, ...side.keys.female];
    if (!all.every((id) => isEntered(data[id]))) return null;
    return side.keys[sex].reduce((sum, id) => sum + num(data[id]), 0);
  }
  const field = fieldsById.get(side.fieldId);
  const vt = field?.table?.vt;
  const matrix = field?.table?.matrix;
  if (!field || !vt || !matrix) return null;
  if (missingVtTableCells(field, data).length > 0) return null;
  const columns = side.keys[sex].map((key) => vt.cells.findIndex((c) => c.key === key));
  if (columns.some((c) => c < 0)) return null;
  return matrix.reduce((sum, rowIds) => sum + columns.reduce((s, c) => s + num(data[rowIds[c]]), 0), 0);
}

/**
 * Disagreements between breakdowns of the same people among `fields` (a
 * section's fields, or the whole entity's). A rule applies only when every
 * table it compares is in `fields`.
 */
export function vtCrossTableIssues(fields: OnefopField[], data: FormData): VtCrossTableIssue[] {
  if (isVtCentreClosed(data)) return [];
  const fieldsById = new Map(fields.map((f) => [f.id, f]));
  const issues: VtCrossTableIssue[] = [];
  for (const { anchor, checked, population } of RULES) {
    if (!fieldsById.has(anchor.fieldId) || !fieldsById.has(checked.fieldId)) continue;
    // One message per comparison (the screen shows one message per table),
    // naming each sex that disagrees.
    const actualParts: Array<{ fr: string; en: string }> = [];
    const expectedParts: Array<{ fr: string; en: string }> = [];
    for (const sex of ["male", "female"] as const) {
      const expected = sideTotal(anchor, sex, fieldsById, data);
      const actual = sideTotal(checked, sex, fieldsById, data);
      if (expected === null || actual === null || expected === actual) continue;
      const s = SEX_LABEL[sex];
      actualParts.push({ fr: `${actual} ${s.fr}`, en: `${actual} ${s.en}` });
      expectedParts.push({ fr: `${expected} ${s.fr}`, en: `${expected} ${s.en}` });
    }
    if (actualParts.length === 0) continue;
    const join = (parts: Array<{ fr: string; en: string }>, lang: "fr" | "en") =>
      parts.map((p) => p[lang]).join(lang === "fr" ? " et " : " and ");
    issues.push({
      fieldId: checked.fieldId,
      fr:
        `Le tableau ${checked.code} compte ${join(actualParts, "fr")}, mais le tableau ${anchor.code} en compte ${join(expectedParts, "fr")}. ` +
        `Les deux décrivent les mêmes ${population.fr} : corrigez l'un ou l'autre pour qu'ils concordent.`,
      en:
        `Table ${checked.code} counts ${join(actualParts, "en")}, but table ${anchor.code} counts ${join(expectedParts, "en")}. ` +
        `Both describe the same ${population.en}: correct one or the other so they match.`,
    });
  }
  return issues;
}
