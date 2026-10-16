// Whether the respondent's declaration for the open period is already
// submitted, and so no longer theirs to change.
//
// "Live" is the server's own rule (QuestionnairesService.submit and
// OnefopService.saveDraft): awaiting review or endorsed. A declaration
// returned for correction, or rejected, is editable again from its draft.
// The server refuses a draft write on a live declaration; this only decides
// what the respondent is shown instead of the wizard.
import type { OnefopSubmission } from "./api-client";
import { referencePeriodKey } from "./onefop-period-label";

export const LIVE_SUBMISSION_STATUSES = ["PENDING_REVIEW", "APPROVED"] as const;

/** Two period codes name the same period ("QUARTERLY_2026_T4_001" and "2026-T4" do). */
function samePeriod(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const ka = referencePeriodKey(a);
  return ka !== null && ka === referencePeriodKey(b);
}

/** The period's submitted declaration, most recent first; null when there is none. */
export function liveSubmissionFor(
  submissions: readonly OnefopSubmission[] | null | undefined,
  periodCode: string | null | undefined,
): OnefopSubmission | null {
  if (!submissions || !periodCode) return null;
  return (
    submissions.find(
      (s) =>
        (LIVE_SUBMISSION_STATUSES as readonly string[]).includes(s.status) && samePeriod(s.quarterCode, periodCode),
    ) ?? null
  );
}
