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

// `slim`: the working screens' variant (the respondent area). One line of
// words under the flag ribbon and no emblem, which is never drawn below
// 56px; the full band stays at the front door.
//
// `console`: the staff console's masthead (owner, 2026-11-11: the ONEFOP
// emblem, not the coat of arms). The full band, tightened: a 64px disc
// around the 56px emblem, full width, and no ribbon of its own, because the
// console already pins the national tricolour at the top of the window.
export function OfficialBand({ slim = false, console: isConsole = false }: { slim?: boolean; console?: boolean }) {
  const t = useTranslations("site");

  if (slim) {
    return (
      <div className={`${styles.band} ${styles.slim}`}>
        <div className={styles.ribbon} aria-hidden="true" />
        <p className={styles.slimLine}>
          <span className={styles.strong}>{t("officialRepublic")}</span>
          <span aria-hidden="true"> · </span>
          <span>{t("officialShort")}</span>
        </p>
      </div>
    );
  }

  return (
    <div className={isConsole ? `${styles.band} ${styles.console}` : styles.band}>
      {!isConsole && <div className={styles.ribbon} aria-hidden="true" />}
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
