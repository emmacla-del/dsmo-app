export interface BulkEligibilityRow {
  id: string;
  status: string | null;
  blockingCount: number;
  /** Who holds the file's review claim; a decision needs the reviewer's own. */
  assigneeId?: string | null;
  claimExpired?: boolean;
}

export interface BulkEligibilityResult<T extends BulkEligibilityRow> {
  selected: T[];
  eligible: T[];
  excluded: T[];
  endorsementEligible: T[];
  rejectionEligible: T[];
  correctionEligible: T[];
  canEndorse: boolean;
  canReject: boolean;
  canCorrect: boolean;
}

/** Preflight the selected rows for the bulk actions shown on submissions. */
export function assessBulkEligibility<T extends BulkEligibilityRow>(
  rows: readonly T[],
  selectedIds: ReadonlySet<string>,
  /** The reviewer. When given, a file they do not hold is not eligible for a decision. */
  userId?: string | null,
): BulkEligibilityResult<T> {
  const selected = rows.filter((row) => selectedIds.has(row.id));
  // The server refuses a decision on a file whose live claim is not the
  // reviewer's (EligibilityEngineService bulk preflight); counting it here
  // offered « Viser la sélection » on files that would all be refused.
  const held = (row: T) => userId === undefined || (Boolean(userId) && row.assigneeId === userId && !row.claimExpired);
  const endorsementEligible = selected.filter((row) => held(row) && row.status === "PENDING_REVIEW" && row.blockingCount === 0);
  const rejectionEligible = selected.filter((row) => held(row) && (row.status === "PENDING_REVIEW" || row.status === "CORRECTION_REQUESTED"));
  // A correction request asks for work the respondent has not been asked for
  // yet, so only a file still awaiting its first decision qualifies. A file
  // already in CORRECTION_REQUESTED is not asked twice.
  const correctionEligible = selected.filter((row) => held(row) && row.status === "PENDING_REVIEW");
  const eligible = selected.filter((row) => endorsementEligible.includes(row) || rejectionEligible.includes(row));
  const excluded = selected.filter((row) => !eligible.includes(row));
  return {
    selected,
    eligible,
    excluded,
    endorsementEligible,
    rejectionEligible,
    correctionEligible,
    canEndorse: eligible.length > 0 && endorsementEligible.length > 0,
    canReject: eligible.length > 0 && rejectionEligible.length > 0,
    canCorrect: correctionEligible.length > 0,
  };
}

export interface ClaimOutcome {
  claimed: number;
  failed: Array<{ id: string; message: string }>;
}

/**
 * Claims files one after the other and reports every outcome: a refused file
 * (claimed meanwhile by someone else, out of territory) does not stop the
 * others or hide how many succeeded.
 */
export async function claimFilesInTurn(ids: readonly string[], claim: (id: string) => Promise<unknown>): Promise<ClaimOutcome> {
  const outcome: ClaimOutcome = { claimed: 0, failed: [] };
  for (const id of ids) {
    try {
      await claim(id);
      outcome.claimed += 1;
    } catch (error) {
      outcome.failed.push({ id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return outcome;
}
