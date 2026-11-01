"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Database,
  ChevronDown,
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
import { LanguageLink } from "@/components/LanguageLink";
import { AdminRailActions } from "@/components/admin/AdminHeaderActions";
import { useNavProfile } from "@/hooks/useNavProfile";
import { navHubsFor } from "@/lib/nav-profiles";
import { hasRole, SETTINGS_ROLES } from "@/lib/roles";

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
  /** Signed-in identity shown in the sidebar footer. */
  accountName?: string;
  accountRole?: string;
  /** Badge count on data quality */
  anomaliesCount?: number;
  /** Sign-out, kept at the foot of the rail (owner, 2026-10-10). */
  onLogout?: () => void;
  /** Show the bell in the rail when the route has no institutional masthead. */
  showRailNotifications?: boolean;
  accountScope?: string;
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
  accountName,
  accountRole,
  anomaliesCount = 0,
  onLogout,
  showRailNotifications = true,
  accountScope,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("adminSidebar");
  const tNav = useTranslations("adminNav");
  const tHeader = useTranslations("adminHeaderActions");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);

  // The signed-in account's profile, unless a role was passed explicitly.
  // Either way the hubs come from NAV_PROFILES, each href already pointing at
  // the first sub-route that role may open.
  const { hubs: ownHubs } = useNavProfile();
  const visibleHubs = useMemo(() => (role ? navHubsFor(role) : ownHubs), [role, ownHubs]);

  const activeHub = getActiveHub(pathname, searchParams);
  const canOpenSettings = hasRole(role, SETTINGS_ROLES);

  useEffect(() => {
    setAccountMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAccountMenuOpen(false);
      accountTriggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [accountMenuOpen]);

  function getBadgeCount(badgeKey?: AdminHub["badgeKey"]): number {
    if (badgeKey === "anomalies") return anomaliesCount;
    return 0;
  }

  return (
    <aside id="cam-admin-rail" className="cam-admin-rail" aria-label={t("navAriaLabel")}>
      {/* ── Brand ── */}
      <div className="cam-admin-rail-brand">
        <div className="cam-admin-rail-brand-name">CAMLEAP</div>
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

      <AdminRailActions showNotifications={showRailNotifications} />

      {/* ── Footer: signed-in identity, language, and sign-out. ── */}
      {onLogout && (
        <div className="cam-admin-rail-account" ref={accountMenuRef}>
          <button
            ref={accountTriggerRef}
            type="button"
            className="cam-admin-account-trigger"
            aria-expanded={accountMenuOpen}
            aria-controls="cam-admin-account-menu"
            onClick={() => setAccountMenuOpen((open) => !open)}
          >
            <span className="cam-admin-rail-avatar" aria-hidden="true">
              {(accountName || "").split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "?"}
            </span>
            <span className="cam-admin-account-trigger-copy">
              <span className="cam-admin-rail-user-name">{accountName}</span>
              <span className="cam-admin-rail-user-role">{accountRole}</span>
            </span>
            <ChevronDown className={`cam-admin-account-trigger-chevron${accountMenuOpen ? " is-open" : ""}`} size={16} aria-hidden="true" />
          </button>

          {accountMenuOpen && <div id="cam-admin-account-menu" className="cam-admin-account-menu" aria-label={t("accountMenuAriaLabel")}>
            {canOpenSettings && <Link href="/admin/parametres" className="cam-admin-account-menu-link" onClick={() => setAccountMenuOpen(false)}>
              <Settings size={15} aria-hidden="true" />
              <span>{t("accountSettingsButton")}</span>
            </Link>}
            {accountScope && <div className="cam-admin-account-menu-territory">
              <span>{tHeader("scopeTitle")}</span>
              <span className="cam-admin-scope" title={tHeader("scopeTitle")}>{tHeader("scopeChip", { scope: accountScope })}</span>
            </div>}
            <div className="cam-admin-account-menu-language">
              <span>{t("languageLabel")}</span>
              <LanguageLink compact />
            </div>
            <button type="button" onClick={() => { setAccountMenuOpen(false); onLogout(); }} className="cam-admin-rail-logout">
              <LogOut size={14} aria-hidden="true" />
              <span>{t("logoutButton")}</span>
            </button>
          </div>}
        </div>
      )}
    </aside>
  );
}
