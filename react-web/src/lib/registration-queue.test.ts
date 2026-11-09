import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "./api-client";
import {
  claimTimeLeft,
  geoLevelFor,
  hasActiveQueueFilters,
  isClaimConflict,
  oldestPendingHref,
  parseQueueUrl,
  queueHref,
  queueListParams,
  queueSummaryParams,
  receiptStamp,
  rowInView,
  territoryParts,
  waitingDuration,
} from "./registration-queue";

test("each level picks one territory below its own, and nobody below divisional", () => {
  assert.equal(geoLevelFor("SUPER_ADMIN"), "region");
  assert.equal(geoLevelFor("ADMIN_ONEFOP"), "region");
  assert.equal(geoLevelFor("ADMIN_ONEFOP_REGISTRATIONS"), "region");
  assert.equal(geoLevelFor("REGIONAL_ADMIN"), "department");
  assert.equal(geoLevelFor("DIVISIONAL_ADMIN"), "subdivision");
  assert.equal(geoLevelFor("CENTRAL_AGENT"), null);
  assert.equal(geoLevelFor(undefined), null);
});

test("the queue opens on available, oldest first, page 1", () => {
  assert.deepEqual(parseQueueUrl("", "ADMIN_ONEFOP"), {
    ownership: "available", search: "", geo: "", type: "", sort: "oldest", page: 1,
  });
});

test("the URL keeps ownership, search, geography, type, order and page", () => {
  const state = parseQueueUrl("vue=queue&owner=mine&search=Acme&department=Wouri&type=ONG&sort=newest&page=3", "REGIONAL_ADMIN");
  assert.deepEqual(state, { ownership: "mine", search: "Acme", geo: "Wouri", type: "ONG", sort: "newest", page: 3 });
  assert.equal(queueHref(state, "REGIONAL_ADMIN"), "/admin/inscriptions?vue=queue&owner=mine&search=Acme&department=Wouri&type=ONG&sort=newest&page=3");
  assert.deepEqual(parseQueueUrl(queueHref(state, "REGIONAL_ADMIN").split("?")[1], "REGIONAL_ADMIN"), state);
});

test("a geography parameter the role cannot pick is ignored", () => {
  assert.equal(parseQueueUrl("region=Littoral", "DIVISIONAL_ADMIN").geo, "");
  assert.equal(parseQueueUrl("subdivision=Douala 1er", "DIVISIONAL_ADMIN").geo, "Douala 1er");
});

test("legacy and unknown values fall back to safe defaults", () => {
  assert.equal(parseQueueUrl("assignedToMe=1", "ADMIN_ONEFOP").ownership, "mine");
  assert.equal(parseQueueUrl("owner=other", "ADMIN_ONEFOP").ownership, "available");
  assert.equal(parseQueueUrl("type=UNKNOWN", "ADMIN_ONEFOP").type, "");
  assert.equal(parseQueueUrl("sort=sideways", "ADMIN_ONEFOP").sort, "oldest");
  assert.equal(parseQueueUrl("page=-2", "ADMIN_ONEFOP").page, 1);
  // Old queue parameters (status, createdBy, duplicates) are not carried.
  assert.equal(queueHref(parseQueueUrl("status=ALL&createdBy=u1&duplicates=with", "ADMIN_ONEFOP"), "ADMIN_ONEFOP"), "/admin/inscriptions?vue=queue");
});

test("ownership and order are not filters; search, geography and type are", () => {
  assert.equal(hasActiveQueueFilters({ search: "", geo: "", type: "" }), false);
  assert.equal(hasActiveQueueFilters({ search: "x", geo: "", type: "" }), true);
  assert.equal(hasActiveQueueFilters({ search: "", geo: "Centre", type: "" }), true);
  assert.equal(hasActiveQueueFilters({ search: "", geo: "", type: "ONG" }), true);
});

test("the list asks for pending files only, by ownership, with every filter", () => {
  const available = queueListParams(parseQueueUrl("search=NIU1&region=Centre&type=CTD", "ADMIN_ONEFOP"), "ADMIN_ONEFOP");
  assert.deepEqual(available, {
    view: "queue", status: "PENDING_APPROVAL", unassigned: true, region: "Centre",
    search: "NIU1", entityType: "CTD", sortOrder: "oldest",
  });
  const mine = queueListParams(parseQueueUrl("owner=mine&subdivision=Douala 1er&sort=newest", "DIVISIONAL_ADMIN"), "DIVISIONAL_ADMIN");
  assert.equal(mine.assignedToMe, true);
  assert.equal(mine.unassigned, undefined);
  assert.equal(mine.subdivision, "Douala 1er");
  assert.equal(mine.sortOrder, "newest");
});

test("the summary follows geography only: one row, oldest first", () => {
  assert.deepEqual(queueSummaryParams("available", "Wouri", "REGIONAL_ADMIN"), {
    view: "queue", status: "PENDING_APPROVAL", unassigned: true, department: "Wouri",
    sortOrder: "oldest", page: 1, pageSize: 1,
  });
  const mine = queueSummaryParams("mine", "", "ADMIN_ONEFOP");
  assert.equal(mine.assignedToMe, true);
  assert.equal("search" in mine, false);
  assert.equal("entityType" in mine, false);
});

test("each file is in exactly one view: free, mine, or a colleague's", () => {
  assert.equal(rowInView({ assigneeId: null }, "available", "me"), true);
  assert.equal(rowInView({ assigneeId: "other" }, "available", "me"), false);
  assert.equal(rowInView({ assigneeId: "me" }, "mine", "me"), true);
  assert.equal(rowInView({ assigneeId: "other" }, "mine", "me"), false);
  assert.equal(rowInView({ assigneeId: null }, "mine", "me"), false);
  assert.equal(rowInView({ assigneeId: "other" }, "others", "me"), true);
  assert.equal(rowInView({ assigneeId: "me" }, "others", "me"), false);
  assert.equal(rowInView({ assigneeId: null }, "others", "me"), false);
});

test("the colleagues view has its own address and asks the server for files others hold", () => {
  const state = parseQueueUrl("owner=others&type=ONG", "ADMIN_ONEFOP");
  assert.equal(state.ownership, "others");
  assert.equal(queueHref(state, "ADMIN_ONEFOP"), "/admin/inscriptions?vue=queue&owner=others&type=ONG");
  const params = queueListParams(state, "ADMIN_ONEFOP");
  assert.equal(params.assignedToOthers, true);
  assert.equal(params.unassigned, undefined);
  assert.equal(params.assignedToMe, undefined);
  assert.equal(queueSummaryParams("others", "", "ADMIN_ONEFOP").assignedToOthers, true);
});

test("a claim's time left reads in hours and minutes, and warns in its last 30 minutes", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();
  const left = (minutes: number, locale: "en" | "fr" = "en") => claimTimeLeft(at(minutes), now, locale);
  assert.deepEqual(left(80), { label: "1 hr 20 mins", urgent: false, lapsed: false });
  assert.deepEqual(left(120), { label: "2 hrs", urgent: false, lapsed: false });
  assert.deepEqual(left(29), { label: "29 mins", urgent: true, lapsed: false });
  assert.deepEqual(left(-5), { label: "0 mins", urgent: true, lapsed: true });
  assert.equal(left(80, "fr")?.label.replace(/\s/gu, " "), "1 h 20 min");
  assert.equal(claimTimeLeft(null, now, "en"), null);
  assert.equal(claimTimeLeft("not a date", now, "en"), null);
});

test("waiting time reads in minutes, hours or days, from the receipt time", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  assert.equal(waitingDuration("2026-11-09T11:55:00Z", now, "en"), "5 minutes");
  assert.equal(waitingDuration("2026-11-09T06:00:00Z", now, "en"), "6 hours");
  assert.equal(waitingDuration("2026-10-22T12:00:00Z", now, "en"), "18 days");
  assert.equal(waitingDuration("2026-10-22T12:00:00Z", now, "fr")?.replace(/\s/gu, " "), "18 jours");
  assert.equal(waitingDuration("2026-11-09T13:00:00Z", now, "en"), "1 minute");
});

test("a missing or unreadable receipt time is unavailable, never zero", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  assert.equal(waitingDuration(null, now, "en"), null);
  assert.equal(waitingDuration("", now, "en"), null);
  assert.equal(waitingDuration("not a date", now, "en"), null);
  assert.equal(receiptStamp(null, "en"), null);
  assert.match(receiptStamp("2026-11-09T06:00:00Z", "en") ?? "", /9 November 2026/);
});

test("only a 409 is a claim conflict", () => {
  assert.equal(isClaimConflict(new ApiError(409, "taken")), true);
  assert.equal(isClaimConflict(new ApiError(403, "no")), false);
  assert.equal(isClaimConflict(new Error("network")), false);
});

test("the territory cell follows the officer's level", () => {
  const row = { region: "Littoral", department: "Wouri", subdivision: "Douala 1er" };
  assert.deepEqual(territoryParts(row, "ADMIN_ONEFOP"), ["Littoral", "Wouri"]);
  assert.deepEqual(territoryParts(row, "REGIONAL_ADMIN"), ["Wouri", "Douala 1er"]);
  assert.deepEqual(territoryParts(row, "DIVISIONAL_ADMIN"), ["Douala 1er"]);
  assert.deepEqual(territoryParts({ ...row, subdivision: "" }, "DIVISIONAL_ADMIN"), []);
});

test("a « waiting too long » figure opens the unclaimed queue, oldest first, at the reader's geography", () => {
  assert.equal(oldestPendingHref({ region: "Centre", department: "Mfoundi", entityType: "ONG" }, "ADMIN_ONEFOP"), "/admin/inscriptions?vue=queue&region=Centre&type=ONG");
  assert.equal(oldestPendingHref({ region: "Centre", department: "Mfoundi" }, "REGIONAL_ADMIN"), "/admin/inscriptions?vue=queue&department=Mfoundi");
  assert.equal(oldestPendingHref({ region: "Centre" }, "REGIONAL_ADMIN"), "/admin/inscriptions?vue=queue");
  assert.equal(oldestPendingHref({ entityType: "UNKNOWN" }, "ADMIN_ONEFOP"), "/admin/inscriptions?vue=queue");
  // No old overdue status is carried: the queue has none.
  assert.equal(oldestPendingHref({}, "DIVISIONAL_ADMIN").includes("OVERDUE"), false);
});
