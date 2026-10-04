"use client";

// src/hooks/useNavProfile.ts
//
// Reads the signed-in account's navigation profile. See @/lib/nav-profiles
// for the profile model and for why hub visibility lives there rather than in
// each hub's allowedRoles.

import { useMemo } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { navHubsFor, resolveNavProfile, type NavProfile } from "@/lib/nav-profiles";
import type { AdminHub } from "@/app/admin/_routes";

/**
 * The current user's profile, and its hubs resolved against ADMIN_HUBS.
 *
 * Returns EMPTY_NAV_PROFILE (and no hubs) while auth is still loading and for
 * any role outside UserRole, so a sidebar rendered before /auth/me resolves
 * shows nothing rather than a default list.
 *
 * `hubs` is the render-ready form: profile order, each href pointing at the
 * first sub-route the role may open. `profile.hubs` stays available as the
 * declared ids, which is what a test or an audit wants to assert on.
 */
export function useNavProfile(): { profile: NavProfile; hubs: AdminHub[] } {
  const role = useAuthStore((s) => s.user?.role);

  return useMemo(
    () => ({ profile: resolveNavProfile(role), hubs: navHubsFor(role) }),
    [role],
  );
}
