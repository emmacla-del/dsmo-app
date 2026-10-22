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
    />,
  );
  return { ...result, changes };
}

async function next(user: { click: (el: Element) => Promise<void> }) {
  if (screen.queryByRole("radiogroup") === null) {
    const checks = screen.queryAllByRole("checkbox") as HTMLInputElement[];
    if (checks.length > 0 && !checks.some((check) => check.checked)) {
      await user.click(checks[0]);
      assert.equal(checks[0].checked, true, "selecting an outcome should enable Continue");
    }
  }
  const button = screen.getByRole("button", { name: /Continuer|Continue/ });
  if (!(button as HTMLButtonElement).disabled) await user.click(button);
}

async function chooseNo(user: { click: (el: Element) => Promise<void> }) {
  await user.click(within(screen.getByRole("radiogroup")).getByRole("radio", { name: "Non" }));
}

async function reachReviewWithRecruitmentTypes(user: { click: (el: Element) => Promise<void> }) {
  const checks = screen.getAllByRole("checkbox");
  await user.click(checks[0]); // one outcome
  await next(user);
  await user.click(within(screen.getByRole("radiogroup")).getByRole("radio", { name: "Oui" }));
  await chooseNo(user);
  await user.click(within(screen.getByRole("radiogroup")).getByRole("radio", { name: "Oui" }));
  for (const checkbox of screen.getAllByRole("checkbox")) await user.click(checkbox);
  await user.click(screen.getByRole("button", { name: /Ouvrir les tableaux|Open the tables|Confirmer et ouvrir les tableaux|Confirm and open the tables/ }));
}

// The project quiz follows the employer quiz pattern: one focused beat at a
// time, then a shared answer review before its existing scope commit runs.
test("project quiz asks one labelled Oui/Non question at a time", async () => {
  const { user, container, unmount } = renderQuiz();
  assert.equal(screen.getAllByRole("radiogroup").length, 0, "the first beat is the outcomes checklist");
  await next(user);
  const group = await within(container).findByRole("radiogroup", { name: "Personnel permanent" });
  assert.equal(within(group).getAllByRole("radio").length, 2);
  await user.click(within(group).getByRole("radio", { name: "Oui" }));
  assert.equal(screen.getAllByRole("radiogroup").length, 1);
  assert.equal(screen.getByRole("radiogroup").getAttribute("aria-label"), "Personnel temporaire");
  unmount();
});

test("the Section 1 headcount is recalled without its paper code", async () => {
  const { container, user, unmount } = renderQuiz({ PP_S1Q15: 12 });
  await next(user);
  const text = container.textContent ?? "";
  assert.ok(text.includes("Effectif permanent déclaré en Section 1 : 12."), text.slice(0, 200));
  assert.ok(!/S1Q15/.test(text));
  unmount();
});

test("the review lists all selected tables using respondent-facing labels", async () => {
  const { container, user, unmount } = renderQuiz();
  await reachReviewWithRecruitmentTypes(user);
  const text = container.textContent ?? "";
  for (const table of PP_SECTION4_TABLES) {
    assert.ok(text.includes(`${table.number} ${table.name.fr}`), `missing ${table.number}`);
  }
  assert.ok(screen.getByRole("heading", { name: /Vérifiez vos réponses/i }));
  assert.ok(!/S[0-9]Q[0-9]{2}/.test(text));
  unmount();
});

test("re-opening a closed table clears its derived zeros when the quiz is confirmed", async () => {
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
  const { user, changes, unmount } = renderQuiz(closed);
  await next(user);
  await user.click(within(screen.getByRole("radiogroup")).getByRole("radio", { name: "Oui" }));
  await chooseNo(user);
  await chooseNo(user);
  await user.click(screen.getByRole("button", { name: /Confirmer et ouvrir les tableaux/i }));

  assert.ok(changes.some(([id, value]) => id === "S4Q01_RESPONSE_STATUS" && value === "REPORTED"));
  const cleared = changes.filter(([id, value]) => id.startsWith("pp_s4q01_") && value === "");
  assert.ok(cleared.length >= 2, `zeros left behind: ${JSON.stringify(changes)}`);
  assert.ok(changes.some(([id, value]) => id === "S4Q02_RESPONSE_STATUS" && value === "NONE"));
  unmount();
});

test("a nil declaration still requires confirmation in a named dialog", async () => {
  const { user, unmount } = renderQuiz();
  const checks = screen.getAllByRole("checkbox");
  await user.click(checks.at(-1)!); // no beneficiaries
  await next(user);
  await chooseNo(user);
  await chooseNo(user);
  await user.click(within(screen.getByRole("radiogroup")).getByRole("radio", { name: "Non" }));
  await user.click(screen.getByRole("button", { name: /Confirmer et ouvrir les tableaux|Confirm and open the tables/ }));

  const dialog = screen.getByRole("dialog");
  assert.ok(dialog.getAttribute("aria-labelledby"));
  assert.ok((dialog.textContent ?? "").includes("Confirmer une déclaration à néant"));
  unmount();
});

test("an outcome is recognised from a forecast column, not mistaken for no beneficiaries", () => {
  const { container, unmount } = renderQuiz({ s3kpi_employed_outlook_dec: 40 });
  const boxes = within(container).getAllByRole("checkbox");
  assert.equal((boxes[0] as HTMLInputElement).checked, true, "the forecast outcome is selected");
  assert.equal((boxes.at(-1) as HTMLInputElement).checked, false, "the nil declaration is not selected");
  unmount();
});
