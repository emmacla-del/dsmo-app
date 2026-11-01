import { test } from "node:test";
import assert from "node:assert/strict";
import { dossierQueueScrollKey, readDossierQueueScroll, saveDossierQueueScroll } from "./dossier-scroll-restore";

function storage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

test("each queue URL keeps its own position, rounded", () => {
  const session = storage();
  const mine = dossierQueueScrollKey("/admin/dossiers?vue=submissions&queueView=mine");
  const pending = dossierQueueScrollKey("/admin/dossiers?vue=submissions&queueView=pending&submissionsPage=2");
  saveDossierQueueScroll(() => session, mine, 812.6);
  saveDossierQueueScroll(() => session, pending, 40);
  assert.equal(readDossierQueueScroll(() => session, mine), 813);
  assert.equal(readDossierQueueScroll(() => session, pending), 40);
  // Reading does not consume it: coming back twice lands twice.
  assert.equal(readDossierQueueScroll(() => session, mine), 813);
});

test("a later scroll replaces the saved position", () => {
  const session = storage();
  const key = dossierQueueScrollKey("/admin/dossiers?vue=submissions");
  saveDossierQueueScroll(() => session, key, 300);
  saveDossierQueueScroll(() => session, key, 120);
  assert.equal(readDossierQueueScroll(() => session, key), 120);
});

test("invalid values and missing or throwing storage are harmless", () => {
  const session = storage();
  const key = dossierQueueScrollKey("/admin/dossiers");
  saveDossierQueueScroll(() => session, key, Number.NaN);
  saveDossierQueueScroll(() => session, key, -5);
  assert.equal(readDossierQueueScroll(() => session, key), null);
  session.values.set(key, "12px");
  assert.equal(readDossierQueueScroll(() => session, key), null);
  assert.equal(readDossierQueueScroll(() => null, key), null);
  // Reading window.sessionStorage itself throws when site data is blocked.
  const blocked = () => { throw new DOMException("blocked", "SecurityError"); };
  assert.doesNotThrow(() => saveDossierQueueScroll(blocked, key, 50));
  assert.equal(readDossierQueueScroll(blocked, key), null);
});
