import Link from "next/link";
import { useTranslations } from "next-intl";
import { PORTAL_JOURNEY } from "./portal-content";
import styles from "../portal.module.css";

// The four steps in the order a declarant meets them: register, sign in,
// complete and validate, submit. Not the four phases of the programme — those
// are the roadmap's, and conflating the two is how a visitor ends up thinking
// the platform will do four things for them rather than asking four of them.
//
// An ordered list, because the order is the content. A rule above each step
// instead of a card around it (CLAUDE.md §8).

export function PortalJourney() {
  const t = useTranslations();

  return (
    <section className={`${styles.section} ${styles.bandWhite}`}>
      <div className={styles.wrap}>
        {/* The owner emptied this label on 2026-10-13. An empty <p> still
            draws its bottom margin, so the band would open on a gap. */}
        {t("portalPage.journeyEyebrow") ? (
          <p className={styles.eyebrow}>{t("portalPage.journeyEyebrow")}</p>
        ) : null}
        <h2 className={styles.heading}>{t("portalPage.journeyHeading")}</h2>
        <p className={styles.intro}>{t("portalPage.journeyIntro")}</p>

        <ol className={styles.journey}>
          {PORTAL_JOURNEY.map((key, index) => (
            <li key={key} className={styles.journeyStep}>
              <p className={styles.journeyNumber}>{String(index + 1).padStart(2, "0")}</p>
              <h3 className={styles.journeyTitle}>{t(`portalPage.${key}Title`)}</h3>
              <p className={styles.journeyDesc}>{t(`portalPage.${key}Desc`)}</p>
            </li>
          ))}
        </ol>

        <p className={styles.journeyAction}>
          <Link href="/declarer" className="cam-button cam-button-primary">
            {t("portalPage.heroPrimaryAction")}
          </Link>
        </p>
      </div>
    </section>
  );
}
