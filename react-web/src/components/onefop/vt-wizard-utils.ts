import type { FormData, OnefopField, OnefopSection, VtTableMeta } from "@/lib/onefop-schema";
import { isFieldVisible, isVtSectionWaived } from "@/lib/onefop-schema";
import { isOptionalField, validateSectionData } from "@/lib/onefop-validation";
import { isVtCentreClosed, missingVtTableCells, vtTableStatus } from "@/lib/vt-quiz";

export const VT_NO_STEPPER_IDS = new Set(["VT2_19", "VT2_20", "VT2_21", "VT2_22"]);
/** The two Sexe questions: short two-option radios, laid out like Yes/No. */
export const VT_SEX_CHOICE_IDS = new Set(["VT1_15_SEX", "VT1_16_SEX"]);
/**
 * 1.15 and 1.16 ask the same five things (name, sex, WhatsApp, phone 2,
 * e-mail) about two different people. The canonical AST names each block in
 * its `subsection` (lib/core/focus/compiler/onefop_ast.dart, VT1_15_NAME /
 * VT1_16_NAME), but the generated schema JSON does not carry subsections, so
 * the web wizard showed two runs of identical labels, each tagged with the
 * same code. The titles below are the AST's own wording; the wizard draws
 * one heading per block and drops the repeated code from its fields.
 */
export const VT_BLOCK_HEADINGS: Record<string, { code: string; fr: string; en: string }> = {
  VT1_15_NAME: { code: "1.15", fr: "Informations sur le répondant", en: "Respondent information" },
  VT1_16_NAME: { code: "1.16", fr: "Noms et contacts du Promoteur/Directeur du CFP", en: "Name and contact of Head/Promoter of VTC" },
};
export const VT_BLOCK_PAPER_CODES = new Set(Object.values(VT_BLOCK_HEADINGS).map((h) => h.code));

/** Administrative fields the respondent sees but never edits (1.1 Code de la
 *  Structure, "A ne pas remplir" on the paper form). */
export const VT_ADMIN_ONLY_IDS = new Set(["VT1_1"]);
export const VT_COMPACT_TOGGLE_SECTION_IDS = new Set([
  "section6_vocationalTraining",
  "section7_vocationalTraining",
]);
export const VT_TABBED_SECTION_IDS = new Set([
  "section4_vocationalTraining",
  "section8_vocationalTraining",
]);
export const VT_TABBED_IN_TABLEUR_IDS = new Set([
  "section2_vocationalTraining",
  "section3_vocationalTraining",
  "section5_vocationalTraining",
  "section6_vocationalTraining",
  "section7_vocationalTraining",
  "section9_vocationalTraining",
]);
export const VT_SIGNATURES_SECTION_ID = "section9_vocationalTraining";

export function isYesNoField(field: OnefopField): boolean {
  const opts = field.options ?? [];
  return (
    field.type === "radio" &&
    opts.length === 2 &&
    opts.some((o) => o.value === "Oui/ Yes") &&
    opts.some((o) => o.value === "Non/ No")
  );
}

export function isToggleWithDependentCount(field: OnefopField, next: OnefopField | undefined): boolean {
  return (
    !!next &&
    isYesNoField(field) &&
    next.type === "number" &&
    next.visibility?.dependsOn === field.id &&
    next.visibility.dependsValue === "Oui/ Yes"
  );
}

export function isVtTableField(field: OnefopField): boolean {
  return (field.type === "table" || field.type === "repeating_table") && !!field.table?.vt;
}

export function cellFilled(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

export function rowFilled(rowIds: string[], data: FormData): boolean {
  return rowIds.some((id) => cellFilled(data[id]));
}

export interface VtWizardSectionStats {
  filled: number;
  total: number;
}

/// "Filled/total" over the questions a respondent must answer: visible,
/// required, not a table/repeating_table field. Optional questions (second
/// phone, website…) never hold a section back. Table fields store
/// their answers under per-cell keys rather than a single field value, so
/// they're excluded here and are instead reflected only by the real
/// validator (validateSectionData) — this is a supplementary "how much is
/// left" estimate, not a second source of truth for whether a section is
/// done.
export function vtWizardGroupStats(fields: OnefopField[], data: FormData): VtWizardSectionStats {
  let filled = 0;
  let total = 0;
  for (const f of fields) {
    if (!isFieldVisible(f, data)) continue;
    if (f.type === "table" || f.type === "repeating_table") continue;
    if (!f.required) continue;
    total++;
    const v = data[f.id];
    const isEmpty =
      v === null ||
      v === undefined ||
      (typeof v === "string" && v.trim() === "") ||
      (Array.isArray(v) && v.length === 0);
    if (!isEmpty) filled++;
  }
  return { filled, total };
}

export function vtWizardSectionStats(section: OnefopSection, data: FormData): VtWizardSectionStats {
  return vtWizardGroupStats(section.fields, data);
}

export type VtWizardSectionOutlineStatus = "notStarted" | "inProgress" | "complete" | "needsAttention";

export interface VtWizardSectionOutlineItem {
  label: string;
  filled: number;
  total: number;
  /** Required visible questions of the block still unanswered (total - filled). */
  remaining: number;
  errors: number;
  status: VtWizardSectionOutlineStatus;
}

export interface VtWizardSectionOutlineModel {
  items: VtWizardSectionOutlineItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

function isAnswered(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/// The questions of one block a respondent must still answer. A visible
/// question counts when it is required (isOptionalField: neither the schema
/// nor OPTIONAL_OVERRIDES lets it be left blank). A training-centre table is
/// optional in the schema; the preliminary quiz decides it: one it marks
/// "Non" (or a closed centre's) is not counted, one marked "Oui" counts until
/// missingVtTableCells has nothing left, and one whose quiz question is still
/// unanswered counts as not answered. Tables are counted for the block's
/// progress only: isVtSectionComplete keeps relying on the validator for them.
export function vtWizardBlockRequiredStats(fields: OnefopField[], data: FormData): VtWizardSectionStats {
  let filled = 0;
  let total = 0;
  for (const f of fields) {
    if (!isFieldVisible(f, data)) continue;
    if (f.type === "table" || f.type === "repeating_table") {
      if (!f.table?.vt || isVtCentreClosed(data)) continue;
      const status = vtTableStatus(f.id, data);
      if (status === "NONE") continue;
      total++;
      if (status === "REPORTED" && missingVtTableCells(f, data).length === 0) filled++;
      continue;
    }
    if (isOptionalField(f)) continue;
    total++;
    if (isAnswered(data[f.id])) filled++;
  }
  return { filled, total };
}

/// Per-block status: a block is "complete" only when no required question
/// remains AND none of its fields has an error — a partial answer count is
/// "inProgress", never pretended to be done. Errors win over both. The
/// sidebar's section outline and the block heading read the same summary.
export function vtWizardBlockSummary(
  fields: OnefopField[],
  label: string,
  data: FormData,
  issueFieldIds: Set<string>,
): VtWizardSectionOutlineItem {
  const required = vtWizardBlockRequiredStats(fields, data);
  // A block with nothing required (optional questions only, or tables the
  // quiz excluded) is never "left to fill": it counts as 1/1 so the
  // sidebar's coverage bar still moves past it.
  const total = required.total === 0 ? 1 : required.total;
  const filled = required.total === 0 ? 1 : required.filled;
  const remaining = total - filled;
  const errors = fields.filter((f) => isFieldVisible(f, data) && issueFieldIds.has(f.id)).length;
  const status: VtWizardSectionOutlineStatus =
    errors > 0 ? "needsAttention" : remaining === 0 ? "complete" : filled > 0 ? "inProgress" : "notStarted";
  return { label, filled, total, remaining, errors, status };
}

/// Single source of truth for "is this VT section complete": the validator
/// passes (it covers tables too) and every required visible question is
/// answered. Optional questions left blank do not hold a section back. A
/// section a closed or non-functional centre does not answer is complete.
export function isVtSectionComplete(section: OnefopSection, data: FormData): boolean {
  if (isVtSectionWaived(section.id, data)) return true;
  if (validateSectionData(section, data).length > 0) return false;
  const stats = vtWizardSectionStats(section, data);
  return stats.total === 0 || stats.filled === stats.total;
}

export function supportsGuidedEntry(vt: VtTableMeta): boolean {
  const numberCount = vt.cells.filter((c) => c.kind === "number").length;
  const allNumberOrComputed = vt.cells.every((c) => c.kind === "number" || c.kind === "computed");
  const allFixed = vt.rows.every((r) => r.label != null);
  const fixedTwo =
    !vt.isRoster &&
    !vt.progressiveRows &&
    !vt.singleCellPerRow &&
    numberCount === 2 &&
    allNumberOrComputed &&
    allFixed;
  const fixedMulti =
    !vt.isRoster &&
    !vt.progressiveRows &&
    !vt.singleCellPerRow &&
    numberCount > 2 &&
    allNumberOrComputed &&
    allFixed;
  const progressiveNumber =
    vt.progressiveRows &&
    !vt.isRoster &&
    !vt.singleCellPerRow &&
    vt.cells.length >= 2 &&
    vt.cells[0].kind === "text" &&
    vt.cells.slice(1).every((c) => c.kind === "number" || c.kind === "computed");
  const progressiveBoolean =
    vt.progressiveRows &&
    !vt.isRoster &&
    !vt.singleCellPerRow &&
    vt.cells.length >= 2 &&
    vt.cells[0].kind === "text" &&
    vt.cells.slice(1).every((c) => c.kind === "boolean");
  return fixedTwo || fixedMulti || progressiveNumber || progressiveBoolean || vt.isRoster;
}

/**
 * Curated short labels for Vocational Training sections matching Flutter's
 * kSidebarMeta in lib/screens/onefop/onefop_form_constants.dart (lines 263-290).
 */
export const VT_SIDEBAR_META: Record<string, { fr: string; en: string }> = {
  section1_vocationalTraining: { fr: "Identification", en: "Identification" },
  section2_vocationalTraining: { fr: "Informations générales", en: "General information" },
  section3_vocationalTraining: { fr: "Urgences", en: "Emergencies" },
  section4_vocationalTraining: { fr: "Apprenants", en: "Trainees" },
  section5_vocationalTraining: { fr: "Guides et infrastructures", en: "Guides and infrastructure" },
  section6_vocationalTraining: { fr: "Orientation", en: "Orientation" },
  section7_vocationalTraining: { fr: "Thèmes transversaux", en: "Cross-cutting themes" },
  section8_vocationalTraining: { fr: "Formateurs", en: "Trainers" },
  section9_vocationalTraining: { fr: "Difficultés", en: "Difficulties" },
};

export function getVtSectionShortLabel(sectionId: string, locale: string = "fr"): string | null {
  const meta = VT_SIDEBAR_META[sectionId];
  if (!meta) return null;
  return locale.startsWith("en") ? meta.en : meta.fr;
}

