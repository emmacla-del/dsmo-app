import { useTranslations } from "next-intl";
import styles from "../portal.module.css";

// The two statements a declarant has to be able to rely on: where a
// declaration counts as filed, and what the platform gives back for one.
//
// A left rule in the colour that carries the meaning — red for the deposit
// rule, teal for the receipt — rather than an icon: a shield and a sheet of
// paper say nothing the label does not, and an emoji is not a design system.

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
