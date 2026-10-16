// Training-centre (VT) advisory coherence, shown while the tables are filled.
//
// The server compares 4.2 with the entrants of 4.7 and of 4.8, and the
// leavers of 4.7 with 4.10 (rules 4–6 of checkVtCoherence,
// src/questionnaires/questionnaires.service.ts). Those comparisons set
// different populations or reference periods side by side and await domain
// review, so they stay ADVISORY (CLAUDE.md §7): never a blocking error, and
// never mixed with the blocking same-population checks of vt-cross-table.ts.
//
// They are computed here as well as on the server so the respondent sees
// them the moment the figures disagree, not a round trip later, when they
// may already have pressed Next (owner, 2026-10-16). The server stays the
// reference: it computes and stores its own flags at submission, and the
// review screen asks it (POST /onefop/coherence-preview).
// vt-advisory-coherence.test.ts reads the server's row lists so the two
// copies cannot drift apart unnoticed.
//
// Same arithmetic as the server: per sex, the sum of each side; a blank or
// unreadable cell counts 0; flagged when the sums differ and one is not 0.
// Like vt-cross-table.ts, a comparison waits until both of its tables are
// complete: while a table still has cells to fill, its total is unfinished.
// A table the preliminary questionnaire switched off (4.10 when the centre
// declares no former students) is complete and counts 0: that is what the
// submission sends for it (QuizSemantics: NONE, every cell 0), so it is what
// the server compares.
import type { FormData, OnefopField } from "./onefop-schema";
import { missingVtTableCells, vtTableStatus } from "./vt-quiz";

type Sex = "male" | "female";
type Text = { fr: string; en: string };

interface Side {
  fieldId: string;
  /** How the figure is named in the line: "4.7 entrants". */
  label: Text;
  /** The cells counted for each sex, by the end of their key. */
  suffix: Record<Sex, string>;
}

interface Rule {
  /** The server's rule code (checkVtCoherence). */
  code: string;
  first: Side;
  second: Side;
  /** What "Pourquoi ?" explains. */
  why: Text;
}

const ALL = { male: "_male", female: "_female" };
const ENTRANTS = { male: "_entrant_male", female: "_entrant_female" };
const LEAVERS = { male: "_sortant_male", female: "_sortant_female" };
const T42: Side = { fieldId: "VT4_2", label: { fr: "4.2", en: "4.2" }, suffix: ALL };

export const VT_ADVISORY_RULES: readonly Rule[] = [
  {
    code: "VT_TRAINEE_AGE_ENTRANT_MISMATCH",
    first: T42,
    second: { fieldId: "VT4_7", label: { fr: "4.7 entrants", en: "4.7 incoming" }, suffix: ENTRANTS },
    why: {
      fr: "Le tableau 4.2 compte les apprenants par diplôme professionnel, le tableau 4.7 les entrants par tranche d'âge. Ces totaux devraient normalement concorder : vérifiez vos chiffres. Si l'écart est réel, vous pouvez continuer, cela ne bloque pas votre déclaration.",
      en: "Table 4.2 counts trainees by vocational diploma, table 4.7 incoming trainees by age group. These totals should normally agree: check your figures. If the difference is real, you can carry on; it does not stop your declaration.",
    },
  },
  {
    code: "VT_TRAINEE_EDU_LEVEL_ENTRANT_MISMATCH",
    first: T42,
    second: { fieldId: "VT4_8", label: { fr: "4.8 entrants", en: "4.8 incoming" }, suffix: ENTRANTS },
    why: {
      fr: "Le tableau 4.2 compte les apprenants par diplôme professionnel, le tableau 4.8 les entrants par niveau d'études. Ces totaux devraient normalement concorder : vérifiez vos chiffres. Si l'écart est réel, vous pouvez continuer, cela ne bloque pas votre déclaration.",
      en: "Table 4.2 counts trainees by vocational diploma, table 4.8 incoming trainees by level of education. These totals should normally agree: check your figures. If the difference is real, you can carry on; it does not stop your declaration.",
    },
  },
  {
    code: "VT_TRAINEE_OUTGOING_SPECIALTY_MISMATCH",
    first: { fieldId: "VT4_7", label: { fr: "4.7 sortants", en: "4.7 outgoing" }, suffix: LEAVERS },
    second: { fieldId: "VT4_10", label: { fr: "4.10", en: "4.10" }, suffix: ALL },
    why: {
      fr: "Le tableau 4.7 compte les sortants par tranche d'âge, le tableau 4.10 les sortants par spécialité. Ces totaux devraient normalement concorder : vérifiez vos chiffres. Si l'écart est réel, vous pouvez continuer, cela ne bloque pas votre déclaration.",
      en: "Table 4.7 counts outgoing trainees by age group, table 4.10 outgoing trainees by specialty. These totals should normally agree: check your figures. If the difference is real, you can carry on; it does not stop your declaration.",
    },
  },
];

/** The paper number of each table taking part, for "Open table 4.2". */
export const VT_ADVISORY_TABLE_CODES: Readonly<Record<string, string>> = {
  VT4_2: "4.2",
  VT4_7: "4.7",
  VT4_8: "4.8",
  VT4_10: "4.10",
};

export interface VtAdvisoryIssue {
  code: string;
  /** The two tables compared, in paper order. */
  tables: [string, string];
  labels: [Text, Text];
  /** The compared tables the preliminary questionnaire switched off (counted 0). */
  offTables: string[];
  /** One entry per sex whose figures disagree (men first). */
  bySex: Array<{ sex: Sex; first: number; second: number }>;
  why: Text;
}

/** The server's reading of a cell (flatInt): blank or unreadable counts 0. */
function cellInt(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isNaN(n) ? 0 : n;
}

function sideSum(field: OnefopField, suffix: string, data: FormData): number {
  if (vtTableStatus(field.id, data) === "NONE") return 0;
  let sum = 0;
  for (const row of field.table?.matrix ?? []) {
    for (const cell of row) if (cell.endsWith(suffix)) sum += cellInt(data[cell]);
  }
  return sum;
}

/** Every advisory disagreement between complete tables of the section's fields. */
export function vtAdvisoryIssues(fields: readonly OnefopField[], data: FormData): VtAdvisoryIssue[] {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const off = (f: OnefopField) => vtTableStatus(f.id, data) === "NONE";
  const complete = (f: OnefopField | undefined): f is OnefopField =>
    !!f && (off(f) || missingVtTableCells(f, data).length === 0);
  const issues: VtAdvisoryIssue[] = [];
  for (const rule of VT_ADVISORY_RULES) {
    const a = byId.get(rule.first.fieldId);
    const b = byId.get(rule.second.fieldId);
    if (!complete(a) || !complete(b)) continue;
    const bySex: VtAdvisoryIssue["bySex"] = [];
    for (const sex of ["male", "female"] as const) {
      const first = sideSum(a, rule.first.suffix[sex], data);
      const second = sideSum(b, rule.second.suffix[sex], data);
      if (first !== second && (first > 0 || second > 0)) bySex.push({ sex, first, second });
    }
    if (bySex.length > 0) {
      issues.push({
        code: rule.code,
        tables: [rule.first.fieldId, rule.second.fieldId],
        labels: [rule.first.label, rule.second.label],
        offTables: [a, b].filter(off).map((f) => f.id),
        bySex,
        why: rule.why,
      });
    }
  }
  return issues;
}
