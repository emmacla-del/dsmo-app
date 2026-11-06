import { test } from "node:test";
import assert from "node:assert/strict";
import type { OnefopEntity, OnefopField } from "./onefop-schema";
import { dossierSectionState, sectionCountsAsRead } from "./dossier-sections";
import { loadOnefopSchema } from "@/test/schema";

const field = (id: string, extra: Partial<OnefopField> = {}): OnefopField => ({
  id, paperCode: null, path: null, type: "text", required: true, label: null, hint: null,
  instruction: null, options: null, visibility: null, table: null, ...extra,
});
const entity: OnefopEntity = {
  entityType: "enterprise",
  sectionCount: 2,
  fieldCount: 3,
  tableCount: 1,
  sections: [
    { id: "s2", order: 2, title: null, description: null, entityTypes: null, subsections: [], fields: [field("S2Q01"), field("S2Q02")] },
    { id: "s3", order: 3, title: null, description: null, entityTypes: null, subsections: [], fields: [field("S3_TABLE", { table: {} as never })] },
  ],
};

test("a section with a stored answer reads answered", () => {
  assert.equal(dossierSectionState(entity, "s2", { S2Q01: "Oui", S2Q02: "" }), "answered");
});

test("a section whose questions are all stored blank reads empty", () => {
  assert.equal(dossierSectionState(entity, "s2", { S2Q01: "", S2Q02: null }), "empty");
});

test("no state is guessed when the stored answers cannot establish one", () => {
  // A question never stored is not the same as a blank answer.
  assert.equal(dossierSectionState(entity, "s2", { S2Q01: "" }), null);
  // Tables are stored relationally, not in these answers.
  assert.equal(dossierSectionState(entity, "s3", { S3_TABLE: "x" }), null);
  assert.equal(dossierSectionState(entity, "missing", { S2Q01: "Oui" }), null);
  assert.equal(dossierSectionState(entity, "s2", null), null);
});

test("a question hidden by its gateway does not count", () => {
  const gated: OnefopEntity = {
    ...entity,
    sections: [{ ...entity.sections[0], fields: [
      field("S2Q01"),
      field("S2Q02", { visibility: { dependsOn: "S2Q01", dependsValues: ["Oui"] } as never }),
    ] }],
  };
  assert.equal(dossierSectionState(gated, "s2", { S2Q01: "Non" }), "answered");
});

test("a VT section a closed centre was not asked reads not applicable, never empty", () => {
  const vt = loadOnefopSchema().entities.vocationalTraining!;
  const [first, second] = vt.sections.filter((section) => section.order !== 0);
  const closed = { VT1_12: "Fermée/ Closed" };
  assert.equal(dossierSectionState(vt, second.id, closed), "notApplicable");
  assert.equal(dossierSectionState(vt, first.id, closed), "answered");
});

test("a folded section counts as read only once it is open", () => {
  const section = (tagName: string, open?: boolean) => ({ tagName, open }) as unknown as Element;
  assert.equal(sectionCountsAsRead(section("DETAILS", false)), false);
  assert.equal(sectionCountsAsRead(section("DETAILS", true)), true);
  assert.equal(sectionCountsAsRead(section("SECTION")), true);
});
