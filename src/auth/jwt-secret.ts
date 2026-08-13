// src/auth/jwt-secret.ts
//
// Single source of truth for the JWT signing secret. Previously
// auth.module.ts fell back to the literal string
// 'your-secret-key-change-in-production' whenever JWT_SECRET was unset,
// while jwt.strategy.ts read process.env.JWT_SECRET! with no fallback and
// no check — so a misconfigured environment would silently sign tokens
// with a secret that's public in source control (full token forgery), and
// the two could in principle diverge. Failing fast at startup is safer than
// either.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is not set. Refusing to start with a ' +
        'guessable fallback secret — set JWT_SECRET in the environment before ' +
        'starting the server.',
    );
  }
  return secret;
}
