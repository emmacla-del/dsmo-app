import { act, renderWithProviders, screen, within } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { VtScopeQuiz } from "./VtScopeQuiz";
import { schemaEntity } from "@/test/schema";
import { VT_QUIZ_QUESTIONS } from "@/lib/vt-quiz";
import type { FormData } from "@/lib/onefop-schema";

const vt = schemaEntity("vocationalTraining");

function renderQuiz(data: FormData = {}) {
  const changes: Array<[string, unknown]> = [];
  let completed = 0;
  // Stands in for the wizard's bottom bar, whose Suivant drives the quiz.
  const validateRef: { current: (() => void) | null } = { current: null };
  const result = renderWithProviders(
    <VtScopeQuiz
      entity={vt}
      data={data}
      onChange={(id, v) => changes.push([id, v])}
      onComplete={() => {
        completed += 1;
      }}
      validateRef={validateRef}
      quarterCode="QUARTERLY_2026_T4_001"
      locale="fr"
    />,
  );
  /** Presses the bottom bar's Suivant. */
  const pressNext = () =>
    act(() => {
      validateRef.current?.();
    });
  return { ...result, changes, completedCount: () => completed, pressNext };
}

/** The Oui/Non pair of the quiz question whose text matches. */
function pair(text: RegExp) {
  const group = screen.getByRole("radiogroup", { name: text });
  return {
    group,
    oui: within(group).getByRole("radio", { name: "Oui" }),
    non: within(group).getByRole("radio", { name: "Non" }),
  };
}

const Q1 = /apprenants qualifiés/; // unemployedQualified, table 4.3
const Q2 = /secteur informel/; // informalSector, table 4.4
const FORMER = /sortants l'année antérieure \?/; // formerStudents (parent)
const PLACED = /ont-ils été insérés/; // formerStudentsPlaced (follow-up)

test("every unanswered Oui/Non pair is one tab stop: Tab moves from question to question, not from Oui to Non", async () => {
  const { user } = renderQuiz();
  const q1 = pair(Q1);
  const q2 = pair(Q2);

  assert.equal(q1.oui.tabIndex, 0);
  assert.equal(q1.non.tabIndex, -1);
  assert.equal(q1.oui.getAttribute("aria-checked"), "false");
  assert.equal(q1.non.getAttribute("aria-checked"), "false", "unanswered is neither Oui nor Non");

  await user.tab();
  assert.equal(document.activeElement, q1.oui);
  await user.tab();
  assert.equal(document.activeElement, q2.oui, "the second Tab skips Non and reaches the next question");
});

test("ArrowRight chooses Non and moves focus to it; ArrowLeft chooses Oui again", async () => {
  const { user } = renderQuiz();
  await user.tab();
  const q1 = pair(Q1);
  assert.equal(document.activeElement, q1.oui);

  await user.keyboard("{ArrowRight}");
  assert.equal(q1.non.getAttribute("aria-checked"), "true");
  assert.equal(q1.oui.getAttribute("aria-checked"), "false");
  assert.equal(document.activeElement, q1.non);
  // The chosen answer is now the pair's single tab stop.
  assert.equal(q1.non.tabIndex, 0);
  assert.equal(q1.oui.tabIndex, -1);

  await user.keyboard("{ArrowLeft}");
  assert.equal(q1.oui.getAttribute("aria-checked"), "true");
  assert.equal(q1.non.getAttribute("aria-checked"), "false");
  assert.equal(document.activeElement, q1.oui);
});

test("the follow-up question is asked only after Oui to its parent, and withdrawn by Non", async () => {
  const { user } = renderQuiz();
  assert.equal(screen.queryByRole("radiogroup", { name: PLACED }), null);

  await user.click(pair(FORMER).oui);
  assert.ok(screen.getByRole("radiogroup", { name: PLACED }));

  await user.click(pair(FORMER).non);
  assert.equal(screen.queryByRole("radiogroup", { name: PLACED }), null);
});

test("the intro names the campaign, not tables", () => {
  renderQuiz();
  assert.ok(screen.getByText("Répondez à chaque question pour le 4e trimestre 2026."));
  assert.equal(screen.queryByText(/tableau/i), null);
});

test("Suivant with a question unanswered marks each gap and does not continue", () => {
  const { completedCount, changes, pressNext } = renderQuiz();
  assert.equal(screen.queryByRole("button", { name: /Valider|Retour/ }), null, "the quiz has no buttons of its own");
  pressNext();
  assert.equal(completedCount(), 0);
  assert.equal(changes.length, 0);
  const topLevel = VT_QUIZ_QUESTIONS.filter((q) => !q.parent);
  assert.equal(screen.getAllByText("Répondez à cette question.").length, topLevel.length);
  assert.equal(pair(Q1).group.getAttribute("aria-invalid"), "true");
  assert.equal(document.activeElement, pair(Q1).group, "focus moves to the first unanswered question");
});

test("once every asked question is answered, Suivant records the answers and continues", async () => {
  const { user, changes, completedCount, pressNext } = renderQuiz();

  // Every top-level question Non (the follow-up is then not asked).
  const topLevel = VT_QUIZ_QUESTIONS.filter((q) => !q.parent);
  for (const q of topLevel) {
    const group = screen.getByRole("radiogroup", { name: q.text.fr });
    await user.click(within(group).getByRole("radio", { name: "Non" }));
  }
  pressNext();
  assert.equal(completedCount(), 1);
  const scope = changes.find(([id]) => id === "_scopeConfig");
  assert.ok(scope, "the quiz answers are written to _scopeConfig");
  const answers = (scope[1] as { vocationalTraining: Record<string, unknown> }).vocationalTraining;
  for (const q of topLevel) assert.equal(answers[q.id], false, `${q.id} recorded as Non`);
  assert.equal(answers.formerStudentsPlaced, undefined, "an unasked follow-up is not recorded");
  assert.equal(typeof answers.completedAt, "string");
});

test("Non to a question whose figures are already typed warns under it, then erases only those cells", async () => {
  const data: FormData = {
    s4q3_row1_fiMale: 4,
    s4q3_row1_specialtyText: "Menuiserie",
    VT1_3: "CFP", // an ordinary answer outside the table: never touched
  };
  const { user, changes, pressNext } = renderQuiz(data);

  await user.click(pair(Q1).non);
  // The warning sits under the question answered Non, and names no table.
  const warning = within(pair(Q1).group.closest("li") as HTMLElement).getByRole("status");
  assert.match(warning.textContent ?? "", /seront effacés/);
  assert.doesNotMatch(warning.textContent ?? "", /tableau|4\.3/);

  for (const q of VT_QUIZ_QUESTIONS.filter((x) => !x.parent && x.id !== "unemployedQualified")) {
    const group = screen.getByRole("radiogroup", { name: q.text.fr });
    await user.click(within(group).getByRole("radio", { name: "Oui" }));
  }
  await user.click(pair(FORMER).oui);
  await user.click(pair(PLACED).oui);
  pressNext();

  const erased = changes.filter(([, v]) => v === undefined).map(([id]) => id).sort();
  assert.deepEqual(erased, ["s4q3_row1_fiMale", "s4q3_row1_specialtyText"]);
  assert.ok(!changes.some(([id]) => id === "VT1_3"));
});
