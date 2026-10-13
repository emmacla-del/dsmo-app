import Link from "next/link";
import { useTranslations } from "next-intl";
import { PORTAL_ABOUT, PORTAL_NAV } from "./portal-content";
import styles from "../portal.module.css";

// The dark band that closes every route. It carries the whole nav plus the
// About view, which the masthead leaves out: the footer is where a visitor
// who has read the page looks for the programme behind it.

export function PortalFooter() {
  const t = useTranslations();

  return (
    <footer className={styles.footer}>
      <div className={`${styles.wrap} ${styles.footerRow}`}>
        <div>
          <strong>CAMLEAP</strong>
          <p className={styles.footerMinistry}>{t("portalPage.footerMinistry")}</p>
        </div>
        <nav className={styles.footerNav} aria-label={t("portalPage.navLabel")}>
          {[...PORTAL_NAV, PORTAL_ABOUT].map(({ key, href }) => (
            <Link key={key} href={href}>
              {t(`portalPage.${key}`)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
