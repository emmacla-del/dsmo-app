// Pins the section-rail gate (N2) and the restored-position check (N3)
// shared by the ONEFOP wizards. Pure logic, no DOM — run with `npm test`.

import assert from "node:assert/strict";
import test from "node:test";

import {
  firstIncompleteStep,
  gatedStep,
  railLock,
  resolveRestoredPosition,
  stepOrdinal,
  type RailGateModel,
} from "./wizard-rail-gate";

const section = (index: number) => ({ kind: "section" as const, index });
const quiz = { kind: "quiz" as const };

// Five sections, quiz after section 0 (VT layout), section 2 incomplete.
const vt: RailGateModel = {
  sectionComplete: [true, true, false, false, true],
  quizAfterIndex: 0,
  quizComplete: true,
};

test("the quiz sits between its section and the next one", () => {
  assert.equal(stepOrdinal(section(0), 0) < stepOrdinal(quiz, 0), true);
  assert.equal(stepOrdinal(quiz, 0) < stepOrdinal(section(1), 0), true);
});

test("backward jumps are always allowed, even past an incomplete section", () => {
  assert.equal(railLock(vt, section(0), section(4)), null);
  assert.equal(railLock(vt, section(3), section(4)), null);
  assert.equal(railLock(vt, quiz, section(4)), null);
  assert.equal(railLock(vt, section(1), section(1)), null, "the current step itself");
});

test("forward jumps reach up to and including the first incomplete section", () => {
  assert.equal(railLock(vt, section(1), section(0)), null);
  assert.equal(railLock(vt, section(2), section(0)), null);
  assert.deepEqual(railLock(vt, section(3), section(0)), { reason: "section", sectionIndex: 2 });
  assert.deepEqual(railLock(vt, section(4), section(2)), { reason: "section", sectionIndex: 2 });
  assert.deepEqual(gatedStep(vt, section(4), section(0)), section(2), "a locked jump lands on the blocker");
});

test("sections after an incomplete quiz stay locked; the quiz itself is reachable", () => {
  const model: RailGateModel = { sectionComplete: [true, true, true], quizAfterIndex: 0, quizComplete: false };
  assert.equal(railLock(model, quiz, section(0)), null);
  assert.deepEqual(railLock(model, section(1), section(0)), { reason: "quiz" });
  assert.deepEqual(railLock(model, section(2), quiz), { reason: "quiz" });
  assert.deepEqual(gatedStep(model, section(2), section(0)), quiz);
  assert.deepEqual(firstIncompleteStep(model), { reason: "quiz" });
});

test("an incomplete section before the quiz locks the quiz too", () => {
  const model: RailGateModel = { sectionComplete: [false, true, true], quizAfterIndex: 0, quizComplete: false };
  assert.deepEqual(railLock(model, quiz, section(0)), { reason: "section", sectionIndex: 0 });
  assert.deepEqual(railLock(model, section(2), section(0)), { reason: "section", sectionIndex: 0 });
});

test("the earliest blocker wins: quiz before a later incomplete section", () => {
  const model: RailGateModel = { sectionComplete: [true, true, false, true], quizAfterIndex: 1, quizComplete: false };
  assert.deepEqual(firstIncompleteStep(model), { reason: "quiz" });
  assert.deepEqual(railLock(model, section(3), section(0)), { reason: "quiz" });
  assert.equal(railLock(model, section(1), section(0)), null, "the section before the quiz is open");
});

test("a closed training centre (no quiz, waived sections complete) is not trapped", () => {
  const closed: RailGateModel = { sectionComplete: [true, true, true, true], quizAfterIndex: null, quizComplete: false };
  assert.equal(railLock(closed, section(3), section(0)), null);
  assert.equal(railLock(closed, quiz, section(0)), null);
  assert.equal(firstIncompleteStep(closed), null);
});

test("from the review stage (no current step) only the forward rule applies", () => {
  assert.equal(railLock(vt, section(2), null), null);
  assert.deepEqual(railLock(vt, section(3), null), { reason: "section", sectionIndex: 2 });
});

test("a restored position is clamped and falls back to the first incomplete step", () => {
  assert.deepEqual(resolveRestoredPosition(vt, { stage: "section", sectionIndex: 1 }), section(1));
  assert.deepEqual(resolveRestoredPosition(vt, { stage: "section", sectionIndex: 4 }), section(2), "now locked");
  assert.deepEqual(resolveRestoredPosition(vt, { stage: "section", sectionIndex: 99 }), section(2), "clamped, then gated");
  const done: RailGateModel = { ...vt, sectionComplete: [true, true, true, true, true] };
  assert.deepEqual(resolveRestoredPosition(done, { stage: "section", sectionIndex: 99 }), section(4));
  assert.deepEqual(resolveRestoredPosition(done, { stage: "section", sectionIndex: -3 }), section(0));
});

test("a restored quiz or review position", () => {
  assert.deepEqual(resolveRestoredPosition(vt, { stage: "quiz", sectionIndex: 0 }), quiz);
  const noQuiz: RailGateModel = { ...vt, quizAfterIndex: null };
  assert.deepEqual(resolveRestoredPosition(noQuiz, { stage: "quiz", sectionIndex: 0 }), section(0));
  const blockedQuiz: RailGateModel = { ...vt, sectionComplete: [false, true, true, true, true] };
  assert.deepEqual(resolveRestoredPosition(blockedQuiz, { stage: "quiz", sectionIndex: 0 }), section(0));
  assert.deepEqual(resolveRestoredPosition(vt, { stage: "review", sectionIndex: 3 }), { kind: "review" }, "review is not gated");
  assert.deepEqual(
    resolveRestoredPosition({ sectionComplete: [], quizAfterIndex: null, quizComplete: true }, { stage: "section", sectionIndex: 2 }),
    section(0),
  );
});
