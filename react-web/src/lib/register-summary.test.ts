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
// on the message catalogue's wording.
const t = (key: string) => key;

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
  const rows = summaryRows("entityType", baseState(), t);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, "registerPage.summaryEntityTypeLabel");
  assert.equal(rows[0].value, "Entreprise/ Company");
});

test("entityType yields no rows before a type is picked", () => {
  assert.deepEqual(summaryRows("entityType", baseState({ entityType: null }), t), []);
});

test("respondent joins the first and last name into one row", () => {
  const rows = summaryRows("respondent", baseState(), t);
  assert.equal(rows[0].label, "registerPage.summaryFullNameLabel");
  assert.equal(rows[0].value, "Emmanuel Biya");
});

test("respondent omits the optional second phone when unanswered", () => {
  const without = summaryRows("respondent", baseState(), t);
  assert.equal(
    without.some((r) => r.label === "registerPage.phone2Label"),
    false
  );

  const state = baseState();
  const withPhone2 = summaryRows(
    "respondent",
    { ...state, respondent: { ...state.respondent, phone2: "233000000" } },
    t
  );
  assert.equal(
    withPhone2.some((r) => r.label === "registerPage.phone2Label" && r.value === "233000000"),
    true
  );
});

test("respondent shows the function's option label, not its stored value", () => {
  const state = baseState();
  const stored = RESPONDENT_FUNCTION_OPTIONS[0].value;
  const rows = summaryRows(
    "respondent",
    { ...state, respondent: { ...state.respondent, function: stored } },
    t
  );
  const fn = rows.find((r) => r.label === "registerPage.functionLabel");
  assert.ok(fn);
  assert.equal(fn.value, RESPONDENT_FUNCTION_OPTIONS[0].label);
  assert.notEqual(fn.value, stored);
});

test("an unrecognised stored value falls back to itself rather than vanishing", () => {
  // A value written by an older build must still be shown on the review
  // card; silently dropping it would hide data the respondent entered.
  const state = baseState();
  const rows = summaryRows(
    "respondent",
    { ...state, respondent: { ...state.respondent, function: "Fonction retiree" } },
    t
  );
  const fn = rows.find((r) => r.label === "registerPage.functionLabel");
  assert.equal(fn?.value, "Fonction retiree");
});

test("entityInfo leads with the type and then the answered fields", () => {
  const rows = summaryRows("entityInfo", baseState(), t);
  assert.equal(rows[0].label, "registerPage.summaryEntityTypeLabel");
  const labels = rows.map((r) => r.label);
  // Field labels are the questionnaire's own bilingual strings, not keys.
  assert.ok(labels.includes("Raison sociale/ Company name"));
  assert.ok(labels.includes("N° Contribuable (NIU)/ Taxpayer No."));
});

test("entityInfo skips fields with no answer", () => {
  const rows = summaryRows("entityInfo", baseState(), t);
  // cnpsNumber, poBox, socialCabital... are declared but unanswered here.
  assert.equal(
    rows.some((r) => r.label === "N° d'affiliation CNPS/ CNPS affiliation No."),
    false
  );
});

test("entityInfo resolves a select answer to its option label", () => {
  const state = baseState({
    entityType: "vocationalTraining",
    entityData: { centerName: "CFP Exemple", functionalStatus: "Non-fonctionnelle" },
  });
  const rows = summaryRows("entityInfo", state, t);
  const status = rows.find((r) => r.label === "Situation du Centre/ Status of the center");
  assert.ok(status);
  assert.equal(status.value, "Non-fonctionnelle/ Non-functional");
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
    summaryRows("entityInfo", open, t).some(
      (r) => r.label === "Raison (si non-fonctionnelle)/ Reason (if non-functional)"
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
    summaryRows("entityInfo", closed, t).some(
      (r) => r.label === "Raison (si non-fonctionnelle)/ Reason (if non-functional)"
    ),
    false
  );
});

test("location uses the administrative names and the area's option label", () => {
  const rows = summaryRows("location", baseState(), t);
  assert.deepEqual(
    rows.map((r) => [r.label, r.value]),
    [
      ["registerPage.regionLabel", "Centre"],
      ["registerPage.departmentLabel", "Mfoundi"],
      ["registerPage.subdivisionLabel", "Yaounde I"],
      ["registerPage.areaLabel", "Urbain/ Urban"],
      ["registerPage.sectorLabel", "Commerce"],
    ]
  );
});

test("location omits an unselected subdivision and an unselected sector", () => {
  const rows = summaryRows(
    "location",
    baseState({ subdivisionName: "", sectorName: "" }),
    t
  );
  const labels = rows.map((r) => r.label);
  assert.equal(labels.includes("registerPage.subdivisionLabel"), false);
  assert.equal(labels.includes("registerPage.sectorLabel"), false);
  assert.equal(labels.includes("registerPage.regionLabel"), true);
});

test("security summarises the login and never the password", () => {
  const rows = summaryRows("security", baseState(), t);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value, "contact@organisation.cm");
  const serialized = JSON.stringify(rows);
  assert.equal(serialized.includes("Motdepasse1!"), false);
});

test("review has no rows of its own", () => {
  assert.deepEqual(summaryRows("review", baseState(), t), []);
});

// ── the collapsed one-liner ──────────────────────────────────────────────
test("sectionSummary joins the first few values from the same rows", () => {
  const rows = summaryRows("respondent", baseState(), t);
  assert.equal(
    sectionSummary(rows),
    "Emmanuel Biya, Directeur des Ressources Humaines/ Human Resources Director, contact@organisation.cm"
  );
});

test("sectionSummary stops at the cap", () => {
  const rows = summaryRows("location", baseState(), t);
  assert.equal(rows.length, 5);
  assert.equal(sectionSummary(rows).split(", ").length, SECTION_SUMMARY_MAX_VALUES);
  assert.equal(sectionSummary(rows, 2), "Centre, Mfoundi");
});

test("sectionSummary skips the optional fields summaryRows left out", () => {
  // phone2 absent, so the three values are name, function, email -- the
  // collapsed line never shows a gap or a stray separator.
  const rows = summaryRows("respondent", baseState(), t);
  const line = sectionSummary(rows);
  assert.equal(line.includes(", ,"), false);
  assert.equal(line.endsWith(","), false);
});

test("sectionSummary of an empty section is an empty string", () => {
  assert.equal(sectionSummary(summaryRows("review", baseState(), t)), "");
  assert.equal(sectionSummary([]), "");
});

test("the collapsed line is derived from the review rows, not a second source", () => {
  // The guarantee the single-source rule exists for: whatever the review card
  // shows first is what the collapsed line shows.
  for (const step of ["respondent", "entityInfo", "location", "security"] as const) {
    const rows = summaryRows(step, baseState(), t);
    const expected = rows
      .map((r) => r.value)
      .filter(Boolean)
      .slice(0, SECTION_SUMMARY_MAX_VALUES)
      .join(", ");
    assert.equal(sectionSummary(rows), expected, `mismatch for ${step}`);
  }
});
