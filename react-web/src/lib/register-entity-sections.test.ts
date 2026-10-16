import assert from "node:assert/strict";
import { test } from "node:test";

import { ENTITY_CONFIGS, type EntityType } from "@/lib/register-constants";
import {
  UNMAPPED_GROUP_TITLE,
  entityFieldGroups,
  lastEntityFieldKey,
  optionalEntityFields,
  requiredEntityGroups,
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

test("enterprise keeps the required path together and folds the rest", () => {
  // Screen order. Required groups stay in front so Continuer follows the
  // establishment phone. The optional tail keeps entityFieldGroups' order
  // (config order inside each block, blocks in layout order). NIU and CNPS
  // stay a pair.
  const required = requiredEntityGroups("enterprise", {}).flatMap((g) => g.fields.map((f) => f.key));
  assert.deepEqual(required, [
    "companyName",
    "legalStatus",
    "taxNumber",
    "cnpsNumber",
    "mainActivity",
    "address",
    "phone",
  ]);
  assert.deepEqual(
    optionalEntityFields("enterprise", {}).map((f) => f.key),
    ["socialCapital", "parentCompany", "branch", "secondaryActivity", "phone2", "poBox"]
  );
  assert.deepEqual(
    requiredEntityGroups("enterprise", {}).map((g) => g.title.fr),
    [
      "Identité juridique",
      "Fiscalité et affiliation",
      "Activité économique",
      "Siège social et contact",
    ]
  );
});

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
  // Required groups, then the optional disclosure. The key the wizard treats
  // as the end of the section has to be the last of those, not the last key
  // in the layout source, which still interleaves the two.
  for (const type of ALL_TYPES) {
    const rendered = [
      ...requiredEntityGroups(type, {}).flatMap((g) => g.fields.map((f) => f.key)),
      ...optionalEntityFields(type, {}).map((f) => f.key),
    ];
    assert.equal(lastEntityFieldKey(type, {}), rendered[rendered.length - 1], type);
  }
});

test("required groups and the optional list partition the visible fields", () => {
  const open = { functionalStatus: "Non-fonctionnelle", nonFunctionalReason: "Autres" };
  for (const type of ALL_TYPES) {
    const placed = entityFieldGroups(type, open).flatMap((g) => g.fields);
    const required = requiredEntityGroups(type, open).flatMap((g) => g.fields.map((f) => f.key));
    const optional = optionalEntityFields(type, open).map((f) => f.key);
    assert.deepEqual(
      [...required, ...optional].sort(),
      placed.map((f) => f.key).sort(),
      type
    );
    for (const key of required) {
      assert.equal(placed.find((f) => f.key === key)?.required, true, `${type}.${key}`);
    }
    for (const key of optional) {
      assert.equal(placed.find((f) => f.key === key)?.required, false, `${type}.${key}`);
    }
    assert.equal(new Set([...required, ...optional]).size, required.length + optional.length, type);
    for (const group of requiredEntityGroups(type, open)) {
      assert.ok(group.fields.length > 0, `${type} renders an empty required group`);
    }
  }
  // The centre's reason fields are required once their gate is open, so they
  // stay on the open path. The acronym and the second phones stay folded.
  const vtRequired = requiredEntityGroups("vocationalTraining", open).flatMap((g) =>
    g.fields.map((f) => f.key)
  );
  assert.ok(vtRequired.includes("nonFunctionalReason"));
  assert.ok(vtRequired.includes("nonFunctionalReasonOther"));
  assert.ok(!vtRequired.includes("sigle"));
  assert.deepEqual(
    optionalEntityFields("vocationalTraining", open).map((f) => f.key),
    ["sigle", "phone2", "poBox", "promoterPhone2"]
  );
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
