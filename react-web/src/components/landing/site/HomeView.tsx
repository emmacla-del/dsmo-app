"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HOME_PHASES } from "./site-content";
import { PortalEntryLink } from "./PortalEntryLink";
import { SiteCta } from "./SiteCta";
import styles from "../portal.module.css";

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
            {/* Who may register, before the button that registers: read
                after it, the condition came too late (2026-10-21). */}
            <p className={styles.pilotNote}>
              {t.rich("homePilotNote", { b: (chunks) => <strong>{chunks}</strong> })}
            </p>
            <div className={styles.actions}>
              <PortalEntryLink className={styles.btn} guestLabel={t("registerAction")} />
              <Link href="/programme" className={styles.textLink}>
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
          {/* Numbered marker, state, title, sentence: no icon tile and no
              pill. The state names the pilot itself; the list's order gives
              the number to screen readers, so the marker is hidden from them
              (2026-10-21). */}
          <ol className={styles.phases}>
            {HOME_PHASES.map(({ n, now }) => (
              <li key={n} className={now ? styles.phaseNow : undefined}>
                <span className={styles.phaseMarker} aria-hidden="true">
                  {String(n).padStart(2, "0")}
                </span>
                <span className={styles.state}>{t(`homePhase${n}State`)}</span>
                <h3>{t(`homePhase${n}Title`)}</h3>
                <p>{t(`homePhase${n}Body`)}</p>
              </li>
            ))}
          </ol>
          {/* After the four phases, read once they have been read; set apart
              from the columns by more than their gap, so it does not read as
              the first phase's link (2026-10-21). */}
          <div className={styles.phasesMore}>
            <Link href="/programme" className={styles.textLink}>
              {t("homeProgrammeMore")}
            </Link>
          </div>
        </div>
      </section>

      {/* 03 · Who participates (Two groups) */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <span className={styles.kicker}>{t("homeWhoEyebrow")}</span>
            <h2>{t("homeWhoTitle")}</h2>
          </div>
          {/* Each block's link is its heading, stretched over the block: the
              link's name is the family, not the whole block read aloud, and
              "See eligibility" is the visual cue only. No icon tile, as in the
              phases above (2026-10-21). */}
          <div className={styles.grid2}>
            <div className={styles.participant}>
              <h3>
                <Link href="/assistance#employeurs">{t("homeWhoEmployersTitle")}</Link>
              </h3>
              <p className={styles.muted}>{t("homeWhoEmployersBody")}</p>
              <span className={styles.textLink} aria-hidden="true">
                {t("seeEligibility")}
              </span>
            </div>
            <div className={styles.participant}>
              <h3>
                <Link href="/assistance#centres">{t("homeWhoCentresTitle")}</Link>
              </h3>
              <p className={styles.muted}>{t("homeWhoCentresBody")}</p>
              <span className={styles.textLink} aria-hidden="true">
                {t("seeEligibility")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 04 · Confidentiality */}
      <section className={`${styles.section} ${styles.sectionWash}`}>
        {/* The section heading every other section uses, on the left edge.
            The outlined shield beside it pushed the heading 72px in and was
            the page's one boxed ornament (2026-10-21). */}
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2>{t("homeDataTitle")}</h2>
            <p className={styles.lede}>{t("homeDataBody")}</p>
            <Link href="/assistance#confidentialite" className={styles.textLink}>
              {t("readPrivacyNotice")}
            </Link>
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
