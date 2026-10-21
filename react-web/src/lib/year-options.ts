// The years a year question offers, for the registration form and the
// declaration wizards alike. Picked, not typed: a list cannot hold "20",
// "2O10" or next year. The range is the one validateField
// (onefop-validation.ts) accepts for a year, 1900 to this year.
export const YEAR_OPTIONS_FROM = 1900;

// This year down to YEAR_OPTIONS_FROM, most recent first, as strings (the
// value is stored as the four digits the text field used to take). A value
// outside the range -- a draft typed before the field became a list -- is
// kept as an option, so the select shows it rather than a blank that hides
// an answer still in the data; validation still reports it.
export function yearOptions(current?: unknown, now: Date = new Date()): string[] {
  const years: string[] = [];
  for (let y = now.getFullYear(); y >= YEAR_OPTIONS_FROM; y--) years.push(String(y));
  const kept = current == null ? "" : String(current).trim();
  if (kept && !years.includes(kept)) years.unshift(kept);
  return years;
}
