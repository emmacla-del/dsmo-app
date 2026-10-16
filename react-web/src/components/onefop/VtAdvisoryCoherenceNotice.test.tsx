import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { VtAdvisoryCoherenceNotice } from "./VtAdvisoryCoherenceNotice";
import { VT_ADVISORY_RULES, type VtAdvisoryIssue } from "@/lib/vt-advisory-coherence";

// The advisory coherence notice under a Section 4 table (CLAUDE.md §7).

const rule = VT_ADVISORY_RULES[0];
const AGE: VtAdvisoryIssue = {
  code: rule.code,
  tables: ["VT4_2", "VT4_7"],
  labels: [rule.first.label, rule.second.label],
  bySex: [
    { sex: "male", first: 10, second: 8 },
    { sex: "female", first: 7, second: 9 },
  ],
  why: rule.why,
};

test("one short line with the figures and a link to the other table; the explanation behind 'Why?'", async () => {
  const opened: string[] = [];
  const { user } = renderWithProviders(
    <VtAdvisoryCoherenceNotice issues={[AGE]} tableFieldIds={["VT4_7"]} onOpenTable={(id) => opened.push(id)} />,
    { locale: "en" },
  );
  const notice = screen.getByRole("status");
  assert.match(notice.textContent ?? "", /^Inconsistent entries: men: 4\.2 = 10, 4\.7 incoming = 8; women: 4\.2 = 7, 4\.7 incoming = 9 Open table 4\.2/);
  // Advisory, not an error: no alert, amber rather than the error red.
  assert.equal(screen.queryByRole("alert"), null);
  assert.match(notice.getAttribute("style") ?? "", /--cam-warning/);
  assert.doesNotMatch(notice.innerHTML, /--cam-error/);

  const details = notice.querySelector("details")!;
  assert.equal(details.open, false, "the explanation is closed until asked for");
  await user.click(screen.getByText("Why?"));
  assert.equal(details.open, true);
  assert.match(details.textContent ?? "", /it does not stop your declaration/);

  await user.click(screen.getByRole("button", { name: "Open table 4.2" }));
  assert.deepEqual(opened, ["VT4_2"]);
});

test("in French by default, pointing from 4.2 to 4.7", () => {
  renderWithProviders(<VtAdvisoryCoherenceNotice issues={[AGE]} tableFieldIds={["VT4_2"]} onOpenTable={() => {}} />);
  assert.match(screen.getByRole("status").textContent ?? "", /^Entrées incohérentes : hommes : 4\.2 = 10, 4\.7 entrants = 8 ; femmes/);
  assert.ok(screen.getByRole("button", { name: "Ouvrir le tableau 4.7" }));
  assert.ok(screen.getByText("Pourquoi ?"));
});

test("shows nothing with no disagreement, or none for the table on screen", () => {
  const { container, rerender } = renderWithProviders(
    <VtAdvisoryCoherenceNotice issues={[]} tableFieldIds={["VT4_7"]} onOpenTable={() => {}} />,
  );
  assert.equal(container.innerHTML, "");
  rerender(<VtAdvisoryCoherenceNotice issues={[AGE]} tableFieldIds={["VT4_8"]} onOpenTable={() => {}} />);
  assert.equal(container.innerHTML, "");
});
