import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OnefopSchema } from "./onefop-schema";
import { campaignPeriodFrom, kpiPeriodLabels, periodPhrase, withCampaignPeriod } from "./campaign-period";

const H1_2027 = campaignPeriodFrom({ periodStart: "2027-01-01T00:00:00.000Z", periodEnd: "2027-06-30T00:00:00.000Z" });
const NONE = campaignPeriodFrom(null);

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
  assert.deepEqual(campaignPeriodFrom({ periodStart: "garbage", periodEnd: null }), { start: null, end: null });
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

test("each placeholder variant becomes the campaign period", () => {
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
  assert.deepEqual(kpiPeriodLabels(period).slice(1), [
    { fr: "Perspectives au 31/12/2026", en: "Outlook at 31/12/2026" },
    { fr: "Perspectives au 30/06/2026", en: "Outlook at 30/06/2026" },
  ]);
});

test("KPI headers follow the period, and drop the year when there is none", () => {
  assert.deepEqual(kpiPeriodLabels(H1_2027)[0], { fr: "Du 01/01/2027 au 30/06/2027", en: "From 01/01/2027 to 30/06/2027" });
  assert.equal(kpiPeriodLabels(H1_2027)[1].fr, "Perspectives au 31/12/2027");
  assert.deepEqual(kpiPeriodLabels(NONE)[1], { fr: "Perspectives à fin décembre", en: "Outlook at end of December" });
});

test("text without a placeholder is left as the same object", () => {
  const schema = loadSchema();
  const out = withCampaignPeriod(schema, H1_2027);
  const id = "COOP_S1Q03"; // hint « Ex: 2010 » is a format example, not a period
  const find = (s: OnefopSchema) =>
    Object.values(s.entities).flatMap((e) => e.sections.flatMap((x) => x.fields)).find((f) => f.id === id)!;
  assert.equal(find(out), find(schema));
});
