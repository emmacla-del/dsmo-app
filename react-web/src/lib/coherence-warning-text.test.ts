import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VT_COHERENCE_CODES, parseCoherenceWarning } from "./coherence-warning-text";

// The exact shape checkVtCoherence (src/questionnaires/questionnaires.service.ts) stores.
const STORED =
  "Effectif total des apprenants par diplôme académique (4.1: 12, hommes) " +
  "ne correspond pas au total par diplôme professionnel (4.2: 10, hommes).";

test("reads the two figures and the sex from the stored French text", () => {
  assert.deepEqual(parseCoherenceWarning("VT_DIPLOMA_ACADEMIC_PRO_MISMATCH", STORED), {
    code: "VT_DIPLOMA_ACADEMIC_PRO_MISMATCH",
    first: 12,
    second: 10,
    sex: "male",
  });
  const sortants = "Effectif des sortants par âge (4.7 sortants: 0, femmes) ne correspond pas au total des sortants par spécialité (4.10: 5, femmes).";
  assert.deepEqual(parseCoherenceWarning("VT_TRAINEE_OUTGOING_SPECIALTY_MISMATCH", sortants)?.sex, "female");
});

test("anything else falls back to the stored text (null)", () => {
  assert.equal(parseCoherenceWarning("S22Q03_MISMATCH", STORED), null);
  assert.equal(parseCoherenceWarning("VT_TRAINER_AGE_MISMATCH", "Incohérence statistique détectée"), null);
  assert.equal(parseCoherenceWarning(null, STORED), null);
});

test("every VT rule has a sentence in both catalogues", () => {
  for (const locale of ["fr", "en"]) {
    const messages = JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf-8"));
    const coherence = messages.adminDossierPage.coherence;
    for (const code of VT_COHERENCE_CODES) {
      assert.match(coherence[code], /\{first\}.*\{second\}/, `${locale} ${code}`);
    }
    assert.ok(coherence.male && coherence.female);
  }
});

test("coherenceWarningText puts the stored figures in the catalogue sentence, or keeps the stored text", async () => {
  const { coherenceWarningText } = await import("./coherence-warning-text");
  const en = JSON.parse(readFileSync(join(process.cwd(), "messages", "en.json"), "utf-8")).adminDossierPage;
  const t = (key: string, values: Record<string, string | number> = {}) => {
    const template = key.split(".").reduce((o: any, k) => o?.[k], en) as string;
    return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k]));
  };
  assert.equal(
    coherenceWarningText(t, "VT_DIPLOMA_ACADEMIC_PRO_MISMATCH", STORED),
    "Trainees by academic diploma (4.1: 12, men) do not match trainees by vocational diploma (4.2: 10, men).",
  );
  assert.equal(coherenceWarningText(t, "S22Q03_MISMATCH", "Texte stocké"), "Texte stocké");
});
