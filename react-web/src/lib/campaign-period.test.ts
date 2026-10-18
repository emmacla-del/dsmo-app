import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OnefopSchema } from "./onefop-schema";
import { campaignPeriodFrom, inPeriodPhrase, kpiPeriodLabels, periodPhrase, withCampaignPeriod } from "./campaign-period";

// No code: the kind of round is unknown, so the phrase falls back to the dates.
const H1_2027 = campaignPeriodFrom({ periodStart: "2027-01-01T00:00:00.000Z", periodEnd: "2027-06-30T00:00:00.000Z" });
const NONE = campaignPeriodFrom(null);
// The shape the server actually sends: period bounds and the round's code.
const T4_2026 = campaignPeriodFrom({
  code: "QUARTERLY_2026_T4_001",
  periodStart: "2026-09-30T23:00:00.000Z",
  periodEnd: "2026-12-31T22:59:59.000Z",
});
const S1_2027 = campaignPeriodFrom({
  code: "SEMESTER_2027_S1_001",
  periodStart: "2027-01-01T00:00:00.000Z",
  periodEnd: "2027-06-30T00:00:00.000Z",
});
const YEAR_2026 = campaignPeriodFrom({
  code: "ANNUAL_2026_AN_001",
  periodStart: "2026-01-01T00:00:00.000Z",
  periodEnd: "2026-12-31T00:00:00.000Z",
});
const UNKNOWN_CODE = campaignPeriodFrom({
  code: "CUSTOM-RUN",
  periodStart: "2027-01-01T00:00:00.000Z",
  periodEnd: "2027-06-30T00:00:00.000Z",
});

function loadSchema(): OnefopSchema {
  return JSON.parse(readFileSync(join(process.cwd(), "public", "schemas", "onefop.schema.json"), "utf8"));
}

function allText(schema: OnefopSchema): string[] {
  const out: string[] = [];
  for (const entity of Object.values(schema.entities)) {
    for (const section of entity.sections) {
      for (const text of [section.title, section.description, ...section.subsections.map((s) => s.title)]) {
        if (text) out.push(text.fr, text.en);
      }
      for (const field of section.fields) {
        for (const text of [field.label, field.hint, field.instruction]) if (text) out.push(text.fr, text.en);
      }
    }
  }
  return out;
}

test("the period phrase is the round's dates, or says it is not set", () => {
  assert.deepEqual(periodPhrase(H1_2027), { fr: "du 01/01/2027 au 30/06/2027", en: "from 01/01/2027 to 30/06/2027" });
  assert.deepEqual(periodPhrase(NONE), { fr: "du non définie au non définie", en: "from not set to not set" });
  assert.deepEqual(campaignPeriodFrom({ periodStart: "garbage", periodEnd: null }), {
    start: null,
    end: null,
    code: null,
  });
});

test("in a question, the round is named by its kind and carries no date", () => {
  assert.deepEqual(inPeriodPhrase(T4_2026), { fr: "au cours du trimestre", en: "during the quarter" });
  assert.deepEqual(inPeriodPhrase(S1_2027), { fr: "au cours du semestre", en: "during the half-year" });
  assert.deepEqual(inPeriodPhrase(YEAR_2026), { fr: "au cours de l'année", en: "during the year" });
  // A code whose kind cannot be read names no kind: the dates stand in, so
  // the question still states a period.
  assert.deepEqual(inPeriodPhrase(UNKNOWN_CODE), periodPhrase(UNKNOWN_CODE));
  assert.deepEqual(inPeriodPhrase(H1_2027), periodPhrase(H1_2027));
});

test("the quarter wording reaches every form type's questions, in both languages", () => {
  const fields = Object.values(withCampaignPeriod(loadSchema(), T4_2026).entities).flatMap((e) =>
    e.sections.flatMap((s) => s.fields),
  );
  const field = (id: string) => fields.find((f) => f.id === id)!;
  // enterprise, cooperative/CTD/NGO (same ids), administration, project/programme
  for (const id of ["S21Q01", "S22Q05_ENTERPRISE", "S3Q01", "S4Q01", "PP_S4Q01", "PP_S4Q06"]) {
    assert.match(field(id).label!.fr, /au cours du trimestre/, id);
    assert.match(field(id).label!.en, /during the quarter/, id);
    assert.doesNotMatch(field(id).label!.fr, /\d{2}\/\d{2}\/\d{4}|Janvier/, id);
    assert.doesNotMatch(field(id).label!.en, /\d{2}\/\d{2}\/\d{4}|January/, id);
  }
});

test("no fixed reference date survives in the questionnaire text", () => {
  const schema = loadSchema();
  const before = allText(schema).filter((t) => /Janvier 20\d\d|January 20\d\d|\(20\d\d-20\d\d\)/.test(t));
  assert.ok(before.length > 0, "the generated schema should still carry the AST's placeholder phrases");
  const after = allText(withCampaignPeriod(schema, H1_2027));
  for (const text of after) {
    assert.doesNotMatch(text, /Janvier 20\d\d|January 20\d\d|\(2024-2025\)/, text);
  }
});

test("with no round code, each placeholder variant becomes the period's dates", () => {
  const field = (id: string) =>
    Object.values(withCampaignPeriod(loadSchema(), H1_2027).entities)
      .flatMap((e) => e.sections.flatMap((s) => s.fields))
      .find((f) => f.id === id)!;
  // « premier Janvier 2025 » / « the 1st of January 2025 to the present day »
  assert.match(field("S21Q01").label!.fr, /du 01\/01\/2027 au 30\/06\/2027/);
  assert.match(field("S22Q01").label!.en, /from 01\/01\/2027 to 30\/06\/2027/);
  // « 1st January 2026 to date », which Flutter's phrase list misses
  assert.match(field("S4Q01").label!.en, /from 01\/01\/2027 to 30\/06\/2027/);
  // Project-programme questions, absent from Flutter's id list
  assert.match(field("PP_S4Q05").label!.fr, /du 01\/01\/2027 au 30\/06\/2027/);
  // Vocational training's prior academic year
  assert.match(field("VT4_10").label!.fr, /pour l'année antérieur \(2025-2026\)/);
});

test("the AST's own output is reproduced for a 2026 campaign", () => {
  const period = campaignPeriodFrom({ periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-06-30T00:00:00.000Z" });
  const vt = Object.values(withCampaignPeriod(loadSchema(), period).entities)
    .flatMap((e) => e.sections.flatMap((s) => s.fields))
    .find((f) => f.id === "VT4_10")!;
  assert.match(vt.label!.fr, /\(2024-2025\)/);
});

test("the KPI period column follows the campaign; the outlooks name no date", () => {
  // The official PDF's own wording for this column (projectProgram.outcomes.current).
  assert.deepEqual(kpiPeriodLabels(T4_2026)[0], {
    fr: "Réalisations au cours du trimestre",
    en: "Achievements during the quarter",
  });
  assert.deepEqual(kpiPeriodLabels(YEAR_2026)[0], {
    fr: "Réalisations au cours de l'année",
    en: "Achievements during the year",
  });
  // No round code: the dates head the column, as before.
  assert.deepEqual(kpiPeriodLabels(H1_2027)[0], { fr: "Du 01/01/2027 au 30/06/2027", en: "From 01/01/2027 to 30/06/2027" });
  const outlooks = [
    { fr: "Perspectives à fin Décembre", en: "Outlook at end of December" },
    { fr: "Perspectives à fin Juin", en: "Outlook at end of June" },
  ];
  assert.deepEqual(kpiPeriodLabels(H1_2027).slice(1), outlooks);
  assert.deepEqual(kpiPeriodLabels(NONE).slice(1), outlooks);
});

test("text without a placeholder is left as the same object", () => {
  const schema = loadSchema();
  const out = withCampaignPeriod(schema, H1_2027);
  const id = "COOP_S1Q03"; // hint « Ex: 2010 » is a format example, not a period
  const find = (s: OnefopSchema) =>
    Object.values(s.entities).flatMap((e) => e.sections.flatMap((x) => x.fields)).find((f) => f.id === id)!;
  assert.equal(find(out), find(schema));
});
