import { test } from "node:test";
import assert from "node:assert/strict";
import { navItemsForRole, resolveEffectiveRole } from "./role-navigation";

test("COMPANY role has the 5 respondent-focused tabs in order", () => {
  const items = navItemsForRole("COMPANY");
  assert.equal(items.length, 5);

  assert.deepEqual(items.map((i) => i.slug), [
    "home",
    "declarations",
    "messages",
    "etablissement",
    "aide",
  ]);

  assert.deepEqual(items.map((i) => i.route), [
    "/home",
    "/home/declarations",
    "/home/messages",
    "/home/etablissement",
    "/home/aide",
  ]);

  assert.deepEqual(items.map((i) => i.labelKey), [
    "homeNav.item.home",
    "homeNav.item.surveys",
    "homeNav.item.messages",
    "homeNav.item.establishment",
    "homeNav.item.help",
  ]);
});

test("Staff administrative roles maintain their supervision routes", () => {
  const divisional = navItemsForRole("DIVISIONAL_ADMIN");
  assert.ok(divisional.some((i) => i.route === "/admin/pilotage"));
  assert.ok(divisional.some((i) => i.route === "/admin/dossiers"));

  const superAdmin = navItemsForRole("SUPER_ADMIN");
  assert.ok(superAdmin.some((i) => i.route === "/admin/pilotage"));
  assert.ok(superAdmin.some((i) => i.route === "/admin/dossiers"));
  assert.ok(superAdmin.some((i) => i.route === "/admin/diffusion"));
});
