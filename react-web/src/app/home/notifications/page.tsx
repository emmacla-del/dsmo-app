"use client";

import { useTranslations } from "next-intl";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { SendNotificationForm } from "@/components/admin/SendNotificationForm";
import type { UserRole } from "@/lib/user-types";

// The 4 roles with a standalone "Notifications" nav item in
// role-navigation.ts (REGIONAL, CENTRAL, SUPER_ADMIN_DSMO,
// SUPER_ADMIN_ONEFOP) plus plain SUPER_ADMIN, whose raw role is the same
// value a stream-scoped admin's actually carries. DIVISIONAL is
// deliberately excluded even though dsmo.controller.ts's own @Roles()
// guard technically allows it — home_screen.dart's _buildTabs never shows
// this destination to DIVISIONAL, and Flutter's shipped product decision
// is the reference here, not the backend's broader technical allowance.
const NOTIFICATION_ROLES: UserRole[] = ["REGIONAL", "CENTRAL", "SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP"];

export default function NotificationsPage() {
  const t = useTranslations();
  const { isLoading, forbidden } = useAdminScreenGuard(NOTIFICATION_ROLES);

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
