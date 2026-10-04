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
// The titles are the questionnaire's own bilingual block headings, not UI
// copy, so they are data here rather than next-intl keys -- the same rule
// register-summary.ts applies to ENTITY_CONFIGS' field labels.
import {
  ENTITY_CONFIGS,
  isFieldVisible,
  type EntityField,
  type EntityType,
} from "./register-constants";

export interface EntityFieldGroup {
  title: string;
  fields: EntityField[];
}

const ENTITY_SECTION_LAYOUT: Record<EntityType, { title: string; keys: string[] }[]> = {
  enterprise: [
    { title: "Identité juridique / Legal Identity", keys: ["companyName", "legalStatus", "socialCapital", "parentCompany"] },
    { title: "Fiscalité & Affiliation / Tax & Social", keys: ["taxNumber", "cnpsNumber"] },
    { title: "Activité économique / Economic Activity", keys: ["mainActivity", "secondaryActivity", "branch"] },
    { title: "Siège social & Coordonnées / Registered Office & Contact", keys: ["address", "phone", "phone2", "poBox"] },
  ],
  cooperative: [
    { title: "Identité de la coopérative / Cooperative Legal Identity", keys: ["cooperativeName", "cooperativeType", "yearOfCreation", "taxNumber"] },
    { title: "Activité / Activity", keys: ["mainActivity", "branch"] },
    { title: "Siège social & Coordonnées / Registered Office & Contact", keys: ["cooperativeHeadOffice", "phone", "phone2", "poBox"] },
  ],
  ctd: [
    { title: "Identification de la CTD / RLA Identification", keys: ["ctdType", "ctdName", "yearOfCreation", "taxNumber"] },
    { title: "Siège & Coordonnées / Head Office & Contact", keys: ["address", "phone", "phone2", "poBox"] },
  ],
  ong: [
    { title: "Enregistrement & Mission / NGO Registration & Mission", keys: ["ngoName", "registrationNumber", "taxNumber", "yearOfCreation", "mainMission"] },
    { title: "Siège social & Coordonnées / Registered Office & Contact", keys: ["address", "phone", "phone2", "poBox"] },
  ],
  administration: [
    { title: "Identification administrative / Administrative Identity", keys: ["administrationName", "sigle", "mainMission"] },
    { title: "Siège & Coordonnées / Head Office & Contact", keys: ["address", "phone", "phone2", "poBox"] },
  ],
  projectProgram: [
    { title: "Identification du projet / Project Identification", keys: ["projectProgramName", "sigle", "mainMission"] },
    { title: "Siège & Coordonnées / Head Office & Contact", keys: ["address", "phone", "phone2", "poBox"] },
  ],
  vocationalTraining: [
    { title: "Identification du Centre (CFP) / VTC Identification", keys: ["centerName", "sigle", "taxNumber", "yearOfCreation", "cfpType", "educationSystem"] },
    { title: "Situation opérationnelle / Operational Status", keys: ["functionalStatus", "nonFunctionalReason", "nonFunctionalReasonOther"] },
    { title: "Localisation & Coordonnées / Location & Contact", keys: ["address", "phone", "phone2", "poBox"] },
    { title: "Direction & Promoteur / Direction & Promoter", keys: ["promoterName", "promoterSex", "promoterPhone1", "promoterPhone2"] },
  ],
};

// Catch-all for a field the layout above does not place. It exists so that
// adding a field to ENTITY_CONFIGS can never make it silently unreachable.
export const UNMAPPED_GROUP_TITLE = "Informations complémentaires";

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
    { title: "Informations générales / General Information", keys: config.fields.map((f) => f.key) },
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
