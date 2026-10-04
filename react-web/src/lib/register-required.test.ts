import assert from "node:assert/strict";
import { test } from "node:test";

import { ENTITY_CONFIGS, type EntityType } from "@/lib/register-constants";
import { isSectionComplete, type RegState } from "@/lib/register-completeness";
import { lastEntityFieldKey } from "@/lib/register-entity-sections";
import {
  lastFieldId,
  missingRequiredFields,
  requiredFieldsFor,
  type NameResolvers,
} from "@/lib/register-required";

// Keys read straight back, so nothing here depends on the catalogue's
// wording; entity labels are the questionnaire's own strings.
const resolvers: NameResolvers = {
  t: (key) => key,
  entityLabel: (field) => field.label,
};

const ALL_TYPES: EntityType[] = [
  "enterprise",
  "cooperative",
  "ctd",
  "ong",
  "administration",
  "projectProgram",
  "vocationalTraining",
];

function emptyState(overrides: Partial<RegState> = {}): RegState {
  return {
    entityType: null,
    respondent: { firstName: "", lastName: "", function: "", email: "", phone1: "", phone2: "" },
    emailAvailable: null,
    entityData: {},
    regionId: "",
    departmentId: "",
    subdivisionId: "",
    subdivisionsStatus: "idle",
    area: "",
    sectorId: "",
    password: "",
    confirmPassword: "",
    ...overrides,
  };
}

// Fills exactly the required, visible fields of a type's section 3 -- and
// deliberately nothing else, which is the whole point of these tests.
function requiredOnlyEntityData(type: EntityType): Record<string, string> {
  const data: Record<string, string> = {};
  for (const field of ENTITY_CONFIGS[type].fields) {
    if (!field.required) continue;
    // A gated field is not on screen unless its gate is open, and these
    // states never open one.
    if (field.dependsOn) continue;
    data[field.key] = field.kind === "number" ? "2020" : (field.options?.[0]?.value ?? "x");
  }
  return data;
}

// ── Item 10: optional fields must never block ────────────────────────────

test("filling ONLY the required fields completes section 3, for every type", () => {
  for (const type of ALL_TYPES) {
    const state = emptyState({ entityType: type, entityData: requiredOnlyEntityData(type) });
    assert.equal(
      isSectionComplete("entityInfo", state),
      true,
      `${type}: required-only data must complete the section`
    );
    assert.deepEqual(
      missingRequiredFields("entityInfo", state, resolvers).map((f) => f.id),
      [],
      `${type}: nothing should be reported missing`
    );
  }
});

test("the untouched optional fields really were untouched", () => {
  // Guards the test above against quietly filling everything: if
  // requiredOnlyEntityData ever started writing optional keys, the claim
  // "optional fields never block" would be proved by a state that has none.
  for (const type of ALL_TYPES) {
    const data = requiredOnlyEntityData(type);
    const optional = ENTITY_CONFIGS[type].fields.filter((f) => !f.required);
    assert.ok(optional.length > 0, `${type} has no optional field to test with`);
    for (const field of optional) {
      assert.equal(data[field.key], undefined, `${type}.${field.key} should be untouched`);
    }
  }
});

test("the last field of section 3 is optional for every type", () => {
  // This is WHY the continue link has to exist. Auto-advance is armed by a
  // change to the section's last field, and that field is optional in all
  // seven types -- so a respondent who fills only what is required never
  // arms it and would otherwise be stuck.
  for (const type of ALL_TYPES) {
    const key = lastEntityFieldKey(type, requiredOnlyEntityData(type));
    const field = ENTITY_CONFIGS[type].fields.find((f) => f.key === key);
    assert.ok(field, `${type}: no last field`);
    assert.equal(field.required, false, `${type}: last field ${key} is required, not optional`);
  }
});

test("respondent and location ignore their optional fields", () => {
  const state = emptyState({
    respondent: {
      firstName: "Emmanuel",
      lastName: "Biya",
      function: "Gérant",
      email: "a@b.cm",
      phone1: "655000000",
      phone2: "", // untouched
    },
    regionId: "r1",
    departmentId: "d1",
    subdivisionId: "s1",
    subdivisionsStatus: "ready",
    area: "Urbain",
    sectorId: "", // untouched
  });
  assert.equal(isSectionComplete("respondent", state), true);
  assert.equal(isSectionComplete("location", state), true);
  assert.deepEqual(missingRequiredFields("respondent", state, resolvers), []);
  assert.deepEqual(missingRequiredFields("location", state, resolvers), []);
});

// ── The two predicates must agree ────────────────────────────────────────

test("isSectionComplete and missingRequiredFields never disagree", () => {
  // If they did, the flow would either refuse to advance while naming
  // nothing, or name a field that was not actually blocking.
  const steps = ["entityType", "respondent", "entityInfo", "location"] as const;
  const states: RegState[] = [
    emptyState(),
    emptyState({ entityType: "enterprise" }),
    emptyState({ entityType: "ong", entityData: requiredOnlyEntityData("ong") }),
    emptyState({ entityType: "ctd", entityData: { ctdType: "Région" } }),
    emptyState({ regionId: "r1", departmentId: "d1", subdivisionsStatus: "empty", area: "Rural" }),
    emptyState({ regionId: "r1", departmentId: "d1", subdivisionsStatus: "ready", area: "Rural" }),
  ];
  for (const state of states) {
    for (const step of steps) {
      const complete = isSectionComplete(step, state);
      const missing = missingRequiredFields(step, state, resolvers);
      assert.equal(
        complete,
        missing.length === 0,
        `${step}: complete=${complete} but ${missing.length} reported missing`
      );
    }
  }
});

// ── Gated fields ─────────────────────────────────────────────────────────

test("a required field behind a closed gate is not reported missing", () => {
  const base = requiredOnlyEntityData("vocationalTraining");
  const functional = emptyState({
    entityType: "vocationalTraining",
    entityData: { ...base, functionalStatus: "Fonctionnelle" },
  });
  const ids = missingRequiredFields("entityInfo", functional, resolvers).map((f) => f.id);
  assert.ok(!ids.includes("reg-entity-nonFunctionalReason"));

  // Open the gate and it becomes a real, reportable requirement.
  const nonFunctional = emptyState({
    entityType: "vocationalTraining",
    entityData: { ...base, functionalStatus: "Non-fonctionnelle" },
  });
  assert.deepEqual(
    missingRequiredFields("entityInfo", nonFunctional, resolvers).map((f) => f.id),
    ["reg-entity-nonFunctionalReason"]
  );

  // And the chained one only once ITS gate opens too.
  const other = emptyState({
    entityType: "vocationalTraining",
    entityData: {
      ...base,
      functionalStatus: "Non-fonctionnelle",
      nonFunctionalReason: "Autres",
    },
  });
  assert.deepEqual(
    missingRequiredFields("entityInfo", other, resolvers).map((f) => f.id),
    ["reg-entity-nonFunctionalReasonOther"]
  );
});

test("a department with no arrondissements does not require one", () => {
  const empty = emptyState({ regionId: "r1", departmentId: "d1", subdivisionsStatus: "empty" });
  const ids = missingRequiredFields("location", empty, resolvers).map((f) => f.id);
  assert.ok(!ids.includes("reg-subdivision"));
  assert.deepEqual(ids, ["reg-area"]);
});

// ── Names and order ──────────────────────────────────────────────────────

test("missing fields come back in render order, named", () => {
  const state = emptyState({
    respondent: { firstName: "Emmanuel", lastName: "", function: "", email: "", phone1: "", phone2: "" },
  });
  assert.deepEqual(
    missingRequiredFields("respondent", state, resolvers).map((f) => f.name),
    [
      "registerPage.lastNameLabel",
      "registerPage.functionLabel",
      "registerPage.professionalEmailLabel",
      "registerPage.phone1Label",
    ]
  );
});

test("security reports emptiness only, never weakness or mismatch", () => {
  // "Champ obligatoire" under a box that has something in it would be wrong;
  // strength and matching are the submit validator's messages.
  const weak = emptyState({ password: "a", confirmPassword: "b" });
  assert.deepEqual(missingRequiredFields("security", weak, resolvers), []);
  assert.equal(isSectionComplete("security", weak), false);

  const empty = emptyState();
  assert.deepEqual(
    missingRequiredFields("security", empty, resolvers).map((f) => f.id),
    ["reg-password", "reg-confirm-password"]
  );
});

test("review requires nothing of its own", () => {
  assert.deepEqual(requiredFieldsFor("review", emptyState(), resolvers), []);
});

// ── lastFieldId ──────────────────────────────────────────────────────────

test("lastFieldId matches the last field actually rendered", () => {
  for (const type of ALL_TYPES) {
    const data = requiredOnlyEntityData(type);
    assert.equal(
      lastFieldId("entityInfo", type, data),
      `reg-entity-${lastEntityFieldKey(type, data)}`,
      type
    );
  }
  assert.equal(lastFieldId("respondent", null, {}), "reg-phone2");
  assert.equal(lastFieldId("location", null, {}), "reg-sector");
  assert.equal(lastFieldId("security", null, {}), "reg-confirm-password");
  // No single control to leave: the type list is a radio group, and the
  // review has no fields of its own.
  assert.equal(lastFieldId("entityType", null, {}), null);
  assert.equal(lastFieldId("review", null, {}), null);
});
