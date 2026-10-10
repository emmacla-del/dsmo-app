import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { OfficialLogo } from "./OfficialLogo";
import styles from "./landing.module.css";

const WHATSAPP_URL = "https://wa.me/237651965905";

// The landing layout around the sign-in card (design: "Triptyque C").
//
//   official bar      the portal notice and the FR / EN switch
//   notices           three short notices for respondents
//   identity          emblem, CAM-LEAP, the name in both languages
//   children          the sign-in card, passed in by the page
//
// On a wide screen these are three columns: notices, identity, sign-in. The
// DOM order is identity, sign-in, notices, which is also the order on a
// phone and the tab order, so the sign-in is reached before the notices.
//
// `wordmarkAs` sets the heading level of "CAM-LEAP". The sign-in view has no
// other heading, so it passes "h1"; the two-factor view has its own <h1> and
// leaves the default.
//
// The children render inside .cam-auth-page, so the existing auth styles in
// globals.css (.card, .tabs, .field, .btn-primary, .help) apply unchanged.
export function LandingShell({
  children,
  wordmarkAs = "div",
}: {
  children: ReactNode;
  wordmarkAs?: "h1" | "div";
}) {
  const t = useTranslations();
  const locale = useLocale();
  const otherLocale = locale === "fr" ? "en" : "fr";
  const Wordmark = wordmarkAs;

  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <p className={styles.mastheadNotice}>{t("sovereignMasthead.officialPortalNotice")}</p>
        <LocaleSwitcher variant="masthead" />
      </header>

      <main className={styles.stage}>
        <section className={styles.identity}>
          <div className={styles.emblem}>
            <OfficialLogo label={t("landingPage.emblemLabel")} />
          </div>
          <Wordmark className={styles.wordmark}>{t("authShared.wordmark")}</Wordmark>
          <p className={styles.name}>{t("authShared.subtitle")}</p>
          <p className={styles.nameOther} lang={otherLocale}>
            {t("landingPage.otherLanguageName")}
          </p>
        </section>

        <div className={`cam-auth-page ${styles.auth}`}>{children}</div>

        <section className={styles.notices} aria-labelledby="landing-notices-heading">
          <h2 id="landing-notices-heading" className={styles.noticesHeading}>
            {t("landingPage.noticesHeading")}
          </h2>
          <article className={styles.notice}>
            <h3>{t("landingPage.notice1Title")}</h3>
            <p>{t("landingPage.notice1Body")}</p>
          </article>
          <article className={styles.notice}>
            <h3>{t("landingPage.notice2Title")}</h3>
            <p>
              {t.rich("landingPage.notice2Body", {
                b: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
          </article>
          <article className={styles.notice}>
            <h3>{t("landingPage.notice3Title")}</h3>
            <p>
              {t.rich("landingPage.notice3Body", {
                a: (chunks) => (
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
