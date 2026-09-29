import type { FormData, OnefopField, OnefopSection, VtTableMeta } from "@/lib/onefop-schema";
import { isFieldVisible } from "@/lib/onefop-schema";
import { validateSectionData } from "@/lib/onefop-validation";

export const VT_NO_STEPPER_IDS = new Set(["VT2_19", "VT2_20", "VT2_21", "VT2_22"]);
export const VT_SEGMENTED_RADIO_IDS = new Set(["VT1_15_SEX", "VT1_16_SEX"]);
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

/// Same "filled/total visible non-table fields" count as Flutter's
/// vtWizardSectionStats (vt_wizard_progress.dart) — counts fields that are
/// currently visible and not a table/repeating_table field, against how
/// many of those currently hold a non-empty value. Table fields store
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
  errors: number;
  status: VtWizardSectionOutlineStatus;
}

export interface VtWizardSectionOutlineModel {
  items: VtWizardSectionOutlineItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

/// Per-block status, matching Flutter's _vtWizardBlockSummary: a block is
/// "complete" only when every visible field in it is filled AND error-free
/// — a partial answer count is "inProgress", never pretended to be done.
export function vtWizardBlockSummary(
  fields: OnefopField[],
  label: string,
  data: FormData,
  issueFieldIds: Set<string>,
): VtWizardSectionOutlineItem {
  const rawStats = vtWizardGroupStats(fields, data);
  const total = rawStats.total === 0 ? 1 : rawStats.total;
  const filled =
    rawStats.total === 0 ? (fields.every((f) => cellFilled(data[f.id])) ? 1 : 0) : rawStats.filled;
  const errors = fields.filter((f) => isFieldVisible(f, data) && issueFieldIds.has(f.id)).length;
  const complete = total > 0 && filled === total && errors === 0;
  const status: VtWizardSectionOutlineStatus =
    errors > 0 ? "needsAttention" : complete ? "complete" : filled > 0 ? "inProgress" : "notStarted";
  return { label, filled, total, errors, status };
}

/// Single source of truth for "is this VT section complete", matching
/// Flutter's vt_wizard_shell.dart _isComplete exactly: the real validator
/// must pass AND every visible non-table field must be filled (not just
/// the required ones) — a section with only its required fields answered
/// is "in progress", not "complete".
export function isVtSectionComplete(section: OnefopSection, data: FormData): boolean {
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

