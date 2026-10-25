"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { count } from "@/lib/admin-data-state";
import { asUiLocale } from "@/lib/register-i18n";

export interface CampaignReviewStatusItem {
  key: string;
  name: string;
  pendingReview: number;
  correctionRequested: number;
  approved: number;
  href?: string;
}

export function CampaignReviewStatusChart({
  items,
  ariaLabel,
}: {
  items: CampaignReviewStatusItem[];
  ariaLabel: string;
}) {
  const locale = asUiLocale(useLocale());
  const t = useTranslations("adminPilotagePage");

  return (
    <div className="cam-dash-review-chart" role="region" aria-label={ariaLabel}>
      <div className="cam-dash-review-legend" aria-label={t("reviewLegendLabel")}>
        <span><i className="is-pending" />{t("reviewPending")}</span>
        <span><i className="is-correction" />{t("reviewCorrection")}</span>
        <span><i className="is-approved" />{t("reviewApproved")}</span>
      </div>
      <ul className="cam-dash-review-rows">
        {items.map((item) => {
          const total = item.pendingReview + item.correctionRequested + item.approved;
          const pendingPct = total > 0 ? (item.pendingReview / total) * 100 : 0;
          const correctionPct = total > 0 ? (item.correctionRequested / total) * 100 : 0;
          const approvedPct = total > 0 ? (item.approved / total) * 100 : 0;
          const accessibleStatus = t("reviewStatusesAria", {
            name: item.name,
            pending: count(item.pendingReview, locale),
            correction: count(item.correctionRequested, locale),
            approved: count(item.approved, locale),
          });
          const content = (
            <>
              <div className="cam-dash-review-row-head">
                <strong>{item.name}</strong>
                <span>{count(total, locale)} {t("reviewSubmissionsLabel")}</span>
              </div>
              <div className="cam-dash-review-track" role="img" aria-label={accessibleStatus}>
                <span className="is-pending" style={{ width: `${pendingPct}%` }} />
                <span className="is-correction" style={{ width: `${correctionPct}%` }} />
                <span className="is-approved" style={{ width: `${approvedPct}%` }} />
              </div>
              <div className="cam-dash-review-counts">
                <span>{t("reviewPending")}: {count(item.pendingReview, locale)}</span>
                <span>{t("reviewCorrection")}: {count(item.correctionRequested, locale)}</span>
                <span>{t("reviewApproved")}: {count(item.approved, locale)}</span>
              </div>
            </>
          );

          return (
            <li key={item.key}>
              {item.href ? (
                <Link href={item.href} className="cam-dash-review-row" aria-label={accessibleStatus}>
                  {content}
                </Link>
              ) : (
                <div className="cam-dash-review-row">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
