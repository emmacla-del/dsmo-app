"use client";

// The masthead every public page shares: the CAMLEAP logo with its
// endorsement in words, three tabs, the way in, and the language switch.
// Reference: the CAMLEAP website (2026-10-14). The pilot strip that sat
// above it was removed on 2026-10-21; its sentence is now under the home
// hero's buttons (HomeView, homePilotNote).
//
// The current tab comes from the pathname. On a phone (2026-10-21) the tabs
// fold behind a "Menu" button and open as a list under the header, pushing
// the page down (the GOV.UK service-navigation pattern, not a side drawer).
// Sign-in and the language switch stay in the top row: the first is how a
// respondent comes back, the second must be on every page.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageLink } from "@/components/LanguageLink";
import { SITE_NAV } from "./site-content";
import { usePortalEntry } from "./use-portal-entry";
import styles from "../portal.module.css";

const NAV_ID = "site-nav";

export function SiteMasthead() {
  const t = useTranslations("site");
  const pathname = usePathname();
  const entry = usePortalEntry();
  const [menuOpen, setMenuOpen] = useState(false);

  // A new page closes the menu. Stored as the pathname the menu was opened
  // on, so no effect has to reset it.
  const [openedOn, setOpenedOn] = useState(pathname);
  const open = menuOpen && openedOn === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={styles.masthead}>
      <div className={`${styles.container} ${styles.mastheadInner}`}>
        <Link href="/" className={styles.lockup}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/camleap-logo.svg" alt="CAMLEAP" width={146} height={22} className={styles.logo} />
          <span className={styles.endorsement}>{t("endorsement")}</span>
        </Link>

        <nav
          id={NAV_ID}
          className={open ? `${styles.nav} ${styles.navOpen}` : styles.nav}
          aria-label={t("navLabel")}
        >
          {SITE_NAV.map(({ key, href }) => {
            const current = pathname === href;
            return (
              <Link
                key={key}
                href={href}
                className={current ? styles.navCurrent : undefined}
                aria-current={current ? "page" : undefined}
              >
                {t(key)}
              </Link>
            );
          })}
        </nav>

        <div className={styles.mastheadTools}>
          <Link href={entry.spaceHref} className={styles.signIn}>
            {entry.spaceLabel}
          </Link>
          <LanguageLink compact />
          <button
            type="button"
            className={styles.menuToggle}
            aria-expanded={open}
            aria-controls={NAV_ID}
            onClick={() => {
              setOpenedOn(pathname);
              setMenuOpen(!open);
            }}
          >
            {t("navMenu")}
            <span className={styles.menuChevron} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
