// src/lib/register-required.ts
//
// Which fields a section still needs, by name and by DOM id.
//
// Two different questions are answered from one place here, and keeping them
// together is the point:
//
//   isSectionComplete() (register-completeness.ts) answers "may the next
//   section open?" with a boolean. It has always counted required, visible
//   fields only -- phone2, the CNPS number and the activity sector were never
//   part of it.
//
//   missingRequiredFields() answers "and WHICH ones are missing?", for the
//   prompt that fires when the respondent tries to leave a section early. If
//   these two disagreed, the flow would either refuse to advance while naming
//   nothing, or name a field that was not actually blocking. They are derived
//   from the same rules, and the unit tests assert they agree for every entity
//   type.
//
// Nothing here renders, translates or touches the DOM: names arrive through
// the resolvers the caller passes in, so the whole module is testable without
// a browser and without the message catalogue.
import {
  ENTITY_CONFIGS,
  isFieldVisible,
  type EntityField,
  type EntityType,
  type RegistrationStepId,
} from "./register-constants";
import type { RegState } from "./register-completeness";
import { lastEntityFieldKey } from "./register-entity-sections";

export interface RequiredFieldRef {
  // The control's DOM id. Doubles as the key the "which fields have been
  // flagged" set is keyed by, because it is already unique across sections.
  id: string;
  // What the respondent should be told is missing. Already resolved.
  name: string;
  filled: boolean;
}

// Resolvers the caller supplies. `t` takes a full next-intl key; `entityLabel`
// turns an entity field into its display name, which is the one name that
// comes from the questionnaire's own field set rather than from the catalogue.
export interface NameResolvers {
  t: (key: string) => string;
  entityLabel: (field: EntityField) => string;
}

function ref(id: string, name: string, value: string | undefined): RequiredFieldRef {
  return { id, name, filled: !!value && value.trim().length > 0 };
}

// The structure type is not a text box, so it does not go through ref(): its
// "value" is a selection, and its control is a radio group rather than one
// element with an id. The id below names the group's wrapper; the caller
// falls back to focusing the first radio.
function entityTypeRef(state: RegState, t: NameResolvers["t"]): RequiredFieldRef {
  return {
    id: "reg-entity-type",
    name: t("registerPage.stepEntityType"),
    filled: state.entityType !== null,
  };
}

// The DOM id of the field a section ends on.
//
// This is the field whose change arms auto-advance and whose blur or Enter
// fires the missing-fields prompt: "the respondent has reached the bottom of
// this section" is one event, so it has one definition. For section 3 it is
// data-driven -- entityFieldGroups owns the render order, so the last field
// here is by construction the last one on screen.
export function lastFieldId(
  step: RegistrationStepId,
  entityType: EntityType | null,
  entityData: Record<string, string>
): string | null {
  switch (step) {
    case "entityType":
      // A radio list has no "last field" to leave: the section is finished by
      // choosing, and the only way to be missing something here is to have
      // chosen nothing. Continuer and the rail cover that.
      return null;
    case "respondent":
      return "reg-phone2";
    case "entityInfo": {
      if (!entityType) return null;
      const key = lastEntityFieldKey(entityType, entityData);
      return key ? `reg-entity-${key}` : null;
    }
    case "location":
      return "reg-sector";
    case "security":
      return "reg-confirm-password";
    case "review":
      return null;
  }
}

// Every required, VISIBLE field of a section, in the order it is rendered,
// each with whether it is answered.
//
// Visible matters: vocationalTraining's nonFunctionalReason is required but
// only exists once the centre is declared non-functional, and demanding a
// field that is not on screen is how a respondent gets stuck with no way to
// satisfy the form. Same rule submit() applies through
// visibleEntityDataForType.
export function requiredFieldsFor(
  step: RegistrationStepId,
  state: RegState,
  resolvers: NameResolvers
): RequiredFieldRef[] {
  const { t, entityLabel } = resolvers;

  switch (step) {
    case "entityType":
      return [entityTypeRef(state, t)];

    case "respondent": {
      const r = state.respondent;
      return [
        ref("reg-first-name", t("registerPage.firstNameLabel"), r.firstName),
        ref("reg-last-name", t("registerPage.lastNameLabel"), r.lastName),
        ref("reg-function", t("registerPage.functionLabel"), r.function),
        ref("reg-email", t("registerPage.professionalEmailLabel"), r.email),
        ref("reg-phone1", t("registerPage.phone1Label"), r.phone1),
        // phone2 is absent by design, and that absence is the whole point of
        // this module.
      ];
    }

    case "entityInfo": {
      // With no type chosen there is no field set, so section 3 is incomplete
      // and what is missing is the TYPE. Returning [] here instead would have
      // made isSectionComplete say "no" while this said "nothing is wrong",
      // and the prompt would have refused to advance while naming nothing.
      // Unreachable through the UI today -- section 3 is only revealed once
      // section 1 is answered -- but the two predicates have to agree on
      // every state, not only the reachable ones.
      if (!state.entityType) return [entityTypeRef(state, t)];
      const fields = ENTITY_CONFIGS[state.entityType].fields;
      return fields
        .filter((f) => f.required && isFieldVisible(f, state.entityData, fields))
        .map((f) => ref(`reg-entity-${f.key}`, entityLabel(f), state.entityData[f.key]));
    }

    case "location": {
      const rows = [
        ref("reg-region", t("registerPage.regionLabel"), state.regionId),
        ref("reg-department", t("registerPage.departmentLabel"), state.departmentId),
      ];
      // An arrondissement cannot be required of a department the server has
      // none for -- see SubdivisionsStatus.
      if (state.subdivisionsStatus !== "empty") {
        rows.push(
          ref("reg-subdivision", t("registerPage.subdivisionLabel"), state.subdivisionId)
        );
      }
      rows.push(ref("reg-area", t("registerPage.areaLabel"), state.area));
      return rows;
    }

    case "security":
      // Emptiness only. A password that is present but too weak, or a
      // confirmation that does not match, is not a MISSING field -- those are
      // the submit validator's messages and its wording, and saying "Champ
      // obligatoire" under a filled box would be wrong.
      return [
        ref("reg-password", t("registerPage.passwordLabel"), state.password),
        ref(
          "reg-confirm-password",
          t("registerPage.confirmPasswordLabel"),
          state.confirmPassword
        ),
      ];

    case "review":
      // Review declares nothing of its own; what it needs is the certification
      // checkbox, which gates the submit button directly.
      return [];
  }
}

export function missingRequiredFields(
  step: RegistrationStepId,
  state: RegState,
  resolvers: NameResolvers
): RequiredFieldRef[] {
  return requiredFieldsFor(step, state, resolvers).filter((f) => !f.filled);
}

// The missing fields worth NAMING to the respondent: missingRequiredFields
// minus every cascade field whose parent is itself still unanswered.
//
// A department cannot be chosen before a region -- its select is disabled
// and says "Choisir la région d'abord" -- so reporting it as missing next to
// the region asks for something the respondent cannot do yet, and turns one
// gap into three. Naming the region covers it. Completeness is NOT affected:
// isSectionComplete and missingRequiredFields still count the department, so
// the section does not open early; only the prompt says less.
export function missingFieldsToReport(
  step: RegistrationStepId,
  state: RegState,
  resolvers: NameResolvers
): RequiredFieldRef[] {
  const missing = missingRequiredFields(step, state, resolvers);
  if (step !== "location") return missing;
  return missing.filter(
    (f) =>
      !(f.id === "reg-department" && !state.regionId) &&
      !(f.id === "reg-subdivision" && !state.departmentId)
  );
}
