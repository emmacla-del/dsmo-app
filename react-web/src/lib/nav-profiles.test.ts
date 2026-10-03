// Pins each role's sidebar to its NAV_PROFILES entry, and pins the property
// that motivated the profile model: every hub a role is shown must land on a
// page that role can open. See @/lib/nav-profiles.
//
// Pure logic, no DOM — run with `npm test`.

import assert from "node:assert/strict";
import test from "node:test";

import { ALL_ROLES, TERRITORIAL_ROLES, type UserRole } from "./roles";
import { EMPTY_NAV_PROFILE, NAV_PROFILES, navHubsFor, resolveNavProfile } from "./nav-profiles";
import { ADMIN_HUBS, getAllowedRoles, isRoleAllowed } from "@/app/admin/_routes";

test("NAV_PROFILES covers every role exactly once", () => {
  assert.deepEqual(Object.keys(NAV_PROFILES).sort(), [...ALL_ROLES].sort());
});

test("every hub named in every profile resolves to a hub in ADMIN_HUBS", () => {
  const known = new Set(ADMIN_HUBS.map((h) => h.key));
  for (const [role, profile] of Object.entries(NAV_PROFILES)) {
    for (const key of profile.hubs) {
      assert.ok(known.has(key), `${role}: hub "${key}" matches no hub in ADMIN_HUBS`);
    }
  }
});

test("each role's rail is exactly its profile, in declared order", () => {
  const expected: Record<UserRole, string[]> = {
    SUPER_ADMIN: ["supervision", "collecte", "declarants", "qualite", "donnees", "administration"],
    ADMIN_ONEFOP: ["supervision", "collecte", "declarants", "qualite", "donnees", "administration"],
    REGIONAL_ADMIN: ["supervision", "collecte", "declarants", "qualite"],
    DIVISIONAL_ADMIN: ["supervision", "collecte", "declarants", "qualite"],
    AUDITOR: ["administration"],
    COMPANY: [],
  };

  for (const role of ALL_ROLES) {
    assert.deepEqual(
      navHubsFor(role).map((h) => h.key),
      expected[role],
      `${role} rail`,
    );
  }
});

// The sub-route gates are what make one shared hub list safe to hand to
// several roles: the same hub lands somewhere different per role, and never on
// a page that role cannot open.
test("a shared hub resolves to a different landing route per role", () => {
  const landing = (role: UserRole, key: string) =>
    navHubsFor(role).find((h) => h.key === key)?.href;

  // "administration" is in three profiles and lands in three places.
  assert.equal(landing("SUPER_ADMIN", "administration"), "/admin/utilisateurs");
  assert.equal(landing("ADMIN_ONEFOP", "administration"), "/admin/utilisateurs");
  assert.equal(landing("AUDITOR", "administration"), "/admin/journal-audit");

  // ADMIN_ONEFOP reaches user administration but neither the journal nor settings.
  const onefopAdmin = navHubsFor("ADMIN_ONEFOP").find((h) => h.key === "administration");
  assert.deepEqual(onefopAdmin?.subRoutes.map((r) => r.href), ["/admin/utilisateurs"]);

  // "collecte" splits the two territorial roles: DIVISIONAL_ADMIN is outside
  // CAMPAIGN_ROLES, so campagnes is hidden and the hub lands on questionnaires.
  assert.equal(landing("REGIONAL_ADMIN", "collecte"), "/admin/campagnes");
  assert.equal(landing("DIVISIONAL_ADMIN", "collecte"), "/admin/questionnaires");
});

// Territorial roles reach neither hub: every sub-route under "donnees" is
// NATIONAL_ROLES, and every sub-route under "administration" is one of
// USER_ADMIN_ROLES / AUDIT_ROLES / SETTINGS_ROLES.
test("territorial roles get no national-only hub", () => {
  for (const role of TERRITORIAL_ROLES) {
    const keys = navHubsFor(role).map((h) => h.key);
    assert.ok(!keys.includes("donnees"), `${role} should not see Données`);
    assert.ok(!keys.includes("administration"), `${role} should not see Administration`);
  }
});

test("each rendered hub lands on a route the role is allowed to open", () => {
  for (const role of ALL_ROLES) {
    for (const hub of navHubsFor(role)) {
      const path = hub.href.split(/[?#]/)[0];
      const allowed = getAllowedRoles(path);
      assert.ok(
        isRoleAllowed(allowed ?? undefined, role),
        `${role}: hub "${hub.key}" lands on ${hub.href}, which it cannot open`,
      );
    }
  }
});

test("AUDITOR's single hub lands on the audit journal, not user administration", () => {
  const hubs = navHubsFor("AUDITOR");
  assert.equal(hubs.length, 1);
  assert.equal(hubs[0].href, "/admin/journal-audit");
  // The sub-routes it cannot open are filtered out, not merely unlinked.
  assert.deepEqual(
    hubs[0].subRoutes.map((s) => s.href),
    ["/admin/journal-audit"],
  );
});

test("an unknown, absent, or non-console role gets no navigation", () => {
  for (const role of [undefined, null, "", "SUPER_ADMIN_ONEFOP", "CENTRAL", "COMPANY"]) {
    assert.deepEqual(navHubsFor(role), [], `role ${String(role)}`);
  }
  assert.equal(resolveNavProfile("CENTRAL"), EMPTY_NAV_PROFILE);
  assert.equal(resolveNavProfile(undefined), EMPTY_NAV_PROFILE);
});

test("no profile references the removed ?tab=regional route", () => {
  for (const hub of ADMIN_HUBS) {
    for (const sub of hub.subRoutes) {
      assert.ok(!sub.href.includes("tab=regional"), `${hub.key} still links ${sub.href}`);
    }
  }
});
