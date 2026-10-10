"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { getActiveHub, type AdminHub } from "@/app/admin/_routes";
import type { UserRole } from "@/lib/user-types";
import { useAuthStore } from "@/lib/auth-store";
import { useNavProfile } from "@/hooks/useNavProfile";
import { navHubsFor } from "@/lib/nav-profiles";

export interface AdminSidebarProps {
  user?: {
    displayName: string;
    roleLabel: string;
    initials: string;
  };
  /**
   * Current user's role key. Optional override: when omitted the rail renders
   * the signed-in account's profile from the auth store (useNavProfile). Pass
   * it to render another role's rail — the layout does, from the same store.
   *
   * The hubs shown are that role's entry in NAV_PROFILES (@/lib/nav-profiles),
   * not ADMIN_HUBS filtered by allowedRoles; see that file for why.
   */
  role?: UserRole;
  /** Badge count on "Supervision" (dossiers awaiting a visa) */
  pendingCount?: number;
  /** Badge count on "Déclarants" */
  inscriptionsCount?: number;
  /** Badge count on "Contrôle Qualité" */
  anomaliesCount?: number;
  onLogout?: () => void;
}

// ── Hub Icons ────────────────────────────────────────────────────────────────

function HubIcon({ name }: { name: AdminHub["iconName"] }) {
  switch (name) {
    case "dashboard":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      );
    case "collecte":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case "declarants":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "quality":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "data":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    case "settings":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
  }
}

// ── Badge pill ────────────────────────────────────────────────────────────────

function Badge({ count }: { count: number }) {
  const t = useTranslations("adminSidebar");
  if (count <= 0) return null;
  return (
    <span className="cam-admin-rail-badge" aria-label={t("badgeAriaLabel", { count })}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ── AdminSidebar ──────────────────────────────────────────────────────────────

export function AdminSidebar({
  user,
  role,
  pendingCount = 0,
  inscriptionsCount = 0,
  anomaliesCount = 0,
  onLogout,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const authLogout = useAuthStore((s) => s.logout);
  const t = useTranslations("adminSidebar");
  const tNav = useTranslations("adminNav");

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      authLogout();
      router.push("/login");
    }
  };

  // The signed-in account's profile, unless a role was passed explicitly.
  // Either way the hubs come from NAV_PROFILES, each href already pointing at
  // the first sub-route that role may open.
  const { hubs: ownHubs } = useNavProfile();
  const visibleHubs = useMemo(() => (role ? navHubsFor(role) : ownHubs), [role, ownHubs]);

  const activeHub = getActiveHub(pathname, searchParams);

  function getBadgeCount(badgeKey?: AdminHub["badgeKey"]): number {
    if (badgeKey === "pending") return pendingCount;
    if (badgeKey === "inscriptions") return inscriptionsCount;
    if (badgeKey === "anomalies") return anomaliesCount;
    return 0;
  }

  return (
    <aside id="cam-admin-rail" className="cam-admin-rail" aria-label={t("navAriaLabel")}>
      {/* ── Brand ── */}
      <div className="cam-admin-rail-brand">
        <div className="cam-admin-rail-brand-name">ONEFOP</div>
        <div className="cam-admin-rail-brand-sub">{t("brandSubtitle")}</div>
      </div>

      {/* ── 6 Primary Navigation Hubs ── */}
      <nav className="cam-admin-rail-nav">
        {visibleHubs.map((hub) => {
          const isActive = activeHub?.key === hub.key;
          const badgeCount = getBadgeCount(hub.badgeKey);

          return (
            <Link
              key={hub.key}
              href={hub.href}
              className="cam-admin-rail-hub"
              aria-current={isActive ? "page" : undefined}
            >
              <span className="cam-admin-rail-hub-icon" aria-hidden="true">
                <HubIcon name={hub.iconName} />
              </span>

              <span className="cam-admin-rail-hub-label">{tNav(`hubs.${hub.key}`)}</span>

              {badgeCount > 0 && <Badge count={badgeCount} />}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer: user card ── */}
      <div className="cam-admin-rail-account">
        {user && (
          <div className="cam-admin-rail-user">
            <div className="cam-admin-rail-user-id">
              <div className="cam-admin-rail-avatar" aria-hidden="true">{user.initials}</div>
              <div className="cam-admin-rail-user-text">
                <div className="cam-admin-rail-user-name">{user.displayName}</div>
                <div className="cam-admin-rail-user-role">{user.roleLabel}</div>
              </div>
            </div>

            <button type="button" onClick={handleLogout} className="cam-admin-rail-logout">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>{t("logoutButton")}</span>
            </button>
          </div>
        )}

        {/* Console language. The rail is the one element every admin page
            renders (several pages carry no header actions), so the switcher
            lives here rather than in AdminHeaderActions. */}
        <div className="cam-admin-rail-locale">
          <LocaleSwitcher variant="masthead" />
        </div>
      </div>
    </aside>
  );
}
