"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { SITE_CONTACT, SITE_NAV } from "./site-content";
import { usePortalEntry } from "./use-portal-entry";
import styles from "../portal.module.css";

// The footer every public page shares: who runs the platform, the two
// published contacts, the legal basis of the collection, and the nav.
// On the official navy since 2026-11-11 (option D), with the ONEFOP emblem
// at 64px (never below 56px, brand.md) and the flag ribbon closing the page.
// Three columns since the home page redesign (2026-11-24): who runs the
// platform (the emblem and the CAMLEAP logo, each on its white plate), the pages, the contacts;
// the legal basis under them.

export function SiteFooter() {
  const t = useTranslations("site");
  const entry = usePortalEntry();

  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerColumns}`}>
        <div className={styles.footerIdentity}>
          <div className={styles.footerMarks}>
            <span className={styles.footerEmblem}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/onefop_logo.png" alt="" width={64} height={63} />
            </span>
            <span className={styles.logoPlate}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/camleap-logo.svg" alt="CAMLEAP" width={150} height={21} className={styles.footerLogo} />
            </span>
          </div>
          <p className={styles.footerName}>
            <strong>CAMLEAP</strong> · {t("platformName")}
          </p>
          <p className={styles.footerOrg}>{t("footerOrg")}</p>
          <p>{t("footerMinistry")}</p>
        </div>
        <nav className={styles.footerColumn} aria-label={t("navLabel")}>
          <h2 className={styles.footerHeading}>{t("footerNavTitle")}</h2>
          {SITE_NAV.map(({ key, href }) => (
            <Link key={key} href={href}>
              {t(key)}
            </Link>
          ))}
          <Link href={entry.spaceHref}>{entry.spaceLabel}</Link>
        </nav>
        <div className={styles.footerColumn}>
          <h2 className={styles.footerHeading}>{t("footerContactTitle")}</h2>
          <a href={SITE_CONTACT.whatsappHref} target="_blank" rel="noopener noreferrer">
            {t("contactWhatsappLabel")} {SITE_CONTACT.whatsappDisplay}
          </a>
          <a href={`mailto:${SITE_CONTACT.email}`}>{SITE_CONTACT.email}</a>
        </div>
      </div>
      <div className={styles.container}>
        <p className={styles.footerLegal}>{t("footerLegal")}</p>
      </div>
      <div className={styles.flagRibbon} aria-hidden="true" />
    </footer>
  );
}
