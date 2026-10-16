import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import LoginPage from "./page";
import { useAuthStore } from "@/lib/auth-store";

// Defect 19 (2026-10-16 VT run): the "Stay signed in" checkbox was reported
// with the accessible name "on". It is named by its label.
test("the stay-signed-in checkbox is named by its label", () => {
  useAuthStore.setState({ status: "unauthenticated", user: null });
  renderWithProviders(<LoginPage />, { locale: "en" });
  assert.ok(screen.getByRole("checkbox", { name: "Stay signed in" }));
});
