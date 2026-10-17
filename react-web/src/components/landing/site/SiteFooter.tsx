"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { SITE_CONTACT, SITE_NAV } from "./site-content";
import { usePortalEntry } from "./use-portal-entry";
import styles from "../portal.module.css";

// The footer every public page shares: who runs the platform, the two
// published contacts, the legal basis of the collection, and the nav.

export function SiteFooter() {
  const t = useTranslations("site");
  const entry = usePortalEntry();

  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerInner}`}>
        <div>
          <p className={styles.footerOrg}>{t("footerOrg")}</p>
          <p>{t("footerMinistry")}</p>
          <p className={styles.footerContact}>
            <a href={SITE_CONTACT.whatsappHref} target="_blank" rel="noopener noreferrer">
              {t("contactWhatsappLabel")} {SITE_CONTACT.whatsappDisplay}
            </a>
            {" · "}
            <a href={`mailto:${SITE_CONTACT.email}`}>{SITE_CONTACT.email}</a>
          </p>
        </div>
        <nav className={styles.footerNav} aria-label={t("navLabel")}>
          {SITE_NAV.map(({ key, href }) => (
            <Link key={key} href={href}>
              {t(key)}
            </Link>
          ))}
          <Link href={entry.spaceHref}>{entry.spaceLabel}</Link>
        </nav>
      </div>
      <div className={styles.container}>
        <p className={styles.footerLegal}>{t("footerLegal")}</p>
      </div>
    </footer>
  );
}
