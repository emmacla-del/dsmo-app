"use client";

import { useTranslations } from "next-intl";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { DeclarationsList } from "@/components/admin/DeclarationsList";
import { SETTINGS_ROLES } from "@/lib/roles";

export default function DeclarationsDsmoPage() {
  const t = useTranslations();
  const { isLoading, forbidden } = useAdminScreenGuard(SETTINGS_ROLES);

  if (isLoading) return <p>{t("common.loading")}</p>;

  if (forbidden) {
    return (
      <div>
        <h1 style={{ fontSize: "var(--cam-font-size-xl)", fontWeight: 700, margin: "0 0 var(--cam-space-2)" }}>
          {t("homeDeclarationsDsmoPage.accessDeniedTitle")}
        </h1>
        <p style={{ color: "var(--cam-text-muted)" }}>{t("homeDeclarationsDsmoPage.accessDeniedBody")}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "var(--cam-font-size-xl)", fontWeight: 700, margin: "0 0 var(--cam-space-4)" }}>
        {t("homeDeclarationsDsmoPage.pageTitle")}
      </h1>
      <DeclarationsList />
    </div>
  );
}
