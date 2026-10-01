"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { resolveEffectiveRole } from "@/lib/role-navigation";
import { CompaniesDirectory } from "@/components/admin/CompaniesDirectory";
import { UsersDirectory } from "@/components/admin/UsersDirectory";
import type { UserRole } from "@/lib/user-types";

const ANNUAIRE_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP"];

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
  const { isLoading, forbidden, user } = useAdminScreenGuard(ANNUAIRE_ROLES);
  const [tab, setTab] = useState<"users" | "companies">(
    requestedTab === "users" ? "users" : "companies"
  );

  useEffect(() => {
    if (requestedTab === "users" || requestedTab === "companies") {
      setTab(requestedTab);
    }
  }, [requestedTab]);

  if (isLoading) return <p>{t("common.loading")}</p>;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <h1 className="cam-admin-h1">{t("homeAnnuairePage.accessDeniedTitle")}</h1>
        <p className="cam-admin-lede">{t("homeAnnuairePage.accessDeniedMessage")}</p>
      </div>
    );
  }

  if (!user) return null;

  const effectiveRole = resolveEffectiveRole(user);
  const showUsersTab = effectiveRole === "SUPER_ADMIN";

  if (!showUsersTab) {
    return (
      <div className="cam-admin-page">
        <h1 className="cam-admin-h1">{t("homeAnnuairePage.pageTitle")}</h1>
        <CompaniesDirectory />
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      <h1 className="cam-admin-h1">{t("homeAnnuairePage.pageTitle")}</h1>

      <div>
        <div
          role="tablist"
          style={{
            display: "flex",
            borderBottom: "var(--cam-border-width) solid var(--cam-border)",
            marginBottom: "var(--cam-space-5)",
          }}
        >
          {(["companies", "users"] as const).map((tabKey) => (
            <button
              key={tabKey}
              role="tab"
              aria-selected={tab === tabKey}
              type="button"
              onClick={() => setTab(tabKey)}
              style={{
                padding: "var(--cam-space-2) var(--cam-space-5)",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: "var(--cam-font-size-sm)",
                fontWeight: tab === tabKey ? 700 : 500,
                color: tab === tabKey ? "var(--cam-green)" : "var(--cam-text-muted)",
                borderBottom: tab === tabKey ? "2px solid var(--cam-green)" : "2px solid transparent",
                marginBottom: "-1px",
                transition: "color 0.12s ease, border-color 0.12s ease",
              }}
            >
              {tabKey === "companies"
                ? t("homeAnnuairePage.companiesTabLabel")
                : t("homeAnnuairePage.usersTabLabel")}
            </button>
          ))}
        </div>

        {tab === "companies" && <CompaniesDirectory />}
        {tab === "users" && <UsersDirectory />}
      </div>
    </div>
  );
}
