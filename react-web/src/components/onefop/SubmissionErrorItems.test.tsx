import { renderWithProviders, screen, fireEvent } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { SubmissionErrorItems } from "./SubmissionErrorItems";
import type { SubmissionErrorTarget } from "@/lib/onefop-submission";

const target: SubmissionErrorTarget = { sectionIndex: 3, fieldId: "S21Q01", label: "Demandes d'emploi (Section 2)" };
const detail = {
  summary: "Votre déclaration n'a pas été transmise",
  items: [target.label, "2 élément(s) que le formulaire ne vous présente pas ont aussi été refusés."],
  targets: [target],
};

test("C5. a refused table is a link to it; a line naming no place stays text", () => {
  const picked: SubmissionErrorTarget[] = [];
  const { unmount } = renderWithProviders(<SubmissionErrorItems detail={detail} onGoTo={(t) => picked.push(t)} />);
  fireEvent.click(screen.getByRole("button", { name: target.label }));
  assert.deepEqual(picked, [target]);
  assert.equal(screen.queryAllByRole("button").length, 1);
  assert.ok(screen.getByText(/2 élément\(s\)/));
  unmount();
});

test("C5. with nowhere to go, the tables are named as plain text", () => {
  const { unmount } = renderWithProviders(<SubmissionErrorItems detail={detail} />);
  assert.equal(screen.queryAllByRole("button").length, 0);
  assert.ok(screen.getByText(target.label));
  unmount();
});
