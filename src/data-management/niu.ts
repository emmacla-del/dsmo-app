// src/data-management/niu.ts

/**
 * Company.taxNumber is NOT NULL @unique, so registration gives entities
 * without a taxpayer number (Administration, Projet/Programme) a synthetic
 * `NA-<uuid>` placeholder (see AuthService). That placeholder is not a NIU
 * and must never reach an export as one. Mirrors hasRealNiu in
 * react-web/src/lib/companies-directory.ts.
 */
export function hasRealNiu(value: string | null | undefined): boolean {
  return !!value && !value.startsWith('NA-');
}
