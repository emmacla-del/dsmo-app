import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { VtAdvisoryCoherenceNotice } from "./VtAdvisoryCoherenceNotice";

// The advisory coherence notice under a Section 4 table (CLAUDE.md §7).

// The exact shape checkVtCoherence stores.
const AGE = {
  code: "VT_TRAINEE_AGE_ENTRANT_MISMATCH",
  message:
    "Effectif total des apprenants par diplôme professionnel (4.2: 10, hommes) " +
    "ne correspond pas au total des entrants par tranche d'âge (4.7 entrants: 8, hommes).",
};

test("shows the flag of the table on screen, in the reader's language, with a link to the other table", async () => {
  const opened: string[] = [];
  const { user } = renderWithProviders(
    <VtAdvisoryCoherenceNotice flags={[AGE]} tableFieldIds={["VT4_7"]} onOpenTable={(id) => opened.push(id)} />,
    { locale: "en" },
  );
  const notice = screen.getByRole("status");
  assert.match(notice.textContent ?? "", /One figure to check/);
  assert.match(notice.textContent ?? "", /Trainees by vocational diploma \(4\.2: 10, men\) do not match incoming trainees by age group \(4\.7 incoming: 8, men\)\./);
  assert.match(notice.textContent ?? "", /does not stop your declaration/);
  // Advisory, not an error: no alert, amber rather than the error red.
  assert.equal(screen.queryByRole("alert"), null);
  assert.match(notice.getAttribute("style") ?? "", /--cam-warning/);
  assert.doesNotMatch(notice.innerHTML, /--cam-error/);

  await user.click(screen.getByRole("button", { name: "Open table 4.2" }));
  assert.deepEqual(opened, ["VT4_2"]);
});

test("in French by default", () => {
  renderWithProviders(<VtAdvisoryCoherenceNotice flags={[AGE]} tableFieldIds={["VT4_2"]} onOpenTable={() => {}} />);
  assert.match(screen.getByRole("status").textContent ?? "", /Un chiffre à vérifier/);
  assert.ok(screen.getByRole("button", { name: "Ouvrir le tableau 4.7" }));
});

test("shows nothing with no flag, or none for the table on screen", () => {
  const { container, rerender } = renderWithProviders(
    <VtAdvisoryCoherenceNotice flags={[]} tableFieldIds={["VT4_7"]} onOpenTable={() => {}} />,
  );
  assert.equal(container.innerHTML, "");
  rerender(<VtAdvisoryCoherenceNotice flags={[AGE]} tableFieldIds={["VT4_8"]} onOpenTable={() => {}} />);
  assert.equal(container.innerHTML, "");
});
