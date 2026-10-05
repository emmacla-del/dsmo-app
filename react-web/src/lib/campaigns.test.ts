import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_PERIODICITIES,
  CAMPAIGN_PERIODICITY_LABELS,
  CAMPAIGN_PURPOSE_LABELS,
  buildCreateCampaignPayload,
  campaignPeriodicity,
  campaignPeriodicityLabel,
  type Campaign,
} from "./campaigns";

// These tests pin the `periodicity` / legacy `type` wire contract described in
// campaign.service.ts#toCampaignWire() on the backend. The two sides must stay
// symmetric: the backend dual-emits both keys on every response and accepts
// either on request; this client prefers `periodicity` on read and sends both
// on write. Deleting either half before the other ships breaks campaigns.

function campaign(partial: Partial<Campaign>): Campaign {
  return {
    id: "c1",
    code: "ONEFOP-2026-T4",
    name: "Recensement 2026-T4",
    status: "ACTIVE",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...partial,
  };
}

test("campaignPeriodicity prefers the renamed field", () => {
  assert.equal(
    campaignPeriodicity(campaign({ periodicity: "SEMESTER", type: "QUARTERLY" })),
    "SEMESTER",
  );
});

test("campaignPeriodicity falls back to the legacy `type` alias", () => {
  // A backend deploy that still predates the rename emits only `type`.
  assert.equal(campaignPeriodicity(campaign({ type: "ANNUAL" })), "ANNUAL");
});

test("campaignPeriodicity returns null rather than inventing a value", () => {
  assert.equal(campaignPeriodicity(campaign({ periodicity: null, type: null })), null);
  assert.equal(campaignPeriodicity(campaign({})), null);
});

test("campaignPeriodicity rejects a value outside the enum", () => {
  // `SPECIAL` was folded into QUARTERLY by the enum migration, so a row can no
  // longer hold it. If one somehow arrives, it is not silently relabelled.
  assert.equal(campaignPeriodicity(campaign({ type: "SPECIAL" })), null);
});

test("campaignPeriodicityLabel renders the French label, null when unset", () => {
  assert.equal(campaignPeriodicityLabel(campaign({ periodicity: "QUARTERLY" })), "Trimestrielle");
  assert.equal(campaignPeriodicityLabel(campaign({})), null);
});

test("every enum value has a label", () => {
  for (const value of CAMPAIGN_PERIODICITIES) {
    assert.equal(typeof CAMPAIGN_PERIODICITY_LABELS[value], "string");
  }
  assert.deepEqual(CAMPAIGN_PERIODICITIES, ["QUARTERLY", "SEMESTER", "ANNUAL"]);
  assert.deepEqual(Object.keys(CAMPAIGN_PURPOSE_LABELS), ["COLLECTION", "REGISTRATION"]);
});

test("the create payload sends both wire keys with the same value", () => {
  const payload = buildCreateCampaignPayload({
    collectionType: "ONEFOP",
    periodicity: "ANNUAL",
    startDate: "2026-10-01T00:00:00.000Z",
    deadline: "2026-12-31T00:00:00.000Z",
  });
  assert.equal(payload.periodicity, "ANNUAL");
  assert.equal(payload.type, "ANNUAL");
});

test("the create payload passes the rest of the body through untouched", () => {
  const payload = buildCreateCampaignPayload({
    collectionType: "DSMO",
    periodicity: "QUARTERLY",
    purpose: "REGISTRATION",
    startDate: "2026-10-01T00:00:00.000Z",
    deadline: "2026-12-31T00:00:00.000Z",
    referenceYear: 2026,
    referenceQuarter: 4,
    autoReminders: false,
  });
  assert.equal(payload.collectionType, "DSMO");
  assert.equal(payload.purpose, "REGISTRATION");
  assert.equal(payload.referenceYear, 2026);
  assert.equal(payload.referenceQuarter, 4);
  assert.equal(payload.autoReminders, false);
});
