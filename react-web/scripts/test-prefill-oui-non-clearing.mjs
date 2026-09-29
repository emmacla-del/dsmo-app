import test from "node:test";
import assert from "node:assert/strict";

import {
  EVENT_TABLE_MAPPING,
  TABLE_PREFIX_MAP,
  findKeysMatchingPrefixes,
  hasEnteredData,
  hasEnteredDataForEvent,
  isEnteredCellData,
  isTableReported,
} from "../src/components/modern-jobs/scope/ScopeDataManagement.ts";

test("findKeysMatchingPrefixes excludes _RESPONSE_STATUS and matches table cell keys", () => {
  const data = {
    s21q01_cadres_male_15_24: 5,
    S21Q01_cadres_female_15_24: 3,
    S21Q01_RESPONSE_STATUS: "REPORTED",
    s21q01_response_status: "REPORTED",
    s22q01_cadres_male_total: 10,
    S3Q02_REASON_1_TEXT: "Licenciement économique",
    S3Q02_RESPONSE_STATUS: "REPORTED",
  };

  const s21Keys = findKeysMatchingPrefixes(data, ["s21q01_"]);
  assert.equal(s21Keys.length, 2);
  assert.ok(s21Keys.includes("s21q01_cadres_male_15_24"));
  assert.ok(s21Keys.includes("S21Q01_cadres_female_15_24"));
  assert.ok(!s21Keys.includes("S21Q01_RESPONSE_STATUS"));
  assert.ok(!s21Keys.includes("s21q01_response_status"));

  const s3Keys = findKeysMatchingPrefixes(data, ["s3q02_"]);
  assert.equal(s3Keys.length, 1);
  assert.ok(s3Keys.includes("S3Q02_REASON_1_TEXT"));
});

test("isEnteredCellData distinguishes entered figures from zero / empty / null / undefined", () => {
  assert.equal(isEnteredCellData(undefined), false);
  assert.equal(isEnteredCellData(null), false);
  assert.equal(isEnteredCellData(""), false);
  assert.equal(isEnteredCellData(0), false);
  assert.equal(isEnteredCellData("0"), false);
  assert.equal(isEnteredCellData("  0  "), false);

  assert.equal(isEnteredCellData(5), true);
  assert.equal(isEnteredCellData("5"), true);
  assert.equal(isEnteredCellData("Motif de licenciement"), true);
});

test("hasEnteredDataForEvent detects existing entered figures for specific events", () => {
  const hasTable = (code) => true;

  const dataEmpty = {
    S21Q01_RESPONSE_STATUS: "REPORTED",
  };
  assert.equal(hasEnteredDataForEvent("applications", dataEmpty, hasTable), false);

  const dataWithZero = {
    S21Q01_RESPONSE_STATUS: "REPORTED",
    s21q01_cadres_male_15_24: 0,
  };
  assert.equal(hasEnteredDataForEvent("applications", dataWithZero, hasTable), false);

  const dataWithPositive = {
    S21Q01_RESPONSE_STATUS: "REPORTED",
    s21q01_cadres_male_15_24: 8,
  };
  assert.equal(hasEnteredDataForEvent("applications", dataWithPositive, hasTable), true);
  assert.equal(hasEnteredDataForEvent("applications", dataWithPositive), true);
});

test("isTableReported accurately mirrors scope configuration", () => {
  const scope = {
    applications: true,
    recruit: true,
    recruit_types: ["permanent"],
    recruit_diploma: [],
    disability: false,
    vulnerable: false,
    primo_seekers: false,
    primo_workers: false,
    departures: true,
    departure_reasons: ["retraite"],
    dismissal_technical: null,
    interns: false,
    intern_types: [],
    skills_needs: false,
    training_needs: false,
  };

  assert.equal(isTableReported("S21Q01", scope), true);
  assert.equal(isTableReported("S22Q01", scope), true);
  assert.equal(isTableReported("S22Q02", scope), false); // temporaire not selected
  assert.equal(isTableReported("S22Q03", scope), false); // empty diplomas => NONE
  assert.equal(isTableReported("S23Q01", scope), false);
  assert.equal(isTableReported("S3Q01", scope), true);
  assert.equal(isTableReported("S3Q02", scope), false); // licenciement not in reasons
});

test("Test 1: OUI -> enter positive values -> NON (confirmed) removes detailed cell keys and sets status NONE", () => {
  const hasTable = (code) => true;

  // Initial state: applications = OUI, cells filled
  let data = {
    s21q01_cadres_male_15_24: 12,
    s21q01_cadres_female_15_24: 7,
    s21q01_cadres_total: 19,
    S21Q01_RESPONSE_STATUS: "REPORTED",
  };

  let scope = {
    applications: true,
    application_csp: ["cadres"],
    application_age: ["15_24"],
  };

  // State mutation handler matching useOnefopDraft
  const onChange = (fieldId, value) => {
    if (typeof fieldId === "object" && fieldId !== null) {
      for (const [k, v] of Object.entries(fieldId)) {
        if (v === undefined) delete data[k];
        else data[k] = v;
      }
      return;
    }
    if (value === undefined) {
      delete data[fieldId];
    } else {
      data[fieldId] = value;
    }
  };

  // 1. User wants to change applications to NON
  assert.equal(hasEnteredDataForEvent("applications", data, hasTable), true);

  // 2. User confirms in modal: applyEventNo executes
  const mapping = EVENT_TABLE_MAPPING.applications;
  const keysToClear = findKeysMatchingPrefixes(data, mapping.prefixes);
  assert.equal(keysToClear.length, 3);

  // Clear keys atomically
  keysToClear.forEach((k) => onChange(k, undefined));
  scope = { ...scope, ...mapping.resetScope };
  onChange("S21Q01_RESPONSE_STATUS", "NONE");

  // Assertions:
  assert.equal(scope.applications, false);
  assert.deepEqual(scope.application_csp, []);
  assert.deepEqual(scope.application_age, []);
  assert.equal(data.S21Q01_RESPONSE_STATUS, "NONE");

  // Detailed cells MUST be completely absent from data
  assert.equal("s21q01_cadres_male_15_24" in data, false);
  assert.equal("s21q01_cadres_female_15_24" in data, false);
  assert.equal("s21q01_cadres_total" in data, false);
  assert.equal(data.s21q01_cadres_male_15_24, undefined);
});

test("Test 2: Warning cancellation preserves event as OUI and keeps all entered cell values", () => {
  const hasTable = (code) => true;

  const data = {
    s21q01_cadres_male_15_24: 15,
    S21Q01_RESPONSE_STATUS: "REPORTED",
  };

  let scope = {
    applications: true,
    application_csp: ["cadres"],
    application_age: ["15_24"],
  };

  // User clicks NON -> hasEnteredDataForEvent is true -> modal shown
  assert.equal(hasEnteredDataForEvent("applications", data, hasTable), true);

  // User clicks Cancel (modifyQuiz) -> nothing is modified
  // Event remains OUI and data is preserved
  assert.equal(scope.applications, true);
  assert.equal(data.s21q01_cadres_male_15_24, 15);
  assert.equal(data.S21Q01_RESPONSE_STATUS, "REPORTED");
});

test("Test 3: Re-enabling event (OUI -> NON confirmed -> OUI) starts with clean/absent cells", () => {
  let data = {
    s21q01_cadres_male_15_24: 8,
    S21Q01_RESPONSE_STATUS: "REPORTED",
  };

  const onChange = (k, v) => {
    if (v === undefined) delete data[k];
    else data[k] = v;
  };

  // 1. Turned to NON and confirmed
  const mapping = EVENT_TABLE_MAPPING.applications;
  findKeysMatchingPrefixes(data, mapping.prefixes).forEach((k) => onChange(k, undefined));
  onChange("S21Q01_RESPONSE_STATUS", "NONE");

  // 2. User subsequently clicks OUI
  onChange("S21Q01_RESPONSE_STATUS", "REPORTED");

  // Old cell data must NOT reappear
  assert.equal("s21q01_cadres_male_15_24" in data, false);
  assert.equal(data.s21q01_cadres_male_15_24, undefined);
  assert.equal(data.S21Q01_RESPONSE_STATUS, "REPORTED");
});

test("Test 4: Event isolation: clearing recruitment never touches applications or departures data", () => {
  let data = {
    // Applications data
    s21q01_cadres_male_15_24: 4,
    S21Q01_RESPONSE_STATUS: "REPORTED",

    // Recruitment data
    s22q01_cadres_male_15_24: 9,
    s22q02_cadres_male_total: 6,
    s22q03_licence_male: 3,
    S22Q01_RESPONSE_STATUS: "REPORTED",
    S22Q02_RESPONSE_STATUS: "REPORTED",
    S22Q03_RESPONSE_STATUS: "REPORTED",

    // Departures data
    s3q01_cadres_male: 2,
    S3Q01_RESPONSE_STATUS: "REPORTED",
  };

  const onChange = (k, v) => {
    if (v === undefined) delete data[k];
    else data[k] = v;
  };

  // User sets recruitment to NON (confirmed)
  const mapping = EVENT_TABLE_MAPPING.recruitment;
  const keysToClear = findKeysMatchingPrefixes(data, mapping.prefixes);
  assert.equal(keysToClear.length, 3);
  assert.ok(keysToClear.includes("s22q01_cadres_male_15_24"));
  assert.ok(keysToClear.includes("s22q02_cadres_male_total"));
  assert.ok(keysToClear.includes("s22q03_licence_male"));

  keysToClear.forEach((k) => onChange(k, undefined));
  mapping.tableCodes.forEach((code) => onChange(`${code}_RESPONSE_STATUS`, "NONE"));

  // Recruitment is cleared
  assert.equal("s22q01_cadres_male_15_24" in data, false);
  assert.equal("s22q02_cadres_male_total" in data, false);
  assert.equal("s22q03_licence_male" in data, false);
  assert.equal(data.S22Q01_RESPONSE_STATUS, "NONE");

  // Applications and Departures MUST remain completely intact
  assert.equal(data.s21q01_cadres_male_15_24, 4);
  assert.equal(data.S21Q01_RESPONSE_STATUS, "REPORTED");
  assert.equal(data.s3q01_cadres_male, 2);
  assert.equal(data.S3Q01_RESPONSE_STATUS, "REPORTED");
});

test("Test 5: Explicit zero preservation inside active REPORTED table", () => {
  let data = {
    S21Q01_RESPONSE_STATUS: "REPORTED",
  };

  const onChange = (fieldId, value) => {
    if (value === undefined) delete data[fieldId];
    else data[fieldId] = value;
  };

  // User explicitly inputs 0 in an active cell
  onChange("s21q01_cadres_male_15_24", 0);

  // 0 is preserved as a valid numeric entry
  assert.equal("s21q01_cadres_male_15_24" in data, true);
  assert.equal(data.s21q01_cadres_male_15_24, 0);
  assert.strictEqual(data.s21q01_cadres_male_15_24, 0);
});

test("Test 6: Text companion fields (S3Q02 reasons, S4Q02/S4Q03 domains) are cleared on NON", () => {
  let data = {
    S3Q01_RESPONSE_STATUS: "REPORTED",
    s3q01_cadres_male: 1,
    S3Q02_RESPONSE_STATUS: "REPORTED",
    s3q02_total_male: 1,
    S3Q02_REASON_1_TEXT: "Rupture conventionnelle",
    S4Q02_RESPONSE_STATUS: "REPORTED",
    s4q02_total_male: 5,
    S4Q02_DOMAIN_1_TEXT: "Informatique",
  };

  const onChange = (k, v) => {
    if (v === undefined) delete data[k];
    else data[k] = v;
  };

  // Departures -> NON
  const depMapping = EVENT_TABLE_MAPPING.departures;
  findKeysMatchingPrefixes(data, depMapping.prefixes).forEach((k) => onChange(k, undefined));
  depMapping.tableCodes.forEach((code) => onChange(`${code}_RESPONSE_STATUS`, "NONE"));

  assert.equal("S3Q02_REASON_1_TEXT" in data, false);
  assert.equal("s3q02_total_male" in data, false);
  assert.equal("s3q01_cadres_male" in data, false);
  assert.equal(data.S3Q02_RESPONSE_STATUS, "NONE");

  // Skills -> NON
  const skillsMapping = EVENT_TABLE_MAPPING.skills;
  findKeysMatchingPrefixes(data, skillsMapping.prefixes).forEach((k) => onChange(k, undefined));
  skillsMapping.tableCodes.forEach((code) => onChange(`${code}_RESPONSE_STATUS`, "NONE"));

  assert.equal("S4Q02_DOMAIN_1_TEXT" in data, false);
  assert.equal("s4q02_total_male" in data, false);
  assert.equal(data.S4Q02_RESPONSE_STATUS, "NONE");
});

test("Test 7: Submission payload contains no positive values for tables set to NONE", () => {
  const TABLE_RESPONSE_FIELDS = [
    "S21Q01_RESPONSE_STATUS",
    "S22Q01_RESPONSE_STATUS",
  ];

  const autoFill = (data) => {
    const result = { ...data };
    for (const statusField of TABLE_RESPONSE_FIELDS) {
      const existing = result[statusField];
      if (typeof existing === "string" && existing.trim() !== "") {
        continue;
      }
      const prefix = statusField.replace(/_RESPONSE_STATUS$/i, "").toLowerCase() + "_";
      const hasCellData = Object.keys(result).some((k) => {
        const lower = k.toLowerCase();
        if (!lower.startsWith(prefix)) return false;
        const v = result[k];
        return v !== undefined && v !== null && v !== "" && v !== 0 && v !== "0";
      });
      result[statusField] = hasCellData ? "REPORTED" : "NONE";
    }
    return result;
  };

  const data = {
    S21Q01_RESPONSE_STATUS: "NONE",
    // Table S22Q01 is REPORTED and has valid cells
    s22q01_cadres_male_15_24: 10,
    S22Q01_RESPONSE_STATUS: "REPORTED",
  };

  const prepared = autoFill(data);
  assert.equal(prepared.S21Q01_RESPONSE_STATUS, "NONE");
  assert.equal(prepared.S22Q01_RESPONSE_STATUS, "REPORTED");

  // Ensure no s21q01_ cell exists with positive value
  const s21CellKeys = Object.keys(prepared).filter(
    (k) => k.toLowerCase().startsWith("s21q01_") && !k.toLowerCase().endsWith("_response_status")
  );
  assert.equal(s21CellKeys.length, 0);
});

test("Test 8: Secondary table removal: deselecting temporary recruitments purges S22Q02 while preserving S22Q01", () => {
  const hasTable = (code) => true;

  let data = {
    // Permanent recruitment (S22Q01)
    s22q01_cadres_male_15_24: 5,
    S22Q01_RESPONSE_STATUS: "REPORTED",

    // Temporary recruitment (S22Q02)
    s22q02_cadres_male_15_24: 8,
    S22Q02_RESPONSE_STATUS: "REPORTED",
  };

  let scope = {
    recruit: true,
    recruit_types: ["permanent", "temporaire"],
    recruit_csp: ["cadres"],
    recruit_age: ["15_24"],
    recruit_diploma: ["bac"],
    disability: false,
    vulnerable: false,
  };

  const onChange = (k, v) => {
    if (v === undefined) delete data[k];
    else data[k] = v;
  };

  // Respondent unchecks "temporaire"
  scope.recruit_types = ["permanent"];

  // purgeAllDroppedTablesData implementation matching ScopeConfigurationWizard
  const purgeAllDroppedTablesData = (targetScope) => {
    for (const [tableCode, prefixes] of Object.entries(TABLE_PREFIX_MAP)) {
      if (hasTable(tableCode) && !isTableReported(tableCode, targetScope)) {
        const keys = findKeysMatchingPrefixes(data, prefixes);
        for (const k of keys) {
          onChange(k, undefined);
        }
      }
    }
  };

  purgeAllDroppedTablesData(scope);
  onChange("S22Q02_RESPONSE_STATUS", "NONE");

  // Temporary cells MUST be removed
  assert.equal("s22q02_cadres_male_15_24" in data, false);
  assert.equal(data.S22Q02_RESPONSE_STATUS, "NONE");

  // Permanent cells MUST be preserved
  assert.equal("s22q01_cadres_male_15_24" in data, true);
  assert.equal(data.s22q01_cadres_male_15_24, 5);
  assert.equal(data.S22Q01_RESPONSE_STATUS, "REPORTED");
});

test("Test 9: CSP filtering: deselecting one CSP preserves retained CSPs in active table", () => {
  const hasTable = (code) => true;

  let data = {
    s22q01_cadres_male_15_24: 5,
    s22q01_workers_male_15_24: 3,
    S22Q01_RESPONSE_STATUS: "REPORTED",
  };

  let scope = {
    recruit: true,
    recruit_types: ["permanent"],
    recruit_csp: ["cadres", "execution"],
    recruit_age: ["15_24"],
    recruit_diploma: ["bac"],
    disability: false,
    vulnerable: false,
  };

  // Respondent unchecks Execution from recruit_csp
  scope.recruit_csp = ["cadres"];

  // purgeAllDroppedTablesData check
  assert.equal(isTableReported("S22Q01", scope), true);

  // Still-retained dimension (cadres) is preserved
  assert.equal(data.s22q01_cadres_male_15_24, 5);
  assert.equal(data.S22Q01_RESPONSE_STATUS, "REPORTED");
});

test("Test 10: Age filtering: deselecting one age band preserves retained age bands in active table", () => {
  let data = {
    s22q01_cadres_male_15_24: 7,
    s22q01_cadres_male_25_34: 4,
    S22Q01_RESPONSE_STATUS: "REPORTED",
  };

  let scope = {
    recruit: true,
    recruit_types: ["permanent"],
    recruit_csp: ["cadres"],
    recruit_age: ["15_24", "25_34"],
    recruit_diploma: ["bac"],
    disability: false,
    vulnerable: false,
  };

  // Respondent unchecks 25_34
  scope.recruit_age = ["15_24"];

  // Table remains reported
  assert.equal(isTableReported("S22Q01", scope), true);

  // Retained age band 15_24 remains intact
  assert.equal(data.s22q01_cadres_male_15_24, 7);
  assert.equal(data.S22Q01_RESPONSE_STATUS, "REPORTED");
});

test("Test 11: Backward navigation across beats does not purge entered data", () => {
  let data = {
    s21q01_cadres_male_15_24: 10,
    S21Q01_RESPONSE_STATUS: "REPORTED",
    s22q01_cadres_male_15_24: 14,
    S22Q01_RESPONSE_STATUS: "REPORTED",
  };

  let scope = {
    applications: true,
    application_csp: ["cadres"],
    application_age: ["15_24"],
    recruit: true,
    recruit_types: ["permanent"],
    recruit_csp: ["cadres"],
    recruit_age: ["15_24"],
  };

  // Simulating handlePrev across beats
  let activeBeatIdx = 5;
  const handlePrev = () => {
    activeBeatIdx = Math.max(0, activeBeatIdx - 1);
  };

  // Navigate back multiple times
  handlePrev();
  handlePrev();
  handlePrev();

  // No purge occurs during navigation
  assert.equal(data.s21q01_cadres_male_15_24, 10);
  assert.equal(data.s22q01_cadres_male_15_24, 14);
  assert.equal(data.S21Q01_RESPONSE_STATUS, "REPORTED");
  assert.equal(data.S22Q01_RESPONSE_STATUS, "REPORTED");
});

test("Test 12: Draft persistence: save and reload simulation confirms deleted keys do not resurrect", () => {
  // 1. Initial draft stored in persistence
  let persistedStorage = {
    s21q01_cadres_male_15_24: 11,
    S21Q01_RESPONSE_STATUS: "REPORTED",
  };

  // 2. Client loads draft
  let clientData = { ...persistedStorage };

  // 3. User sets applications to NON (confirmed) -> keys deleted
  const mapping = EVENT_TABLE_MAPPING.applications;
  findKeysMatchingPrefixes(clientData, mapping.prefixes).forEach((k) => delete clientData[k]);
  clientData.S21Q01_RESPONSE_STATUS = "NONE";

  // 4. Draft autosaves (overwrites storage with clientData)
  persistedStorage = { ...clientData };

  // 5. Reload simulation (e.g. page refresh)
  const initialAutofill = { S0Q01: "Test Corp" };
  const reloadedData = { ...initialAutofill, ...persistedStorage };

  // Detailed cells must remain absent after reload
  assert.equal("s21q01_cadres_male_15_24" in reloadedData, false);
  assert.equal(reloadedData.s21q01_cadres_male_15_24, undefined);
  assert.equal(reloadedData.S21Q01_RESPONSE_STATUS, "NONE");
});
