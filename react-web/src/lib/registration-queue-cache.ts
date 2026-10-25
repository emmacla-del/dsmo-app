// The registration queue as the reviewer's decision leaves it, written into
// the query cache the moment the server confirms the decision (defect 20 of
// the 2026-10-16 VT run: after "Registration approved and account activated."
// the row stayed "Pending" and the counters stayed 4 / 5 for 5–10 s, until the
// refetch answered). The refetch still follows and has the last word; this
// only keeps the page from contradicting the notice in the meantime, as the
// file page does since defect 9.
import type { CompanyRegistrationsResult } from "./user-directory";

export type RegistrationDecisionStatus = "ACTIVE" | "REJECTED" | "COMPLEMENTS_REQUESTED";

type Counts = CompanyRegistrationsResult["counts"];

/** The counter a stored status is counted in, if any. */
function bucket(status: string): keyof Omit<Counts, "overdue"> | null {
  switch (status) {
    case "PENDING_APPROVAL":
      return "pending";
    case "COMPLEMENTS_REQUESTED":
      return "complements";
    case "ACTIVE":
      return "approved";
    case "REJECTED":
      return "rejected";
    default:
      return null;
  }
}

/**
 * The statuses an unfiltered list holds. No status filter does NOT mean "every
 * file": the server reads it as the review queue, `status IN (PENDING_APPROVAL,
 * COMPLEMENTS_REQUESTED)` (AuthService.listCompanyRegistrations). "ALL" is what
 * lifts the filter.
 */
const QUEUE_STATUSES: readonly string[] = ["PENDING_APPROVAL", "COMPLEMENTS_REQUESTED"];

/**
 * Whether a file in `status` still belongs in a list filtered by `view`.
 *
 * The three non-status views are the server's own, and they are not
 * interchangeable:
 *  - "" (or absent) is the review queue, so an approved or rejected file
 *    leaves it and only COMPLEMENTS_REQUESTED stays;
 *  - "ALL" is the unfiltered list (?createdBy= and the coverage links), which
 *    holds every status, so no decision ever takes a row out of it;
 *  - "OVERDUE" is a view of the queue rather than a stored status, and a
 *    decided file is never overdue.
 * Anything else is an exact status.
 *
 * Reading "" as unfiltered and "ALL" as a status to match — the two exactly
 * the wrong way round — left an approved row sitting in the default queue
 * under its new badge until the refetch answered (defect 20 / B11, the very
 * thing this module exists to prevent), and dropped a decided row out of
 * ?createdBy= with the total, before both came back.
 */
function stillInView(view: string | undefined, status: RegistrationDecisionStatus): boolean {
  if (!view) return QUEUE_STATUSES.includes(status);
  if (view === "ALL") return true;
  if (view === "OVERDUE") return false;
  return view === status;
}

/**
 * One page of the queue with the decided file in its new status and the
 * counters moved accordingly. A page that does not hold the file is
 * returned unchanged: its counters cannot be adjusted without knowing the
 * file's previous status, and the refetch corrects them.
 *
 * `view` is the status the list was filtered by, from that page's own query
 * key. A file the decision moves out of the view is taken off the page
 * rather than left sitting in it under its new status, which is what the
 * reviewer saw until the refetch answered (B11 of the 2026-10-17 run).
 */
export function applyRegistrationDecision(
  page: CompanyRegistrationsResult | undefined,
  id: string,
  status: RegistrationDecisionStatus,
  view?: string,
): CompanyRegistrationsResult | undefined {
  if (!page) return page;
  const item = page.items.find((i) => i.id === id);
  if (!item || item.status === status) return page;
  const counts = { ...page.counts };
  const from = bucket(item.status);
  const to = bucket(status);
  if (from) counts[from] = Math.max(0, counts[from] - 1);
  if (to) counts[to] += 1;
  // A decided file is no longer the reviewers' move (complements requested:
  // it is the company's), so it is not overdue (src/auth/registration-overdue.ts).
  if (item.overdue) counts.overdue = Math.max(0, counts.overdue - 1);
  if (!stillInView(view, status)) {
    return {
      ...page,
      counts,
      total: Math.max(0, page.total - 1),
      items: page.items.filter((i) => i.id !== id),
    };
  }
  return {
    ...page,
    counts,
    items: page.items.map((i) =>
      i.id === id
        ? { ...i, status, overdue: false, waitingSince: null }
        : i,
    ),
  };
}
