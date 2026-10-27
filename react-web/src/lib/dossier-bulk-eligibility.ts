export interface BulkEligibilityRow {
  id: string;
  status: string | null;
  blockingCount: number;
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
): BulkEligibilityResult<T> {
  const selected = rows.filter((row) => selectedIds.has(row.id));
  const endorsementEligible = selected.filter((row) => row.status === "PENDING_REVIEW" && row.blockingCount === 0);
  const rejectionEligible = selected.filter((row) => row.status === "PENDING_REVIEW" || row.status === "CORRECTION_REQUESTED");
  // A correction request asks for work the respondent has not been asked for
  // yet, so only a file still awaiting its first decision qualifies. A file
  // already in CORRECTION_REQUESTED is not asked twice.
  const correctionEligible = selected.filter((row) => row.status === "PENDING_REVIEW");
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
