import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { VtRosterGrid } from "./VtRosterGrid";
import { buildVt88TrainerRosterDefinition } from "./StatisticalTableDefinition";
import { schemaField } from "@/test/schema";

// 8.8's Tableau half. The paper (p.19) bands the two qualification columns
// under "Si formateur/ If teacher": the grid must keep that band, or a
// respondent cannot tell the two columns are a trainer's to fill.
const definition = buildVt88TrainerRosterDefinition(schemaField("vocationalTraining", "VT8_8"));

/** One grid at a time: the renders do not clean up after themselves. */
function withGrid(locale: "fr" | "en", check: () => void) {
  const { unmount } = renderWithProviders(
    <VtRosterGrid definition={definition} data={{}} onChange={() => {}} />,
    { locale },
  );
  try {
    check();
  } finally {
    unmount();
  }
}

test("the two qualification columns are headed, and spanned, by their band", () => {
  withGrid("fr", () => {
    const band = screen.getByText("Si formateur");
    assert.equal(band.tagName, "TH");
    assert.equal(band.getAttribute("colspan"), "2");
    assert.equal(band.getAttribute("scope"), "colgroup");
    // The band heads the diplomas, which keep their own headings below it.
    assert.equal(screen.getByText("Diplôme académique").closest("tr"), band.closest("tr")!.nextElementSibling);
  });
});

test("the band reads in English too, and every other column heads both rows", () => {
  withGrid("en", () => {
    assert.ok(screen.getByText("If teacher"));
    assert.equal(screen.queryByText("Si formateur"), null);
    for (const heading of ["Last name", "Sex", "Status", "Administrative staff"]) {
      assert.equal(screen.getByText(heading).closest("th")!.getAttribute("rowspan"), "2", heading);
    }
  });
});
