"use client";

// The masthead every public page shares: the pilot strip, the CAMLEAP logo
// with its endorsement in words, three tabs, the way in, and the language
// switch. Reference: the CAMLEAP website (2026-10-14).
//
// The current tab comes from the pathname. On a phone the tabs wrap onto
// their own row under the logo: the same links, not a second navigation.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageLink } from "@/components/LanguageLink";
import { SITE_NAV } from "./site-content";
import { usePortalEntry } from "./use-portal-entry";
import styles from "../portal.module.css";

export function SiteMasthead() {
  const t = useTranslations("site");
  const pathname = usePathname();
  const entry = usePortalEntry();

  return (
    <>
      <p className={styles.pilotStrip}>
        <span className={styles.pilotBeacon} aria-hidden="true" />
        {t("pilotStrip")}{" "}
        <Link href={entry.actionHref}>{entry.actionLabel(t("pilotStripAction"))}</Link>
      </p>
      <header className={styles.masthead}>
        <div className={`${styles.container} ${styles.mastheadInner}`}>
          <Link href="/" className={styles.lockup}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/camleap-logo.svg" alt="CAMLEAP" width={146} height={22} className={styles.logo} />
            <span className={styles.endorsement}>{t("endorsement")}</span>
          </Link>

          <nav className={styles.nav} aria-label={t("navLabel")}>
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
            <LanguageLink />
          </div>
        </div>
      </header>
    </>
  );
}
