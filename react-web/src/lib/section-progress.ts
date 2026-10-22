/** Shared status vocabulary and summary shape for entity-specific progress rules. */
export type SectionProgressStatus = "not-started" | "in-progress" | "complete" | "has-errors";

export interface SectionProgressSummary {
  status: SectionProgressStatus;
  questions: { answered: number; total: number };
  tables: { completed: number; total: number };
  issueCount: number;
}
