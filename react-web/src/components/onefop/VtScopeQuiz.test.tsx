import { renderWithProviders, screen, within } from "@/test/render";
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
  const result = renderWithProviders(
    <VtScopeQuiz
      entity={vt}
      data={data}
      onChange={(id, value) => changes.push([id, value])}
      onComplete={() => { completed += 1; }}
      onBack={() => {}}
      locale="fr"
    />,
  );
  return { ...result, changes, completedCount: () => completed };
}

function currentQuestion() {
  return within(screen.getByRole("radiogroup"));
}

async function answerCurrent(user: { click: (el: Element) => Promise<void> }, value: "Oui" | "Non") {
  await user.click(currentQuestion().getByRole("radio", { name: value }));
}

const firstQuestion = VT_QUIZ_QUESTIONS[0];

test("the VT quiz presents one labelled Oui/Non question at a time", () => {
  renderQuiz();
  const group = screen.getByRole("radiogroup", { name: firstQuestion.text.fr });
  assert.equal(within(group).getAllByRole("radio").length, 2);
  assert.equal(screen.getAllByRole("radiogroup").length, 1);
  assert.ok(screen.getByRole("heading", { level: 1 }));
});

test("answering a question advances; changing the parent controls its follow-up", async () => {
  const { user } = renderQuiz();
  // Move to former students.
  for (let i = 0; i < 4; i++) await answerCurrent(user, "Non");
  assert.match(screen.getByRole("radiogroup").getAttribute("aria-label") ?? "", /sortants/i);
  await answerCurrent(user, "Oui");
  assert.match(screen.getByRole("radiogroup").getAttribute("aria-label") ?? "", /insérés/i);
  await user.click(within(screen.getByRole("radiogroup")).getByRole("radio", { name: "Oui" }));
  await answerCurrent(user, "Non");
  assert.ok(screen.getByRole("heading", { name: /réponses/i }));
});

test("a completed quiz shows a review and confirms answers into scope config", async () => {
  const { user, changes, completedCount } = renderQuiz();
  for (const question of VT_QUIZ_QUESTIONS.filter((q) => !q.parent)) {
    const group = screen.getByRole("radiogroup", { name: question.text.fr });
    await user.click(within(group).getByRole("radio", { name: "Non" }));
  }
  assert.ok(screen.getByRole("heading", { name: /centre de formation/i }));
  await user.click(screen.getByRole("button", { name: /Confirmer et ouvrir les tableaux/i }));
  assert.equal(completedCount(), 1);
  const scope = changes.find(([id]) => id === "_scopeConfig");
  assert.ok(scope, "the answers are saved in _scopeConfig");
  const answers = (scope[1] as { vocationalTraining: Record<string, unknown> }).vocationalTraining;
  for (const question of VT_QUIZ_QUESTIONS.filter((q) => !q.parent)) {
    assert.equal(answers[question.id], false, `${question.id} recorded as Non`);
  }
  assert.equal(answers.formerStudentsPlaced, undefined, "an unasked follow-up is not recorded");
  assert.equal(typeof answers.completedAt, "string");
});

test("answer review links return to a question and a No warns before clearing typed table cells", async () => {
  const data: FormData = {
    s4q3_row1_fiMale: 4,
    s4q3_row1_specialtyText: "Menuiserie",
    VT1_3: "CFP",
  };
  const { user, changes } = renderQuiz(data);
  await answerCurrent(user, "Non");
  // The first answer turns off table 4.3, so the respondent stays to see the warning.
  assert.ok(screen.getByRole("status"));
  await user.click(screen.getByRole("button", { name: /Continuer|Continue/ }));
  for (const question of VT_QUIZ_QUESTIONS.filter((q) => !q.parent && q.id !== firstQuestion.id)) {
    const group = screen.getByRole("radiogroup", { name: question.text.fr });
    await user.click(within(group).getByRole("radio", { name: question.id === "formerStudents" ? "Oui" : "Non" }));
    if (question.id === "formerStudents") {
      const followUp = VT_QUIZ_QUESTIONS.find((q) => q.parent === question.id)!;
      await user.click(within(screen.getByRole("radiogroup", { name: followUp.text.fr })).getByRole("radio", { name: "Oui" }));
    }
  }
  await user.click(screen.getByRole("button", { name: /Confirmer et ouvrir les tableaux/i }));
  const erased = changes.filter(([, value]) => value === undefined).map(([id]) => id).sort();
  assert.deepEqual(erased, ["s4q3_row1_fiMale", "s4q3_row1_specialtyText"]);
  assert.ok(!changes.some(([id]) => id === "VT1_3"));
});
