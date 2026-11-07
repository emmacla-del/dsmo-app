import { test } from "node:test";
import assert from "node:assert/strict";
import { ExplainFindingError, explainFindingAnomalies, explainNoteValid, fileRowIdFromUrl, reviewerExplainedCount } from "./dossier-explain";

test("only a reviewer's explanation counts as handled by a person", () => {
  assert.equal(reviewerExplainedCount([
    { resolutionType: "REVIEWER_EXPLANATION" },
    { resolutionType: "RULE_RECHECK" },
    { resolutionType: "DECLARANT_CORRECTION" },
    { resolutionType: null },
  ]), 1);
});

test("each anomaly of a finding is closed with the next dossier revision", async () => {
  const calls: Array<[string, number, string, string]> = [];
  const done = await explainFindingAnomalies(["m", "f", "t"], 7, "  Chiffres vérifiés  ", async (id, payload) => {
    calls.push([id, payload.expectedRevision, payload.resolutionType, payload.resolutionNote]);
  });
  assert.equal(done, 3);
  assert.deepEqual(calls, [
    ["m", 7, "REVIEWER_EXPLANATION", "Chiffres vérifiés"],
    ["f", 8, "REVIEWER_EXPLANATION", "Chiffres vérifiés"],
    ["t", 9, "REVIEWER_EXPLANATION", "Chiffres vérifiés"],
  ]);
});

test("a refusal stops at once and says how many were already closed", async () => {
  let calls = 0;
  await assert.rejects(
    explainFindingAnomalies(["m", "f", "t"], 0, "Chiffres vérifiés", async () => {
      calls += 1;
      if (calls === 2) throw new Error("409");
    }),
    (error: unknown) => error instanceof ExplainFindingError && error.done === 1,
  );
  assert.equal(calls, 2, "nothing after the refusal, nothing retried");
});

test("the note follows the server's bounds", () => {
  assert.equal(explainNoteValid("trop court"), true);
  assert.equal(explainNoteValid("   court  "), false);
  assert.equal(explainNoteValid("x".repeat(2001)), false);
});

test("only a row id in the URL starts the explained findings early", () => {
  assert.equal(fileRowIdFromUrl("41d6ef04-80fb-4f9b-a4ea-6a133f529a7d"), "41d6ef04-80fb-4f9b-a4ea-6a133f529a7d");
  assert.equal(fileRowIdFromUrl("VT26001002"), undefined);
  assert.equal(fileRowIdFromUrl(""), undefined);
});
