"use client";

import { useTranslations } from "next-intl";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { DeclarationsList } from "@/components/admin/DeclarationsList";
import type { UserRole } from "@/lib/user-types";

// Matches home_screen.dart's _buildTabs: only SUPER_ADMIN_DSMO gets a
// standalone "Déclarations DSMO" tab. Plain SUPER_ADMIN is included too
// (a stream-scoped DSMO admin's raw role is literally "SUPER_ADMIN" — see
// role-navigation.ts's resolveEffectiveRole comment), even though their own
// nav reaches equivalent functionality differently. DIVISIONAL/REGIONAL/
// CENTRAL can also approve/reject via the real backend endpoint
// (@Roles('DIVISIONAL','REGIONAL','CENTRAL','SUPER_ADMIN','SUPER_ADMIN_DSMO')
// on PATCH .../validate) but have no equivalent nav entry in Flutter for
// this particular list view, so they're excluded here too, matching the
// product's shipped navigation rather than the backend's broader technical
// allowance.
const DECLARATIONS_DSMO_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_DSMO"];

export default function DeclarationsDsmoPage() {
  const t = useTranslations();
  const { isLoading, forbidden } = useAdminScreenGuard(DECLARATIONS_DSMO_ROLES);

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
