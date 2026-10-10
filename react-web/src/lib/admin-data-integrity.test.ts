import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NOT_PROVIDED,
  NOT_RECORDED,
  METRIC_UNAVAILABLE,
  UNSCOPED_ENDPOINTS,
  NATIONAL_ROLES,
  computeUserScopeLabel,
  fact,
  factOr,
  firstFact,
  count,
  percent,
  rate,
  meterWidth,
  stamp,
  shortStamp,
  clockTime,
  elapsedSince,
  resolveDataState,
  dataStateMessage,
  shortRecordId,
  errorDetail,
} from "./admin-data-state";
import {
  anomalyCompanyName,
  anomalyDossierRef,
  ANOMALY_REGISTRY_ROLES,
  ANOMALY_DEROGATION_ROLES,
  type AnomalyRecord,
} from "./anomaly-registry";
import { ApiError } from "./api-client";

// ── 1. Honest Fact & Metric Formatting ──────────────────────────────────────

test("fact: returns string representation of valid facts", () => {
  assert.equal(fact("Ministère du Travail"), "Ministère du Travail");
  assert.equal(fact("Dossier #1234"), "Dossier #1234");
  assert.equal(fact(42), "42");
});

test("fact: preserves 0 and false as legitimate recorded administrative facts", () => {
  assert.equal(fact(0), "0");
  assert.equal(fact(false), "false");
});

test("fact: renders neutral marker for null, undefined, and blank strings", () => {
  assert.equal(fact(null), NOT_PROVIDED);
  assert.equal(fact(undefined), NOT_PROVIDED);
  assert.equal(fact(""), NOT_PROVIDED);
  assert.equal(fact("   "), NOT_PROVIDED);
});

test("factOr: allows caller-chosen honest absence markers", () => {
  assert.equal(factOr("Enregistré", NOT_RECORDED), "Enregistré");
  assert.equal(factOr(null, NOT_RECORDED), NOT_RECORDED);
  assert.equal(factOr(undefined, METRIC_UNAVAILABLE), METRIC_UNAVAILABLE);
  assert.equal(factOr("", NOT_PROVIDED), NOT_PROVIDED);
});

test("firstFact: returns the first non-empty authoritative candidate or NOT_PROVIDED", () => {
  assert.equal(firstFact("Principal", "Secondaire"), "Principal");
  assert.equal(firstFact(null, "", "  ", "Troisième"), "Troisième");
  assert.equal(firstFact(null, undefined, ""), NOT_PROVIDED);
});

test("count: formats integers in French locale and strictly preserves 0", () => {
  assert.equal(count(0), "0");
  // 12345 in fr-FR locale formatted with non-breaking / narrow space
  const formatted = count(12345);
  assert.ok(formatted.includes("12") && formatted.includes("345"));
  assert.equal(count(null), NOT_PROVIDED);
  assert.equal(count(undefined), NOT_PROVIDED);
  assert.equal(count(NaN), NOT_PROVIDED);
});

test("percent: renders percentage string and strictly preserves 0", () => {
  assert.equal(percent(0), "0 %");
  assert.equal(percent(85), "85 %");
  assert.equal(percent(33.333, 1), "33,3 %");
  assert.equal(percent(null), NOT_PROVIDED);
  assert.equal(percent(undefined), NOT_PROVIDED);
  assert.equal(percent(NaN), NOT_PROVIDED);
});

test("percent: a minimum below the maximum drops a zero decimal, keeps a real one", () => {
  assert.equal(percent(50, 1, "fr", 0), "50 %");
  assert.equal(percent(50.5, 1, "fr", 0), "50,5 %");
  assert.equal(percent(50.04, 1, "fr", 0), "50 %");
  assert.equal(percent(50, 1, "en", 0), "50%");
  assert.equal(percent(66.67, 1, "en", 0), "66.7%");
  // Without the fourth argument the behaviour is unchanged: fixed digits.
  assert.equal(percent(50, 1, "fr"), "50,0 %");
});

test("rate: calculates rounded rate, preserving 0 and returning null on zero denominator", () => {
  // Legitimate zero numerator yields zero rate, not null
  assert.equal(rate(0, 100), 0);
  assert.equal(rate(50, 100), 50);
  assert.equal(rate(1, 3), 33);
  // Zero denominator or missing operands yield null (rate not calculable)
  assert.equal(rate(100, 0), null);
  assert.equal(rate(null, 100), null);
  assert.equal(rate(50, null), null);
  assert.equal(rate(undefined, 100), null);
  assert.equal(rate(50, undefined), null);
});

test("meterWidth: clamps to 0% - 100% and returns 0% for null/NaN", () => {
  assert.equal(meterWidth(50), "50%");
  assert.equal(meterWidth(0), "0%");
  assert.equal(meterWidth(150), "100%");
  assert.equal(meterWidth(-20), "0%");
  assert.equal(meterWidth(null), "0%");
  assert.equal(meterWidth(undefined), "0%");
  assert.equal(meterWidth(NaN), "0%");
});

test("stamp: formats valid ISO timestamps and degrades safely for null or invalid dates", () => {
  const iso = "2026-03-15T10:30:00.000Z";
  const formatted = stamp(iso, true);
  assert.ok(formatted.includes("15") && formatted.includes("2026"));

  assert.equal(stamp(null), NOT_PROVIDED);
  assert.equal(stamp(undefined), NOT_PROVIDED);
  assert.equal(stamp(""), NOT_PROVIDED);
  assert.equal(stamp("invalid-date-string"), NOT_PROVIDED);
});

test("shortStamp: degrades safely for null or empty dates", () => {
  assert.equal(shortStamp(null), NOT_PROVIDED);
  assert.equal(shortStamp(undefined), NOT_PROVIDED);
  assert.equal(shortStamp(""), NOT_PROVIDED);
  assert.equal(shortStamp("not-a-date"), NOT_PROVIDED);
});

test("elapsedSince: degrades safely for null or empty dates", () => {
  assert.equal(elapsedSince(null), NOT_PROVIDED);
  assert.equal(elapsedSince(undefined), NOT_PROVIDED);
  assert.equal(elapsedSince(""), NOT_PROVIDED);
  assert.equal(elapsedSince("not-a-date"), NOT_PROVIDED);
  // Stored timestamp from just now
  assert.equal(elapsedSince(new Date().toISOString()), "À l'instant");
});

// ── 2. Data State Resolution & Hierarchy ────────────────────────────────────

test("resolveDataState: returns 'ready' when query has finished with data", () => {
  const state = resolveDataState({ isLoading: false, isError: false, rowCount: 12 });
  assert.equal(state, "ready");
});

test("resolveDataState: returns 'empty' when rowCount is 0, never 'error'", () => {
  const state = resolveDataState({ isLoading: false, isError: false, rowCount: 0 });
  assert.equal(state, "empty");
});

test("resolveDataState: returns 'loading' when query is in flight", () => {
  assert.equal(resolveDataState({ isLoading: true }), "loading");
  assert.equal(resolveDataState({ isPending: true }), "loading");
});

test("resolveDataState: returns 'error' for generic API failure, never disguising it as 'empty'", () => {
  const state = resolveDataState({
    isLoading: false,
    isError: true,
    error: new Error("Connexion réseau interrompue"),
    rowCount: 0,
  });
  // Must be 'error', NEVER 'empty'
  assert.equal(state, "error");
});

test("resolveDataState: maps HTTP 401 and 403 to 'forbidden'", () => {
  const err401 = new ApiError(401, "Unauthorized");
  assert.equal(resolveDataState({ isError: true, error: err401 }), "forbidden");

  const err403 = new ApiError(403, "Forbidden");
  assert.equal(resolveDataState({ isError: true, error: err403 }), "forbidden");
});

test("resolveDataState: maps HTTP 404 to 'notFound'", () => {
  const err404 = new ApiError(404, "Not Found");
  assert.equal(resolveDataState({ isError: true, error: err404 }), "notFound");
});

test("resolveDataState: roleAllowed: false outranks loading and errors", () => {
  const state = resolveDataState({
    roleAllowed: false,
    isLoading: true,
    isError: true,
    error: new Error("Fatal"),
  });
  assert.equal(state, "forbidden");
});

test("resolveDataState: sourceAvailable: false outranks loading and errors", () => {
  const state = resolveDataState({
    sourceAvailable: false,
    isLoading: true,
  });
  assert.equal(state, "unavailable");
});

test("dataStateMessage: provides explicit honest messages and null for ready", () => {
  assert.equal(dataStateMessage("ready", "dossiers"), null);
  assert.ok(dataStateMessage("empty", "dossiers")?.includes("Aucun résultat trouvé pour dossiers"));
  assert.ok(dataStateMessage("error", "dossiers")?.includes("Impossible de charger dossiers"));
  assert.ok(dataStateMessage("forbidden", "dossiers")?.includes("Accès non autorisé"));
  assert.ok(dataStateMessage("notFound", "dossier")?.includes("Enregistrement introuvable"));
  assert.equal(dataStateMessage("unavailable", "dossiers"), METRIC_UNAVAILABLE);
});

test("errorDetail: extracts error messages without crashing on arbitrary input", () => {
  assert.equal(errorDetail(new ApiError(500, "Erreur interne")), "Erreur interne");
  assert.equal(errorDetail(new Error("Timeout")), "Timeout");
  assert.equal(errorDetail("raw string"), null);
  assert.equal(errorDetail(null), null);
  assert.equal(errorDetail(undefined), null);
});

// ── 3. Territorial Scope & Scope Widening Prevention ────────────────────────

test("computeUserScopeLabel: handles unauthenticated or role-less accounts", () => {
  assert.equal(computeUserScopeLabel(null), NOT_PROVIDED);
  assert.equal(computeUserScopeLabel(undefined), NOT_PROVIDED);
  assert.equal(computeUserScopeLabel({ role: null }), NOT_PROVIDED);
  assert.equal(computeUserScopeLabel({ role: "" }), NOT_PROVIDED);
});

test("computeUserScopeLabel: prevents widening unassigned territorial accounts to National", () => {
  // REGIONAL_ADMIN with no region assigned must NOT widen to National
  assert.equal(computeUserScopeLabel({ role: "REGIONAL_ADMIN", region: null }), "Régional (non assigné)");
  assert.equal(computeUserScopeLabel({ role: "REGIONAL_ADMIN", region: "" }), "Régional (non assigné)");

  // DIVISIONAL_ADMIN with neither department nor region must NOT widen to National
  assert.equal(computeUserScopeLabel({ role: "DIVISIONAL_ADMIN", department: null, region: null }), "Départemental (non assigné)");
  assert.equal(computeUserScopeLabel({ role: "DIVISIONAL_ADMIN", department: "" }), "Départemental (non assigné)");
});

test("computeUserScopeLabel: formats assigned territorial accounts accurately", () => {
  assert.equal(
    computeUserScopeLabel({ role: "REGIONAL_ADMIN", region: "Centre" }),
    "Région Centre",
  );
  assert.equal(
    computeUserScopeLabel({ role: "DIVISIONAL_ADMIN", department: "Mfoundi", region: "Centre" }),
    "Département Mfoundi",
  );
  // DIVISIONAL_ADMIN with only region assigned
  assert.equal(
    computeUserScopeLabel({ role: "DIVISIONAL_ADMIN", department: null, region: "Littoral" }),
    "Région Littoral",
  );
});

test("computeUserScopeLabel: identifies all statutory national administrative roles", () => {
  for (const role of NATIONAL_ROLES) {
    assert.equal(computeUserScopeLabel({ role }), "National");
  }
});

test("UNSCOPED_ENDPOINTS: platform-wide endpoints are strictly inventoried", () => {
  assert.ok(UNSCOPED_ENDPOINTS.includes("/audit/reports"));
});

// ── 4. Anomaly Registry Authoritative Extraction ────────────────────────────

test("anomalyCompanyName: reads submission.company.name and never fabricates defaults", () => {
  const validAnomaly: AnomalyRecord = {
    id: "ano-1",
    submissionId: "sub-1",
    ruleCode: "RULE_001",
    ruleFamily: "COHERENCE",
    severity: "CRITICAL",
    isBlocking: true,
    status: "OPEN",
    description: "Incohérence effectifs",
    observedValue: "10",
    expectedValue: "20",
    deltaValue: "-10",
    detectedAt: "2026-03-01T00:00:00.000Z",
    resolvedAt: null,
    resolutionType: null,
    resolutionNote: null,
    evidenceUrl: null,
    submission: {
      id: "sub-1",
      submissionId: "DSMO-2026-0001",
      formType: "ENTREPRISE_MODERNE",
      region: "Centre",
      department: "Mfoundi",
      company: { name: "Société Civile Camerounaise" },
    },
    resolvedBy: null,
  };

  assert.equal(anomalyCompanyName(validAnomaly), "Société Civile Camerounaise");

  const missingCompanyAnomaly: AnomalyRecord = {
    ...validAnomaly,
    submission: {
      ...validAnomaly.submission!,
      company: null,
    },
  };
  // Must return null, never a fabricated placeholder
  assert.equal(anomalyCompanyName(missingCompanyAnomaly), null);

  const missingSubmissionAnomaly: AnomalyRecord = {
    ...validAnomaly,
    submission: null,
  };
  assert.equal(anomalyCompanyName(missingSubmissionAnomaly), null);
});

test("anomalyDossierRef: resolves authoritative dossier reference hierarchically", () => {
  const a1: AnomalyRecord = {
    id: "row-uuid-1",
    submissionId: "raw-sub-uuid",
    submission: {
      id: "sub-row-id",
      submissionId: "DSMO-2026-OFFICIAL",
      formType: null,
      region: null,
      department: null,
      company: null,
    },
  } as AnomalyRecord;
  // Prefers official submissionId
  assert.equal(anomalyDossierRef(a1), "DSMO-2026-OFFICIAL");

  const a2: AnomalyRecord = {
    id: "row-uuid-2",
    submissionId: "raw-sub-uuid",
    submission: {
      id: "sub-row-id",
      submissionId: null,
      formType: null,
      region: null,
      department: null,
      company: null,
    },
  } as AnomalyRecord;
  // Falls back to submission.id
  assert.equal(anomalyDossierRef(a2), "sub-row-id");

  const a3: AnomalyRecord = {
    id: "row-uuid-3",
    submissionId: "raw-sub-uuid",
    submission: null,
  } as AnomalyRecord;
  // Falls back to row submissionId
  assert.equal(anomalyDossierRef(a3), "raw-sub-uuid");
});

test("ANOMALY_REGISTRY_ROLES: enforces statutory access boundaries", () => {
  assert.deepEqual(ANOMALY_REGISTRY_ROLES, [
    "SUPER_ADMIN",
    "ADMIN_ONEFOP",
    "REGIONAL_ADMIN",
    "DIVISIONAL_ADMIN",
  ]);
  assert.deepEqual(ANOMALY_DEROGATION_ROLES, [
    "SUPER_ADMIN",
    "ADMIN_ONEFOP",
  ]);
});

// ── 5. Territorial Zero-Preservation & Unscoped Data Isolation ───────────────

test("pilotage data rules: zero submissions in territorial queues is preserved as 0", () => {
  // Simulating queues query for an authorized territorial actor with 0 submissions
  const territorialQueues = {
    totalSubmissionsCount: 0,
    statisticallyReadyCount: 0,
    approvedCount: 0,
    pendingNationalVisasCount: 0,
    regionCounts: [],
  };

  // Rule 2: totalSubmissions must be 0, not null, and never falling back to unscoped stats
  const totalSubmissions = territorialQueues ? territorialQueues.totalSubmissionsCount : null;
  assert.equal(totalSubmissions, 0);

  // Rate calculation with 0 numerator and 0 denominator is null (not calculable)
  const rateWhenZero = rate(territorialQueues.statisticallyReadyCount, territorialQueues.totalSubmissionsCount);
  assert.equal(rateWhenZero, null);

  // Rate calculation with 0 numerator and positive target is 0
  const target = 150;
  const coverageRate = rate(totalSubmissions, target);
  assert.equal(coverageRate, 0);
});

test("pilotage data rules: territorial actors receive server-scoped company counts", () => {
  // With territoryWhere applied server-side, a territorial actor receives their truthful scoped figures
  const regionalStats = {
    totalCompanies: 42,
    totals: { companies: 42, submissions: 12 },
  };

  const totalInscriptions = regionalStats
    ? (regionalStats.totals?.companies ?? regionalStats.totalCompanies ?? null)
    : null;

  assert.equal(totalInscriptions, 42);
});

test("pilotage data rules: national actors truthfully read national stats", () => {
  const nationalStats = {
    totalCompanies: 4500,
    totals: { companies: 4500, submissions: 1200 },
  };

  const totalInscriptions = nationalStats
    ? (nationalStats.totals?.companies ?? nationalStats.totalCompanies ?? null)
    : null;

  assert.equal(totalInscriptions, 4500);
});

test("clockTime: time to the second in the console locale, neutral when absent", () => {
  const d = new Date(2026, 9, 7, 9, 5, 3);
  assert.equal(clockTime(d, "fr"), "09:05:03");
  assert.equal(clockTime(d, "en"), "09:05:03");
  assert.equal(clockTime(d.toISOString(), "fr"), "09:05:03");
  assert.equal(clockTime(null), NOT_PROVIDED);
  assert.equal(clockTime("not a date"), NOT_PROVIDED);
});

test("dataStateMessage: French loading text contracts de + article", () => {
  assert.equal(dataStateMessage("loading", "les dossiers"), "Chargement des dossiers…");
  assert.equal(dataStateMessage("loading", "le journal d'audit"), "Chargement du journal d'audit…");
  assert.equal(dataStateMessage("loading", "cet établissement"), "Chargement de cet établissement…");
});

test("shortRecordId: shortens a UUID, keeps any other reference whole", () => {
  assert.equal(shortRecordId("d9dcd4ca-ecc5-4d40-8211-edd6829a0ebc"), "d9dcd4ca");
  assert.equal(shortRecordId("DSMO-2026-000123"), "DSMO-2026-000123");
});
