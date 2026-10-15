import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaEntity, schemaField } from "@/test/schema";
import type { FormData } from "./onefop-schema";
import {
  buildVtSections,
  buildVtTable,
  formatAnswer,
  localHalf,
  sentenceCaseTitle,
  type VtAnswerItem,
  type VtTableItem,
} from "./dossier-vt-answers";

const LABELS = { yes: "Yes", no: "No", row: (n: number) => `Row ${n}` };
const vt = schemaEntity("vocationalTraining");
const answer = (data: FormData, id: string, locale: "fr" | "en" = "en") =>
  buildVtSections(vt, data, locale, LABELS, true)
    .flatMap((s) => s.items)
    .find((i): i is VtAnswerItem => i.kind === "answer" && i.id === id);
const table = (data: FormData, id: string, canSee = true) =>
  buildVtTable(schemaField("vocationalTraining", id), data, "en", LABELS, canSee);

test("the nine VT sections, in schema order, in sentence case", () => {
  const sections = buildVtSections(vt, {}, "en", LABELS, true);
  assert.equal(sections.length, 9);
  assert.equal(sections[3].title, "Section 4. Details on trainees");
  assert.equal(sections[3].titleFr, "Section 4. Informations sur les apprenants");
  assert.match(sections[5].title, /MINEFOP/);
});

test("sentenceCaseTitle keeps acronyms and capitalises after the number", () => {
  assert.equal(sentenceCaseTitle("SECTION 9. DIFFICULTÉS ET PERSPECTIVES"), "Section 9. Difficultés et perspectives");
  assert.equal(sentenceCaseTitle("CENTRES DU MINEFOP"), "Centres du MINEFOP");
});

test("an option answer reads in the console language; a stored value off the list keeps its local half", () => {
  assert.deepEqual(answer({ VT2_1: "Oui/ Yes" }, "VT2_1")?.values, ["Yes"]);
  assert.deepEqual(answer({ VT2_1: "Oui/ Yes" }, "VT2_1", "fr")?.values, ["Oui"]);
  assert.equal(localHalf("Inconnu/ Unknown", "en"), "Unknown");
  assert.equal(localHalf("SAR/SM", "en"), "SAR/SM");
});

test("not answered is null, never No", () => {
  assert.equal(answer({}, "VT2_1")?.values, null);
  assert.equal(formatAnswer(schemaField("vocationalTraining", "VT2_1"), "", "en", LABELS), null);
  assert.equal(formatAnswer(schemaField("vocationalTraining", "VT2_1"), [], "en", LABELS), null);
});

test("a checkbox answer lists each selected option", () => {
  const field = schemaField("vocationalTraining", "VT2_2");
  const [first, second] = field.options!;
  const values = formatAnswer(field, [first.value, second.value], "en", LABELS);
  assert.deepEqual(values, [first.label!.en, second.label!.en]);
});

test("a question its gateway did not ask is left out", () => {
  assert.equal(answer({ VT7_1: "Non/ No" }, "VT7_6"), undefined);
  assert.ok(answer({ VT7_1: "Oui/ Yes" }, "VT7_6"));
});

test("sections 2-9 of a closed centre are waived; section 1 is not", () => {
  const sections = buildVtSections(vt, { VT1_12: "Fermée/ Closed" }, "en", LABELS, true);
  assert.equal(sections[0].waived, false);
  assert.ok(sections[0].items.length > 0);
  assert.ok(sections.slice(1).every((s) => s.waived && s.items.length === 0));
});

test("a fixed table shows every row, with stored totals and derived missing ones", () => {
  const t = table({ s4q1_licence_male: "3", s4q1_licence_female: "2", s4q1_cep_male: "4", s4q1_cep_total: "4" }, "VT4_1");
  assert.equal(t.rows.length, 11);
  assert.deepEqual(t.columns.map((c) => c.key), ["male", "female", "total"]);
  assert.ok(t.columns.every((c) => c.numeric));
  assert.ok(!t.columns.some((c) => /computed/i.test(c.label)));
  // Rows follow the schema's rowKeys: licence is the fourth, cep the tenth.
  assert.deepEqual(t.rows[3].cells, ["3", "2", "5"]);
  assert.deepEqual(t.rows[9].cells, ["4", "", "4"]);
  assert.deepEqual(t.rows[0].cells, ["", "", ""]);
  assert.equal(t.empty, false);
});

test("a grouped total sums its own group only (4.8 entrants)", () => {
  const t = table({ s4q8_primaire_entrant_male: "2", s4q8_primaire_entrant_female: "1", s4q8_primaire_sortant_male: "7" }, "VT4_8");
  const row = t.rows[1];
  const col = (key: string) => row.cells[t.columns.findIndex((c) => c.key === key)];
  assert.equal(col("entrant_total"), "3");
  assert.equal(col("sortant_total"), "7");
  assert.equal(col("abandon_total"), "");
});

test("a specialty table shows only the rows used, labelled by the specialty", () => {
  const t = table({ s4q3_row2_specialtyText: "Couture", s4q3_row2_fiMale: "1" }, "VT4_3");
  assert.equal(t.rows.length, 1);
  assert.equal(t.rows[0].label, "Couture");
  assert.ok(!t.columns.some((c) => c.key === "specialtyText"));
});

test("an untouched table is empty", () => {
  assert.equal(table({}, "VT5_3").empty, true);
});

test("8.8 names show for a central role and are withheld otherwise", () => {
  const data = { s8q8_row1_lastName: "Ngono", s8q8_row1_firstName: "Paul", s8q8_row1_sex: "1", s8q8_row1_isAdminPersonnel: "false" };
  const open: VtTableItem = table(data, "VT8_8", true);
  assert.equal(open.rows[0].label, "Ngono Paul");
  const col = (key: string) => open.rows[0].cells[open.columns.findIndex((c) => c.key === key)];
  assert.equal(col("sex"), "Man");
  assert.equal(col("isAdminPersonnel"), "No");
  const closed = table(data, "VT8_8", false);
  assert.equal(closed.restricted, true);
  assert.deepEqual(closed.rows, []);
});
