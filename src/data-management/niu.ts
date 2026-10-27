// src/data-management/niu.ts

/**
 * Legacy Company rows may contain a synthetic `NA-<uuid>` placeholder. New
 * registrations store a missing NIU as null. Either way, a placeholder is
 * not a NIU and must never reach an export as one. Mirrors hasRealNiu in
 * react-web/src/lib/companies-directory.ts.
 */
export function hasRealNiu(value: unknown): value is string {
  // Not a string (a number from an older payload, an object) is no NIU.
  return typeof value === 'string' && value !== '' && !value.startsWith('NA-');
}

/**
 * Resolves the taxpayer number (NIU) for an export row: falls back to the
 * company NIU when submission.taxNumber is empty, ignoring synthetic NA-<uuid>
 * placeholders. Shared by canonical dataset export and Excel export (Defect 6).
 */
export function resolveTaxNumber(submission: any): string | null | undefined {
  if (!submission) return undefined;
  const companyNiu = submission.company?.taxNumber;
  const subNiu = submission.taxNumber;
  if (hasRealNiu(companyNiu)) return companyNiu;
  if (hasRealNiu(subNiu)) return subNiu;
  if (companyNiu !== undefined || subNiu !== undefined) return null;
  return undefined;
}
