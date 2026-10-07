import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canGrantAdminOnefop,
  groupLinkMessage,
  groupLinkUrl,
  invitationLevelsFor,
  invitationMessage,
  invitationUrl,
  servicesForLevel,
  territoryPhrase,
  whatsappHref,
  type OrgServiceNode,
  type StaffInvitation,
} from "@/lib/staff-invitations";

const node = (code: string, category: OrgServiceNode["category"], children: OrgServiceNode[] = [], extra: Partial<OrgServiceNode> = {}): OrgServiceNode => ({
  code,
  name: `Service ${code}`,
  nameEn: `Service EN ${code}`,
  acronym: null,
  category,
  level: 1,
  parentCode: null,
  roleMapping: "ADMIN_ONEFOP",
  requiresRegion: false,
  requiresDepartment: false,
  children,
  ...extra,
});

const TREE: OrgServiceNode[] = [
  node("SG", "CENTRALE", [node("SG-DAJ", "CENTRALE")]),
  node("DREFOP", "DECONCENTRE", [node("DREFOP-SPE", "DECONCENTRE", [node("DREFOP-SPE-BAE", "DECONCENTRE")])], { acronym: "DREFOP" }),
  node("DDEFOP", "DECONCENTRE", [node("DDEFOP-BAG", "DECONCENTRE")]),
  node("ONEFOP", "RATTACHE"),
];

test("both administrator roles invite to every level; nobody else invites", () => {
  assert.deepEqual(invitationLevelsFor("SUPER_ADMIN"), ["regional", "departmental", "central"]);
  assert.deepEqual(invitationLevelsFor("ADMIN_ONEFOP"), ["regional", "departmental", "central"]);
  assert.deepEqual(invitationLevelsFor("REGIONAL_ADMIN"), []);
  assert.deepEqual(invitationLevelsFor("CENTRAL_AGENT"), []);
  assert.deepEqual(invitationLevelsFor(undefined), []);
});

test("only SUPER_ADMIN grants ADMIN_ONEFOP, and only on a central post", () => {
  assert.equal(canGrantAdminOnefop("SUPER_ADMIN", "central"), true);
  assert.equal(canGrantAdminOnefop("SUPER_ADMIN", "regional"), false);
  assert.equal(canGrantAdminOnefop("ADMIN_ONEFOP", "central"), false);
  assert.equal(canGrantAdminOnefop("SUPER_ADMIN", null), false);
});

test("a delegation level is its subtree, root first, indented by depth", () => {
  const regional = servicesForLevel(TREE, "regional", "fr");
  assert.deepEqual(regional.map((s) => [s.code, s.depth]), [["DREFOP", 0], ["DREFOP-SPE", 1], ["DREFOP-SPE-BAE", 2]]);
  assert.equal(regional[0].label, "Service DREFOP (DREFOP)");
  assert.deepEqual(servicesForLevel(TREE, "departmental", "fr").map((s) => s.code), ["DDEFOP", "DDEFOP-BAG"]);
});

test("the central level is every central and attached service, and nothing deconcentrated", () => {
  const codes = servicesForLevel(TREE, "central", "en").map((s) => s.code);
  assert.deepEqual(codes, ["SG", "SG-DAJ", "ONEFOP"]);
  assert.equal(servicesForLevel(TREE, "central", "en")[0].label, "Service EN SG");
});

test("the link carries the token, encoded, on /inscription-agent", () => {
  assert.equal(invitationUrl("https://cam-leap.cm/", "a.b+c"), "https://cam-leap.cm/inscription-agent?invitation=a.b%2Bc");
});

test("territory phrase", () => {
  assert.equal(territoryPhrase("Centre", "Mfoundi"), "Mfoundi (Centre)");
  assert.equal(territoryPhrase("Centre", null), "Centre");
  assert.equal(territoryPhrase(null, null), "");
});

test("whatsapp link: a local nine-digit number gets 237, none opens the chooser", () => {
  assert.equal(whatsappHref("Bonjour & lien", "6 55 00 00 00"), "https://wa.me/237655000000?text=Bonjour%20%26%20lien");
  assert.equal(whatsappHref("x", "+237 655000000"), "https://wa.me/237655000000?text=x");
  assert.equal(whatsappHref("x"), "https://wa.me/?text=x");
});

test("the message names the post, the territory, the expiry and the link", () => {
  const inv: StaffInvitation = {
    token: "t",
    expiresAt: "2026-10-10T09:00:00.000Z",
    email: "dd@minefop.cm",
    role: "DIVISIONAL_ADMIN",
    region: "Centre",
    department: "Mfoundi",
    serviceCode: "DDEFOP",
    serviceName: "Délégation Départementale",
    positionType: "DELEGUE_DEPARTEMENTAL",
    positionTitle: "Délégué Départemental",
  };
  const msg = invitationMessage(inv, "https://x/inscription-agent?invitation=t", "fr");
  assert.match(msg, /Délégué Départemental, Délégation Départementale, Mfoundi \(Centre\)/);
  assert.match(msg, /2026/);
  assert.ok(msg.endsWith("https://x/inscription-agent?invitation=t"));
  assert.match(invitationMessage(inv, "u", "en"), /^Hello, you are invited/);
});

test("the group link uses ?lien= on the same page", () => {
  assert.equal(groupLinkUrl("https://x.cm", "a+b"), "https://x.cm/inscription-agent?lien=a%2Bb");
});

test("the group message names the group, the territory, the approval step and the expiry", () => {
  const link = {
    id: "l", label: "Personnel DREFOP", level: "regional" as const, role: "REGIONAL_ADMIN", region: "Centre", department: null,
    maxUses: 50, useCount: 0, expiresAt: "2026-10-14T09:00:00.000Z", revokedAt: null, createdAt: "", state: "active" as const,
  };
  const msg = groupLinkMessage(link, "https://x/inscription-agent?lien=t", "fr");
  assert.match(msg, /Personnel DREFOP, Centre\./);
  assert.match(msg, /un administrateur validera/);
  assert.match(msg, /2026/);
  assert.ok(msg.endsWith("https://x/inscription-agent?lien=t"));
});
