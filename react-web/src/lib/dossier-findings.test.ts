import { test } from "node:test";
import assert from "node:assert/strict";
import { groupDossierFindings } from "./dossier-findings";

test("blocking findings come before warnings, each grouped by rule family in first-seen order", () => {
  const groups = groupDossierFindings(
    [
      { ruleCode: "VT_41_42", ruleFamily: "VT_COHERENCE" },
      { ruleCode: "S4_TOTAL", ruleFamily: "COHERENCE" },
      { ruleCode: "VT_45_46", ruleFamily: "VT_COHERENCE" },
    ],
    [{ ruleCode: "S22_SUBSET", ruleFamily: "COHERENCE" }],
  );
  assert.deepEqual(
    groups.map((group) => [group.severity, group.family, group.findings.map((finding) => finding.ruleCode)]),
    [
      ["blocking", "VT_COHERENCE", ["VT_41_42", "VT_45_46"]],
      ["blocking", "COHERENCE", ["S4_TOTAL"]],
      ["warning", "COHERENCE", ["S22_SUBSET"]],
    ],
  );
});

test("a finding with no family still shows, in a group of its own", () => {
  const groups = groupDossierFindings([], [{ ruleCode: "LEGACY" }, { ruleCode: "BLANK", ruleFamily: "  " }]);
  assert.deepEqual(groups, [{ severity: "warning", family: null, findings: [{ ruleCode: "LEGACY" }, { ruleCode: "BLANK", ruleFamily: "  " }] }]);
});

test("no findings, no groups", () => {
  assert.deepEqual(groupDossierFindings([], []), []);
});

test("one rule fired for men, women and total is one finding with three lines", async () => {
  const { mergeSameRule, findingSex } = await import("./dossier-findings");
  const merged = mergeSameRule([
    { ruleCode: "S22Q03_DIPLOMA_MISMATCH", description: "Répartition (S22Q03: 0, total) ne correspond pas (S22Q01+S22Q02: 5, total).", observedValue: 0, expectedValue: 5 },
    { ruleCode: "S22Q03_DIPLOMA_MISMATCH", description: "Répartition (S22Q03: 0, male) ne correspond pas (S22Q01+S22Q02: 4, male).", observedValue: 0, expectedValue: 4 },
    { ruleCode: "S22Q03_DIPLOMA_MISMATCH", description: "Répartition (S22Q03: 0, female) ne correspond pas (S22Q01+S22Q02: 1, female).", observedValue: 0, expectedValue: 1 },
    { ruleCode: "S22Q04_PERMANENT_EXCEEDS_TOTAL", description: "(S22Q04: 3, male) supérieurs (S22Q01: 2, male)", observedValue: 3, expectedValue: 2 },
  ]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0].rows.map((row) => [row.sex, row.expected]), [["male", 4], ["female", 1], ["total", 5]]);
  // Every stored row is kept, so « Expliquer » can close all three.
  assert.deepEqual(merged[0].anomalies.map((item) => item.expectedValue), [4, 1, 5]);
  assert.equal(findingSex("Nombre (4.1: 12, hommes) diffère"), "male");
  assert.equal(findingSex("no figures here"), null);
});
