"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Database,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { getActiveHub, isSubRouteActive as isHubSubRouteActive, type AdminHub } from "@/app/admin/_routes";
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
  /**
   * From 1024px up: full labels (true) or the icon strip (false). In the
   * strip, hovering or focusing a hub opens a flyout with its name and pages.
   * Ignored by the drawer below 1024px, which always shows labels.
   */
  expanded?: boolean;
  onToggleExpanded?: () => void;
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

// ── Groups ──────────────────────────────────────────────────────────────────

// The rail's sections, as on the canvas boards (2026-11-08): the work on
// files first, then running the collection, then data, then the system.
const HUB_GROUPS: { key: "instruction" | "collecte" | "donnees" | "systeme"; hubs: readonly AdminHub["key"][] }[] = [
  { key: "instruction", hubs: ["inscriptions", "teledeclarations"] },
  { key: "collecte", hubs: ["collecte", "equipe"] },
  { key: "donnees", hubs: ["donnees"] },
  { key: "systeme", hubs: ["administration"] },
];

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
  expanded = false,
  onToggleExpanded,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("adminSidebar");
  const tNav = useTranslations("adminNav");
  // A flyout closed with Escape stays closed until the pointer or focus leaves its hub.
  const [dismissedFlyout, setDismissedFlyout] = useState<string | null>(null);

  // The signed-in account's profile, unless a role was passed explicitly.
  // Either way the hubs come from NAV_PROFILES, each href already pointing at
  // the first sub-route that role may open.
  const { hubs: ownHubs } = useNavProfile();
  const visibleHubs = useMemo(() => (role ? navHubsFor(role) : ownHubs), [role, ownHubs]);

  const activeHub = getActiveHub(pathname, searchParams);
  // Hubs the role sees, in their sections; a hub no section names is kept
  // at the end rather than dropped.
  const grouped = HUB_GROUPS
    .map((group) => ({ key: group.key, hubs: visibleHubs.filter((hub) => group.hubs.includes(hub.key)) }))
    .filter((group) => group.hubs.length > 0);
  const ungrouped = visibleHubs.filter((hub) => !HUB_GROUPS.some((group) => group.hubs.includes(hub.key)));
  if (ungrouped.length > 0) grouped.push({ key: "systeme", hubs: ungrouped });

  function getBadgeCount(badgeKey?: AdminHub["badgeKey"]): number {
    if (badgeKey === "anomalies") return anomaliesCount;
    return 0;
  }

  return (
    <aside id="cam-admin-rail" className="cam-admin-rail" aria-label={t("navAriaLabel")}>
      {/* ── Brand ── */}
      <div className="cam-admin-rail-brand">
        <span className="cam-admin-rail-brand-mark" aria-hidden="true">C</span>
        <div className="cam-admin-rail-brand-copy">
          <div className="cam-admin-rail-brand-name">CAMLEAP</div>
          <div className="cam-admin-rail-brand-sub">{t("brandSubtitle")}</div>
        </div>
      </div>

      {/* ── Primary Navigation Hubs ── */}
      <nav className="cam-admin-rail-nav">
        {grouped.map((group) => (
          <div key={group.key} className="cam-admin-rail-group" role="group" aria-labelledby={`cam-admin-rail-group-${group.key}`}>
            <div id={`cam-admin-rail-group-${group.key}`} className="cam-admin-rail-group-title">{t(`group.${group.key}`)}</div>
        {group.hubs.map((hub) => {
          const isActive = activeHub?.key === hub.key;
          const badgeCount = getBadgeCount(hub.badgeKey);
          const HubIcon = HUB_ICONS[hub.iconName];
          const hubName = tNav(`hubs.${hub.key}`);
          const pages = hub.subRoutes.filter((sub) => !sub.hidden);

          return (
            <div
              key={hub.key}
              className={`cam-admin-rail-item${dismissedFlyout === hub.key ? " is-flyout-dismissed" : ""}`}
              onMouseLeave={() => setDismissedFlyout((current) => (current === hub.key ? null : current))}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDismissedFlyout((current) => (current === hub.key ? null : current));
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                setDismissedFlyout(hub.key);
                event.currentTarget.querySelector<HTMLElement>(".cam-admin-rail-hub")?.focus();
              }}
            >
              <Link
                href={hub.href}
                className="cam-admin-rail-hub"
                aria-current={isActive ? "page" : undefined}
              >
                <span className="cam-admin-rail-hub-icon" aria-hidden="true">
                  <HubIcon size={18} />
                </span>

                <span className="cam-admin-rail-hub-label">{hubName}</span>

                {badgeCount > 0 && <Badge count={badgeCount} />}
              </Link>

              {/* Labelled rail and drawer: the open hub lists its pages
                  under it, so the reader sees where they are without the
                  page's own tabs (CSS hides this in the icon strip). */}
              {isActive && pages.length > 1 && (
                <ul className="cam-admin-rail-subnav" aria-label={hubName}>
                  {pages.map((sub) => (
                    <li key={sub.href}>
                      <Link
                        href={sub.href}
                        className="cam-admin-rail-subnav-link"
                        aria-current={isHubSubRouteActive(sub.href, pathname, searchParams, pages) ? "page" : undefined}
                      >
                        {tNav(`routes.${sub.labelKey}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {/* Icon strip only (CSS): the hub's name and its pages. The
                  links are out of the tab order until the hub has focus. */}
              <div className="cam-admin-rail-flyout">
                <div className="cam-admin-rail-flyout-panel">
                  <div className="cam-admin-rail-flyout-title" aria-hidden="true">{hubName}</div>
                  {pages.length > 1 && (
                    <ul className="cam-admin-rail-flyout-list" aria-label={hubName}>
                      {pages.map((sub) => (
                        <li key={sub.href}>
                          <Link
                            href={sub.href}
                            className="cam-admin-rail-flyout-link"
                            aria-current={isHubSubRouteActive(sub.href, pathname, searchParams, pages) ? "page" : undefined}
                          >
                            {tNav(`routes.${sub.labelKey}`)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })}
          </div>
        ))}
      </nav>

      {onToggleExpanded && (
        <button
          type="button"
          className="cam-admin-rail-toggle"
          aria-expanded={expanded}
          aria-controls="cam-admin-rail"
          onClick={onToggleExpanded}
          title={expanded ? t("collapseRail") : t("expandRail")}
        >
          {expanded ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}
          <span className="cam-admin-rail-toggle-label">{expanded ? t("collapseRail") : t("expandRail")}</span>
        </button>
      )}

      {/* Who runs the platform and where to get help (canvas boards). The
          account moved to the masthead. Hidden in the icon strip (CSS). */}
      <div className="cam-admin-rail-foot">
        <span>{t("footPlatform")}</span>
        <span>{t("footAssistance", { phone: t("footAssistancePhone") })}</span>
      </div>
    </aside>
  );
}
