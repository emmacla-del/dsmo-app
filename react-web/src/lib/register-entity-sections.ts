// src/lib/register-entity-sections.ts
//
// The per-entity-type grouping of section 3's fields into labelled blocks,
// and the ordered list of fields that grouping actually renders.
//
// This used to be a const inside app/register/page.tsx, read only by that
// file's JSX. It moved here because the wizard now needs a second answer from
// it: "which field is LAST in this section", which is what decides when a
// section with optional fields has been finished and the next one may open.
// Deriving that from a separate hand-written list would have let it drift from
// the render order the respondent actually sees, so both come from
// entityFieldGroups() below.
//
// The titles are the questionnaire's own block headings, not UI copy, so
// they are {fr, en} data here rather than next-intl keys -- the same rule
// register-i18n.ts sets out for ENTITY_CONFIGS' field labels.
import {
  ENTITY_CONFIGS,
  isFieldVisible,
  type EntityField,
  type EntityType,
} from "./register-constants";
import type { LocalizedText } from "./register-i18n";

export interface EntityFieldGroup {
  title: LocalizedText;
  fields: EntityField[];
}

const ENTITY_SECTION_LAYOUT: Record<EntityType, { title: LocalizedText; keys: string[] }[]> = {
  enterprise: [
    // Name and legal status, then the NIU and the CNPS number, then the
    // optional capital and parent company. A key must live in one group
    // only: field order inside a group follows ENTITY_CONFIGS, and a key
    // listed twice is rendered twice.
    { title: { fr: "Identité juridique", en: "Legal identity" }, keys: ["companyName", "legalStatus"] },
    { title: { fr: "Fiscalité et affiliation", en: "Tax and social security" }, keys: ["taxNumber", "cnpsNumber"] },
    { title: { fr: "Capital et rattachement", en: "Capital and parent company" }, keys: ["socialCapital", "parentCompany"] },
    { title: { fr: "Activité économique", en: "Economic activity" }, keys: ["mainActivity", "activitySector", "branchId", "secondaryActivity"] },
    { title: { fr: "Siège social et contact", en: "Registered office and contact" }, keys: ["address", "phone", "phone2", "poBox"] },
  ],
  cooperative: [
    { title: { fr: "Identité de la coopérative", en: "Cooperative identity" }, keys: ["cooperativeName", "cooperativeType", "yearOfCreation", "taxNumber", "cnpsNumber"] },
    { title: { fr: "Activité", en: "Activity" }, keys: ["mainActivity", "activitySector", "branchId"] },
    { title: { fr: "Siège social et contact", en: "Registered office and contact" }, keys: ["cooperativeHeadOffice", "phone", "phone2", "poBox"] },
  ],
  ctd: [
    { title: { fr: "Identification de la CTD", en: "RLA identification" }, keys: ["ctdType", "ctdName", "yearOfCreation", "taxNumber", "cnpsNumber"] },
    { title: { fr: "Activité", en: "Activity" }, keys: ["activitySector", "branchId"] },
    { title: { fr: "Siège et contact", en: "Head office and contact" }, keys: ["address", "phone", "phone2", "poBox"] },
  ],
  ong: [
    { title: { fr: "Enregistrement et mission", en: "Registration and mission" }, keys: ["ngoName", "registrationNumber", "taxNumber", "cnpsNumber", "yearOfCreation", "mainMission"] },
    { title: { fr: "Activité", en: "Activity" }, keys: ["activitySector", "branchId"] },
    { title: { fr: "Siège social et contact", en: "Registered office and contact" }, keys: ["address", "phone", "phone2", "poBox"] },
  ],
  administration: [
    { title: { fr: "Identification administrative", en: "Administrative identity" }, keys: ["administrationName", "sigle", "mainMission"] },
    { title: { fr: "Activité", en: "Activity" }, keys: ["activitySector", "branchId"] },
    { title: { fr: "Siège et contact", en: "Head office and contact" }, keys: ["address", "phone", "phone2", "poBox"] },
  ],
  projectProgram: [
    { title: { fr: "Identification", en: "Identification" }, keys: ["projectNature", "projectProgramName", "sigle", "mainMission"] },
    { title: { fr: "Activité", en: "Activity" }, keys: ["activitySector", "branchId"] },
    { title: { fr: "Siège et contact", en: "Head office and contact" }, keys: ["address", "phone", "phone2", "poBox"] },
  ],
  vocationalTraining: [
    { title: { fr: "Identification du centre", en: "Centre identification" }, keys: ["centerName", "sigle", "taxNumber", "cnpsNumber", "yearOfCreation", "cfpType", "educationSystem"] },
    { title: { fr: "Situation opérationnelle", en: "Operational status" }, keys: ["functionalStatus", "nonFunctionalReason", "nonFunctionalReasonOther"] },
    { title: { fr: "Localisation et contact", en: "Location and contact" }, keys: ["address", "phone", "phone2", "poBox"] },
    // Carries the "Promoteur / Directeur" the four promoter LABELS used to
    // repeat in full, 33-37 characters each.
    { title: { fr: "Promoteur / Directeur", en: "Promoter / Director" }, keys: ["promoterName", "promoterSex", "promoterPhone1", "promoterPhone2"] },
  ],
};

// Catch-all for a field the layout above does not place. It exists so that
// adding a field to ENTITY_CONFIGS can never make it silently unreachable.
export const UNMAPPED_GROUP_TITLE: LocalizedText = {
  fr: "Informations complémentaires",
  en: "Additional information",
};

// The groups, in render order, holding only the fields whose gate is open.
// Field order inside a group follows ENTITY_CONFIGS' own order, not the
// layout's key list -- which is what the page's JSX already did.
export function entityFieldGroups(
  entityType: EntityType,
  entityData: Record<string, string>
): EntityFieldGroup[] {
  const config = ENTITY_CONFIGS[entityType];
  const visible = (f: EntityField) => isFieldVisible(f, entityData, config.fields);
  const layout = ENTITY_SECTION_LAYOUT[entityType] ?? [
    {
      title: { fr: "Informations générales", en: "General information" },
      keys: config.fields.map((f) => f.key),
    },
  ];

  const groups: EntityFieldGroup[] = [];
  const placed = new Set<string>();

  for (const block of layout) {
    const fields = config.fields.filter((f) => block.keys.includes(f.key) && visible(f));
    if (fields.length === 0) continue;
    for (const f of fields) placed.add(f.key);
    groups.push({ title: block.title, fields });
  }

  const remaining = config.fields.filter((f) => !placed.has(f.key) && visible(f));
  if (remaining.length > 0) {
    groups.push({ title: UNMAPPED_GROUP_TITLE, fields: remaining });
  }

  return groups;
}

// The groups the organisation step shows in the open part of the form:
// required visible fields only. A group whose fields are all optional
// (enterprise's capital block) is dropped, so it does not leave an empty
// heading above the disclosure.
export function requiredEntityGroups(
  entityType: EntityType,
  entityData: Record<string, string>
): EntityFieldGroup[] {
  return entityFieldGroups(entityType, entityData)
    .map((group) => ({ ...group, fields: group.fields.filter((f) => f.required) }))
    .filter((group) => group.fields.length > 0);
}

// Visible optional fields, in the same order entityFieldGroups would have
// rendered them. The page puts these behind one closed disclosure after the
// required groups, so Continuer follows the last required field. Order here
// is the order inside that disclosure.
export function optionalEntityFields(
  entityType: EntityType,
  entityData: Record<string, string>
): EntityField[] {
  return entityFieldGroups(entityType, entityData).flatMap((group) =>
    group.fields.filter((f) => !f.required)
  );
}

// The key of the last field the section renders, or null when the type has no
// visible field at all. Required groups render first and the optional
// disclosure after them, so the last field is the last optional one when the
// type has any. Leaving it, or pressing Enter on it, is what tells the
// wizard the respondent has reached the end of section 3.
export function lastEntityFieldKey(
  entityType: EntityType,
  entityData: Record<string, string>
): string | null {
  const optional = optionalEntityFields(entityType, entityData);
  if (optional.length > 0) return optional[optional.length - 1].key;
  const groups = requiredEntityGroups(entityType, entityData);
  const lastGroup = groups[groups.length - 1];
  if (!lastGroup) return null;
  return lastGroup.fields[lastGroup.fields.length - 1]?.key ?? null;
}
