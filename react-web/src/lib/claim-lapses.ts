// GET /claims/lapses/me — the signed-in officer's own claims that lapsed
// before a decision (CLAUDE.md §21, 2026-11-09). Supervisors read the same
// counts per officer on the team page (actor-summary.ts, claimLapses).
import { apiFetch } from "./api-client";

export interface OwnClaimLapses {
  since: string;
  until: string;
  /** The window the counts cover, in days (30). */
  days: number;
  registrations: number;
  submissions: number;
}

export function getOwnClaimLapses() {
  return apiFetch<OwnClaimLapses>("/claims/lapses/me");
}

export type ClaimLapseKind = "registrations" | "submissions";

/** The count a page shows: the queue's own kind of file. */
export function ownLapseCount(lapses: OwnClaimLapses | undefined, kind: ClaimLapseKind): number {
  if (!lapses) return 0;
  const value = lapses[kind];
  return typeof value === "number" && value > 0 ? value : 0;
}
