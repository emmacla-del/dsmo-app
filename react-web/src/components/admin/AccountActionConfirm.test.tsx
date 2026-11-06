import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AccountActionConfirm } from "./AccountActionConfirm";

const labels = {
  message: "Acme ne pourra plus se connecter.",
  confirmLabel: "Confirmer",
  pendingLabel: "Envoi…",
  cancelLabel: "Annuler",
  pending: false,
};

test("a plain confirmation names the consequence and acts only on the second click", async () => {
  let confirmed = 0;
  const { user } = renderWithProviders(
    <AccountActionConfirm {...labels} onCancel={() => {}} onConfirm={() => { confirmed += 1; }} />,
  );
  assert.ok(screen.getByText(labels.message));
  assert.equal(confirmed, 0);
  await user.click(screen.getByRole("button", { name: "Confirmer" }));
  assert.equal(confirmed, 1);
});

test("delete stays disabled until the exact e-mail is typed", async () => {
  let confirmed = 0;
  const { user } = renderWithProviders(
    <AccountActionConfirm
      {...labels}
      destructive
      typedConfirmation={{ value: "contact@acme.cm", label: "Tapez l'e-mail" }}
      onCancel={() => {}}
      onConfirm={() => { confirmed += 1; }}
    />,
  );
  const confirm = screen.getByRole("button", { name: "Confirmer" }) as HTMLButtonElement;
  assert.equal(confirm.disabled, true);
  await user.type(screen.getByLabelText("Tapez l'e-mail"), "contact@acme");
  assert.equal(confirm.disabled, true);
  await user.type(screen.getByLabelText("Tapez l'e-mail"), ".cm");
  assert.equal(confirm.disabled, false);
  await user.click(confirm);
  assert.equal(confirmed, 1);
});

test("cancel does not act, and a refusal is shown beside the action", async () => {
  let cancelled = 0;
  let confirmed = 0;
  const { user } = renderWithProviders(
    <AccountActionConfirm
      {...labels}
      error="Suppression refusée."
      onCancel={() => { cancelled += 1; }}
      onConfirm={() => { confirmed += 1; }}
    />,
  );
  assert.ok(screen.getByText("Suppression refusée."));
  await user.click(screen.getByRole("button", { name: "Annuler" }));
  assert.equal(cancelled, 1);
  assert.equal(confirmed, 0);
});
