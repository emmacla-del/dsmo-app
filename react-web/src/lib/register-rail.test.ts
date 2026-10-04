import assert from "node:assert/strict";
import { test } from "node:test";

import { REGISTRATION_STEP_IDS } from "@/lib/register-constants";
import {
  firstIncompleteWithin,
  railItemEnabled,
  railItemShowsCheck,
  railItemState,
  railStateLabelKey,
  type RailContext,
} from "@/lib/register-rail";

const STEPS = REGISTRATION_STEP_IDS;

function ctx(overrides: Partial<RailContext> = {}): RailContext {
  return {
    currentIndex: 0,
    reached: 0,
    completed: [false, false, false, false, false, false],
    ...overrides,
  };
}

test("a section past the furthest revealed one is locked", () => {
  const c = ctx({ reached: 2, currentIndex: 2 });
  assert.equal(railItemState(3, c), "locked");
  assert.equal(railItemState(5, c), "locked");
  // Locked is the one state the respondent cannot click into: progressive
  // disclosure is the questionnaire's own mechanism and the rail must not
  // offer a way around it.
  assert.equal(railItemEnabled(railItemState(3, c)), false);
});

test("a complete section the respondent is not in shows a check", () => {
  const c = ctx({
    reached: 3,
    currentIndex: 3,
    completed: [true, true, true, false, false, false],
  });
  assert.equal(railItemState(0, c), "done");
  assert.equal(railItemState(1, c), "done");
  assert.equal(railItemShowsCheck(railItemState(0, c)), true);
  assert.equal(railItemEnabled(railItemState(0, c)), true);
});

test("a complete section AHEAD of the respondent is also done", () => {
  // Reached review, then went back to section 1 from the rail. The sections
  // in between are still answered, and saying otherwise would read as having
  // lost them.
  const c = ctx({
    reached: 5,
    currentIndex: 1,
    completed: [true, true, true, true, true, false],
  });
  assert.equal(railItemState(3, c), "done");
  assert.equal(railItemState(4, c), "done");
});

test("the current section is gold, and soft green only when complete", () => {
  const incomplete = ctx({ reached: 2, currentIndex: 2 });
  assert.equal(railItemState(2, incomplete), "current");
  assert.equal(railItemShowsCheck(railItemState(2, incomplete)), false);

  const revisited = ctx({
    reached: 4,
    currentIndex: 2,
    completed: [true, true, true, true, false, false],
  });
  assert.equal(railItemState(2, revisited), "currentComplete");
  // Never a check mark on the section in hand: the gold ring already says
  // "you are here", and two marks on one circle is two messages.
  assert.equal(railItemShowsCheck(railItemState(2, revisited)), false);
});

test("a revealed but unanswered section the respondent left is 'revealed'", () => {
  const c = ctx({
    reached: 4,
    currentIndex: 4,
    completed: [true, true, false, true, false, false],
  });
  assert.equal(railItemState(2, c), "revealed");
  assert.equal(railItemEnabled(railItemState(2, c)), true);
  assert.equal(railItemShowsCheck(railItemState(2, c)), false);
});

test("Recapitulatif never shows a check before submit", () => {
  // isSectionComplete("review") is false by construction, so whatever
  // position the respondent is in, the last circle cannot claim the
  // registration is finished.
  const reviewIndex = STEPS.indexOf("review");
  for (const currentIndex of [0, 3, reviewIndex]) {
    const c = ctx({
      reached: reviewIndex,
      currentIndex,
      completed: [true, true, true, true, true, false],
    });
    assert.equal(
      railItemShowsCheck(railItemState(reviewIndex, c)),
      false,
      `review must not show a check while current is ${currentIndex}`
    );
  }
});

test("every state has its own accessible wording", () => {
  const keys = (["done", "current", "currentComplete", "revealed", "locked"] as const).map(
    railStateLabelKey
  );
  // current and currentComplete deliberately share one: both are "you are
  // here", and the fill is what distinguishes them visually.
  assert.deepEqual(new Set(keys).size, 4);
  assert.equal(railStateLabelKey("locked"), "railStateLocked");
  assert.equal(railStateLabelKey("done"), "railStateDone");
});

test("firstIncompleteWithin lands on the first gap, not the furthest reach", () => {
  // What a restored draft needs: the password is never stored, so security
  // comes back incomplete and is where the work resumes.
  const complete = new Set(["entityType", "respondent", "entityInfo", "location"]);
  assert.equal(
    firstIncompleteWithin(STEPS, 4, (s) => complete.has(s)),
    STEPS.indexOf("security")
  );
  // Nothing missing: stay at the furthest revealed section.
  assert.equal(firstIncompleteWithin(STEPS, 2, () => true), 2);
  // Nothing answered at all: the first section.
  assert.equal(firstIncompleteWithin(STEPS, 3, () => false), 0);
});
