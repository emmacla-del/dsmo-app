// Carries the identifier a respondent has just registered with from the
// registration receipt to the sign-in form, so they do not type it again on
// the next screen.
//
// sessionStorage rather than a ?identifier= query parameter: an email in a
// URL is kept in browser history and server logs and sent on in the Referer
// header. sessionStorage is tab-scoped and gone when the tab closes, which
// is also where the registration draft (register-draft.ts) keeps the same
// email for the same reason.
//
// Read once: takeLoginIdentifier removes the value as it returns it, so a
// later visit to /login in the same tab starts empty.

export const LOGIN_IDENTIFIER_KEY = "cam-leap.login-identifier";

// Every access is guarded: sessionStorage throws outright in some privacy
// modes, and prefilling a field is a convenience, never a requirement.
function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveLoginIdentifier(identifier: string): void {
  const value = identifier.trim();
  if (!value) return;
  const s = storage();
  if (!s) return;
  try {
    s.setItem(LOGIN_IDENTIFIER_KEY, value);
  } catch {
    // Quota or a blocked store: the respondent types it instead.
  }
}

export function takeLoginIdentifier(): string | null {
  const s = storage();
  if (!s) return null;
  try {
    const value = s.getItem(LOGIN_IDENTIFIER_KEY);
    s.removeItem(LOGIN_IDENTIFIER_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}
