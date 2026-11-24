"use client";

// The masthead every public page shares (owner, 2026-11-24: the home page
// redesign, « CAMLEAP homepage » mock-up, in the app's own colours):
//
// 1. The flag ribbon.
// 2. The identity row, white: the ministry in capitals, the ONEFOP emblem
//    at 72px (never below 56px, brand.md) beside « ONEFOP » and its full
//    name; on the right the other language, « Nous contacter » (e-mail) and
//    the one way in, « Inscrire mon organisation ». The mock-up's search
//    box is not built: the public site has nothing to search.
// 3. The navigation bar, official navy, sticky: the reversed CAMLEAP logo
//    with the platform's full name and « Une plateforme de l'ONEFOP »,
//    three tabs (the current one on teal), and sign-in.
//
// The sign-in family and the staff console keep OfficialBand; this header
// is the public site's only.
//
// The current tab comes from the pathname. On a phone (2026-10-21) the tabs
// fold behind a "Menu" button and open as a list under the bar, pushing the
// page down (the GOV.UK service-navigation pattern, not a side drawer).
// Sign-in stays in the bar and the language switch in the identity row:
// the first is how a respondent comes back, the second must be on every page.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Mail } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageLink } from "@/components/LanguageLink";
import { SITE_CONTACT, SITE_NAV } from "./site-content";
import { usePortalEntry } from "./use-portal-entry";
import styles from "../portal.module.css";

const NAV_ID = "site-nav";

export function SiteMasthead() {
  const t = useTranslations("site");
  const tAuth = useTranslations("authShared");
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
    <>
      <div className={styles.identityRibbon} aria-hidden="true" />
      <div className={styles.identity}>
        <div className={`${styles.container} ${styles.identityInner}`}>
          <div className={styles.identityOwner}>
            <p className={styles.identityMinistry}>{t("officialMinistry")}</p>
            <div className={styles.identityLockup}>
              {/* The name is written beside it, so the emblem is not read twice. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/onefop_logo.png"
                alt=""
                width={72}
                height={71}
                className={styles.identityEmblem}
              />
              <p className={styles.identityName}>
                <span className={styles.identityAcronym}>ONEFOP</span>{" "}
                <span className={styles.identityFull}>{t("officialObservatory")}</span>
              </p>
            </div>
          </div>
          <div className={styles.identityTools}>
            <LanguageLink compact />
            <div className={styles.identityActions}>
              <a href={`mailto:${SITE_CONTACT.email}`} className={styles.identityContact}>
                <Mail aria-hidden="true" size={18} />
                {t("headerContact")}
              </a>
              <Link href={entry.actionHref} className={styles.identityRegister}>
                <Building2 aria-hidden="true" size={18} />
                {entry.actionLabel(t("homeServiceRegisterTitle"))}
              </Link>
            </div>
          </div>
        </div>
      </div>
      <header className={styles.masthead}>
        <div className={`${styles.container} ${styles.mastheadInner}`}>
          <Link href="/" className={styles.lockup}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/camleap-logo-reversed.svg" alt="CAMLEAP" width={170} height={24} className={styles.logo} />
            <span className={styles.endorsement}>
              <span className={styles.platformName}>{tAuth("subtitle")}</span>
              <span>{t("platformOf")}</span>
            </span>
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
    </>
  );
}
