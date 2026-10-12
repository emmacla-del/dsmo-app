import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { getOpenCampaigns } from "@/lib/api-client";
import { nextCampaignDeadline } from "@/lib/portal-campaigns";
import { PORTAL_STORY } from "./portal-content";
import { PortalStatus } from "./PortalStatus";
import styles from "../portal.module.css";

export function PortalHero() {
  const t = useTranslations();
  const locale = useLocale();

  // The next closing date, from the one public campaign route. The page is
  // useful without it, so a failure is silent: no retry, and nothing rendered
  // unless a date actually came back. An anonymous visitor must never meet an
  // error here, and an API that has not deployed this route yet simply leaves
  // the line out rather than showing a date invented in the copy.
  const { data: campaigns } = useQuery({
    queryKey: ["public-campaigns-open"],
    queryFn: getOpenCampaigns,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const nextDeadline = nextCampaignDeadline(campaigns);
  const nextDeadlineLabel = nextDeadline
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" })
        .format(new Date(nextDeadline))
    : null;

  return (
    <section className={`${styles.section} ${styles.bandCream}`}>
      <div className={`${styles.wrap} ${styles.hero}`}>
        <div>
          <p className={styles.eyebrow}>{t("portalPage.eyebrow")}</p>
          <h1 className={styles.title}>{t("portalPage.title")}</h1>
          <p className={styles.lede}>{t("portalPage.lede")}</p>

          <p className={styles.heroActions}>
            <a href="#parcours" className="cam-button cam-button-primary">
              {t("portalPage.heroPrimaryAction")}
            </a>
            <a href="#pourquoi" className="cam-button cam-button-secondary">
              {t("portalPage.heroSecondaryAction")}
            </a>
          </p>

          <PortalStatus state="live">
            {t("portalPage.phaseStatus")}
            {nextDeadlineLabel ? (
              <span className={styles.deadline}>
                {t("portalPage.nextDeadline", { date: nextDeadlineLabel })}
              </span>
            ) : null}
          </PortalStatus>
        </div>

        {/* Where the collection has come from and where it is going. Flat:
            the reference mockup rotates these three cards and drops a shadow
            behind them, which is the decoration this page leaves out. The
            middle step carries the tint because it is the one that is true
            today. */}
        <ol className={styles.story} aria-label={t("portalPage.storyLabel")}>
          {PORTAL_STORY.map((key, index) => (
            <li
              key={key}
              className={`${styles.storyStep} ${index === 1 ? styles.storyStepNow : ""}`}
            >
              <p className={styles.storyEra}>{t(`portalPage.${key}Era`)}</p>
              <h2 className={styles.storyTitle}>{t(`portalPage.${key}Title`)}</h2>
              <p className={styles.storyDesc}>{t(`portalPage.${key}Desc`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
