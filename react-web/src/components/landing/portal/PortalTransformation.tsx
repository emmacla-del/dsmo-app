import { useTranslations } from "next-intl";
import { PORTAL_TRANSFORM } from "./portal-content";
import { PortalStatus } from "./PortalStatus";
import styles from "../portal.module.css";

// Why the platform exists, in four steps, each carrying the state it is
// actually in — so the band cannot read as four equal promises.
//
// The caveat at the end is deliberate. Returning sector summaries to
// employers is the most attractive thing on this page and the furthest from
// being built, so it says plainly that it belongs to phase 3 and that nothing
// is promised until the analytical layer exists.

export function PortalTransformation() {
  const t = useTranslations();

  return (
    <section id="pourquoi" className={`${styles.section} ${styles.bandCream}`}>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>{t("portalPage.transformEyebrow")}</p>
        <h2 className={styles.heading}>{t("portalPage.transformHeading")}</h2>
        <p className={styles.intro}>{t("portalPage.transformIntro")}</p>

        <ol className={styles.steps}>
          {PORTAL_TRANSFORM.map(({ key, state }, index) => (
            <li key={key} className={styles.step}>
              <p className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</p>
              <h3 className={styles.stepTitle}>{t(`portalPage.${key}Title`)}</h3>
              <p className={styles.stepDesc}>{t(`portalPage.${key}Desc`)}</p>
              <PortalStatus state={state}>{t(`portalPage.${key}Status`)}</PortalStatus>
            </li>
          ))}
        </ol>

        <div className={`${styles.notice} ${styles.noticeCaveat}`}>
          <p>
            <span className={styles.noticeLabel}>{t("portalPage.benchmarkLabel")}</span>{" "}
            {t("portalPage.benchmarkBody")}
          </p>
        </div>
      </div>
    </section>
  );
}
