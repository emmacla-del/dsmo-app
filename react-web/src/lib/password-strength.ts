// Ported from register_steps.dart's StepSecurity._calcStrength/validator:
// same weights, same 8-char minimum, same 0.35 "too weak" reject threshold.
export function passwordStrength(password: string): number {
  if (!password) return 0;
  let s = 0;
  if (password.length >= 8) s += 0.25;
  if (password.length >= 12) s += 0.15;
  if (/[A-Z]/.test(password)) s += 0.2;
  if (/[0-9]/.test(password)) s += 0.2;
  if (/[!@#$%^&*]/.test(password)) s += 0.2;
  return Math.min(1, Math.max(0, s));
}

// One band, one language. The page resolves the band through the catalogue
// so the meter never prints "Faible/ Weak".
export type PasswordStrengthBand = "weak" | "medium" | "strong" | "veryStrong";

export function passwordStrengthBand(score: number): PasswordStrengthBand {
  if (score < 0.35) return "weak";
  if (score < 0.65) return "medium";
  if (score < 0.9) return "strong";
  return "veryStrong";
}

// A code, not a sentence: the page owns the wording, in the active language.
export type PasswordValidationCode = "required" | "tooShort" | "tooWeak";

export function validatePassword(password: string): PasswordValidationCode | null {
  if (!password) return "required";
  if (password.length < 8) return "tooShort";
  if (passwordStrength(password) < 0.35) return "tooWeak";
  return null;
}

// The four requirements the score above is built from, exposed so the security
// section can show which ones are already met instead of printing one static
// sentence of criteria.
//
// The predicates are deliberately kept next to passwordStrength rather than
// factored out of it: passwordStrength is a direct port of the Dart
// implementation and is not being rewritten here. register-completeness.test.ts
// asserts the two agree, which is what guards against them drifting apart.
export const PASSWORD_RULE_IDS = ["length", "uppercase", "digit", "special"] as const;

export type PasswordRuleId = (typeof PASSWORD_RULE_IDS)[number];

export function passwordRuleChecks(password: string): Record<PasswordRuleId, boolean> {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[!@#$%^&*]/.test(password),
  };
}
