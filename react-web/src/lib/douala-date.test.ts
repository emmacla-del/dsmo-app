import { test } from "node:test";
import assert from "node:assert/strict";
import { doualaIsoDate, doualaYear, formatDoualaDate } from "./douala-date";
import { formatCampaignDate } from "./campaigns";
import { campaignPeriodFrom, periodPhrase } from "./campaign-period";

// The round of QUARTERLY_2026_T4_001 as stored: its bounds are midnight
// Douala, i.e. 23:00 UTC the day before.
const T4_2026 = { periodStart: "2026-09-30T23:00:00.000Z", periodEnd: "2026-12-30T23:00:00.000Z" };

test("a bound stored as midnight Douala reads as its Douala day", () => {
  assert.equal(doualaIsoDate("2026-09-30T23:00:00.000Z"), "2026-10-01");
  assert.equal(formatDoualaDate("2026-09-30T23:00:00.000Z"), "01/10/2026");
  assert.equal(formatCampaignDate("2026-09-30T23:00:00.000Z"), "01/10/2026");
});

test("a bound stored as midnight UTC keeps its day", () => {
  assert.equal(formatDoualaDate("2026-10-01T00:00:00.000Z"), "01/10/2026");
  assert.equal(formatDoualaDate("2026-12-31T00:00:00.000Z"), "31/12/2026");
});

test("an end-of-day closing stays on its day", () => {
  // 23:59:59 in Douala on 31 Dec is 22:59:59 UTC.
  assert.equal(formatCampaignDate("2026-12-31T22:59:59.000Z"), "31/12/2026");
  assert.equal(doualaYear("2026-12-31T22:59:59.000Z"), 2026);
  // Midnight Douala starting 1 Jan is 23:00 UTC on 31 Dec: already the new year.
  assert.equal(formatCampaignDate("2026-12-31T23:00:00.000Z"), "01/01/2027");
  assert.equal(doualaYear("2026-12-31T23:00:00.000Z"), 2027);
});

test("the viewer's own time zone does not move the day", () => {
  const saved = process.env.TZ;
  try {
    for (const tz of ["UTC", "America/New_York", "Asia/Tokyo", "Africa/Douala"]) {
      process.env.TZ = tz;
      assert.equal(formatCampaignDate("2026-09-30T23:00:00.000Z"), "01/10/2026", tz);
      assert.equal(formatCampaignDate("2026-10-01T00:00:00.000Z"), "01/10/2026", tz);
    }
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
});

test("missing or unreadable values are not given a date", () => {
  assert.equal(formatDoualaDate(null), null);
  assert.equal(formatDoualaDate(""), null);
  assert.equal(formatDoualaDate("garbage"), null);
  assert.equal(formatCampaignDate(null), "—");
  assert.equal(formatCampaignDate("garbage"), "garbage");
});

test("the wizard's period phrase prints the round's Douala dates", () => {
  assert.deepEqual(periodPhrase(campaignPeriodFrom(T4_2026)), {
    fr: "du 01/10/2026 au 31/12/2026",
    en: "from 01/10/2026 to 31/12/2026",
  });
});
