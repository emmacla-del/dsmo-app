// src/lib/register-constants.ts
//
// Ported from lib/screens/register_constants.dart's EntityField/EntityConfig/
// entityConfigs — the registration wizard's per-entity-type field set. This
// is a deliberately smaller registration-only subset of each entity's full
// ONEFOP Section 1 (see the Dart file's own comment on this), not a second
// definition of the ONEFOP schema itself — kept in its own file, distinct
// from onefop-schema.ts, precisely so it's never confused with that.
import type { LocalizedText } from "./register-i18n";

export type EntityType =
  | "enterprise"
  | "cooperative"
  | "ctd"
  | "ong"
  | "administration"
  | "projectProgram"
  | "vocationalTraining";

// The wizard's step sequence, owned here because it had two independent
// copies: STEPS in app/register/page.tsx (navigation order) and
// REGISTRATION_STEPS in components/auth/RegistrationProgress.tsx (rail
// labels). They happened to agree, but nothing enforced it, and a drift would
// have surfaced as a mislabeled or skipped circle rather than a type error.
//
// `id` is what page.tsx navigates by; `labelKey` resolves against next-intl's
// registerPage namespace.
export const REGISTRATION_STEPS = [
  { id: "entityType", labelKey: "stepEntityType" },
  { id: "respondent", labelKey: "stepRespondent" },
  { id: "entityInfo", labelKey: "stepEntityInfo" },
  { id: "location", labelKey: "stepLocation" },
  { id: "security", labelKey: "stepSecurity" },
  { id: "review", labelKey: "stepReview" },
] as const;

export type RegistrationStepId = (typeof REGISTRATION_STEPS)[number]["id"];

// Ordered ids alone, for the index arithmetic in goNext/goBack.
export const REGISTRATION_STEP_IDS: readonly RegistrationStepId[] =
  REGISTRATION_STEPS.map((step) => step.id);

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
  label: LocalizedText;
  hint?: LocalizedText;
  // An example of the expected format, shown inside the empty control -- the
  // same place the Declarant section puts its examples. A hint, by contrast,
  // is guidance that must stay visible once the field is filled.
  placeholder?: LocalizedText;
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
  title: LocalizedText;
  // Section 3's subtitle, as in the Flutter app's per-type
  // formSectionLabel (minefop_models.dart) minus its "Section 1 —" form
  // code, which means nothing to a respondent. administration and
  // projectProgram have no Flutter counterpart and follow the same pattern.
  identification: LocalizedText;
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

// Shared field definitions.
//
// `address`, `phone`, `phone2`, `poBox`, the NIU and the year are declared
// once each and reused across the seven types -- which is what they already
// were in practice, the same label typed out seven times, with the drift that
// invites. A type needing different wording (vocationalTraining's "Adresse du
// CFP") still declares its own.
const PHONE: EntityField = {
  key: "phone",
  label: { fr: "Téléphone / WhatsApp", en: "Phone / WhatsApp" },
  placeholder: { fr: "Ex : 655000000", en: "E.g. 655000000" },
  required: true,
  kind: "tel",
};
const PHONE_2: EntityField = {
  key: "phone2",
  // Was "Téléphone secondaire" / "Secondary phone". Both fit on one line, but
  // "Téléphone 2" matches the Declarant section's own phone 1 / phone 2 pair,
  // which the respondent has already filled in once.
  label: { fr: "Téléphone 2", en: "Phone 2" },
  required: false,
  kind: "tel",
};
const PO_BOX: EntityField = {
  key: "poBox",
  label: { fr: "Boîte postale", en: "P.O. box" },
  required: false,
  kind: "text",
};
const TAX_NUMBER: EntityField = {
  key: "taxNumber",
  label: { fr: "N° contribuable (NIU)", en: "Taxpayer no. (NIU)" },
  required: true,
  kind: "text",
};
// Required for enterprise, cooperative, ctd, ong and vocationalTraining;
// administration and projectProgram do not declare it. Declared right after TAX_NUMBER so it
// sits in each type's identification/fiscal block, never last in section 3.
// (Was "N° d'affiliation CNPS" / "CNPS affiliation No.". The number IS the
// affiliation, and enterprise's block heading says Affiliation.)
const CNPS_NUMBER: EntityField = {
  key: "cnpsNumber",
  label: { fr: "N° CNPS", en: "CNPS no." },
  required: true,
  kind: "text",
};
const HEAD_OFFICE: EntityField = {
  key: "address",
  // Was "Adresse du siège social" / "Registered office address" (23 / 25).
  // "social" and "registered" do no work under a block heading that already
  // says Siège social.
  label: { fr: "Adresse du siège", en: "Office address" },
  required: true,
  kind: "text",
};
const YEAR_OF_CREATION: EntityField = {
  key: "yearOfCreation",
  label: { fr: "Année de création", en: "Year established" },
  placeholder: { fr: "AAAA", en: "YYYY" },
  required: true,
  kind: "number",
};
const MAIN_MISSION: EntityField = {
  key: "mainMission",
  label: { fr: "Mission principale", en: "Main mission" },
  required: true,
  kind: "text",
};
const SIGLE: EntityField = {
  key: "sigle",
  label: { fr: "Sigle", en: "Acronym" },
  required: false,
  kind: "text",
};

export const ENTITY_CONFIGS: Record<EntityType, EntityConfig> = {
  enterprise: {
    type: "enterprise",
    identification: { fr: "Identification de l'entreprise", en: "Company identification" },
    title: { fr: "Entreprise", en: "Company" },
    fields: [
      { key: "companyName", label: { fr: "Raison sociale", en: "Company name" }, hint: { fr: "Nom légal de l'entreprise", en: "The company's legal name" }, required: true, kind: "text" },
      { key: "legalStatus", label: { fr: "Statut juridique", en: "Legal status" }, required: true, kind: "select", options: LEGAL_STATUS_OPTIONS },
      TAX_NUMBER,
      CNPS_NUMBER,
      { key: "mainActivity", label: { fr: "Activité principale", en: "Main activity" }, required: true, kind: "text" },
      { key: "branch", label: { fr: "Branche d'activité", en: "Business branch" }, hint: { fr: "Ex : Commerce, Industrie, Services", en: "E.g. Trade, Industry, Services" }, required: false, kind: "text" },
      HEAD_OFFICE,
      PHONE,
      PHONE_2,
      PO_BOX,
      { key: "socialCapital", label: { fr: "Capital social (XAF)", en: "Share capital (XAF)" }, required: false, kind: "number" },
      // Was "Maison mère / Groupe" / "Parent company / Group" -- the label
      // whose FRENCH half contains its own " / ", which is why these could
      // not be split mechanically.
      { key: "parentCompany", label: { fr: "Maison mère", en: "Parent company" }, required: false, kind: "text" },
      { key: "secondaryActivity", label: { fr: "Activité secondaire", en: "Secondary activity" }, required: false, kind: "text" },
    ],
  },
  cooperative: {
    type: "cooperative",
    identification: { fr: "Identification de la coopérative", en: "Cooperative identification" },
    title: { fr: "Coopérative", en: "Cooperative" },
    fields: [
      { key: "cooperativeName", label: { fr: "Nom de la coopérative", en: "Cooperative name" }, required: true, kind: "text" },
      { key: "cooperativeType", label: { fr: "Type de coopérative", en: "Cooperative type" }, required: true, kind: "select", options: COOPERATIVE_TYPE_OPTIONS },
      YEAR_OF_CREATION,
      TAX_NUMBER,
      CNPS_NUMBER,
      { key: "mainActivity", label: { fr: "Activité principale", en: "Main activity" }, required: true, kind: "text" },
      { key: "cooperativeHeadOffice", label: { fr: "Adresse du siège", en: "Office address" }, required: true, kind: "text" },
      { key: "branch", label: { fr: "Branche d'activité", en: "Business branch" }, required: false, kind: "text" },
      PHONE,
      PHONE_2,
      PO_BOX,
    ],
  },
  ctd: {
    type: "ctd",
    identification: { fr: "Identification de la CTD", en: "RLA identification" },
    title: { fr: "CTD", en: "RLA" },
    fields: [
      { key: "ctdType", label: { fr: "Type de CTD", en: "RLA type" }, required: true, kind: "select", options: CTD_TYPE_OPTIONS },
      { key: "ctdName", label: { fr: "Nom de la CTD", en: "RLA name" }, hint: { fr: "Région ou commune", en: "Region or municipality" }, required: true, kind: "text" },
      YEAR_OF_CREATION,
      TAX_NUMBER,
      CNPS_NUMBER,
      HEAD_OFFICE,
      PHONE,
      PHONE_2,
      PO_BOX,
    ],
  },
  ong: {
    type: "ong",
    identification: { fr: "Identification de l'ONG", en: "NGO identification" },
    title: { fr: "ONG", en: "NGO" },
    fields: [
      { key: "ngoName", label: { fr: "Nom de l'ONG", en: "NGO name" }, required: true, kind: "text" },
      { key: "registrationNumber", label: { fr: "N° d'enregistrement", en: "Registration no." }, hint: { fr: "Numéro d'agrément", en: "Approval number" }, required: true, kind: "text" },
      TAX_NUMBER,
      CNPS_NUMBER,
      YEAR_OF_CREATION,
      MAIN_MISSION,
      HEAD_OFFICE,
      PHONE,
      PHONE_2,
      PO_BOX,
    ],
  },
  administration: {
    type: "administration",
    identification: { fr: "Identification de l'administration", en: "Administration identification" },
    title: { fr: "Administration", en: "Administration" },
    fields: [
      // Was "Nom de l'administration" / "Administration name". Both fit, but
      // the block heading already says which administration this is.
      { key: "administrationName", label: { fr: "Nom", en: "Name" }, required: true, kind: "text" },
      SIGLE,
      MAIN_MISSION,
      HEAD_OFFICE,
      PHONE,
      PHONE_2,
      PO_BOX,
    ],
  },
  projectProgram: {
    type: "projectProgram",
    identification: { fr: "Identification du projet ou programme", en: "Project or programme identification" },
    title: { fr: "Projet / Programme", en: "Project / Programme" },
    fields: [
      { key: "projectProgramName", label: { fr: "Nom", en: "Name" }, required: true, kind: "text" },
      // Was "Sigle ou acronyme" / "Abbreviation or acronym" -- the same field
      // every other type calls Sigle.
      SIGLE,
      // Was "Objectif ou mission principale" (30) / "Objective or main
      // mission" (26): over the one-line budget, and the same field the ONG
      // and Administration configs call Mission principale.
      MAIN_MISSION,
      HEAD_OFFICE,
      PHONE,
      PHONE_2,
      PO_BOX,
    ],
  },
  vocationalTraining: {
    type: "vocationalTraining",
    identification: { fr: "Identification du centre de formation", en: "Training centre identification" },
    title: {
      fr: "Centre de formation professionnelle (enquête ONEFOP)",
      en: "Vocational training centre (ONEFOP survey)",
    },
    fields: [
      { key: "centerName", label: { fr: "Nom du CFP", en: "VTC name" }, required: true, kind: "text" },
      SIGLE,
      TAX_NUMBER,
      CNPS_NUMBER,
      { key: "cfpType", label: { fr: "Type de CFP", en: "VTC type" }, required: true, kind: "select", options: CFP_TYPE_OPTIONS },
      { key: "educationSystem", label: { fr: "Ordre d'enseignement", en: "Education system" }, required: true, kind: "select", options: EDUCATION_SYSTEM_OPTIONS },
      { key: "functionalStatus", label: { fr: "Situation du centre", en: "Centre status" }, required: true, kind: "select", options: FUNCTIONAL_STATUS_OPTIONS },
      {
        key: "nonFunctionalReason",
        // Was "Raison (si non-fonctionnelle)" (29) / "Reason (if
        // non-functional)" (26). The parenthetical restated the gate that
        // puts the field on screen at all: it only appears once the centre
        // has been declared non-functional.
        label: { fr: "Raison", en: "Reason" },
        required: true,
        kind: "select",
        options: NON_FUNCTIONAL_REASON_OPTIONS,
        dependsOn: "functionalStatus",
        dependsValue: "Non-fonctionnelle",
      },
      {
        key: "nonFunctionalReasonOther",
        // "(preciser)" / "(specify)" moves from the label to the hint, where
        // an instruction belongs.
        label: { fr: "Autre raison", en: "Other reason" },
        hint: { fr: "Précisez", en: "Please specify" },
        required: true,
        kind: "text",
        dependsOn: "nonFunctionalReason",
        dependsValue: "Autres",
      },
      { key: "yearOfCreation", label: { fr: "Année d'ouverture", en: "Year opened" }, placeholder: { fr: "AAAA", en: "YYYY" }, required: true, kind: "number" },
      { key: "address", label: { fr: "Adresse du CFP", en: "VTC address" }, required: true, kind: "text" },
      PHONE,
      PHONE_2,
      PO_BOX,
      // The four promoter labels were "Promoteur/Directeur -- ...", 33 to 37
      // characters each and two lines in any column. The block heading now
      // carries "Promoteur / Directeur", so the label only has to say which
      // of their details this is -- but it keeps a "Promoteur" prefix,
      // because section 3 also asks for the CENTRE's two phone numbers and
      // the missing-fields notice lists these by name.
      { key: "promoterName", label: { fr: "Promoteur — Nom", en: "Promoter — name" }, required: true, kind: "text" },
      { key: "promoterSex", label: { fr: "Promoteur — Sexe", en: "Promoter — sex" }, required: true, kind: "select", options: SEX_OPTIONS },
      { key: "promoterPhone1", label: { fr: "Promoteur — Tél. 1", en: "Promoter — phone 1" }, required: true, kind: "tel" },
      { key: "promoterPhone2", label: { fr: "Promoteur — Tél. 2", en: "Promoter — phone 2" }, required: false, kind: "tel" },
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

// The submission-time counterpart to pruneEntityDataForType: that one drops
// fields belonging to a *type* the respondent moved away from, this one drops
// fields whose own dependsOn gate is currently closed.
//
// Both are needed because they fail differently. A respondent who sets a CFP's
// functionalStatus to "Non-fonctionnelle", answers nonFunctionalReason and
// nonFunctionalReasonOther, then corrects the status back to "Fonctionnelle"
// leaves two orphaned children in entityData. isFieldVisible() hides them from
// the form and from RegistrationReview, so the respondent sees a functional
// centre -- but submit() read entityData raw, so the payload still carried a
// reason for being non-functional. The review screen and the transmitted
// record disagreed, silently, and the wrong one was the record.
//
// Deliberately general: it gates on isFieldVisible rather than naming the CFP
// pair, so any dependsOn field added later is covered without a second fix.
// Keys the type does not declare at all are dropped too, which makes the
// payload correct even if a prune were ever missed upstream.
export function visibleEntityDataForType(
  data: Record<string, string>,
  type: EntityType
): Record<string, string> {
  const fields = ENTITY_CONFIGS[type].fields;
  const next: Record<string, string> = {};
  for (const field of fields) {
    const value = data[field.key];
    if (value === undefined) continue;
    // Gate against the raw data: a child's visibility depends on its parent's
    // current value, not on the filtered copy being built here.
    if (!isFieldVisible(field, data, fields)) continue;
    next[field.key] = value;
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
  const candidates = [data.mainActivity, data.mainMission];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return "";
}
