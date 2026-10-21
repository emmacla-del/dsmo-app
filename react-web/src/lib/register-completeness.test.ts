import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PASSWORD_MIN_STRENGTH,
  isPlausibleEmail,
  isSectionComplete,
  type RegState,
  type SubdivisionsStatus,
} from "@/lib/register-completeness";
import { passwordRuleChecks, passwordStrength } from "@/lib/password-strength";
import { ENTITY_CONFIGS } from "@/lib/register-constants";

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
      functionOther: "",
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
      activitySector: "Tertiaire/ Tertiary",
      branchId: "b1",
      address: "Yaoundé, Centre",
      phone: "655000000",
    },
    regionId: "r1",
    departmentId: "d1",
    subdivisionId: "s1",
    subdivisionsStatus: "ready",
    area: "URBAN",
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

test("Autre requires the typed job, and a named function does not", () => {
  const autre = baseState();
  autre.respondent = { ...autre.respondent, function: "Autre", functionOther: "" };
  assert.equal(isSectionComplete("respondent", autre), false);
  autre.respondent = { ...autre.respondent, functionOther: "Comptable" };
  assert.equal(isSectionComplete("respondent", autre), true);
  const named = baseState();
  named.respondent = { ...named.respondent, function: "Gérant", functionOther: "" };
  assert.equal(isSectionComplete("respondent", named), true);
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
  // branch, poBox, socialCapital... are all optional for enterprise
  assert.equal(isSectionComplete("entityInfo", state), true);
  assert.equal(
    isSectionComplete("entityInfo", { ...state, entityData: { ...state.entityData, poBox: "" } }),
    true
  );
});

test("entityInfo section requires the CNPS number for enterprise", () => {
  const state = baseState();
  assert.equal(
    isSectionComplete("entityInfo", { ...state, entityData: { ...state.entityData, cnpsNumber: "" } }),
    false
  );
});

test("entityInfo section does not block on a required field whose gate is closed", () => {
  // vocationalTraining: nonFunctionalReason is required but only visible while
  // functionalStatus === "Non-fonctionnelle" (the stored value, which is the
  // French wording -- see FUNCTIONAL_STATUS_OPTIONS).
  const vtData = (): Record<string, string> => ({
    centerName: "CFP Exemple",
    taxNumber: "P000000000000",
    cnpsNumber: "0000000000",
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

test("the organisation section needs the sector and the branch, VT excepted", () => {
  const enterprise = {
    companyName: "SARL Exemple",
    legalStatus: "SARL",
    taxNumber: "P000000000000",
    cnpsNumber: "123",
    mainActivity: "Commerce",
    address: "Yaounde",
    phone: "655000000",
  };
  assert.equal(isSectionComplete("entityInfo", baseState({ entityData: enterprise })), false);
  assert.equal(
    isSectionComplete(
      "entityInfo",
      baseState({ entityData: { ...enterprise, activitySector: "Tertiaire/ Tertiary" } })
    ),
    false
  );
  assert.equal(
    isSectionComplete(
      "entityInfo",
      baseState({
        entityData: { ...enterprise, activitySector: "Tertiaire/ Tertiary", branchId: "b1" },
      })
    ),
    true
  );
  assert.equal(
    ENTITY_CONFIGS.vocationalTraining.fields.some(
      (f) => f.key === "activitySector" || f.key === "branchId"
    ),
    false
  );
});

test("no selected subdivision leaves the section unfinished, whatever the list status", () => {
  // "empty" included: the server requires an arrondissement, so a department
  // with none cannot complete the registration here (the row says so).
  const cases: [SubdivisionsStatus, boolean][] = [
    ["idle", false],
    ["loading", false],
    ["error", false],
    ["empty", false],
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

test("a malformed email or phone keeps the respondent section unfinished", () => {
  const withRespondent = (patch: Partial<RegState["respondent"]>) => {
    const state = baseState();
    return baseState({ respondent: { ...state.respondent, ...patch } });
  };
  assert.equal(isSectionComplete("respondent", withRespondent({ email: "audit@example" })), false);
  assert.equal(isSectionComplete("respondent", withRespondent({ email: "a b@x.cm" })), false);
  assert.equal(isSectionComplete("respondent", withRespondent({ phone1: "123" })), false);
  // The optional phone only gates when it is given and wrong.
  assert.equal(isSectionComplete("respondent", withRespondent({ phone2: "99" })), false);
  assert.equal(isSectionComplete("respondent", withRespondent({ phone2: "677123456" })), true);
});

test("a malformed phone keeps the organisation section unfinished", () => {
  const state = baseState();
  assert.equal(
    isSectionComplete("entityInfo", baseState({ entityData: { ...state.entityData, phone: "99" } })),
    false
  );
});

test("isPlausibleEmail accepts ordinary addresses only", () => {
  assert.equal(isPlausibleEmail("contact@organisation.cm"), true);
  assert.equal(isPlausibleEmail(" contact@organisation.cm "), true);
  assert.equal(isPlausibleEmail("contact@organisation"), false);
  assert.equal(isPlausibleEmail("contact.organisation.cm"), false);
});
