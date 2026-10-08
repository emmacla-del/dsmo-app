// src/lib/vt-quiz.ts
//
// The training-centre (vocational training) preliminary quiz: which tables
// apply. One rule, used by the form (which tables are shown), the validator
// (which are checked) and the submission (statuses and zeros):
//
//   quiz-governed table   Oui → REPORTED · Non → NONE · unanswered → undecided
//   4.6 (FI years)        REPORTED when 2.1.14 includes Formation Initiale, else NONE
//   every other table     always REPORTED (an operating centre always has them)
//
// A centre declared non-functional or closed in 1.12 answers Section 1 only
// (isVtSectionWaived): no quiz, no table statuses.
//
// The quiz gates tables only — never an ordinary question.

import type { FormData, LocalizedText, OnefopField } from "./onefop-schema";

export type VtQuizQuestionId =
  | "unemployedQualified"
  | "informalSector"
  | "vulnerable"
  | "scholarships"
  | "formerStudents"
  | "formerStudentsPlaced"
  | "trainersWithDisability";

export type VtQuizAnswers = Partial<Record<VtQuizQuestionId, boolean | null>> & { completedAt?: string };

export interface VtQuizQuestion {
  id: VtQuizQuestionId;
  tableId: string;
  tableCode: string;
  text: LocalizedText;
  /** Asked only when this question is answered Oui. */
  parent?: VtQuizQuestionId;
}

export const VT_QUIZ_QUESTIONS: VtQuizQuestion[] = [
  {
    id: "unemployedQualified",
    tableId: "VT4_3",
    tableCode: "4.3",
    text: {
      fr: "Avez-vous des apprenants qualifiés, en âge de travailler et non occupés ?",
      en: "Do you have qualified learners of working age who are not in work?",
    },
  },
  {
    id: "informalSector",
    tableId: "VT4_4",
    tableCode: "4.4",
    text: {
      fr: "Avez-vous des apprenants travaillant dans le secteur informel ?",
      en: "Do you have learners working in the informal sector?",
    },
  },
  {
    id: "vulnerable",
    tableId: "VT4_9",
    tableCode: "4.9",
    text: {
      fr: "Accueillez-vous des personnes socialement vulnérables (handicap, réfugiés, déplacés internes, orphelins, populations autochtones…) ?",
      en: "Do you train socially vulnerable people (disability, refugees, internally displaced, orphans, indigenous peoples…)?",
    },
  },
  {
    id: "scholarships",
    tableId: "VT4_11",
    tableCode: "4.11",
    text: {
      fr: "Des apprenants bénéficient-ils de bourses ?",
      en: "Do any learners receive scholarships?",
    },
  },
  {
    id: "formerStudents",
    tableId: "VT4_10",
    tableCode: "4.10",
    text: {
      fr: "Avez-vous eu des sortants l'année antérieure ?",
      en: "Did you have outgoing trainees last year?",
    },
  },
  {
    id: "formerStudentsPlaced",
    tableId: "VT6_13",
    tableCode: "6.3",
    parent: "formerStudents",
    text: {
      fr: "Des sortants de l'année antérieure ont-ils été insérés ?",
      en: "Were any of last year's outgoing trainees placed in work?",
    },
  },
  {
    id: "trainersWithDisability",
    tableId: "VT8_6",
    tableCode: "8.6",
    text: {
      fr: "Avez-vous des formateurs en situation de handicap ?",
      en: "Do you have trainers with a disability?",
    },
  },
];

const QUESTION_BY_TABLE = new Map(VT_QUIZ_QUESTIONS.map((q) => [q.tableId, q]));
const FI_OPTION_PREFIX = "Formation Initiale";

export type VtTableStatus = "REPORTED" | "NONE";

/** Where a training-centre table's status is recorded in the submission. */
export function vtStatusKey(tableId: string): string {
  return `${tableId}_RESPONSE_STATUS`;
}

/** 1.12 says the centre is non-functional or closed: Section 1 only. */
export function isVtCentreClosed(data: FormData): boolean {
  const status = data["VT1_12"];
  return typeof status === "string" && (status.startsWith("Non-fonctionnelle") || status.startsWith("Fermée"));
}

export function readVtQuiz(data: FormData): VtQuizAnswers | null {
  const raw = data._scopeConfig;
  if (!raw || typeof raw !== "object") return null;
  const vt = (raw as Record<string, unknown>).vocationalTraining;
  return vt && typeof vt === "object" ? (vt as VtQuizAnswers) : null;
}

/** Whether a question is asked, given the answers so far. */
export function isVtQuizQuestionAsked(q: VtQuizQuestion, answers: VtQuizAnswers | null): boolean {
  return !q.parent || answers?.[q.parent] === true;
}

/** Every asked question answered Oui or Non. */
export function isVtQuizComplete(answers: VtQuizAnswers | null): boolean {
  if (!answers) return false;
  return VT_QUIZ_QUESTIONS.every((q) => !isVtQuizQuestionAsked(q, answers) || typeof answers[q.id] === "boolean");
}

/**
 * A training-centre table's status from the quiz and 2.1.14, or undefined
 * while the quiz question that decides it is unanswered.
 */
export function vtTableStatus(tableId: string, data: FormData): VtTableStatus | undefined {
  if (tableId === "VT4_6") {
    const types = data["VT2_18"];
    const hasFi = Array.isArray(types) && types.some((t) => typeof t === "string" && t.startsWith(FI_OPTION_PREFIX));
    return hasFi ? "REPORTED" : "NONE";
  }
  const q = QUESTION_BY_TABLE.get(tableId);
  if (!q) return "REPORTED";
  const answers = readVtQuiz(data);
  if (!answers) return undefined;
  if (q.parent && answers[q.parent] === false) return "NONE";
  const answer = answers[q.id];
  return answer === true ? "REPORTED" : answer === false ? "NONE" : undefined;
}

/** The quiz question that governs a table, if any. */
export function vtQuizQuestionForTable(tableId: string): VtQuizQuestion | undefined {
  return QUESTION_BY_TABLE.get(tableId);
}

function isEntered(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function isTrue(value: unknown): boolean {
  return value === true || value === "true" || value === "Oui/ Yes" || value === "1";
}

/**
 * Cells missing from a REPORTED training-centre table. Fixed-row tables need
 * every count (0 allowed). Row-by-row tables (specialties, staff list) need
 * at least one row, and every started row complete: a specialty row its name
 * and every count, "homologué" only when the curriculum exists; a staff row
 * its name, first name and sex. Computed totals are never required.
 * Returns the missing cell ids, or the table id when no row was started.
 */
export function missingVtTableCells(field: OnefopField, data: FormData): string[] {
  const vt = field.table?.vt;
  const matrix = field.table?.matrix;
  if (!vt || !matrix) return [];
  const progressive = vt.progressiveRows || vt.isRoster;
  const missing: string[] = [];
  let startedRows = 0;
  for (const rowIds of matrix) {
    const started = rowIds.some((id, c) => vt.cells[c]?.kind !== "computed" && isEntered(data[id]));
    if (progressive && !started) continue;
    startedRows++;
    rowIds.forEach((cellId, c) => {
      const cell = vt.cells[c];
      if (!cell || cell.kind === "computed") return;
      if (vt.isRoster && !["lastName", "firstName", "sex"].includes(cell.key)) return;
      if (cell.dependsOnKey) {
        const parentIndex = vt.cells.findIndex((p) => p.key === cell.dependsOnKey);
        if (parentIndex >= 0 && !isTrue(data[rowIds[parentIndex]])) return;
      }
      if (!isEntered(data[cellId])) missing.push(cellId);
    });
  }
  if (progressive && startedRows === 0) return [field.id];
  return missing;
}
