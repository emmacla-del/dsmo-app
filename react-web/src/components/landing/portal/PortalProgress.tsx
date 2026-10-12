import Link from "next/link";
import { useTranslations } from "next-intl";
import { PORTAL_ACHIEVEMENTS } from "./portal-content";
import styles from "../portal.module.css";

// The one dark band on the page, and the only place that says plainly what is
// finished and what is not. Two cards rather than a list, because the split
// between "you can do this today" and "this is still being built" is the
// whole point: a visitor should not have to infer which is which.
//
// The achievements are deliberately modest. "Circuit sans papier" is true of
// the two digitised collections; it is not a claim that paper has ended
// everywhere, which is why the wording names the dispositifs.

export function PortalProgress() {
  const t = useTranslations();

  return (
    <section className={`${styles.section} ${styles.bandInk}`}>
      <div className={`${styles.wrap} ${styles.progressGrid}`}>
        <div>
          <p className={styles.eyebrow}>{t("portalPage.progressEyebrow")}</p>
          <h2 className={styles.heading}>{t("portalPage.progressHeading")}</h2>
          <p className={styles.intro}>{t("portalPage.progressIntro")}</p>

          <ul>
            {PORTAL_ACHIEVEMENTS.map((key) => (
              <li key={key} className={styles.achievement}>
                <span className={styles.noticeLabel}>{t(`portalPage.${key}Label`)}</span>
                {" — "}
                {t(`portalPage.${key}Body`)}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.progressCards}>
          <div className={styles.progressCard}>
            <p className={`${styles.status} ${styles.stateAvailable}`}>
              <span className={`${styles.dot} ${styles.dotLive}`} aria-hidden="true" />
              {t("portalPage.availableStatus")}
            </p>
            <h3 className={styles.progressCardTitle}>{t("portalPage.availableTitle")}</h3>
            <p className={styles.progressCardBody}>{t("portalPage.availableBody")}</p>
            <Link href="/register?type=enterprise">{t("portalPage.availableAction")}</Link>
          </div>

          <div className={styles.progressCard}>
            <p className={`${styles.status} ${styles.stateBuilding}`}>
              <span className={`${styles.dot} ${styles.dotNext}`} aria-hidden="true" />
              {t("portalPage.buildingStatus")}
            </p>
            <h3 className={styles.progressCardTitle}>{t("portalPage.buildingTitle")}</h3>
            <p className={styles.progressCardBody}>{t("portalPage.buildingBody")}</p>
            <a href="#feuille">{t("portalPage.buildingAction")}</a>
          </div>
        </div>
      </div>
    </section>
  );
}
