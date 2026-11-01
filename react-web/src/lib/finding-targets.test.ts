import { test } from "node:test";
import assert from "node:assert/strict";
import { loadOnefopSchema } from "@/test/schema";
import { findingTargets } from "./finding-targets";

const schema = loadOnefopSchema();

test("an employer rule links to every table it compares", () => {
  assert.deepEqual(
    findingTargets("S22Q03_DIPLOMA_MISMATCH", schema.entities.enterprise, "fr").map((target) => target.anchor),
    ["dossier-field-S22Q03", "dossier-field-S22Q01", "dossier-field-S22Q02"],
  );
});

test("the vulnerable-people table is found under each form's own id", () => {
  assert.equal(findingTargets("S22Q05_PERMANENT_EXCEEDS_TOTAL", schema.entities.enterprise, "fr")[0].anchor, "dossier-field-S22Q05_ENTERPRISE");
  assert.match(findingTargets("S22Q05_PERMANENT_EXCEEDS_TOTAL", schema.entities.cooperative, "fr")[0].anchor, /^dossier-field-S22Q05/);
});

test("headline-count rules point to the identification block, VT rules to their section", () => {
  assert.deepEqual(findingTargets("PERMANENT_WORKERS_IMPLAUSIBLE", schema.entities.ctd, "fr").map((t) => t.anchor), ["dossier-structure"]);
  const vt = schema.entities.vocationalTraining;
  const section4 = vt.sections.find((s) => s.order === 4)!;
  assert.deepEqual(findingTargets("VT_TRAINEE_AGE_ENTRANT_MISMATCH", vt, "fr").map((t) => t.anchor), [`dossier-section-${section4.id}`]);
});

test("a rule with no known target gets no link rather than a wrong one", () => {
  assert.deepEqual(findingTargets("SOME_FUTURE_RULE", schema.entities.enterprise, "fr"), []);
  assert.deepEqual(findingTargets("S22Q03_DIPLOMA_MISMATCH", null, "fr"), []);
  // A rule about tables this form does not have links to nothing.
  assert.deepEqual(findingTargets("S22Q03_DIPLOMA_MISMATCH", schema.entities.administration, "fr"), []);
});
