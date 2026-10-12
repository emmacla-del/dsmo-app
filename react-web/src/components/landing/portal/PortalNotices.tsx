import { useTranslations } from "next-intl";
import styles from "../portal.module.css";

// What a declaration commits you to, and what it returns. Two statements of
// different kinds, so each is opened by its own rule: red for the obligation,
// teal for the receipt.
//
// Both are deliberately narrow. The receipt is "an official PDF carrying a
// unique ONEFOP tracking number" and nothing more — no QR code, which nothing
// in the backend generates (see docs/plans/landing-portal.md).

export function PortalNotices() {
  const t = useTranslations();

  return (
    <section className={`${styles.section} ${styles.bandTeal}`}>
      <div className={styles.wrap}>
        <div className={`${styles.notice} ${styles.noticeObligation}`}>
          <p>
            <span className={styles.noticeLabel}>{t("portalPage.authorityLabel")}</span>{" "}
            {t("portalPage.authorityBody")}
          </p>
        </div>
        <div className={styles.notice}>
          <p>
            <span className={styles.noticeLabel}>{t("portalPage.receiptLabel")}</span>{" "}
            {t("portalPage.receiptBody")}
          </p>
        </div>
      </div>
    </section>
  );
}
