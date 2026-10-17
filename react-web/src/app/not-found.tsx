"use client";

// 404, in the public site's chrome: the same masthead and footer, one card,
// two ways out. No inline styling: every value comes from portal.module.css,
// which reads tokens.css.
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SiteMasthead } from "@/components/landing/site/SiteMasthead";
import { SiteFooter } from "@/components/landing/site/SiteFooter";
import styles from "@/components/landing/portal.module.css";

export default function NotFound() {
  const t = useTranslations("notFoundPage");

  return (
    <div className={styles.page}>
      <SiteMasthead />
      <main id="contenu" className={styles.main}>
        <section className={`${styles.section} ${styles.sectionWash}`}>
          <div className={styles.container}>
            <div className={`${styles.card} ${styles.notFound}`}>
              <p className={styles.eyebrow}>{t("eyebrow")}</p>
              <h1>{t("title")}</h1>
              <p className={styles.muted}>{t("body")}</p>
              <div className={styles.actions}>
                <Link href="/" className={styles.btn}>
                  {t("homeAction")}
                </Link>
                <Link href="/assistance" className={`${styles.btn} ${styles.btnGhost}`}>
                  {t("portalAction")}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
