import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PASSWORD_MIN_STRENGTH,
  advancesImmediately,
  isSectionComplete,
  type RegState,
  type SubdivisionsStatus,
} from "@/lib/register-completeness";
import { passwordRuleChecks, passwordStrength } from "@/lib/password-strength";

// A snapshot with every section already satisfied; each test knocks out the
// one value it is about, so a test can never pass because some unrelated
// field happened to be empty.
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
      mainActivity: "Commerce",
      address: "Yaoundé, Centre",
      phone: "655000000",
    },
    regionId: "r1",
    departmentId: "d1",
    subdivisionId: "s1",
    subdivisionsStatus: "ready",
    area: "URBAN",
    sectorId: "",
    password: "Motdepasse1!",
    confirmPassword: "Motdepasse1!",
    ...overrides,
  };
}

test("entityType section needs a selected type", () => {
  assert.equal(isSectionComplete("entityType", baseState()), true);
  assert.equal(isSectionComplete("entityType", baseState({ entityType: null })), false);
});

test("respondent section requires all five mandatory fields", () => {
  assert.equal(isSectionComplete("respondent", baseState()), true);
  for (const key of ["firstName", "lastName", "function", "email", "phone1"] as const) {
    const state = baseState();
    const respondent = { ...state.respondent, [key]: "" };
    assert.equal(
      isSectionComplete("respondent", { ...state, respondent }),
      false,
      `clearing ${key} should block the respondent section`
    );
  }
});

test("respondent section ignores the optional second phone", () => {
  const state = baseState();
  const respondent = { ...state.respondent, phone2: "" };
  assert.equal(isSectionComplete("respondent", { ...state, respondent }), true);
});

test("respondent section treats whitespace as empty", () => {
  const state = baseState();
  const respondent = { ...state.respondent, firstName: "   " };
  assert.equal(isSectionComplete("respondent", { ...state, respondent }), false);
});

test("respondent section blocks only on an explicit taken email", () => {
  assert.equal(isSectionComplete("respondent", baseState({ emailAvailable: false })), false);
  // null is "unchecked or the check failed" and must not strand the respondent.
  assert.equal(isSectionComplete("respondent", baseState({ emailAvailable: null })), true);
});

test("entityInfo section requires every visible required field", () => {
  assert.equal(isSectionComplete("entityInfo", baseState()), true);
  const missingTax = baseState();
  delete missingTax.entityData.taxNumber;
  assert.equal(isSectionComplete("entityInfo", missingTax), false);
});

test("entityInfo section ignores optional fields", () => {
  const state = baseState();
  // cnpsNumber, branch, poBox, socialCapital... are all optional for enterprise
  assert.equal(isSectionComplete("entityInfo", state), true);
  assert.equal(
    isSectionComplete("entityInfo", { ...state, entityData: { ...state.entityData, cnpsNumber: "" } }),
    true
  );
});

test("entityInfo section does not block on a required field whose gate is closed", () => {
  // vocationalTraining: nonFunctionalReason is required but only visible while
  // functionalStatus === "Non-fonctionnelle" (the stored value, which is the
  // French wording -- see FUNCTIONAL_STATUS_OPTIONS).
  const vtData = (): Record<string, string> => ({
    centerName: "CFP Exemple",
    taxNumber: "P000000000000",
    cfpType: "Public",
    educationSystem: "Francophone",
    functionalStatus: "Non-fonctionnelle",
    yearOfCreation: "2010",
    address: "Douala",
    phone: "655000000",
    promoterName: "Awa",
    promoterSex: "Feminin",
    promoterPhone1: "655000001",
  });

  // Gate open and the dependent field unanswered -> blocked.
  assert.equal(
    isSectionComplete("entityInfo", baseState({ entityType: "vocationalTraining", entityData: vtData() })),
    false
  );

  // Gate closed -> the same unanswered field must not block.
  const closed = vtData();
  closed.functionalStatus = "Fonctionnelle";
  assert.equal(
    isSectionComplete("entityInfo", baseState({ entityType: "vocationalTraining", entityData: closed })),
    true
  );

  // Gate open and answered, but with the value that opens the grandchild.
  const grandchildOpen = vtData();
  grandchildOpen.nonFunctionalReason = "Autres";
  assert.equal(
    isSectionComplete("entityInfo", baseState({ entityType: "vocationalTraining", entityData: grandchildOpen })),
    false,
    "nonFunctionalReasonOther is required once nonFunctionalReason is Autres"
  );

  const grandchildAnswered = { ...grandchildOpen, nonFunctionalReasonOther: "Locaux inondes" };
  assert.equal(
    isSectionComplete("entityInfo", baseState({ entityType: "vocationalTraining", entityData: grandchildAnswered })),
    true
  );

  // Closing the grandparent must close the grandchild too, even though
  // nonFunctionalReason still holds "Autres" in state.
  const grandparentClosed = { ...grandchildOpen, functionalStatus: "Fonctionnelle" };
  assert.equal(
    isSectionComplete("entityInfo", baseState({ entityType: "vocationalTraining", entityData: grandparentClosed })),
    true
  );
});

test("location section requires region, department, area and a subdivision", () => {
  assert.equal(isSectionComplete("location", baseState()), true);
  assert.equal(isSectionComplete("location", baseState({ regionId: "" })), false);
  assert.equal(isSectionComplete("location", baseState({ departmentId: "" })), false);
  assert.equal(isSectionComplete("location", baseState({ subdivisionId: "" })), false);
});

test("location section keeps area required", () => {
  assert.equal(isSectionComplete("location", baseState({ area: "" })), false);
});

test("location section ignores the optional sector", () => {
  assert.equal(isSectionComplete("location", baseState({ sectorId: "" })), true);
});

test("a department that returns no subdivisions does not strand the respondent", () => {
  const cases: [SubdivisionsStatus, boolean][] = [
    ["idle", false],
    ["loading", false],
    ["error", false],
    ["empty", true],
    ["ready", false],
  ];
  for (const [subdivisionsStatus, expected] of cases) {
    assert.equal(
      isSectionComplete("location", baseState({ subdivisionId: "", subdivisionsStatus })),
      expected,
      `subdivisionsStatus=${subdivisionsStatus} with no selection`
    );
  }
});

test("a selected subdivision completes the section whatever the list status", () => {
  for (const subdivisionsStatus of ["idle", "loading", "error", "empty", "ready"] as SubdivisionsStatus[]) {
    assert.equal(isSectionComplete("location", baseState({ subdivisionsStatus })), true);
  }
});

test("security section enforces length, strength and the confirmation", () => {
  assert.equal(isSectionComplete("security", baseState()), true);
  // 7 chars: under the minimum even though it is otherwise strong
  assert.equal(
    isSectionComplete("security", baseState({ password: "Abc1!de", confirmPassword: "Abc1!de" })),
    false
  );
  // 8 lowercase chars scores 0.25, under the 0.35 floor
  assert.equal(
    isSectionComplete("security", baseState({ password: "abcdefgh", confirmPassword: "abcdefgh" })),
    false
  );
  assert.equal(isSectionComplete("security", baseState({ confirmPassword: "Motdepasse1" })), false);
  assert.equal(isSectionComplete("security", baseState({ password: "", confirmPassword: "" })), false);
});

test("review is never complete from field state alone", () => {
  // It declares no required fields, so there is nothing for it to complete.
  // Treating it as complete put a done checkmark on "Recapitulatif" before
  // anything had been submitted.
  assert.equal(isSectionComplete("review", baseState()), false);
});

test("advancesImmediately is true only for sections with no optional fields", () => {
  const state = baseState();
  assert.equal(advancesImmediately("entityType", state.entityType), true);
  assert.equal(advancesImmediately("security", state.entityType), true);
  // phone2 / sector make these wait for the respondent to move on.
  assert.equal(advancesImmediately("respondent", state.entityType), false);
  assert.equal(advancesImmediately("location", state.entityType), false);
  assert.equal(advancesImmediately("review", state.entityType), false);
});

test("advancesImmediately reads entityInfo from the chosen type's field set", () => {
  // Every type declared today has at least one optional field, so entityInfo
  // waits for the respondent in all of them.
  for (const type of [
    "enterprise",
    "cooperative",
    "ctd",
    "ong",
    "administration",
    "projectProgram",
    "vocationalTraining",
  ] as const) {
    assert.equal(
      advancesImmediately("entityInfo", type),
      false,
      `${type} has optional fields, so entityInfo must not advance by itself`
    );
  }
  // With no type picked there is no field set to judge, so it waits.
  assert.equal(advancesImmediately("entityInfo", null), false);
});

// ── Drift guard between the strength score and the rule tips ──────────────
// passwordRuleChecks restates the predicates passwordStrength scores with. If
// one is edited without the other, the security section would tick a rule the
// score does not credit (or vice versa), so the two are pinned together here.
test("passwordRuleChecks agrees with the weights passwordStrength applies", () => {
  // Each case: a password meeting exactly one rule beyond length, and the
  // score passwordStrength must therefore produce.
  assert.deepEqual(passwordRuleChecks("abcdefgh"), {
    length: true,
    uppercase: false,
    digit: false,
    special: false,
  });
  assert.equal(passwordStrength("abcdefgh"), 0.25);

  assert.deepEqual(passwordRuleChecks("Abcdefgh"), {
    length: true,
    uppercase: true,
    digit: false,
    special: false,
  });
  assert.equal(passwordStrength("Abcdefgh"), 0.45);

  assert.deepEqual(passwordRuleChecks("Abcdefg1"), {
    length: true,
    uppercase: true,
    digit: true,
    special: false,
  });
  assert.equal(passwordStrength("Abcdefg1"), 0.65);

  // All four rules met, and 12+ chars, is the top of the scale.
  assert.deepEqual(passwordRuleChecks("Abcdefg1!xyz"), {
    length: true,
    uppercase: true,
    digit: true,
    special: true,
  });
  assert.equal(passwordStrength("Abcdefg1!xyz"), 1);

  // Length is only one of five weights, so a short password can clear the 0.35
  // strength floor on the other rules alone -- "Ab1!" scores 0.6. That is why
  // isSectionComplete tests length separately instead of trusting the score,
  // and this is the case that would regress if it ever stopped doing so.
  const short = "Ab1!";
  assert.equal(passwordRuleChecks(short).length, false);
  assert.ok(passwordStrength(short) > PASSWORD_MIN_STRENGTH);
  assert.equal(
    isSectionComplete("security", baseState({ password: short, confirmPassword: short })),
    false
  );
});
