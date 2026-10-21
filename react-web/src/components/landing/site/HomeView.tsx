"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HOME_PHASES } from "./site-content";
import { PortalEntryLink } from "./PortalEntryLink";
import { SiteCta } from "./SiteCta";
import styles from "../portal.module.css";

function Mark({ children }: { children: ReactNode }) {
  return (
    <span className={styles.icon} aria-hidden="true">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </span>
  );
}

// `visual` is the hero animation, rendered on the server by the page.
export function HomeView({ visual }: { visual: ReactNode }) {
  const t = useTranslations("site");

  return (
    <>
      {/* 01 · Hero */}
      <section className={styles.hero}>
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div>
            <span className={styles.kicker}>{t("homeEyebrow")}</span>
            {/* One sentence per line; the space keeps them apart for screen readers. */}
            <h1>
              <span className={styles.heroLine}>{t("homeH1Line1")}</span>{" "}
              <span className={styles.heroLine}>{t("homeH1Line2")}</span>
            </h1>
            <p className={styles.lede}>{t("homeLede")}</p>
            <div className={styles.actions}>
              <PortalEntryLink className={styles.btn} guestLabel={t("registerAction")} />
              <Link href="/programme" className={`${styles.btn} ${styles.btnGhost}`}>
                {t("homeDiscover")}
              </Link>
            </div>
          </div>
          <div className={styles.heroVisual}>
            {visual}
          </div>
        </div>
      </section>

      {/* 02 · Programme stages (4 phases) */}
      <section id="programme" className={`${styles.section} ${styles.sectionWash}`}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <span className={styles.kicker}>{t("homeProgrammeTitle")}</span>
            <h2>{t("homeProgrammeLede")}</h2>
          </div>
          <ul className={styles.phases}>
            {HOME_PHASES.map(({ n, now }) => (
              <li key={n} className={now ? styles.phaseNow : undefined}>
                <span className={styles.state}>
                  {t(`homePhase${n}State`)}
                  {now && <span className={styles.pill}>{t("currentPilot")}</span>}
                </span>
                <PhaseMark n={n} />
                <h3>{t(`homePhase${n}Title`)}</h3>
                <p>{t(`homePhase${n}Body`)}</p>
              </li>
            ))}
          </ul>
          <p className={styles.sectionMore}>
            <Link href="/programme" className={styles.textLink}>
              {t("homeProgrammeMore")}
            </Link>
          </p>
        </div>
      </section>

      {/* 03 · Who participates (Two groups) */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <span className={styles.kicker}>{t("homeWhoEyebrow")}</span>
            <h2>{t("homeWhoTitle")}</h2>
          </div>
          <div className={styles.grid2}>
            <Link href="/assistance#employeurs" className={styles.participant}>
              <Mark>
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
              </Mark>
              <h3>{t("homeWhoEmployersTitle")}</h3>
              <p className={styles.muted}>{t("homeWhoEmployersBody")}</p>
              <span className={styles.textLink}>{t("seeEligibility")}</span>
            </Link>
            <Link href="/assistance#centres" className={styles.participant}>
              <Mark>
                <path d="M22 9L12 4 2 9l10 5 10-5z" />
                <path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
              </Mark>
              <h3>{t("homeWhoCentresTitle")}</h3>
              <p className={styles.muted}>{t("homeWhoCentresBody")}</p>
              <span className={styles.textLink}>{t("seeEligibility")}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 04 · Confidentiality */}
      <section className={`${styles.section} ${styles.sectionWash}`}>
        <div className={styles.container}>
          <div className={styles.confGrid}>
            <div className={styles.shield} aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h2>{t("homeDataTitle")}</h2>
              <p className={styles.muted}>{t("homeDataBody")}</p>
              <p>
                <Link href="/assistance#confidentialite" className={styles.textLink}>
                  {t("readPrivacyNotice")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 05 · FAQ */}
      <section id="faq" className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2>{t("helpFaqTitle")}</h2>
          </div>
          <div className={styles.faq}>
            <details>
              <summary>{t("faqRegisterQuestion")}</summary>
              <p>{t("faqRegisterAnswer")}</p>
            </details>
            <details>
              <summary>{t("faqDurationQuestion")}</summary>
              <p>{t("faqDurationAnswer")}</p>
            </details>
            <details>
              <summary>{t("faqDataQuestion")}</summary>
              <p>{t("faqDataAnswer")}</p>
            </details>
          </div>
        </div>
      </section>

      {/* 06 · Closing CTA */}
      <SiteCta title={t("homeCtaTitle")} body={t("homeCtaBody")} action={t("registerAction")} />
    </>
  );
}

function PhaseMark({ n }: { n: number }) {
  if (n === 1) {
    return (
      <Mark>
        <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
        <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </Mark>
    );
  }
  if (n === 2) {
    return (
      <Mark>
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
      </Mark>
    );
  }
  if (n === 3) {
    return (
      <Mark>
        <path d="M3 21h18M6 21V10m6 11V4m6 17v-8" />
      </Mark>
    );
  }
  return (
    <Mark>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a15 15 0 010 18M12 3a15 15 0 000 18M3 12h18" />
    </Mark>
  );
}
