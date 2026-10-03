"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { CampaignManagement } from "@/components/admin/CampaignManagement";
import { SendNotificationForm } from "@/components/admin/SendNotificationForm";
import { SETTINGS_ROLES } from "@/lib/roles";

// Matches home_screen.dart: only SUPER_ADMIN gets a "Communication" nav entry.
export default function CommunicationPage() {
  const t = useTranslations();
  const { isLoading, forbidden } = useAdminScreenGuard(SETTINGS_ROLES);
  const [tab, setTab] = useState<"campaigns" | "notifications">("campaigns");

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
      <div role="tablist" style={{ display: "flex", gap: "var(--cam-space-2)", marginBottom: "var(--cam-space-4)", borderBottom: "var(--cam-border-width) solid var(--cam-border)" }}>
        {(["campaigns", "notifications"] as const).map((tabKey) => (
          <button
            key={tabKey}
            role="tab"
            aria-selected={tab === tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            style={{
              padding: "var(--cam-space-2) var(--cam-space-4)",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontWeight: tab === tabKey ? 700 : 400,
              color: tab === tabKey ? "var(--cam-green)" : "var(--cam-text)",
              borderBottom: tab === tabKey ? "3px solid var(--cam-green)" : "3px solid transparent",
            }}
          >
            {tabKey === "campaigns" ? t("homeCommunicationPage.campaignsTabLabel") : t("homeCommunicationPage.notificationsTabLabel")}
          </button>
        ))}
      </div>

      {tab === "campaigns" && <CampaignManagement />}
      {tab === "notifications" && <SendNotificationForm />}
    </div>
  );
}
