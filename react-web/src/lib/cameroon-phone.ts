/**
 * Cameroonian phone numbers as the declaration wizards accept them: nine
 * digits, starting with 2 (fixed line) or 6 (mobile) — the rule in
 * onefop-validation.ts. Registration used to store whatever was typed, so a
 * number like "45675456" reached the company record and was then refused by
 * the wizard it pre-fills.
 *
 * Typing is tolerated: spaces, dots, dashes and a +237 / 00237 / 237 country
 * prefix are removed before checking; the normalized nine digits are what
 * gets stored.
 */
export function normalizeCameroonPhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/[\s.\-()]/g, "").replace(/^\+/, "");
  if (/^00237\d{9}$/.test(digits)) return digits.slice(5);
  if (/^237\d{9}$/.test(digits)) return digits.slice(3);
  return digits;
}

export function isValidCameroonPhone(raw: string | null | undefined): boolean {
  return /^[26]\d{8}$/.test(normalizeCameroonPhone(raw));
}
