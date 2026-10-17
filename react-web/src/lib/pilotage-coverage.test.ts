// Pins what the pilotage dashboard's coverage section reads: which campaign,
// and at which territorial level the table is drawn.
//
// Pure logic, no DOM — run with `npm test`.

import assert from "node:assert/strict";
import test from "node:test";

import type { Campaign } from "./campaigns";
import { coverageRows, pickCoverageCampaign, ratioToPercent } from "./pilotage-coverage";
import type { CampaignReturnsResponse, ReturnMetrics } from "./pilotage-targets";

function campaign(over: Partial<Campaign>): Campaign {
  return { id: "c", name: "C", code: "C", status: "ACTIVE", collectionType: "ONEFOP", createdAt: "", ...over } as Campaign;
}

function metrics(over: Partial<ReturnMetrics> = {}): ReturnMetrics {
  return {
    quota: null, received: 0, approved: 0, onTime: 0, late: 0, gap: null,
    quotaRate: null, onTimeRate: null, registeredStock: 0, responseRate: null, ...over,
  };
}

function returns(over: Partial<CampaignReturnsResponse>): CampaignReturnsResponse {
  return {
    campaign: {
      id: "c", name: "C", code: "C", collectionType: "ONEFOP", status: "ACTIVE",
      startDate: null, endDate: null, referenceYear: 2026, referenceQuarter: 4,
    },
    central: null, unassigned: null, regions: [], totals: metrics(), ...over,
  };
}

test("the active ONEFOP collection campaign is picked, never a registration one", () => {
  const registration = campaign({ id: "reg", purpose: "REGISTRATION" });
  const dsmo = campaign({ id: "dsmo", collectionType: "DSMO" });
  const collection = campaign({ id: "col", purpose: "COLLECTION" });
  assert.equal(pickCoverageCampaign([registration, dsmo, collection])?.id, "col");
  assert.equal(pickCoverageCampaign([registration, dsmo]), undefined);
  assert.equal(pickCoverageCampaign(undefined), undefined);
});

test("a campaign with no purpose (pre-rename backend) counts as a collection", () => {
  assert.equal(pickCoverageCampaign([campaign({ id: "old" })])?.id, "old");
});

test("a non-active campaign is not picked", () => {
  assert.equal(pickCoverageCampaign([campaign({ status: "CLOSED" })]), undefined);
});

test("a national answer is drawn by region, with the central level last", () => {
  const rows = coverageRows(returns({
    regions: [
      { regionId: "r1", name: "Adamaoua", mode: "UNSET", departments: [], ...metrics({ received: 1, responseRate: 1 / 3 }) },
      { regionId: "r2", name: "Centre", mode: "UNSET", departments: [], ...metrics({ received: 2, late: 1, responseRate: 1 }) },
    ],
    central: metrics({ received: 0 }),
  }));
  assert.deepEqual(rows.map((r) => [r.kind, r.key, r.received, r.late]), [
    ["region", "r1", 1, 0],
    ["region", "r2", 2, 1],
    ["central", "central", 0, 0],
  ]);
});

test("a single-region answer is drawn by department", () => {
  const rows = coverageRows(returns({
    regions: [{
      regionId: "r1", name: "Littoral", mode: "UNSET", ...metrics({ received: 2 }),
      departments: [
        { departmentId: "d1", name: "Moungo", ...metrics() },
        { departmentId: "d2", name: "Wouri", ...metrics({ received: 2, responseRate: 1 }) },
      ],
    }],
  }));
  assert.deepEqual(rows.map((r) => [r.kind, r.name, r.received, r.responseRate]), [
    ["department", "Moungo", 0, null],
    ["department", "Wouri", 2, 1],
  ]);
});

test("a territory-less answer has no rows", () => {
  assert.deepEqual(coverageRows(returns({})), []);
});

test("a ratio converts to a percentage, and an absent ratio stays absent", () => {
  assert.equal(ratioToPercent(0.5), 50);
  assert.equal(ratioToPercent(null), null);
  assert.equal(ratioToPercent(undefined), null);
});
