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

// D2 of the 2026-10-19 E2E run: a table switched to "Aucun" is zero-filled,
// and switching it back to "A remplir" used to leave those zeros, so the
// table presented itself as answered before anything was typed.
test("re-opening a closed table clears the zeros it was given", async () => {
  const closed: Record<string, unknown> = {
    S4Q01_RESPONSE_STATUS: "NONE",
    S4Q02_RESPONSE_STATUS: "NONE",
    S4Q03_RESPONSE_STATUS: "NONE",
    S4Q04_RESPONSE_STATUS: "NONE",
    S4Q05_RESPONSE_STATUS: "NONE",
    S4Q06_RESPONSE_STATUS: "NONE",
    pp_s4q01_cadres_male_15_24: 0,
    pp_s4q01_cadres_female_15_24: 0,
  };
  const { container, user, changes, unmount } = renderQuiz(closed);
  const q = within(container);
  await user.click(q.getAllByRole("checkbox").at(-1)!); // "Aucun bénéficiaire…"
  const groups = q.getAllByRole("radiogroup");
  await user.click(within(groups[0]).getByRole("radio", { name: "Oui" })); // permanent staff: yes
  await user.click(within(groups[1]).getByRole("radio", { name: "Non" }));
  await user.click(within(groups[2]).getByRole("radio", { name: "Non" }));
  await user.click(q.getByRole("button", { name: /Ouvrir les tableaux/ }));

  assert.ok(
    changes.some(([id, v]) => id === "S4Q01_RESPONSE_STATUS" && v === "REPORTED"),
    "4.1 was not re-opened",
  );
  const cleared = changes.filter(([id, v]) => id.startsWith("pp_s4q01_") && v === "");
  assert.ok(cleared.length >= 2, `zeros left behind: ${JSON.stringify(changes.filter(([id]) => id.startsWith("pp_s4q01_")))}`);
  // A table left closed keeps being zero-filled, as before.
  assert.ok(changes.some(([id, v]) => id === "S4Q02_RESPONSE_STATUS" && v === "NONE"));
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
