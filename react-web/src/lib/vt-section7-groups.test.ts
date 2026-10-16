import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaEntity } from "@/test/schema";
import type { FormData, OnefopField } from "@/lib/onefop-schema";
import { isFieldVisible } from "@/lib/onefop-schema";

// Defect 4 of the 2026-10-15 VT run: Section 7's first block was titled
// "VBG & Discipline" over the HIV and AIDS directives, and 7.2 (STIs, VT7_12)
// belonged to no block, so it showed untitled under that heading, whose
// "questions left" did not count it.

const s7 = schemaEntity("vocationalTraining").sections.find((s) => s.id === "section7_vocationalTraining")!;

/** Every question answered with its first option: every follow-up shows. */
function allAnswered(): FormData {
  const data: FormData = {};
  for (const f of s7.fields) {
    if (f.type === "radio") data[f.id] = f.options?.[0]?.value;
    else if (f.type === "checkbox") data[f.id] = [f.options?.[0]?.value];
    else data[f.id] = "x";
  }
  return data;
}

async function groupsFor(data: FormData, locale: "fr" | "en" = "fr") {
  const { vtWizardSectionGroups } = await import("@/components/onefop/VtWizardSectionScreen");
  return vtWizardSectionGroups(s7, data, locale);
}

test("Section 7 is two titled blocks: the HIV and AIDS rules, then STIs and education", async () => {
  const groups = await groupsFor(allAnswered());
  assert.deepEqual(
    groups.map((g) => g.title),
    ["Règlement intérieur et VIH/SIDA", "IST, éducation sexuelle et orientation"],
  );
  const codes = (i: number) => new Set(groups[i].fields.map((f: OnefopField) => f.paperCode));
  assert.ok([...codes(0)].every((c) => c?.startsWith("7.1")), "the first block is 7.1 to 7.1.3");
  assert.ok(!codes(1).has("7.1"), "the second block starts at 7.2");
  assert.ok(groups[1].fieldIds.includes("VT7_12"), "7.2 has a heading of its own block");
});

test("the English headings name the subjects", async () => {
  const { vtWizardTranslateGroupTitle } = await import("@/components/onefop/vt-wizard-section-utils");
  const titles = (await groupsFor(allAnswered())).map((g) => vtWizardTranslateGroupTitle(g.title, "en"));
  assert.deepEqual(titles, ["Internal rules on HIV and AIDS", "STIs, sex education and guidance"]);
  assert.ok(!titles.some((t) => /GBV|VBG/.test(t)));
});

test("each heading's 'questions left' counts every question shown under it, 7.2 included", async () => {
  const { vtWizardBlockSummary } = await import("@/components/onefop/vt-wizard-utils");
  const data = allAnswered();
  delete data.VT7_12;
  const groups = await groupsFor(data);
  const second = groups.find((g) => g.fieldIds.includes("VT7_12"))!;
  const summary = vtWizardBlockSummary(second.fields, second.title ?? "", data, new Set());
  assert.equal(summary.remaining, 1, "7.2 unanswered is the one question left");
  const first = vtWizardBlockSummary(groups[0].fields, groups[0].title ?? "", data, new Set());
  assert.equal(first.remaining, 0);
  // Every shown question is in a titled block: no untitled "Block 2".
  const shown = s7.fields.filter((f) => isFieldVisible(f, data)).length;
  assert.equal(groups.reduce((n, g) => n + g.fields.length, 0), shown);
  assert.ok(groups.every((g) => g.title));
});
