import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RESPONDENT_FUNCTION_OPTIONS,
  RESPONDENT_FUNCTION_OPTIONS_BY_TYPE,
  RESPONDENT_FUNCTION_OTHER,
  functionFitsEntityType,
  getRespondentFunctionOptions,
  registerOptionLabel,
} from "@/lib/register-options";
import type { EntityType } from "@/lib/register-constants";

test("getRespondentFunctionOptions falls back to enterprise options when no type is provided", () => {
  const defaultOpts = getRespondentFunctionOptions();
  const nullOpts = getRespondentFunctionOptions(null);
  const entOpts = getRespondentFunctionOptions("enterprise");

  assert.deepEqual(defaultOpts, entOpts);
  assert.deepEqual(nullOpts, entOpts);
  assert.ok(entOpts.some((o) => o.value === "Directeur Général"));
  assert.ok(entOpts.some((o) => o.value === "Directeur des Ressources Humaines"));
});

test("cooperative options include cooperative-specific titles", () => {
  const opts = getRespondentFunctionOptions("cooperative");
  assert.ok(opts.some((o) => o.value === "Président du Comité de Gestion"));
  assert.ok(opts.some((o) => o.value === "Trésorier"));
  assert.ok(opts.some((o) => o.value === "Gérant de coopérative"));
  assert.ok(opts.some((o) => o.value === RESPONDENT_FUNCTION_OTHER));
});

test("administration options include administrative titles", () => {
  const opts = getRespondentFunctionOptions("administration");
  assert.ok(opts.some((o) => o.value === "Ministre / Secrétaire d'État"));
  assert.ok(opts.some((o) => o.value === "Chef de Service"));
  assert.ok(opts.some((o) => o.value === "Délégué Régional"));
  assert.ok(opts.some((o) => o.value === "Point Focal"));
  assert.ok(opts.some((o) => o.value === RESPONDENT_FUNCTION_OTHER));
});

test("ctd options include municipal and regional local authority titles", () => {
  const opts = getRespondentFunctionOptions("ctd");
  assert.ok(opts.some((o) => o.value === "Maire"));
  assert.ok(opts.some((o) => o.value === "Adjoint au Maire"));
  assert.ok(opts.some((o) => o.value === "Secrétaire Général de Mairie"));
  assert.ok(opts.some((o) => o.value === "Receveur Municipal"));
  assert.ok(opts.some((o) => o.value === RESPONDENT_FUNCTION_OTHER));
});

test("ong options include NGO / association leadership titles", () => {
  const opts = getRespondentFunctionOptions("ong");
  assert.ok(opts.some((o) => o.value === "Coordonnateur National"));
  assert.ok(opts.some((o) => o.value === "Directeur Exécutif"));
  assert.ok(opts.some((o) => o.value === "Responsable des Programmes"));
  assert.ok(opts.some((o) => o.value === RESPONDENT_FUNCTION_OTHER));
});

test("projectProgram options include project management titles", () => {
  const opts = getRespondentFunctionOptions("projectProgram");
  assert.ok(opts.some((o) => o.value === "Coordonnateur de Projet"));
  assert.ok(opts.some((o) => o.value === "Responsable Suivi-Évaluation"));
  assert.ok(opts.some((o) => o.value === "Chef d'Antenne Régionale"));
  assert.ok(opts.some((o) => o.value === RESPONDENT_FUNCTION_OTHER));
});

test("vocationalTraining options include training centre leadership titles", () => {
  const opts = getRespondentFunctionOptions("vocationalTraining");
  assert.ok(opts.some((o) => o.value === "Promoteur / Fondateur"));
  assert.ok(opts.some((o) => o.value === "Directeur du Centre"));
  assert.ok(opts.some((o) => o.value === "Responsable Pédagogique"));
  assert.ok(opts.some((o) => o.value === RESPONDENT_FUNCTION_OTHER));
});

test("every entity type options list ends with Autre", () => {
  const types: EntityType[] = [
    "enterprise",
    "cooperative",
    "ctd",
    "ong",
    "administration",
    "projectProgram",
    "vocationalTraining",
  ];

  for (const t of types) {
    const opts = getRespondentFunctionOptions(t);
    assert.equal(opts.at(-1)?.value, RESPONDENT_FUNCTION_OTHER, `${t} should end with Autre`);
  }
});

test("registerOptionLabel resolves roles across all entity types via RESPONDENT_FUNCTION_OPTIONS", () => {
  // Enterprise role
  assert.equal(
    registerOptionLabel(RESPONDENT_FUNCTION_OPTIONS, "Directeur Général", "en"),
    "General Manager"
  );
  // CTD role
  assert.equal(
    registerOptionLabel(RESPONDENT_FUNCTION_OPTIONS, "Maire", "en"),
    "Mayor"
  );
  // NGO role
  assert.equal(
    registerOptionLabel(RESPONDENT_FUNCTION_OPTIONS, "Directeur Exécutif", "en"),
    "Executive Director"
  );
  // CFP role
  assert.equal(
    registerOptionLabel(RESPONDENT_FUNCTION_OPTIONS, "Promoteur / Fondateur", "en"),
    "Promoter / Founder"
  );
});

test("a title shared by several lists has one label, so the dropdown and the summary agree", () => {
  const seen = new Map<string, { fr: string; en: string }>();
  for (const t of Object.keys(RESPONDENT_FUNCTION_OPTIONS_BY_TYPE) as EntityType[]) {
    for (const o of getRespondentFunctionOptions(t)) {
      const prior = seen.get(o.value);
      if (prior) assert.deepEqual(o.label, prior, `${o.value} is labelled two ways`);
      else seen.set(o.value, o.label);
    }
  }
});

test("an unknown or inherited key falls back to the enterprise list", () => {
  assert.deepEqual(getRespondentFunctionOptions("toString"), getRespondentFunctionOptions("enterprise"));
  assert.deepEqual(getRespondentFunctionOptions("nope"), getRespondentFunctionOptions("enterprise"));
});

test("changing entity type keeps a title the new type offers and clears one it does not", () => {
  // Shared by the enterprise and administration lists.
  assert.equal(functionFitsEntityType("Secrétaire Général", "administration"), true);
  // A mayor has no place in a company.
  assert.equal(functionFitsEntityType("Maire", "enterprise"), false);
  assert.equal(functionFitsEntityType("Directeur Général", "ctd"), false);
});

test("« Autre » and an empty choice survive any change of entity type", () => {
  for (const t of Object.keys(RESPONDENT_FUNCTION_OPTIONS_BY_TYPE)) {
    assert.equal(functionFitsEntityType(RESPONDENT_FUNCTION_OTHER, t), true);
    assert.equal(functionFitsEntityType("", t), true);
  }
});
