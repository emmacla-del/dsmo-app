import assert from "node:assert/strict";
import { test } from "node:test";

import { invitationScopeMismatch, type DirectoryUser } from "./user-directory";

// The approval screen's only control on the territory an officer chose for
// themselves (CLAUDE.md §21, 2026-10-25). It must flag a real departure and
// stay quiet on everything a link never fixed, or an approver learns to
// ignore it.

type ScopeCase = Pick<DirectoryUser, "region" | "department" | "invitationScope">;

const user = (over: Partial<ScopeCase>): ScopeCase => ({
  region: null,
  department: null,
  invitationScope: null,
  ...over,
});

test("an account with no invitation link reports no mismatch", () => {
  assert.equal(invitationScopeMismatch(user({ region: "Centre" })), false);
});

test("a central link fixes no territory, so nothing is compared", () => {
  assert.equal(
    invitationScopeMismatch(user({
      region: "Centre",
      invitationScope: { label: "SG", level: "central", region: null, department: null },
    })),
    false,
  );
});

test("the chosen region matching the link's is not a mismatch", () => {
  assert.equal(
    invitationScopeMismatch(user({
      region: "Centre",
      invitationScope: { label: "DREFOP Centre", level: "regional", region: "Centre", department: null },
    })),
    false,
  );
});

test("a different region from the link's is a mismatch", () => {
  assert.equal(
    invitationScopeMismatch(user({
      region: "Littoral",
      invitationScope: { label: "DREFOP Centre", level: "regional", region: "Centre", department: null },
    })),
    true,
  );
});

test("a regional link never reports a mismatch on the department it did not fix", () => {
  assert.equal(
    invitationScopeMismatch(user({
      region: "Centre",
      department: "Mfoundi",
      invitationScope: { label: "DREFOP Centre", level: "regional", region: "Centre", department: null },
    })),
    false,
  );
});

test("a departmental link compares the department too", () => {
  const scope = { label: "DDEFOP Mfoundi", level: "departmental", region: "Centre", department: "Mfoundi" };
  assert.equal(invitationScopeMismatch(user({ region: "Centre", department: "Mfoundi", invitationScope: scope })), false);
  assert.equal(invitationScopeMismatch(user({ region: "Centre", department: "Mbam", invitationScope: scope })), true);
});

test("a territory the officer left unanswered against a link that fixes one is a mismatch", () => {
  assert.equal(
    invitationScopeMismatch(user({
      region: null,
      invitationScope: { label: "DREFOP Centre", level: "regional", region: "Centre", department: null },
    })),
    true,
  );
});

test("case and surrounding space do not make a mismatch", () => {
  assert.equal(
    invitationScopeMismatch(user({
      region: " centre ",
      invitationScope: { label: "DREFOP Centre", level: "regional", region: "Centre", department: null },
    })),
    false,
  );
});
