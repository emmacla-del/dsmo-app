"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Lock, Search } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { OfficialBand } from "@/components/brand/OfficialBand";
import { LanguageLink } from "@/components/LanguageLink";
import { useAuthStore } from "@/lib/auth-store";
import { adminHomeFor } from "@/lib/nav-profiles";
import { DIRECTORY_READ_ROLES, hasRole } from "@/lib/roles";
import { parseRegistrationVue } from "@/lib/admin-url";

export interface AdminMastheadProps {
  /** « Ressort : National », already worded. */
  scopeLabel: string;
  scopeTitle: string;
  /** The drawer toggle; shown below 1024px only (CSS). */
  menuButton?: ReactNode;
  /** The signed-in officer's menu (AdminAccountMenu). */
  account?: ReactNode;
}

/**
 * Institutional header of every staff-console page (admin-layout-spec §2,
 * revision 3): the national tricolour, then the official band of the whole
 * platform (OfficialBand, option D: the Republic, the ONEFOP emblem on its
 * white disc, the ministry; owner, 2026-11-11, replacing the coat of arms of
 * 2026-11-08), then the application bar (CAMLEAP, the console name, a
 * search of the establishment register, the enforced territorial scope, the
 * other language, notifications and the account). It spans the window above
 * the rail, as on the canvas boards (2026-11-08). Brand rule (docs/standards/brand.md): the State speaks in the
 * band, CAMLEAP is the product in the bar; the ONEFOP emblem is
 * never drawn below 56px, so below 820px the band names ONEFOP in words.
 */
export function AdminMasthead({ scopeLabel, scopeTitle, menuButton, account }: AdminMastheadProps) {
  const t = useTranslations("adminLayout");
  const role = useAuthStore((s) => s.user?.role);
  // The register is the one list that covers every establishment in the
  // reader's territory, by name, NIU or identifier; roles that cannot read
  // it get no search box rather than one that leads to a refusal.
  const canSearch = hasRole(role, DIRECTORY_READ_ROLES);

  return (
    <header className="cam-admin-masthead" aria-label={t("mastheadAriaLabel")}>
      <OfficialBand console />
      <div className="cam-admin-masthead-bar">
        {menuButton}
        <Link href={adminHomeFor(role)} className="cam-admin-masthead-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/camleap-logo.svg" alt="CAMLEAP" width={142} height={20} />
          <span className="cam-admin-masthead-console">{t("consoleName")}</span>
        </Link>
        {canSearch && (
          // Suspense: the search reads the query string to stay off the
          // registration queue, which has its own search with the results.
          <Suspense fallback={null}>
            <MastheadSearch />
          </Suspense>
        )}
        <div className="cam-admin-masthead-actions">
          <span className="cam-admin-masthead-scope" title={scopeTitle}>
            <Lock size={14} aria-hidden="true" />
            {scopeLabel}
          </span>
          <LanguageLink compact />
          <NotificationBell />
          {account}
        </div>
      </div>
    </header>
  );
}

/**
 * The register search in the bar. Hidden on the registration queue only
 * (/admin/inscriptions, queue view): that page's toolbar searches the queue,
 * and two search boxes on one screen would search different lists.
 */
function MastheadSearch() {
  const t = useTranslations("adminLayout");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  if (pathname === "/admin/inscriptions" && parseRegistrationVue(searchParams.get("vue")) === "queue") return null;
  return (
    <form
      role="search"
      className="cam-admin-masthead-search"
      onSubmit={(event) => {
        event.preventDefault();
        const text = query.trim();
        router.push(text ? `/admin/etablissements?search=${encodeURIComponent(text)}` : "/admin/etablissements");
      }}
    >
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("mastheadSearchPlaceholder")}
        aria-label={t("mastheadSearchLabel")}
      />
    </form>
  );
}
