import Link from "next/link";
import { useTranslations } from "next-intl";
import { PORTAL_DOORS } from "./portal-content";
import styles from "../portal.module.css";

// The WhatsApp number is the only published support channel — it is the one in
// messages/*.json, and the same number the sign-in, registration and
// password-reset screens carry. Nothing else is invented here: no email
// address, no landline, no office address.

export function PortalSupport() {
  const t = useTranslations();

  return (
    <section className={`${styles.section} ${styles.bandCream}`}>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>{t("portalPage.helpEyebrow")}</p>
        <h1 className={styles.title}>{t("portalPage.helpHeading")}</h1>
        <p className={styles.intro}>{t("portalPage.helpBody")}</p>

        <p className={styles.helpChannel}>
          <span className={styles.noticeLabel}>{t("portalPage.helpChannelLabel")}</span>{" "}
          <a href="https://wa.me/237651965905" target="_blank" rel="noopener noreferrer">
            {t("portalPage.helpWhatsapp")}
          </a>
        </p>

        <p className={styles.heroActions}>
          <Link href={PORTAL_DOORS[0].href} className="cam-button cam-button-primary">
            {t("portalPage.door1Action")}
          </Link>
          <Link href="/login" className="cam-button cam-button-secondary">
            {t("portalPage.signInAction")}
          </Link>
        </p>

        <div className={styles.notice}>
          <p>
            <span className={styles.noticeLabel}>{t("portalPage.helpAccountLabel")}</span>{" "}
            {t("portalPage.helpAccountBody")}
          </p>
        </div>
      </div>
    </section>
  );
}
