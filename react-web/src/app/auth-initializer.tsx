"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";

// Mirrors AuthNotifier's constructor calling _tryRestore() at app boot:
// runs once, resolves the stored token (if any) against /auth/me before
// any screen makes an auth decision.
export function AuthInitializer() {
  const restore = useAuthStore((s) => s.restore);

  useEffect(() => {
    restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
