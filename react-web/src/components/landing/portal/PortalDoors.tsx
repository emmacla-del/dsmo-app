import Link from "next/link";
import { useTranslations } from "next-intl";
import { PORTAL_DOORS } from "./portal-content";
import styles from "../portal.module.css";

// The three routes a visitor can take, as parallel alternatives. Each is
// bounded because the border is what makes them read as a choice; the two
// declaration doors lead, the third is secondary because following an
// existing dossier is not what most arrivals are here to do.

export function PortalDoors() {
  const t = useTranslations();

  return (
    <section id="parcours" className={`${styles.section} ${styles.bandWhite}`}>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>{t("portalPage.doorsEyebrow")}</p>
        <h2 className={styles.heading}>{t("portalPage.doorsHeading")}</h2>
        <p className={styles.intro}>{t("portalPage.doorsIntro")}</p>

        <div className={styles.doors}>
          {PORTAL_DOORS.map(({ key, href, variant }) => (
            <section key={key} className={styles.door}>
              <div className={styles.doorBody}>
                <p className={styles.doorEyebrow}>{t(`portalPage.${key}Eyebrow`)}</p>
                <h3 className={styles.doorTitle}>{t(`portalPage.${key}Title`)}</h3>
                <p className={styles.doorDesc}>{t(`portalPage.${key}Desc`)}</p>
                <p className={styles.doorRequirement}>{t(`portalPage.${key}Requirement`)}</p>
              </div>
              <p className={styles.doorAction}>
                <Link
                  href={href}
                  className={`cam-button cam-button-${variant} cam-button-block`}
                >
                  {t(`portalPage.${key}Action`)}
                </Link>
              </p>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
