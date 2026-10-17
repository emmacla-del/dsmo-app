import { fireEvent, renderWithProviders, screen } from "@/test/render";
import { validateSectionData } from "@/lib/onefop-validation";
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

// Defect 18 (2026-10-16 run): copy on the English wizard, Sections 1–5.
const sectionOf = (id: string) => vt.sections.find((s) => s.fields.some((f) => f.id === id))!;
const renderEn = (fieldId: string, data: Record<string, unknown>) =>
  renderWithProviders(
    <VtWizardSectionScreen section={sectionOf(fieldId)} data={data} onChange={() => {}} isFirst={false} isLast={false} onBack={() => {}} onNext={() => {}} />,
    { locale: "en" },
  ).container;

test("1.1 shows the code without the paper's 'Not to be filled in', and 1.15 its function in English", () => {
  const c = renderEn("VT1_1", { VT1_1: "VT26001002", VT1_15_FUNCTION: "Responsable RH" });
  const code = c.querySelector<HTMLInputElement>("#VT1_1")!;
  assert.equal(code.value, "VT26001002");
  assert.equal(code.placeholder, "");
  assert.doesNotMatch(c.textContent ?? "", /Not to be filled in/);
  assert.equal(c.querySelector<HTMLInputElement>("#VT1_15_FUNCTION")!.value, "HR Manager");
  const email = c.querySelector<HTMLInputElement>("#VT1_16_EMAIL")!;
  assert.doesNotMatch(email.placeholder, /exemple|domaine/);
});

test("5.1's count is labelled by its own question, not a bare 'Number:'", () => {
  const c = renderEn("VT5_2", { VT5_1: "Oui/ Yes" });
  const label = c.querySelector(`label[for="VT5_2"]`);
  assert.match(label?.textContent ?? "", /number of study guides for trainees/);
  assert.doesNotMatch(label?.textContent ?? "", /^Number:?$/);
});

test("2.1.13's order date shows its DD/MM/YYYY format", () => {
  const c = renderEn("VT2_17", { VT2_14: "Oui/ Yes" });
  assert.equal(c.querySelector<HTMLInputElement>("#VT2_17")?.placeholder, "DD/MM/YYYY");
});

// Audit R25: each section's title is the step's one h1 (the quiz's already
// was), so the tables' own headings sit under it.
test("a section's title is its one h1", () => {
  const { container } = renderWithProviders(
    <VtWizardSectionScreen section={s9} data={{}} onChange={() => {}} isFirst={false} isLast onBack={() => {}} onNext={() => {}} />,
  );
  const h1 = container.querySelectorAll("h1");
  assert.equal(h1.length, 1);
  assert.equal(h1[0].className, "cam-step-title");
});

// Audit R4: after Next with answers missing, a "There is a problem" summary
// at the top lists each one as a link to its question.

const s1 = vt.sections.find((s) => s.id === "section1_vocationalTraining")!;

test("the error summary lists the section's missing answers once Next was pressed", () => {
  const issues = validateSectionData(s1, {}, "en");
  assert.ok(issues.length > 1, "an empty Section 1 has several missing answers");
  const { unmount } = renderWithProviders(
    <VtWizardSectionScreen section={s1} data={{}} issues={issues} showErrorSummary onChange={() => {}} isFirst isLast={false} onBack={() => {}} onNext={() => {}} />,
    { locale: "en" },
  );
  const alert = document.querySelector(".flow-missing-notice") as HTMLElement;
  assert.ok(alert, "the summary is shown");
  assert.equal(alert.getAttribute("role"), "alert");
  assert.ok(screen.getByRole("heading", { level: 2, name: "There is a problem" }));
  assert.match(alert.textContent ?? "", new RegExp(`${issues.length} answers to fix before you continue`));
  const links = alert.querySelectorAll("a");
  assert.equal(links.length, issues.length);
  assert.equal(links[0].getAttribute("href"), `#${issues[0].fieldId}`);
  assert.equal(links[0].textContent, issues[0].message);
  fireEvent.click(links[0]);
  unmount();
});

test("no error summary before Next, even with entry warnings passed in", () => {
  const issues = validateSectionData(s1, {}, "fr");
  const { container } = renderWithProviders(
    <VtWizardSectionScreen section={s1} data={{}} issues={issues} onChange={() => {}} isFirst isLast={false} onBack={() => {}} onNext={() => {}} />,
  );
  assert.equal(container.querySelector(".flow-missing-notice"), null);
});

test("one missing answer reads in the singular, in French", () => {
  const issues = validateSectionData(s1, {}, "fr").slice(0, 1);
  renderWithProviders(
    <VtWizardSectionScreen section={s1} data={{}} issues={issues} showErrorSummary onChange={() => {}} isFirst isLast={false} onBack={() => {}} onNext={() => {}} />,
  );
  assert.ok(screen.getByRole("heading", { level: 2, name: "Il y a un problème" }));
  assert.ok(screen.getByText("1 réponse à corriger avant de continuer :"));
});
