/**
 * Review delay, shared by the pilotage queue and the dossier list.
 *
 * A file awaiting a decision longer than the threshold is overdue. Both
 * screens must use the same measure: the dossier list's "overdue" filter
 * exists to open exactly the files the pilotage queue counts.
 */
export const REVIEW_DELAY_THRESHOLD_DAYS = 7;

/** The decision median covers the decisions of the last 90 days. */
export const REVIEW_DELAY_WINDOW_DAYS = 90;

/** Submission instant before which a still-pending file is overdue. */
export function reviewOverdueBefore(now: Date): Date {
  return new Date(now.getTime() - REVIEW_DELAY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
}
