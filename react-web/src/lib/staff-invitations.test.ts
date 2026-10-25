import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canGrantAdminOnefop,
  findPost,
  groupLinkMessage,
  groupLinkUrl,
  invitationLevelsFor,
  invitationMessage,
  invitationUrl,
  positionTypesForLevel,
  previewFixesPost,
  servicesForLevel,
  servicesOfferingPosition,
  territoryPhrase,
  whatsappHref,
  type OrgPostRef,
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
  node("SG", "CENTRALE", [node("SG-DAJ", "CENTRALE"), node("ONEFOP", "RATTACHE")]),
  node("DREFOP", "DECONCENTRE", [node("DREFOP-SPE", "DECONCENTRE", [node("DREFOP-SPE-BAE", "DECONCENTRE")])], { acronym: "DREFOP" }),
  node("DDEFOP", "DECONCENTRE", [node("DDEFOP-BAG", "DECONCENTRE")]),
];

// Every post of the fixture tree: the delegation's own head post, a head of
// service one level down, and the generic "Cadre" everywhere.
const POSTS: OrgPostRef[] = [
  { serviceCode: "DREFOP", positionType: "DELEGUE_REGIONAL", title: "Délégué Régional", titleEn: "Regional Delegate" },
  { serviceCode: "DREFOP", positionType: "STAFF", title: "Cadre", titleEn: null },
  { serviceCode: "DREFOP-SPE", positionType: "CHEF_SERVICE", title: "Chef du Service SPE", titleEn: null },
  { serviceCode: "DREFOP-SPE", positionType: "STAFF", title: "Cadre", titleEn: null },
  { serviceCode: "SG", positionType: "SECRETAIRE_GENERAL", title: "Secrétaire Général", titleEn: null },
  { serviceCode: "DDEFOP", positionType: "STAFF", title: "Cadre", titleEn: null },
];
const LABELS = [
  { positionType: "DELEGUE_REGIONAL", label: "Délégué Régional" },
  { positionType: "CHEF_SERVICE", label: "Chef de Service" },
  { positionType: "STAFF", label: "Cadre" },
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
  assert.ok(TREE[0].children?.some((child) => child.code === "ONEFOP"));
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

// A link made before 2026-10-25 carries no post: its holders still choose
// their own service and post, and the message still says so.
const POSTLESS_LINK = {
  id: "l", label: "Personnel DREFOP", level: "regional" as const, role: "REGIONAL_ADMIN", region: "Centre", department: null,
  serviceCode: null, serviceName: null, positionType: null, positionTitle: null,
  maxUses: 50, useCount: 0, expiresAt: "2026-10-14T09:00:00.000Z", revokedAt: null, createdAt: "", state: "active" as const,
};

test("the group message names the group, the territory, the approval step and the expiry", () => {
  const msg = groupLinkMessage(POSTLESS_LINK, "https://x/inscription-agent?lien=t", "fr");
  assert.match(msg, /Personnel DREFOP, Centre\./);
  assert.match(msg, /choisissez votre service et votre poste/);
  assert.match(msg, /un administrateur validera/);
  assert.match(msg, /2026/);
  assert.ok(msg.endsWith("https://x/inscription-agent?lien=t"));
});

test("a level offers only the post types its own services carry, labelled, alphabetical", () => {
  const regional = positionTypesForLevel(TREE, "regional", POSTS, LABELS, "fr");
  assert.deepEqual(regional.map((p) => p.positionType), ["STAFF", "CHEF_SERVICE", "DELEGUE_REGIONAL"]);
  assert.deepEqual(regional.map((p) => p.label), ["Cadre", "Chef de Service", "Délégué Régional"]);
  // SECRETAIRE_GENERAL is central; DDEFOP's Cadre is departmental.
  assert.deepEqual(positionTypesForLevel(TREE, "central", POSTS, LABELS, "fr").map((p) => p.positionType), ["SECRETAIRE_GENERAL"]);
  assert.deepEqual(positionTypesForLevel(TREE, "departmental", POSTS, LABELS, "fr").map((p) => p.positionType), ["STAFF"]);
  // A type the server does not label falls back to a service's own title.
  assert.deepEqual(positionTypesForLevel(TREE, "central", POSTS, [], "fr").map((p) => p.label), ["Secrétaire Général"]);
});

test("a post type narrows the services to the ones offering it", () => {
  assert.deepEqual(servicesOfferingPosition(TREE, "regional", POSTS, "STAFF", "fr").map((s) => s.code), ["DREFOP", "DREFOP-SPE"]);
  assert.deepEqual(servicesOfferingPosition(TREE, "regional", POSTS, "DELEGUE_REGIONAL", "fr").map((s) => s.code), ["DREFOP"]);
  assert.deepEqual(servicesOfferingPosition(TREE, "regional", POSTS, "SECRETAIRE_GENERAL", "fr"), []);
  assert.equal(findPost(POSTS, "DREFOP-SPE", "CHEF_SERVICE")?.title, "Chef du Service SPE");
  assert.equal(findPost(POSTS, "DREFOP-SPE", "DELEGUE_REGIONAL"), null);
});

test("a preview fixes the post only when it names both halves of it", () => {
  assert.equal(previewFixesPost({ serviceCode: "DREFOP", positionType: "STAFF" }), true);
  assert.equal(previewFixesPost({ serviceCode: null, positionType: null }), false);
  // Neither half alone is a post, and the form must not show half of one.
  assert.equal(previewFixesPost({ serviceCode: "DREFOP", positionType: null }), false);
  assert.equal(previewFixesPost({ serviceCode: null, positionType: "STAFF" }), false);
});

test("a link that carries a post names it, and stops asking the holder to choose one", () => {
  const link = {
    ...POSTLESS_LINK,
    serviceCode: "DREFOP", serviceName: "Délégation Régionale", positionType: "STAFF", positionTitle: "Cadre",
  };
  const msg = groupLinkMessage(link, "https://x/inscription-agent?lien=t", "fr");
  assert.match(msg, /Personnel DREFOP, Cadre, Délégation Régionale — Centre\./);
  assert.match(msg, /Ce lien correspond à ce poste/);
  assert.ok(!msg.includes("choisissez votre service"));
  assert.match(groupLinkMessage(link, "u", "en"), /This link is for that post/);
});
