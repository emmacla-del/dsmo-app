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
  canEndorse: boolean;
  canReject: boolean;
}

/** Preflight the selected rows for the bulk actions shown on submissions. */
export function assessBulkEligibility<T extends BulkEligibilityRow>(
  rows: readonly T[],
  selectedIds: ReadonlySet<string>,
): BulkEligibilityResult<T> {
  const selected = rows.filter((row) => selectedIds.has(row.id));
  const endorsementEligible = selected.filter((row) => row.status === "PENDING_REVIEW" && row.blockingCount === 0);
  const rejectionEligible = selected.filter((row) => row.status === "PENDING_REVIEW" || row.status === "CORRECTION_REQUESTED");
  const eligible = selected.filter((row) => endorsementEligible.includes(row) || rejectionEligible.includes(row));
  const excluded = selected.filter((row) => !eligible.includes(row));
  return {
    selected,
    eligible,
    excluded,
    endorsementEligible,
    rejectionEligible,
    canEndorse: eligible.length > 0 && endorsementEligible.length > 0,
    canReject: eligible.length > 0 && rejectionEligible.length > 0,
  };
}
