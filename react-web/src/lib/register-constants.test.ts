import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENTITY_CONFIGS,
  pruneEntityDataForType,
  resolveCompanyName,
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
