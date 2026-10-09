import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OnefopField, OnefopSchema } from "./onefop-schema";
import { isFieldVisible } from "./onefop-schema";

// Visibility parity with the server (onefop-shadow-validator.service.ts
// isVisible): eq is an exact match; contains is "the selections include the
// value". The server also applies String.includes when a multi-choice parent
// holds a scalar string; the client does not (yet), so scalar answers to a
// checkbox parent are outside the domain checked here.

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;

function expected(field: OnefopField, value: unknown): boolean {
  const v = field.visibility!;
  if (v.dependsOperator === "contains") {
    if (Array.isArray(value)) return value.includes(v.dependsValue);
    return typeof value === "string" && v.dependsValue !== null && value.includes(v.dependsValue);
  }
  return value === v.dependsValue;
}

test("every schema visibility rule agrees with the server semantics for every parent answer", () => {
  let rules = 0;
  let cases = 0;
  for (const [entityType, entity] of Object.entries(schema.entities)) {
    const fields = entity.sections.flatMap((s) => s.fields);
    const byId = new Map(fields.map((f) => [f.id, f]));
    for (const field of fields) {
      if (!field.visibility) continue;
      rules++;
      const parent = byId.get(field.visibility.dependsOn);
      assert.ok(parent, `${entityType}.${field.id}: parent ${field.visibility.dependsOn} is not in the schema`);
      const options = (parent.options ?? []).map((o) => o.value);
      const values: unknown[] = [undefined, ""];
      if (parent.type === "checkbox") {
        values.push([], options.slice());
        for (const o of options) values.push([o]);
      } else {
        values.push(...options);
      }
      for (const value of values) {
        cases++;
        const data: Record<string, unknown> = { [field.visibility.dependsOn]: value };
        assert.equal(
          isFieldVisible(field, data),
          expected(field, value),
          `${entityType}.${field.id} with ${field.visibility.dependsOn}=${JSON.stringify(value)}`,
        );
      }
    }
  }
  assert.ok(rules > 0 && cases > rules);
});

const rule = (visibility: OnefopField["visibility"]): OnefopField =>
  ({ id: "CHILD", type: "text", visibility }) as unknown as OnefopField;

test("eq is an exact match, not a prefix match", () => {
  const f = rule({ dependsOn: "P", dependsValue: "Oui/ Yes", dependsOperator: "eq" });
  assert.equal(isFieldVisible(f, { P: "Oui/ Yes" }), true);
  assert.equal(isFieldVisible(f, { P: "Oui" }), false);
  assert.equal(isFieldVisible(f, { P: "Oui/ Yes (autre)" }), false);
  assert.equal(isFieldVisible(f, {}), false);
});

test("dependsValues is exact membership", () => {
  const f = rule({ dependsOn: "P", dependsValue: null, dependsOperator: "in", dependsValues: ["A/ a", "B/ b"] });
  assert.equal(isFieldVisible(f, { P: "B/ b" }), true);
  assert.equal(isFieldVisible(f, { P: "A" }), false);
  assert.equal(isFieldVisible(f, { P: "C/ c" }), false);
  assert.equal(isFieldVisible(f, {}), false);
});

test("contains checks the selected values", () => {
  const f = rule({ dependsOn: "P", dependsValue: "Autres/ Others", dependsOperator: "contains" });
  assert.equal(isFieldVisible(f, { P: ["X", "Autres/ Others"] }), true);
  assert.equal(isFieldVisible(f, { P: ["X"] }), false);
  assert.equal(isFieldVisible(f, { P: [] }), false);
});
