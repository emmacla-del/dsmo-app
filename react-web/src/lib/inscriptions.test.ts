// Pins the /admin/inscriptions view URLs: toggling between the review queue
// and the coverage view must keep every active filter (?createdBy=, ?annee=),
// because a reload rebuilds the page from the URL alone.
//
// Pure logic, no DOM — run with `npm test`.

import assert from "node:assert/strict";
import test from "node:test";

import {
  approvalGate,
  buildAssistedRegistrationPayload,
  daysWaiting,
  inscriptionsHref,
  isValidSocialCapital,
  registrationTerritoryChoice,
  verificationFlags,
  verificationRows,
} from "./inscriptions";

test("social capital accepts an empty value or a non-negative integer only", () => {
  assert.equal(isValidSocialCapital(undefined), true);
  assert.equal(isValidSocialCapital("   "), true);
  assert.equal(isValidSocialCapital("0"), true);
  assert.equal(isValidSocialCapital("125000"), true);
  assert.equal(isValidSocialCapital("125000.5"), false);
  assert.equal(isValidSocialCapital("-1"), false);
  assert.equal(isValidSocialCapital("not a number"), false);
});

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

test("daysWaiting counts whole days, and nothing for a file not waiting", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  assert.equal(daysWaiting("2026-10-06T13:00:00Z", now), 8);
  assert.equal(daysWaiting("2026-10-15T11:00:00Z", now), 0);
  assert.equal(daysWaiting(null, now), null);
});

// The assisted-registration form's territory fields, per level. A
// REGIONAL_ADMIN has no department of its own (resolveStaffTerritory requires
// it to be null), so it must be offered the picker: fixing the field to the
// account's department left the whole level unable to register anyone.
test("a regional admin picks the department, within its fixed region", () => {
  assert.deepEqual(registrationTerritoryChoice("REGIONAL_ADMIN"), {
    choosesRegion: false,
    choosesDepartment: true,
  });
});

test("a divisional admin picks neither: both are its posting", () => {
  assert.deepEqual(registrationTerritoryChoice("DIVISIONAL_ADMIN"), {
    choosesRegion: false,
    choosesDepartment: false,
  });
});

test("the national registration roles pick both", () => {
  for (const role of ["SUPER_ADMIN", "ADMIN_ONEFOP", "ADMIN_ONEFOP_REGISTRATIONS"]) {
    assert.deepEqual(registrationTerritoryChoice(role), {
      choosesRegion: true,
      choosesDepartment: true,
    }, role);
  }
});

test("an unknown or absent role picks nothing", () => {
  // The page is role-gated, so this is the loading render: no user yet, and
  // the fields read as the account's (empty) until one arrives.
  assert.deepEqual(registrationTerritoryChoice(null), {
    choosesRegion: false,
    choosesDepartment: false,
  });
  assert.deepEqual(registrationTerritoryChoice("CENTRAL_AGENT"), {
    choosesRegion: false,
    choosesDepartment: false,
  });
});

const vtRespondent = {
  firstName: "Awa",
  lastName: "Nkeng",
  email: "awa@example.cm",
  function: "Promotrice",
  phone1: "655000000",
  phone2: "",
};

test("assisted VT registration sends the accreditation block", () => {
  const payload = buildAssistedRegistrationPayload({
    entityType: "vocationalTraining",
    entityData: {
      centerName: "Centre de formation Awa",
      taxNumber: "NIU-1",
      cnpsNumber: "CNPS-1",
      cfpType: "Privé",
      educationSystem: "Formation professionnelle",
      functionalStatus: "Fonctionnelle",
      authorizationStatus: "Oui/ Yes",
      authorizationYear: "2025",
      authorizationOrderNumber: "0123/ARR",
      authorizationOrderDate: "15/03/2025",
    },
    respondent: vtRespondent,
    region: "Centre",
    department: "Mfoundi",
    subdivision: "Yaoundé I",
  });

  assert.equal(payload.entityType, "VOCATIONAL_TRAINING");
  assert.equal(payload.authorizationStatus, "Oui/ Yes");
  assert.equal(payload.authorizationYear, "2025");
  assert.equal(payload.authorizationOrderNumber, "0123/ARR");
  assert.equal(payload.authorizationOrderDate, "15/03/2025");
});

test("assisted VT registration drops hidden accreditation details", () => {
  const payload = buildAssistedRegistrationPayload({
    entityType: "vocationalTraining",
    entityData: {
      centerName: "Centre de formation Awa",
      cfpType: "Privé",
      educationSystem: "Formation professionnelle",
      functionalStatus: "Fonctionnelle",
      authorizationStatus: "Non/ No",
      authorizationYear: "2025",
      authorizationOrderNumber: "0123/ARR",
      authorizationOrderDate: "15/03/2025",
    },
    respondent: vtRespondent,
    region: "Centre",
    department: "Mfoundi",
    subdivision: "Yaoundé I",
  });

  assert.equal(payload.authorizationStatus, "Non/ No");
  assert.equal(payload.authorizationYear, undefined);
  assert.equal(payload.authorizationOrderNumber, undefined);
  assert.equal(payload.authorizationOrderDate, undefined);
});
