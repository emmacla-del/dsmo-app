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
    { title: { fr: "Identité juridique", en: "Legal identity" }, keys: ["companyName", "legalStatus", "socialCapital", "parentCompany"] },
    { title: { fr: "Fiscalité et affiliation", en: "Tax and social security" }, keys: ["taxNumber", "cnpsNumber"] },
    { title: { fr: "Activité économique", en: "Economic activity" }, keys: ["mainActivity", "secondaryActivity", "branch"] },
    { title: { fr: "Siège social et contact", en: "Registered office and contact" }, keys: ["address", "phone", "phone2", "poBox"] },
  ],
  cooperative: [
    { title: { fr: "Identité de la coopérative", en: "Cooperative identity" }, keys: ["cooperativeName", "cooperativeType", "yearOfCreation", "taxNumber"] },
    { title: { fr: "Activité", en: "Activity" }, keys: ["mainActivity", "branch"] },
    { title: { fr: "Siège social et contact", en: "Registered office and contact" }, keys: ["cooperativeHeadOffice", "phone", "phone2", "poBox"] },
  ],
  ctd: [
    { title: { fr: "Identification de la CTD", en: "RLA identification" }, keys: ["ctdType", "ctdName", "yearOfCreation", "taxNumber"] },
    { title: { fr: "Siège et contact", en: "Head office and contact" }, keys: ["address", "phone", "phone2", "poBox"] },
  ],
  ong: [
    { title: { fr: "Enregistrement et mission", en: "Registration and mission" }, keys: ["ngoName", "registrationNumber", "taxNumber", "yearOfCreation", "mainMission"] },
    { title: { fr: "Siège social et contact", en: "Registered office and contact" }, keys: ["address", "phone", "phone2", "poBox"] },
  ],
  administration: [
    { title: { fr: "Identification administrative", en: "Administrative identity" }, keys: ["administrationName", "sigle", "mainMission"] },
    { title: { fr: "Siège et contact", en: "Head office and contact" }, keys: ["address", "phone", "phone2", "poBox"] },
  ],
  projectProgram: [
    { title: { fr: "Identification du projet", en: "Project identification" }, keys: ["projectProgramName", "sigle", "mainMission"] },
    { title: { fr: "Siège et contact", en: "Head office and contact" }, keys: ["address", "phone", "phone2", "poBox"] },
  ],
  vocationalTraining: [
    { title: { fr: "Identification du centre", en: "Centre identification" }, keys: ["centerName", "sigle", "taxNumber", "yearOfCreation", "cfpType", "educationSystem"] },
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

// The key of the last field the section renders, or null when the type has no
// visible field at all. A change to this field is what tells the wizard the
// respondent has reached the end of section 3 and the next section may open:
// section 3's optional fields (CNPS, the second phone) mean it cannot open the
// next one the instant its required fields are satisfied, or the optional ones
// would be pulled away mid-entry.
export function lastEntityFieldKey(
  entityType: EntityType,
  entityData: Record<string, string>
): string | null {
  const groups = entityFieldGroups(entityType, entityData);
  const lastGroup = groups[groups.length - 1];
  if (!lastGroup) return null;
  return lastGroup.fields[lastGroup.fields.length - 1]?.key ?? null;
}
