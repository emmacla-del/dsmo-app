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

// Defect 17: 9.1 "Other" and 9.2 write-in lines are named by their visible
// label, not by a placeholder; the required first line of 9.2 has no asterisk.
test("the 9.1 and 9.2 write-in lines are labelled inputs", () => {
  const { container } = renderWithProviders(
    <VtWizardSectionScreen section={s9} data={{ VT9_1: "Oui/ Yes" }} onChange={() => {}} isFirst={false} isLast onBack={() => {}} onNext={() => {}} />,
    { locale: "en" },
  );
  const byLabel = (id: string) => container.querySelector<HTMLInputElement>(`#${id}`);
  for (let i = 1; i <= 5; i++) {
    for (const [field, prefix] of [["VT9_3", "Other"], ["VT9_4", "Outlook"]] as const) {
      const input = byLabel(`${field}-slot-${i}`);
      assert.ok(input, `${field} line ${i}`);
      const label = container.querySelector(`label[for="${field}-slot-${i}"]`);
      assert.match(label?.textContent ?? "", new RegExp(`^${prefix} ${i}`));
    }
  }
  assert.equal(byLabel("VT9_4-slot-1")!.getAttribute("aria-required"), "true");
  assert.doesNotMatch(container.querySelector(`label[for="VT9_4-slot-1"]`)!.textContent ?? "", /\*/);
  assert.match(container.querySelector(`label[for="VT9_4-slot-2"]`)!.textContent ?? "", /optional/);
});
