"use client";

// Where a public-site action sends this visitor. Logged out, the doors are
// registration and sign-in. Signed in, every one of those doors returns to
// the place they work: the survey for a respondent, the console for staff.

import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import { useIsClient } from "@/lib/use-is-client";
import { ADMIN_ROLES, hasRole } from "@/lib/roles";
import { REGISTER_HREF } from "./site-content";

export function usePortalEntry() {
  const t = useTranslations("site");
  const isClient = useIsClient();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = isClient && status === "authenticated";
  const isAdmin = isAuthenticated && hasRole(user?.role, ADMIN_ROLES);
  const spaceHref = isAdmin ? "/admin/pilotage" : "/home";

  return {
    isAuthenticated,
    isAdmin,
    /** Header and footer: sign in, or the signed-in space. */
    spaceHref: isAuthenticated ? spaceHref : "/login",
    spaceLabel: isAuthenticated ? (isAdmin ? t("adminSpace") : t("mySpace")) : t("signIn"),
    /** The big buttons: register, or go back to work. */
    actionHref: isAuthenticated ? spaceHref : REGISTER_HREF,
    actionLabel: (guestLabel: string) =>
      isAuthenticated ? (isAdmin ? t("returnToConsole") : t("returnToSurvey")) : guestLabel,
  };
}
