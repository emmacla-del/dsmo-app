"use client";

import { useEffect, useState } from "react";
import { checkEmailAvailable } from "@/lib/api-client";

/**
 * Debounced GET /auth/check-email for a form's email field — the same 400 ms
 * check the public registration wizard runs.
 *
 * Returns true / false only for the address currently typed: a result that
 * arrives for an earlier keystroke is ignored, so a stale "available" cannot
 * let a just-changed address through. null means unknown (empty, no "@",
 * pending, request failed, or the address is `ownEmail`). Callers block on
 * false only; the server's 409 remains the authority.
 *
 * `ownEmail` is the account's current address (correction form): keeping it
 * is not a conflict, so it is never checked.
 */
export function useEmailAvailability(email: string, ownEmail?: string | null): boolean | null {
  const key = email.trim().toLowerCase();
  const own = ownEmail?.trim().toLowerCase() || null;
  const [result, setResult] = useState<{ key: string; available: boolean } | null>(null);

  useEffect(() => {
    if (!key || !key.includes("@") || key === own) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      checkEmailAvailable(key)
        .then((r) => {
          if (!cancelled) setResult({ key, available: r.available });
        })
        .catch(() => {
          if (!cancelled) setResult(null);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [key, own]);

  if (!key || key === own || !result || result.key !== key) return null;
  return result.available;
}
