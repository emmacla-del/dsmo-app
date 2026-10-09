// react-web/src/lib/onefop-geography-lock.ts
//
// Section 1 region / department / subdivision are read-only when the server
// will overwrite them anyway. On submit, QuestionnairesService replaces the
// entity payload's region/department/subdivision with the submitting
// Company record's values whenever that record has all three (see
// src/questionnaires/questionnaires.service.ts, "Force Section 1 territory
// from Company record"). That applies to every entity type, including
// vocationalTraining (VT1_4/5/6 map to vocationalTraining.region/...).
//
// If any of the three is missing on the company record, the server keeps the
// respondent's answer, so the controls must stay editable.

export interface CompanyGeography {
  region?: string | null;
  department?: string | null;
  subdivision?: string | null;
}

export interface GeographyFieldIds {
  region: string;
  department: string;
  subdivision: string;
}

/** Section 1 geography field ids per entity (keys as in the schema). */
export const SECTION1_GEOGRAPHY_FIELDS: Record<string, GeographyFieldIds> = {
  enterprise: { region: "S1Q04_REGION", department: "S1Q04_DEPT", subdivision: "S1Q04_SUBDIV" },
  cooperative: { region: "COOP_S1Q05_REGION", department: "COOP_S1Q05_DEPT", subdivision: "COOP_S1Q05_SUBDIV" },
  ctd: { region: "CTD_S1Q05_REGION", department: "CTD_S1Q05_DEPT", subdivision: "CTD_S1Q05_SUBDIV" },
  ong: { region: "ONG_S1Q05_REGION", department: "ONG_S1Q05_DEPT", subdivision: "ONG_S1Q05_SUBDIV" },
  administration: { region: "ADMIN_S1Q04_REGION", department: "ADMIN_S1Q04_DEPT", subdivision: "ADMIN_S1Q04_SUBDIV" },
  projectProgram: { region: "PP_S1Q06_REGION", department: "PP_S1Q06_DEPT", subdivision: "PP_S1Q06_SUBDIV" },
  vocationalTraining: { region: "VT1_4", department: "VT1_5", subdivision: "VT1_6" },
};

const present = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/**
 * The values the server will store for the three geography fields, or null
 * when the company record lacks a level (the respondent's answer is kept).
 * Mirrors the server's truthiness check, and keeps the raw strings so the
 * displayed value equals the stored one.
 */
export function lockedGeographyValues(
  company: CompanyGeography | null | undefined,
  ids: GeographyFieldIds,
): Record<string, string> | null {
  if (!company) return null;
  const { region, department, subdivision } = company;
  if (!present(region) || !present(department) || !present(subdivision)) return null;
  return {
    [ids.region]: region,
    [ids.department]: department,
    [ids.subdivision]: subdivision,
  };
}

/** Field id → locked value for a VT1_4/5/6 field, or undefined if not locked. */
export function lockedVtGeographyValue(
  company: CompanyGeography | null | undefined,
  fieldId: string,
): string | undefined {
  return lockedGeographyValues(company, SECTION1_GEOGRAPHY_FIELDS.vocationalTraining)?.[fieldId];
}

/** Entries whose current form value differs from the locked value. */
export function geographyCorrections(
  locked: Record<string, string> | null,
  data: Record<string, unknown>,
): Array<[string, string]> {
  if (!locked) return [];
  return Object.entries(locked).filter(([k, v]) => data[k] !== v);
}
