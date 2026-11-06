import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AdminFilterPill } from "./AdminFilterPill";

const props = { label: "Région", onChange: () => {}, clearLabel: "Retirer le filtre Région", allLabel: "Toutes" };

test("a filter stays visible and removable while its options are still loading", () => {
  renderWithProviders(<AdminFilterPill {...props} value="Littoral" options={[]} />);
  assert.match(screen.getByRole("button", { name: /^Région/ }).textContent ?? "", /Littoral/);
  assert.ok(screen.getByRole("button", { name: "Retirer le filtre Région" }));
});

test("a known value reads as its option's label", () => {
  renderWithProviders(<AdminFilterPill {...props} value="LT" options={[{ value: "LT", label: "Littoral" }]} />);
  assert.match(screen.getByRole("button", { name: /^Région/ }).textContent ?? "", /Littoral/);
});

test("with no value the pill is off and offers nothing to clear", () => {
  renderWithProviders(<AdminFilterPill {...props} value="" options={[]} />);
  assert.equal(screen.queryByRole("button", { name: "Retirer le filtre Région" }), null);
});
