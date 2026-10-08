/**
 * Canonical PII and privacy exclusions for analytical exports.
 *
 * Fields registered here are excluded from all default analytical registries
 * (SPSS, CSV, and export manifests) to prevent exposure of personally
 * identifiable information in anonymized research datasets.
 */

export interface CanonicalPiiExclusion {
  reason: string;
  policy: string;
  affectedData: string;
}

export const CANONICAL_PII_EXCLUSION_DEFINITIONS: Record<string, CanonicalPiiExclusion> = {
  VT8_8: {
    reason:
      'PII — Individual trainer roster contains named persons (last name, first name, birth date, qualifications)',
    policy:
      'Design specification §9: Trainer roster is excluded from the default anonymous statistical export. ' +
      'Any roster export must be separate, explicitly labelled, and subject to data-protection review.',
    affectedData:
      's8q8_row1_lastName … s8q8_row14_professionalDiploma (7 cells × 14 rows = 98 PII cell IDs)',
  },
};

export const CANONICAL_PII_EXCLUSIONS = new Set<string>(
  Object.keys(CANONICAL_PII_EXCLUSION_DEFINITIONS),
);
