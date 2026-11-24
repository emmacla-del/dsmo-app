import { renderWithProviders } from "@/test/render";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { WizardShell } from "./WizardShell";
import { schemaEntity, schemaField } from "@/test/schema";
import type { OnefopEntity } from "@/lib/onefop-schema";
import { writeWizardPosition } from "@/lib/wizard-position";
import { buildVtFixedRowGridDefinition } from "./tables/vtFixedRowGrid";
import { matrixDataColumnWidthsPx } from "./tables/StatisticalGridRenderer";
import { widestTableFromColumnWidthsPx } from "./tables/tableLayout";

// Defect 6 (2026-10-16): table 5.3 scrolled inside the wizard at 1280px in
// English. Its columns are 142px wide (from their headings), but the content
// column was sized at 89px a column and stayed at the 760px reading measure.

const vt = schemaEntity("vocationalTraining");
const t53 = schemaField("vocationalTraining", "VT5_6");
const s5 = vt.sections.find((s) => s.id === "section5_vocationalTraining")!;
const entity: OnefopEntity = {
  ...vt,
  sections: [
    { ...vt.sections[0], fields: [schemaField("vocationalTraining", "VT1_3")], subsections: [] },
    { ...s5, fields: [t53], subsections: [] },
  ],
};
const KEY = "width-test";

// Section 1 sits after the quiz. An unanswered quiz restores there as the
// quiz, so the section-width check answers the quiz first (every root
// question Non; the follow-up is then not asked).
const quizAnswered = {
  _scopeConfig: {
    vocationalTraining: {
      unemployedQualified: false,
      informalSector: false,
      vulnerable: false,
      scholarships: false,
      formerStudents: false,
      trainersWithDisability: false,
    },
  },
};

afterEach(() => sessionStorage.clear());

test("the content column takes 5.3's real width in English", () => {
  const wanted = widestTableFromColumnWidthsPx([matrixDataColumnWidthsPx(buildVtFixedRowGridDefinition(t53), "en")]);
  assert.ok(wanted > 760, `5.3 needs more than the 760px reading measure (${wanted}px)`);
  writeWizardPosition(KEY, { stage: "section", sectionIndex: 1 });
  const { container } = renderWithProviders(
    <WizardShell entity={entity} data={quizAnswered} onChange={() => {}} positionKey={KEY} />,
    { locale: "en", queryData: [[["onefop", "active-quarter"], { code: "QUARTERLY_2026_T4_001", isOpen: true }]] },
  );
  const pod = container.querySelector(".cam-wizard-pod") as HTMLElement;
  assert.ok(pod, "the content pod");
  assert.equal(pod.classList.contains("cam-wizard-pod--quiz"), false);
  assert.match(pod.style.maxWidth, new RegExp(`${wanted}px`));
});

test("the quiz column uses the wider quiz measure, centred in the pane", () => {
  writeWizardPosition(KEY, { stage: "quiz", sectionIndex: 0 });
  const { container } = renderWithProviders(
    <WizardShell entity={entity} data={{}} onChange={() => {}} positionKey={KEY} />,
    { locale: "en", queryData: [[["onefop", "active-quarter"], { code: "QUARTERLY_2026_T4_001", isOpen: true }]] },
  );
  const pod = container.querySelector(".cam-wizard-pod") as HTMLElement;
  assert.ok(pod, "the content pod");
  assert.ok(pod.classList.contains("cam-wizard-pod--quiz"));
  assert.match(pod.style.maxWidth, /var\(--cam-container-quiz\)/);
});
