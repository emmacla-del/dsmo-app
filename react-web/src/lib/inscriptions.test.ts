// Pins the /admin/inscriptions view URLs: toggling between the review queue
// and the coverage view must keep every active filter (?createdBy=, ?annee=),
// because a reload rebuilds the page from the URL alone.
//
// Pure logic, no DOM — run with `npm test`.

import assert from "node:assert/strict";
import test from "node:test";

import { approvalGate, inscriptionsHref, verificationFlags, verificationRows } from "./inscriptions";

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

// ── Review verification gate ───────────────────────────────────────────────

const enterprise = {
  entityType: "ENTREPRISE",
  organisation: "Menuiserie",
  phone: "655000000",
  email: "co@example.cm",
  cnpsNumber: "CNPS1",
};
const allOk = { nameVerified: "ok", phoneVerified: "ok", contactEmailVerified: "ok", cnpsVerified: "ok" } as const;

test("the five CNPS types get four rows, in dialog order", () => {
  for (const entityType of ["ENTREPRISE", "COOPERATIVE", "CTD", "ONG", "VOCATIONAL_TRAINING"]) {
    assert.deepEqual(
      verificationRows({ ...enterprise, entityType }).map((row) => row.key),
      ["nameVerified", "phoneVerified", "contactEmailVerified", "cnpsVerified"],
    );
  }
});

test("administration and project/programme get three rows, with no CNPS", () => {
  for (const entityType of ["ADMINISTRATION", "PROJECT_PROGRAM"]) {
    assert.deepEqual(
      verificationRows({ ...enterprise, entityType, cnpsNumber: null }).map((row) => row.key),
      ["nameVerified", "phoneVerified", "contactEmailVerified"],
    );
  }
});

test("row values are trimmed, and a blank value reads as empty", () => {
  const rows = verificationRows({ ...enterprise, phone: "  655000000 ", cnpsNumber: "   " });
  assert.equal(rows[1].value, "655000000");
  assert.equal(rows[3].value, null);
});

test("approval opens only when every row is marked conforme", () => {
  const rows = verificationRows(enterprise);
  assert.deepEqual(approvalGate(rows, allOk), { canApprove: true, message: null });
  // Administration: three ✓ are enough; there is no CNPS row to mark.
  const admin = verificationRows({ ...enterprise, entityType: "ADMINISTRATION", cnpsNumber: null });
  const threeOk = { nameVerified: "ok", phoneVerified: "ok", contactEmailVerified: "ok" } as const;
  assert.equal(approvalGate(admin, threeOk).canApprove, true);
});

test("an unanswered row blocks approval, and is not read as non conforme", () => {
  const rows = verificationRows(enterprise);
  const gate = approvalGate(rows, { ...allOk, phoneVerified: undefined });
  assert.equal(gate.canApprove, false);
  assert.equal(gate.message, "Marquez chaque information comme conforme pour approuver.");
  assert.equal(approvalGate(rows, {}).message, "Marquez chaque information comme conforme pour approuver.");
});

test("a ✗ blocks approval and points to reject or complements", () => {
  const gate = approvalGate(verificationRows(enterprise), { ...allOk, cnpsVerified: "ko" });
  assert.equal(gate.canApprove, false);
  assert.match(gate.message ?? "", /rejetez le dossier ou demandez des compléments/);
});

test("an empty value blocks approval with a correction message, whatever the marks", () => {
  const rows = verificationRows({ ...enterprise, cnpsNumber: null });
  assert.deepEqual(approvalGate(rows, allOk), {
    canApprove: false,
    message: "Impossible d'approuver : le N° CNPS est vide. Demandez une correction.",
  });
  const two = verificationRows({ ...enterprise, phone: "", cnpsNumber: null });
  assert.match(approvalGate(two, allOk).message ?? "", /le téléphone \/ WhatsApp de l'entité et le N° CNPS sont vides/);
});

test("the payload flags are true only for rows marked ✓", () => {
  const rows = verificationRows(enterprise);
  assert.deepEqual(verificationFlags(rows, { nameVerified: "ok", phoneVerified: "ko" }), {
    nameVerified: true,
    phoneVerified: false,
    contactEmailVerified: false,
    cnpsVerified: false,
  });
  // No CNPS row, no CNPS flag.
  const admin = verificationRows({ ...enterprise, entityType: "ADMINISTRATION" });
  assert.equal("cnpsVerified" in verificationFlags(admin, allOk), false);
});
