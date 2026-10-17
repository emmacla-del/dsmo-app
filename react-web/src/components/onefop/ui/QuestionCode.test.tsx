import { renderWithProviders } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { FieldRenderer } from "../FieldRenderer";
import { schemaField } from "@/test/schema";

// B7 (E2E 2026-10-17): a respondent filling an employer form saw « S0Q01 »
// in front of every question — an internal id, repeated across questions
// (S0Q03 is Tel 1, Tel 2 and the e-mail), that §8 keeps off their screen.
// The training-centre form's own numbering (« 4.10 ») is printed on the
// paper they are copying from and stays.

function renderField(entity: string, fieldId: string, sectionId: string) {
  const field = schemaField(entity, fieldId);
  const { container, unmount } = renderWithProviders(
    <FieldRenderer field={field} value={undefined} data={{}} onChange={() => {}} sectionId={sectionId} />,
  );
  const codes = [...container.querySelectorAll(".cam-qcode")].map((el) => el.textContent?.trim());
  const text = container.textContent ?? "";
  unmount();
  return { codes, text };
}

test("an employer question shows no code badge and no code in its text", () => {
  const { codes, text } = renderField("enterprise", "S0Q01", "section0");
  assert.deepEqual(codes, []);
  assert.ok(!/S0Q01/i.test(text), `the code is still in the text: ${text}`);
  assert.ok(text.trim().length > 0, "the question itself is still rendered");
});

test("a training-centre question keeps its form number", () => {
  const { codes, text } = renderField("vocationalTraining", "VT1_3", "section1_vocationalTraining");
  assert.deepEqual(codes, ["1.3"]);
  assert.ok(text.trim().length > "1.3".length, "the question itself is still rendered");
});
