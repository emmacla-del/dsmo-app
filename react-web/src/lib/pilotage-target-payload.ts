import {
  TARGET_MAX,
  type TargetField,
  type TargetMode,
  type TargetPutBody,
  type TargetPutEntry,
  type TargetRegionRow,
} from "./pilotage-targets";
import { NOT_PROVIDED } from "./admin-data-state";
import type { UiLocale } from "./register-i18n";

export type EditMode = "DEPARTMENT" | "REGION";

export interface NormalizedDepartment {
  departmentId: string;
  name: string;
  target: number | null;
}

export interface NormalizedRegion {
  regionId: string;
  name: string;
  mode: TargetMode;
  target: number | null;
  departments: NormalizedDepartment[];
}

export interface RegionDraft {
  regionId: string;
  /** null: UNSET or MIXED, writer has not chosen a mode yet. */
  mode: EditMode | null;
  regionInput: string;
  departmentInputs: Record<string, string>;
  /** When true, the PUT clears every stored row for this region. */
  clear?: boolean;
}

export interface PayloadChange {
  kind: "region" | "central";
  name: string;
  from: string;
  to: string;
}

export type BuildPayloadResult =
  | { ok: true; body: TargetPutBody; changes: PayloadChange[] }
  | { ok: false; errors: string[] };

// Labels and validation messages in both console locales. Every exported
// helper takes the locale last and defaults to French.
const TEXT = {
  fr: {
    invalidInt: "doit être un entier positif ou nul.",
    byDepartment: "Par département",
    regionOnly: "Région seule",
    mixed: "Mixte",
    notSet: "Non défini",
    invalidValue: "valeur invalide",
    central: "Niveau central",
    noChanges: "Aucune modification à enregistrer.",
    region: (name: string) => `La région « ${name} »`,
    department: (name: string, region: string) => `Le département « ${name} » (${region})`,
    separator: " : ",
  },
  en: {
    invalidInt: "must be a whole number, zero or more.",
    byDepartment: "By department",
    regionOnly: "Region only",
    mixed: "Mixed",
    notSet: "Not set",
    invalidValue: "invalid value",
    central: "Central level",
    noChanges: "No changes to save.",
    region: (name: string) => `Region "${name}"`,
    department: (name: string, region: string) => `Department "${name}" (${region})`,
    separator: ": ",
  },
} as const;

export function normalizeRegions(regions: TargetRegionRow[], field: TargetField): NormalizedRegion[] {
  return regions.map((region) => ({
    regionId: region.regionId,
    name: region.name,
    mode: region.mode,
    target: numberOrNull(region[field]),
    departments: region.departments.map((department) => ({
      departmentId: department.departmentId,
      name: department.name,
      target: numberOrNull(department[field]),
    })),
  }));
}

export function initRegionDraft(region: NormalizedRegion): RegionDraft {
  if (region.mode === "DEPARTMENT") {
    return {
      regionId: region.regionId,
      mode: "DEPARTMENT",
      regionInput: "",
      departmentInputs: Object.fromEntries(
        region.departments.map((department) => [
          department.departmentId,
          department.target == null ? "" : String(department.target),
        ]),
      ),
    };
  }
  if (region.mode === "REGION") {
    return {
      regionId: region.regionId,
      mode: "REGION",
      regionInput: region.target == null ? "" : String(region.target),
      departmentInputs: Object.fromEntries(region.departments.map((department) => [department.departmentId, ""])),
    };
  }
  return {
    regionId: region.regionId,
    mode: null,
    regionInput: "",
    departmentInputs: Object.fromEntries(region.departments.map((department) => [department.departmentId, ""])),
  };
}

export function initDrafts(regions: NormalizedRegion[]): Record<string, RegionDraft> {
  return Object.fromEntries(regions.map((region) => [region.regionId, initRegionDraft(region)]));
}

export function clearRegionDraft(region: NormalizedRegion): RegionDraft {
  return {
    regionId: region.regionId,
    mode: null,
    regionInput: "",
    departmentInputs: Object.fromEntries(region.departments.map((department) => [department.departmentId, ""])),
    clear: true,
  };
}

export function applyEditMode(region: NormalizedRegion, mode: EditMode): RegionDraft {
  if (mode === "DEPARTMENT") {
    return {
      regionId: region.regionId,
      mode,
      regionInput: "",
      departmentInputs: Object.fromEntries(
        region.departments.map((department) => [
          department.departmentId,
          department.target == null ? "" : String(department.target),
        ]),
      ),
    };
  }
  const sum = sumFilled(Object.fromEntries(
    region.departments.map((department) => [
      department.departmentId,
      department.target == null ? "" : String(department.target),
    ]),
  ));
  return {
    regionId: region.regionId,
    mode,
    regionInput: region.target != null ? String(region.target) : sum != null ? String(sum) : "",
    departmentInputs: Object.fromEntries(region.departments.map((department) => [department.departmentId, ""])),
  };
}

export function parseTargetInput(raw: string): number | null | "invalid" {
  const text = raw.trim();
  if (text === "") return null;
  if (!/^\d+$/.test(text)) return "invalid";
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0 || value > TARGET_MAX) return "invalid";
  return value;
}

export function sumFilled(departmentInputs: Record<string, string>): number | null {
  let sum = 0;
  let any = false;
  for (const raw of Object.values(departmentInputs)) {
    const parsed = parseTargetInput(raw);
    if (parsed === "invalid" || parsed == null) continue;
    sum += parsed;
    any = true;
  }
  return any ? sum : null;
}

export function modeLabel(mode: TargetMode | EditMode | null, locale: UiLocale = "fr"): string {
  const text = TEXT[locale];
  if (mode === "DEPARTMENT") return text.byDepartment;
  if (mode === "REGION") return text.regionOnly;
  if (mode === "MIXED") return text.mixed;
  return text.notSet;
}

/**
 * Renders one coverage count cell.
 *
 * A coverage count is a measurement over the Company rows of a territory, so
 * it only means something when there are rows underneath it. With no companies
 * in the territory there is nothing to measure and the cell shows the absence
 * marker; with companies present the real figure is printed, including a
 * genuine 0 (47 companies and 0 registered is a measured zero, not absence).
 * A null count is already an absence (the reader's scope hides the figure).
 */
export function formatCoverageCount(
  value: number | null | undefined,
  companyCount: number | null | undefined,
  locale: UiLocale = "fr",
): string {
  if (value == null) return NOT_PROVIDED;
  if (companyCount === 0) return NOT_PROVIDED;
  return fmt(value, locale);
}

export function describeStored(region: NormalizedRegion, locale: UiLocale = "fr"): string {
  const text = TEXT[locale];
  if (region.mode === "UNSET") return text.notSet;
  if (region.mode === "REGION") {
    return region.target == null ? text.regionOnly : `${text.regionOnly} · ${fmt(region.target, locale)}`;
  }
  if (region.mode === "DEPARTMENT") {
    const filled = region.departments.filter((department) => department.target != null);
    const total = filled.reduce((sum, department) => sum + (department.target ?? 0), 0);
    return filled.length === 0 ? text.byDepartment : `${text.byDepartment} · ${fmt(total, locale)}`;
  }
  return text.mixed;
}

export function describeDraft(region: NormalizedRegion, draft: RegionDraft, locale: UiLocale = "fr"): string {
  const text = TEXT[locale];
  if (draft.clear) return text.notSet;
  if (draft.mode == null) return modeLabel(region.mode, locale);
  if (draft.mode === "REGION") {
    const parsed = parseTargetInput(draft.regionInput);
    if (parsed === "invalid") return `${text.regionOnly} · ${text.invalidValue}`;
    return parsed == null ? text.notSet : `${text.regionOnly} · ${fmt(parsed, locale)}`;
  }
  const sum = sumFilled(draft.departmentInputs);
  return sum == null ? text.notSet : `${text.byDepartment} · ${fmt(sum, locale)}`;
}

export function buildTargetPayload(args: {
  field: TargetField;
  regions: NormalizedRegion[];
  drafts: Record<string, RegionDraft>;
  originalCentral: number | null;
  centralInput: string;
  /** Language of the change summary and validation messages. Defaults to French. */
  locale?: UiLocale;
}): BuildPayloadResult {
  const locale = args.locale ?? "fr";
  const text = TEXT[locale];
  const errors: string[] = [];
  const entries: TargetPutEntry[] = [];
  const changes: PayloadChange[] = [];

  for (const region of args.regions) {
    const draft = args.drafts[region.regionId] ?? initRegionDraft(region);
    const result = desiredEntries(args.field, region, draft, locale);
    if (result.kind === "error") {
      errors.push(...result.errors);
      continue;
    }
    if (result.kind === "skip") continue;
    entries.push(...result.entries);
    changes.push({
      kind: "region",
      name: region.name,
      from: describeStored(region, locale),
      to: describeDraft(region, draft, locale),
    });
  }

  const centralResult = desiredCentral(args.field, args.originalCentral, args.centralInput, locale);
  if (centralResult.kind === "error") {
    errors.push(...centralResult.errors);
  }

  if (errors.length > 0) return { ok: false, errors };

  const body: TargetPutBody = { entries };
  if (centralResult.kind === "set" || centralResult.kind === "clear") {
    body.central = centralResult.kind === "clear" ? null : { [args.field]: centralResult.value };
    changes.push({
      kind: "central",
      name: text.central,
      from: args.originalCentral == null ? text.notSet : fmt(args.originalCentral, locale),
      to: centralResult.kind === "clear" ? text.notSet : fmt(centralResult.value, locale),
    });
  }

  if (changes.length === 0) {
    return { ok: false, errors: [text.noChanges] };
  }
  return { ok: true, body, changes };
}

type Desired =
  | { kind: "skip" }
  | { kind: "send"; entries: TargetPutEntry[] }
  | { kind: "error"; errors: string[] };

function desiredEntries(field: TargetField, region: NormalizedRegion, draft: RegionDraft, locale: UiLocale): Desired {
  const text = TEXT[locale];
  if (draft.clear) {
    if (region.mode === "UNSET") return { kind: "skip" };
    return { kind: "send", entries: [{ regionId: region.regionId, clear: true }] };
  }
  if (draft.mode == null) return { kind: "skip" };

  if (draft.mode === "REGION") {
    const parsed = parseTargetInput(draft.regionInput);
    if (parsed === "invalid") {
      return { kind: "error", errors: [`${text.region(region.name)}${text.separator}${text.invalidInt}`] };
    }
    if (parsed == null) {
      if (region.mode === "UNSET") return { kind: "skip" };
      return { kind: "send", entries: [{ regionId: region.regionId, clear: true }] };
    }
    const stored = storedRegionEntries(region);
    const desired: TargetPutEntry[] = [{ regionId: region.regionId, departmentId: null, [field]: parsed }];
    if (sameEntries(stored, desired, field)) return { kind: "skip" };
    return { kind: "send", entries: desired };
  }

  const desired: TargetPutEntry[] = [];
  for (const department of region.departments) {
    const parsed = parseTargetInput(draft.departmentInputs[department.departmentId] ?? "");
    if (parsed === "invalid") {
      return {
        kind: "error",
        errors: [`${text.department(department.name, region.name)}${text.separator}${text.invalidInt}`],
      };
    }
    if (parsed == null) continue;
    desired.push({
      regionId: region.regionId,
      departmentId: department.departmentId,
      [field]: parsed,
    });
  }
  if (desired.length === 0) {
    if (region.mode === "UNSET") return { kind: "skip" };
    return { kind: "send", entries: [{ regionId: region.regionId, clear: true }] };
  }
  const stored = storedRegionEntries(region);
  if (sameEntries(stored, desired, field)) return { kind: "skip" };
  return { kind: "send", entries: desired };
}

function storedRegionEntries(region: NormalizedRegion): TargetPutEntry[] {
  if (region.mode === "REGION" && region.target != null) {
    return [{ regionId: region.regionId, departmentId: null, inscriptionTarget: region.target, submissionTarget: region.target }];
  }
  if (region.mode === "DEPARTMENT") {
    return region.departments
      .filter((department) => department.target != null)
      .map((department) => ({
        regionId: region.regionId,
        departmentId: department.departmentId,
        inscriptionTarget: department.target as number,
        submissionTarget: department.target as number,
      }));
  }
  return [];
}

function sameEntries(stored: TargetPutEntry[], desired: TargetPutEntry[], field: TargetField): boolean {
  const key = (entry: TargetPutEntry) => `${entry.departmentId ?? ""}:${entry[field] ?? entry.inscriptionTarget ?? entry.submissionTarget}`;
  const a = stored.map(key).sort();
  const b = desired.map(key).sort();
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

function desiredCentral(
  field: TargetField,
  original: number | null,
  input: string,
  locale: UiLocale,
): { kind: "omit" } | { kind: "clear" } | { kind: "set"; value: number } | { kind: "error"; errors: string[] } {
  const text = TEXT[locale];
  const parsed = parseTargetInput(input);
  if (parsed === "invalid") {
    return { kind: "error", errors: [`${text.central}${text.separator}${text.invalidInt}`] };
  }
  if (parsed == null) {
    if (original == null) return { kind: "omit" };
    return { kind: "clear" };
  }
  if (original === parsed) return { kind: "omit" };
  return { kind: "set", value: parsed };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function fmt(value: number, locale: UiLocale): string {
  return value.toLocaleString(locale === "en" ? "en-GB" : "fr-FR");
}

export function hasUnsavedChanges(args: {
  regions: NormalizedRegion[];
  drafts: Record<string, RegionDraft>;
  originalCentral: number | null;
  centralInput: string;
}): boolean {
  const originalCentralText = args.originalCentral == null ? "" : String(args.originalCentral);
  if (args.centralInput.trim() !== originalCentralText) {
    return true;
  }
  for (const region of args.regions) {
    const draft = args.drafts[region.regionId];
    if (!draft) continue;
    const initial = initRegionDraft(region);
    if (draft.mode !== initial.mode) return true;
    if (draft.regionInput.trim() !== initial.regionInput.trim()) return true;
    for (const [deptId, val] of Object.entries(draft.departmentInputs)) {
      if (val.trim() !== (initial.departmentInputs[deptId] ?? "").trim()) return true;
    }
  }
  return false;
}

