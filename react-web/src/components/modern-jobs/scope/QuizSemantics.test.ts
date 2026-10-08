import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FormData, OnefopEntity, OnefopSchema } from "@/lib/onefop-schema";
import { validateEntityData } from "@/lib/onefop-validation";
import { buildSubmitPayload, prepareSubmissionData } from "@/lib/onefop-submission";
import {
  buildEntityTableIndex,
  incompleteQuizQuestions,
  tableNumericCellKeys,
  getZeroedTablesList,
} from "./QuizSemantics";
import { cleanHiddenDependentFields } from "@/lib/onefop-schema";
import { resolveTableStatusFieldId } from "../conditional/gateway-catalog";
import { DEFAULT_SCOPE, type ScopeState } from "./ScopeTypes";

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;
const entity = (name: string): OnefopEntity => schema.entities[name];

const ALL_NO: ScopeState = {
  ...DEFAULT_SCOPE,
  applications: false,
  recruit: false,
  primo_seekers: false,
  primo_workers: false,
  departures: false,
  interns: false,
  skills_needs: false,
  training_needs: false,
};

/** Recruitment yes with every follow-up answered; everything else No. */
const RECRUIT_YES: ScopeState = {
  ...ALL_NO,
  recruit: true,
  recruit_types: ["permanent", "temporaire"],
  recruit_csp: ["cadres", "maitrise", "execution"],
  recruit_age: ["15_24", "25_34", "35_plus"],
  recruit_diploma: ["bac_gce_al"],
  disability: true,
  vulnerable: true,
};

const withScope = (scope: ScopeState, extra: FormData = {}): FormData => ({ _scopeConfig: scope, ...extra });

function tableField(e: OnefopEntity, code: string) {
  const field = buildEntityTableIndex(e).get(code);
  assert.ok(field, `${e.entityType} has no table ${code}`);
  return field;
}

/** Every cell id the canonical schema defines for an entity (tables' matrices). */
function schemaCellIds(e: OnefopEntity): Set<string> {
  const ids = new Set<string>();
  for (const sec of e.sections) {
    for (const f of sec.fields) for (const row of f.table?.matrix ?? []) for (const id of row) ids.add(id);
  }
  return ids;
}

function quizIssues(e: OnefopEntity, data: FormData) {
  return validateEntityData(e, data, "fr").filter((i) => i.fieldId === "_scopeConfig");
}

// ── Test 1 / 4 (unanswered quiz) ───────────────────────────────────────────
test("1. an unanswered quiz blocks final submission and derives nothing", () => {
  const e = entity("enterprise");
  assert.ok(quizIssues(e, {}).length > 0, "missing quiz must produce a validation issue");

  const partial = withScope({ ...ALL_NO, recruit: null });
  assert.deepEqual(incompleteQuizQuestions(e, partial), ["recruitment"]);
  const out = prepareSubmissionData(e, partial);
  assert.equal(out.S22Q01_RESPONSE_STATUS, undefined, "unanswered recruitment must not become NONE");
  assert.equal(out.s22q01_cadres_male_15_24, undefined, "unanswered recruitment must not become 0");
  // Answered questions are still derived.
  assert.equal(out.S21Q01_RESPONSE_STATUS, "NONE");
});

// ── Test 2 (quiz No) ───────────────────────────────────────────────────────
test("2. quiz No → NONE and numeric 0 in every applicable cell of the table", () => {
  for (const name of ["enterprise", "cooperative", "ctd", "ong", "administration"]) {
    const e = entity(name);
    const data = withScope(ALL_NO);
    assert.deepEqual(quizIssues(e, data), [], `${name}: complete quiz must not block`);
    const out = prepareSubmissionData(e, data);
    const cells = schemaCellIds(e);

    for (const [code, field] of buildEntityTableIndex(e)) {
      if (code !== field.id.toUpperCase()) continue;
      if (!/^S(21|22|23|3|4)Q/.test(code)) continue;
      const statusKey = `${(field.paperCode ?? field.id).toUpperCase()}_RESPONSE_STATUS`;
      // Administration's S21Q01 census is always REPORTED (not quiz-governed).
      if (name === "administration" && statusKey === "S21Q01_RESPONSE_STATUS") {
        assert.equal(out[statusKey], "REPORTED", `${name} ${code} census always REPORTED`);
        continue;
      }
      assert.equal(out[statusKey], "NONE", `${name} ${code} status`);
      const keys = tableNumericCellKeys(field, data, false);
      assert.ok(keys.length > 0, `${name} ${code} has applicable cells`);
      // Keys come from React's own table definition — the keys the respondent's
      // grid writes (they include computed subtotals and list rows the schema
      // matrix does not enumerate). Zeros must stay inside this table.
      const prefix = `${(field.table?.id ?? field.id).toLowerCase()}_`;
      for (const k of keys) {
        assert.equal(out[k], 0, `${name} ${code} ${k} must be numeric 0`);
        assert.ok(k.toLowerCase().startsWith(prefix), `${name} ${code}: ${k} is outside the table`);
      }
      // The canonical schema's own cells for the table are zero as well.
      const unfilled = (field.table?.matrix ?? []).flat().filter((id) => cells.has(id) && out[id] !== 0);
      assert.deepEqual(unfilled, [], `${name} ${code}: schema cells not zero-filled`);
    }
  }
  const out = prepareSubmissionData(entity("enterprise"), withScope(ALL_NO));
  assert.equal(out.s22q01_cadres_male_15_24, 0);
  assert.equal(out.s22q01_total_total_total, 0);
});

// ── Test 3 / 9 (Yes with values, explicit zero) ────────────────────────────
test("3/9. quiz Yes → REPORTED, respondent values and explicit zeros preserved", () => {
  const e = entity("enterprise");
  const out = prepareSubmissionData(
    e,
    withScope(RECRUIT_YES, { s22q01_cadres_male_15_24: 4, s22q01_cadres_female_15_24: 0 }),
  );
  assert.equal(out.S22Q01_RESPONSE_STATUS, "REPORTED");
  assert.equal(out.s22q01_cadres_male_15_24, 4);
  assert.equal(out.s22q01_cadres_female_15_24, 0);
});

// ── Test 4 (Yes + empty table) ─────────────────────────────────────────────
test("4. quiz Yes + empty table stays REPORTED and incomplete — never NONE", () => {
  const e = entity("enterprise");
  const data = withScope(RECRUIT_YES, { S22Q01_RESPONSE_STATUS: "REPORTED" });
  const out = prepareSubmissionData(e, data);
  assert.equal(out.S22Q01_RESPONSE_STATUS, "REPORTED");
  assert.equal(out.s22q01_cadres_male_15_24, undefined, "selected cells are not manufactured");
  const tableIssues = validateEntityData(e, data, "fr").filter((i) => i.fieldId === "S22Q01");
  assert.ok(tableIssues.length > 0, "empty REPORTED table must block final submission");
});

// ── Test 5 (explicit NOT_APPLICABLE) ───────────────────────────────────────
test("5. an explicit NOT_APPLICABLE is kept and never zero-filled", () => {
  const e = entity("enterprise");
  const out = prepareSubmissionData(e, withScope(ALL_NO, { S22Q01_RESPONSE_STATUS: "NOT_APPLICABLE" }));
  assert.equal(out.S22Q01_RESPONSE_STATUS, "NOT_APPLICABLE");
  assert.equal(out.s22q01_cadres_male_15_24, undefined);
  // Other tables still follow the quiz.
  assert.equal(out.S22Q02_RESPONSE_STATUS, "NONE");
});

// ── Test 6 (structural absence) ────────────────────────────────────────────
test("6. a table absent from the entity gets no status and no zeros", () => {
  const e = entity("administration");
  assert.equal(buildEntityTableIndex(e).has("S22Q02"), false);
  const out = prepareSubmissionData(e, withScope(ALL_NO));
  assert.equal(out.S22Q02_RESPONSE_STATUS, undefined);
  assert.equal(Object.keys(out).some((k) => k.toLowerCase().startsWith("s22q02_")), false);
});

// ── Test 7 (follow-up No / unanswered) ─────────────────────────────────────
test("7. follow-up No → mapped table NONE + 0", () => {
  const e = entity("enterprise");
  const scope: ScopeState = {
    ...RECRUIT_YES,
    recruit_types: ["permanent"],
    disability: false,
    vulnerable: false,
    departures: true,
    departure_reasons: ["demission"],
  };
  const out = prepareSubmissionData(e, withScope(scope));
  assert.equal(out.S22Q01_RESPONSE_STATUS, "REPORTED");
  for (const code of ["S22Q02", "S22Q04", "S22Q05", "S3Q02", "S3Q03"]) {
    assert.equal(out[`${code}_RESPONSE_STATUS`], "NONE", `${code} follows the follow-up answer`);
  }
  for (const k of tableNumericCellKeys(tableField(e, "S22Q02"), withScope(scope), false)) assert.equal(out[k], 0);
  for (const k of tableNumericCellKeys(tableField(e, "S3Q02"), withScope(scope), false)) assert.equal(out[k], 0);
  assert.equal(out.S3Q01_RESPONSE_STATUS, "REPORTED");
});

test("7b. an unanswered follow-up blocks submission and is not read as No", () => {
  const e = entity("enterprise");
  const cases: Partial<ScopeState>[] = [
    { recruit_types: [] },
    { disability: null },
    { vulnerable: null },
    { recruit_diploma: [] },
  ];
  for (const patch of cases) {
    const data = withScope({ ...RECRUIT_YES, ...patch });
    assert.ok(quizIssues(e, data).length > 0, `${JSON.stringify(patch)} must block`);
    const out = prepareSubmissionData(e, data);
    for (const code of ["S22Q01", "S22Q02", "S22Q03", "S22Q04", "S22Q05"]) {
      assert.notEqual(out[`${code}_RESPONSE_STATUS`], "NONE", `${JSON.stringify(patch)}: ${code} must not become NONE`);
    }
  }
  const departures = withScope({ ...ALL_NO, departures: true, departure_reasons: ["licenciement"], dismissal_technical: null });
  assert.deepEqual(incompleteQuizQuestions(e, departures), ["departures"]);
});

// ── Test 9 (dimension-level zeros) ─────────────────────────────────────────
test("9. Yes table: de-selected CSP / age categories become 0, reported cells untouched", () => {
  const e = entity("enterprise");
  const scope: ScopeState = { ...RECRUIT_YES, recruit_csp: ["cadres"], recruit_age: ["25_34"] };
  const out = prepareSubmissionData(e, withScope(scope, { s22q01_cadres_male_25_34: 3 }));
  assert.equal(out.S22Q01_RESPONSE_STATUS, "REPORTED");
  assert.equal(out.s22q01_cadres_male_25_34, 3, "reported cell kept");
  assert.equal(out.s22q01_cadres_female_25_34, undefined, "selected but blank cell is not filled — validation handles it");
  assert.equal(out.s22q01_cadres_male_15_24, 0, "de-selected age band");
  assert.equal(out.s22q01_workers_male_25_34, 0, "de-selected CSP");
  assert.equal(out.s22q01_foremen_female_35_plus, 0);
});

// ── Test 10 (no form-state mutation; No → Yes) ─────────────────────────────
test("10. derivation never mutates form state, so No → Yes leaves no stale zeros", () => {
  const e = entity("enterprise");
  const form = withScope(ALL_NO);
  const snapshot = JSON.stringify(form);
  prepareSubmissionData(e, form);
  assert.equal(JSON.stringify(form), snapshot, "working form data must not change");

  const switched = { ...form, _scopeConfig: RECRUIT_YES };
  const out = prepareSubmissionData(e, switched);
  assert.equal(out.S22Q01_RESPONSE_STATUS, "REPORTED");
  assert.equal(out.s22q01_cadres_male_15_24, undefined, "no zero inherited from the earlier No");
});

// ── Test 12 (exact POST payload) ───────────────────────────────────────────
test("12. the exact submit payload carries statuses and numeric zeros; drafts share the same structure", () => {
  const e = entity("cooperative");
  const form = withScope(ALL_NO, { S0Q01: "Répondant" });
  const snapshot = JSON.stringify(form);

  const payload = buildSubmitPayload("COOPERATIVE", "2026-T3", form, false, e, "form-1");
  const body = JSON.parse(JSON.stringify(payload));
  assert.equal(body.entityType, "COOPERATIVE");
  assert.equal(body.isDraft, false);
  assert.equal(body.data.S22Q01_RESPONSE_STATUS, "NONE");
  assert.equal(body.data.s22q01_cadres_male_15_24, 0);
  assert.equal(typeof body.data.s22q01_cadres_male_15_24, "number");
  assert.equal(body.data.S22Q05_RESPONSE_STATUS, "NONE");
  assert.equal(body.data.S0Q01, "Répondant");

  // P3: drafts also have quiz semantics applied so they share the same
  // structure as final submissions — phantom cells are cleared at the
  // backend regardless of draft vs. final path.
  const draft = buildSubmitPayload("COOPERATIVE", "2026-T3", form, true, e, "form-2");
  assert.equal(draft.isDraft, true);
  assert.equal(draft.data.S22Q01_RESPONSE_STATUS, "NONE", "draft also carries quiz semantics");
  assert.equal(draft.data.s22q01_cadres_male_15_24, 0, "draft zeros are numeric");
  assert.equal(typeof draft.data.s22q01_cadres_male_15_24, "number");
  assert.equal(draft.data.S0Q01, "Répondant", "respondent values preserved in draft");

  // Neither call must mutate the working form state.
  assert.equal(JSON.stringify(form), snapshot, "working form data must not change");
});

// ── Deferred entities ──────────────────────────────────────────────────────
test("Vocational Training: all tables REPORTED, scope meta-keys stripped", () => {
  const e = entity("vocationalTraining");
  const data = withScope(ALL_NO);
  const out = prepareSubmissionData(e, data);
  // Scope meta-key must be stripped even though VT has no quiz.
  assert.equal(out._scopeConfig, undefined, "scope config stripped for VT");
  // No quiz issues with empty data.
  assert.deepEqual(quizIssues(e, {}), []);
  // Every table the VT schema defines must carry REPORTED status.
  for (const [code, field] of buildEntityTableIndex(e)) {
    if (code !== field.id.toUpperCase()) continue;
    const statusKey = resolveTableStatusFieldId(field, data);
    assert.equal(out[statusKey], "REPORTED", `VT ${code} should be REPORTED`);
  }
});

test("PP without a completed quiz config — scope stripped, other keys preserved, validation will block submit", () => {
  const e = entity("projectProgram");
  // ALL_NO has no projectProgram key — scope is stripped, nothing else changes.
  const out1 = prepareSubmissionData(e, withScope(ALL_NO));
  assert.equal(out1._scopeConfig, undefined, "scope config stripped even when PP quiz absent");
  // No _scopeConfig at all → no-op.
  assert.deepEqual(prepareSubmissionData(e, {}), {});
  // completedAt absent → scope stripped, other keys preserved.
  const incomplete = { _scopeConfig: { projectProgram: { noOutcomes: false, outcomes: [] } }, S0Q01: "Test" };
  const out3 = prepareSubmissionData(e, incomplete);
  assert.equal(out3._scopeConfig, undefined, "scope config stripped when completedAt absent");
  assert.equal(out3.S0Q01, "Test", "other form keys preserved");
  // Fix #16: PP quiz incompleteness blocks final submit — confirmed by validation.
  assert.ok(quizIssues(e, {}).length > 0, "PP quiz must produce a validation issue when quiz absent");
});

test("PP: completed quiz — status keys written and NONE tables zeroed", () => {
  const e = entity("projectProgram");

  const ppConfig = {
    completedAt: "2026-09-29T00:00:00.000Z",
    noOutcomes: false,
    outcomes: ["employed"],
    hasPermanentStaff: true,
    hasTemporaryStaff: false,
    hasRecruitment: true,
    recruitmentTypes: ["permanent"],
  };
  const data: FormData = {
    _scopeConfig: { projectProgram: ppConfig },
    // Phantom cell that should be zeroed (S4Q02 declared NONE)
    pp_s4q02_cadres_male_15_24: 5,
    // Phantom outcome that should be zeroed (self_employed not selected)
    s3kpi_self_employed_current: 3,
  };

  const out = prepareSubmissionData(e, data);

  assert.equal(out.S4Q01_RESPONSE_STATUS, "REPORTED", "S4Q01 reported");
  assert.equal(out.PP_S4Q01_RESPONSE_STATUS, "REPORTED");
  assert.equal(out.S4Q02_RESPONSE_STATUS, "NONE", "S4Q02 none");
  assert.equal(out.PP_S4Q02_RESPONSE_STATUS, "NONE");
  assert.equal(out.S4Q03_RESPONSE_STATUS, "REPORTED", "S4Q03 reported (permanent recruited)");
  assert.equal(out.PP_S4Q03_RESPONSE_STATUS, "REPORTED");
  assert.equal(out.S4Q04_RESPONSE_STATUS, "NONE", "S4Q04 none (not selected)");
  assert.equal(out.PP_S4Q04_RESPONSE_STATUS, "NONE");
  assert.equal(out.S4Q05_RESPONSE_STATUS, "NONE");
  assert.equal(out.S4Q06_RESPONSE_STATUS, "NONE");

  // Phantom cell in a NONE table must be zeroed
  assert.equal(out.pp_s4q02_cadres_male_15_24, 0, "phantom NONE cell zeroed");
  // Unselected outcome must be zeroed
  assert.equal(out.s3kpi_self_employed_current, 0, "unselected outcome zeroed");
  // Selected outcome untouched (wasn't filled)
  assert.equal(out.s3kpi_employed_current, undefined);
});

test("PP: phantom cells in NONE table zeroed even when quiz was re-answered without re-committing", () => {
  const e = entity("projectProgram");
  // Respondent originally said hasPermanentStaff=true, filled cells, then changed
  // to false in the quiz UI but never clicked Validate again. The _scopeConfig
  // reflects the latest choice (false), but cells still hold stale values.
  const ppConfig = {
    completedAt: "2026-09-29T00:00:00.000Z",
    noOutcomes: true,
    outcomes: [],
    hasPermanentStaff: false,
    hasTemporaryStaff: false,
    hasRecruitment: false,
    recruitmentTypes: [],
  };
  const data: FormData = {
    _scopeConfig: { projectProgram: ppConfig },
    pp_s4q01_cadres_male_15_24: 12, // phantom — hasPermanentStaff is false
    pp_s4q01_cadres_total_total: 12,
    s3kpi_employed_current: 7,      // phantom — noOutcomes is true
  };

  const out = prepareSubmissionData(e, data);

  assert.equal(out.S4Q01_RESPONSE_STATUS, "NONE");
  assert.equal(out.pp_s4q01_cadres_male_15_24, 0, "stale census cell zeroed");
  assert.equal(out.pp_s4q01_cadres_total_total, 0, "stale census total zeroed");
  assert.equal(out.s3kpi_employed_current, 0, "stale outcome cell zeroed");
});

test("PP: form state not mutated by applyProjectProgramQuizSemantics", () => {
  const e = entity("projectProgram");
  const ppConfig = {
    completedAt: "2026-09-29T00:00:00.000Z",
    noOutcomes: true,
    outcomes: [],
    hasPermanentStaff: false,
    hasTemporaryStaff: false,
    hasRecruitment: false,
    recruitmentTypes: [],
  };
  const data: FormData = { _scopeConfig: { projectProgram: ppConfig }, pp_s4q01_cadres_male_15_24: 8 };
  const snapshot = JSON.stringify(data);
  prepareSubmissionData(e, data);
  assert.equal(JSON.stringify(data), snapshot, "working form data must not change");
});

test("no generic empty-table → NONE fallback remains", () => {
  const e = entity("enterprise");
  const out = prepareSubmissionData(e, {});
  assert.equal(Object.keys(out).some((k) => k.endsWith("_RESPONSE_STATUS")), false);
});

// ── Administration Section 2 (S21Q01–S21Q04, renumbered 2026-09-28) ───────
test("Administration: S21Q01 census is outside the quiz; S21Q02–S21Q04 follow recruitment", () => {
  const e = entity("administration");
  const index = buildEntityTableIndex(e);
  for (const gone of ["S22Q01", "S22Q04", "S22Q05", "S22Q05_OTHER"]) {
    assert.equal(index.has(gone), false, `Administration must no longer have ${gone}`);
  }
  // No "demandes d'emploi" question; CSP chips are not required for Administration.
  const answered: ScopeState = { ...ALL_NO, applications: null };
  assert.deepEqual(incompleteQuizQuestions(e, withScope(answered)), []);

  const out = prepareSubmissionData(e, withScope(answered));
  assert.equal(out.S21Q01_RESPONSE_STATUS, "REPORTED", "census is always REPORTED for a submitted Administration declaration");
  for (const code of ["S21Q02", "S21Q03", "S21Q04"]) {
    assert.equal(out[`${code}_RESPONSE_STATUS`], "NONE", `${code} follows recruitment No`);
  }
  assert.equal(out.s21q03_fonctionnaire_male, 0);
  assert.equal(out.s21q03_total_total, 0);
  assert.equal(out.s21q04_deplaces_internes_female, 0);
  // Status-less tables: no permanent/temporary keys are manufactured.
  assert.ok(!Object.keys(out).some((k) => /^s21q0[34]_.*_(permanent|temporary)_/.test(k)));
});

test("Administration: recruitment Yes with disability No → S21Q02 REPORTED, S21Q03 NONE, S21Q04 REPORTED", () => {
  const e = entity("administration");
  const scope: ScopeState = {
    ...ALL_NO,
    recruit: true,
    recruit_age: ["15_24", "25_34", "35_plus"],
    disability: false,
    vulnerable: true,
  };
  assert.deepEqual(incompleteQuizQuestions(e, withScope(scope)), []);
  const out = prepareSubmissionData(e, withScope(scope, { s21q02_fonctionnaire_male_15_24: 4, s21q04_refugies_male: 1 }));
  assert.equal(out.S21Q02_RESPONSE_STATUS, "REPORTED");
  assert.equal(out.S21Q03_RESPONSE_STATUS, "NONE");
  assert.equal(out.S21Q04_RESPONSE_STATUS, "REPORTED");
  assert.equal(out.s21q02_fonctionnaire_male_15_24, 4);
  assert.equal(out.s21q04_refugies_male, 1);
  assert.equal(out.s21q03_decisionnaire_female, 0);

  // A disability follow-up left unanswered blocks submission.
  assert.deepEqual(incompleteQuizQuestions(e, withScope({ ...scope, disability: null })), ["recruitment"]);
});

// ── D10: Certified Zero Transparency & D5: Visibility Invalidation ───────────
test("D10: getZeroedTablesList lists all tables certified to zero via scoping quiz", () => {
  const e = entity("enterprise");
  // With ALL_NO, all optional tables in Enterprise should be certified to zero (NONE)
  const zeroed = getZeroedTablesList(e, withScope(ALL_NO));
  assert.ok(zeroed.length > 0, "Expected zeroed tables for ALL_NO scope");
  // Every listed table must have tableId and title
  for (const item of zeroed) {
    assert.ok(item.tableId, "item must have tableId");
    assert.ok(item.title, "item must have title");
  }
  const tableIds = zeroed.map((z) => z.code);
  assert.ok(tableIds.includes("S22Q01"), "S22Q01 should be zeroed when recruit=false");
  assert.ok(tableIds.includes("S3Q01"), "S3Q01 should be zeroed when departures=false");

  // When all answers are Yes, recruitment tables should not be zeroed
  const zeroedYes = getZeroedTablesList(e, withScope(RECRUIT_YES));
  assert.equal(zeroedYes.some((z) => z.code === "S22Q01"), false, "S22Q01 should not be zeroed when recruit=true");

  // VT without quiz has 0 zeroed tables via quiz
  const vt = entity("vocationalTraining");
  assert.deepEqual(getZeroedTablesList(vt, {}), []);
});

test("D5: cleanHiddenDependentFields removes values and matrix cells of conditionally hidden fields", () => {
  const vt = entity("vocationalTraining");
  // VT2_2 has visibility rule dependent on VT2_1 === "Oui/ Yes"
  // VT3_2 depends on VT3_1 === "Oui/ Yes", and VT3_4 depends on VT3_3 which depends on VT3_1
  const rawWithHidden: FormData = {
    VT2_1: "Non/ No",
    VT2_2: "Some residual data",
    VT3_1: "Non/ No",
    VT3_2: "Child data",
    VT3_3: "Grandchild data",
    VT3_4: "Great-grandchild data",
    VT1_01: "CFP Yaounde",
  };

  const cleaned = cleanHiddenDependentFields(vt, rawWithHidden);
  assert.equal(cleaned.VT2_1, "Non/ No");
  assert.equal(cleaned.VT1_01, "CFP Yaounde");
  assert.equal(cleaned.VT2_2, undefined, "VT2_2 must be pruned when VT2_1 is 'Non/ No'");
  assert.equal(cleaned.VT3_2, undefined, "VT3_2 must be pruned when VT3_1 is 'Non/ No'");
  assert.equal(cleaned.VT3_3, undefined, "VT3_3 must be pruned when VT3_1 is 'Non/ No'");
  assert.equal(cleaned.VT3_4, undefined, "VT3_4 cascading dependency must be pruned");

  // When VT2_1 is "Oui/ Yes" (or "Oui"), VT2_2 should be preserved
  const rawWithVisible: FormData = {
    VT2_1: "Oui/ Yes",
    VT2_2: "Valid preserved data",
    VT1_01: "CFP Yaounde",
  };
  const kept = cleanHiddenDependentFields(vt, rawWithVisible);
  assert.equal(kept.VT2_2, "Valid preserved data", "VT2_2 must be preserved when VT2_1 is 'Oui/ Yes'");
});

test("D5: prepareSubmissionData prunes conditionally hidden fields from submission payload", () => {
  const vt = entity("vocationalTraining");
  const rawData: FormData = {
    VT2_1: "Non/ No",
    VT2_2: "Phantom data left behind",
    VT1_01: "CFP Yaounde",
  };

  const submitted = prepareSubmissionData(vt, rawData);
  assert.equal(submitted.VT2_1, "Non/ No");
  assert.equal(submitted.VT1_01, "CFP Yaounde");
  assert.equal(submitted.VT2_2, undefined, "prepareSubmissionData must prune hidden fields");
});

