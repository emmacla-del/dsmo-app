"use client";

import { ReactNode, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { useAuthStore } from "@/lib/auth-store";
import { getPilotageQueues } from "@/lib/api-client";
import { directoryRoleLabel } from "@/lib/user-directory";
import { asUiLocale } from "@/lib/register-i18n";
import { ADMIN_ROLES, PILOTAGE_READ_ROLES, hasRole } from "@/lib/roles";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { LanguageLink } from "@/components/LanguageLink";
import { RequireAdminRole } from "@/components/admin/RequireAdminRole";

// Every admin page renders its own AdminPageHeader. The layout used to carry
// a PAGE_TITLES table as the fallback for pages that did not; the last entry
// (/admin/sectors) was removed once it rendered its own, leaving an empty
// table and ~15 lines deriving a breadcrumb from it that could never match.
// Both are gone. A new page renders AdminPageHeader itself — there is no
// layout-level header to register with.

// The rail is a permanent column from 1024px up and an off-canvas drawer
// below it (admin-console.css). Only the drawer form traps focus and makes
// the page behind it inert.
const DRAWER_QUERY = "(max-width: 1023px)";

let drawerMql: MediaQueryList | null = null;
const drawerQuery = () => (drawerMql ??= window.matchMedia(DRAWER_QUERY));

export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const locale = asUiLocale(useLocale());
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, forbidden, user, isAuthenticated } = useAdminScreenGuard(ADMIN_ROLES);
  const canReadPilotage = hasRole(user?.role, PILOTAGE_READ_ROLES);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const wasDrawerOpen = useRef(false);

  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues"],
    queryFn: getPilotageQueues,
    enabled: !isLoading && !forbidden && isAuthenticated && canReadPilotage,
    refetchInterval: 120000,
  });

  // Blocking anomalies are counted once, on the data-quality destination,
  // where they are resolved.

  // The drawer (tablet/phone) closes on Escape as well as on navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  /**
   * Which form the rail currently has. Subscribed rather than stored in an
   * effect: the width is external state, so useSyncExternalStore reads it
   * without a render-then-correct pass, and renders false on the server.
   *
   * Widening past the breakpoint also closes the menu, so the page is never
   * left inert behind a rail that is no longer a drawer, and narrowing again
   * does not reopen a drawer the user never asked for.
   */
  const subscribeToWidth = useCallback((onChange: () => void) => {
    const mq = drawerQuery();
    const handle = () => {
      if (!mq.matches) setMenuOpen(false);
      onChange();
    };
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  const isDrawer = useSyncExternalStore(
    subscribeToWidth,
    () => drawerQuery().matches,
    () => false
  );

  const drawerOpen = menuOpen && isDrawer;

  /**
   * Contain focus in the open drawer.
   *
   * Measured before this existed: the page behind the scrim kept 38
   * focusable controls, and tabbing out of the drawer walked into them with
   * nothing to say you had left. `inert` below removes them; this keeps Tab
   * cycling inside the rail. The closed drawer is already `visibility:
   * hidden`, so its own links are out of the tab order without help.
   *
   * The rail is read by id — the same handle `aria-controls` on the menu
   * button already uses — rather than by threading a ref through
   * AdminSidebar's props.
   */
  useEffect(() => {
    if (!drawerOpen) return;
    const rail = document.getElementById("cam-admin-rail");
    if (!rail) return;

    const focusable = () =>
      Array.from(
        rail.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
      ).filter((el) => el.offsetParent !== null);

    focusable()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !(active instanceof Node) || !rail.contains(active);
      if (e.shiftKey && (outside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (outside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // On close, focus cannot stay on a rail link that is now hidden, so it
  // returns to the control that opened the drawer. `inert` is already off
  // by the time this effect runs.
  useEffect(() => {
    if (wasDrawerOpen.current && !drawerOpen) {
      const active = document.activeElement;
      const rail = document.getElementById("cam-admin-rail");
      const stranded =
        !active || active === document.body || (active instanceof Node && rail?.contains(active));
      if (stranded) menuButtonRef.current?.focus();
    }
    wasDrawerOpen.current = drawerOpen;
  }, [drawerOpen]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="cam-admin-empty" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--cam-bg)" }}>
        {t("common.loading")}
      </div>
    );
  }

  if (forbidden) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeContent: "center", gap: "var(--cam-space-2)", padding: "var(--cam-space-6)", textAlign: "center", background: "var(--cam-bg)" }}>
        <h1 className="cam-admin-h1">{t("adminLayout.accessDeniedTitle")}</h1>
        <p className="cam-admin-lede">{t("adminLayout.accessDeniedMessage")}</p>
        <Link href="/home" className="cam-text-button" style={{ marginTop: "var(--cam-space-3)" }}>
          {t("adminLayout.backToPortal")}
        </Link>
      </div>
    );
  }

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || t("adminLayout.defaultDisplayName");

  return (
    <div className={`cam-admin${drawerOpen ? " is-menu-open" : ""}`}>
      <Suspense fallback={<aside id="cam-admin-rail" className="cam-admin-rail" />}>
        <AdminSidebar
          role={user?.role}
          anomaliesCount={queuesQuery.data?.blockingAnomaliesCount ?? 0}
          onLogout={() => {
            logout({ intentional: true });
            router.push("/login");
          }}
        />
      </Suspense>

      {/* Sibling of the body, not a child, so the scrim stays clickable while
          the body is inert. */}
      <div className="cam-admin-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      {/* The menu button sits inside this element, so it is inert too while
          the drawer is open — which matches what is on screen, since the
          scrim covers it. Escape and the scrim are the ways back out. */}
      <div className="cam-admin-body" inert={drawerOpen}>
        {/* The account bar: the very top of every admin page, right-aligned:
            who is signed in and the console language (owner, 2026-10-10).
            Sign-out stays at the foot of the sidebar. On a phone it also
            holds the menu button that opens the sidebar drawer. */}
        <div className="cam-admin-topbar">
          <button
            ref={menuButtonRef}
            type="button"
            className="cam-admin-menu-button"
            aria-label={menuOpen ? t("adminLayout.closeMenuAriaLabel") : t("adminLayout.openMenuAriaLabel")}
            aria-expanded={menuOpen}
            aria-controls="cam-admin-rail"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="cam-admin-account">
            <span className="cam-admin-account-name">{displayName}</span>
            <span className="cam-admin-account-role">
              {user?.role ? directoryRoleLabel(user.role, locale) : t("adminLayout.defaultRoleLabel")}
            </span>
            <LanguageLink />
          </div>
        </div>

        <main className="cam-admin-main">
          {/* D8: per-page gate on top of the console gate above. */}
          <RequireAdminRole>{children}</RequireAdminRole>
        </main>
      </div>
    </div>
  );
}
