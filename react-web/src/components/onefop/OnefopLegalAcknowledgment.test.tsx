import { renderWithProviders, screen, waitFor } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OnefopLegalAcknowledgment } from "./OnefopLegalAcknowledgment";
import { loadMessages } from "@/test/render";

const ack = (loadMessages("fr") as { onefopLegalAcknowledgment: Record<string, string> }).onefopLegalAcknowledgment;

// The card appears after a 1.8 s logo beat (real timers: user-event's own
// delays rely on them).
const CARD_TIMEOUT = { timeout: 4000 };

function renderAck(entityType: string) {
  let acknowledged = 0;
  let cancelled = 0;
  const result = renderWithProviders(
    <OnefopLegalAcknowledgment
      entityType={entityType}
      respondentName="Awa Ngono"
      onAcknowledged={() => {
        acknowledged += 1;
      }}
      onCancel={() => {
        cancelled += 1;
      }}
    />,
  );
  return { ...result, acknowledgedCount: () => acknowledged, cancelledCount: () => cancelled };
}

test("a training centre sees the vocational-training census title; Commencer waits for the consent box", async () => {
  const { user, acknowledgedCount } = renderAck("vocationalTraining");
  assert.ok(await screen.findByText(ack.formTitleVt, {}, CARD_TIMEOUT));
  assert.equal(screen.queryByText(ack.formTitle), null);

  const begin = screen.getByRole("button", { name: ack.beginButton }) as HTMLButtonElement;
  assert.equal(begin.disabled, true, "Commencer is disabled before consent");
  await user.click(begin);
  assert.equal(acknowledgedCount(), 0);

  // The whole label is clickable, not only the box.
  await user.click(screen.getByText(ack.acknowledgeCheckboxLabel));
  assert.equal((screen.getByRole("checkbox") as HTMLInputElement).checked, true);
  assert.equal(begin.disabled, false);

  await user.click(begin);
  await waitFor(() => assert.equal(acknowledgedCount(), 1));
});

test("any other entity sees the modern-economy jobs title, and unticking the box disables Commencer again", async () => {
  const { user } = renderAck("enterprise");
  assert.ok(await screen.findByText(ack.formTitle, {}, CARD_TIMEOUT));
  assert.equal(screen.queryByText(ack.formTitleVt), null);

  const box = screen.getByRole("checkbox");
  const begin = screen.getByRole("button", { name: ack.beginButton }) as HTMLButtonElement;
  await user.click(box);
  assert.equal(begin.disabled, false);
  await user.click(box);
  assert.equal(begin.disabled, true);
});

test("the notice confirms the role and establishment without a personal greeting", async () => {
  renderWithProviders(
    <OnefopLegalAcknowledgment
      entityType="vocationalTraining"
      respondentName="Awa Ngono"
      respondentFunction="Directrice"
      establishmentName="CFP de Mfou"
      establishmentId="VT26000103"
      onAcknowledged={() => {}}
      onCancel={() => {}}
    />,
  );
  assert.equal(screen.queryByText("Bienvenue, Awa Ngono"), null);
  const line = screen.getByText(/Vous déclarez en qualité de Directrice pour/);
  assert.equal(line.textContent, "Vous déclarez en qualité de Directrice pour CFP de Mfou (VT26000103).");
  assert.equal(line.querySelector("strong")?.textContent, "CFP de Mfou");
});

test("an unknown role is left out of the notice, never filled with a stand-in", async () => {
  renderAck("vocationalTraining");
  assert.ok(await screen.findByText(ack.formTitleVt, {}, CARD_TIMEOUT));
  assert.equal(screen.queryByText("Bienvenue, Awa Ngono"), null);
  assert.equal(screen.queryByText(/en qualité de/), null);
  assert.equal(screen.queryByText(/Directeur/), null);
});

test("a role picked from the registration list is shown in the reader's language; a typed one as typed", async () => {
  const { unmount } = renderWithProviders(
    <OnefopLegalAcknowledgment
      entityType="vocationalTraining"
      respondentName="Awa Ngono"
      respondentFunction="Directeur Général"
      establishmentName="CFP de Mfou"
      onAcknowledged={() => {}}
      onCancel={() => {}}
    />,
    { locale: "en" },
  );
  const line = await screen.findByText(/You are declaring as/, {}, CARD_TIMEOUT);
  assert.equal(line.textContent, "You are declaring as General Manager for CFP de Mfou.");
  unmount();

  renderWithProviders(
    <OnefopLegalAcknowledgment
      entityType="vocationalTraining"
      respondentName="Awa Ngono"
      respondentFunction="Proviseur adjoint"
      onAcknowledged={() => {}}
      onCancel={() => {}}
    />,
    { locale: "en" },
  );
  const typed = await screen.findByText(/You are declaring as/, {}, CARD_TIMEOUT);
  assert.equal(typed.textContent, "You are declaring as Proviseur adjoint.");
});
