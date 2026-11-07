import type { ResolveAnomalyPayload } from "./anomaly-registry";

/**
 * « Expliquée »: the reviewer has read a warning and judges the figures right.
 * A resolution type of its own (CLAUDE.md §21, 2026-11-01): FIELD_INSPECTION
 * means an on-site check by a sworn agent, which a desk reading is not.
 */
export const EXPLAINED_RESOLUTION = "REVIEWER_EXPLANATION" as const;

/** How many of these resolved warnings a reviewer explained; the system's re-check closes others. */
export function reviewerExplainedCount(items: readonly { resolutionType: string | null }[]): number {
  return items.filter((item) => item.resolutionType === EXPLAINED_RESOLUTION).length;
}

/** The server's bounds on a resolution note (ResolveAnomalyDto, review notes). */
export const EXPLAIN_NOTE_MIN = 10;
export const EXPLAIN_NOTE_MAX = 2000;

export function explainNoteValid(note: string): boolean {
  const length = note.trim().length;
  return length >= EXPLAIN_NOTE_MIN && length <= EXPLAIN_NOTE_MAX;
}

/** A refusal part-way through: `done` anomalies were closed before `reason`. */
export class ExplainFindingError extends Error {
  readonly done: number;
  readonly reason: unknown;
  constructor(done: number, reason: unknown) {
    super(reason instanceof Error ? reason.message : String(reason));
    this.done = done;
    this.reason = reason;
  }
}

/**
 * Closes, one after the other, every stored anomaly of one finding (a rule
 * fired for men, women and total is three rows). Each resolution consumes one
 * dossier revision on the server, so the n-th call expects `startRevision + n`;
 * any other write in between makes the server refuse with 409, and the error
 * says how many were already closed. Nothing is retried.
 */
export async function explainFindingAnomalies(
  anomalyIds: string[],
  startRevision: number,
  note: string,
  resolve: (id: string, payload: ResolveAnomalyPayload) => Promise<unknown>,
): Promise<number> {
  let done = 0;
  for (const id of anomalyIds) {
    try {
      await resolve(id, { resolutionType: EXPLAINED_RESOLUTION, resolutionNote: note.trim(), expectedRevision: startRevision + done });
    } catch (error) {
      throw new ExplainFindingError(done, error);
    }
    done += 1;
  }
  return done;
}

/**
 * The file's row id when the URL holds it. A URL can also hold the receipt
 * reference, which no row-id query accepts: that one waits for the file.
 */
export function fileRowIdFromUrl(urlId: string): string | undefined {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(urlId) ? urlId : undefined;
}
