// Pins the /admin/inscriptions view URLs: toggling between the review queue
// and the coverage view must keep every active filter (?createdBy=, ?annee=),
// because a reload rebuilds the page from the URL alone.
//
// Pure logic, no DOM — run with `npm test`.

import assert from "node:assert/strict";
import test from "node:test";

import { inscriptionsHref } from "./inscriptions";

test("the queue is the default view: no ?vue=", () => {
  assert.equal(inscriptionsHref("", "file"), "/admin/inscriptions");
  assert.equal(inscriptionsHref("vue=couverture", "file"), "/admin/inscriptions");
});

test("switching views keeps ?createdBy= and ?annee=", () => {
  assert.equal(
    inscriptionsHref("createdBy=agent-1", "couverture"),
    "/admin/inscriptions?createdBy=agent-1&vue=couverture",
  );
  // And back: the agent filter and the year both survive the round trip.
  assert.equal(
    inscriptionsHref("createdBy=agent-1&vue=couverture&annee=2025", "file"),
    "/admin/inscriptions?createdBy=agent-1&annee=2025",
  );
});

test("a year change sets ?annee= and keeps the rest", () => {
  assert.equal(
    inscriptionsHref("vue=couverture&createdBy=agent-1&annee=2024", "couverture", { annee: 2025 }),
    "/admin/inscriptions?vue=couverture&createdBy=agent-1&annee=2025",
  );
});

test("removing the agent filter keeps the other parameters", () => {
  assert.equal(
    inscriptionsHref("createdBy=agent-1&annee=2025", "file", { createdBy: null }),
    "/admin/inscriptions?annee=2025",
  );
});

test("parameter values are encoded, not concatenated", () => {
  assert.equal(
    inscriptionsHref("createdBy=a%26vue%3Dx", "couverture"),
    "/admin/inscriptions?createdBy=a%26vue%3Dx&vue=couverture",
  );
});
