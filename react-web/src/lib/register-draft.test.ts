import assert from "node:assert/strict";
import { test } from "node:test";

import {
  REGISTER_DRAFT_VERSION,
  draftHasData,
  parseDraft,
  restoredReached,
  toDraft,
  type RegisterDraftNames,
} from "@/lib/register-draft";
import { isSectionComplete, type RegState } from "@/lib/register-completeness";

const NAMES: RegisterDraftNames = {
  regionName: "Centre",
  departmentName: "Mfoundi",
  subdivisionName: "Yaounde I",
  sectorName: "Commerce",
};

function baseState(overrides: Partial<RegState> = {}): RegState {
  return {
    entityType: "enterprise",
    respondent: {
      firstName: "Emmanuel",
      lastName: "Biya",
      function: "DRH",
      email: "contact@organisation.cm",
      phone1: "655000000",
      phone2: "",
    },
    emailAvailable: true,
    entityData: {
      companyName: "SARL Exemple",
      legalStatus: "SARL",
      taxNumber: "P000000000000",
      cnpsNumber: "0000000000",
      mainActivity: "Commerce",
      address: "Yaounde, Centre",
      phone: "655000000",
    },
    regionId: "r1",
    departmentId: "d1",
    subdivisionId: "s1",
    subdivisionsStatus: "ready",
    area: "URBAN",
    sectorId: "sec1",
    password: "Motdepasse1!",
    confirmPassword: "Motdepasse1!",
    ...overrides,
  };
}

const emptyState = (): RegState =>
  baseState({
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
  });

// ── the security requirement ─────────────────────────────────────────────
test("the serialized draft contains neither the password nor its confirmation", () => {
  const state = baseState({ password: "Sup3rSecret!", confirmPassword: "Sup3rSecret!" });
  const draft = toDraft(state, 5, NAMES);

  assert.equal("password" in draft, false);
  assert.equal("confirmPassword" in draft, false);

  // Belt and braces: the actual stored string must not contain the secret,
  // however the object is shaped.
  const serialized = JSON.stringify(draft);
  assert.equal(serialized.includes("Sup3rSecret!"), false);
  assert.equal(serialized.includes("password"), false);
});

test("a round trip keeps the respondent and the entity answers", () => {
  const state = baseState();
  const draft = toDraft(state, 3, NAMES);
  const restored = parseDraft(JSON.parse(JSON.stringify(draft)));

  assert.ok(restored);
  assert.deepEqual(restored.respondent, state.respondent);
  assert.deepEqual(restored.entityData, state.entityData);
  assert.equal(restored.entityType, "enterprise");
  assert.equal(restored.step, 3);
  assert.equal(restored.regionName, "Centre");
  assert.equal(restored.subdivisionName, "Yaounde I");
});

// ── defensive parsing ────────────────────────────────────────────────────
test("parseDraft rejects anything it does not recognise", () => {
  assert.equal(parseDraft(null), null);
  assert.equal(parseDraft("a string"), null);
  assert.equal(parseDraft(42), null);
  assert.equal(parseDraft({}), null);
  assert.equal(parseDraft({ version: 999, step: 0 }), null);
});

test("parseDraft drops an unknown entity type rather than trusting it", () => {
  const restored = parseDraft({ version: REGISTER_DRAFT_VERSION, step: 1, entityType: "bank" });
  assert.ok(restored);
  assert.equal(restored.entityType, null);
});

test("parseDraft clamps a stored step into range and survives missing fields", () => {
  const high = parseDraft({ version: REGISTER_DRAFT_VERSION, step: 99 });
  assert.equal(high?.step, 5);

  const low = parseDraft({ version: REGISTER_DRAFT_VERSION, step: -4 });
  assert.equal(low?.step, 0);

  const bare = parseDraft({ version: REGISTER_DRAFT_VERSION });
  assert.equal(bare?.step, 0);
  assert.deepEqual(bare?.respondent, {
    firstName: "",
    lastName: "",
    function: "",
    email: "",
    phone1: "",
    phone2: "",
  });
  assert.deepEqual(bare?.entityData, {});
});

test("parseDraft keeps only string entries out of entityData", () => {
  const restored = parseDraft({
    version: REGISTER_DRAFT_VERSION,
    step: 2,
    entityData: { companyName: "SARL", socialCapital: 5000, nested: { a: 1 } },
  });
  assert.deepEqual(restored?.entityData, { companyName: "SARL" });
});

// ── where the wizard reopens ─────────────────────────────────────────────
test("restoredReached keeps the saved position when the answers support it", () => {
  // Everything is complete except security, whose password was never stored,
  // so firstIncomplete is 4 -> 3. The saved step of 4 is higher and wins.
  const state = baseState({ password: "", confirmPassword: "" });
  assert.equal(restoredReached(4, state), 4);
});

test("restoredReached advances past a saved step the answers have outrun", () => {
  // Sections 0-3 complete, security empty: firstIncomplete is 4, so 3. A draft
  // saved at step 1 still reopens at 3 rather than hiding completed sections.
  const state = baseState({ password: "", confirmPassword: "" });
  assert.equal(restoredReached(1, state), 3);
});

test("restoredReached never returns below zero or above the last section", () => {
  assert.equal(restoredReached(0, emptyState()), 0);
  assert.equal(restoredReached(-3, emptyState()), 0);
  assert.equal(restoredReached(99, baseState()), 5);
});

test("a restored draft leaves the security section incomplete", () => {
  // The whole point of not persisting the password: review may be revealed,
  // but security cannot count as done until both fields are retyped.
  const state = baseState({ password: "", confirmPassword: "" });
  const reached = restoredReached(5, state);
  assert.equal(reached, 5);
  // Reaching review does not mean security passed -- submit still blocks.
  assert.equal(isSectionComplete("security", state), false);
});

// ── the leave guard ──────────────────────────────────────────────────────
test("draftHasData is false only on a pristine wizard", () => {
  assert.equal(draftHasData(emptyState()), false);
  assert.equal(draftHasData(baseState()), true);
});

test("draftHasData notices each kind of answer on its own", () => {
  const cases: Partial<RegState>[] = [
    { entityType: "ong" },
    { respondent: { firstName: "A", lastName: "", function: "", email: "", phone1: "", phone2: "" } },
    { entityData: { companyName: "X" } },
    { regionId: "r1" },
    { departmentId: "d1" },
    { subdivisionId: "s1" },
    { area: "RURAL" },
    { sectorId: "sec1" },
    // The password is not persisted, so leaving is exactly when it is lost.
    { password: "abc" },
    { confirmPassword: "abc" },
  ];
  for (const override of cases) {
    assert.equal(
      draftHasData({ ...emptyState(), ...override }),
      true,
      `expected ${JSON.stringify(override)} to count as entered data`
    );
  }
});

test("draftHasData ignores whitespace-only answers", () => {
  const state = {
    ...emptyState(),
    respondent: { firstName: "   ", lastName: "", function: "", email: "", phone1: "", phone2: "" },
  };
  assert.equal(draftHasData(state), false);
});
