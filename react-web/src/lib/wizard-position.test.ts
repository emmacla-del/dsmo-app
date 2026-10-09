// Pins the stored wizard position format (N3). Pure logic — `npm test`.
// Without a window the storage helpers must be silent no-ops.

import assert from "node:assert/strict";
import test from "node:test";

import {
  clearWizardSession,
  hasAnyLegalAck,
  isWizardSessionKey,
  legalAckKey,
  parseWizardPosition,
  purgeWizardSessions,
  readLegalAck,
  readWizardPosition,
  serializeWizardPosition,
  wizardPositionKey,
  writeLegalAck,
  writeWizardPosition,
} from "./wizard-position";

const KEY = "user-1::42::enterprise::2026-Q3";

test("keys derive from the tenant-scoped draft key", () => {
  assert.equal(wizardPositionKey(KEY).endsWith(KEY), true);
  assert.equal(legalAckKey(KEY).endsWith(KEY), true);
  assert.notEqual(wizardPositionKey(KEY), legalAckKey(KEY));
  assert.equal(isWizardSessionKey(wizardPositionKey(KEY)), true);
  assert.equal(isWizardSessionKey(legalAckKey(KEY)), true);
  assert.equal(isWizardSessionKey("camleap.onefop.entryMode"), false);
  assert.equal(isWizardSessionKey(null), false);
});

test("a position survives a round trip", () => {
  const position = { stage: "section" as const, sectionIndex: 3, activeTableId: "S22Q05_ENTERPRISE" };
  assert.deepEqual(parseWizardPosition(serializeWizardPosition(position)), position);
  assert.deepEqual(parseWizardPosition(serializeWizardPosition({ stage: "quiz", sectionIndex: 1 })), {
    stage: "quiz",
    sectionIndex: 1,
  });
});

test("malformed stored values are ignored or sanitised", () => {
  assert.equal(parseWizardPosition(null), null);
  assert.equal(parseWizardPosition(""), null);
  assert.equal(parseWizardPosition("{not json"), null);
  assert.equal(parseWizardPosition("42"), null);
  assert.equal(parseWizardPosition(JSON.stringify({ stage: "legal", sectionIndex: 1 })), null);
  assert.deepEqual(parseWizardPosition(JSON.stringify({ stage: "section", sectionIndex: "2" })), {
    stage: "section",
    sectionIndex: 0,
  });
  assert.deepEqual(parseWizardPosition(JSON.stringify({ stage: "section", sectionIndex: -4.7, activeTableId: 5 })), {
    stage: "section",
    sectionIndex: 0,
  });
  assert.deepEqual(parseWizardPosition(JSON.stringify({ stage: "review", sectionIndex: 2.9 })), {
    stage: "review",
    sectionIndex: 2,
  });
});

test("without storage every helper is a silent no-op", () => {
  writeWizardPosition(KEY, { stage: "section", sectionIndex: 2 });
  writeLegalAck(KEY);
  assert.equal(readWizardPosition(KEY), null);
  assert.equal(readLegalAck(KEY), false);
  assert.equal(hasAnyLegalAck(), false);
  clearWizardSession(KEY);
  purgeWizardSessions();
});
