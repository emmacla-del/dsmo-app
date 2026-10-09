import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OnefopSchema } from "./onefop-schema";
import {
  SECTION1_GEOGRAPHY_FIELDS,
  geographyCorrections,
  lockedGeographyValues,
  lockedVtGeographyValue,
} from "./onefop-geography-lock";

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;

const FULL = { region: "Centre", department: "Mfoundi", subdivision: "Yaoundé 1er" };
const ENT = SECTION1_GEOGRAPHY_FIELDS.enterprise;

test("every entity's geography ids exist in its schema section 1", () => {
  for (const [entityType, ids] of Object.entries(SECTION1_GEOGRAPHY_FIELDS)) {
    const entity = schema.entities[entityType];
    assert.ok(entity, entityType);
    const s1 = entity.sections.find((s) => s.id.startsWith("section1"));
    assert.ok(s1, `${entityType} section 1`);
    for (const id of [ids.region, ids.department, ids.subdivision]) {
      assert.ok(s1.fields.some((f) => f.id === id), `${entityType}: ${id}`);
    }
  }
});

test("locks with the company values when all three levels are present", () => {
  assert.deepEqual(lockedGeographyValues(FULL, ENT), {
    S1Q04_REGION: "Centre",
    S1Q04_DEPT: "Mfoundi",
    S1Q04_SUBDIV: "Yaoundé 1er",
  });
  assert.equal(lockedVtGeographyValue(FULL, "VT1_5"), "Mfoundi");
  assert.equal(lockedVtGeographyValue(FULL, "VT1_7"), undefined);
});

test("stays editable when any level is missing", () => {
  assert.equal(lockedGeographyValues(undefined, ENT), null);
  assert.equal(lockedGeographyValues({ ...FULL, subdivision: "" }, ENT), null);
  assert.equal(lockedGeographyValues({ ...FULL, department: null }, ENT), null);
  assert.equal(lockedGeographyValues({ region: "Centre" }, ENT), null);
  assert.equal(lockedVtGeographyValue({ ...FULL, region: undefined }, "VT1_4"), undefined);
});

test("the company value replaces a differing draft value", () => {
  const locked = lockedGeographyValues(FULL, ENT);
  assert.deepEqual(
    geographyCorrections(locked, { S1Q04_REGION: "Littoral", S1Q04_DEPT: "Mfoundi" }),
    [
      ["S1Q04_REGION", "Centre"],
      ["S1Q04_SUBDIV", "Yaoundé 1er"],
    ],
  );
  assert.deepEqual(geographyCorrections(locked, { ...Object.fromEntries(Object.entries(locked!)) }), []);
  assert.deepEqual(geographyCorrections(null, { S1Q04_REGION: "Littoral" }), []);
});
