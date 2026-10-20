import { act, renderWithProviders, screen, within } from "@/test/render";
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { WizardShell } from "./WizardShell";
import { vtSectionHeadingId } from "./VtWizardSectionScreen";
import { schemaEntity, schemaField } from "@/test/schema";
import type { FormData, OnefopEntity, OnefopField, OnefopSection } from "@/lib/onefop-schema";
import { VT_QUIZ_QUESTIONS } from "@/lib/vt-quiz";
import { readWizardPosition, writeWizardPosition } from "@/lib/wizard-position";

// Sections 4 and 8 carry their tables in one continuous column, with a list
// above it that jumps to one (owner, 2026-10-19; it was one table per screen,
// docs/plans/vt-table-progression.md). Next checks the whole section and
// leaves it, as it does in every other section.
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
/** Every grid drawn on screen. */
const tableCount = () => document.querySelectorAll("table").length;
/** The table list's entry for a table ("4.2"). */
const listEntry = (code: string) => {
  const list = screen.getByText("Tableaux de cette section").closest("details") as HTMLElement;
  return within(list)
    .getAllByRole("button")
    .find((b) => (b.textContent ?? "").startsWith(`${code} `))!;
};
const tableProblems = () => document.body.textContent ?? "";
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

beforeEach(() => {
  sessionStorage.clear();
});

test("Section 4 puts every table it keeps in one column", () => {
  renderAt(quiz(), { sectionIndex: S4 });
  assert.equal(tableCount(), 11, "the section's eleven tables are not all on screen");
  assert.equal(currentTable(), "4.1", "the list opens on the section's first table");
});

test("Next on an incomplete section stays on it and shows its problems", async () => {
  const { user } = renderAt({ ...quiz(), ...filled("VT4_1") }, { sectionIndex: S4 });

  await user.click(next());
  await flush();

  assert.ok(screen.getByText("Tableaux de cette section"), "still in Section 4");
  // Shown under the table and listed in the error summary (audit R4).
  assert.ok(screen.getAllByText(/cellules? (reste|restent) à renseigner/).length >= 1, "a table's own problem is shown");
  const summary = document.querySelector(".flow-missing-notice");
  assert.ok(summary, "the error summary is shown");
  assert.match(summary.textContent ?? "", /Il y a un problème/);
});

test("a table the questionnaire switched off is a line in the column, not a grid", () => {
  renderAt(quiz({ unemployedQualified: false, informalSector: false }), { sectionIndex: S4 });

  assert.equal(tableCount(), 9, "a table switched off is still drawn as a grid");
  assert.match(tableProblems(), /Tableau 4\.3 : aucun cas à signaler/);
  assert.match(tableProblems(), /Tableau 4\.4 : aucun cas à signaler/);
});

test("the table list jumps to a table without taking the others off screen", async () => {
  const { user } = renderAt(quiz(), { sectionIndex: S4 });

  await user.click(listEntry("4.3"));
  await flush();

  assert.equal(currentTable(), "4.3");
  assert.equal(tableCount(), 11, "the column is still whole");
  assert.equal(readWizardPosition(KEY)?.stepIndex, 2, "the table chosen is stored");
});

test("Previous leaves for the previous section without checking anything", async () => {
  const { user } = renderAt(quiz(), { sectionIndex: S4 });
  await user.click(previous());
  await flush();

  assert.equal(screen.queryByText("Tableaux de cette section"), null);
  assert.equal(readWizardPosition(KEY)?.sectionIndex, S4 - 1);
  assert.equal(screen.queryByText(/(reste|restent) à renseigner/), null, "no problem shown on going back");
});

test("Next checks the whole section: a table left blank cannot be passed", async () => {
  // 4.11 is complete, but 4.1 was never filled.
  const { user } = renderAt({ ...quiz(), ...filled("VT4_11") }, { sectionIndex: S4 });

  await user.click(next());
  await flush();

  assert.equal(currentTable(), "4.1", "the list points at the table holding the first problem");
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

test("Next on a complete section opens the next one and focuses its heading", async () => {
  const { user } = renderAt(completeSection4(), { sectionIndex: S4 });
  assert.ok(sectionHeading(), "Section 4 is open");

  await user.click(next());
  await flush();

  assert.equal(screen.queryByText("Tableaux de cette section"), null);
  assert.equal(readWizardPosition(KEY)?.sectionIndex, S4 + 1);
  assert.equal(sectionHeading(), null, "Section 4 is behind");
});

test("Previous from the next section opens Section 4 at the top of its column", async () => {
  const { user } = renderAt(completeSection4(), { sectionIndex: S4 + 1 });
  assert.equal(screen.queryByText("Tableaux de cette section"), null);

  await user.click(previous());
  await flush();

  assert.equal(currentTable(), "4.1");
  assert.equal(readWizardPosition(KEY)?.stepIndex, 0);
});

test("a position stored before tables were steps opens the section's first table", () => {
  renderAt(quiz({ unemployedQualified: false }), { sectionIndex: S4 });
  assert.equal(currentTable(), "4.1");
});

test("a §7 mismatch blocks Next and names both of its tables", async () => {
  // 4.1 counts 3 men, 4.2 none: both complete, so the comparison applies.
  const data = { ...quiz(), ...filled("VT4_1"), s4q1_doctorat_male: 3, ...filled("VT4_2") };
  const { user } = renderAt(data, { sectionIndex: S4 });

  await user.click(next());
  await flush();

  assert.equal(readWizardPosition(KEY)?.sectionIndex, S4, "the section cannot be left");
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

test("Section 8: 8.5's six questions are one entry of the list, not six", () => {
  renderAt(section8Before85(), { sectionIndex: S4 }, entity8);
  const list = screen.getByText("Tableaux de cette section").closest("details") as HTMLElement;
  const codes = within(list)
    .getAllByRole("button")
    .map((b) => (b.textContent ?? "").match(/^\d+\.\d+/)?.[0]);
  assert.deepEqual(codes, ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.8"]);
});

test("Section 8: trainers counted in 8.1 to 8.3 but not in 8.5 block Next", async () => {
  const data = { ...section8Before85(), s8q1_doctorat_male: 2, s8q2_dipleg_dipes2_male: 2, s8q3_age_18_24_male: 2 };
  const { user } = renderAt(data, { sectionIndex: S4 }, entity8);

  await user.click(next());
  await flush();

  assert.equal(readWizardPosition(KEY)?.sectionIndex, S4, "the section cannot be left");
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
  // Each section row has a "Modifier cette section" link; the third row is Section 4 here.
  const card = screen.getAllByRole("button", { name: "Modifier cette section" })[2];
  assert.ok(card, "the third section's change link (Section 4 of the questionnaire, here the third)");

  await user.click(card);
  await flush();

  assert.equal(currentTable(), "4.3");
  assert.ok(screen.getAllByText(/cellules? (reste|restent) à renseigner|Ajoutez au moins une ligne/).length >= 1, "4.3's problem is shown");
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
        (el) =>
          el.id !== vtSectionHeadingId(sectionId) &&
          // The code itself, not one it only begins: 4.1 is not 4.10.
          new RegExp(`^${code.replace(".", "\\.")}(\\D|$)`).test(el.textContent?.trim() ?? ""),
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

  assert.equal(readWizardPosition(KEY)?.sectionIndex, S4, "the section cannot be left");
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

// ── The cells a table's message counts are marked on it (audit R6) ───────

/** The cells marked on one table of the column, or on the whole screen. */
const marked = (table?: string) => {
  const root = table
    ? (document.getElementById(`vt-outline-block-${s4.id}-${table}`) ?? document.body)
    : document.body;
  return Array.from(root.querySelectorAll<HTMLElement>('[aria-invalid="true"]')).map((el) => el.id);
};

test("a blocked Next marks the cells left to fill, and only those", async () => {
  // 4.2 with one cell of its first row filled: every other cell is owed.
  const { user } = renderAt(
    { ...quiz(), ...filled("VT4_1"), s4q2_cap_male: 3 },
    { sectionIndex: S4, stepIndex: 1 },
  );
  assert.equal(currentTable(), "4.2");
  assert.deepEqual(marked(), [], "nothing is marked before Suivant is pressed");

  await user.click(next());
  await flush();

  const ids = marked();
  assert.ok(ids.length > 0, "the blank cells are marked, not just counted");
  assert.ok(ids.includes("cell-input-s4q2_cap_female"), "a blank cell of a filled row");
  assert.equal(ids.includes("cell-input-s4q2_cap_male"), false, "a cell already filled is not marked");
  assert.equal(ids.some((id) => id.endsWith("_total")), false, "a calculated cell is never owed");
});

test("the add-a-row tables mark the cells of a started row (4.3)", async () => {
  const { user } = renderAt(
    { ...quiz(), ...filled("VT4_1"), ...filled("VT4_2"), s4q3_row1_specialtyText: "Couture" },
    { sectionIndex: S4, stepIndex: 2 },
  );
  assert.equal(currentTable(), "4.3");

  await user.click(next());
  await flush();

  assert.deepEqual(marked("2"), [
    "cell-input-s4q3_row1_fiMale",
    "cell-input-s4q3_row1_fiFemale",
    "cell-input-s4q3_row1_fcMale",
    "cell-input-s4q3_row1_fcFemale",
  ]);
});

test("Defect 7: 'Saved just now' does not appear on local saving, but appears when server save succeeds", async () => {
  const data = { ...quiz(), ...filled("VT4_1") };

  // 1. Local saving flips saving true -> false: no toast
  const { rerender } = renderWithProviders(
    <WizardShell
      entity={entity}
      data={data}
      onChange={() => {}}
      positionKey={KEY}
      saving={true}
    />,
    { queryData: [[["onefop", "active-quarter"], { code: "2026-T1", isOpen: true }]] },
  );

  rerender(
    <WizardShell
      entity={entity}
      data={data}
      onChange={() => {}}
      positionKey={KEY}
      saving={false}
    />,
  );
  await flush();

  assert.equal(screen.queryByText(/Enregistré à l'instant|Saved just now/i), null, "local save must not show 'Saved just now'");

  // 2. Server save: transitions from saving to saved: toast appears
  rerender(
    <WizardShell
      entity={entity}
      data={data}
      onChange={() => {}}
      positionKey={KEY}
      serverSave={{
        state: "saving",
        savedAt: null,
        hasUnsavedChanges: true,
        onRetry: () => {},
      }}
    />,
  );
  await flush();

  rerender(
    <WizardShell
      entity={entity}
      data={data}
      onChange={() => {}}
      positionKey={KEY}
      serverSave={{
        state: "saved",
        savedAt: new Date(),
        hasUnsavedChanges: false,
        onRetry: () => {},
      }}
    />,
  );
  await flush();

  assert.ok(screen.getByText(/Enregistré à l'instant|Saved just now/i), "server save success shows 'Saved just now'");
});
