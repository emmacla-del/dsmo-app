import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeDossierHistory, type DossierHistoryEntry } from "./dossier-history";

const describe = {
  noteTitle: "Review note",
  anomalyResolved: (id: string) => `Anomaly ${id} resolved`,
  activityRecorded: "Activity recorded",
  stamp: (iso: string) => `at ${iso}`,
};
const received: DossierHistoryEntry = { key: "submitted", title: "Received", detail: null, stamp: "s", dot: "", at: "2026-10-01T08:00:00.000Z" };
const decided: DossierHistoryEntry = { key: "reviewed", title: "Endorsed", detail: null, stamp: "r", dot: "", at: "2026-10-03T08:00:00.000Z" };

test("milestones and notes form one list, newest first", () => {
  const merged = mergeDossierHistory([received, decided], [
    { id: "n1", createdAt: "2026-10-02T08:00:00.000Z", note: "Checked the totals.", progressType: "NOTE", anomalyId: null },
    { id: "n2", createdAt: "2026-10-04T08:00:00.000Z", note: null, progressType: "ANOMALY_RESOLVED", anomalyId: "a-9" },
  ], describe);
  assert.deepEqual(merged.map((entry) => [entry.key, entry.detail]), [
    ["note-n2", "Anomaly a-9 resolved"],
    ["reviewed", null],
    ["note-n1", "Checked the totals."],
    ["submitted", null],
  ]);
  assert.equal(merged[0].title, "Review note");
  assert.equal(merged[0].stamp, "at 2026-10-04T08:00:00.000Z");
});

test("on the same instant the milestone stays before the note, and a note with no text says activity was recorded", () => {
  const merged = mergeDossierHistory([decided], [
    { id: "n1", createdAt: decided.at, note: null, progressType: "CLAIM_ACTIVITY", anomalyId: null },
  ], describe);
  assert.deepEqual(merged.map((entry) => entry.key), ["reviewed", "note-n1"]);
  assert.equal(merged[1].detail, "Activity recorded");
});
