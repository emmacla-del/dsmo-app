"use client";

import { useTranslations } from "next-intl";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { CampaignManagement } from "@/components/admin/CampaignManagement";
import { COMMUNICATION_ROLES } from "@/lib/roles";

// Matches home_screen.dart: only SUPER_ADMIN gets a "Communication" nav entry.
export default function CommunicationPage() {
  const t = useTranslations();
  const { isLoading, forbidden } = useAdminScreenGuard(COMMUNICATION_ROLES);

  if (isLoading) return <p>{t("common.loading")}</p>;

  if (forbidden) {
    return (
      <div>
        <h1 style={{ fontSize: "var(--cam-font-size-xl)", fontWeight: 700, margin: "0 0 var(--cam-space-2)" }}>
          {t("homeCommunicationPage.accessDeniedTitle")}
        </h1>
        <p style={{ color: "var(--cam-text-muted)" }}>{t("homeCommunicationPage.accessDeniedMessage")}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "var(--cam-font-size-xl)", fontWeight: 700, margin: "0 0 var(--cam-space-4)" }}>
        {t("homeCommunicationPage.pageTitle")}
      </h1>
      <CampaignManagement />
    </div>
  );
}