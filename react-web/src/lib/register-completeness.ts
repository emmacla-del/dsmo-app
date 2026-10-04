// src/lib/register-completeness.ts
//
// Pure per-section completeness for the registration wizard.
//
// This is deliberately NOT a validator. The wizard uses it to decide when a
// section is finished -- to enable the primary action, and (from the
// progressive-disclosure commit onwards) to reveal the next section -- which
// means it runs on every keystroke. A validator's job is to explain what is
// wrong; running one on every keystroke would paint an error under a field the
// respondent has not finished typing yet. So nothing here produces a message,
// and nothing here calls validatePassword(): the submit path still owns
// validation and its wording.
//
// Every input arrives through RegState, an immutable snapshot of the host's
// useState values. Keeping the signature pure is what makes the reveal rules
// unit-testable without a DOM.
import { ENTITY_CONFIGS, isFieldVisible, type EntityType, type RegistrationStepId } from "./register-constants";
import { passwordStrength } from "./password-strength";

// The 0.35 floor is passwordStrength's own "too weak" threshold, shared with
// validatePassword so the gate and the submit-time rejection cannot disagree.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MIN_STRENGTH = 0.35;

// The subdivision dropdown is populated from the selected department. Its
// four states are tracked explicitly because "no subdivision selected" and
// "this department has no subdivisions to select" must not be confused:
//
//   idle    -- no department chosen yet, so nothing has been requested
//   loading -- request in flight; the section is NOT complete yet, otherwise
//              the next section would flash open and closed again
//   error   -- the request failed. NOT complete: the options may well exist,
//              we just could not fetch them, and letting the respondent past
//              here only moves the failure to submit(), which requires a
//              subdivision name. The row surfaces a retry instead.
//   empty   -- the request settled and genuinely returned nothing. Treated as
//              complete: requiring a value the server cannot offer would
//              strand the respondent with no way forward.
//   ready   -- options are available, so a subdivision must actually be picked
export type SubdivisionsStatus = "idle" | "loading" | "error" | "empty" | "ready";

export interface RegRespondentState {
  firstName: string;
  lastName: string;
  function: string;
  email: string;
  phone1: string;
  phone2: string;
}

export interface RegState {
  entityType: EntityType | null;
  respondent: RegRespondentState;
  // null means "not checked / check failed" and never blocks; only an
  // explicit false (address already registered) does.
  emailAvailable: boolean | null;
  entityData: Record<string, string>;
  regionId: string;
  departmentId: string;
  subdivisionId: string;
  subdivisionsStatus: SubdivisionsStatus;
  area: string;
  sectorId: string;
  password: string;
  confirmPassword: string;
}

function filled(value: string | undefined): boolean {
  return !!value && value.trim().length > 0;
}

export function isEntityTypeComplete(state: RegState): boolean {
  return state.entityType !== null;
}

export function isRespondentComplete(state: RegState): boolean {
  const r = state.respondent;
  if (!filled(r.firstName) || !filled(r.lastName) || !filled(r.function)) return false;
  if (!filled(r.email) || !filled(r.phone1)) return false;
  // phone2 is optional by design and must never gate the section.
  return state.emailAvailable !== false;
}

export function isEntityInfoComplete(state: RegState): boolean {
  if (!state.entityType) return false;
  const fields = ENTITY_CONFIGS[state.entityType].fields;
  for (const field of fields) {
    if (!field.required) continue;
    // A required field whose gate is closed is not on screen, so it cannot be
    // answered and must not block -- the same rule submit() applies through
    // visibleEntityDataForType.
    if (!isFieldVisible(field, state.entityData, fields)) continue;
    if (!filled(state.entityData[field.key])) return false;
  }
  return true;
}

export function isLocationComplete(state: RegState): boolean {
  if (!filled(state.regionId) || !filled(state.departmentId)) return false;
  // area (urbain/rural) reaches the payload and has always been required by
  // the step's own validation; it stays required here.
  if (!filled(state.area)) return false;
  if (filled(state.subdivisionId)) return true;
  return state.subdivisionsStatus === "empty";
}

export function isSecurityComplete(state: RegState): boolean {
  if (state.password.length < PASSWORD_MIN_LENGTH) return false;
  if (passwordStrength(state.password) < PASSWORD_MIN_STRENGTH) return false;
  return state.password === state.confirmPassword;
}

export function isSectionComplete(step: RegistrationStepId, state: RegState): boolean {
  switch (step) {
    case "entityType":
      return isEntityTypeComplete(state);
    case "respondent":
      return isRespondentComplete(state);
    case "entityInfo":
      return isEntityInfoComplete(state);
    case "location":
      return isLocationComplete(state);
    case "security":
      return isSecurityComplete(state);
    case "review":
      // The review section has nothing of its own to complete; the
      // certification checkbox is what gates submission.
      return true;
  }
}
