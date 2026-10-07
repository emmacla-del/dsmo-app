// src/auth/registration-overdue.ts
//
// When a company registration counts as "left waiting".
//
// A file is the reviewers' move while it is PENDING_APPROVAL. It has been
// waiting since it was registered or, if the company sent corrections after
// a complements request, since that last resubmission (audit action
// COMPANY_REGISTRATION_RESUBMITTED -- there is no column for it). Past
// REGISTRATION_OVERDUE_DAYS it is overdue: the territorial reviewers have not
// decided, and the national administration (which may decide any file) can
// see it and step in. COMPLEMENTS_REQUESTED files are the company's move and
// are never overdue.

export const REGISTRATION_OVERDUE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The instant before which a waiting file is overdue. */
export function overdueCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - REGISTRATION_OVERDUE_DAYS * DAY_MS);
}

/**
 * When the reviewers' wait on a file began, or null when it is not their move.
 * `lastResubmissionAt` is the resubmission still standing (newer than the
 * last complements request), as lastResubmissionByUser reports it.
 */
export function waitingSince(status: string, registeredAt: Date, lastResubmissionAt: Date | null): Date | null {
  if (status !== 'PENDING_APPROVAL') return null;
  return lastResubmissionAt && lastResubmissionAt > registeredAt ? lastResubmissionAt : registeredAt;
}

export function isOverdue(since: Date | null, now: Date = new Date()): boolean {
  return since !== null && since.getTime() < overdueCutoff(now).getTime();
}
