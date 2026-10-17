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
import { RESPONDENT_FUNCTION_OTHER } from "./register-options";
import { isValidCameroonPhone } from "./cameroon-phone";

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
//   empty   -- the request settled and genuinely returned nothing. NOT
//              complete: the server refuses a registration without an
//              arrondissement (register-company.dto.ts), so letting the
//              respondent past only moved the dead end to Submit. The row
//              says so and points to support instead.
//   ready   -- options are available, so a subdivision must actually be picked
// A deliberately loose shape check -- something@something.tld, no spaces.
// The server's own validation stays authoritative; this only stops an
// address that cannot be delivered to from passing the step it is typed in.
export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// An answer that is given but in the wrong shape keeps its section
// unfinished, the same as an empty one: otherwise the section would show as
// done and the respondent would only learn about the typo at submission,
// several steps later. The wizard explains it (see formatFailure in
// register/page.tsx); nothing here produces a message.
function invalidPhone(value: string | undefined): boolean {
  return filled(value) && !isValidCameroonPhone(value);
}

export type SubdivisionsStatus = "idle" | "loading" | "error" | "empty" | "ready";

export interface RegRespondentState {
  firstName: string;
  lastName: string;
  function: string;
  // The real job, required only when `function` is RESPONDENT_FUNCTION_OTHER.
  // The payload sends this text in place of the word "Autre".
  functionOther: string;
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
  if (r.function === RESPONDENT_FUNCTION_OTHER && !filled(r.functionOther)) return false;
  if (!filled(r.email) || !filled(r.phone1)) return false;
  if (!isPlausibleEmail(r.email)) return false;
  // phone2 is optional by design: only a wrong number gates the section.
  if (invalidPhone(r.phone1) || invalidPhone(r.phone2)) return false;
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
  // Every phone on screen, required or not, must be a number the
  // declaration wizards accept.
  for (const field of fields) {
    if (field.kind !== "tel") continue;
    if (!isFieldVisible(field, state.entityData, fields)) continue;
    if (invalidPhone(state.entityData[field.key])) return false;
  }
  return true;
}

export function isLocationComplete(state: RegState): boolean {
  if (!filled(state.regionId) || !filled(state.departmentId)) return false;
  // area (urbain/rural) reaches the payload and has always been required by
  // the step's own validation; it stays required here.
  if (!filled(state.area)) return false;
  return filled(state.subdivisionId);
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
      // A section with no required fields of its own is NOT complete. Review
      // declares nothing: returning true for it made the progress header show
      // a done checkmark against "Recapitulatif" the moment it was revealed,
      // claiming the registration was finished while it was still unsent.
      // What completes review is submitting, which is not a field state.
      return false;
  }
}

// Whether a section opens the next one the instant it becomes complete.
//
// A section whose every field is required is finished the moment it is
// complete -- there is nothing further the respondent might add -- so the
// wizard can move straight on. A section with optional fields cannot: moving
// on the moment it became valid would pull the second phone number or the
// CNPS number out from under someone who was about to fill them. Those wait
// until the respondent has changed the section's LAST field, or followed the
// "continue" link the section offers once its required fields are satisfied.
//
// Renamed from collapsesOnReveal: nothing collapses any more (the frame shows
// one section at a time instead of a column of cards), but the question the
// function answers -- "has this section any optional field worth waiting
// for?" -- and its answers are unchanged.
export function advancesImmediately(
  step: RegistrationStepId,
  entityType: EntityType | null
): boolean {
  switch (step) {
    case "entityType":
      // One radio list, but it waits for Continuer like every other step
      // (owner, 2026-10-17). Moving on at the pick turned the Continuer
      // press respondents make out of habit into a press on step 2, which
      // then reported all its fields missing before anything was typed
      // (defect 19).
      return false;
    case "respondent":
      // phone2 is optional.
      return false;
    case "entityInfo":
      // Read from the type's own field set rather than assumed: every type
      // declared today has optional fields, but that is data, not a rule.
      return entityType
        ? !ENTITY_CONFIGS[entityType].fields.some((f) => !f.required)
        : false;
    case "location":
      // The activity sector is optional.
      return false;
    case "security":
      // Both fields are required, and there is nothing optional to wait for,
      // but the step still waits for Continuer. Confirming a password must
      // not turn the page by itself.
      return false;
    case "review":
      // The last section: there is nothing to advance to.
      return false;
  }
}
