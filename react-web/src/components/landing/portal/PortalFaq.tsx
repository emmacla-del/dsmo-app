import { useTranslations } from "next-intl";
import { PORTAL_FAQ } from "./portal-content";
import styles from "../portal.module.css";

// The three things people ask before declaring, under the routes that answer
// them. Native <details>, so the answers can be scanned without three
// paragraphs in the way and without a line of JavaScript.
//
// Every answer here is true of the platform as it stands: registration is
// required, the profile decides the questionnaire, and history lives in the
// account because no public lookup exists.

export function PortalFaq() {
  const t = useTranslations();

  return (
    <section className={`${styles.section} ${styles.bandWhite}`}>
      <div className={styles.wrap}>
        <h2 className={styles.heading}>{t("portalPage.faqHeading")}</h2>

        <div className={styles.faq}>
          {PORTAL_FAQ.map((key) => (
            <details key={key} className={styles.faqItem}>
              <summary className={styles.faqSummary}>{t(`portalPage.${key}Question`)}</summary>
              <p className={styles.faqAnswer}>{t(`portalPage.${key}Answer`)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
