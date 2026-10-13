"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { getOpenCampaigns } from "@/lib/api-client";
import { nextCampaignDeadline } from "@/lib/portal-campaigns";
import { PORTAL_ABOUT } from "./portal-content";
import { PortalStatus } from "./PortalStatus";
import styles from "../portal.module.css";

// The first band of the Home view: what CAMLEAP is, what it replaces, and the
// one thing a declarant has to know before anything else — that declaring
// needs an account.
//
// The figure beside it is the reference mockup's paper -> digital idea, flat:
// two panels and an arrow, carrying their own words rather than being
// decoration with an aria-label. Where the collection came from and where it
// is going at length is the About view's job, not the hero's.

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
          <p className={styles.heroRequirement}>{t("portalPage.heroRequirement")}</p>

          <p className={styles.heroActions}>
            <Link href="/declarer" className="cam-button cam-button-primary">
              {t("portalPage.heroPrimaryAction")}
            </Link>
            <Link href={PORTAL_ABOUT.href} className="cam-button cam-button-secondary">
              {t("portalPage.heroSecondaryAction")}
            </Link>
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

        <figure className={styles.figure}>
          <div className={styles.figurePanel}>
            <p className={styles.figureStep}>{t("portalPage.figureBeforeStep")}</p>
            <p className={styles.figureTitle}>{t("portalPage.figureBeforeTitle")}</p>
          </div>
          <p className={styles.figureArrow} aria-hidden="true">
            ↓
          </p>
          <div className={`${styles.figurePanel} ${styles.figurePanelInk}`}>
            <p className={styles.figureStep}>{t("portalPage.figureAfterStep")}</p>
            <p className={styles.figureTitle}>{t("portalPage.figureAfterTitle")}</p>
          </div>
        </figure>
      </div>
    </section>
  );
}
