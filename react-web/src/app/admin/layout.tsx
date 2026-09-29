"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { useAuthStore } from "@/lib/auth-store";
import { getPilotageQueues } from "@/lib/api-client";
import { listCampaigns } from "@/lib/campaigns";
import { directoryRoleLabel } from "@/lib/user-directory";
import type { UserRole } from "@/lib/user-types";

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  "/admin/pilotage":      { title: "Tableau de bord", sub: "Supervision des collectes et indicateurs de performance" },
  "/admin/files-attente": { title: "Dossiers en instance", sub: "Files de traitement prioritaire et arbitrage" },
  "/admin/dossiers":      { title: "Instruction et visas", sub: "Contrôle de conformité et octroi des visas administratifs" },
  "/admin/diffusion":     { title: "Données et exports", sub: "Homologation et diffusion des données statistiques certifiées" },
  "/admin/sectors":       { title: "Référentiel des secteurs", sub: "Nomenclature nationale des métiers et secteurs d'activité" },
  "/admin/utilisateurs":  { title: "Agents ONEFOP", sub: "Répertoire des comptes accrédités des agents MINEFOP" },
  "/admin/campagnes":     { title: "Gestion des campagnes", sub: "Pilotage des campagnes de collecte statistique nationale" },
  "/admin/parametres":    { title: "Paramètres", sub: "Configuration de la plateforme CAM-LEAP" },
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

interface NavLinkItem {
  href: string;
  label: string;
  sub: string;
  icon: ReactNode;
  // Raw roles the target screen's backend endpoint accepts. Omitted = every
  // admin role. Hiding is only a convenience — the server still enforces it.
  roles?: UserRole[];
}

// Mirrors @Roles on GET /campaigns (campaign.controller.ts).
const CAMPAIGN_READER_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP", "CENTRAL", "REGIONAL"];

const PRIMARY_NAV_ITEMS: NavLinkItem[] = [
  {
    href: "/admin/pilotage",
    label: "Tableau de bord",
    sub: "Indicateurs & performance",
    icon: (
      <svg width="18" height="18" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    href: "/admin/files-attente",
    label: "Dossiers en instance",
    sub: "File de traitement prioritaire",
    icon: (
      <svg width="18" height="18" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-6l-2 3h-4l-2-3H2" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    ),
  },
  {
    href: "/admin/dossiers",
    label: "Instruction et visas",
    sub: "Contrôle de conformité & arbitrage",
    icon: (
      <svg width="18" height="18" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M9 15l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/admin/diffusion",
    label: "Données et exports",
    sub: "Homologation & exports certifiés",
    icon: (
      <svg width="18" height="18" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

const SYSTEM_NAV_ITEMS: NavLinkItem[] = [
  {
    href: "/admin/campagnes",
    label: "Campagnes",
    sub: "Gestion des campagnes de collecte",
    roles: ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP", "CENTRAL", "REGIONAL", "CAMPAIGN_MANAGER"],
    icon: (
      <svg width="18" height="18" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: "/admin/parametres",
    label: "Paramètres",
    sub: "Configuration de la plateforme",
    roles: ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "SUPER_ADMIN_DSMO"],
    icon: (
      <svg width="18" height="18" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 1.56 3.54l-2.5.47a7 7 0 0 0-1.09-2.48zm-14.14 0l2.5 2.5a7 7 0 0 0-1.09 2.48l-2.5-.47A10 10 0 0 1 4.93 4.93zM4.93 19.07a10 10 0 0 1-1.56-3.54l2.5-.47a7 7 0 0 0 1.09 2.48zm14.14 0l-2.5-2.5a7 7 0 0 0 1.09-2.48l2.5.47a10 10 0 0 1-1.59 4.51z"/>
      </svg>
    ),
  },
];

const SECONDARY_NAV_ITEMS: NavLinkItem[] = [
  {
    href: "/admin/sectors",
    label: "Référentiel des secteurs",
    sub: "Référentiel national des métiers",
    icon: (
      <svg width="18" height="18" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    href: "/admin/utilisateurs",
    label: "Utilisateurs ONEFOP",
    sub: "Comptes des agents centraux, régionaux & divisionnaires",
    // /auth/users* accept SUPER_ADMIN (all staff) and SUPER_ADMIN_ONEFOP
    // (ONEFOP staff only) — see src/auth/staff-scope.ts.
    roles: ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP"],
    icon: (
      <svg width="18" height="18" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <polyline points="16 11 18 13 22 9" />
      </svg>
    ),
  },
  {
    href: "/home/annuaire",
    label: "Établissements",
    sub: "Répertoire des établissements déclarants",
    // Same roles /home/annuaire's guard admits (ANNUAIRE_ROLES).
    roles: ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP"],
    icon: (
      <svg width="18" height="18" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
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

  const canReadCampaigns = !!user && CAMPAIGN_READER_ROLES.includes(user.role);
  const activeCampaignQuery = useQuery({
    queryKey: ["campaigns", "ACTIVE"],
    queryFn: () => listCampaigns("ACTIVE"),
    enabled: !isLoading && !forbidden && canReadCampaigns,
  });
  const activeCampaign = activeCampaignQuery.data?.[0];
  const secondaryNavItems = SECONDARY_NAV_ITEMS.filter(
    (item) => !item.roles || (!!user && item.roles.includes(user.role)),
  );
  const systemNavItems = SYSTEM_NAV_ITEMS.filter(
    (item) => !item.roles || (!!user && item.roles.includes(user.role)),
  );

  const pendingCount =
    (queuesQuery.data?.blockingAnomaliesCount ?? 0) +
    (queuesQuery.data?.pendingNationalVisasCount ?? 0);

  // The drawer (tablet/phone) closes on Escape as well as on navigation.
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
  const scope = user?.department
    ? `Département ${user.department}`
    : user?.region
      ? `Région ${user.region}`
      : "National";

  // Derive current page title from pathname (longest matching prefix wins)
  const pageTitle = Object.entries(PAGE_TITLES)
    .filter(([prefix]) => pathname.startsWith(prefix))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? { title: "Console NEFOP", sub: "Observatoire National de l'Emploi et de la Formation Professionnelle" };

  const renderLink = (item: NavLinkItem, count?: number) => {
    const isActive = pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className="cam-admin-nav-link"
        aria-current={isActive ? "page" : undefined}
        title={item.sub}
        onClick={() => setMenuOpen(false)}
      >
        {item.icon}
        <span className="cam-admin-nav-label">{item.label}</span>
        {count ? (
          <span className="cam-admin-nav-count" aria-label={`${count} dossiers à traiter`}>
            {count}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <div className={`cam-admin${menuOpen ? " is-menu-open" : ""}`}>
      <aside className="cam-admin-rail" id="cam-admin-rail" aria-label="Navigation de la console">
        <div className="cam-admin-ribbon" />
        <div className="cam-admin-brand">
          <div className="cam-admin-seal" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="cam-admin-brand-name">NEFOP</div>
            <div className="cam-admin-brand-sub">Observatoire National</div>
          </div>
        </div>

        {activeCampaignQuery.isSuccess && (
          <div className={`cam-admin-campaign${activeCampaign ? "" : " is-idle"}`}>
            <span className="cam-admin-dot" aria-hidden="true" />
            <span>{activeCampaign ? `${activeCampaign.name} · en cours` : "Aucune campagne active"}</span>
          </div>
        )}

        <nav className="cam-admin-nav">
          <div className="cam-admin-nav-group">Supervision</div>
          {PRIMARY_NAV_ITEMS.map((item) =>
            renderLink(item, item.href === "/admin/files-attente" ? pendingCount : undefined),
          )}
          {secondaryNavItems.length > 0 && (
            <>
              <div className="cam-admin-nav-group">Référentiels et comptes</div>
              {secondaryNavItems.map((item) => renderLink(item))}
            </>
          )}
          {systemNavItems.length > 0 && (
            <>
              <div className="cam-admin-nav-group">Système</div>
              {systemNavItems.map((item) => renderLink(item))}
            </>
          )}
        </nav>

        <div className="cam-admin-account">
          <div className="cam-admin-avatar" aria-hidden="true">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div className="cam-admin-account-name" title={user?.email}>{displayName}</div>
            <div className="cam-admin-account-role">
              {user?.role ? directoryRoleLabel(user.role) : "Agent"} · {scope}
            </div>
          </div>
        </div>
        <div className="cam-admin-rail-foot">
          <Link href="/home">← Portail</Link>
          <button type="button" className="cam-admin-logout" onClick={() => logout()}>
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="cam-admin-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="cam-admin-body">
        <header className="cam-admin-topbar">
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
          <div className="cam-admin-topbar-title">
            <strong>{pageTitle.title}</strong>
            <span>{pageTitle.sub}</span>
          </div>
          <div className="cam-admin-topbar-right">
            <div className="cam-admin-scope" title="Ressort territorial de votre compte">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              {scope}
            </div>
            <div className="cam-admin-topbar-search" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span>Rechercher…</span>
            </div>
            <div className="cam-admin-flag-circle" aria-label="Cameroun" title="Cameroun">
              <span style={{ background: "#007a3d" }} />
              <span style={{ background: "#ce1126" }} />
              <span style={{ background: "#fcd116" }} />
            </div>
          </div>
        </header>

        <main className="cam-admin-main">{children}</main>
      </div>
    </div>
  );
}
