import { useTranslations } from "next-intl";
import { Percent } from "lucide-react";

/** The rate is campaign-scoped and is omitted when the dossier list covers all campaigns. */
export function DossierResponseRateKpi({
  campaignId,
  campaignLabel,
  value,
}: {
  campaignId: string;
  campaignLabel?: string;
  value: string;
}) {
  const t = useTranslations("adminDossiersPage");
  const tRoot = useTranslations();

  if (!campaignId) return null;

  return (
    <section className="cam-dossier-kpis" aria-label={t("viewSubmissions")}>
      <div className="cam-dossier-kpi cam-dossier-kpi--blue">
        <span className="cam-dossier-kpi-icon"><Percent size={17} aria-hidden="true" /></span>
        <div>
          <span>{tRoot("adminTargets.responseRateColumn")}</span>
          <small className="cam-admin-quiet-note">
            {t("responseRateCampaignScope", { campaign: campaignLabel || campaignId })}
          </small>
          <strong>{value}</strong>
        </div>
      </div>
    </section>
  );
}
