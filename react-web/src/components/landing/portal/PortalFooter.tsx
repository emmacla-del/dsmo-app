import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "../portal.module.css";

export function PortalFooter() {
  const t = useTranslations();

  return (
    <footer className={styles.footer}>
      <div className={`${styles.wrap} ${styles.footerRow}`}>
        <div>
          {t("portalPage.footerBody")}
          <p className={styles.footerMinistry}>{t("portalPage.footerMinistry")}</p>
        </div>
        <Link href="/login">{t("portalPage.signInAction")}</Link>
      </div>
    </footer>
  );
}
