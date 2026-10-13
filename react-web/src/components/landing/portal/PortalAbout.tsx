import { useTranslations } from "next-intl";
import { PORTAL_STORY } from "./portal-content";
import styles from "../portal.module.css";

// The About view's opening: what CAMLEAP is for, and the distinction the
// platform is built on — collection first, analysis after. The LMIS collects,
// validates and stores; the observatory reads what the LMIS holds. They are
// not the same layer (CLAUDE.md §4), and the panel says so rather than
// promising dashboards the collection has not yet fed.
//
// The three eras follow: where the collection came from, where it is, where it
// is going. Flat — the reference mockup rotates these cards, which is
// decoration the owner asked to leave out.

export function PortalAbout() {
  const t = useTranslations();

  return (
    <>
      <section className={`${styles.section} ${styles.bandCream}`}>
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>{t("portalPage.aboutEyebrow")}</p>
          <h1 className={styles.title}>{t("portalPage.aboutTitle")}</h1>
          <p className={styles.lede}>{t("portalPage.aboutBody")}</p>

          <div className={styles.panel}>
            <h2 className={styles.heading}>{t("portalPage.aboutPanelTitle")}</h2>
            <p className={styles.flowHint}>{t("portalPage.aboutPanelBody")}</p>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.bandWhite}`}>
        <div className={styles.wrap}>
          <h2 className={styles.heading}>{t("portalPage.storyLabel")}</h2>

          <ol className={styles.story}>
            {PORTAL_STORY.map((key, index) => (
              <li
                key={key}
                className={`${styles.storyStep} ${index === 1 ? styles.storyStepNow : ""}`}
              >
                <p className={styles.storyEra}>{t(`portalPage.${key}Era`)}</p>
                <h3 className={styles.storyTitle}>{t(`portalPage.${key}Title`)}</h3>
                <p className={styles.storyDesc}>{t(`portalPage.${key}Desc`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
