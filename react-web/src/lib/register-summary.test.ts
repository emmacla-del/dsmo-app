import assert from "node:assert/strict";
import { test } from "node:test";

import { RESPONDENT_FUNCTION_OPTIONS } from "@/lib/register-options";
import {
  SECTION_SUMMARY_MAX_VALUES,
  sectionSummary,
  summaryRows,
  type SummaryState,
} from "@/lib/register-summary";

// The label resolver is injected, so tests read the key back and never depend
// on the message catalogue's wording. The LOCALE is explicit for the other
// half of the strings: field names, option answers and the entity type's own
// title are {fr, en} data (see register-i18n.ts), not catalogue keys.
const t = (key: string) => key;
const LOCALE = "fr" as const;

function baseState(overrides: Partial<SummaryState> = {}): SummaryState {
  return {
    entityType: "enterprise",
    respondent: {
      firstName: "Emmanuel",
      lastName: "Biya",
      function: "Directeur des Ressources Humaines",
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
      address: "Yaounde, Centre",
      phone: "655000000",
    },
    regionId: "r1",
    departmentId: "d1",
    subdivisionId: "s1",
    subdivisionsStatus: "ready",
    area: "Urbain",
    sectorId: "sec1",
    password: "Motdepasse1!",
    confirmPassword: "Motdepasse1!",
    regionName: "Centre",
    departmentName: "Mfoundi",
    subdivisionName: "Yaounde I",
    sectorName: "Commerce",
    ...overrides,
  };
}

// ── per step ─────────────────────────────────────────────────────────────
test("entityType summarises to the selected type's title", () => {
  const rows = summaryRows("entityType", baseState(), t, LOCALE);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, "registerPage.summaryEntityTypeLabel");
  assert.equal(rows[0].value, "Entreprise");
});

test("entityType yields no rows before a type is picked", () => {
  assert.deepEqual(summaryRows("entityType", baseState({ entityType: null }), t, LOCALE), []);
});

test("respondent joins the first and last name into one row", () => {
  const rows = summaryRows("respondent", baseState(), t, LOCALE);
  assert.equal(rows[0].label, "registerPage.summaryFullNameLabel");
  assert.equal(rows[0].value, "Emmanuel Biya");
});

test("respondent omits the optional second phone when unanswered", () => {
  const without = summaryRows("respondent", baseState(), t, LOCALE);
  assert.equal(
    without.some((r) => r.label === "registerPage.phone2Label"),
    false
  );

  const state = baseState();
  const withPhone2 = summaryRows(
    "respondent",
    { ...state, respondent: { ...state.respondent, phone2: "233000000" } },
    t,
    LOCALE
  );
  assert.equal(
    withPhone2.some((r) => r.label === "registerPage.phone2Label" && r.value === "233000000"),
    true
  );
});

test("respondent shows the function's option label, in the active locale", () => {
  const state = baseState();
  const stored = RESPONDENT_FUNCTION_OPTIONS[0].value;
  const withFunction = { ...state, respondent: { ...state.respondent, function: stored } };

  const fr = summaryRows("respondent", withFunction, t, "fr").find(
    (r) => r.label === "registerPage.functionLabel"
  );
  assert.equal(fr?.value, RESPONDENT_FUNCTION_OPTIONS[0].label.fr);

  // The English half is what proves the lookup actually happens: the FRENCH
  // label of every respondent function is identical to its stored `value`
  // (the wire format is French), so a French-only assertion here would pass
  // just as well if optionLabel returned the raw value.
  const en = summaryRows("respondent", withFunction, t, "en").find(
    (r) => r.label === "registerPage.functionLabel"
  );
  assert.equal(en?.value, RESPONDENT_FUNCTION_OPTIONS[0].label.en);
  assert.notEqual(en?.value, stored);
});

test("a select answer is resolved in whichever locale is asked for", () => {
  // promoterSex is the clearest case: the wire value is "Masculin" and
  // NEITHER label is that -- fr says "Homme", en says "Male".
  const state = baseState({
    entityType: "vocationalTraining",
    entityData: { centerName: "CFP Exemple", promoterSex: "Masculin" },
  });
  const frRow = summaryRows("entityInfo", state, t, "fr").find(
    (r) => r.label === "Promoteur — Sexe"
  );
  assert.equal(frRow?.value, "Homme");

  const enRow = summaryRows("entityInfo", state, t, "en").find(
    (r) => r.label === "Promoter — sex"
  );
  assert.equal(enRow?.value, "Male");
});

test("no summary label carries both languages at once", () => {
  // The review card is the last place the old "Français/ English" strings
  // would have survived unnoticed.
  const state = baseState({
    entityType: "vocationalTraining",
    entityData: {
      centerName: "CFP Exemple",
      functionalStatus: "Non-fonctionnelle",
      nonFunctionalReason: "Autres",
      nonFunctionalReasonOther: "Autre",
      promoterSex: "Masculin",
    },
  });
  for (const locale of ["fr", "en"] as const) {
    for (const step of ["entityType", "respondent", "entityInfo", "location"] as const) {
      for (const row of summaryRows(step, state, t, locale)) {
        assert.ok(
          !row.label.includes("/ "),
          `${locale} ${step}: "${row.label}" still carries both languages`
        );
      }
    }
  }
});

test("an unrecognised stored value falls back to itself rather than vanishing", () => {
  // A value written by an older build must still be shown on the review
  // card; silently dropping it would hide data the respondent entered.
  const state = baseState();
  const rows = summaryRows(
    "respondent",
    { ...state, respondent: { ...state.respondent, function: "Fonction retiree" } },
    t,
    LOCALE
  );
  const fn = rows.find((r) => r.label === "registerPage.functionLabel");
  assert.equal(fn?.value, "Fonction retiree");
});

test("entityInfo leads with the type and then the answered fields", () => {
  const rows = summaryRows("entityInfo", baseState(), t, LOCALE);
  assert.equal(rows[0].label, "registerPage.summaryEntityTypeLabel");
  const labels = rows.map((r) => r.label);
  // Field labels are the questionnaire's own {fr, en} strings, resolved
  // against LOCALE -- not catalogue keys.
  assert.ok(labels.includes("Raison sociale"));
  assert.ok(labels.includes("N° contribuable (NIU)"));
});

test("entityInfo skips fields with no answer", () => {
  const rows = summaryRows("entityInfo", baseState(), t, LOCALE);
  // cnpsNumber, poBox, socialCabital... are declared but unanswered here.
  assert.equal(
    rows.some((r) => r.label === "N° CNPS"),
    false
  );
});

test("entityInfo resolves a select answer to its option label", () => {
  const state = baseState({
    entityType: "vocationalTraining",
    entityData: { centerName: "CFP Exemple", functionalStatus: "Non-fonctionnelle" },
  });
  const rows = summaryRows("entityInfo", state, t, LOCALE);
  const status = rows.find((r) => r.label === "Situation du centre");
  assert.ok(status);
  assert.equal(status.value, "Non-fonctionnelle");
});

test("entityInfo drops a field whose gate has closed even if a value remains", () => {
  const open = baseState({
    entityType: "vocationalTraining",
    entityData: {
      centerName: "CFP Exemple",
      functionalStatus: "Non-fonctionnelle",
      nonFunctionalReason: "Manque d'apprenants",
    },
  });
  assert.ok(
    summaryRows("entityInfo", open, t, LOCALE).some(
      (r) => r.label === "Raison"
    )
  );

  // Correcting the status back to functional must take the stranded reason
  // out of the summary, exactly as it is taken out of the payload.
  const closed = baseState({
    entityType: "vocationalTraining",
    entityData: {
      centerName: "CFP Exemple",
      functionalStatus: "Fonctionnelle",
      nonFunctionalReason: "Manque d'apprenants",
    },
  });
  assert.equal(
    summaryRows("entityInfo", closed, t, LOCALE).some(
      (r) => r.label === "Raison"
    ),
    false
  );
});

test("location uses the administrative names and the area's option label", () => {
  const rows = summaryRows("location", baseState(), t, LOCALE);
  assert.deepEqual(
    rows.map((r) => [r.label, r.value]),
    [
      ["registerPage.regionLabel", "Centre"],
      ["registerPage.departmentLabel", "Mfoundi"],
      ["registerPage.subdivisionLabel", "Yaounde I"],
      ["registerPage.areaLabel", "Urbain"],
      ["registerPage.sectorLabel", "Commerce"],
    ]
  );
});

test("location omits an unselected subdivision and an unselected sector", () => {
  const rows = summaryRows(
    "location",
    baseState({ subdivisionName: "", sectorName: "" }),
    t,
    LOCALE
  );
  const labels = rows.map((r) => r.label);
  assert.equal(labels.includes("registerPage.subdivisionLabel"), false);
  assert.equal(labels.includes("registerPage.sectorLabel"), false);
  assert.equal(labels.includes("registerPage.regionLabel"), true);
});

test("security summarises the login and never the password", () => {
  const rows = summaryRows("security", baseState(), t, LOCALE);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value, "contact@organisation.cm");
  const serialized = JSON.stringify(rows);
  assert.equal(serialized.includes("Motdepasse1!"), false);
});

test("review has no rows of its own", () => {
  assert.deepEqual(summaryRows("review", baseState(), t, LOCALE), []);
});

// ── the collapsed one-liner ──────────────────────────────────────────────
test("sectionSummary joins the first few values from the same rows", () => {
  const rows = summaryRows("respondent", baseState(), t, LOCALE);
  assert.equal(
    sectionSummary(rows),
    "Emmanuel Biya, Directeur des Ressources Humaines, contact@organisation.cm"
  );
});

test("sectionSummary stops at the cap", () => {
  const rows = summaryRows("location", baseState(), t, LOCALE);
  assert.equal(rows.length, 5);
  assert.equal(sectionSummary(rows).split(", ").length, SECTION_SUMMARY_MAX_VALUES);
  assert.equal(sectionSummary(rows, 2), "Centre, Mfoundi");
});

test("sectionSummary skips the optional fields summaryRows left out", () => {
  // phone2 absent, so the three values are name, function, email -- the
  // collapsed line never shows a gap or a stray separator.
  const rows = summaryRows("respondent", baseState(), t, LOCALE);
  const line = sectionSummary(rows);
  assert.equal(line.includes(", ,"), false);
  assert.equal(line.endsWith(","), false);
});

test("sectionSummary of an empty section is an empty string", () => {
  assert.equal(sectionSummary(summaryRows("review", baseState(), t, LOCALE)), "");
  assert.equal(sectionSummary([]), "");
});

test("the collapsed line is derived from the review rows, not a second source", () => {
  // The guarantee the single-source rule exists for: whatever the review card
  // shows first is what the collapsed line shows.
  for (const step of ["respondent", "entityInfo", "location", "security"] as const) {
    const rows = summaryRows(step, baseState(), t, LOCALE);
    const expected = rows
      .map((r) => r.value)
      .filter(Boolean)
      .slice(0, SECTION_SUMMARY_MAX_VALUES)
      .join(", ");
    assert.equal(sectionSummary(rows), expected, `mismatch for ${step}`);
  }
});
