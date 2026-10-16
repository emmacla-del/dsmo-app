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
      'Any roster export must be separate, explicitly labelled, and subject to data-protection review. ' +
      'That export is spss/vt-roster-export.ts (POST /data-management/export/vt-roster/*): ' +
      'SUPER_ADMIN and ADMIN_ONEFOP only, every download recorded; review signed off by the owner on 2026-10-15 ' +
      '(constitution §21).',
    affectedData:
      's8q8_row1_lastName … s8q8_row14_professionalDiploma (7 cells × 14 rows = 98 PII cell IDs)',
  },
  VT1_15_NAME: {
    reason: 'PII — Respondent name (last name, first name)',
    policy: 'Decision 2 (Option B, 2026-10-16): Moved to restricted contact file alongside 8.8.',
    affectedData: 'VT1_15_NAME',
  },
  VT1_15_TEL1: {
    reason: 'PII — Respondent primary phone number',
    policy: 'Decision 2 (Option B, 2026-10-16): Moved to restricted contact file alongside 8.8.',
    affectedData: 'VT1_15_TEL1',
  },
  VT1_15_EMAIL: {
    reason: 'PII — Respondent email address',
    policy: 'Decision 2 (Option B, 2026-10-16): Moved to restricted contact file alongside 8.8.',
    affectedData: 'VT1_15_EMAIL',
  },
  VT1_16_NAME: {
    reason: 'PII — Promoter/Director name',
    policy: 'Decision 2 (Option B, 2026-10-16): Moved to restricted contact file alongside 8.8.',
    affectedData: 'VT1_16_NAME',
  },
  VT1_16_TEL1: {
    reason: 'PII — Promoter/Director primary phone number',
    policy: 'Decision 2 (Option B, 2026-10-16): Moved to restricted contact file alongside 8.8.',
    affectedData: 'VT1_16_TEL1',
  },
  VT1_16_EMAIL: {
    reason: 'PII — Promoter/Director email address',
    policy: 'Decision 2 (Option B, 2026-10-16): Moved to restricted contact file alongside 8.8.',
    affectedData: 'VT1_16_EMAIL',
  },
  VT2_12: {
    reason: 'PII — Centre contact email address',
    policy: 'Decision 2 (Option B, 2026-10-16): Moved to restricted contact file alongside 8.8.',
    affectedData: 'VT2_12',
  },
};

export const CANONICAL_PII_EXCLUSIONS = new Set<string>(
  Object.keys(CANONICAL_PII_EXCLUSION_DEFINITIONS),
);
