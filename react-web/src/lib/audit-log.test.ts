// Pins how the audit viewers (/admin/journal-audit, the établissement
// timeline) render a registration approval: its label, and a one-line
// summary of the reviewer's verification recorded in `details`.
//
// Pure logic, no DOM — run with `npm test`.

import assert from "node:assert/strict";
import test from "node:test";

import { auditActionLabel, auditActionTone, auditDetailsSummary, type AuditLogEntry } from "./audit-log";

function entry(action: string, details: unknown): AuditLogEntry {
  return {
    id: "a1",
    userId: "actor-1",
    action,
    resourceType: "User",
    resourceId: "u-co",
    details,
    previousValue: null,
    newValue: null,
    timestamp: "2026-10-06T10:00:00.000Z",
    user: null,
  };
}

test("a registration approval has a label instead of its raw action code", () => {
  assert.equal(auditActionLabel("COMPANY_REGISTRATION_APPROVED"), "Inscription approuvée");
  assert.equal(auditActionTone("COMPANY_REGISTRATION_APPROVED"), "success");
  assert.equal(auditActionLabel("COMPANY_REGISTRATION_AUTO_APPROVED"), "Inscription approuvée automatiquement");
});

test("an approval summarises the identifier and the verified rows", () => {
  const details = {
    companyId: "c1",
    establishmentId: "EN26000712",
    verification: {
      nameVerified: true,
      phoneVerified: true,
      contactEmailVerified: true,
      cnpsVerified: true,
      attested: { name: "Menuiserie", phone: "655000000", contactEmail: "co@example.cm", cnpsNumber: "CNPS1" },
    },
  };
  assert.equal(
    auditDetailsSummary(entry("COMPANY_REGISTRATION_APPROVED", details)),
    "Identifiant EN26000712 · vérifié : nom, téléphone, email, CNPS",
  );
});

test("an administration approval lists three rows, with no CNPS", () => {
  const details = {
    establishmentId: "AD26000112",
    verification: { nameVerified: true, phoneVerified: true, contactEmailVerified: true, attested: {} },
  };
  assert.equal(
    auditDetailsSummary(entry("COMPANY_REGISTRATION_APPROVED", details)),
    "Identifiant AD26000112 · vérifié : nom, téléphone, email",
  );
});

test("an approval recorded before the review rows, or an automatic one, shows the identifier alone", () => {
  assert.equal(
    auditDetailsSummary(entry("COMPANY_REGISTRATION_APPROVED", { companyId: "c1", establishmentId: "EN26000712" })),
    "Identifiant EN26000712",
  );
  assert.equal(
    auditDetailsSummary(entry("COMPANY_REGISTRATION_AUTO_APPROVED", { establishmentId: "AD26000112", reason: "AUTO_APPROVE_ENTITY_TYPES" })),
    "Identifiant AD26000112",
  );
  assert.equal(auditDetailsSummary(entry("COMPANY_REGISTRATION_APPROVED", {})), "—");
});
