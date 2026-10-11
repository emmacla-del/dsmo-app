import { act, renderWithProviders, screen, within } from "@/test/render";
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { WizardShell } from "./WizardShell";
import { vtSectionHeadingId } from "./VtWizardSectionScreen";
import { schemaEntity, schemaField } from "@/test/schema";
import type { FormData, OnefopEntity, OnefopField, OnefopSection } from "@/lib/onefop-schema";
import { VT_QUIZ_QUESTIONS } from "@/lib/vt-quiz";
import { readWizardPosition, writeWizardPosition } from "@/lib/wizard-position";

// Next / Previous table by table in Sections 4 and 8
// (docs/plans/vt-table-progression.md, Phase 3).
//
// The entity keeps the real Section 4, framed by sections reduced to one
// optional question (nothing in them can fail), so the walk can start in
// Section 4 and leave it in both directions:
//   0 Section 1 · quiz · 1 filler · 2 Section 4 · 3 filler (stands for Section 5)

const vt = schemaEntity("vocationalTraining");
const sectionById = (id: string): OnefopSection => vt.sections.find((s) => s.id === id)!;
const s4 = sectionById("section4_vocationalTraining");
const optional = schemaField("vocationalTraining", "VT1_3");
const filler = (id: string, base: OnefopSection): OnefopSection => ({ ...base, id, fields: [optional], subsections: [] });

const entity: OnefopEntity = {
  ...vt,
  sections: [
    filler(vt.sections[0].id, vt.sections[0]),
    filler("test_before", vt.sections[1]),
    s4,
    filler("test_after", vt.sections[4]),
  ],
};
const S4 = 2;

/** The same frame around the real Section 8. */
const s8 = sectionById("section8_vocationalTraining");
const entity8: OnefopEntity = { ...entity, sections: entity.sections.map((s, i) => (i === S4 ? s8 : s)) };
const KEY = "test-draft";

/** Every quiz answer Oui unless overridden; 2.1.14 offers initial training (4.6 applies). */
function quiz(overrides: Record<string, boolean> = {}): FormData {
  const answers: Record<string, boolean> = {};
  for (const q of VT_QUIZ_QUESTIONS) answers[q.id] = true;
  return {
    _scopeConfig: { vocationalTraining: { ...answers, ...overrides } },
    VT2_18: ["Formation Initiale (FI)"],
  };
}

/** A complete table of zeros: every row of a fixed-row table, the first of a row-by-row one. */
function filled(fieldId: string): FormData {
  const field = vt.sections.flatMap((s) => s.fields).find((f) => f.id === fieldId) as OnefopField;
  const vtTable = field.table!.vt!;
  const rows = vtTable.progressiveRows ? field.table!.matrix!.slice(0, 1) : field.table!.matrix!;
  const out: FormData = {};
  for (const rowIds of rows) {
    rowIds.forEach((cellId, c) => {
      const kind = vtTable.cells[c]?.kind;
      if (kind === "number") out[cellId] = 0;
      else if (kind === "text") out[cellId] = "Test";
    });
  }
  return out;
}

function renderAt(data: FormData, position: { sectionIndex: number; stepIndex?: number }, shown: OnefopEntity = entity) {
  writeWizardPosition(KEY, { stage: "section", ...position });
  return renderWithProviders(
    <WizardShell entity={shown} data={data} onChange={() => {}} positionKey={KEY} />,
    { queryData: [[["onefop", "active-quarter"], { code: "2026-T1", isOpen: true }]] },
  );
}

const next = () => screen.getByRole("button", { name: /Suivant|Passer à la Validation/ });
const previous = () => screen.getByRole("button", { name: /Étape précédente|Annuler/ });
/** The open table, as the table list marks it ("4.2 …"). */
const currentTable = () => {
  const list = screen.getByText("Tableaux de cette section").closest("details") as HTMLElement;
  const current = within(list).getAllByRole("button").find((b) => b.getAttribute("aria-current") === "step");
  return current?.textContent?.match(/^\d+\.\d+/)?.[0] ?? null;
};
const sectionHeading = () => document.getElementById(vtSectionHeadingId(s4.id));
const tableProblems = () => document.body.textContent ?? "";
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

beforeEach(() => {
  sessionStorage.clear();
});

test("Next on a complete table opens the next table, focuses the heading and announces it", async () => {
  const { user } = renderAt({ ...quiz(), ...filled("VT4_1") }, { sectionIndex: S4 });
  assert.equal(currentTable(), "4.1");
  assert.ok(screen.getByText("Tableau 1 sur 11"));

  await user.click(next());
  await flush();

  assert.equal(currentTable(), "4.2");
  assert.ok(screen.getByText("Tableau 2 sur 11"));
  assert.equal(document.activeElement, sectionHeading());
  assert.ok(document.body.textContent?.includes("Apprenants, tableau 2 sur 11"), "the live region names the section as its heading does, and the table");
});

test("Next on an incomplete table stays on it and shows its problems", async () => {
  const { user } = renderAt({ ...quiz(), ...filled("VT4_1") }, { sectionIndex: S4, stepIndex: 1 });
  assert.equal(currentTable(), "4.2");

  await user.click(next());
  await flush();

  assert.equal(currentTable(), "4.2");
  assert.ok(screen.getByText(/cellule\(s\) restent à renseigner/), "4.2's own problem is shown");
});

test("tables the questionnaire switched off are skipped by Next and Previous", async () => {
  const data = { ...quiz({ unemployedQualified: false, informalSector: false }), ...filled("VT4_1"), ...filled("VT4_2") };
  const { user } = renderAt(data, { sectionIndex: S4, stepIndex: 1 });
  assert.ok(screen.getByText("Tableau 2 sur 9"));

  await user.click(next());
  await flush();
  assert.equal(currentTable(), "4.5");

  await user.click(previous());
  await flush();
  assert.equal(currentTable(), "4.2");
});

test("Previous on a table goes to the previous table without checking anything", async () => {
  const { user } = renderAt(quiz(), { sectionIndex: S4, stepIndex: 2 });
  assert.equal(currentTable(), "4.3");

  await user.click(previous());
  await flush();

  assert.equal(currentTable(), "4.2");
  assert.equal(screen.queryByText(/restent à renseigner/), null, "no problem shown on going back");
});

test("Previous on the first table leaves for the previous section", async () => {
  const { user } = renderAt(quiz(), { sectionIndex: S4 });
  await user.click(previous());
  await flush();

  assert.equal(screen.queryByText("Tableaux de cette section"), null);
  assert.equal(readWizardPosition(KEY)?.sectionIndex, S4 - 1);
});

test("Next on the last table still checks the whole section: a table skipped with the list cannot be passed", async () => {
  // 4.11 is complete, but 4.1 was never filled.
  const { user } = renderAt({ ...quiz(), ...filled("VT4_11") }, { sectionIndex: S4, stepIndex: 10 });
  assert.equal(currentTable(), "4.11");

  await user.click(next());
  await flush();

  assert.equal(currentTable(), "4.1", "opens the table holding the first problem");
  assert.equal(readWizardPosition(KEY)?.sectionIndex, S4, "still in Section 4");
});

/** Section 4 complete: tables switched off, every other one filled with zeros. */
function completeSection4(): FormData {
  return {
    ...quiz({ unemployedQualified: false, informalSector: false, vulnerable: false, formerStudents: false, scholarships: false }),
    VT2_18: ["Formation Continue (FC)"], // 4.6 off: no initial training
    ...filled("VT4_1"),
    ...filled("VT4_2"),
    ...filled("VT4_5"),
    ...filled("VT4_7"),
    ...filled("VT4_8"),
  };
}

test("Next on the last table of a complete section opens the next section", async () => {
  const data = completeSection4();
  const { user } = renderAt(data, { sectionIndex: S4, stepIndex: 7 });
  assert.equal(currentTable(), "4.8");
  assert.ok(screen.getByText("Tableau 5 sur 5"));

  await user.click(next());
  await flush();

  assert.equal(screen.queryByText("Tableaux de cette section"), null);
  assert.equal(readWizardPosition(KEY)?.sectionIndex, S4 + 1);
});

test("Previous from the next section lands on Section 4's last applicable table, not its first", async () => {
  const { user } = renderAt(completeSection4(), { sectionIndex: S4 + 1 });
  assert.equal(screen.queryByText("Tableaux de cette section"), null);

  await user.click(previous());
  await flush();

  assert.equal(currentTable(), "4.8");
  assert.equal(readWizardPosition(KEY)?.stepIndex, 7);
});

test("the table on screen is stored, and a reload reopens it", async () => {
  const data = { ...quiz(), ...filled("VT4_1") };
  const first = renderAt(data, { sectionIndex: S4 });
  await first.user.click(next());
  await flush();
  assert.deepEqual(readWizardPosition(KEY), { stage: "section", sectionIndex: S4, stepIndex: 1 });
  first.unmount();

  renderWithProviders(<WizardShell entity={entity} data={data} onChange={() => {}} positionKey={KEY} />, {
    queryData: [[["onefop", "active-quarter"], { code: "2026-T1", isOpen: true }]],
  });
  assert.equal(currentTable(), "4.2");
});

test("a position stored before tables were steps opens the section's first table", () => {
  renderAt(quiz({ unemployedQualified: false }), { sectionIndex: S4 });
  assert.equal(currentTable(), "4.1");
});

test("a §7 mismatch blocks Next on the later table of the pair, not the earlier one", async () => {
  // 4.1 counts 3 men, 4.2 none: both complete, so the comparison applies.
  const data = { ...quiz(), ...filled("VT4_1"), s4q1_doctorat_male: 3, ...filled("VT4_2") };
  const { user } = renderAt(data, { sectionIndex: S4 });

  await user.click(next());
  await flush();
  assert.equal(currentTable(), "4.2", "4.1 is complete on its own: Next passes it");

  await user.click(next());
  await flush();
  assert.equal(currentTable(), "4.2", "blocked on 4.2");
  assert.ok(tableProblems().includes("Le tableau 4.2 compte 0 hommes, mais le tableau 4.1 en compte 3 hommes"));
});

const section8Before85 = (): FormData => ({
  ...quiz(),
  ...filled("VT8_1"),
  ...filled("VT8_2"),
  ...filled("VT8_3"),
  ...filled("VT8_4"),
  VT8_5_VP_M: 0,
  VT8_5_VP_F: 0,
  VT8_5_VNP_M: 0,
  VT8_5_VNP_F: 0,
  VT8_5_PERM_M: 0,
  VT8_5_PERM_F: 0,
});

test("Section 8: 8.5's six questions are one table, and Next goes on to 8.6", async () => {
  const { user } = renderAt(section8Before85(), { sectionIndex: S4, stepIndex: 4 }, entity8);
  assert.equal(currentTable(), "8.5");

  await user.click(next());
  await flush();

  assert.equal(currentTable(), "8.6");
});

test("Section 8: trainers counted in 8.1 to 8.3 but not in 8.5 block Next on 8.5", async () => {
  const data = { ...section8Before85(), s8q1_doctorat_male: 2, s8q2_dipleg_dipes2_male: 2, s8q3_age_18_24_male: 2 };
  const { user } = renderAt(data, { sectionIndex: S4, stepIndex: 1 }, entity8);
  assert.equal(currentTable(), "8.2");

  await user.click(next());
  await flush();
  assert.equal(currentTable(), "8.3", "8.1 and 8.2 agree");
  await user.click(next());
  await flush();
  assert.equal(currentTable(), "8.4", "8.2 and 8.3 agree");
  await user.click(next());
  await flush();
  assert.equal(currentTable(), "8.5");

  await user.click(next());
  await flush();
  assert.equal(currentTable(), "8.5", "blocked on 8.5");
  assert.ok(tableProblems().includes("Le tableau 8.5 compte 0 hommes"));
});

test("a Section 4 card on the Validation screen opens the table holding the first problem, with it shown", async () => {
  // 4.1 and 4.2 complete: the first problem is in 4.3.
  sessionStorage.clear();
  writeWizardPosition(KEY, { stage: "review", sectionIndex: S4 + 1 });
  const { user } = renderWithProviders(
    <WizardShell entity={entity} data={{ ...quiz(), ...filled("VT4_1"), ...filled("VT4_2") }} onChange={() => {}} positionKey={KEY} />,
    { queryData: [[["onefop", "active-quarter"], { code: "2026-T1", isOpen: true }]] },
  );
  const card = screen.getAllByRole("button").find((b) => b.textContent?.startsWith("SECTION 3"));
  assert.ok(card, "the third section's card (Section 4 of the questionnaire, here the third)");

  await user.click(card);
  await flush();

  assert.equal(currentTable(), "4.3");
  assert.ok(screen.getByText(/cellule\(s\) restent à renseigner|Ajoutez au moins une ligne/), "4.3's problem is shown");
});

// One title per table (audit S4): the table's heading names it; the table
// itself shows no second title, in either mode.
for (const mode of ["grid", "guided"] as const) {
  for (const [shown, sectionId, stepIndex, code] of [
    [entity, s4.id, 0, "4.1"],
    [entity, s4.id, 1, "4.2"],
    [entity, s4.id, 2, "4.3"],
    [entity8, s8.id, 4, "8.5"],
    [entity8, s8.id, 7, "8.8"],
  ] as const) {
    test(`${code} in ${mode === "grid" ? "Tableau" : "Guidé"} shows one title`, () => {
      localStorage.setItem("camleap.onefop.entryMode", mode);
      renderAt(quiz(), { sectionIndex: S4, stepIndex }, shown);
      assert.equal(currentTable(), code);

      const titles = [...document.querySelectorAll("h1, h2, h3, h4, .cam-qcode")].filter(
        (el) => el.id !== vtSectionHeadingId(sectionId) && el.textContent?.trim().startsWith(code),
      );
      assert.equal(titles.length, 1, titles.map((el) => `${el.tagName}: ${el.textContent}`).join(" | "));
      assert.equal(titles[0].tagName, "H3");
      localStorage.removeItem("camleap.onefop.entryMode");
    });
  }
}

// ── §7 cross-table mismatches, all at once (audit R5) ───────────────────

/** 4.1 counts 25 men, 4.2 counts 20 and 4.5 counts 5: two mismatches. */
function twoMismatches(): FormData {
  return {
    ...quiz(),
    ...filled("VT4_1"),
    ...filled("VT4_2"),
    ...filled("VT4_5"),
    s4q1_bepc_male: 25,
    s4q2_cap_male: 20,
    s4q5_row1_fiMale: 5,
  };
}

test("a blocked Next lists every mismatch of the section, not just the one on screen", async () => {
  const { user } = renderAt(twoMismatches(), { sectionIndex: S4, stepIndex: 1 });
  assert.equal(currentTable(), "4.2");

  await user.click(next());
  await flush();

  assert.equal(currentTable(), "4.2", "4.2 cannot be left");
  assert.ok(screen.getByText("2 totaux à faire concorder"));
  const shown = tableProblems();
  assert.match(shown, /Le tableau 4\.2 compte 20 hommes, mais le tableau 4\.1 en compte 25 hommes/);
  assert.match(
    shown,
    /Le tableau 4\.5 compte 5 hommes, mais le tableau 4\.2 en compte 20 hommes/,
    "the next mismatch is not held back for another Suivant",
  );
});

test("a listed mismatch is said once, and opens either of its two tables", async () => {
  const { user } = renderAt(twoMismatches(), { sectionIndex: S4, stepIndex: 1 });
  await user.click(next());
  await flush();

  const sentence = /Le tableau 4\.2 compte 20 hommes/g;
  assert.equal((tableProblems().match(sentence) ?? []).length, 1, "the table's own inline message is not repeated");

  // 4.2 is named in both mismatches, so each of its links says which.
  assert.deepEqual(
    screen.getAllByRole("button", { name: /^Ouvrir le tableau 4\.2/ }).map((b) => b.getAttribute("aria-label")),
    [
      "Ouvrir le tableau 4.2 — comparaison des tableaux 4.1 et 4.2",
      "Ouvrir le tableau 4.2 — comparaison des tableaux 4.2 et 4.5",
    ],
  );

  await user.click(screen.getByRole("button", { name: "Ouvrir le tableau 4.1 — comparaison des tableaux 4.1 et 4.2" }));
  await flush();
  assert.equal(currentTable(), "4.1");
});
