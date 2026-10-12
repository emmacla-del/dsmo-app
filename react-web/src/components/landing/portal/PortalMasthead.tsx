import Link from "next/link";
import { useTranslations } from "next-intl";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import styles from "../portal.module.css";

// The lockup is BrandLockup, not a bare <img>: it owns the ONEFOP emblem's
// 56px floor and the endorsement wording docs/standards/brand.md fixes.

export function PortalMasthead() {
  const t = useTranslations();

  return (
    <header className={styles.masthead}>
      <div className={`${styles.wrap} ${styles.mastheadInner}`}>
        <div>
          <BrandLockup size="hero" />
          <p className={styles.endorsement}>{t("landingPage.endorsement")}</p>
        </div>
        <div className={styles.mastheadActions}>
          <Link href="/login" className="cam-button cam-button-secondary">
            {t("portalPage.signInAction")}
          </Link>
          <LocaleSwitcher variant="masthead" />
        </div>
      </div>
    </header>
  );
}
