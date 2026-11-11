"use client";

// The official band (owner, 2026-11-11, masthead option D): the State and
// the ministry in words, the ONEFOP emblem centred on a white disc, no coat
// of arms. It heads the public site (SiteMasthead) and every page of the
// sign-in family (login, registration, password, e-mail, agent sign-up),
// so the front door says who issues the service before anything else.
//
// The emblem is never drawn below 56px (docs/standards/brand.md): on a
// phone the disc and the ministry line fold away and ONEFOP is named in
// words instead. The band scrolls away; nothing in it is sticky.

import { useTranslations } from "next-intl";
import styles from "./official-band.module.css";

export function OfficialBand() {
  const t = useTranslations("site");

  return (
    <div className={styles.band}>
      <div className={styles.ribbon} aria-hidden="true" />
      <div className={styles.inner}>
        <p className={styles.state}>
          <span className={styles.strong}>{t("officialRepublic")}</span>
          <span className={styles.motto}>{t("officialMotto")}</span>
          <span className={styles.short}>{t("officialShort")}</span>
        </p>
        <span className={styles.disc}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/onefop_logo.png" alt={t("officialOnefopAlt")} width={60} height={59} />
        </span>
        <p className={styles.ministry}>
          <span className={styles.strong}>{t("officialMinistry")}</span>
          <span>{t("officialObservatory")}</span>
        </p>
      </div>
    </div>
  );
}
