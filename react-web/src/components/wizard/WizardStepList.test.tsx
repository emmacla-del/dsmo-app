import { renderWithProviders, screen, userEvent } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { WizardStepList, type WizardStep } from "./WizardStepList";
import { ModernJobsSidebar } from "@/components/onefop/ModernJobsSidebar";
import { VtWizardSidebar } from "@/components/onefop/VtWizardSidebar";
import { RegistrationStepList } from "@/components/auth/RegistrationStepList";
import { schemaEntity } from "@/test/schema";

function step(over: Partial<WizardStep> & Pick<WizardStep, "key" | "state">): WizardStep {
  return { marker: 1, name: over.key, stateLabel: over.state, ...over };
}

function stateOf(button: HTMLElement): string | undefined {
  return [...(button.closest("li")?.classList ?? [])].find((c) => c.startsWith("is-"))?.slice(3);
}

test("each state draws its own marker: check when done, ! on error, the number otherwise", () => {
  renderWithProviders(
    <WizardStepList
      label="Étapes"
      steps={[
        step({ key: "a", state: "done", marker: 1, onSelect: () => {} }),
        step({ key: "b", state: "error", marker: 2, onSelect: () => {} }),
        step({ key: "c", state: "current", marker: 3, onSelect: () => {} }),
      ]}
    />,
  );
  const [a, b, c] = screen.getAllByRole("button");
  assert.ok(a.querySelector(".cam-step-marker svg"), "done shows a check mark");
  assert.equal(b.querySelector(".cam-step-marker")?.textContent, "!");
  assert.equal(c.querySelector(".cam-step-marker")?.textContent, "3");
  assert.equal(c.getAttribute("aria-current"), "step");
  assert.equal(a.getAttribute("aria-current"), null);
});

test("the edit word shows only on a finished step that can be reopened", () => {
  renderWithProviders(
    <WizardStepList
      label="Étapes"
      editLabel="Modifier"
      steps={[
        step({ key: "open", state: "done", onSelect: () => {} }),
        step({ key: "closed", state: "done" }),
        step({ key: "now", state: "current", onSelect: () => {} }),
      ]}
    />,
  );
  const edits = document.querySelectorAll(".cam-step-edit");
  assert.equal(edits.length, 1);
  assert.equal(edits[0].closest("li")?.querySelector(".cam-step-name")?.textContent, "open");
});

test("a locked step stays focusable, says why, and does nothing without a handler", async () => {
  renderWithProviders(
    <WizardStepList
      label="Étapes"
      steps={[step({ key: "later", name: "Section 3", state: "locked", lockReason: "Terminez d'abord la section 2" })]}
    />,
  );
  const button = screen.getByRole("button", { name: /Section 3/ });
  assert.equal(button.getAttribute("aria-disabled"), "true");
  assert.equal(button.getAttribute("title"), "Terminez d'abord la section 2");
  assert.match(button.getAttribute("aria-label") ?? "", /Terminez d'abord la section 2/);
  assert.ok(button.hasAttribute("data-inert"));
});

test("clicking an open step calls its handler", async () => {
  let opened = 0;
  renderWithProviders(
    <WizardStepList label="Étapes" steps={[step({ key: "s", name: "Identification", state: "todo", onSelect: () => (opened += 1) })]} />,
  );
  await userEvent.click(screen.getByRole("button", { name: /Identification/ }));
  assert.equal(opened, 1);
});

// The three wizards render the same list: the same classes, so the same look.
test("registration, Modern Jobs and VT all render the shared rail and step list", () => {
  const { unmount } = renderWithProviders(
    <RegistrationStepList currentIndex={1} reached={2} completed={[true, false, false, false, false, false]} summaries={[]} onSelect={() => {}} />,
  );
  const registration = [...document.querySelectorAll(".cam-step")].map((li) => stateOf(li.querySelector("button")!));
  assert.deepEqual(registration, ["done", "current", "inProgress", "locked", "locked", "locked"]);
  unmount();

  const mj = renderWithProviders(
    <ModernJobsSidebar entity={schemaEntity("enterprise")} data={{}} currentSectionIndex={0} onSelectSection={() => {}} onGoToValidation={() => {}} />,
  );
  assert.ok(document.querySelector("aside.cam-wizard-rail"));
  assert.equal(document.querySelector(".cam-steps .is-current .cam-step-marker")?.textContent, "0", "Modern Jobs numbers from 0");
  assert.match(document.querySelector(".cam-wizard-rail-progress")?.textContent ?? "", /sur \d+ sections terminées/);
  mj.unmount();

  renderWithProviders(
    <VtWizardSidebar entity={schemaEntity("vocationalTraining")} data={{}} currentSectionIndex={0} onSelectSection={() => {}} onGoToValidation={() => {}} />,
  );
  assert.ok(document.querySelector("aside.cam-wizard-rail"));
  assert.equal(document.querySelector(".cam-steps .is-current .cam-step-marker")?.textContent, "1", "VT numbers from 1");
  // The old dark-rail footer repeated the progress in white on the white
  // panel. Progress is said once, at the top.
  assert.equal((document.body.textContent ?? "").match(/sections terminées/g)?.length, 1);
});
