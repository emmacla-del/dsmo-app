import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { getOpenCampaigns } from "@/lib/api-client";
import { nextCampaignDeadline } from "@/lib/portal-campaigns";
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
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>{t("portalPage.eyebrow")}</p>
        <h1 className={styles.title}>{t("portalPage.title")}</h1>
        <p className={styles.lede}>{t("portalPage.lede")}</p>
        <PortalStatus state="live">
          {t("portalPage.phaseStatus")}
          {nextDeadlineLabel ? (
            <span className={styles.deadline}>
              {t("portalPage.nextDeadline", { date: nextDeadlineLabel })}
            </span>
          ) : null}
        </PortalStatus>
      </div>
    </section>
  );
}
