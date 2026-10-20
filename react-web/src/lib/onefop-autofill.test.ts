import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CompanyProfile } from "./api-client";
import type { OnefopSchema } from "./onefop-schema";
import { companyToInitialData } from "./onefop-autofill";

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;

// B9 (E2E 2026-10-17): registration answers a different set of questions
// from the declaration. « Quartier/Village/Localité » was filled with the
// office street address and « Nombre d'employés permanents » with a column
// registration never collects, so the respondent opened a required question
// on an answer they had not given (§9).

/** An account as registration leaves it: an address, and the 0 default. */
const registered: Partial<CompanyProfile> = {
  name: "Societe Test",
  region: "Littoral",
  department: "Wouri",
  subdivision: "Douala 1",
  address: "123 rue de la Réunification",
  totalEmployees: 0,
  phone: "677000000",
  mainActivity: "Construction",
};

// The keys the only caller passes (app/onefop/preview/page.tsx normalises
// the URL parameter to these before calling).
const ENTITY_TYPES = [
  "enterprise",
  "cooperative",
  "ctd",
  "ong",
  "administration",
  "projectProgram",
  "vocationalTraining",
];

/** Field ids of every « Quartier/Village/Localité » question in the schema. */
function localityFieldIds(): string[] {
  const ids: string[] = [];
  for (const entity of Object.values(schema.entities)) {
    for (const sec of entity.sections) {
      for (const f of sec.fields) {
        const fr = (f.label?.fr ?? "").toLowerCase();
        if (fr.includes("quartier") || fr.includes("village")) ids.push(f.id);
      }
    }
  }
  assert.ok(ids.length >= 7, `expected one per entity, found ${ids.length}`);
  return ids;
}

test("no locality question is prefilled from the office address", () => {
  const locality = new Set(localityFieldIds());
  for (const entityType of ENTITY_TYPES) {
    const data = companyToInitialData(registered, entityType);
    for (const [key, value] of Object.entries(data)) {
      if (!locality.has(key)) continue;
      assert.fail(`${entityType}: ${key} was prefilled with ${JSON.stringify(value)}`);
    }
  }
});

test("the address still fills the head-office questions", () => {
  assert.equal(companyToInitialData(registered, "enterprise")["S1Q09"], registered.address);
  assert.equal(companyToInitialData(registered, "projectProgram")["PP_S1Q11"], registered.address);
  assert.equal(companyToInitialData(registered, "ong")["ONG_S1Q02"], registered.address);
});

test("no permanent-headcount question opens on a figure registration never asked", () => {
  const counts: Record<string, string> = {
    enterprise: "S1Q10",
    cooperative: "COOP_S1Q11",
    ctd: "CTD_S1Q09",
    ong: "ONG_S1Q10",
    projectProgram: "PP_S1Q15",
  };
  for (const [entityType, fieldId] of Object.entries(counts)) {
    assert.equal(
      companyToInitialData(registered, entityType)[fieldId],
      undefined,
      `${entityType}: ${fieldId} was prefilled`,
    );
    // A DSMO-era company carries a real figure; it belongs to another
    // reference period, so it is not an answer to this question either.
    assert.equal(
      companyToInitialData({ ...registered, totalEmployees: 42 }, entityType)[fieldId],
      undefined,
      `${entityType}: ${fieldId} was prefilled from a DSMO-era headcount`,
    );
  }
});

test("PP_S1Q01 is prefilled from the registration's type of entity", () => {
  const ppField = schema.entities.projectProgram.sections
    .flatMap((s) => s.fields)
    .find((f) => f.id === "PP_S1Q01");
  const values = (ppField?.options ?? []).map((o) => o.value);
  assert.equal(values.length, 4);
  // Every value registration can store is one the question offers.
  for (const value of values) {
    assert.equal(companyToInitialData({ ...registered, projectNature: value }, "projectProgram")["PP_S1Q01"], value);
  }
  // No registration answer, or one the question does not offer: unanswered,
  // never a guess (§9).
  assert.equal(companyToInitialData(registered, "projectProgram")["PP_S1Q01"], undefined);
  assert.equal(companyToInitialData({ ...registered, projectNature: "Projet" }, "projectProgram")["PP_S1Q01"], undefined);
});

test("the identification fields registration does ask for are still prefilled", () => {
  const pp = companyToInitialData(registered, "projectProgram");
  assert.equal(pp["PP_S1Q06_REGION"], "Littoral");
  assert.equal(pp["PP_S1Q06_DEPT"], "Wouri");
  assert.equal(pp["PP_S1Q06_SUBDIV"], "Douala 1");
  assert.equal(pp["PP_S1Q07_TEL1"], "677000000");

  const vt = companyToInitialData({ ...registered, sigle: "CFP-T" }, "vocationalTraining");
  assert.equal(vt["VT1_4"], "Littoral");
  assert.equal(vt["VT1_6"], "Douala 1");
  assert.equal(vt["VT1_3"], "CFP-T");
});
