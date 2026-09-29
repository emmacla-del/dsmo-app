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

export function passwordStrengthLabel(s: number): string {
  if (s < 0.35) return "Faible/ Weak";
  if (s < 0.65) return "Moyen/ Medium";
  if (s < 0.9) return "Fort/ Strong";
  return "Très fort/ Very strong";
}

export function validatePassword(password: string): string | null {
  if (!password) return "Mot de passe requis/ Password required";
  if (password.length < 8) return "8 caractères minimum/ Minimum 8 characters";
  if (passwordStrength(password) < 0.35) return "Mot de passe trop faible/ Password too weak";
  return null;
}
