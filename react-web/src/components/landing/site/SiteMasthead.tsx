"use client";

// The masthead every public page shares (owner, 2026-11-25: « this simple
// masthead »): one white row, the flag ribbon under it.
//
// Left, the front-door lockup (brand.md): the ONEFOP emblem at 56px (its
// floor), a thin rule, the CAMLEAP wordmark in the official navy. Right,
// the three tabs (the current one underlined in teal), « Connexion » and
// the other language as an outlined button. Under the row, the tricolour
// in three equal thirds. The row and its ribbon are sticky.
//
// The sign-in family and the staff console keep OfficialBand; this header
// is the public site's only.
//
// The current tab comes from the pathname. On a phone (2026-10-21) the tabs
// fold behind a "Menu" button and open as a list under the bar, pushing the
// page down (the GOV.UK service-navigation pattern, not a side drawer).
// Sign-in and the language stay in the bar: the first is how a respondent
// comes back, the second must be on every page.

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
    <header className={styles.simpleHeader}>
      <div className={`${styles.container} ${styles.simpleInner}`}>
        <Link href="/" className={styles.simpleLockup}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/onefop_logo.png" alt={t("officialOnefopAlt")} width={56} height={55} className={styles.simpleEmblem} />
          <span className={styles.simpleRule} aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/camleap-logo-navy.svg" alt="CAMLEAP" width={170} height={24} className={styles.simpleLogo} />
        </Link>

        <nav
          id={NAV_ID}
          className={open ? `${styles.simpleNav} ${styles.simpleNavOpen}` : styles.simpleNav}
          aria-label={t("navLabel")}
        >
          {SITE_NAV.map(({ key, href }) => {
            const current = pathname === href;
            return (
              <Link
                key={key}
                href={href}
                className={current ? styles.simpleNavCurrent : undefined}
                aria-current={current ? "page" : undefined}
              >
                {t(key)}
              </Link>
            );
          })}
        </nav>

        <div className={styles.simpleTools}>
          <Link href={entry.spaceHref} className={styles.simpleSignIn}>
            {entry.spaceLabel}
          </Link>
          <span className={styles.simpleLanguage}>
            <LanguageLink compact />
          </span>
          <button
            type="button"
            className={styles.simpleMenuToggle}
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
      <div className={styles.simpleRibbon} aria-hidden="true" />
    </header>
  );
}
