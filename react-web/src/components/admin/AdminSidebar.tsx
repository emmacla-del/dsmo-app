"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { getActiveHub, type AdminHub } from "@/app/admin/_routes";
import type { UserRole } from "@/lib/user-types";
import { useNavProfile } from "@/hooks/useNavProfile";
import { navHubsFor } from "@/lib/nav-profiles";

export interface AdminSidebarProps {
  /**
   * Current user's role key. Optional override: when omitted the rail renders
   * the signed-in account's profile from the auth store (useNavProfile). Pass
   * it to render another role's rail — the layout does, from the same store.
   *
   * The hubs shown are that role's entry in NAV_PROFILES (@/lib/nav-profiles),
   * not ADMIN_HUBS filtered by allowedRoles; see that file for why.
   */
  role?: UserRole;
  /** Badge count on data quality */
  anomaliesCount?: number;
  /** Sign-out, kept at the foot of the rail (owner, 2026-10-10). */
  onLogout?: () => void;
}

// ── Hub Icons ─────────────────────────────────────────────────────────────────────────

// These were seven hand-written 18px SVGs. lucide-react carries the same
// glyphs at the same stroke weight, so the drawings live in a maintained
// package and this file states only the mapping.
const HUB_ICONS: Record<AdminHub["iconName"], LucideIcon> = {
  dashboard: LayoutDashboard,
  team: Users,
  collecte: FileText,
  declarants: UsersRound,
  quality: ShieldCheck,
  data: Database,
  settings: Settings,
};

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
  role,
  anomaliesCount = 0,
  onLogout,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("adminSidebar");
  const tNav = useTranslations("adminNav");

  // The signed-in account's profile, unless a role was passed explicitly.
  // Either way the hubs come from NAV_PROFILES, each href already pointing at
  // the first sub-route that role may open.
  const { hubs: ownHubs } = useNavProfile();
  const visibleHubs = useMemo(() => (role ? navHubsFor(role) : ownHubs), [role, ownHubs]);

  const activeHub = getActiveHub(pathname, searchParams);

  function getBadgeCount(badgeKey?: AdminHub["badgeKey"]): number {
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

      {/* ── Primary Navigation Hubs ── */}
      <nav className="cam-admin-rail-nav">
        {visibleHubs.map((hub) => {
          const isActive = activeHub?.key === hub.key;
          const badgeCount = getBadgeCount(hub.badgeKey);
          const HubIcon = HUB_ICONS[hub.iconName];

          return (
            <Link
              key={hub.key}
              href={hub.href}
              className="cam-admin-rail-hub"
              aria-current={isActive ? "page" : undefined}
            >
              <span className="cam-admin-rail-hub-icon" aria-hidden="true">
                <HubIcon size={18} />
              </span>

              <span className="cam-admin-rail-hub-label">{tNav(`hubs.${hub.key}`)}</span>

              {badgeCount > 0 && <Badge count={badgeCount} />}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer: sign-out only. Who is signed in and the language switch
          are in the account bar at the top of the page. ── */}
      {onLogout && (
        <div className="cam-admin-rail-account">
          <button type="button" onClick={onLogout} className="cam-admin-rail-logout">
            <LogOut size={13} aria-hidden="true" />
            <span>{t("logoutButton")}</span>
          </button>
        </div>
      )}
    </aside>
  );
}
