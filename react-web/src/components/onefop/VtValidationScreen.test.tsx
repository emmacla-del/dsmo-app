import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { VT_VALIDATION_HEADING_ID, VtValidationScreen } from "./VtValidationScreen";
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

const submitButton = () => screen.getByRole("button", { name: /Continuer vers la soumission/ });

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

// Audit R1: before submission the screen asks the respondent to check;
// it never thanks them as if the declaration were already sent.
test("the review screen's heading asks to check the answers, and thanks no one before submission", () => {
  renderScreen();
  const heading = document.getElementById(VT_VALIDATION_HEADING_ID)!;
  assert.equal(heading.textContent, "Vérifiez vos réponses avant de soumettre");
  assert.equal(screen.queryByText(/Merci pour votre participation/), null);
});

// Defect 3 of the 2026-10-15 VT run: counts, answers, and the law cited.

test("Section 4 is counted in tables, never '0 / 0'", () => {
  const { container } = renderScreen();
  const text = container.textContent ?? "";
  assert.doesNotMatch(text, /0 \/ 0 /);
  assert.match(text, /0 \/ \d+ tableaux/);
});

test("each section shows its answers, 'Sans réponse' apart from No, and opens for a change", async () => {
  const opened: number[] = [];
  const { container, user } = renderScreen({
    data: { VT1_2: "CFP Test E2E Douala", VT2_1: "Non/ No" },
    onOpenSection: (i) => opened.push(i),
  });
  const details = container.querySelectorAll("details");
  assert.equal(details.length, vt.sections.length);
  await user.click(details[0].querySelector("summary")!);
  assert.match(details[0].textContent ?? "", /CFP Test E2E Douala/);
  assert.match(details[0].textContent ?? "", /Sans réponse/);
  assert.match(details[1].textContent ?? "", /convention avec l'Etat \?Non2\.1\.3/, "2.1.1 answered Non");
  await user.click(screen.getAllByRole("button", { name: "Modifier cette section" })[1]);
  assert.deepEqual(opened, [1]);
});

test("the confidentiality notice cites Law 2020/010, as the paper form does, in both languages", () => {
  for (const locale of ["fr", "en"] as const) {
    const text = (loadMessages(locale) as { vtValidationScreen: Record<string, string> }).vtValidationScreen.confidentialityText;
    assert.match(text, /2020\/010/);
    assert.doesNotMatch(text, /91\/023/);
  }
});

// Defect 15 (2026-10-16 run): no eyebrows or duplicate actions on the review.
test("the review has one primary action and no duplicate or decorative controls", () => {
  const { container } = renderScreen({ onSaveDraft: () => {} });
  const names = screen.getAllByRole("button").map((b) => b.textContent?.trim() ?? "");
  assert.ok(names.includes("Continuer vers la soumission"));
  assert.ok(names.includes(fr.vtValidationScreen.saveDraftButton));
  assert.equal(names.filter((n) => n === "Corriger" || /copie de vérification/.test(n)).length, 0);
  assert.equal(screen.getAllByRole("button", { name: "Modifier cette section" }).length, vt.sections.length);
  const text = container.textContent ?? "";
  assert.doesNotMatch(text, /SECTION \d|Récapitulatif des 9 sections/);
  assert.ok(screen.getByRole("heading", { level: 3, name: "Section 1 : Identification" }));
});

// Defect 25 (2026-10-16 run): the server's advisory coherence flags are shown
// before submission, with a way to confirm and continue. Never blocking (§7).
const FLAG = {
  code: "VT_DIPLOMA_ACADEMIC_PRO_MISMATCH",
  message: "Effectif total des apprenants par diplôme académique (4.1: 12, hommes) ne correspond pas au total par diplôme professionnel (4.2: 10, hommes).",
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test("coherence flags are shown first, then 'the figures are right' continues to submission", async () => {
  let checks = 0;
  const { user, submittedCount } = renderScreen({
    entity: noErrorsEntity,
    quiz: { isComplete: true, onOpen: () => {} },
    checkCoherence: async () => {
      checks += 1;
      return [FLAG];
    },
  });
  await user.click(submitButton());
  await flush();
  assert.equal(submittedCount(), 0, "the flags are shown before anything else");
  assert.ok(screen.getByRole("heading", { name: "Vérifiez ces chiffres avant de soumettre" }));
  const panel = document.getElementById("vt-coherence-warnings")!;
  assert.match(panel.textContent ?? "", /4\.1[^0-9]+12[\s\S]*4\.2[^0-9]+10/, "the figures, in the reader's language");
  assert.equal(document.activeElement?.id, "vt-coherence-warnings");

  await user.click(screen.getByRole("button", { name: "Les chiffres sont justes, continuer vers la soumission" }));
  assert.equal(submittedCount(), 1, "confirming continues: the flags never block");
  assert.equal(checks, 1, "not asked twice for the same answers");
});

test("with no coherence flag, or a failed check, Continue goes straight on", async () => {
  for (const checkCoherence of [async () => [], async () => Promise.reject(new Error("offline"))]) {
    const { user, submittedCount, unmount } = renderScreen({
      entity: noErrorsEntity,
      quiz: { isComplete: true, onOpen: () => {} },
      checkCoherence,
    });
    await user.click(submitButton());
    await flush();
    assert.equal(submittedCount(), 1);
    assert.equal(screen.queryByText("Vérifiez ces chiffres avant de soumettre"), null);
    unmount();
  }
});
