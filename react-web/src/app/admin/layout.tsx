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
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

// Layout-level page header: the fallback for admin pages that don't render
// their own AdminPageHeader yet. When a page is refactored to render its own
// header, remove its entry here so it never shows two <h1>s.
// `group` / `nav` mirror the page's section and label in AdminSidebar.
const PAGE_TITLES: Record<string, { title: string; sub: string; group?: string; nav?: string }> = {
  "/admin/pilotage":      { title: "Tableau de bord", sub: "Supervision des collectes et indicateurs de performance", group: "Supervision", nav: "Tableau de bord" },
  "/admin/files-attente": { title: "Dossiers en instance", sub: "Files de traitement prioritaire et arbitrage", group: "Supervision", nav: "Dossiers en instance" },
  "/admin/dossiers":      { title: "Instruction et visas", sub: "Contrôle de conformité et octroi des visas administratifs", group: "Contrôle qualité", nav: "Visas & décisions" },
  "/admin/diffusion":     { title: "Données et exports", sub: "Homologation et diffusion des données statistiques certifiées", group: "Données", nav: "Exports" },
  "/admin/sectors":       { title: "Référentiel des secteurs", sub: "Nomenclature nationale des métiers et secteurs d'activité" },
  "/admin/utilisateurs":  { title: "Agents ONEFOP", sub: "Répertoire des comptes accrédités des agents MINEFOP", group: "Administration", nav: "Utilisateurs" },
  "/admin/campagnes":     { title: "Gestion des campagnes", sub: "Pilotage des campagnes de collecte statistique nationale", group: "Collecte", nav: "Campagnes" },
  "/admin/parametres":    { title: "Paramètres", sub: "Configuration de la plateforme CAM-LEAP", group: "Administration", nav: "Paramètres" },
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

// Mirrors @Roles on GET /campaigns (campaign.controller.ts).
const CAMPAIGN_READER_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP", "CENTRAL", "REGIONAL"];

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
  const breadcrumb = pageTitle.group && pageTitle.nav ? [{ label: pageTitle.group }, { label: pageTitle.nav }] : undefined;

  return (
    <div className={`cam-admin${menuOpen ? " is-menu-open" : ""}`}>
      <AdminSidebar
        id="cam-admin-rail"
        className="cam-admin-rail"
        user={{
          displayName,
          initials,
          roleLabel: user?.role ? directoryRoleLabel(user.role) : "Agent",
        }}
        pendingCount={pendingCount}
      />

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
          <AdminPageHeader
            breadcrumb={breadcrumb}
            title={pageTitle.title}
            subtitle={pageTitle.sub}
            actions={
              <>
                {activeCampaign && (
                  <span className="cam-admin-campaign-pill" title="Campagne de collecte active">
                    <span aria-hidden="true" />
                    {activeCampaign.name}
                  </span>
                )}
                <span className="cam-admin-scope" title="Ressort territorial de votre compte">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  {scope}
                </span>
                <span className="cam-admin-flag-circle" role="img" aria-label="Cameroun" title="Cameroun">
                  <span style={{ background: "var(--cam-flag-green)" }} />
                  <span style={{ background: "var(--cam-flag-red)" }} />
                  <span style={{ background: "var(--cam-flag-yellow)" }} />
                </span>
              </>
            }
          />
          {children}
        </main>
      </div>
    </div>
  );
}
