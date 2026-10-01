import {
  TARGET_MAX,
  type TargetField,
  type TargetMode,
  type TargetPutBody,
  type TargetPutEntry,
  type TargetRegionRow,
} from "./pilotage-targets";

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

const INVALID_INT = "doit être un entier positif ou nul.";

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

export function modeLabel(mode: TargetMode | EditMode | null): string {
  if (mode === "DEPARTMENT") return "Par département";
  if (mode === "REGION") return "Région seule";
  if (mode === "MIXED") return "Mixte";
  return "Non défini";
}

export function describeStored(region: NormalizedRegion): string {
  if (region.mode === "UNSET") return "Non défini";
  if (region.mode === "REGION") {
    return region.target == null ? "Région seule" : `Région seule · ${fmt(region.target)}`;
  }
  if (region.mode === "DEPARTMENT") {
    const filled = region.departments.filter((department) => department.target != null);
    const total = filled.reduce((sum, department) => sum + (department.target ?? 0), 0);
    return filled.length === 0 ? "Par département" : `Par département · ${fmt(total)}`;
  }
  return "Mixte";
}

export function describeDraft(region: NormalizedRegion, draft: RegionDraft): string {
  if (draft.clear) return "Non défini";
  if (draft.mode == null) return modeLabel(region.mode);
  if (draft.mode === "REGION") {
    const parsed = parseTargetInput(draft.regionInput);
    if (parsed === "invalid") return "Région seule · valeur invalide";
    return parsed == null ? "Non défini" : `Région seule · ${fmt(parsed)}`;
  }
  const sum = sumFilled(draft.departmentInputs);
  return sum == null ? "Non défini" : `Par département · ${fmt(sum)}`;
}

export function buildTargetPayload(args: {
  field: TargetField;
  regions: NormalizedRegion[];
  drafts: Record<string, RegionDraft>;
  originalCentral: number | null;
  centralInput: string;
}): BuildPayloadResult {
  const errors: string[] = [];
  const entries: TargetPutEntry[] = [];
  const changes: PayloadChange[] = [];

  for (const region of args.regions) {
    const draft = args.drafts[region.regionId] ?? initRegionDraft(region);
    const result = desiredEntries(args.field, region, draft);
    if (result.kind === "error") {
      errors.push(...result.errors);
      continue;
    }
    if (result.kind === "skip") continue;
    entries.push(...result.entries);
    changes.push({
      kind: "region",
      name: region.name,
      from: describeStored(region),
      to: describeDraft(region, draft),
    });
  }

  const centralResult = desiredCentral(args.field, args.originalCentral, args.centralInput);
  if (centralResult.kind === "error") {
    errors.push(...centralResult.errors);
  }

  if (errors.length > 0) return { ok: false, errors };

  const body: TargetPutBody = { entries };
  if (centralResult.kind === "set" || centralResult.kind === "clear") {
    body.central = centralResult.kind === "clear" ? null : { [args.field]: centralResult.value };
    changes.push({
      kind: "central",
      name: "Niveau central",
      from: args.originalCentral == null ? "Non défini" : fmt(args.originalCentral),
      to: centralResult.kind === "clear" ? "Non défini" : fmt(centralResult.value),
    });
  }

  if (changes.length === 0) {
    return { ok: false, errors: ["Aucune modification à enregistrer."] };
  }
  return { ok: true, body, changes };
}

type Desired =
  | { kind: "skip" }
  | { kind: "send"; entries: TargetPutEntry[] }
  | { kind: "error"; errors: string[] };

function desiredEntries(field: TargetField, region: NormalizedRegion, draft: RegionDraft): Desired {
  if (draft.clear) {
    if (region.mode === "UNSET") return { kind: "skip" };
    return { kind: "send", entries: [{ regionId: region.regionId, clear: true }] };
  }
  if (draft.mode == null) return { kind: "skip" };

  if (draft.mode === "REGION") {
    const parsed = parseTargetInput(draft.regionInput);
    if (parsed === "invalid") {
      return { kind: "error", errors: [`La région « ${region.name} » : ${INVALID_INT}`] };
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
        errors: [`Le département « ${department.name} » (${region.name}) : ${INVALID_INT}`],
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
): { kind: "omit" } | { kind: "clear" } | { kind: "set"; value: number } | { kind: "error"; errors: string[] } {
  const parsed = parseTargetInput(input);
  if (parsed === "invalid") {
    return { kind: "error", errors: [`Niveau central : ${INVALID_INT}`] };
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

function fmt(value: number): string {
  return value.toLocaleString("fr-FR");
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

