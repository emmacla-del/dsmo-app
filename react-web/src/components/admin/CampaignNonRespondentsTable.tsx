"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { count } from "@/lib/admin-data-state";
import { formatCampaignDate } from "@/lib/campaigns";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { asUiLocale } from "@/lib/register-i18n";
import {
  groupNonRespondents,
  type CampaignNonRespondentsResponse,
  type NonRespondentGroup,
} from "@/lib/pilotage-targets";

/**
 * The registered establishments of the reader's territory that have not
 * declared for the campaign, grouped by department. No contact data: a
 * reader who may open the establishment's page (`canOpenDetail`) gets a link
 * to it, where the contacts are shown under that page's own rules.
 */
export function CampaignNonRespondentsTable({
  data,
  canOpenDetail,
}: {
  data: CampaignNonRespondentsResponse;
  canOpenDetail: boolean;
}) {
  const t = useTranslations("adminCiblesPage");
  const tTargets = useTranslations("adminTargets");
  const tRoot = useTranslations();
  const locale = asUiLocale(useLocale());
  const groups = groupNonRespondents(data.establishments);

  const typeLabel = (type: string | null) => {
    if (!type) return "—";
    const key = ENTITY_TYPE_OPTION_KEYS[type];
    return key ? tRoot(key) : entityTypeLabel(type);
  };
  const groupLabel = (group: NonRespondentGroup) => {
    if (group.bucket === "central") return tTargets("centralAdministrations");
    if (group.bucket === "unassigned") return tTargets("unassigned");
    if (group.bucket === "nullEntityType") return tTargets("missingEntityType");
    return [group.regionName, group.departmentName].filter(Boolean).join(" — ");
  };

  return (
    <>
      <p className="cam-admin-lede">
        {data.registered === 0
          ? t("nonRespNoRegistered")
          : t("nonRespSummary", { count: data.establishments.length, registered: count(data.registered, locale) })}
        {" "}
        {data.lastReminder
          ? t("nonRespLastReminder", {
              date: formatCampaignDate(data.lastReminder.sentAt),
              count: data.lastReminder.recipientCount,
            })
          : t("nonRespNoReminder")}
      </p>
      {groups.length > 0 && (
        <div className="cam-dash-table-wrap">
          <table className="cam-dash-table cam-target-table">
            <thead>
              <tr>
                <th scope="col">{t("nonRespEstablishmentColumn")}</th>
                <th scope="col">{t("nonRespIdColumn")}</th>
                <th scope="col">{t("nonRespTypeColumn")}</th>
                <th scope="col">{t("nonRespFileColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group.key}>
                  <tr className="cam-target-region">
                    <th scope="colgroup" colSpan={4}>
                      {groupLabel(group)} ({count(group.rows.length, locale)})
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.companyId} className="cam-target-dept">
                      <th scope="row">
                        {canOpenDetail ? (
                          <Link
                            href={`/admin/etablissement-detail?id=${encodeURIComponent(row.establishmentId)}`}
                            className="cam-text-button"
                          >
                            {row.name}
                          </Link>
                        ) : (
                          row.name
                        )}
                      </th>
                      <td>{row.establishmentId}</td>
                      <td>{typeLabel(row.entityType)}</td>
                      <td>
                        {row.fileState === "NONE" ? (
                          t("nonRespFileNONE")
                        ) : (
                          <span className="cam-badge cam-badge-warning">{t(`nonRespFile${row.fileState}`)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
