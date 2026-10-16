import { test } from "node:test";
import assert from "node:assert/strict";
import type { OnefopSubmission } from "./api-client";
import { liveSubmissionFor } from "./onefop-submitted-lock";

const sub = (status: string, quarterCode: string, id = status): OnefopSubmission => ({ id, status, quarterCode });

test("a declaration awaiting review or endorsed locks its period", () => {
  for (const status of ["PENDING_REVIEW", "APPROVED"]) {
    assert.equal(liveSubmissionFor([sub(status, "QUARTERLY_2026_T4_001")], "QUARTERLY_2026_T4_001")?.status, status);
  }
});

test("correction requested, rejected and draft do not lock: the respondent edits again", () => {
  for (const status of ["CORRECTION_REQUESTED", "REJECTED", "DRAFT"]) {
    assert.equal(liveSubmissionFor([sub(status, "QUARTERLY_2026_T4_001")], "QUARTERLY_2026_T4_001"), null);
  }
});

test("a campaign code and its fallback code are the same period; another period is not", () => {
  assert.ok(liveSubmissionFor([sub("PENDING_REVIEW", "2026-T4")], "QUARTERLY_2026_T4_001"));
  assert.equal(liveSubmissionFor([sub("PENDING_REVIEW", "QUARTERLY_2026_T3_001")], "QUARTERLY_2026_T4_001"), null);
});

test("nothing to match: no list, or no period yet", () => {
  assert.equal(liveSubmissionFor(undefined, "QUARTERLY_2026_T4_001"), null);
  assert.equal(liveSubmissionFor([sub("APPROVED", "QUARTERLY_2026_T4_001")], undefined), null);
});
