import assert from "node:assert/strict";
import test from "node:test";

import {
  REGISTRATION_QUEUE_HREF,
  decisionStaysListed,
  findNextInQueue,
  isRegistrationReviewPath,
  parseRegistrationTrail,
  registrationReviewHref,
  resolveRegistrationReturnTo,
  trailPosition,
  trailWithout,
  type RegistrationTrail,
} from "./registration-trail";

const trail: RegistrationTrail = {
  returnTo: "/admin/inscriptions?vue=queue&page=2",
  params: { view: "queue" },
  page: 2,
  pageSize: 3,
  total: 8,
  ids: ["d", "e", "f"],
};

test("the position counts across pages and names both neighbours", () => {
  assert.deepEqual(trailPosition(trail, "e"), {
    position: 5, total: 8, previousId: "d", nextId: "f", previousPage: null, nextPage: null,
  });
});

test("at a page edge the neighbour comes from the adjacent page", () => {
  assert.equal(trailPosition(trail, "d")?.previousPage, 1);
  assert.equal(trailPosition(trail, "f")?.nextPage, 3);
  assert.equal(trailPosition({ ...trail, page: 1, total: 3, ids: ["a", "b", "c"] }, "c")?.nextPage, null);
});

test("a file outside the trail has no position", () => {
  assert.equal(trailPosition(trail, "z"), null);
  assert.equal(trailPosition(null, "e"), null);
});

test("a decided file leaves the trail", () => {
  const next = trailWithout(trail, "e");
  assert.deepEqual(next.ids, ["d", "f"]);
  assert.equal(next.total, 7);
  assert.equal(trailPosition(next, "f")?.position, 5);
});

test("a file that stays in the list keeps the total but is remembered as decided", () => {
  const next = trailWithout(trail, "e", true);
  assert.deepEqual(next.ids, ["d", "f"]);
  assert.equal(next.total, 8);
  assert.deepEqual(next.decided, ["e"]);
});

test("only the decisions that keep a file in the filter leave it listed", () => {
  assert.equal(decisionStaysListed({ view: "queue" }, "complements"), true);
  assert.equal(decisionStaysListed({ view: "queue" }, "approved"), false);
  assert.equal(decisionStaysListed({ status: "COMPLEMENTS_REQUESTED" }, "complements"), true);
  assert.equal(decisionStaysListed({ status: "PENDING_APPROVAL" }, "complements"), false);
  assert.equal(decisionStaysListed({ overdue: true }, "complements"), false);
  assert.equal(decisionStaysListed({ status: "ALL" }, "rejected"), true);
  assert.equal(decisionStaysListed({ statuses: "PENDING_APPROVAL,COMPLEMENTS_REQUESTED,ACTIVE,REJECTED" }, "approved"), true);
  assert.equal(decisionStaysListed({ statuses: "REJECTED" }, "approved"), false);
});

/** A live queue of `rows`, paged as the server pages it. */
function livePages(rows: string[], pageSize: number) {
  const asked: number[] = [];
  const fetchPage = async (page: number) => {
    asked.push(page);
    return { page, total: rows.length, items: rows.slice((page - 1) * pageSize, page * pageSize).map((id) => ({ id })) };
  };
  return { asked, fetchPage };
}

test("after decisions the next file is the one that moved up, not the next page's first", async () => {
  // a b c | d e f | g h: a and b are decided, so d and e moved onto page 1.
  const { fetchPage } = livePages(["c", "d", "e", "f", "g", "h"], 3);
  const open: RegistrationTrail = { ...trail, page: 1, total: 6, ids: ["c"], decided: ["a", "b"] };
  const next = await findNextInQueue(open, "c", fetchPage);
  assert.equal(next?.nextId, "d");
  assert.equal(next?.page, 1);
  assert.equal(next?.total, 6);
});

test("with nothing decided the search goes straight to the next page", async () => {
  const { asked, fetchPage } = livePages(["a", "b", "c", "d"], 3);
  const open: RegistrationTrail = { ...trail, page: 1, total: 4, ids: ["a", "b", "c"] };
  assert.equal((await findNextInQueue(open, "c", fetchPage))?.nextId, "d");
  assert.deepEqual(asked, [2]);
});

test("a decided file still listed is not offered again, and the search carries on", async () => {
  const { asked, fetchPage } = livePages(["a", "b", "c", "d"], 3);
  const open: RegistrationTrail = { ...trail, page: 1, total: 4, ids: ["b", "c"], decided: ["a"] };
  assert.equal((await findNextInQueue(open, "c", fetchPage))?.nextId, "d");
  assert.deepEqual(asked, [1, 2]);
});

test("the search ends when no file is left", async () => {
  const { fetchPage } = livePages(["a", "b"], 3);
  const open: RegistrationTrail = { ...trail, page: 1, total: 2, ids: ["a", "b"], decided: ["z"] };
  assert.equal(await findNextInQueue(open, "b", fetchPage), null);
});

test("the return destination is the registration queue only", () => {
  assert.equal(resolveRegistrationReturnTo("/admin/inscriptions?vue=queue&region=Centre"), "/admin/inscriptions?vue=queue&region=Centre");
  assert.equal(resolveRegistrationReturnTo("/admin/inscriptions?vue=queue&decisionNotice=approved"), "/admin/inscriptions?vue=queue");
  assert.equal(resolveRegistrationReturnTo("/admin/inscriptions?vue=queue&decisionNotice=approved&decidedFile=r1"), "/admin/inscriptions?vue=queue");
  assert.equal(resolveRegistrationReturnTo("/admin/inscriptions"), "/admin/inscriptions");
  assert.equal(resolveRegistrationReturnTo("https://evil.example/admin/inscriptions"), REGISTRATION_QUEUE_HREF);
  assert.equal(resolveRegistrationReturnTo("//evil.example"), REGISTRATION_QUEUE_HREF);
  assert.equal(resolveRegistrationReturnTo("/admin/dossiers"), REGISTRATION_QUEUE_HREF);
  assert.equal(resolveRegistrationReturnTo("/admin/inscriptions?vue=organisations"), REGISTRATION_QUEUE_HREF);
  assert.equal(resolveRegistrationReturnTo(null), REGISTRATION_QUEUE_HREF);
});

test("the review link carries the queue to return to", () => {
  assert.equal(
    registrationReviewHref("user 1", "/admin/inscriptions?vue=queue"),
    "/admin/inscriptions/user%201?returnTo=%2Fadmin%2Finscriptions%3Fvue%3Dqueue",
  );
});

test("a review path is one file, not the queue or the assisted-registration form", () => {
  assert.equal(isRegistrationReviewPath("/admin/inscriptions/user-1"), true);
  assert.equal(isRegistrationReviewPath("/admin/inscriptions/nouvelle-entreprise"), true);
  assert.equal(isRegistrationReviewPath("/admin/inscriptions"), false);
  assert.equal(isRegistrationReviewPath("/admin/inscriptions/"), false);
  assert.equal(isRegistrationReviewPath("/admin/inscriptions/nouvelle"), false);
  assert.equal(isRegistrationReviewPath("/admin/dossiers/user-1"), false);
});

test("a stored trail is read back only when well formed", () => {
  assert.deepEqual(parseRegistrationTrail(JSON.stringify(trail)), trail);
  assert.equal(parseRegistrationTrail(JSON.stringify({ ...trail, page: 0 })), null);
  assert.equal(parseRegistrationTrail(JSON.stringify({ ...trail, decided: [1] })), null);
  assert.equal(parseRegistrationTrail("{"), null);
  assert.equal(parseRegistrationTrail(null), null);
  assert.equal(parseRegistrationTrail(JSON.stringify({ ...trail, returnTo: "//evil" }))?.returnTo, REGISTRATION_QUEUE_HREF);
});
