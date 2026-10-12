import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "../portal.module.css";

// The WhatsApp number is the only published support channel (it is the one in
// messages/*.json); nothing else is invented here. The forgotten-identifier
// link goes to /login, which carries that pane.

export function PortalSupport() {
  const t = useTranslations();

  return (
    <section id="assistance" className={`${styles.section} ${styles.bandCream}`}>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>{t("portalPage.helpEyebrow")}</p>
        <h2 className={styles.heading}>{t("portalPage.helpHeading")}</h2>
        <p className={styles.intro}>{t("portalPage.helpBody")}</p>
        <p className={styles.helpChannel}>
          <span className={styles.noticeLabel}>{t("portalPage.helpChannelLabel")}</span>{" "}
          <a href="https://wa.me/237651965905" target="_blank" rel="noopener noreferrer">
            {t("portalPage.helpWhatsapp")}
          </a>
          {" · "}
          <Link href="/login">{t("portalPage.forgotIdentifierLink")}</Link>
        </p>
      </div>
    </section>
  );
}
