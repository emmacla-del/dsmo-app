import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENTITY_CONFIGS,
  REGISTRATION_STEPS,
  REGISTRATION_STEP_IDS,
  pruneEntityDataForType,
  resolveCompanyName,
  visibleEntityDataForType,
  type EntityType,
} from "./register-constants";

function keysOf(type: EntityType): string[] {
  return ENTITY_CONFIGS[type].fields.map((f) => f.key);
}

test("pruneEntityDataForType keeps fields the new type also declares", () => {
  const entered = {
    companyName: "Alpha SARL",
    address: "BP 1234, Yaoundé",
    phone: "677000000",
    phone2: "699000000",
    poBox: "1234",
  };

  const pruned = pruneEntityDataForType(entered, "administration");

  // address/phone/phone2/poBox are declared by administration too, so the
  // respondent does not retype them.
  assert.deepEqual(pruned, {
    address: "BP 1234, Yaoundé",
    phone: "677000000",
    phone2: "699000000",
    poBox: "1234",
  });
});

test("pruneEntityDataForType drops fields the new type does not declare", () => {
  const entered = {
    centerName: "CFP Douala",
    cfpType: "Privé",
    educationSystem: "Technique",
    promoterName: "A. Ndongo",
    functionalStatus: "Fonctionnelle",
    phone: "677000000",
  };

  const pruned = pruneEntityDataForType(entered, "enterprise");

  assert.deepEqual(pruned, { phone: "677000000" });
  for (const key of ["centerName", "cfpType", "educationSystem", "promoterName", "functionalStatus"]) {
    assert.ok(!(key in pruned), `${key} should not survive the switch to enterprise`);
  }
});

test("pruneEntityDataForType leaves data untouched when the type is unchanged", () => {
  const entered = { companyName: "Alpha SARL", legalStatus: "SARL", phone: "677000000" };

  assert.deepEqual(pruneEntityDataForType(entered, "enterprise"), entered);
});

test("pruneEntityDataForType never retains a key outside the new type's config", () => {
  // Every field key across all seven types, as though the respondent had cycled
  // through all of them before settling on one.
  const everything: Record<string, string> = {};
  for (const type of Object.keys(ENTITY_CONFIGS) as EntityType[]) {
    for (const key of keysOf(type)) everything[key] = `value-${key}`;
  }

  for (const type of Object.keys(ENTITY_CONFIGS) as EntityType[]) {
    const pruned = pruneEntityDataForType(everything, type);
    assert.deepEqual(
      Object.keys(pruned).sort(),
      keysOf(type).sort(),
      `pruning to ${type} should yield exactly that type's keys`
    );
  }
});

test("pruning prevents a stale companyName from outranking the new type's name field", () => {
  // resolveCompanyName checks companyName before ngoName, so without pruning an
  // ONG would register under the enterprise name typed earlier in the session.
  const stale = { companyName: "Alpha SARL", ngoName: "Fondation Beta" };
  assert.equal(resolveCompanyName(stale, "fallback"), "Alpha SARL");

  const pruned = pruneEntityDataForType(stale, "ong");
  assert.equal(resolveCompanyName(pruned, "fallback"), "Fondation Beta");
});

test("visibleEntityDataForType drops a dependent field whose gate has closed", () => {
  // A CFP respondent reports the centre as non-functional, gives a reason, then
  // corrects the status. isFieldVisible hides both children from the form and
  // from the review screen, so the payload must not carry them either.
  const entered = {
    centerName: "CFP Douala",
    functionalStatus: "Non-fonctionnelle",
    nonFunctionalReason: "Autres",
    nonFunctionalReasonOther: "Travaux de réhabilitation",
    phone: "677000000",
  };

  const corrected = { ...entered, functionalStatus: "Fonctionnelle" };
  const visible = visibleEntityDataForType(corrected, "vocationalTraining");

  assert.ok(!("nonFunctionalReason" in visible), "the closed gate's child must not survive");
  assert.ok(
    !("nonFunctionalReasonOther" in visible),
    "the grandchild of a closed gate must not survive either"
  );
  assert.equal(visible.functionalStatus, "Fonctionnelle");
  assert.equal(visible.centerName, "CFP Douala");
  assert.equal(visible.phone, "677000000");
});

test("visibleEntityDataForType keeps dependent fields while their gate is open", () => {
  const entered = {
    centerName: "CFP Douala",
    functionalStatus: "Non-fonctionnelle",
    nonFunctionalReason: "Autres",
    nonFunctionalReasonOther: "Travaux de réhabilitation",
  };

  const visible = visibleEntityDataForType(entered, "vocationalTraining");

  assert.equal(visible.nonFunctionalReason, "Autres");
  assert.equal(visible.nonFunctionalReasonOther, "Travaux de réhabilitation");
});

test("visibleEntityDataForType closes a grandchild when the grandparent closes", () => {
  // nonFunctionalReasonOther depends on nonFunctionalReason, which depends on
  // functionalStatus. Closing the outermost gate must cascade, not just hide
  // the immediate child.
  const entered = {
    functionalStatus: "Fonctionnelle",
    nonFunctionalReason: "Autres",
    nonFunctionalReasonOther: "Travaux",
  };

  assert.deepEqual(visibleEntityDataForType(entered, "vocationalTraining"), {
    functionalStatus: "Fonctionnelle",
  });
});

test("visibleEntityDataForType never emits a key outside the type's config", () => {
  const everything: Record<string, string> = {};
  for (const type of Object.keys(ENTITY_CONFIGS) as EntityType[]) {
    for (const key of keysOf(type)) everything[key] = `value-${key}`;
  }

  for (const type of Object.keys(ENTITY_CONFIGS) as EntityType[]) {
    const declared = new Set(keysOf(type));
    for (const key of Object.keys(visibleEntityDataForType(everything, type))) {
      assert.ok(declared.has(key), `${key} is not declared by ${type}`);
    }
  }
});

test("REGISTRATION_STEP_IDS mirrors REGISTRATION_STEPS in order", () => {
  // app/register/page.tsx navigates by REGISTRATION_STEP_IDS and
  // components/auth/RegistrationProgress.tsx renders REGISTRATION_STEPS. Both
  // now derive from the same array, so this locks the derivation rather than
  // comparing two hand-written copies as the old duplication would have needed.
  assert.deepEqual(
    [...REGISTRATION_STEP_IDS],
    REGISTRATION_STEPS.map((step) => step.id)
  );
});

test("REGISTRATION_STEPS is the six-step wizard, uniquely keyed", () => {
  assert.equal(REGISTRATION_STEPS.length, 6);
  assert.deepEqual(
    REGISTRATION_STEPS.map((step) => step.id),
    ["entityType", "respondent", "entityInfo", "location", "security", "review"]
  );

  const ids = new Set(REGISTRATION_STEPS.map((step) => step.id));
  const labelKeys = new Set(REGISTRATION_STEPS.map((step) => step.labelKey));
  assert.equal(ids.size, REGISTRATION_STEPS.length, "step ids must be unique");
  assert.equal(
    labelKeys.size,
    REGISTRATION_STEPS.length,
    "every step needs its own registerPage label key"
  );
});

test("cnpsNumber is required for the five CNPS-affiliated types, absent for the other two", () => {
  const withCnps: EntityType[] = ["enterprise", "cooperative", "ctd", "ong", "vocationalTraining"];
  for (const type of withCnps) {
    const field = ENTITY_CONFIGS[type].fields.find((f) => f.key === "cnpsNumber");
    assert.ok(field, `${type}: no cnpsNumber field`);
    assert.equal(field.required, true, `${type}: cnpsNumber is not required`);
    // Sits right after the NIU, inside the identification/fiscal block.
    const keys = keysOf(type);
    assert.equal(keys.indexOf("cnpsNumber"), keys.indexOf("taxNumber") + 1, `${type}: cnpsNumber not after taxNumber`);
  }
  for (const type of ["administration", "projectProgram"] as EntityType[]) {
    assert.ok(!keysOf(type).includes("cnpsNumber"), `${type}: unexpectedly declares cnpsNumber`);
  }
});

test("every type's entity phone is labelled Téléphone / WhatsApp", () => {
  for (const type of Object.keys(ENTITY_CONFIGS) as EntityType[]) {
    const field = ENTITY_CONFIGS[type].fields.find((f) => f.key === "phone");
    assert.ok(field, `${type}: no phone field`);
    assert.deepEqual(field.label, { fr: "Téléphone / WhatsApp", en: "Phone / WhatsApp" }, `${type}: phone label`);
  }
});
