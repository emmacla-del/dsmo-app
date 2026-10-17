// What the admin file page may show for a declaration, read from the
// generated schema (onefop_ast.dart -> onefop.schema.json) for the file's own
// entity type.
//
// The page used to carry one section list — the enterprise family's « Section
// 2. Emploi et travail / Section 3. Départs / Section 4. Stage et formation »
// — and showed it for every type except VT. A project/programme file was
// therefore headed with three enterprise sections it does not have, and the
// correction-request dialog offered them to the reviewer, who could ask a
// project respondent to correct a section their questionnaire never asked
// (e2e-2026-10-17-project-enterprise.md, B3).
//
// Nothing here restates a title, an option or a question: the schema is the
// canonical AST's own output, so this screen cannot drift from the
// questionnaire.
import type { OnefopEntity, OnefopField } from "./onefop-schema";
import { localized } from "./onefop-schema";
import { sentenceCaseTitle } from "./dossier-vt-answers";

type Locale = "fr" | "en";

/** OnefopSubmission.formType -> generated schema entity key (same mapping as
 * /admin/questionnaires and Prisma's OnefopEntityType). */
const SCHEMA_ENTITY_KEY: Record<string, string> = {
  ENTREPRISE: "enterprise",
  COOPERATIVE: "cooperative",
  CTD: "ctd",
  ONG: "ong",
  ADMINISTRATION: "administration",
  PROJECT_PROGRAM: "projectProgram",
  VOCATIONAL_TRAINING: "vocationalTraining",
};

/** The entity the schema describes for this file, or null for a formType the
 * schema does not know — in which case no section is shown, rather than
 * another type's. */
export function dossierEntity(
  schema: { entities: Record<string, OnefopEntity> } | null | undefined,
  formType: string | null | undefined,
): OnefopEntity | null {
  const key = formType ? SCHEMA_ENTITY_KEY[formType] : undefined;
  return (key && schema?.entities[key]) || null;
}

export interface DossierSection {
  id: string;
  /** The title in the reader's language. */
  title: string;
  /** The same title in French: what the correction request stores in its
   * comment, the official record sent to the respondent, which stays French
   * whatever the reviewer's language. */
  titleFr: string;
}

/**
 * The sections of this file's questionnaire, in schema order, without Section
 * 0: the respondent's identity has its own card on the page and was never
 * one of the options offered for correction.
 */
export function dossierSections(entity: OnefopEntity | null, locale: Locale): DossierSection[] {
  if (!entity) return [];
  return entity.sections
    .filter((s) => s.order !== 0)
    .map((s) => ({
      id: s.id,
      title: sentenceCaseTitle(localized(s.title, locale)),
      titleFr: sentenceCaseTitle(localized(s.title, "fr")),
    }));
}

/**
 * Where a section's figures are stored, by section id — named in the notice
 * that says this screen does not render them. The enterprise family shares
 * section2/3/4; projects and programmes have their own three
 * (flat-key-normalizer.ts, questionnaires.service.ts).
 *
 * A section absent from this map is reported without naming tables rather
 * than with another questionnaire's.
 */
const SECTION_SOURCES: Record<string, string> = {
  section2: "cspGenderAge, diplomaData, disabilityData, vulnerableData, firstTimeWorkers",
  section3: "departureData, dismissalReasons, dismissalUnemployment",
  section4: "internshipData, skillNeeds, trainingNeeds",
  section2_projectProgram: "projectProgramActivities",
  section3_projectProgram: "projectProgramDetail (employed, selfEmployed, jobsCreated, trained)",
  section4_projectProgram: "cspGenderAge, disabilityData, vulnerableData",
};

export function sectionBackingTables(sectionId: string): string | null {
  return SECTION_SOURCES[sectionId] ?? null;
}

/**
 * Structure-card columns whose Prisma name differs from the AST path of the
 * question that fills them (Onefop*Detail in prisma/schema.prisma vs
 * onefop_ast.dart). Everything else is `<entity key>.<column>`.
 */
const FIELD_PATH_ALIASES: Record<string, string> = {
  enterpriseSize: "size",
  cooperativeType: "type",
  ctdType: "type",
};

/** The question that fills a detail-row column, or null when the schema has
 * none under that path (companyName, promoterName, …). */
export function fieldForDetailColumn(entity: OnefopEntity | null, column: string): OnefopField | null {
  if (!entity) return null;
  const path = `${entity.entityType}.${FIELD_PATH_ALIASES[column] ?? column}`;
  for (const section of entity.sections) {
    for (const field of section.fields) {
      if (field.path === path) return field;
    }
  }
  return null;
}

/** True when this file's questionnaire asks the question that fills a column. */
export function questionnaireAsks(entity: OnefopEntity | null, column: string): boolean {
  return fieldForDetailColumn(entity, column) !== null;
}

/**
 * The stored answer of a coded question as the option the respondent chose.
 *
 * The relational detail rows store a radio answer in two ways: the option
 * value as submitted ("Tertiaire/ Tertiary"), or the 1-based position of that
 * option in the AST's own list, which the submit normalizers compute
 * (mapNature, mapSector, … in src/common/normalizers/flat-key-normalizer.ts).
 * A reviewer was shown the bare code — « Nature: 1 » on a project file (B3,
 * same cause as B1). Resolving by position is the rule the official PDF
 * already follows (§21, 2026-10-15).
 *
 * Display only: nothing stored or exported changes, and a value that matches
 * no option is returned as stored — it is still the respondent's answer.
 */
export function detailAnswerValue(
  entity: OnefopEntity | null,
  column: string,
  stored: string,
): string {
  const options = fieldForDetailColumn(entity, column)?.options;
  if (!options?.length) return stored;
  if (options.some((o) => o.value === stored)) return stored;
  const code = Number(stored);
  if (Number.isInteger(code) && code >= 1 && code <= options.length) return options[code - 1].value;
  return stored;
}
