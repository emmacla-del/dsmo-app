import { test } from "node:test";
import assert from "node:assert/strict";
import { registrationDecisionModel } from "@/lib/registration-decision";

const base = { userId: "me", assigneeId: "me", dataBlocked: false, anyRejected: false, anyEmpty: false };

test("an officer decides only while holding the claim", () => {
  assert.equal(registrationDecisionModel(base).canDecide, true);
  assert.equal(registrationDecisionModel({ ...base, assigneeId: null }).canDecide, false, "free file: claim first");
  assert.equal(registrationDecisionModel({ ...base, assigneeId: "other" }).canDecide, false, "held by a colleague");
  assert.equal(registrationDecisionModel({ ...base, userId: null, assigneeId: null }).canDecide, false, "no signed-in officer");
});

test("complements become the main action when the file cannot be approved as it stands", () => {
  assert.equal(registrationDecisionModel(base).complementsFirst, false);
  assert.equal(registrationDecisionModel({ ...base, anyRejected: true }).complementsFirst, true);
  assert.equal(registrationDecisionModel({ ...base, anyEmpty: true }).complementsFirst, true);
  assert.equal(registrationDecisionModel({ ...base, dataBlocked: true }).complementsFirst, true);
});
