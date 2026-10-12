import assert from "node:assert/strict";
import { test } from "node:test";

import { nextCampaignDeadline } from "@/lib/portal-campaigns";
import type { OpenCampaign } from "@/lib/api-client";

function campaign(closesOn: string | null): OpenCampaign {
  return { collectionType: "DSMO", referenceYear: 2025, closesOn };
}

test("no campaigns, or none fetched yet, means no date to show", () => {
  assert.equal(nextCampaignDeadline(undefined), null);
  assert.equal(nextCampaignDeadline([]), null);
});

test("a single open campaign gives its closing date", () => {
  assert.equal(
    nextCampaignDeadline([campaign("2026-03-31T23:59:59.000Z")]),
    "2026-03-31T23:59:59.000Z",
  );
});

test("the earliest deadline wins, whatever order they arrive in", () => {
  const earliest = nextCampaignDeadline([
    campaign("2026-06-30T00:00:00.000Z"),
    campaign("2026-03-31T00:00:00.000Z"),
    campaign("2026-12-01T00:00:00.000Z"),
  ]);
  assert.equal(earliest, "2026-03-31T00:00:00.000Z");
});

test("open-ended collections carry no date and are skipped", () => {
  assert.equal(nextCampaignDeadline([campaign(null), campaign(null)]), null);
  assert.equal(
    nextCampaignDeadline([campaign(null), campaign("2026-03-31T00:00:00.000Z")]),
    "2026-03-31T00:00:00.000Z",
  );
});

test("instants are compared, not strings: a later date in an earlier offset still loses", () => {
  // 2026-03-31T01:00+02:00 is 2026-03-30T23:00Z — genuinely earlier than the
  // other, though it sorts after it as text.
  const earliest = nextCampaignDeadline([
    campaign("2026-03-31T00:00:00.000Z"),
    campaign("2026-03-31T01:00:00.000+02:00"),
  ]);
  assert.equal(earliest, "2026-03-31T01:00:00.000+02:00");
});

test("an unusable date is skipped rather than rendered as Invalid Date", () => {
  assert.equal(nextCampaignDeadline([campaign("not-a-date")]), null);
  assert.equal(
    nextCampaignDeadline([campaign("not-a-date"), campaign("2026-03-31T00:00:00.000Z")]),
    "2026-03-31T00:00:00.000Z",
  );
});
