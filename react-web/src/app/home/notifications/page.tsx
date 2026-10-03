"use client";

import { useTranslations } from "next-intl";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { SendNotificationForm } from "@/components/admin/SendNotificationForm";
import { CAMPAIGN_ROLES } from "@/lib/roles";

export default function NotificationsPage() {
  const t = useTranslations();
  const { isLoading, forbidden } = useAdminScreenGuard(CAMPAIGN_ROLES);

  if (isLoading) return <p>{t("common.loading")}</p>;

  if (forbidden) {
    return (
      <div>
        <h1 style={{ fontSize: "var(--cam-font-size-xl)", fontWeight: 700, margin: "0 0 var(--cam-space-2)" }}>
          {t("homeNotificationsPage.accessDeniedTitle")}
        </h1>
        <p style={{ color: "var(--cam-text-muted)" }}>{t("homeNotificationsPage.accessDeniedBody")}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "var(--cam-font-size-xl)", fontWeight: 700, margin: "0 0 var(--cam-space-4)" }}>
        {t("homeNotificationsPage.pageTitle")}
      </h1>
      <SendNotificationForm />
    </div>
  );
}
