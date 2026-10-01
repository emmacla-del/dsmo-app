"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { ADMIN_ROUTES, isRoleAllowed, type AdminRoute } from "@/app/admin/_routes";
import type { UserRole } from "@/lib/user-types";

// ── Nav structure ────────────────────────────────────────────────────────────
//
// Sections, items and their allowedRoles live in app/admin/_routes.ts, shared
// with the per-page gate (RequireAdminRole) so the two never disagree.

type NavItem = AdminRoute;

// ── Props ────────────────────────────────────────────────────────────────────

export interface AdminSidebarProps {
  user?: {
    displayName: string;
    roleLabel: string;
    initials: string;
  };
  /** Current user's role key; items outside their allowedRoles are hidden. */
  role?: UserRole;
  /** Badge count on "Dossiers en instance" */
  pendingCount?: number;
  /** Badge count on "Inscriptions" */
  inscriptionsCount?: number;
  /** Badge count on "Anomalies" */
  anomaliesCount?: number;
  /** Current locale for the FR | EN switcher */
  locale?: "fr" | "en";
  onLocaleChange?: (locale: "fr" | "en") => void;
}

// ── Badge pill ────────────────────────────────────────────────────────────────

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} éléments`}
      style={{
        marginLeft: "auto",
        minWidth: 20,
        height: 20,
        padding: "0 6px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        background: "var(--cam-flag-yellow)",
        color: "#5c3800",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ── Single nav item ───────────────────────────────────────────────────────────

function NavLink({
  item,
  badge,
  isActive,
}: {
  item: NavItem;
  badge?: number;
  isActive: boolean;
}) {
  const base: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 16px 7px 0",
    fontSize: 13,
    fontWeight: isActive ? 600 : 400,
    lineHeight: 1.3,
    textDecoration: "none",
    transition: "background 0.1s ease, color 0.1s ease",
    borderRadius: 0,
    cursor: item.href ? "pointer" : "default",
    // Active: white card with amber left accent
    // Inactive: translucent white text
    background: isActive ? "rgba(255,255,255,0.96)" : "transparent",
    color: isActive ? "var(--cam-green-dark)" : "rgba(255,255,255,0.78)",
    borderLeft: isActive
      ? `3px solid var(--cam-flag-yellow)`
      : "3px solid transparent",
    paddingLeft: 13, // 16 - 3px border
  };

  const dot = !isActive && (
    <span
      aria-hidden="true"
      style={{
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.45)",
        flexShrink: 0,
        marginLeft: 3,
      }}
    />
  );

  const content: ReactNode = (
    <>
      {dot}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.label}
      </span>
      {badge !== undefined && badge > 0 && <Badge count={badge} />}
    </>
  );

  if (!item.href) {
    return (
      <span style={{ ...base, opacity: 0.55 }}>
        {content}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      style={base}
      className="cam-admin-rail-link"
      aria-current={isActive ? "page" : undefined}
    >
      {content}
    </Link>
  );
}

// ── AdminSidebar ──────────────────────────────────────────────────────────────

/**
 * Admin navigation rail. Renders as `#cam-admin-rail.cam-admin-rail` so
 * admin-console.css controls width, sticky positioning and the off-canvas
 * mobile drawer — never override those with inline styles.
 */
export function AdminSidebar({
  user,
  role,
  pendingCount = 0,
  inscriptionsCount = 0,
  anomaliesCount = 0,
  locale = "fr",
  onLocaleChange,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // D8: only the items this role may open; sections left empty are dropped.
  const sections = ADMIN_ROUTES
    .map((section) => ({ ...section, items: section.items.filter((item) => isRoleAllowed(item.allowedRoles, role)) }))
    .filter((section) => section.items.length > 0);

  // Derive active item: supports exact path, query parameter matching, and path prefixes
  function isActive(href: string | null): boolean {
    if (!href) return false;
    const [targetPath, targetQuery] = href.split("?");
    const cleanPath = targetPath.split("#")[0];

    // If target has a query string, both path and query parameters must match
    if (targetQuery) {
      if (pathname !== cleanPath) return false;
      const targetParams = new URLSearchParams(targetQuery);
      let match = true;
      targetParams.forEach((val, key) => {
        if (searchParams?.get(key) !== val) match = false;
      });
      return match;
    }

    // If target has no query string, check if current URL has a query that another route specializes
    if (pathname === cleanPath) {
      const isOverriddenBySpecificQuery = sections.some((sec) =>
        sec.items.some((it) => {
          if (!it.href || it.href === href) return false;
          const [itPath, itQuery] = it.href.split("?");
          if (itPath !== cleanPath || !itQuery) return false;
          const itParams = new URLSearchParams(itQuery);
          let match = true;
          itParams.forEach((val, key) => {
            if (searchParams?.get(key) !== val) match = false;
          });
          return match;
        })
      );
      return !isOverriddenBySpecificQuery;
    }

    return pathname.startsWith(cleanPath + "/");
  }

  // Badge injection by label
  function badgeFor(label: string): number | undefined {
    if (label === "Dossiers en instance") return pendingCount || undefined;
    if (label === "Inscriptions") return inscriptionsCount || undefined;
    if (label === "Anomalies") return anomaliesCount || undefined;
    return undefined;
  }

  return (
    <aside
      id="cam-admin-rail"
      className="cam-admin-rail"
      aria-label="Navigation principale"
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--cam-green-dark)",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* ── Cameroon flag ribbon ── */}
      <div
        aria-hidden="true"
        style={{
          flexShrink: 0,
          height: 4,
          background: `linear-gradient(90deg,
            var(--cam-flag-green)  0 33.33%,
            var(--cam-flag-red)   33.33% 66.66%,
            var(--cam-flag-yellow) 66.66% 100%)`,
        }}
      />

      {/* ── Brand ── */}
      <div style={{ padding: "16px 16px 12px", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <div
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            borderRadius: 6,
            background: "#fff",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cam-green-dark)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="4" fill="var(--cam-green-dark)" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "0.04em", lineHeight: 1 }}>
            ONEFOP
          </div>
          <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em", marginTop: 3, textTransform: "uppercase" }}>
            Observatoire National
          </div>
        </div>
      </div>

      {/* ── Nav sections ── */}
      {/* Grow to push the footer down, but never shrink below content: on short
          viewports the rail scrolls instead of the footer overlapping the nav. */}
      <nav style={{ flex: "1 0 auto", paddingBottom: "var(--cam-space-4)" }}>
        {sections.map((section) => (
          <div key={section.group} style={{ marginTop: 18 }}>
            {/* Section label */}
            <div
              style={{
                padding: "0 16px 4px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.38)",
              }}
            >
              {section.group}
            </div>

            {/* Items */}
            {section.items.map((item) => (
              <NavLink
                key={item.label}
                item={item}
                badge={badgeFor(item.label)}
                isActive={isActive(item.href)}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* ── Footer: locale toggle + user card ── */}
      <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.1)", padding: "10px 16px" }}>
        {/* FR | EN */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {(["fr", "en"] as const).map((l, i) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {i > 0 && <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>|</span>}
              <button
                type="button"
                onClick={() => onLocaleChange?.(l)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "2px 4px",
                  fontSize: 11,
                  fontWeight: locale === l ? 700 : 400,
                  color: locale === l ? "#fff" : "rgba(255,255,255,0.45)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {l.toUpperCase()}
              </button>
            </span>
          ))}
        </div>

        {/* User card */}
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div
              aria-hidden="true"
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {user.initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.displayName}
              </div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.roleLabel}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
