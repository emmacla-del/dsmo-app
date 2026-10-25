import { useTranslations } from "next-intl";
import { PROGRAMME_PHASES } from "./site-content";
import { SiteCta } from "./SiteCta";
import styles from "../portal.module.css";

// Le programme: why it exists, its two pillars, its four phases (the
// roadmap is this section, not a page of its own), and who it serves.

export function ProgrammeView() {
  const t = useTranslations("site");

  return (
    <>
      <section className={styles.pageHead}>
        <div className={styles.container}>
          <h1>{t("progTitle")}</h1>
          <p className={styles.lede}>{t("progLede")}</p>
        </div>
      </section>

      <nav className={`${styles.container} ${styles.subnav}`} aria-label={t("progSubnavLabel")}>
        <a href="#pourquoi">{t("progNavWhy")}</a>
        <a href="#piliers">{t("progNavPillars")}</a>
        <a href="#phases">{t("progNavPhases")}</a>
        <a href="#beneficiaires">{t("progNavForWhom")}</a>
      </nav>

      <section className={styles.section} id="pourquoi">
        <div className={styles.sectionGrid}>
          <h2>{t("progWhyTitle")}</h2>
          <div className={styles.stack}>
            <p className={styles.lede}>{t("progWhyLede")}</p>
            <p className={styles.muted}>{t("progWhyBody1")}</p>
            <p className={styles.muted}>{t("progWhyBody2")}</p>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionWash}`} id="piliers">
        <div className={styles.sectionGrid}>
          <h2>{t("progPillarsTitle")}</h2>
          <div className={styles.grid2}>
            <div className={styles.card}>
              <h3>{t("progPillar1Title")}</h3>
              <p className={styles.muted}>{t("progPillar1Body")}</p>
            </div>
            <div className={styles.card}>
              <h3>{t("progPillar2Title")}</h3>
              <p className={styles.muted}>{t("progPillar2Body")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="phases">
        <div className={styles.sectionGrid}>
          <h2>{t("progPhasesTitle")}</h2>
          <div className={styles.stack}>
            <p className={styles.muted}>{t("progPhasesIntro")}</p>
            {/* The home page's numbered sequence, kept stacked: each phase
                carries its list (2026-10-21). */}
            <ol className={`${styles.phases} ${styles.phasesVertical}`}>
              {PROGRAMME_PHASES.map(({ n, now, items }) => (
                <li key={n} className={now ? styles.phaseNow : undefined}>
                  <span className={styles.phaseMarker} aria-hidden="true">
                    {String(n).padStart(2, "0")}
                  </span>
                  <span className={styles.state}>{t(`progPhase${n}State`)}</span>
                  <h3>{t(`progPhase${n}Title`)}</h3>
                  <p>{t(`progPhase${n}Body`)}</p>
                  <ul className={styles.bullets}>
                    {Array.from({ length: items }, (_, i) => (
                      <li key={i}>{t(`progPhase${n}Item${i + 1}`)}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionWash}`} id="beneficiaires">
        <div className={styles.sectionGrid}>
          <h2>{t("progForWhomTitle")}</h2>
          <div className={styles.grid2}>
            {(["Gov", "Employers", "Centres", "Public"] as const).map((who) => (
              <div key={who} className={styles.card}>
                <h3>{t(`progFor${who}Title`)}</h3>
                <p className={styles.muted}>{t(`progFor${who}Body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteCta title={t("progCtaTitle")} body={t("progCtaBody")} action={t("registerAction")} />
    </>
  );
}
