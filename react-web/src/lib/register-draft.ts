// src/lib/register-draft.ts
//
// Draft persistence for the registration wizard, which had none: a refresh or
// an accidental tab close lost every answer. Modelled on use-onefop-draft.ts
// (load on mount, debounced autosave, failure tolerated) but deliberately much
// smaller -- that hook keys an authenticated entity's declaration by quarter in
// IndexedDB, whereas this is one anonymous in-progress form.
//
// STORAGE: sessionStorage, not localStorage. The draft holds the respondent's
// name, email, phone and the establishment's tax number -- personal data,
// entered before any authentication, on what in this deployment is often a
// shared machine. sessionStorage survives the reload and the accidental
// in-tab navigation that this feature exists for, and is gone when the tab
// closes. localStorage would leave that data on disk indefinitely for the next
// person at the same terminal.
//
// THE PASSWORD IS NEVER PERSISTED. toDraft() builds its result field by field
// rather than spreading the wizard state, so a future field added to the state
// cannot reach storage by accident, and register-draft.test.ts asserts the
// serialized payload contains neither password.
import { REGISTRATION_STEP_IDS, type EntityType } from "./register-constants";
import { isSectionComplete, type RegRespondentState, type RegState } from "./register-completeness";

export const REGISTER_DRAFT_KEY = "camleap.register.draft.v1";
export const REGISTER_DRAFT_VERSION = 1;

// Debounce for the autosave, and for revealing the next section after typing.
// Both are "the respondent has paused" delays, so they share one constant.
export const REGISTER_DRAFT_SAVE_DEBOUNCE_MS = 450;

export interface RegisterDraft {
  version: number;
  // The highest revealed section index -- what the wizard calls `reached`.
  // Stored under `step`, the key the draft shape uses.
  step: number;
  entityType: EntityType | null;
  respondent: RegRespondentState;
  entityData: Record<string, string>;
  regionId: string;
  regionName: string;
  departmentId: string;
  departmentName: string;
  subdivisionId: string;
  subdivisionName: string;
  area: string;
  sectorId: string;
  sectorName: string;
}

// The administrative names are stored alongside the ids because submit() sends
// names, and on a restore the region/department/subdivision queries have not
// resolved yet -- without these the payload would be built from empty strings.
export interface RegisterDraftNames {
  regionName: string;
  departmentName: string;
  subdivisionName: string;
  sectorName: string;
}

export function toDraft(state: RegState, reached: number, names: RegisterDraftNames): RegisterDraft {
  return {
    version: REGISTER_DRAFT_VERSION,
    step: reached,
    entityType: state.entityType,
    respondent: {
      firstName: state.respondent.firstName,
      lastName: state.respondent.lastName,
      function: state.respondent.function,
      email: state.respondent.email,
      phone1: state.respondent.phone1,
      phone2: state.respondent.phone2,
    },
    entityData: { ...state.entityData },
    regionId: state.regionId,
    regionName: names.regionName,
    departmentId: state.departmentId,
    departmentName: names.departmentName,
    subdivisionId: state.subdivisionId,
    subdivisionName: names.subdivisionName,
    area: state.area,
    sectorId: state.sectorId,
    sectorName: names.sectorName,
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// Defensive parse: the payload comes back from storage, which another tab, an
// older build or a hand-edited devtools session may have written. Anything
// unrecognised yields null and the wizard simply starts empty.
export function parseDraft(raw: unknown): RegisterDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (d.version !== REGISTER_DRAFT_VERSION) return null;

  const entityType =
    typeof d.entityType === "string" && d.entityType in ENTITY_TYPE_SET
      ? (d.entityType as EntityType)
      : null;

  const respondentRaw = (d.respondent ?? {}) as Record<string, unknown>;
  const entityDataRaw = (d.entityData ?? {}) as Record<string, unknown>;
  const entityData: Record<string, string> = {};
  for (const [key, value] of Object.entries(entityDataRaw)) {
    if (typeof value === "string") entityData[key] = value;
  }

  const lastIndex = REGISTRATION_STEP_IDS.length - 1;
  const step = typeof d.step === "number" && Number.isInteger(d.step) ? clamp(d.step, 0, lastIndex) : 0;

  return {
    version: REGISTER_DRAFT_VERSION,
    step,
    entityType,
    respondent: {
      firstName: asString(respondentRaw.firstName),
      lastName: asString(respondentRaw.lastName),
      function: asString(respondentRaw.function),
      email: asString(respondentRaw.email),
      phone1: asString(respondentRaw.phone1),
      phone2: asString(respondentRaw.phone2),
    },
    entityData,
    regionId: asString(d.regionId),
    regionName: asString(d.regionName),
    departmentId: asString(d.departmentId),
    departmentName: asString(d.departmentName),
    subdivisionId: asString(d.subdivisionId),
    subdivisionName: asString(d.subdivisionName),
    area: asString(d.area),
    sectorId: asString(d.sectorId),
    sectorName: asString(d.sectorName),
  };
}

const ENTITY_TYPE_SET: Record<EntityType, true> = {
  enterprise: true,
  cooperative: true,
  ctd: true,
  ong: true,
  administration: true,
  projectProgram: true,
  vocationalTraining: true,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Where the wizard reopens after a restore.
//
// `savedStep` alone is not enough: the password is never persisted, so the
// security section comes back incomplete, and a draft saved mid-section would
// otherwise reopen with a section revealed that nothing has filled. Taking the
// higher of the saved position and "one past the last complete section" keeps
// the respondent where they were without ever revealing a gap they have not
// reached by their own answers.
export function restoredReached(savedStep: number, state: RegState): number {
  const lastIndex = REGISTRATION_STEP_IDS.length - 1;
  let firstIncomplete = 0;
  while (
    firstIncomplete <= lastIndex &&
    isSectionComplete(REGISTRATION_STEP_IDS[firstIncomplete], state)
  ) {
    firstIncomplete++;
  }
  return clamp(Math.max(savedStep, firstIncomplete - 1), 0, lastIndex);
}

// True once anything has been entered -- what the leave-confirmation guard
// keys on. The password counts: it is not persisted, so leaving the page is
// exactly when it would be lost.
export function draftHasData(state: RegState): boolean {
  if (state.entityType !== null) return true;
  for (const value of Object.values(state.respondent)) {
    if (value.trim()) return true;
  }
  for (const value of Object.values(state.entityData)) {
    if (value.trim()) return true;
  }
  if (state.regionId || state.departmentId || state.subdivisionId) return true;
  if (state.area || state.sectorId) return true;
  return !!state.password || !!state.confirmPassword;
}

// ── storage ──────────────────────────────────────────────────────────────
// Every access is guarded: sessionStorage throws outright in some privacy
// modes, and a draft is a convenience, never a requirement. A failure here
// must not break the form.

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function loadStoredDraft(): RegisterDraft | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(REGISTER_DRAFT_KEY);
    if (!raw) return null;
    return parseDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveStoredDraft(draft: RegisterDraft): void {
  saveStoredDraftJson(JSON.stringify(draft));
}

// The wizard already holds the serialized draft (it is what its autosave
// effect watches for changes), so it writes the string straight through
// rather than keeping a second copy of the object alive just to re-stringify
// it. Both entry points go through the same guarded write.
export function saveStoredDraftJson(json: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(REGISTER_DRAFT_KEY, json);
  } catch {
    // Quota or private-browsing failure: the form carries on unsaved.
  }
}

export function clearStoredDraft(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(REGISTER_DRAFT_KEY);
  } catch {
    // Nothing to do; the draft simply outlives this attempt.
  }
}
