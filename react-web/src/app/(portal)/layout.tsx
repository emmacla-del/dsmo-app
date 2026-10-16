// The public site: three pages (Accueil, Le programme, Assistance) sharing
// one masthead and one footer. Reference: the CAMLEAP website (2026-10-14)
// and docs/standards/ui-grammar.md §Public portal.
//
// The group's folder name is in brackets, so it adds no URL segment: the
// home page is still "/".
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { SiteMasthead } from "@/components/landing/site/SiteMasthead";
import { SiteFooter } from "@/components/landing/site/SiteFooter";
import styles from "@/components/landing/portal.module.css";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("site");

  return (
    <div className={styles.page}>
      <a href="#contenu" className={styles.skipLink}>
        {t("skipToContent")}
      </a>
      <SiteMasthead />
      <main id="contenu" className={styles.main}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
