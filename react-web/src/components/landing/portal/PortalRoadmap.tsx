import { useTranslations } from "next-intl";
import { PORTAL_PHASES } from "./portal-content";
import { PortalStatus } from "./PortalStatus";
import styles from "../portal.module.css";

// The programme's four phases, each with the state it is actually in. This
// sits below the doors on purpose: a declarant under a deadline should not
// have to scroll past the roadmap to reach their declaration.

export function PortalRoadmap() {
  const t = useTranslations();

  return (
    <section className={`${styles.section} ${styles.bandCream}`}>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>{t("portalPage.roadmapEyebrow")}</p>
        <h2 className={styles.heading}>{t("portalPage.roadmapHeading")}</h2>
        <p className={styles.intro}>{t("portalPage.roadmapIntro")}</p>

        <ul className={styles.roadmap}>
          {PORTAL_PHASES.map(({ key, state }) => (
            <li key={key} className={styles.phase}>
              <div className={styles.phaseHeader}>
                <h3 className={styles.phaseTitle}>{t(`portalPage.${key}Title`)}</h3>
                <PortalStatus state={state}>{t(`portalPage.${key}Status`)}</PortalStatus>
              </div>
              <p className={styles.phaseDesc}>{t(`portalPage.${key}Desc`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
