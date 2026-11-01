import { renderWithProviders, cleanup } from "@/test/render";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { loadOnefopSchema } from "@/test/schema";
import type { FormData, OnefopField } from "@/lib/onefop-schema";
import { ReviewStatisticalTable } from "./ReviewStatisticalTable";
import { DossierAnswerSections } from "./DossierAnswerSections";

afterEach(() => cleanup());

const schema = loadOnefopSchema();
const field = (entity: string, id: string): OnefopField =>
  schema.entities[entity].sections.flatMap((section) => section.fields).find((item) => item.id === id)!;

test("an employer table reads with the wizard's labels and never shows a cell code", () => {
  const data: FormData = { S21Q01_RESPONSE_STATUS: "REPORTED", s21q01_cadres_male_15_24: 6, s21q01_cadres_male_25_34: 0 };
  const { container } = renderWithProviders(<ReviewStatisticalTable field={field("enterprise", "S21Q01")} data={data} />);
  const text = container.textContent ?? "";
  assert.ok(text.includes("Cadres"), "the staff category labels the row");
  assert.ok(text.includes("6"));
  assert.ok(!/s21q01_/.test(text), "no cell code on screen");
  assert.equal(container.querySelector("input"), null, "read-only: no input");
  // A cell the respondent left blank reads « — », never 0.
  assert.ok(container.querySelectorAll(".cam-dt-empty").length > 0);
});

test("the review grid spans its column: no entry-sized minimum width", () => {
  const { container } = renderWithProviders(
    <ReviewStatisticalTable field={field("enterprise", "S21Q01")} data={{ s21q01_cadres_male_15_24: 6 }} />,
  );
  const table = container.querySelector("table") as HTMLTableElement;
  assert.equal(table.style.minWidth, "");
  assert.equal(table.style.width, "100%");
  assert.ok(container.querySelector(".cam-grid-readonly"));
});

test("« néant » and « non concerné » are said in words instead of an empty grid", () => {
  const none = renderWithProviders(<ReviewStatisticalTable field={field("enterprise", "S22Q04")} data={{ S22Q04_RESPONSE_STATUS: "NONE" }} />);
  assert.ok(none.container.textContent?.includes("Néant déclaré"));
  assert.equal(none.container.querySelector("table"), null);
  cleanup();
  const na = renderWithProviders(<ReviewStatisticalTable field={field("enterprise", "S22Q04")} data={{ S22Q04_RESPONSE_STATUS: "NOT_APPLICABLE" }} />);
  assert.ok(na.container.textContent?.includes("Non concerné"));
});

test("recruitment by diploma shows one labelled grid per staff category that holds figures", () => {
  const { container } = renderWithProviders(
    <ReviewStatisticalTable field={field("enterprise", "S22Q03")} data={{ S22Q03_RESPONSE_STATUS: "REPORTED", s22q03_cadres_cep_male_15_24: 2 }} />,
  );
  assert.ok(container.textContent?.includes("Cadres"));
  assert.equal(container.querySelectorAll("table").length, 1, "categories with no figures are not drawn");
});

test("the project's activities and outcomes tables read with their own labels", () => {
  const activities = field("projectProgram", "PP_S2_ACTIVITIES");
  const prefix = activities.table?.id ?? activities.id;
  const a = renderWithProviders(<ReviewStatisticalTable field={activities} data={{ [`${prefix}_row1_description`]: "Formation des jeunes" }} />);
  assert.ok(a.container.textContent?.includes("Prestations offertes"));
  assert.ok(a.container.textContent?.includes("Formation des jeunes"));
  cleanup();
  const outcomes = field("projectProgram", "PP_S3_OUTCOMES");
  const op = outcomes.table?.id ?? outcomes.id;
  const o = renderWithProviders(<ReviewStatisticalTable field={outcomes} data={{ [`${op}_employed_current`]: 14 }} quarterCode="2026-T4" />);
  assert.ok(o.container.textContent?.includes("14"));
  assert.ok(o.container.textContent?.includes("Perspectives à fin Décembre"));
});

test("a section lists no variable code, no « response status » question and no reason typed twice", () => {
  const entity = schema.entities.enterprise;
  const section = entity.sections.find((item) => item.fields.some((f) => f.id === "S3Q02"))!;
  const data: FormData = { S3Q02_RESPONSE_STATUS: "REPORTED", S3Q02_REASON_1_TEXT: "Fin de contrat", s3q02_reason_1_male: 2 };
  const { container } = renderWithProviders(<DossierAnswerSections entity={entity} sectionId={section.id} title="3" data={data} />);
  const text = container.textContent ?? "";
  assert.ok(!/\bS3Q0\d\b/.test(text), "no variable code");
  assert.ok(!/Statut de réponse|Response status/.test(text));
  assert.equal(text.split("Fin de contrat").length - 1, 1, "the typed reason appears once, as its row's label");
  assert.ok(container.querySelector("#dossier-field-S3Q02"), "each answer carries the anchor findings link to");
});
