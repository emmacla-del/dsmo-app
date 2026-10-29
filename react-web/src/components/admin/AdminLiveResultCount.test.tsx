import { renderWithProviders } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AdminLiveResultCount } from "./AdminLiveResultCount";

test("the visible result range is rendered once and announces committed count changes", () => {
  const result = renderWithProviders(
    <AdminLiveResultCount announce={false}>Showing 1–8 of 25</AdminLiveResultCount>,
    { locale: "en" },
  );
  assert.equal(result.container.querySelector('[aria-live="polite"]'), null, "placeholder results must not announce a stale count");
  assert.equal(result.container.textContent, "Showing 1–8 of 25");
  assert.equal(result.container.querySelectorAll("span").length, 1, "the range must not be duplicated for visual and live copies");

  result.rerender(<AdminLiveResultCount>Showing 1–8 of 25</AdminLiveResultCount>);
  const announcement = result.container.querySelector('[aria-live="polite"]');
  assert.ok(announcement);
  assert.equal(announcement.textContent, "Showing 1–8 of 25");
  assert.equal(announcement.getAttribute("aria-live"), "polite");
  assert.equal(announcement.getAttribute("aria-atomic"), "true");
  assert.equal(result.container.querySelectorAll('[aria-live="polite"]').length, 1);
  assert.equal(result.container.querySelectorAll("span").length, 1, "the live region is the visible range");

  result.rerender(<AdminLiveResultCount>Showing 1–8 of 4</AdminLiveResultCount>);
  assert.equal(result.container.querySelector('[aria-live="polite"]')?.textContent, "Showing 1–8 of 4");
});
