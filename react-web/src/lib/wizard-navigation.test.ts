// Pins the pure navigation helpers the ONEFOP wizards share: which field
// owns a validation issue (V6 "Corriger"), where the non-VT preliminary quiz
// sits (N4), the element lookup chain used to focus an issue (A2) and the
// live-region step text (A1).
//
// Pure logic, no DOM — run with `npm test`.

import assert from "node:assert/strict";
import test from "node:test";

import {
  fieldOwnsIssue,
  findIssueOwner,
  isTableField,
  issueFocusCandidates,
  locateIssue,
  preliminaryQuizSlot,
  resolveFirstCandidate,
  wizardStepAnnouncement,
  type IssueOwnerField,
} from "./wizard-navigation";

const plain: IssueOwnerField = { id: "S1Q02", paperCode: "1.2", type: "text", table: null };
const table: IssueOwnerField = {
  id: "S22Q05_ENTERPRISE",
  paperCode: "S22Q05",
  type: "table",
  table: { id: "s22q05_ent", matrix: [["s22q05_ent_r1_c1", "s22q05_ent_r1_c2"]] },
};
const vtTable: IssueOwnerField = {
  id: "VT4_1",
  paperCode: "4.1",
  type: "table",
  table: { id: "s4q1", matrix: [["s4q1_doctorat_male", "s4q1_doctorat_female"]] },
};

test("an issue on the field itself is owned by it (id or paper code, any case)", () => {
  assert.equal(fieldOwnsIssue(plain, "S1Q02"), true);
  assert.equal(fieldOwnsIssue(plain, "s1q02"), true);
  assert.equal(fieldOwnsIssue(plain, "1.2"), true);
  assert.equal(fieldOwnsIssue(plain, "S1Q03"), false);
});

test("a table cell issue is owned by its table (id, paper code, table id prefix or matrix)", () => {
  assert.equal(fieldOwnsIssue(table, "S22Q05_ENTERPRISE_R1"), true);
  assert.equal(fieldOwnsIssue(table, "S22Q05_PERM_MALE"), true);
  assert.equal(fieldOwnsIssue(table, "s22q05_ent_r1_c2"), true);
  // VT cell keys only share the table id, not the field id.
  assert.equal(fieldOwnsIssue(vtTable, "s4q1_doctorat_female"), true);
  assert.equal(fieldOwnsIssue(vtTable, "s4q10_row1_male"), false);
  // A prefix needs the "_" separator: S22Q050 is not a cell of S22Q05.
  assert.equal(fieldOwnsIssue(table, "S22Q050"), false);
});

test("locateIssue finds the section and the owning table of a cell issue", () => {
  const sections = [{ fields: [plain] }, { fields: [plain] }, { fields: [table] }, { fields: [vtTable] }];
  assert.deepEqual(locateIssue(sections, "s22q05_ent_r1_c1"), { sectionIndex: 2, field: table });
  assert.deepEqual(locateIssue(sections, "s4q1_doctorat_male"), { sectionIndex: 3, field: vtTable });
  assert.equal(locateIssue(sections, "UNKNOWN"), null);
  assert.equal(findIssueOwner([plain, table], "S1Q02"), plain);
  assert.equal(isTableField(table), true);
  assert.equal(isTableField(plain), false);
  assert.equal(isTableField(undefined), false);
});

test("the preliminary quiz sits right after the section1 section", () => {
  const ids = (...xs: string[]) => xs.map((id) => ({ id }));
  assert.deepEqual(
    preliminaryQuizSlot(ids("section0", "section1_entreprise", "section2", "section3", "section4")),
    { previousSectionIndex: 1, nextSectionIndex: 2 },
  );
  assert.deepEqual(
    preliminaryQuizSlot(ids("section0", "section1_projectProgram", "section2_projectProgram")),
    { previousSectionIndex: 1, nextSectionIndex: 2 },
  );
  assert.deepEqual(preliminaryQuizSlot(ids("section1", "section2")), { previousSectionIndex: 0, nextSectionIndex: 1 });
  // "section10" is not Section 1; no section1 or nothing after it: no slot.
  assert.equal(preliminaryQuizSlot(ids("section0", "section10")), null);
  assert.equal(preliminaryQuizSlot(ids("section0", "section1_x")), null);
  assert.equal(preliminaryQuizSlot([]), null);
});

test("the focus chain tries the issue's own element before its table", () => {
  assert.deepEqual(issueFocusCandidates("s4q1_doctorat_male", "VT4_1"), [
    { kind: "id", value: "s4q1_doctorat_male" },
    { kind: "id", value: "field-s4q1_doctorat_male" },
    { kind: "name", value: "s4q1_doctorat_male" },
    { kind: "id", value: "cell-input-s4q1_doctorat_male" },
    { kind: "id", value: "guided-table-s4q1_doctorat_male" },
    { kind: "id", value: "VT4_1" },
    { kind: "id", value: "guided-table-VT4_1" },
    { kind: "id", value: "field-VT4_1" },
  ]);
  // A table-level issue is its own owner: no duplicate lookups.
  const own = issueFocusCandidates("VT4_1", "VT4_1");
  assert.equal(own.filter((c) => c.kind === "id" && c.value === "VT4_1").length, 1);
  assert.equal(issueFocusCandidates("X", null).length, 5);
});

test("resolveFirstCandidate returns the first lookup that resolves", () => {
  const dom = new Map([["cell-input-a", "CELL"], ["T", "TABLE"]]);
  const lookup = (c: { kind: string; value: string }) => (c.kind === "id" ? dom.get(c.value) : undefined);
  assert.equal(resolveFirstCandidate(issueFocusCandidates("a", "T"), lookup), "CELL");
  assert.equal(resolveFirstCandidate(issueFocusCandidates("b", "T"), lookup), "TABLE");
  assert.equal(resolveFirstCandidate(issueFocusCandidates("b", "U"), lookup), null);
});

test("step announcements: section position and title, or the step label", () => {
  const fmt = ({ current, total, title }: { current: number; total: number; title: string }) =>
    `${title} (${current} of ${total})`;
  assert.equal(
    wizardStepAnnouncement({ kind: "section", index: 2, total: 5, title: "  SECTION 2.\n EMPLOI ET TRAVAIL " }, fmt),
    "SECTION 2. EMPLOI ET TRAVAIL (3 of 5)",
  );
  assert.equal(wizardStepAnnouncement({ kind: "label", label: " Preliminary declaration quiz " }, fmt), "Preliminary declaration quiz");
  assert.equal(wizardStepAnnouncement({ kind: "none" }, fmt), "");
});
