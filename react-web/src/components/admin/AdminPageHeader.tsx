"use client";

import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getPilotageQueues } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { usePendingRegistrationsCount } from "@/hooks/usePendingRegistrationsCount";
import { getActiveHub, isRoleAllowed, isSubRouteActive } from "@/app/admin/_routes";

// ── Breadcrumb ──────────────────────────────────────────────────────────────

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const t = useTranslations("adminPageHeader");
  return (
    <nav aria-label={t("breadcrumbAriaLabel")} className="cam-admin-breadcrumb">
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden="true" className="cam-admin-breadcrumb-sep">›</span>}
          {item.href
            ? <Link href={item.href}>{item.label}</Link>
            : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

// ── Status badge (inline, next to title on detail pages) ────────────────────

type StatusVariant = "pending" | "validated" | "rejected" | "correction" | "active" | "neutral";

// The variant decides a .cam-admin-status-badge--* class; the class decides
// the tint, the ink and the dot (admin-console.css).
export function AdminStatusBadge({ label, variant }: { label: string; variant: StatusVariant }) {
  return <span className={`cam-admin-status-badge cam-admin-status-badge--${variant}`}>{label}</span>;
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
  const t = useTranslations("adminPageHeader");
  const tNav = useTranslations("adminNav");

  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues"],
    queryFn: getPilotageQueues,
    staleTime: 30000,
  });

  // Pending registrations, for the "inscriptions" tab badge — the same hook
  // as the sidebar badge and the pilotage tile.
  const { count: pendingRegistrations } = usePendingRegistrationsCount();

  if (customTabs && customTabs.length > 0) {
    return (
      <nav
        aria-label={t("subNavAriaLabel")}
        className="cam-admin-tabs"
      >
        {customTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.isActive ? "page" : undefined}
            className="cam-admin-tab"
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
  const allowedSubRoutes = activeHub.subRoutes.filter((sub) => !sub.hidden && isRoleAllowed(sub.allowedRoles, role));
  if (allowedSubRoutes.length <= 1) return null;

  // Same split as the sidebar: visas on "pending", anomalies on "anomalies".
  const pendingCount = queuesQuery.data?.pendingNationalVisasCount ?? 0;
  const anomaliesCount = queuesQuery.data?.blockingAnomaliesCount ?? 0;

  return (
    // Navigation links, not ARIA tabs: there are no tab panels, so the row
    // is a labelled <nav> and the current page carries aria-current.
    <nav
      aria-label={t("subNavAriaLabel")}
      className="cam-admin-tabs"
    >
      {allowedSubRoutes.map((sub) => {
        const isActive = isSubRouteActive(sub.href, pathname, searchParams, allowedSubRoutes);
        let badge: number | undefined;
        if (sub.badgeKey === "pending") badge = pendingCount || undefined;
        if (sub.badgeKey === "anomalies") badge = anomaliesCount || undefined;
        if (sub.badgeKey === "inscriptions") badge = pendingRegistrations || undefined;

        return (
          <Link
            key={sub.href}
            href={sub.href}
            aria-current={isActive ? "page" : undefined}
            className="cam-admin-tab"
          >
            {sub.labelKey ? tNav(`routes.${sub.labelKey}`) : sub.label}
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
  /** Optional content placed between breadcrumb and title (e.g. subnav pills matching Figma) */
  beforeTitle?: ReactNode;
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
  beforeTitle,
  title,
  subtitle,
  statusBadge,
  backHref,
  actions,
  tabs,
  hideTabs = false,
}: AdminPageHeaderProps) {
  const t = useTranslations("adminPageHeader");
  const shouldHideTabs = hideTabs || (backHref !== undefined && tabs === undefined);

  return (
    <header className={`cam-admin-page-header${shouldHideTabs ? " cam-admin-page-header--no-tabs" : ""}`}>
      {/* ── Left: breadcrumb + title row + subtitle ── */}
      <div className="cam-admin-page-header-main">
        {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}
        {beforeTitle && <div className="cam-admin-page-header-before">{beforeTitle}</div>}

        <div className="cam-admin-page-title-row">
          {backHref && (
            <Link href={backHref} aria-label={t("backAriaLabel")} className="cam-admin-back">
              ←
            </Link>
          )}

          <h1 className="cam-admin-page-title">{title}</h1>

          {statusBadge && (
            <AdminStatusBadge label={statusBadge.label} variant={statusBadge.variant} />
          )}
        </div>

        {subtitle && (
          <p className="cam-admin-page-subtitle">{subtitle}</p>
        )}
      </div>

      {/* ── Right: actions slot ── */}
      {actions && (
        <div className="cam-admin-page-header-actions">{actions}</div>
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
