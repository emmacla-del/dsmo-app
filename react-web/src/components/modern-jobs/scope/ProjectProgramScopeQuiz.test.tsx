import { renderWithProviders, screen, within } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaEntity } from "@/test/schema";
import { ProjectProgramScopeQuiz } from "./ProjectProgramScopeQuiz";
import { PP_SECTION4_TABLES } from "@/lib/pp-section4-tables";

function renderQuiz(data: Record<string, unknown> = {}) {
  const changes: Array<[string, unknown]> = [];
  const result = renderWithProviders(
    <ProjectProgramScopeQuiz
      entity={schemaEntity("projectProgram")}
      data={data}
      onChange={(id, value) => changes.push([id, value])}
      onComplete={() => changes.push(["__complete", true])}
      onBack={() => {}}
      locale="fr"
      establishmentName="Projet Test"
    />,
  );
  return { ...result, changes };
}

// The other employer forms' quiz asks its Oui/Non questions as a labelled
// radiogroup (EventQuestion.renderYesNo). The project quiz asked them with
// two unlabelled buttons: a screen reader heard "Oui" and "Non" three times
// over with nothing to say which question they answered.
test("each Oui/Non question is one labelled radiogroup", () => {
  const { container, unmount } = renderQuiz();
  const q = within(container);
  const groups = q.getAllByRole("radiogroup");
  assert.deepEqual(
    groups.map((g) => g.getAttribute("aria-label")),
    ["Personnel permanent", "Personnel temporaire", "Recrutements au cours de la période"],
  );
  assert.equal(q.getAllByRole("radio").length, 6);
  // Unanswered is neither Oui nor Non (§9).
  assert.ok(q.getAllByRole("radio").every((r) => r.getAttribute("aria-checked") === "false"));
  unmount();
});

test("answering Oui checks that radio and leaves the other questions unanswered", async () => {
  const { container, user, unmount } = renderQuiz();
  const q = within(container);
  const permanent = within(q.getAllByRole("radiogroup")[0]);
  await user.click(permanent.getByRole("radio", { name: "Oui" }));
  assert.equal(permanent.getByRole("radio", { name: "Oui" }).getAttribute("aria-checked"), "true");
  assert.equal(permanent.getByRole("radio", { name: "Non" }).getAttribute("aria-checked"), "false");
  const temporary = within(q.getAllByRole("radiogroup")[1]);
  assert.ok(temporary.getAllByRole("radio").every((r) => r.getAttribute("aria-checked") === "false"));
  unmount();
});

// §8: a paper code is an internal id and does not belong on a respondent's
// screen (the rule commit af353005 applied to every question label).
test("the Section 1 headcount is recalled without its paper code", () => {
  const { container, unmount } = renderQuiz({ PP_S1Q15: 12 });
  const text = container.textContent ?? "";
  assert.ok(text.includes("Effectif permanent déclaré en Section 1 : 12."), text.slice(0, 200));
  assert.ok(!/S1Q15/.test(text), "the paper code is still on screen");
  unmount();
});

test("no paper code appears anywhere in the quiz", () => {
  const { container, unmount } = renderQuiz({ PP_S1Q15: 4 });
  assert.ok(!/S[0-9]Q[0-9]{2}/.test(container.textContent ?? ""));
  unmount();
});

// The configuration summary and Section 4's table list are one vocabulary.
test("the summary names the six tables as the table list does", () => {
  const { container, unmount } = renderQuiz();
  const text = container.textContent ?? "";
  for (const table of PP_SECTION4_TABLES) {
    assert.ok(text.includes(`${table.number} ${table.name.fr}`), `missing ${table.number}`);
  }
  unmount();
});

test("a nil declaration is confirmed in a named dialog", async () => {
  const { container, user, unmount } = renderQuiz();
  const q = within(container);
  await user.click(q.getAllByRole("checkbox").at(-1)!);
  const groups = q.getAllByRole("radiogroup");
  for (const group of groups) await user.click(within(group).getByRole("radio", { name: "Non" }));
  await user.click(q.getByRole("button", { name: /Ouvrir les tableaux/ }));

  const dialog = screen.getByRole("dialog");
  assert.equal(
    dialog.getAttribute("aria-labelledby") !== null,
    true,
    "the dialog announces no name",
  );
  assert.ok((dialog.textContent ?? "").includes("Confirmer une déclaration à néant"));
  unmount();
});
