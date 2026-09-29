import type { FormData } from "@/lib/onefop-schema";
import type { PrimaryQuestionId, ScopeState } from "./ScopeTypes";

export const TABLE_PREFIX_MAP: Record<string, string[]> = {
  S21Q01: ["s21q01_"],
  // Administration Section 2 (chronological renumbering of 2026-09-28)
  S21Q02: ["s21q02_"],
  S21Q03: ["s21q03_"],
  S21Q04: ["s21q04_"],
  S22Q01: ["s22q01_"],
  S22Q02: ["s22q02_"],
  S22Q03: ["s22q03_"],
  S22Q04: ["s22q04_"],
  S22Q05: ["s22q05_"],
  S22Q05_ENTERPRISE: ["s22q05_"],
  S22Q05_OTHER: ["s22q05_"],
  S23Q01: ["s23q01_"],
  S23Q02: ["s23q02_"],
  S3Q01: ["s3q01_"],
  S3Q02: ["s3q02_"],
  S3Q03: ["s3q03_"],
  S4Q01: ["s4q01_", "pp_s4q01_"],
  PP_S4Q01: ["pp_s4q01_", "s4q01_"],
  S4Q02: ["s4q02_", "pp_s4q02_"],
  PP_S4Q02: ["pp_s4q02_", "s4q02_"],
  S4Q03: ["s4q03_", "pp_s4q03_"],
  PP_S4Q03: ["pp_s4q03_", "s4q03_"],
  S4Q04: ["s4q04_", "pp_s4q04_"],
  PP_S4Q04: ["pp_s4q04_", "s4q04_"],
  S4Q05: ["s4q05_", "pp_s4q05_"],
  PP_S4Q05: ["pp_s4q05_", "s4q05_"],
  S4Q06: ["s4q06_", "pp_s4q06_"],
  PP_S4Q06: ["pp_s4q06_", "s4q06_"],
};

export const EVENT_TABLE_MAPPING: Record<
  PrimaryQuestionId,
  {
    tableCodes: string[];
    prefixes: string[];
    resetScope: Partial<ScopeState>;
  }
> = {
  applications: {
    tableCodes: ["S21Q01"],
    prefixes: ["s21q01_"],
    resetScope: {
      applications: false,
      application_csp: [],
      application_age: [],
    },
  },
  recruitment: {
    // S21Q02–S21Q04 are Administration's recruitment / disability /
    // vulnerable tables (no S22Q0x for Administration since 2026-09-28).
    tableCodes: [
      "S22Q01", "S22Q02", "S22Q03", "S22Q04", "S22Q05", "S22Q05_ENTERPRISE", "S22Q05_OTHER",
      "S21Q02", "S21Q03", "S21Q04",
    ],
    prefixes: ["s22q01_", "s22q02_", "s22q03_", "s22q04_", "s22q05_", "s21q02_", "s21q03_", "s21q04_"],
    resetScope: {
      recruit: false,
      recruit_types: [],
      recruit_csp: [],
      recruit_age: [],
      recruit_diploma: [],
      disability: null,
      vulnerable: null,
    },
  },
  primo_seekers: {
    tableCodes: ["S23Q01"],
    prefixes: ["s23q01_"],
    resetScope: {
      primo_seekers: false,
      primo_seekers_csp: [],
      primo_seekers_age: [],
    },
  },
  primo_workers: {
    tableCodes: ["S23Q02"],
    prefixes: ["s23q02_"],
    resetScope: {
      primo_workers: false,
      primo_workers_types: [],
      primo_workers_csp: [],
      primo_workers_age: [],
    },
  },
  departures: {
    tableCodes: ["S3Q01", "S3Q02", "S3Q03"],
    prefixes: ["s3q01_", "s3q02_", "s3q03_"],
    resetScope: {
      departures: false,
      departure_reasons: [],
      dismissal_technical: null,
    },
  },
  interns: {
    tableCodes: ["S4Q01", "PP_S4Q01"],
    prefixes: ["s4q01_", "pp_s4q01_"],
    resetScope: {
      interns: false,
      intern_types: [],
    },
  },
  skills: {
    tableCodes: ["S4Q02", "PP_S4Q02"],
    prefixes: ["s4q02_", "pp_s4q02_"],
    resetScope: {
      skills_needs: false,
    },
  },
  training: {
    tableCodes: ["S4Q03", "PP_S4Q03"],
    prefixes: ["s4q03_", "pp_s4q03_"],
    resetScope: {
      training_needs: false,
    },
  },
};

/**
 * Finds all keys in data matching any of the specified prefixes,
 * explicitly excluding `_RESPONSE_STATUS` keys.
 */
export function findKeysMatchingPrefixes(data: FormData, prefixes: string[]): string[] {
  const lowerPrefixes = prefixes.map((p) => p.toLowerCase());
  return Object.keys(data).filter((k) => {
    const lk = k.toLowerCase();
    if (lk.endsWith("_response_status")) return false;
    return lowerPrefixes.some((p) => lk.startsWith(p));
  });
}

/**
 * Determines whether a cell value represents positive or entered data
 * (excluding null, undefined, empty string, and zero).
 */
export function isEnteredCellData(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return false;
    const num = Number(trimmed);
    if (!isNaN(num)) return num !== 0;
    return true; // Non-numeric non-empty text, e.g. S3Q02 reason text
  }
  return false;
}

/**
 * Checks whether any of the given keys contains entered data (non-zero numbers or non-empty text).
 */
export function hasEnteredData(data: FormData, keys: string[]): boolean {
  return keys.some((k) => isEnteredCellData(data[k]));
}

/**
 * Checks whether an event has entered data.
 */
export function hasEnteredDataForEvent(
  mainId: PrimaryQuestionId,
  data: FormData,
  hasTable?: (code: string) => boolean,
): boolean {
  const mapping = EVENT_TABLE_MAPPING[mainId];
  if (!mapping) return false;
  const activeTables = hasTable ? mapping.tableCodes.filter(hasTable) : mapping.tableCodes;
  if (activeTables.length === 0) return false;
  const keys = findKeysMatchingPrefixes(data, mapping.prefixes);
  return hasEnteredData(data, keys);
}

/**
 * Checks whether a given table is active/REPORTED based on ScopeState.
 */
export function isTableReported(tableCode: string, scope: ScopeState): boolean {
  const code = tableCode.toUpperCase();
  switch (code) {
    case "S21Q01":
      return scope.applications === true;
    case "S21Q02": // Administration: all recruitments, no permanent/temporary split
      return scope.recruit === true;
    case "S21Q03":
      return scope.recruit === true && scope.disability === true;
    case "S21Q04":
      return scope.recruit === true && scope.vulnerable === true;
    case "S22Q01":
      return scope.recruit === true && scope.recruit_types.includes("permanent");
    case "S22Q02":
      return scope.recruit === true && scope.recruit_types.includes("temporaire");
    case "S22Q03":
      return scope.recruit === true && scope.recruit_diploma.length > 0;
    case "S22Q04":
      return scope.recruit === true && scope.disability === true;
    case "S22Q05":
    case "S22Q05_ENTERPRISE":
    case "S22Q05_OTHER":
      return scope.recruit === true && scope.vulnerable === true;
    case "S23Q01":
      return scope.primo_seekers === true;
    case "S23Q02":
      return scope.primo_workers === true;
    case "S3Q01":
      return scope.departures === true && scope.departure_reasons.length > 0;
    case "S3Q02":
      return scope.departures === true && scope.departure_reasons.includes("licenciement");
    case "S3Q03":
      return scope.departures === true && scope.dismissal_technical === true;
    case "S4Q01":
    case "PP_S4Q01":
      return scope.interns === true && scope.intern_types.length > 0;
    case "S4Q02":
    case "PP_S4Q02":
      return scope.skills_needs === true;
    case "S4Q03":
    case "PP_S4Q03":
      return scope.training_needs === true;
    default:
      return false;
  }
}
