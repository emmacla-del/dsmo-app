import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FormData, OnefopField, OnefopSchema, OnefopSection } from "./onefop-schema";
import {
  COUNT_FIELD_IDS,
  isWholeCount,
  parseCountInput,
  validateSectionData,
  wholeNumberMessage,
} from "./onefop-validation";

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;

function schemaField(entity: string, id: string): OnefopField {
  const f = schema.entities[entity].sections.flatMap((s) => s.fields).find((x) => x.id === id);
  assert.ok(f, `${entity}.${id} exists in the schema`);
  return f;
}

/** Validates one schema field alone, with its visibility parent answered so it shows. */
function issuesFor(entity: string, id: string, value: unknown): string[] {
  const field = schemaField(entity, id);
  const data: FormData = { [id]: value };
  const vis = field.visibility;
  if (vis) {
    data[vis.dependsOn] = Array.isArray(vis.dependsValues) && vis.dependsValues.length > 0
      ? vis.dependsValues[0]
      : vis.dependsValue;
  }
  const section: OnefopSection = {
    id: "section1_test",
    order: 1,
    title: null,
    description: null,
    entityTypes: null,
    subsections: [],
    fields: [field],
  };
  return validateSectionData(section, data, "en").filter((i) => i.fieldId === id).map((i) => i.message);
}

// ── Count input helper (Guided entry) ──

test("parseCountInput refuses what is not a whole non-negative number", () => {
  assert.deepEqual(parseCountInput("2.5"), { kind: "invalid" });
  assert.deepEqual(parseCountInput("12abc"), { kind: "invalid" });
  assert.deepEqual(parseCountInput("-3"), { kind: "invalid" });
  assert.deepEqual(parseCountInput("1,5"), { kind: "invalid" });
  assert.deepEqual(parseCountInput("1e3"), { kind: "invalid" });
});

test("parseCountInput never turns refused text into another number", () => {
  for (const raw of ["2.5", "12abc", "-3"]) {
    const r = parseCountInput(raw);
    assert.notEqual(r.kind, "count", `${raw} must not be read as a count`);
  }
});

test("parseCountInput accepts whole numbers and empty", () => {
  assert.deepEqual(parseCountInput(""), { kind: "empty" });
  assert.deepEqual(parseCountInput("   "), { kind: "empty" });
  assert.deepEqual(parseCountInput("0"), { kind: "count", text: "0", value: 0 });
  assert.deepEqual(parseCountInput("25"), { kind: "count", text: "25", value: 25 });
  assert.deepEqual(parseCountInput(" 7 "), { kind: "count", text: "7", value: 7 });
});

test("wholeNumberMessage is bilingual by default and localised on request", () => {
  assert.equal(wholeNumberMessage(), "Saisissez un nombre entier (ex. 12)/ Enter a whole number (e.g. 12)");
  assert.equal(wholeNumberMessage("en"), "Enter a whole number (e.g. 12)");
  assert.equal(wholeNumberMessage("fr"), "Saisissez un nombre entier (ex. 12)");
});

test("fields, table cells and inputs share one whole-number wording", () => {
  assert.match(issuesFor("enterprise", "S1Q10", "2.5")[0], /: Enter a whole number$/);
  assert.ok(wholeNumberMessage("en").startsWith("Enter a whole number"));
});

test("isWholeCount", () => {
  assert.equal(isWholeCount("12"), true);
  assert.equal(isWholeCount(12), true);
  assert.equal(isWholeCount(0), true);
  assert.equal(isWholeCount("2.5"), false);
  assert.equal(isWholeCount(2.5), false);
  assert.equal(isWholeCount("-3"), false);
  assert.equal(isWholeCount(""), false);
  assert.equal(isWholeCount(null), false);
});

// ── Whole-number rule on count fields ──

test("every listed count field is a number field of the schema", () => {
  const numberIds = new Set(
    Object.values(schema.entities)
      .flatMap((e) => e.sections.flatMap((s) => s.fields))
      .filter((f) => f.type === "number" && !f.table)
      .map((f) => f.id),
  );
  for (const id of COUNT_FIELD_IDS) assert.ok(numberIds.has(id), `${id} is a scalar number field`);
});

test("a count field refuses a decimal value", () => {
  const issues = issuesFor("enterprise", "S1Q10", "2.5");
  assert.equal(issues.length, 1);
  assert.match(issues[0], /whole number/);
  assert.deepEqual(issuesFor("enterprise", "S1Q10", "25"), []);
  assert.deepEqual(issuesFor("vocationalTraining", "VT2_19", "0"), []);
  assert.equal(issuesFor("vocationalTraining", "VT2_19", "10.5").length, 1);
});

test("a count field still reports negative and non-numeric values", () => {
  assert.match(issuesFor("enterprise", "S1Q10", "-3")[0], /≥ 0/);
  assert.match(issuesFor("enterprise", "S1Q10", "abc")[0], /numeric value/);
});

test("a number field not known to be a count keeps accepting decimals (VT3_4, weeks)", () => {
  assert.deepEqual(issuesFor("vocationalTraining", "VT3_4", "2.5"), []);
});

// ── Year check on VT1_14 ──

test("VT1_14 (year of establishment) gets the year check", () => {
  assert.deepEqual(issuesFor("vocationalTraining", "VT1_14", "2010"), []);
  assert.match(issuesFor("vocationalTraining", "VT1_14", "1850")[0], /Year must be ≥ 1900/);
  assert.match(issuesFor("vocationalTraining", "VT1_14", String(new Date().getFullYear() + 1))[0], /Year must be ≤/);
  assert.match(issuesFor("vocationalTraining", "VT1_14", "20.5")[0], /valid year/);
});

test("VT2_15 (year of last authorization) gets the year check", () => {
  assert.deepEqual(issuesFor("vocationalTraining", "VT2_15", "2018"), []);
  assert.match(issuesFor("vocationalTraining", "VT2_15", "18")[0], /Year must be ≥ 1900/);
});

// ── Format checks on optional fields ──

test("optional phone numbers are checked when given", () => {
  assert.match(issuesFor("vocationalTraining", "VT1_15_TEL2", "12345")[0], /exactly 9 digits/);
  assert.match(issuesFor("vocationalTraining", "VT1_16_TEL2", "999")[0], /exactly 9 digits/);
  assert.match(issuesFor("vocationalTraining", "VT1_15_TEL2", "912345678")[0], /start with 2/);
  assert.deepEqual(issuesFor("vocationalTraining", "VT1_15_TEL2", "677000000"), []);
});

test("phones made optional by override (S1Q05_TEL2) are checked when given", () => {
  assert.match(issuesFor("enterprise", "S1Q05_TEL2", "12345")[0], /exactly 9 digits/);
  assert.deepEqual(issuesFor("enterprise", "S1Q05_TEL2", ""), []);
});

test("an optional e-mail is checked when given", () => {
  assert.match(issuesFor("vocationalTraining", "VT2_12", "not-an-email")[0], /valid email/);
  assert.deepEqual(issuesFor("vocationalTraining", "VT2_12", "centre@test.cm"), []);
});

test("optional fields left empty raise no issue", () => {
  assert.deepEqual(issuesFor("vocationalTraining", "VT1_15_TEL2", ""), []);
  assert.deepEqual(issuesFor("vocationalTraining", "VT1_16_TEL2", undefined), []);
  assert.deepEqual(issuesFor("vocationalTraining", "VT2_12", null), []);
});

test("required fields left empty are still reported", () => {
  assert.match(issuesFor("enterprise", "S1Q10", "")[0], /Required field/);
  assert.match(issuesFor("vocationalTraining", "VT1_14", undefined)[0], /Required field/);
});

// ── Training-centre table number cells are headcounts / counts ──

test("a training-centre table cell holding a decimal is reported, a whole number is not", async () => {
  const { validateEntityData } = await import("./onefop-validation");
  const { vtTableStatus } = await import("./vt-quiz");
  const vt = schema.entities.vocationalTraining;
  const data: FormData = {
    _scopeConfig: {
      vocationalTraining: {
        unemployedQualified: false, informalSector: false, vulnerable: false, scholarships: false,
        formerStudents: false, trainersWithDisability: false, completedAt: "2026-10-08",
      },
    },
  };
  // First table reported whatever the quiz says, and its first number cell.
  const table = vt.sections.flatMap((s) => s.fields).find(
    (f) => f.table?.vt && f.table.matrix && vtTableStatus(f.id, data) === "REPORTED"
      && f.table.vt.cells.some((c) => c.kind === "number"),
  );
  assert.ok(table, "a training-centre table applies with the quiz answered Non");
  const col = table.table!.vt!.cells.findIndex((c) => c.kind === "number");
  const cellId = table.table!.matrix![0][col];

  const wholeIssues = (value: string) =>
    validateEntityData(vt, { ...data, [cellId]: value }, "en")
      .filter((i) => i.fieldId === cellId && /: Enter a whole number$/.test(i.message));
  assert.equal(wholeIssues("2.5").length, 1);
  assert.equal(wholeIssues("3").length, 0);
});
