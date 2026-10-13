// The public portal: five routes that share one masthead and one footer.
//
// The reference mockup switches the whole page from the nav rather than
// scrolling one long document. Here that is a route group: the nav items are
// real routes, so each view has its own URL to share, its own title in the
// visitor's language, and `aria-current` read from the pathname. Nothing is
// hidden in the DOM to make it work.
//
// The group's folder name is in brackets, so it adds no URL segment: the home
// view is still "/".
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { PortalMasthead } from "@/components/landing/portal/PortalMasthead";
import { PortalFooter } from "@/components/landing/portal/PortalFooter";
import styles from "@/components/landing/portal.module.css";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("portalPage");

  return (
    <div className={styles.page}>
      {/* The masthead is on all five routes, so the keyboard path to the
          content runs past the whole nav on each one. */}
      <a href="#contenu" className={styles.skipLink}>
        {t("skipToContent")}
      </a>
      <PortalMasthead />
      <main id="contenu" className={styles.main}>
        {children}
      </main>
      <PortalFooter />
    </div>
  );
}
