"use client";

import { ReactNode, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { useAuthStore } from "@/lib/auth-store";
import { getPilotageQueues } from "@/lib/api-client";
import { directoryRoleLabel } from "@/lib/user-directory";
import type { UserRole } from "@/lib/user-types";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { RequireAdminRole } from "@/components/admin/RequireAdminRole";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";

// Layout-level page header: the fallback for admin pages that don't render
// their own AdminPageHeader yet. When a page is refactored to render its own
// header, remove its entry here so it never shows two <h1>s. Refactored so
// far: /admin/pilotage, /admin/dossiers/[id].
// `group` / `nav` mirror the page's section and label in AdminSidebar.
// `detail` labels a sub-route: its breadcrumb becomes group › nav (linking
// back to the list) › detail. A sub-route without `detail` renders its own.
const PAGE_TITLES: Record<string, { title: string; sub: string; group?: string; nav?: string; detail?: string }> = {
  "/admin/files-attente": { title: "Dossiers en instance", sub: "Files de traitement prioritaire et arbitrage", group: "Supervision", nav: "Dossiers en instance" },
  "/admin/sectors":       { title: "Référentiel des secteurs", sub: "Nomenclature nationale des métiers et secteurs d'activité", group: "Données", nav: "Jeux de données" },
};

const ADMIN_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "SUPER_ADMIN_DSMO",
  "SUPER_ADMIN_ONEFOP",
  "CENTRAL",
  "REGIONAL",
  "DIVISIONAL",
  "DATA_MANAGER",
  "CAMPAIGN_MANAGER",
  "ANALYST",
  "AUDITOR",
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();
  const { isLoading, forbidden, user } = useAdminScreenGuard(ADMIN_ROLES);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);

  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues"],
    queryFn: getPilotageQueues,
    enabled: !isLoading && !forbidden,
    refetchInterval: 30000,
  });

  const pendingCount =
    (queuesQuery.data?.blockingAnomaliesCount ?? 0) +
    (queuesQuery.data?.pendingNationalVisasCount ?? 0);

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

  if (isLoading) {
    return (
      <div className="cam-admin-empty" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--cam-bg)" }}>
        {t("common.loading")}
      </div>
    );
  }

  if (forbidden) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeContent: "center", gap: "var(--cam-space-2)", padding: "var(--cam-space-6)", textAlign: "center", background: "var(--cam-bg)" }}>
        <h1 className="cam-admin-h1">Accès restreint</h1>
        <p className="cam-admin-lede">
          Cette console d&apos;administration est réservée aux agents et auditeurs accrédités du MINEFOP.
        </p>
        <Link href="/home" className="cam-text-button" style={{ marginTop: "var(--cam-space-3)" }}>
          ← Retour au portail
        </Link>
      </div>
    );
  }

  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() ||
    user?.email?.slice(0, 2).toUpperCase() ||
    "AD";
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Compte agent";

  // Derive current page title from pathname (longest matching prefix wins).
  // Prefixes only match on a path boundary, so /admin/dossiers-archive would
  // not match /admin/dossiers. No match = the page renders its own AdminPageHeader.
  const [matchedPrefix, pageTitle] = Object.entries(PAGE_TITLES)
    .filter(([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/"))
    .sort((a, b) => b[0].length - a[0].length)[0] ?? [];
  const isSubRoute = !!matchedPrefix && pathname !== matchedPrefix;
  const breadcrumb = pageTitle?.group && pageTitle.nav
    ? isSubRoute && pageTitle.detail
      ? [{ label: pageTitle.group }, { label: pageTitle.nav, href: matchedPrefix }, { label: pageTitle.detail }]
      : [{ label: pageTitle.group }, { label: pageTitle.nav }]
    : undefined;

  return (
    <div className={`cam-admin${menuOpen ? " is-menu-open" : ""}`}>
      <Suspense fallback={<aside id="cam-admin-rail" className="cam-admin-rail" />}>
        <AdminSidebar
          user={{
            displayName,
            initials,
            roleLabel: user?.role ? directoryRoleLabel(user.role) : "Agent",
          }}
          role={user?.role}
          pendingCount={pendingCount}
          anomaliesCount={queuesQuery.data?.blockingAnomaliesCount ?? 0}
        />
      </Suspense>

      <div className="cam-admin-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="cam-admin-body">
        <div className="cam-admin-mobilebar">
          <button
            type="button"
            className="cam-admin-menu-button"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen}
            aria-controls="cam-admin-rail"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>

        <main className="cam-admin-main">
          {/* D8: per-page gate on top of the console gate above. */}
          <RequireAdminRole>
            {pageTitle && (!isSubRoute || pageTitle.detail) && (
              <AdminPageHeader
                breadcrumb={breadcrumb}
                title={pageTitle.title}
                subtitle={pageTitle.sub}
                actions={<AdminHeaderActions />}
              />
            )}
            {children}
          </RequireAdminRole>
        </main>
      </div>
    </div>
  );
}
