// What the registration review panel offers, from the claim and the four
// verifications. Kept out of the page so the two rules below are tested.

export interface RegistrationDecisionInput {
  /** The signed-in officer's id. */
  userId: string | null | undefined;
  /** Who holds the file now, or null when nobody does. */
  assigneeId: string | null | undefined;
  /** A value the ID needs is missing (entity type, arrondissement). */
  dataBlocked: boolean;
  /** At least one verification row is marked non-compliant. */
  anyRejected: boolean;
  /** At least one verification row has no value recorded by the declarant. */
  anyEmpty: boolean;
}

export interface RegistrationDecisionModel {
  /**
   * The officer may decide: only while holding the claim, as in the dossier
   * workspace (owner, 2026-11-08, second decision: « same rule as
   * declarations »). A free file is claimed first; a file another officer
   * holds is taken over first. The server already refuses a decision on a
   * file another officer holds.
   */
  canDecide: boolean;
  /**
   * « Demander des compléments » is the main action: the file cannot be
   * approved as it stands (spec §4C, as in the dossier workspace). Rows not
   * yet checked do not count: the reviewer's next step is to finish them,
   * and Approuver stays first.
   */
  complementsFirst: boolean;
}

export function registrationDecisionModel(input: RegistrationDecisionInput): RegistrationDecisionModel {
  return {
    canDecide: !!input.userId && input.assigneeId === input.userId,
    complementsFirst: input.dataBlocked || input.anyRejected || input.anyEmpty,
  };
}
