// Admin console bilingualism (Phase 1: the shell).
//
// The shared helpers take a locale and default to French, so untranslated
// callers keep rendering what they did; these tests pin both halves. The
// catalogue checks catch a key added to one language and not the other, and
// a navigation entry whose labelKey has no message.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NOT_PROVIDED,
  computeUserScopeLabel,
  count,
  dataStateMessage,
  elapsedSince,
  metricUnavailable,
  notRecorded,
  percent,
  stamp,
} from "./admin-data-state";
import { STATUS_FILTERS, directoryRoleLabel, rowStatusMeta, type DirectoryUser } from "./user-directory";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES, auditActionLabel, auditActorName, auditDetailsSummary, auditResourceLabel, auditTransition, type AuditLogEntry } from "./audit-log";
import { ENTITY_TYPE_OPTION_KEYS } from "./companies-directory";
import { buildTargetPayload, describeStored, formatCoverageCount, modeLabel, normalizeRegions } from "./pilotage-target-payload";
import { formatApiError } from "./pilotage-targets";
import { navItemsForRole, roleLabelKey } from "./role-navigation";
import { currentUiLocale } from "./ui-locale";
import { approvalGate, registrationMethodLabel, verificationRows } from "./inscriptions";
import { CAMPAIGN_PERIODICITIES, CAMPAIGN_PURPOSE_LABELS, CAMPAIGN_STATUS_LABELS, REMINDER_TYPES } from "./campaigns";
import { ANOMALY_STATUS_LABELS } from "./anomaly-registry";
import { ADMIN_HUBS } from "../app/admin/_routes";

type Catalogue = Record<string, unknown>;

function loadCatalogue(locale: "fr" | "en"): Catalogue {
  return JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"));
}

function flatKeys(node: unknown, prefix = ""): string[] {
  if (node === null || typeof node !== "object") return [prefix];
  return Object.entries(node as Catalogue).flatMap(([k, v]) => flatKeys(v, prefix ? `${prefix}.${k}` : k));
}

function lookup(catalogue: Catalogue, path: string): unknown {
  return path.split(".").reduce<unknown>((node, k) => (node as Catalogue | undefined)?.[k], catalogue);
}

test("computeUserScopeLabel: French by default, English on request", () => {
  const divisional = { role: "DIVISIONAL_ADMIN", region: "Centre", department: "Mfoundi" };
  assert.equal(computeUserScopeLabel(divisional), "Département Mfoundi");
  assert.equal(computeUserScopeLabel(divisional, "en"), "Department Mfoundi");
  assert.equal(computeUserScopeLabel({ role: "REGIONAL_ADMIN", region: "Littoral" }, "en"), "Region Littoral");
  assert.equal(computeUserScopeLabel({ role: "DIVISIONAL_ADMIN" }, "en"), "Departmental (unassigned)");
  assert.equal(computeUserScopeLabel({ role: "REGIONAL_ADMIN" }, "en"), "Regional (unassigned)");
  assert.equal(computeUserScopeLabel({ role: "SUPER_ADMIN" }, "en"), "National");
  assert.equal(computeUserScopeLabel({ role: "COMPANY" }, "en"), "Not recorded");
  // Absence is still the neutral marker, never a translated stand-in.
  assert.equal(computeUserScopeLabel(null, "en"), NOT_PROVIDED);
});

test("absence markers: French constants unchanged, English variants", () => {
  assert.equal(notRecorded(), "Non renseigné");
  assert.equal(notRecorded("en"), "Not recorded");
  assert.equal(metricUnavailable(), "Données non disponibles");
  assert.equal(metricUnavailable("en"), "Data not available");
});

test("elapsedSince: English wording", () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  assert.equal(elapsedSince(ago(0), "en"), "Just now");
  assert.equal(elapsedSince(ago(5 * 60000), "en"), "5 min ago");
  assert.equal(elapsedSince(ago(3 * 3600000), "en"), "3 h ago");
  assert.equal(elapsedSince(ago(2 * 86400000), "en"), "2 d ago");
  assert.equal(elapsedSince(ago(5 * 60000)), "Il y a 5 min");
  assert.equal(elapsedSince(null, "en"), NOT_PROVIDED);
});

test("stamp / count / percent: en-GB keeps day-first dates and drops the French percent space", () => {
  const iso = "2026-03-07T10:00:00Z";
  assert.equal(stamp(iso, false), "07/03/2026");
  assert.equal(stamp(iso, false, "en"), "07/03/2026");
  assert.equal(count(1234, "en"), "1,234");
  assert.equal(percent(42, 0, "en"), "42%");
  assert.equal(percent(42), "42 %");
  // Zero is data in both languages.
  assert.equal(count(0, "en"), "0");
});

test("dataStateMessage: English messages, French default untouched", () => {
  assert.equal(dataStateMessage("error", "the files", "en"), "Unable to load the files.");
  assert.equal(dataStateMessage("empty", "the files", "en"), "No records for the files.");
  assert.equal(dataStateMessage("unavailable", "x", "en"), "Data not available");
  assert.equal(dataStateMessage("error", "les dossiers"), "Impossible de charger les dossiers.");
  assert.equal(dataStateMessage("ready", "x", "en"), null);
});

test("directoryRoleLabel: English role names", () => {
  assert.equal(directoryRoleLabel("REGIONAL_ADMIN", "en"), "Regional");
  assert.equal(directoryRoleLabel("DIVISIONAL_ADMIN", "en"), "Departmental");
  assert.equal(directoryRoleLabel("DIVISIONAL_ADMIN"), "Divisionnaire");
  assert.equal(directoryRoleLabel("SOME_NEW_ROLE", "en"), "SOME NEW ROLE");
});

test("messages: fr.json and en.json declare the same keys", () => {
  const fr = new Set(flatKeys(loadCatalogue("fr")));
  const en = new Set(flatKeys(loadCatalogue("en")));
  assert.deepEqual([...fr].filter((k) => !en.has(k)), [], "keys missing from en.json");
  assert.deepEqual([...en].filter((k) => !fr.has(k)), [], "keys missing from fr.json");
});

test("admin navigation: every hub and labelled sub-route has a message in both languages", () => {
  for (const locale of ["fr", "en"] as const) {
    const catalogue = loadCatalogue(locale);
    for (const hub of ADMIN_HUBS) {
      assert.equal(typeof lookup(catalogue, `adminNav.hubs.${hub.key}`), "string", `${locale}: hub ${hub.key}`);
      for (const sub of hub.subRoutes) {
        assert.ok(sub.labelKey, `${sub.href} has no labelKey`);
        assert.equal(typeof lookup(catalogue, `adminNav.routes.${sub.labelKey}`), "string", `${locale}: route ${sub.labelKey}`);
      }
    }
  }
  // The French message is the French label the route already carries.
  const fr = loadCatalogue("fr");
  for (const hub of ADMIN_HUBS) {
    assert.equal(lookup(fr, `adminNav.hubs.${hub.key}`), hub.label);
    for (const sub of hub.subRoutes) {
      assert.equal(lookup(fr, `adminNav.routes.${sub.labelKey}`), sub.label);
    }
  }
});

test("target payload helpers: English labels and messages, French default kept", () => {
  const [centre] = normalizeRegions(
    [
      {
        regionId: "r1",
        name: "Centre",
        mode: "REGION",
        submissionTarget: 1200,
        departments: [{ departmentId: "d1", name: "Mfoundi", submissionTarget: null }],
      },
    ],
    "submissionTarget",
  );
  assert.equal(modeLabel("DEPARTMENT", "en"), "By department");
  assert.equal(modeLabel("MIXED", "en"), "Mixed");
  assert.equal(modeLabel(null), "Non défini");
  assert.equal(describeStored(centre, "en"), "Region only · 1,200");
  assert.equal(formatCoverageCount(1200, 5, "en"), "1,200");

  const invalid = buildTargetPayload({
    field: "submissionTarget",
    regions: [centre],
    drafts: { r1: { regionId: "r1", mode: "REGION", regionInput: "-3", departmentInputs: { d1: "" } } },
    originalCentral: null,
    centralInput: "",
    locale: "en",
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.deepEqual(invalid.errors, ['Region "Centre": must be a whole number, zero or more.']);

  const unchanged = buildTargetPayload({
    field: "submissionTarget",
    regions: [centre],
    drafts: {},
    originalCentral: null,
    centralInput: "",
  });
  assert.equal(unchanged.ok, false);
  if (!unchanged.ok) assert.deepEqual(unchanged.errors, ["Aucune modification à enregistrer."]);

  assert.equal(formatApiError(null, "en"), "The request failed.");
  assert.equal(formatApiError(null), "La requête a échoué.");
});

test("entity type option keys resolve in both catalogues", () => {
  for (const locale of ["fr", "en"] as const) {
    const catalogue = loadCatalogue(locale);
    for (const [type, key] of Object.entries(ENTITY_TYPE_OPTION_KEYS)) {
      assert.equal(typeof lookup(catalogue, key), "string", `${locale}: ${type} → ${key}`);
    }
  }
});

test("inscription review helpers: English rows, gate messages and method badges", () => {
  const item = { entityType: "ENTREPRISE", organisation: "Acme", phone: "", email: "a@b.cm", cnpsNumber: "" };
  const rows = verificationRows(item, "en");
  assert.deepEqual(rows.map((row) => row.label), ["Entity name", "Entity phone / WhatsApp", "Contact email", "CNPS No."]);
  assert.equal(
    approvalGate(rows, {}, "en").message,
    "Cannot approve: the entity phone / WhatsApp and the CNPS No. are empty. Request a correction.",
  );
  const filled = verificationRows({ ...item, phone: "6", cnpsNumber: "1" }, "en");
  assert.equal(approvalGate(filled, { nameVerified: "ko" }, "en").message, "An item is non-compliant: reject the file or request further information.");
  assert.equal(approvalGate(filled, {}, "en").message, "Mark every item as compliant to approve.");
  assert.equal(registrationMethodLabel("SELF_REGISTRATION", "en"), "Self-service");
  assert.equal(registrationMethodLabel("SELF_REGISTRATION"), "Auto-service");
  assert.equal(verificationRows(item)[0].label, "Nom de l'entité");
});

test("campaign and anomaly codes have labels in both catalogues", () => {
  const codes: [string, string[]][] = [
    ["adminCampagnesPage.status", Object.keys(CAMPAIGN_STATUS_LABELS)],
    ["adminCampagnesPage.periodicity", CAMPAIGN_PERIODICITIES],
    ["adminCampagnesPage.purpose", Object.keys(CAMPAIGN_PURPOSE_LABELS)],
    ["adminCampagnesPage.reminderType", REMINDER_TYPES.map((r) => r.value)],
    ["adminCentreQualitePage.anomalyStatus", Object.keys(ANOMALY_STATUS_LABELS)],
  ];
  for (const locale of ["fr", "en"] as const) {
    const catalogue = loadCatalogue(locale);
    for (const [prefix, values] of codes) {
      for (const value of values) {
        assert.equal(typeof lookup(catalogue, `${prefix}.${value}`), "string", `${locale}: ${prefix}.${value}`);
      }
    }
  }
  // The French labels are the ones the code already carried.
  const fr = loadCatalogue("fr");
  for (const [code, label] of Object.entries(CAMPAIGN_STATUS_LABELS)) {
    assert.equal(lookup(fr, `adminCampagnesPage.status.${code}`), label);
  }
});

test("audit log helpers: English labels, summaries and transitions; French default", () => {
  const entry = (action: string, details: unknown, user: AuditLogEntry["user"] = null): AuditLogEntry => ({
    id: "a1", userId: "u1", action, resourceType: "OnefopSubmission", resourceId: null,
    details, previousValue: null, newValue: null, timestamp: "2026-03-07T10:00:00Z", user,
  });
  assert.equal(auditActionLabel("AUDIT_BULK_VISA_GRANTED", "en"), "Bulk endorsement");
  assert.equal(auditActionLabel("AUDIT_BULK_VISA_GRANTED"), "Visa en lot");
  assert.equal(auditActionLabel("SOMETHING_NEW", "en"), "SOMETHING_NEW");
  assert.equal(auditResourceLabel("Company", "en"), "Establishment");
  assert.equal(auditActorName(entry("X", null), "en"), "System");
  assert.equal(auditActorName(entry("X", null)), "Système");
  assert.equal(
    auditDetailsSummary(entry("AUDIT_BULK_VISA_GRANTED", { processedCount: 3, rejectedCount: 1, totalRequested: 4 }), "en"),
    "3 endorsed, 1 refused of 4",
  );
  assert.equal(
    auditDetailsSummary(entry("COMPANY_REGISTRATION_APPROVED", { establishmentId: "EN1", verification: { nameVerified: true, cnpsVerified: true } }), "en"),
    "ID EN1 · verified: name, CNPS",
  );
  assert.equal(
    auditTransition(entry("AUDIT_CORRECTION", { previousStatus: "PENDING_REVIEW" }), "en"),
    "Pending → Correction requested",
  );
  assert.equal(
    auditTransition(entry("USER_TERRITORY_CHANGED", { previousRole: "REGIONAL_ADMIN", newRole: "DIVISIONAL_ADMIN", newDepartment: "Mfoundi" }), "en"),
    "Regional → Departmental · Mfoundi",
  );
  // Every action and resource type the filters offer has an English label.
  for (const action of Object.keys(AUDIT_ACTIONS)) assert.notEqual(auditActionLabel(action, "en"), action, action);
  // Resource keys are PascalCase and some English labels equal them ("User"), so only spot-check.
  assert.equal(auditResourceLabel("OnefopSubmission", "en"), "ONEFOP file");
  assert.equal(Object.keys(AUDIT_RESOURCE_TYPES).length, 8);
});

test("user directory status labels in English", () => {
  const user = { status: "ACTIVE", isActive: false } as DirectoryUser;
  assert.equal(rowStatusMeta(user, "en").label, "Suspended");
  assert.equal(rowStatusMeta(user).label, "Suspendu");
  assert.ok(STATUS_FILTERS.every((f) => f.labelEn && f.label));
});

test("settings role card: every UserRole has a statutory title and description in both catalogues", () => {
  const roles = ["SUPER_ADMIN", "ADMIN_ONEFOP", "REGIONAL_ADMIN", "DIVISIONAL_ADMIN", "AUDITOR", "COMPANY"];
  for (const locale of ["fr", "en"] as const) {
    const catalogue = loadCatalogue(locale);
    for (const role of roles) {
      assert.equal(typeof lookup(catalogue, `adminParametresPage.role.${role}.name`), "string", `${locale}: ${role}`);
      assert.equal(typeof lookup(catalogue, `adminParametresPage.role.${role}.description`), "string", `${locale}: ${role}`);
    }
  }
});

test("/home navigation: every role badge and nav item has a label in both catalogues", () => {
  const roles = ["COMPANY", "DIVISIONAL_ADMIN", "REGIONAL_ADMIN", "ADMIN_ONEFOP", "SUPER_ADMIN", "AUDITOR"];
  for (const locale of ["fr", "en"] as const) {
    const catalogue = loadCatalogue(locale);
    for (const role of roles) {
      const roleKey = roleLabelKey(role);
      assert.ok(roleKey, role);
      assert.equal(typeof lookup(catalogue, roleKey!), "string", `${locale}: ${roleKey}`);
      for (const item of navItemsForRole(role)) {
        assert.equal(typeof lookup(catalogue, item.labelKey), "string", `${locale}: ${item.labelKey}`);
      }
    }
  }
  assert.equal(roleLabelKey("SOMETHING_NEW"), null);
  // No label carries both languages any more ("Accueil/ Home").
  const fr = loadCatalogue("fr");
  for (const role of roles) {
    for (const item of navItemsForRole(role)) assert.doesNotMatch(String(lookup(fr, item.labelKey)), /\/ [A-Z]/);
  }
});

test("currentUiLocale: French outside the browser", () => {
  assert.equal(currentUiLocale(), "fr");
});
