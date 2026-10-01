"use client";

import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getPilotageQueues } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { getActiveHub, isRoleAllowed, isSubRouteActive } from "@/app/admin/_routes";

// ── Breadcrumb ──────────────────────────────────────────────────────────────

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Fil d'Ariane" style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden="true" style={{ margin: "0 6px" }}>›</span>}
          {item.href
            ? <Link href={item.href} style={{ color: "var(--cam-text-muted)", textDecoration: "none" }}>{item.label}</Link>
            : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

// ── Status badge (inline, next to title on detail pages) ────────────────────

type StatusVariant = "pending" | "validated" | "rejected" | "correction" | "active" | "neutral";

const STATUS_STYLES: Record<StatusVariant, { bg: string; color: string; dot: string }> = {
  pending:    { bg: "rgba(240,180,41,0.15)",  color: "#92620a",  dot: "#f0b429" },
  validated:  { bg: "rgba(30,107,58,0.12)",   color: "#144a28",  dot: "#1e6b3a" },
  rejected:   { bg: "rgba(179,38,30,0.1)",    color: "#b3261e",  dot: "#b3261e" },
  correction: { bg: "rgba(240,180,41,0.15)",  color: "#92620a",  dot: "#e8a020" },
  active:     { bg: "rgba(30,107,58,0.12)",   color: "#144a28",  dot: "#1e6b3a" },
  neutral:    { bg: "rgba(74,90,80,0.1)",     color: "#4a5a50",  dot: "#4a5a50" },
};

export function AdminStatusBadge({ label, variant }: { label: string; variant: StatusVariant }) {
  const s = STATUS_STYLES[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px 3px 7px",
        borderRadius: "var(--cam-radius-full)",
        background: s.bg,
        fontSize: "var(--cam-font-size-xs)",
        fontWeight: 600,
        color: s.color,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, flexShrink: 0 }}
      />
      {label}
    </span>
  );
}

// ── In-Page Sub-navigation Tabs ─────────────────────────────────────────────

export interface AdminHeaderTab {
  label: string;
  href: string;
  badge?: number;
  isActive?: boolean;
}

function AdminSubNav({ customTabs }: { customTabs?: AdminHeaderTab[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = useAuthStore((s) => s.user?.role);

  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues"],
    queryFn: getPilotageQueues,
    staleTime: 30000,
  });

  if (customTabs && customTabs.length > 0) {
    return (
      <nav
        role="tablist"
        aria-label="Sous-navigation"
        className="cam-admin-tabs"
        style={{ width: "100%", marginTop: "var(--cam-space-3)", marginBottom: "-1px" }}
      >
        {customTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={tab.isActive}
            className="cam-admin-tab"
            style={{ textDecoration: "none" }}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="cam-admin-tab-count">{tab.badge}</span>
            )}
          </Link>
        ))}
      </nav>
    );
  }

  const activeHub = getActiveHub(pathname, searchParams);
  if (!activeHub) return null;

  // Filter sub-routes strictly by user role permissions
  const allowedSubRoutes = activeHub.subRoutes.filter((sub) => isRoleAllowed(sub.allowedRoles, role));
  if (allowedSubRoutes.length <= 1) return null;

  const pendingCount =
    (queuesQuery.data?.blockingAnomaliesCount ?? 0) +
    (queuesQuery.data?.pendingNationalVisasCount ?? 0);
  const anomaliesCount = queuesQuery.data?.blockingAnomaliesCount ?? 0;

  return (
    <nav
      role="tablist"
      aria-label="Sous-navigation"
      className="cam-admin-tabs"
      style={{ width: "100%", marginTop: "var(--cam-space-3)", marginBottom: "-1px" }}
    >
      {allowedSubRoutes.map((sub) => {
        const isActive = isSubRouteActive(sub.href, pathname, searchParams, allowedSubRoutes);
        let badge: number | undefined;
        if (sub.badgeKey === "pending") badge = pendingCount || undefined;
        if (sub.badgeKey === "anomalies") badge = anomaliesCount || undefined;

        return (
          <Link
            key={sub.href}
            href={sub.href}
            role="tab"
            aria-selected={isActive}
            className="cam-admin-tab"
            style={{ textDecoration: "none" }}
          >
            {sub.label}
            {badge !== undefined && badge > 0 && (
              <span className={`cam-admin-tab-count${sub.badgeKey === "anomalies" ? " is-alert" : ""}`}>
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

// ── AdminPageHeader ─────────────────────────────────────────────────────────

export interface AdminPageHeaderProps {
  /** Breadcrumb trail leading up to this page */
  breadcrumb?: BreadcrumbItem[];
  /** Main page title */
  title: ReactNode;
  /** Optional subtitle / description under the title */
  subtitle?: string;
  /** Inline status badge shown next to the title (detail pages) */
  statusBadge?: { label: string; variant: StatusVariant };
  /** Back-navigation href (detail pages — renders ← arrow left of title) */
  backHref?: string;
  /** Right-hand actions (buttons, chips, etc.) */
  actions?: ReactNode;
  /** Explicit tabs to render. If omitted and hideTabs is false, active hub sub-routes are used */
  tabs?: AdminHeaderTab[];
  /** Hide horizontal sub-navigation tabs (useful on deep detail pages) */
  hideTabs?: boolean;
}

/**
 * Shared page-level header for all admin screens.
 *
 * List pages:  breadcrumb · title + subtitle on left, actions on right, sub-tabs on bottom.
 * Detail pages: back arrow · title + inline status badge · subtitle on left,
 *               action buttons on right.
 */
export function AdminPageHeader({
  breadcrumb,
  title,
  subtitle,
  statusBadge,
  backHref,
  actions,
  tabs,
  hideTabs = false,
}: AdminPageHeaderProps) {
  const shouldHideTabs = hideTabs || (backHref !== undefined && tabs === undefined);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "var(--cam-space-4)",
        paddingBottom: shouldHideTabs ? "var(--cam-space-5)" : 0,
        borderBottom: "var(--cam-border-width) solid var(--cam-border)",
        marginBottom: "var(--cam-space-5)",
      }}
    >
      {/* ── Left: breadcrumb + title row + subtitle ── */}
      <div style={{ minWidth: 0, flex: 1 }}>
        {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}

        <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)", flexWrap: "wrap" }}>
          {backHref && (
            <Link
              href={backHref}
              aria-label="Retour"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "var(--cam-radius-sm)",
                border: "var(--cam-border-width) solid var(--cam-border-strong)",
                background: "var(--cam-surface)",
                color: "var(--cam-text)",
                textDecoration: "none",
                fontSize: "var(--cam-font-size-base)",
                flexShrink: 0,
              }}
            >
              ←
            </Link>
          )}

          <h1
            style={{
              margin: 0,
              fontSize: "var(--cam-font-size-2xl, 1.5rem)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              color: "var(--cam-green-dark)",
            }}
          >
            {title}
          </h1>

          {statusBadge && (
            <AdminStatusBadge label={statusBadge.label} variant={statusBadge.variant} />
          )}
        </div>

        {subtitle && (
          <p
            style={{
              margin: "var(--cam-space-1) 0 0",
              fontSize: "var(--cam-font-size-sm)",
              color: "var(--cam-text-muted)",
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* ── Right: actions slot ── */}
      {actions && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--cam-space-2)",
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          {actions}
        </div>
      )}

      {/* ── Bottom: secondary in-page navigation tabs ── */}
      {!shouldHideTabs && (
        <Suspense fallback={null}>
          <AdminSubNav customTabs={tabs} />
        </Suspense>
      )}
    </header>
  );
}
