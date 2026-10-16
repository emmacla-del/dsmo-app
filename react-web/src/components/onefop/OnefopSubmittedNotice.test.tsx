import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OnefopSubmittedNotice } from "./OnefopSubmittedNotice";

const submission = {
  id: "266d6f2a-0695-4567-87bb-c52e8fc42daa",
  submissionId: "b1a1404c-cc71-4727-8407-710fed7d2259",
  status: "PENDING_REVIEW",
  quarterCode: "QUARTERLY_2026_T4_001",
  submittedAt: "2026-10-15T10:00:00.000Z",
};

test("says when it was submitted, its reference, and that it can no longer be changed", () => {
  const { container } = renderWithProviders(<OnefopSubmittedNotice submission={submission} />, { locale: "en" });
  const text = container.textContent ?? "";
  assert.match(text, /Q4 2026/);
  assert.match(text, /#b1a1404c/);
  assert.match(text, /awaiting review/);
  assert.match(text, /can no longer be changed/);
  assert.equal(container.querySelectorAll("input, textarea, select").length, 0);
  assert.equal(container.querySelectorAll(".cam-button-primary").length, 1, "one primary action");
  assert.equal(screen.getByRole("link", { name: "Back to home" }).getAttribute("href"), "/home");
});

test("an endorsed declaration says so, in French too", () => {
  const { container } = renderWithProviders(
    <OnefopSubmittedNotice submission={{ ...submission, status: "APPROVED" }} />,
    { locale: "fr" },
  );
  assert.match(container.textContent ?? "", /visée par l'ONEFOP/);
});
