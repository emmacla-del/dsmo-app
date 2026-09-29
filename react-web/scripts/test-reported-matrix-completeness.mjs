import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
register("./ts-resolver.mjs", import.meta.url);

import {
  isEnteredValue,
  quizGovernsEntry,
  missingQuizFieldKeys,
  applyQuizRequired,
} from "../src/components/onefop/tables/quizRequired.ts";

test("isEnteredValue correctly treats 0 and '0' as valid entered values, and blank/null/undefined as missing", () => {
  // Explicit zeros
  assert.equal(isEnteredValue(0), true, "numeric 0 must be recognized as entered");
  assert.equal(isEnteredValue("0"), true, "string '0' must be recognized as entered");

  // Positive numbers
  assert.equal(isEnteredValue(1), true);
  assert.equal(isEnteredValue(42), true);
  assert.equal(isEnteredValue("15"), true);

  // Missing / blank values
  assert.equal(isEnteredValue(undefined), false, "undefined is missing");
  assert.equal(isEnteredValue(null), false, "null is missing");
  assert.equal(isEnteredValue(""), false, "empty string is missing");
});

test("quizGovernsEntry detects presence of _scopeConfig", () => {
  assert.equal(quizGovernsEntry(undefined), false);
  assert.equal(quizGovernsEntry({}), false);
  assert.equal(quizGovernsEntry({ _scopeConfig: null }), false);
  assert.equal(quizGovernsEntry({ _scopeConfig: {} }), true);
  assert.equal(quizGovernsEntry({ _scopeConfig: { recruit: true } }), true);
});

// Mock matrix table definition resembling S21Q01
const mockTableDefinition = {
  id: "S21Q01",
  kind: "fixed-matrix",
  title: { fr: "Demandes d'emploi", en: "Job applications" },
  columns: [
    { key: "male", header: { fr: "Hommes", en: "Men" }, kind: "number" },
    { key: "female", header: { fr: "Femmes", en: "Women" }, kind: "number" },
  ],
  rows: [
    {
      id: "row_cadres",
      label: { fr: "Cadres", en: "Managers" },
      cells: {
        male: { key: "c1_m", fieldKey: "s21q01_cadres_male", kind: "number" },
        female: { key: "c1_f", fieldKey: "s21q01_cadres_female", kind: "number" },
      },
    },
    {
      id: "row_workers",
      label: { fr: "Ouvriers", en: "Workers" },
      cells: {
        male: { key: "c2_m", fieldKey: "s21q01_workers_male", kind: "number" },
        female: { key: "c2_f", fieldKey: "s21q01_workers_female", kind: "number" },
      },
    },
    {
      id: "row_total",
      label: { fr: "Total", en: "Total" },
      isTotal: true,
      cells: {
        male: { key: "tot_m", fieldKey: "s21q01_total_male", kind: "computed" },
        female: { key: "tot_f", fieldKey: "s21q01_total_female", kind: "computed" },
      },
    },
  ],
};

test("Test 1: status = REPORTED with all matrix cells explicitly 0 passes missingQuizFieldKeys (empty missing list)", () => {
  const data = {
    s21q01_cadres_male: 0,
    s21q01_cadres_female: 0,
    s21q01_workers_male: 0,
    s21q01_workers_female: 0,
  };
  const missing = missingQuizFieldKeys(mockTableDefinition, data);
  assert.deepEqual(missing, [], "All cells populated with 0 must have no missing keys");
});

test("Test 2: status = REPORTED with positive values passes missingQuizFieldKeys", () => {
  const data = {
    s21q01_cadres_male: 10,
    s21q01_cadres_female: 5,
    s21q01_workers_male: 25,
    s21q01_workers_female: 12,
  };
  const missing = missingQuizFieldKeys(mockTableDefinition, data);
  assert.deepEqual(missing, []);
});

test("Test 3: status = REPORTED with even one blank cell returns that cell in missingQuizFieldKeys", () => {
  const data = {
    s21q01_cadres_male: 10,
    s21q01_cadres_female: 5,
    s21q01_workers_male: 25,
    // s21q01_workers_female is missing!
  };
  const missing = missingQuizFieldKeys(mockTableDefinition, data);
  assert.equal(missing.length, 1);
  assert.equal(missing[0], "s21q01_workers_female");

  // Empty string also flagged as missing
  const dataWithEmptyStr = {
    ...data,
    s21q01_workers_female: "",
  };
  assert.deepEqual(missingQuizFieldKeys(mockTableDefinition, dataWithEmptyStr), ["s21q01_workers_female"]);
});

test("Test 4: status = REPORTED with only one cell populated returns all remaining cells as missing", () => {
  const data = {
    s21q01_cadres_male: 7,
  };
  const missing = missingQuizFieldKeys(mockTableDefinition, data);
  assert.equal(missing.length, 3);
  assert.ok(missing.includes("s21q01_cadres_female"));
  assert.ok(missing.includes("s21q01_workers_male"));
  assert.ok(missing.includes("s21q01_workers_female"));
});

test("Test 5: status = REPORTED with all cells blank returns all enterable cells as missing", () => {
  const data = {};
  const missing = missingQuizFieldKeys(mockTableDefinition, data);
  assert.equal(missing.length, 4);
  assert.ok(missing.includes("s21q01_cadres_male"));
  assert.ok(missing.includes("s21q01_cadres_female"));
  assert.ok(missing.includes("s21q01_workers_male"));
  assert.ok(missing.includes("s21q01_workers_female"));
});

test("Test 6 & 7: absence of _scopeConfig enforces full standard capacity (does NOT bypass completeness)", () => {
  // Absence of _scopeConfig: data has no _scopeConfig property
  const data = {
    s21q01_cadres_male: 3,
    // missing other 3 cells
  };
  const missing = missingQuizFieldKeys(mockTableDefinition, data);
  // Must NOT return empty array []! Default capacity must be validated
  assert.equal(missing.length, 3);

  // When all 4 cells are filled (e.g. with 0) without _scopeConfig, it passes
  const completeData = {
    s21q01_cadres_male: 0,
    s21q01_cadres_female: 0,
    s21q01_workers_male: 0,
    s21q01_workers_female: 0,
  };
  assert.deepEqual(missingQuizFieldKeys(mockTableDefinition, completeData), []);
});

test("Test 8: applyQuizRequired marks all enterable non-total cells as required even without _scopeConfig", () => {
  const transformed = applyQuizRequired(mockTableDefinition, {});
  const enterableCells = transformed.rows
    .filter((r) => !r.isTotal && !r.isSubtotal)
    .flatMap((r) => Object.values(r.cells));

  assert.equal(enterableCells.length, 4);
  for (const c of enterableCells) {
    assert.equal(c.required, true, `Cell ${c.fieldKey} should be required: true`);
  }

  // Computed total cells must NOT be required
  const totalRow = transformed.rows.find((r) => r.isTotal);
  for (const c of Object.values(totalRow.cells)) {
    assert.notEqual(c.required, true);
  }
});

test("Test 9: text companion rows (S3Q02 / S4Q02 / S4Q03) require description for active rows", () => {
  const textTableDef = {
    id: "S3Q02",
    kind: "fixed-matrix",
    title: { fr: "Motifs de licenciement", en: "Dismissal reasons" },
    columns: [{ key: "total", header: { fr: "Total", en: "Total" }, kind: "number" }],
    rows: [
      {
        id: "reason_1",
        label: { fr: "Motif 1", en: "Reason 1" },
        labelText: {
          fieldKey: "s3q02_reason_1_text",
          label: { fr: "Intitulé", en: "Title" },
          placeholder: { fr: "Texte", en: "Text" },
        },
        cells: {
          total: { key: "c1", fieldKey: "s3q02_reason_1_total", kind: "number" },
        },
      },
      {
        id: "reason_2",
        label: { fr: "Motif 2", en: "Reason 2" },
        labelText: {
          fieldKey: "s3q02_reason_2_text",
          label: { fr: "Intitulé", en: "Title" },
          placeholder: { fr: "Texte", en: "Text" },
        },
        cells: {
          total: { key: "c2", fieldKey: "s3q02_reason_2_total", kind: "number" },
        },
      },
    ],
  };

  // Case A: Row 1 is mandatory for a reported table. Missing text on row 1 is flagged.
  const missingTextRow1 = {
    s3q02_reason_1_total: 5,
    s3q02_reason_1_text: "",
  };
  assert.deepEqual(missingQuizFieldKeys(textTableDef, missingTextRow1), ["s3q02_reason_1_text"]);

  // Case B: Row 1 completely filled, Row 2 untouched (inactive) -> passes!
  const completeRow1 = {
    s3q02_reason_1_total: 5,
    s3q02_reason_1_text: "Restructuration économique",
  };
  assert.deepEqual(missingQuizFieldKeys(textTableDef, completeRow1), []);

  // Case C: Row 2 activated by count > 0 but missing text -> Row 2 text is flagged!
  const row2MissingText = {
    s3q02_reason_1_total: 5,
    s3q02_reason_1_text: "Restructuration économique",
    s3q02_reason_2_total: 2,
    s3q02_reason_2_text: "",
  };
  assert.deepEqual(missingQuizFieldKeys(textTableDef, row2MissingText), ["s3q02_reason_2_text"]);

  // Case D: Both Row 1 and Row 2 completely filled -> passes!
  const bothRowsFilled = {
    s3q02_reason_1_total: 5,
    s3q02_reason_1_text: "Restructuration économique",
    s3q02_reason_2_total: 2,
    s3q02_reason_2_text: "Faute lourde",
  };
  assert.deepEqual(missingQuizFieldKeys(textTableDef, bothRowsFilled), []);
});

// ── Phase 4.4 UX Enforcement Tests ──────────────────────────────────────────

test("Phase 4.4 UX 1: 0 and '0' are NOT classified as missing cells", () => {
  const data = {
    s21q01_cadres_male: 0,
    s21q01_cadres_female: "0",
    s21q01_workers_male: 10,
    s21q01_workers_female: 0,
  };
  const missing = missingQuizFieldKeys(mockTableDefinition, data);
  assert.equal(missing.length, 0, "No cells should be flagged as missing when all contain explicit values including 0");
  assert.equal(missing.includes("s21q01_cadres_male"), false);
  assert.equal(missing.includes("s21q01_cadres_female"), false);
});

test("Phase 4.4 UX 2: Blank cells are correctly classified as missing and supply exact count", () => {
  const data = {
    s21q01_cadres_male: 5,
    s21q01_cadres_female: "",        // blank string
    s21q01_workers_male: undefined, // undefined
    s21q01_workers_female: null,    // null
  };
  const missing = missingQuizFieldKeys(mockTableDefinition, data);
  assert.equal(missing.length, 3, "Exactly 3 cells must be reported as missing");
  assert.ok(missing.includes("s21q01_cadres_female"));
  assert.ok(missing.includes("s21q01_workers_male"));
  assert.ok(missing.includes("s21q01_workers_female"));
  assert.ok(!missing.includes("s21q01_cadres_male"));
});

test("Phase 4.4 UX 3: Complete REPORTED table produces 0 missing cells (no indicator shown)", () => {
  const data = {
    s21q01_cadres_male: 0,
    s21q01_cadres_female: 0,
    s21q01_workers_male: 0,
    s21q01_workers_female: 0,
  };
  const missing = missingQuizFieldKeys(mockTableDefinition, data);
  assert.equal(missing.length, 0);
});

test("Phase 4.4 UX 4: Incomplete REPORTED table missing count matches missing list length", () => {
  const data = {
    s21q01_cadres_male: 3,
    // 3 cells blank
  };
  const missing = missingQuizFieldKeys(mockTableDefinition, data);
  assert.equal(missing.length, 3);
  // Source of truth: the first incomplete cell is readily identifiable for one-click navigation
  assert.equal(missing[0], "s21q01_cadres_female");
});

test("Phase 4.4 UX 5: Scoped definition only flags kept cells as missing", () => {
  // Definition scoped to only 'cadres' row
  const scopedDef = {
    ...mockTableDefinition,
    rows: [
      mockTableDefinition.rows[0], // row_cadres
      mockTableDefinition.rows[2], // row_total
    ],
  };
  const data = {
    s21q01_cadres_male: 5,
    // cadres_female is missing, workers cells are excluded from definition
  };
  const missing = missingQuizFieldKeys(scopedDef, data);
  assert.equal(missing.length, 1);
  assert.equal(missing[0], "s21q01_cadres_female");
});

const { autoFillMissingResponseStatuses } = await import("../src/lib/onefop-submission.ts");
import fs from "node:fs";

test("autoFillMissingResponseStatuses: recognizes 0 and '0' as entered cell data and marks REPORTED", () => {
  const data = {
    s21q01_cadres_male_15_24: 0,
  };
  const filled = autoFillMissingResponseStatuses(data, "enterprise");
  assert.equal(filled["S21Q01_RESPONSE_STATUS"], "REPORTED", "numeric 0 must be recognized as cell data, resulting in REPORTED");

  const dataStrZero = {
    s21q01_cadres_male_15_24: "0",
  };
  const filledStrZero = autoFillMissingResponseStatuses(dataStrZero, "enterprise");
  assert.equal(filledStrZero["S21Q01_RESPONSE_STATUS"], "REPORTED", "string '0' must be recognized as cell data, resulting in REPORTED");

  const emptyData = {};
  const filledEmpty = autoFillMissingResponseStatuses(emptyData, "enterprise");
  assert.equal(filledEmpty["S21Q01_RESPONSE_STATUS"], "NONE", "no cells entered results in NONE");
});

test("autoFillMissingResponseStatuses: handles Project/Program pp_ prefixes for Section 4 tables", () => {
  const data = {
    pp_s4q01_cadres_male_15_24: 5,
    pp_s4q04_workers_female_35_plus: 0,
    pp_s4q05_cadres_permanent_male: "1",
  };
  const filled = autoFillMissingResponseStatuses(data, "projectProgram");
  assert.equal(filled["S4Q01_RESPONSE_STATUS"], "REPORTED");
  assert.equal(filled["S4Q02_RESPONSE_STATUS"], "NONE");
  assert.equal(filled["S4Q03_RESPONSE_STATUS"], "NONE");
  assert.equal(filled["S4Q04_RESPONSE_STATUS"], "REPORTED");
  assert.equal(filled["S4Q05_RESPONSE_STATUS"], "REPORTED");
  assert.equal(filled["S4Q06_RESPONSE_STATUS"], "NONE");
});

test("Classic TableRenderer cell change logic preserves empty string when cell is cleared", () => {
  const simulateHandleCellChange = (rawValue, onChange) => {
    const parsed = rawValue === "" ? 0 : Number(rawValue);
    if (Number.isNaN(parsed)) return;
    onChange("cell_1", rawValue === "" ? "" : String(parsed));
  };

  let emittedValue = null;
  const onChange = (id, val) => { emittedValue = val; };

  // 1. Clearing cell -> must emit ""
  simulateHandleCellChange("", onChange);
  assert.equal(emittedValue, "", "Clearing cell must emit empty string '', never '0'");

  // 2. Explicit zero -> must emit "0"
  simulateHandleCellChange("0", onChange);
  assert.equal(emittedValue, "0", "Explicit 0 must emit '0'");

  // 3. Positive number -> must emit "5"
  simulateHandleCellChange("5", onChange);
  assert.equal(emittedValue, "5", "Explicit 5 must emit '5'");
});

test("Schema validation: S3Q02_REASON_2_TEXT and S3Q02_REASON_3_TEXT are optional across all entities", () => {
  const schemaPath = "assets/schemas/onefop.schema.json";
  const content = fs.readFileSync(schemaPath, "utf8");
  const schema = JSON.parse(content);

  const entities = ["enterprise", "cooperative", "ctd", "ong", "administration"];
  for (const entity of entities) {
    const entityDef = schema.entities[entity];
    assert.ok(entityDef, `Entity ${entity} must exist in schema`);

    const allFields = [];
    const walkSections = (obj) => {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) {
        for (const item of obj) walkSections(item);
      } else {
        if (obj.id && obj.paperCode === "S3Q02") allFields.push(obj);
        for (const val of Object.values(obj)) walkSections(val);
      }
    };
    walkSections(entityDef);

    const r1 = allFields.find((f) => f.id === "S3Q02_REASON_1_TEXT");
    const r2 = allFields.find((f) => f.id === "S3Q02_REASON_2_TEXT");
    const r3 = allFields.find((f) => f.id === "S3Q02_REASON_3_TEXT");

    assert.ok(r1, `${entity} must have S3Q02_REASON_1_TEXT`);
    assert.equal(r1.required, true, `${entity} S3Q02_REASON_1_TEXT must be required`);

    assert.ok(r2, `${entity} must have S3Q02_REASON_2_TEXT`);
    assert.equal(r2.required, false, `${entity} S3Q02_REASON_2_TEXT must be optional`);

    assert.ok(r3, `${entity} must have S3Q02_REASON_3_TEXT`);
    assert.equal(r3.required, false, `${entity} S3Q02_REASON_3_TEXT must be optional`);
  }
});


