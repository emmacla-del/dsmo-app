import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { VtValidationScreen } from "./VtValidationScreen";
import { schemaEntity, schemaField } from "@/test/schema";
import { loadMessages } from "@/test/render";
import type { OnefopEntity } from "@/lib/onefop-schema";

const vt = schemaEntity("vocationalTraining");
const fr = loadMessages("fr") as { vtValidationScreen: Record<string, string> };

/** Section 1 reduced to one optional question (1.3 Sigle): nothing in it
 * can fail validation, so only canSubmit / the quiz can block Submit. */
const noErrorsEntity: OnefopEntity = {
  ...vt,
  sections: [{ ...vt.sections[0], fields: [schemaField("vocationalTraining", "VT1_3")], subsections: [] }],
};

function renderScreen(props: Partial<Parameters<typeof VtValidationScreen>[0]> = {}) {
  let submitted = 0;
  const result = renderWithProviders(
    <VtValidationScreen
      entity={vt}
      data={{}}
      onOpenSection={() => {}}
      onBack={() => {}}
      onSubmitFinal={() => {
        submitted += 1;
      }}
      {...props}
    />,
  );
  return { ...result, submittedCount: () => submitted };
}

const submitButton = () => screen.getByRole("button", { name: /Vérifier & Soumettre/ });

test("with validation errors, Submit stays focusable but aria-disabled and is described by the reason", () => {
  renderScreen();
  const submit = submitButton() as HTMLButtonElement;

  assert.equal(submit.disabled, false, "not disabled: a keyboard user can still reach it");
  assert.equal(submit.getAttribute("aria-disabled"), "true");
  assert.equal(submit.getAttribute("aria-describedby"), "vt-submit-blocked-errors");
  const reason = document.getElementById("vt-submit-blocked-errors");
  assert.ok(reason);
  assert.equal(reason.textContent, fr.vtValidationScreen.errorsBlockingSubmit);
  assert.ok(screen.getByRole("button", { description: fr.vtValidationScreen.errorsBlockingSubmit }) === submit);
});

test("pressing a blocked Submit does not submit and moves focus to the reason", async () => {
  const { user, submittedCount } = renderScreen();
  await user.click(submitButton());

  assert.equal(submittedCount(), 0);
  assert.equal(document.activeElement, document.getElementById("vt-submit-blocked-errors"));
});

test("the keyboard path is the same: Enter on a blocked Submit focuses the reason without submitting", async () => {
  const { user, submittedCount } = renderScreen();
  submitButton().focus();
  await user.keyboard("{Enter}");

  assert.equal(submittedCount(), 0);
  assert.equal(document.activeElement?.id, "vt-submit-blocked-errors");
});

test("an unfinished preliminary quiz blocks Submit even when no section has errors", async () => {
  const { user, submittedCount } = renderScreen({ entity: noErrorsEntity, quiz: { isComplete: false, onOpen: () => {} } });
  const submit = submitButton();
  assert.equal(submit.getAttribute("aria-disabled"), "true");
  assert.equal(submit.getAttribute("aria-describedby"), "vt-submit-blocked-errors");

  await user.click(submit);
  assert.equal(submittedCount(), 0);
});

test("a closed collection period blocks Submit with its own reason", async () => {
  const { user, submittedCount } = renderScreen({ entity: noErrorsEntity, canSubmit: false, quarterStatusMessage: "Collecte close le 30/09" });
  const submit = submitButton();
  assert.equal(submit.getAttribute("aria-disabled"), "true");
  assert.equal(submit.getAttribute("aria-describedby"), "vt-submit-blocked-period");
  assert.match(document.getElementById("vt-submit-blocked-period")?.textContent ?? "", /Collecte close le 30\/09/);

  await user.click(submit);
  assert.equal(submittedCount(), 0);
  assert.equal(document.activeElement?.id, "vt-submit-blocked-period");
});

test("with nothing blocking, Submit is not aria-disabled, has no blocking description, and submits once", async () => {
  const { user, submittedCount } = renderScreen({ entity: noErrorsEntity, quiz: { isComplete: true, onOpen: () => {} } });
  const submit = submitButton();
  assert.equal(submit.getAttribute("aria-disabled"), null);
  assert.equal(submit.getAttribute("aria-describedby"), null);

  await user.click(submit);
  assert.equal(submittedCount(), 1);
});

test("a valid section made only of tables counts as complete, not as never started", () => {
  // Section 4 has no question outside its tables: here, 4.4 answered Non in the quiz.
  const section4 = vt.sections.find((s) => s.id === "section4_vocationalTraining")!;
  const tablesOnly: OnefopEntity = {
    ...vt,
    sections: [{ ...section4, fields: [schemaField("vocationalTraining", "VT4_4")], subsections: [] }],
  };
  renderScreen({
    entity: tablesOnly,
    data: { _scopeConfig: { vocationalTraining: { informalSector: false } } },
  });
  assert.equal(screen.queryByText(fr.vtValidationScreen.incompleteWarning), null);
  assert.ok(screen.getByText(fr.vtValidationScreen.badgeCompleted));
});
