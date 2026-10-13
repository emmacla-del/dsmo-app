"use client";

// The masthead every portal route shares: the front-door lockup, the four
// nav tabs, the language switch and the way in.
//
// The current tab comes from the pathname, not from a scroll observer: the
// views are routes now, so "which one am I in" is a fact the router already
// knows. On a narrow viewport the tabs collapse into a drawer the toggle
// opens — the same links, not a second navigation.

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PORTAL_NAV } from "./portal-content";
import styles from "../portal.module.css";

export function PortalMasthead() {
  const t = useTranslations();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = PORTAL_NAV.map(({ key, href }) => {
    const current = pathname === href;
    return (
      <Link
        key={key}
        href={href}
        className={current ? styles.navCurrent : undefined}
        aria-current={current ? "page" : undefined}
        onClick={() => setMenuOpen(false)}
      >
        {t(`portalPage.${key}`)}
      </Link>
    );
  });

  return (
    <header className={styles.masthead}>
      <div className={`${styles.wrap} ${styles.mastheadInner}`}>
        {/* The front door shows both marks as one lockup: the ONEFOP emblem,
            a thin rule, the CAMLEAP wordmark, the endorsement in words
            underneath (docs/standards/brand.md). */}
        <div className={styles.mastheadBrand}>
          <Link href="/" className={styles.brandLockupLink}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/onefop_logo.png"
              alt={t("landingPage.emblemLabel")}
              width={56}
              height={56}
              className={styles.brandEmblem}
            />
            <span className={styles.brandRule} aria-hidden="true" />
            <span className={styles.brandMeta}>
              <span className={styles.brandTitleRow}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/camleap-logo.svg"
                  alt="CAMLEAP"
                  width={156}
                  height={22}
                  className={styles.brandWordmark}
                />
              </span>
              <span className={styles.endorsement}>{t("portalPage.footerBody")}</span>
            </span>
          </Link>
        </div>

        <nav className={styles.nav} aria-label={t("portalPage.navLabel")}>
          {links}
        </nav>

        <div className={styles.mastheadActions}>
          <Link href="/login" className="cam-button cam-button-primary">
            {t("portalPage.signInAction")}
          </Link>
          <LocaleSwitcher />
          <button
            type="button"
            className={styles.menuToggle}
            aria-expanded={menuOpen}
            aria-controls="portal-menu"
            aria-label={menuOpen ? t("portalPage.menuCloseLabel") : t("portalPage.menuOpenLabel")}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {t("portalPage.menuLabel")}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav id="portal-menu" className={`${styles.wrap} ${styles.menuDrawer}`} aria-label={t("portalPage.navLabel")}>
          {links}
        </nav>
      ) : null}
    </header>
  );
}
