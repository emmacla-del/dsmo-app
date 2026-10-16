import { renderWithProviders } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaEntity } from "@/test/schema";
import { VtWizardSectionScreen } from "./VtWizardSectionScreen";

const vt = schemaEntity("vocationalTraining");
const s9 = vt.sections.find((s) => s.id === "section9_vocationalTraining")!;

// Defect 16 (2026-10-16 run): the paper form's signature and stamp boxes are
// for the printed copy; the respondent cannot use them on screen. The
// official PDF keeps them (vocationalTraining.hbs).
test("Section 9 shows no paper signature or stamp block, in either language", () => {
  for (const locale of ["fr", "en"] as const) {
    const { container, unmount } = renderWithProviders(
      <VtWizardSectionScreen section={s9} data={{}} onChange={() => {}} isFirst={false} isLast onBack={() => {}} onNext={() => {}} />,
      { locale },
    );
    const text = container.textContent ?? "";
    assert.ok(text.length > 0, "the section renders");
    assert.doesNotMatch(text, /signature|cachet|stamp/i);
    unmount();
  }
});
