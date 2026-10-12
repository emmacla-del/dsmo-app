import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PORTAL_NAV } from "./portal-content";
import styles from "../portal.module.css";

// The lockup is BrandLockup, not a bare <img>: it owns the ONEFOP emblem's
// 56px floor and the endorsement wording docs/standards/brand.md fixes.
//
// The nav marks which band is on screen. aria-current="true" rather than a
// class alone, so the state is announced and not merely drawn; the underline
// is what a sighted visitor sees of the same fact.

export function PortalMasthead() {
  const t = useTranslations();
  const [current, setCurrent] = useState<string | null>(null);

  // The observer is set up once: the bands it watches are rendered by sibling
  // components, so it runs after the first paint rather than against a tree
  // that does not exist yet. The band in the middle third of the viewport is
  // the one considered current — a plain "is it visible" test lights two tabs
  // at once wherever bands meet.
  useEffect(() => {
    const sections = PORTAL_NAV.map(({ target }) => document.getElementById(target)).filter(
      (element): element is HTMLElement => element !== null,
    );
    // Without an observer the nav simply never marks a band, which is a
    // missing nicety rather than a broken page — so no polyfill, and no
    // throwing in an environment that does not have one (jsdom included).
    if (sections.length === 0 || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setCurrent(entry.target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <header className={styles.masthead}>
      <div className={`${styles.wrap} ${styles.mastheadInner}`}>
        <div>
          <BrandLockup size="hero" />
          <p className={styles.endorsement}>{t("landingPage.endorsement")}</p>
        </div>
        <nav className={styles.nav} aria-label={t("portalPage.navLabel")}>
          {PORTAL_NAV.map(({ key, target }) => (
            <a
              key={key}
              href={`#${target}`}
              className={current === target ? styles.navCurrent : undefined}
              aria-current={current === target ? "true" : undefined}
            >
              {t(`portalPage.${key}`)}
            </a>
          ))}
        </nav>
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
