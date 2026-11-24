"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { inscriptionsViewHref } from "@/lib/inscriptions";

export type RegistrationsHubTab = "queue" | "organisations" | "register";

/** Shared navigation for the registration workflow and establishment register. */
export function RegistrationsHubTabs({
  activeTab,
  canReviewRegistrations,
  currentQuery = "",
  counts,
}: {
  activeTab: RegistrationsHubTab;
  canReviewRegistrations: boolean;
  currentQuery?: string;
  /** Tab counts, as on the canvas boards; omitted when not known yet. */
  counts?: { queue?: string; organisations?: string };
}) {
  const t = useTranslations("adminInscriptionsPage");
  const tNav = useTranslations("adminNav");
  const tabs = [
    ...(canReviewRegistrations ? [
      { id: "queue" as const, label: t("viewQueue"), href: inscriptionsViewHref(currentQuery, "queue"), count: counts?.queue },
      { id: "organisations" as const, label: t("viewOrganisations"), href: inscriptionsViewHref(currentQuery, "organisations"), count: counts?.organisations },
    ] : []),
    { id: "register" as const, label: tNav("routes.etablissements"), href: "/admin/etablissements", count: undefined },
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
          {tab.count !== undefined && <span className="cam-admin-tab-count">{tab.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
