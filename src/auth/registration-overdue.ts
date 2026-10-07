// src/auth/registration-overdue.ts
//
// When a company registration counts as "left waiting".
//
// A file is the reviewers' move while it is PENDING_APPROVAL. It has been
// waiting since it was registered or, if the company sent corrections after
// a complements request, since that last resubmission (audit action
// COMPANY_REGISTRATION_RESUBMITTED -- there is no column for it). Past the
// threshold it is overdue: the territorial reviewers have not decided, and
// the national administration (which may decide any file) can see it and
// step in. COMPLEMENTS_REQUESTED files are the company's move and are never
// overdue.
//
// The threshold is a platform setting, SystemSettings.registrationOverdueDays
// (/admin/parametres); these helpers take it as an argument.

export const REGISTRATION_OVERDUE_DEFAULT_DAYS = 7;
export const REGISTRATION_OVERDUE_MIN_DAYS = 1;
export const REGISTRATION_OVERDUE_MAX_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The stored setting, or the default when it is missing or out of range. */
export function overdueDaysFrom(setting: unknown): number {
  return typeof setting === 'number' &&
    Number.isInteger(setting) &&
    setting >= REGISTRATION_OVERDUE_MIN_DAYS &&
    setting <= REGISTRATION_OVERDUE_MAX_DAYS
    ? setting
    : REGISTRATION_OVERDUE_DEFAULT_DAYS;
}

/** The instant before which a waiting file is overdue. */
export function overdueCutoff(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * DAY_MS);
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

export function isOverdue(since: Date | null, days: number, now: Date = new Date()): boolean {
  return since !== null && since.getTime() < overdueCutoff(days, now).getTime();
}
