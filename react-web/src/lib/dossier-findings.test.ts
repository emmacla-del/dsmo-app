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
