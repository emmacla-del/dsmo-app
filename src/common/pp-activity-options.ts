/**
 * Projects & Programs — the coded columns of Section 2's activities table
 * (PP_S2_ACTIVITIES): « Population cible », « Nature de l'appui » and
 * « Rayon d'action ».
 *
 * This table is an AstFieldType.repeatingTable, the one shape the schema
 * compiler never emits, so these options are in no generated artifact. Their
 * source of truth is `kActivitiesTableFields` in
 * lib/core/focus/renderers/activities_table.dart, mirrored for the browser in
 * react-web/src/lib/onefop-activities.ts and here for the server. A change to
 * the Dart list has to be carried to both mirrors by hand.
 *
 * The codes are what the respondent's answer is stored as, in the rawData
 * cells (s2_row<n>_targetPopulation …) and in ProjectProgramActivity's
 * targetPopulation / supportType / scope columns. Two readers use these
 * labels: the official PDF, which prints « code — label », and the SPSS
 * dictionary, whose VALUE LABELS are keyed by the stored code (dataset v12 —
 * before it these three columns were exported as bare "1".."6" with no
 * dictionary entry at all).
 */
export type PpActivityLabelMap = Record<string, string>;

export const PP_TARGET_POPULATION_LABELS_FR: PpActivityLabelMap = {
  '1': 'Jeune non diplômé',
  '2': 'Jeune diplômé',
  '3': 'Femme',
  '4': 'Monde rural',
  '5': 'Population urbaine',
  '6': 'Autre',
};

export const PP_TARGET_POPULATION_LABELS_EN: PpActivityLabelMap = {
  '1': 'Non-graduate youth',
  '2': 'Graduate youth',
  '3': 'Women',
  '4': 'Rural',
  '5': 'Urban population',
  '6': 'Other',
};

export const PP_SUPPORT_TYPE_LABELS_FR: PpActivityLabelMap = {
  '1': 'Gratuit',
  '2': 'Tarifé',
  '3': 'Aide financière remboursable',
  '4': 'Aide financière non remboursable',
  '5': 'Autre',
};

export const PP_SUPPORT_TYPE_LABELS_EN: PpActivityLabelMap = {
  '1': 'Free',
  '2': 'Fee-based',
  '3': 'Reimbursable financial assistance',
  '4': 'Non-reimbursable financial assistance',
  '5': 'Other',
};

export const PP_SCOPE_LABELS_FR: PpActivityLabelMap = {
  '1': 'National',
  '2': 'Régional',
  '3': 'Local',
  '4': 'Autre',
};

export const PP_SCOPE_LABELS_EN: PpActivityLabelMap = {
  '1': 'National',
  '2': 'Regional',
  '3': 'Local',
  '4': 'Other',
};

/**
 * The dictionary entry for each coded activity column, by the suffix the
 * exported variable carries (PP_S2_ACT_01_TARGET …). French labels, the
 * convention every other variable's VALUE LABELS follow (see
 * extractValueLabels). A column with no entry here — DESC, DATE, DUR — is
 * free text and takes no labels.
 */
export const PP_ACTIVITY_VALUE_LABELS: Record<string, PpActivityLabelMap> = {
  TARGET: PP_TARGET_POPULATION_LABELS_FR,
  SUPPORT: PP_SUPPORT_TYPE_LABELS_FR,
  SCOPE: PP_SCOPE_LABELS_FR,
};
