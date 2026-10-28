"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export type RegistrationsHubTab = "queue" | "organisations" | "register" | "coverage";

/** Shared navigation for the registration workflow and establishment register. */
export function RegistrationsHubTabs({
  activeTab,
  canReviewRegistrations,
}: {
  activeTab: RegistrationsHubTab;
  canReviewRegistrations: boolean;
}) {
  const t = useTranslations("adminInscriptionsPage");
  const tNav = useTranslations("adminNav");
  const tabs = [
    ...(canReviewRegistrations ? [
      { id: "queue" as const, label: t("viewQueue"), href: "/admin/inscriptions?vue=queue" },
      { id: "organisations" as const, label: t("viewOrganisations"), href: "/admin/inscriptions?vue=organisations" },
    ] : []),
    { id: "register" as const, label: tNav("routes.etablissements"), href: "/admin/etablissements" },
    { id: "coverage" as const, label: t("viewCoverage"), href: "/admin/inscriptions?vue=coverage" },
  ];

  return (
    <nav aria-label={t("viewsAriaLabel")} className="cam-admin-tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={activeTab === tab.id ? "page" : undefined}
          className="cam-admin-tab"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
