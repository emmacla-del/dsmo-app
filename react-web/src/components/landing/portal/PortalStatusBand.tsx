import { useTranslations } from "next-intl";
import { PORTAL_STATUS_CLAIMS } from "./portal-content";
import styles from "../portal.module.css";

// What phase 1 actually does, as four claims rather than one paragraph of
// prose. Each is something the platform can be held to; the roadmap says what
// is still to come, and nothing here borrows from it.

export function PortalStatusBand() {
  const t = useTranslations();

  return (
    <section className={`${styles.section} ${styles.bandTeal}`}>
      <div className={styles.wrap}>
        <div className={styles.statusPanel}>
          <p className={styles.eyebrow}>{t("portalPage.statusEyebrow")}</p>
          <h2 className={styles.heading}>{t("portalPage.statusTitle")}</h2>
          <ul className={styles.statusList}>
            {PORTAL_STATUS_CLAIMS.map((key) => (
              <li key={key} className={styles.statusItem}>
                {t(`portalPage.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
