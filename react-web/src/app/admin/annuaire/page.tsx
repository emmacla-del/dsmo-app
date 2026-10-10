"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { resolveEffectiveRole } from "@/lib/role-navigation";
import { CompaniesDirectory } from "@/components/admin/CompaniesDirectory";
import { UsersDirectory } from "@/components/admin/UsersDirectory";
import { USER_ADMIN_ROLES } from "@/lib/roles";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { ViewSwitch } from "@/components/admin/ViewSwitch";
import { DataState } from "@/components/admin/DataState";
import { hrefWith } from "@/lib/admin-url";

// The account and entity directory, inside the admin console (Administration
// hub). It lived at /home/annuaire, outside the console shell, so opening it
// from the admin sidebar dropped the sidebar; /home/annuaire now redirects
// here. Access is unchanged: USER_ADMIN_ROLES, as before.

function AnnuaireHeader({ title }: { title: string }) {
  const t = useTranslations();
  return (
    <AdminPageHeader
      breadcrumb={[{ label: t("adminNav.hubs.administration") }, { label: title }]}
      title={title}
      actions={<AdminHeaderActions />}
    />
  );
}

export default function AnnuairePage() {
  return (
    <Suspense fallback={null}>
      <AnnuaireContent />
    </Suspense>
  );
}

function AnnuaireContent() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const { isLoading, forbidden, user } = useAdminScreenGuard(USER_ADMIN_ROLES);
  // The list shown is URL state (?tab=), so a reload keeps it.
  const tab: "users" | "companies" = requestedTab === "users" ? "users" : "companies";

  // The guard's non-ready outcomes keep the page chrome and say what is
  // happening; none renders nothing (G10). No user while not loading means
  // the guard is redirecting to /login.
  if (isLoading || forbidden || !user) {
    return (
      <div className="cam-admin-page">
        <AnnuaireHeader title={t("homeAnnuairePage.pageTitle")} />
        <DataState
          state={forbidden ? "forbidden" : "loading"}
          resource={t("homeAnnuairePage.pageTitle")}
          title={forbidden ? t("homeAnnuairePage.accessDeniedTitle") : t("common.loading")}
          hint={forbidden ? t("homeAnnuairePage.accessDeniedMessage") : undefined}
        />
      </div>
    );
  }

  const effectiveRole = resolveEffectiveRole(user);
  const showUsersTab = effectiveRole === "SUPER_ADMIN";

  if (!showUsersTab) {
    return (
      <div className="cam-admin-page">
        <AnnuaireHeader title={t("homeAnnuairePage.pageTitle")} />
        <CompaniesDirectory />
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      <AnnuaireHeader title={t("homeAnnuairePage.pageTitle")} />

      <div>
        <ViewSwitch
          label={t("homeAnnuairePage.listsAriaLabel")}
          items={(["companies", "users"] as const).map((tabKey) => ({
            key: tabKey,
            label: tabKey === "companies" ? t("homeAnnuairePage.companiesTabLabel") : t("homeAnnuairePage.usersTabLabel"),
            active: tab === tabKey,
            href: hrefWith("/admin/annuaire", searchParams.toString(), { tab: tabKey }),
          }))}
        />

        {tab === "companies" && <CompaniesDirectory />}
        {tab === "users" && <UsersDirectory />}
      </div>
    </div>
  );
}
