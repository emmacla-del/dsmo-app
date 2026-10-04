import assert from "node:assert/strict";
import { test } from "node:test";

import { ENTITY_CONFIGS, type EntityType } from "@/lib/register-constants";
import {
  UNMAPPED_GROUP_TITLE,
  entityFieldGroups,
  lastEntityFieldKey,
} from "@/lib/register-entity-sections";

const ALL_TYPES: EntityType[] = [
  "enterprise",
  "cooperative",
  "ctd",
  "ong",
  "administration",
  "projectProgram",
  "vocationalTraining",
];

test("every declared field of every type is placed in some group", () => {
  // The guard the UNMAPPED_GROUP_TITLE fallback exists for: a field added to
  // ENTITY_CONFIGS but not to a layout block must still be reachable, or the
  // respondent would be asked at submit for a field the form never showed.
  for (const type of ALL_TYPES) {
    const ungated = Object.fromEntries(
      ENTITY_CONFIGS[type].fields.map((f) => [f.key, ""])
    );
    const placed = entityFieldGroups(type, ungated).flatMap((g) => g.fields.map((f) => f.key));
    for (const field of ENTITY_CONFIGS[type].fields) {
      // Dependent fields are absent while their gate is shut; that is the
      // gate doing its job, not a placement hole.
      if (field.dependsOn) continue;
      assert.ok(placed.includes(field.key), `${type}.${field.key} is in no group`);
    }
    assert.equal(new Set(placed).size, placed.length, `${type} renders a field twice`);
  }
});

test("no type needs the unmapped fallback today", () => {
  // Not a rule, a fact worth noticing if it changes: a group under this title
  // appearing means a layout block was not updated with a new field.
  for (const type of ALL_TYPES) {
    const titles = entityFieldGroups(type, {}).map((g) => g.title);
    assert.ok(!titles.includes(UNMAPPED_GROUP_TITLE), `${type} has an unmapped field`);
  }
});

test("lastEntityFieldKey is the last field actually rendered", () => {
  for (const type of ALL_TYPES) {
    const groups = entityFieldGroups(type, {});
    const flat = groups.flatMap((g) => g.fields.map((f) => f.key));
    assert.equal(lastEntityFieldKey(type, {}), flat[flat.length - 1], type);
  }
});

test("lastEntityFieldKey follows the gate, not the declaration order", () => {
  // The VT centre's last block is Direction & Promoteur, so its last field is
  // the promoter's second phone whichever way the functional-status gate in
  // the block above is answered. What the gate changes is which fields exist
  // in between -- and the wizard must not wait on one that is not on screen.
  const closed = lastEntityFieldKey("vocationalTraining", {});
  const open = lastEntityFieldKey("vocationalTraining", { functionalStatus: "Non fonctionnel" });
  assert.equal(closed, open);

  const groups = entityFieldGroups("vocationalTraining", { functionalStatus: "Non fonctionnel" });
  const keys = groups.flatMap((g) => g.fields.map((f) => f.key));
  const closedKeys = entityFieldGroups("vocationalTraining", {}).flatMap((g) =>
    g.fields.map((f) => f.key)
  );
  // Opening the gate adds fields; it must not remove or reorder any.
  assert.ok(keys.length >= closedKeys.length);
  assert.equal(keys[keys.length - 1], closedKeys[closedKeys.length - 1]);
});

test("a group with no visible field is dropped rather than rendered empty", () => {
  for (const type of ALL_TYPES) {
    for (const group of entityFieldGroups(type, {})) {
      assert.ok(group.fields.length > 0, `${type} renders an empty "${group.title}" block`);
    }
  }
});
