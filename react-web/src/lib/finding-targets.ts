import type { OnefopEntity, OnefopField } from "./onefop-schema";
import { localized } from "./onefop-schema";

/**
 * Where a finding sends the reviewer: the tables or questions the rule itself
 * compares. Each entry restates what the server's check reads
 * (QuestionnairesService.checkCoherence / checkVtCoherence), so a link is a
 * fact about the rule, not a guess about which cell is wrong. A rule not
 * listed here gets no link rather than a misleading one (plan, Phase 3).
 */
type Target =
  | { fieldId: string }
  /** S22Q05 is S22Q05_ENTERPRISE, S22Q05_COOPERATIVE… on each employer form. */
  | { fieldPrefix: string }
  /** The headline counts live under a different id on each form, one path. */
  | { pathSuffix: string }
  /** VT rules compare tables inside one section: 4 (trainees) or 8 (trainers). */
  | { vtSectionOrder: number };

const RULE_TARGETS: Record<string, Target[]> = {
  S22Q03_DIPLOMA_MISMATCH: [{ fieldId: "S22Q03" }, { fieldId: "S22Q01" }, { fieldId: "S22Q02" }],
  S3_DISMISSAL_MISMATCH: [{ fieldId: "S3Q01" }, { fieldId: "S3Q02" }, { fieldId: "S3Q03" }],
  S22Q04_PERMANENT_EXCEEDS_TOTAL: [{ fieldId: "S22Q04" }, { fieldId: "S22Q01" }],
  S22Q04_TEMPORARY_EXCEEDS_TOTAL: [{ fieldId: "S22Q04" }, { fieldId: "S22Q02" }],
  S22Q05_PERMANENT_EXCEEDS_TOTAL: [{ fieldPrefix: "S22Q05" }, { fieldId: "S22Q01" }],
  S22Q05_TEMPORARY_EXCEEDS_TOTAL: [{ fieldPrefix: "S22Q05" }, { fieldId: "S22Q02" }],
  S23Q02_PERMANENT_EXCEEDS_TOTAL: [{ fieldId: "S23Q02" }, { fieldId: "S22Q01" }],
  S23Q02_TEMPORARY_EXCEEDS_TOTAL: [{ fieldId: "S23Q02" }, { fieldId: "S22Q02" }],
  PP_S4Q05_PERMANENT_EXCEEDS_TOTAL: [{ fieldId: "PP_S4Q05" }, { fieldId: "PP_S4Q03" }],
  PP_S4Q05_TEMPORARY_EXCEEDS_TOTAL: [{ fieldId: "PP_S4Q05" }, { fieldId: "PP_S4Q04" }],
  PP_S4Q06_PERMANENT_EXCEEDS_TOTAL: [{ fieldId: "PP_S4Q06" }, { fieldId: "PP_S4Q03" }],
  PP_S4Q06_TEMPORARY_EXCEEDS_TOTAL: [{ fieldId: "PP_S4Q06" }, { fieldId: "PP_S4Q04" }],
  PP_S4Q01_HEADCOUNT_MISMATCH: [{ fieldId: "PP_S4Q01" }, { pathSuffix: "permanentWorkers" }],
  PERMANENT_WORKERS_IMPLAUSIBLE: [{ pathSuffix: "permanentWorkers" }],
  VACANCIES_IMPLAUSIBLE: [{ pathSuffix: "vacancies" }],
  VT_DIPLOMA_ACADEMIC_PRO_MISMATCH: [{ vtSectionOrder: 4 }],
  VT_TRAINEE_SPECIALTY_TOTAL_MISMATCH: [{ vtSectionOrder: 4 }],
  VT_TRAINEE_INITIAL_TRAINING_YEAR_MISMATCH: [{ vtSectionOrder: 4 }],
  VT_TRAINEE_AGE_ENTRANT_MISMATCH: [{ vtSectionOrder: 4 }],
  VT_TRAINEE_EDU_LEVEL_ENTRANT_MISMATCH: [{ vtSectionOrder: 4 }],
  VT_TRAINEE_OUTGOING_SPECIALTY_MISMATCH: [{ vtSectionOrder: 4 }],
  VT_TRAINER_DIPLOMA_ACADEMIC_PRO_MISMATCH: [{ vtSectionOrder: 8 }],
  VT_TRAINER_AGE_MISMATCH: [{ vtSectionOrder: 8 }],
  VT_TRAINER_STATUS_MISMATCH: [{ vtSectionOrder: 8 }],
};

/** The anchor an answer field carries in the workspace. */
export function dossierFieldAnchor(fieldId: string): string {
  return `dossier-field-${fieldId}`;
}

export interface FindingTarget {
  /** Element id on the page, without « # ». */
  anchor: string;
  label: string;
}

function fieldLabel(field: OnefopField, locale: "fr" | "en"): string {
  return localized(field.label, locale) || field.id;
}

/** The places on this file's page a finding links to; empty when the rule has none. */
export function findingTargets(
  ruleCode: string | null | undefined,
  entity: OnefopEntity | null | undefined,
  locale: "fr" | "en",
): FindingTarget[] {
  const targets = ruleCode ? RULE_TARGETS[ruleCode] : undefined;
  if (!targets || !entity) return [];
  const fields = entity.sections.flatMap((section) => section.fields);
  const found: FindingTarget[] = [];
  for (const target of targets) {
    if ("pathSuffix" in target) {
      // The headline counts are shown in the workspace's identification block,
      // not as a question of their own.
      const field = fields.find((item) => item.path?.endsWith(`.${target.pathSuffix}`));
      if (field && !found.some((item) => item.anchor === "dossier-structure")) {
        found.push({ anchor: "dossier-structure", label: fieldLabel(field, locale) });
      }
      continue;
    }
    if ("vtSectionOrder" in target) {
      const section = entity.sections.find((item) => item.order === target.vtSectionOrder);
      if (section) found.push({ anchor: `dossier-section-${section.id}`, label: localized(section.title, locale) || section.id });
      continue;
    }
    const field = "fieldId" in target
      ? fields.find((item) => item.id === target.fieldId)
      : fields.find((item) => item.id.startsWith(target.fieldPrefix) && Boolean(item.table));
    if (field && !found.some((item) => item.anchor === dossierFieldAnchor(field.id))) {
      found.push({ anchor: dossierFieldAnchor(field.id), label: fieldLabel(field, locale) });
    }
  }
  return found;
}

export interface PlacedFlag {
  severity: "blocking" | "warning";
  /** The finding's sentence, as the « À vérifier » list words it. */
  text: string;
}

/**
 * The findings placed where they point: anchor → the findings that link
 * there. The workspace marks those tables and sections in place, and the rail
 * counts them per section, so a reviewer sees where to look without reading
 * the list first.
 */
export function placeFindings(
  findings: Array<PlacedFlag & { ruleCode: string }>,
  entity: OnefopEntity | null | undefined,
  locale: "fr" | "en",
): Record<string, PlacedFlag[]> {
  const placed: Record<string, PlacedFlag[]> = {};
  for (const finding of findings) {
    for (const target of findingTargets(finding.ruleCode, entity, locale)) {
      (placed[target.anchor] ??= []).push({ severity: finding.severity, text: finding.text });
    }
  }
  return placed;
}

/** How many placed findings fall inside a section: on the section itself or on one of its questions. */
export function sectionFlagCount(
  placed: Record<string, PlacedFlag[]>,
  section: { id: string; fields: Array<{ id: string }> },
): { count: number; blocking: boolean } {
  const anchors = [`dossier-section-${section.id}`, ...section.fields.map((field) => dossierFieldAnchor(field.id))];
  const flags = anchors.flatMap((anchor) => placed[anchor] ?? []);
  return { count: flags.length, blocking: flags.some((flag) => flag.severity === "blocking") };
}
