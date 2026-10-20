import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { VtAdvisoryCoherenceNotice } from "./VtAdvisoryCoherenceNotice";
import { VtQuizContext } from "./VtScopeQuiz";
import { VT_ADVISORY_RULES, type VtAdvisoryIssue } from "@/lib/vt-advisory-coherence";

// The advisory coherence notice under Section 4's column (CLAUDE.md §7).
// Each line links to both of its tables, which are a scroll apart.

const rule = VT_ADVISORY_RULES[0];
const AGE: VtAdvisoryIssue = {
  code: rule.code,
  tables: ["VT4_2", "VT4_7"],
  labels: [rule.first.label, rule.second.label],
  offTables: [],
  bySex: [
    { sex: "male", first: 10, second: 8 },
    { sex: "female", first: 7, second: 9 },
  ],
  why: rule.why,
};

test("one short line with the figures and a link to each of its tables; the explanation behind 'Why?'", async () => {
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

  // Each link is named for the comparison it belongs to, so a table named
  // in two disagreements has no two links reading alike.
  assert.deepEqual(
    screen.getAllByRole("button", { name: /^Open table/ }).map((b) => b.getAttribute("aria-label")),
    [
      "Open table 4.2 — comparison of tables 4.2 and 4.7",
      "Open table 4.7 — comparison of tables 4.2 and 4.7",
    ],
  );
  await user.click(screen.getByRole("button", { name: /^Open table 4\.2/ }));
  assert.deepEqual(opened, ["VT4_2"]);
});

test("in French by default, pointing from 4.2 to 4.7", () => {
  renderWithProviders(<VtAdvisoryCoherenceNotice issues={[AGE]} tableFieldIds={["VT4_2"]} onOpenTable={() => {}} />);
  assert.match(screen.getByRole("status").textContent ?? "", /^Entrées incohérentes : hommes : 4\.2 = 10, 4\.7 entrants = 8 ; femmes/);
  assert.ok(screen.getByRole("button", { name: /^Ouvrir le tableau 4\.7/ }));
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

test("a table switched off by the preliminary questionnaire is named as such, and the link opens the questionnaire", async () => {
  const out = VT_ADVISORY_RULES[2];
  const leavers: VtAdvisoryIssue = {
    code: out.code,
    tables: ["VT4_7", "VT4_10"],
    labels: [out.first.label, out.second.label],
    offTables: ["VT4_10"],
    bySex: [{ sex: "male", first: 3, second: 0 }],
    why: out.why,
  };
  let opened = 0;
  const { user } = renderWithProviders(
    <VtQuizContext.Provider value={{ openQuiz: () => opened++ }}>
      <VtAdvisoryCoherenceNotice issues={[leavers]} tableFieldIds={["VT4_7"]} onOpenTable={() => assert.fail("4.10 is not asked")} />
    </VtQuizContext.Provider>,
  );
  assert.match(screen.getByRole("status").textContent ?? "", /hommes : 4\.7 sortants = 3, 4\.10 \(sans objet\) = 0/);
  assert.equal(screen.queryByRole("button", { name: /^Ouvrir le tableau 4\.10/ }) === null, true, "4.10 is not asked");
  await user.click(screen.getByRole("button", { name: "Revoir le questionnaire préliminaire" }));
  assert.equal(opened, 1);
});
