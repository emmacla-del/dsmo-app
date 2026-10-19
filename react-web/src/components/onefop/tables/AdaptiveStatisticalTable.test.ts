import { test } from "node:test";
import assert from "node:assert/strict";
import { tableHeadingText } from "./AdaptiveStatisticalTable";
import { getModernJobsTableDefinition } from "./definitions/modernJobsTableDefinitions";
import { schemaField } from "@/test/schema";
import type { FixedMatrixDefinition } from "./StatisticalTableDefinition";

// Until 2026-10-19 both heading sites rendered `caption || title`, so a table
// that carried a caption showed it INSTEAD of its own question. All five
// captions in modernJobsTableDefinitions.ts describe the column structure
// ("Répartition selon le statut d'emploi (Permanent, Temporaire) et le sexe")
// rather than the population counted, so project 4.5 asked the respondent to
// count people by CSP with the word "handicap" nowhere on screen — found by
// the E2E run of 2026-10-19 (docs/audit/e2e-2026-10-19-project-table-4.6.md,
// D3). The caption stays: it is the table's sr-only <caption>.

function definitionFor(entity: string, fieldId: string): FixedMatrixDefinition {
  const def = getModernJobsTableDefinition(schemaField(entity, fieldId));
  assert.ok(def, `no definition built for ${entity}/${fieldId}`);
  return def;
}

// One table per builder that defines a caption: interns, departures,
// diplomas, disability (enterprise and project), first-time entrants.
const CAPTIONED: [string, string][] = [
  ["enterprise", "S4Q01"],
  ["enterprise", "S3Q01"],
  ["enterprise", "S22Q03"],
  ["enterprise", "S22Q04"],
  ["projectProgram", "PP_S4Q05"],
  ["enterprise", "S23Q02"],
];

for (const [entity, fieldId] of CAPTIONED) {
  test(`${fieldId} heads with its own question, not with its caption`, () => {
    const definition = definitionFor(entity, fieldId);

    // Both present and different, or the assertions below prove nothing.
    assert.ok(definition.caption, `${fieldId} is expected to carry a caption`);
    assert.notEqual(definition.title.fr, definition.caption.fr, `${fieldId}: title === caption`);

    for (const locale of ["fr", "en"] as const) {
      assert.equal(
        tableHeadingText(definition, locale),
        definition.title[locale],
        `${fieldId} (${locale}): the heading must be the table's own question`,
      );
      assert.notEqual(
        tableHeadingText(definition, locale),
        definition.caption[locale],
        `${fieldId} (${locale}): the caption must not be the visible heading`,
      );
    }
  });
}

test("4.5 names the population it counts", () => {
  // The symptom D3 reported: nothing on screen said "handicap".
  const definition = definitionFor("projectProgram", "PP_S4Q05");
  assert.match(tableHeadingText(definition, "fr"), /handicap/i);
});

test("a table with no caption is unaffected", () => {
  const definition = definitionFor("projectProgram", "PP_S4Q01");
  assert.equal(definition.caption, undefined);
  assert.equal(tableHeadingText(definition, "fr"), definition.title.fr);
});
