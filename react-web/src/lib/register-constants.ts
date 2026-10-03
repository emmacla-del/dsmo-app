// src/lib/register-constants.ts
//
// Ported from lib/screens/register_constants.dart's EntityField/EntityConfig/
// entityConfigs — the registration wizard's per-entity-type field set. This
// is a deliberately smaller registration-only subset of each entity's full
// ONEFOP Section 1 (see the Dart file's own comment on this), not a second
// definition of the ONEFOP schema itself — kept in its own file, distinct
// from onefop-schema.ts, precisely so it's never confused with that.
export type EntityType =
  | "enterprise"
  | "cooperative"
  | "ctd"
  | "ong"
  | "administration"
  | "projectProgram"
  | "vocationalTraining";

// Backend wire value (RegisterCompanyDto.entityType / normalizeEntityType()
// in questionnaires.service.ts) — distinct from the schema-registry spelling
// used elsewhere (onefop-schema.ts's SchemaEntityType uses 'enterprise'
// lowercase; this uses the auth/questionnaire pipeline's own enum spelling).
export function entityApiValue(type: EntityType): string {
  const map: Record<EntityType, string> = {
    enterprise: "ENTREPRISE",
    cooperative: "COOPERATIVE",
    ctd: "CTD",
    ong: "ONG",
    administration: "ADMINISTRATION",
    projectProgram: "PROJECT_PROGRAM",
    vocationalTraining: "VOCATIONAL_TRAINING",
  };
  return map[type];
}

// Reverse of entityApiValue — direct port of parseCompanyEntityType
// (home_screen.dart), including its acceptance of the legacy "ENTERPRISE"
// spelling alongside "ENTREPRISE". Used to read Company.entityType (set at
// registration) back into the schema-registry key the ONEFOP engine and
// declaration route expect — this is what lets "start a declaration" go
// straight to the user's own registered entity type instead of asking them
// to pick one every time (see home_screen.dart lines ~621-651: the picker
// is a one-time fallback for company['entityType'] == null, not the normal
// path).
export function parseCompanyEntityType(apiValue: string | null | undefined): EntityType | null {
  switch ((apiValue ?? "").toUpperCase()) {
    case "ENTERPRISE":
    case "ENTREPRISE":
      return "enterprise";
    case "COOPERATIVE":
      return "cooperative";
    case "CTD":
      return "ctd";
    case "ONG":
      return "ong";
    case "ADMINISTRATION":
      return "administration";
    case "PROJECT_PROGRAM":
      return "projectProgram";
    case "VOCATIONAL_TRAINING":
      return "vocationalTraining";
    default:
      return null;
  }
}

export interface EntityField {
  key: string;
  label: string;
  hint?: string;
  required: boolean;
  kind: "text" | "tel" | "number" | "select";
  options?: import("./register-options").RegisterOption[];
  // Conditional visibility within the same entity's field set — mirrors
  // register_constants.dart's dependsOn/dependsValue (itself mirroring the
  // ONEFOP AST's own shape), used only by vocationalTraining's
  // functionalStatus -> nonFunctionalReason -> nonFunctionalReasonOther chain.
  dependsOn?: string;
  dependsValue?: string;
}

export interface EntityConfig {
  type: EntityType;
  title: string;
  fields: EntityField[];
}

// Pure visibility predicate for entity fields with single or chained dependencies
// (e.g. functionalStatus -> nonFunctionalReason -> nonFunctionalReasonOther).
// Shared between the live form and the official review summary table.
export function isFieldVisible(
  field: EntityField,
  data: Record<string, string | undefined>,
  allFields?: EntityField[]
): boolean {
  if (!field.dependsOn) return true;
  if (data[field.dependsOn] !== field.dependsValue) return false;
  if (allFields) {
    const parent = allFields.find((f) => f.key === field.dependsOn);
    if (parent) {
      return isFieldVisible(parent, data, allFields);
    }
  }
  return true;
}

import {
  CFP_TYPE_OPTIONS,
  COOPERATIVE_TYPE_OPTIONS,
  CTD_TYPE_OPTIONS,
  EDUCATION_SYSTEM_OPTIONS,
  FUNCTIONAL_STATUS_OPTIONS,
  LEGAL_STATUS_OPTIONS,
  NON_FUNCTIONAL_REASON_OPTIONS,
  SEX_OPTIONS,
} from "./register-options";

export const ENTITY_CONFIGS: Record<EntityType, EntityConfig> = {
  enterprise: {
    type: "enterprise",
    title: "Entreprise/ Company",
    fields: [
      { key: "companyName", label: "Raison sociale/ Company name", hint: "Nom légal de l'entreprise", required: true, kind: "text" },
      { key: "legalStatus", label: "Statut juridique/ Legal status", required: true, kind: "select", options: LEGAL_STATUS_OPTIONS },
      { key: "taxNumber", label: "N° Contribuable (NIU)/ Taxpayer No.", required: true, kind: "text" },
      { key: "cnpsNumber", label: "N° d'affiliation CNPS/ CNPS affiliation No.", required: false, kind: "text" },
      { key: "mainActivity", label: "Activité principale/ Main activity", required: true, kind: "text" },
      { key: "branch", label: "Branche d'activité/ Business branch", hint: "Ex: Commerce, Industrie, Services", required: false, kind: "text" },
      { key: "address", label: "Adresse du siège social/ Registered office address", required: true, kind: "text" },
      { key: "phone", label: "Téléphone/ Phone", hint: "6XXXXXXXX", required: true, kind: "tel" },
      { key: "phone2", label: "Téléphone secondaire/ Secondary phone", required: false, kind: "tel" },
      { key: "poBox", label: "Boîte postale/ P.O. Box", required: false, kind: "text" },
      { key: "socialCapital", label: "Capital social (XAF)/ Share capital (XAF)", required: false, kind: "number" },
      { key: "parentCompany", label: "Maison mère / Groupe/ Parent company / Group", required: false, kind: "text" },
      { key: "secondaryActivity", label: "Activité secondaire/ Secondary activity", required: false, kind: "text" },
    ],
  },
  cooperative: {
    type: "cooperative",
    title: "Coopérative/ Cooperative",
    fields: [
      { key: "cooperativeName", label: "Nom de la coopérative/ Cooperative name", required: true, kind: "text" },
      { key: "cooperativeType", label: "Type de coopérative/ Cooperative type", required: true, kind: "select", options: COOPERATIVE_TYPE_OPTIONS },
      { key: "yearOfCreation", label: "Année de création/ Year established", hint: "AAAA/ YYYY", required: true, kind: "number" },
      { key: "taxNumber", label: "N° Contribuable (NIU)/ Taxpayer No.", required: true, kind: "text" },
      { key: "mainActivity", label: "Activité principale/ Main activity", required: true, kind: "text" },
      { key: "cooperativeHeadOffice", label: "Adresse du siège social/ Registered office address", required: true, kind: "text" },
      { key: "branch", label: "Branche d'activité/ Business branch", required: false, kind: "text" },
      { key: "phone", label: "Téléphone/ Phone", required: true, kind: "tel" },
      { key: "phone2", label: "Téléphone secondaire/ Secondary phone", required: false, kind: "tel" },
      { key: "poBox", label: "Boîte postale/ P.O. Box", required: false, kind: "text" },
    ],
  },
  ctd: {
    type: "ctd",
    title: "CTD/ RLA",
    fields: [
      { key: "ctdType", label: "Type de CTD/ RLA type", required: true, kind: "select", options: CTD_TYPE_OPTIONS },
      { key: "ctdName", label: "Nom de la CTD/ RLA name", hint: "Région ou Commune/ Region or Municipality", required: true, kind: "text" },
      { key: "yearOfCreation", label: "Année de création/ Year established", required: true, kind: "number" },
      { key: "taxNumber", label: "N° Contribuable (NIU)/ Taxpayer No.", required: true, kind: "text" },
      { key: "address", label: "Adresse du siège/ Head office address", required: true, kind: "text" },
      { key: "phone", label: "Téléphone/ Phone", required: true, kind: "tel" },
      { key: "phone2", label: "Téléphone secondaire/ Secondary phone", required: false, kind: "tel" },
      { key: "poBox", label: "Boîte postale/ P.O. Box", required: false, kind: "text" },
    ],
  },
  ong: {
    type: "ong",
    title: "ONG/ NGO",
    fields: [
      { key: "ngoName", label: "Nom de l'ONG/ NGO name", required: true, kind: "text" },
      { key: "registrationNumber", label: "N° d'enregistrement/ Registration No.", hint: "Numéro d'agrément/ Approval number", required: true, kind: "text" },
      { key: "taxNumber", label: "N° Contribuable (NIU)/ Taxpayer No.", required: true, kind: "text" },
      { key: "yearOfCreation", label: "Année de création/ Year established", required: true, kind: "number" },
      { key: "mainMission", label: "Mission principale/ Main mission", required: true, kind: "text" },
      { key: "address", label: "Adresse du siège social/ Registered office address", required: true, kind: "text" },
      { key: "phone", label: "Téléphone/ Phone", required: true, kind: "tel" },
      { key: "phone2", label: "Téléphone secondaire/ Secondary phone", required: false, kind: "tel" },
      { key: "poBox", label: "Boîte postale/ P.O. Box", required: false, kind: "text" },
    ],
  },
  administration: {
    type: "administration",
    title: "Administration",
    fields: [
      { key: "administrationName", label: "Nom de l'administration/ Administration name", required: true, kind: "text" },
      { key: "sigle", label: "Sigle/ Acronym", required: false, kind: "text" },
      { key: "mainMission", label: "Mission principale/ Main mission", required: true, kind: "text" },
      { key: "address", label: "Adresse du siège/ Head office address", required: true, kind: "text" },
      { key: "phone", label: "Téléphone/ Phone", required: true, kind: "tel" },
      { key: "phone2", label: "Téléphone secondaire/ Secondary phone", required: false, kind: "tel" },
      { key: "poBox", label: "Boîte postale/ P.O. Box", required: false, kind: "text" },
    ],
  },
  projectProgram: {
    type: "projectProgram",
    title: "Projet / Programme/ Project / Programme",
    fields: [
      { key: "projectProgramName", label: "Nom/ Name", required: true, kind: "text" },
      { key: "sigle", label: "Sigle ou acronyme/ Abbreviation or acronym", required: false, kind: "text" },
      { key: "mainMission", label: "Objectif ou mission principale/ Objective or main mission", required: true, kind: "text" },
      { key: "address", label: "Siège social/ Head office", required: true, kind: "text" },
      { key: "phone", label: "Téléphone/ Phone", required: true, kind: "tel" },
      { key: "phone2", label: "Téléphone secondaire/ Secondary phone", required: false, kind: "tel" },
      { key: "poBox", label: "Boîte postale/ P.O. Box", required: false, kind: "text" },
    ],
  },
  vocationalTraining: {
    type: "vocationalTraining",
    title: "Centre de formation professionnelle (enquête ONEFOP)/ Vocational Training Center (ONEFOP survey)",
    fields: [
      { key: "centerName", label: "Nom du CFP/ Name of VTC", required: true, kind: "text" },
      { key: "sigle", label: "Sigle/ Initials", required: false, kind: "text" },
      { key: "taxNumber", label: "N° Contribuable (NIU)/ Taxpayer No.", required: true, kind: "text" },
      { key: "cfpType", label: "Type de CFP/ Type of VTC", required: true, kind: "select", options: CFP_TYPE_OPTIONS },
      { key: "educationSystem", label: "Ordre d'enseignement/ Education system", required: true, kind: "select", options: EDUCATION_SYSTEM_OPTIONS },
      { key: "functionalStatus", label: "Situation du Centre/ Status of the center", required: true, kind: "select", options: FUNCTIONAL_STATUS_OPTIONS },
      {
        key: "nonFunctionalReason",
        label: "Raison (si non-fonctionnelle)/ Reason (if non-functional)",
        required: true,
        kind: "select",
        options: NON_FUNCTIONAL_REASON_OPTIONS,
        dependsOn: "functionalStatus",
        dependsValue: "Non-fonctionnelle",
      },
      {
        key: "nonFunctionalReasonOther",
        label: "Autre raison (préciser)/ Other reason (specify)",
        required: true,
        kind: "text",
        dependsOn: "nonFunctionalReason",
        dependsValue: "Autres",
      },
      { key: "yearOfCreation", label: "Année d'ouverture/ Year of establishment", required: true, kind: "number" },
      { key: "address", label: "Adresse du CFP/ VTC's address", required: true, kind: "text" },
      { key: "phone", label: "Téléphone/ Phone", required: true, kind: "tel" },
      { key: "phone2", label: "Téléphone secondaire/ Secondary phone", required: false, kind: "tel" },
      { key: "poBox", label: "Boîte postale/ P.O. Box", required: false, kind: "text" },
      { key: "promoterName", label: "Promoteur/Directeur — Noms et prénoms/ Promoter/Director — Full name", required: true, kind: "text" },
      { key: "promoterSex", label: "Promoteur/Directeur — Sexe/ Promoter/Director — Sex", required: true, kind: "select", options: SEX_OPTIONS },
      { key: "promoterPhone1", label: "Promoteur/Directeur — Téléphone 1/ Promoter/Director — Phone 1", required: true, kind: "tel" },
      { key: "promoterPhone2", label: "Promoteur/Directeur — Téléphone 2/ Promoter/Director — Phone 2", required: false, kind: "tel" },
    ],
  },
};

// Drops the entity fields that do not belong to `nextType` when the respondent
// changes their structure type mid-flow, keeping the values of fields the new
// type also declares (address, phone, phone2, poBox and the like).
//
// This matters beyond tidiness: submit() builds RegisterCompanyPayload from a
// fixed flat list of entityData keys spanning all seven types, with no filter
// on the selected type, so an orphaned key is transmitted as though the
// respondent had entered it. resolveCompanyName() compounds this — it returns
// the first non-empty of companyName/cooperativeName/ctdName/ngoName/..., so a
// stale companyName left over from "Entreprise" would outrank the ngoName an
// ONG respondent actually typed.
//
// Mirrors register_screen.dart's StepEntityType onSelect, which clears
// _entityData wholesale on type change; this keeps the shared fields instead of
// making the respondent retype them.
export function pruneEntityDataForType(
  data: Record<string, string>,
  nextType: EntityType
): Record<string, string> {
  const keep = new Set(ENTITY_CONFIGS[nextType].fields.map((f) => f.key));
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (keep.has(key)) next[key] = value;
  }
  return next;
}

// Mirrors EntityConfig.resolveCompanyName/resolveAddress/resolveMainActivity
// in register_constants.dart: several entity types use a differently-named
// field for what the backend's RegisterCompanyDto always calls
// companyName/address/mainActivity.
export function resolveCompanyName(data: Record<string, unknown>, fallback: string): string {
  const candidates = [
    data.companyName,
    data.cooperativeName,
    data.ctdName,
    data.ngoName,
    data.centerName,
    data.administrationName,
    data.projectProgramName,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return fallback;
}

export function resolveAddress(data: Record<string, unknown>): string {
  const candidates = [data.address, data.cooperativeHeadOffice];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return "";
}

export function resolveMainActivity(data: Record<string, unknown>): string {
  const candidates = [data.mainActivity, data.mainMission, data.trainingDomains];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return "";
}
