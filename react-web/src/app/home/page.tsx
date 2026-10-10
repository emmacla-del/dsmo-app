"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { getCachedUser } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { resolveEffectiveRole, roleLabelKey } from "@/lib/role-navigation";
import { NewDeclarationDialog } from "@/components/NewDeclarationDialog";
import { activeQuarterQueryOptions, meQueryOptions, myCompanyQueryOptions } from "@/lib/shared-queries";
import { campaignPhrase, respondentTypeLabel } from "@/lib/respondent-identity";
import { formatCampaignDate } from "@/lib/campaigns";
import { asUiLocale } from "@/lib/register-i18n";

// The four staff destinations, in the order the console lists them.
const STAFF_LINKS = [
  { href: "/admin/pilotage", titleKey: "homeLandingPage.staffDashboard", hintKey: "homeLandingPage.staffDashboardHint" },
  { href: "/admin/dossiers?status=PENDING_REVIEW", titleKey: "homeLandingPage.staffPending", hintKey: "homeLandingPage.staffPendingHint" },
  { href: "/admin/dossiers", titleKey: "homeLandingPage.staffReview", hintKey: "homeLandingPage.staffReviewHint" },
  { href: "/admin/diffusion", titleKey: "homeLandingPage.staffStatistics", hintKey: "homeLandingPage.staffStatisticsHint" },
] as const;

export default function HomeLandingPage() {
  const t = useTranslations();
  const authUser = useAuthStore((s) => s.user);
  const meQuery = useQuery({ ...meQueryOptions, initialData: authUser ?? getCachedUser() ?? undefined });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const locale = asUiLocale(useLocale());
  const companyQuery = useQuery({ ...myCompanyQueryOptions, enabled: authUser?.role === "COMPANY" });
  const quarterQuery = useQuery({ ...activeQuarterQueryOptions, enabled: authUser?.role === "COMPANY" && authUser.status === "ACTIVE" });
  const user = meQuery.data ?? authUser ?? getCachedUser();
  if (!user) {
    return (
      <div style={{ padding: "var(--cam-space-6)", color: "var(--cam-text-muted)" }}>
        {t("common.loading")}
      </div>
    );
  }

  const effectiveRole = resolveEffectiveRole(user);
  const isCompany = user.role === "COMPANY";
  const typeLabel = isCompany
    ? respondentTypeLabel(companyQuery.data?.entityType, locale)
    : roleLabelKey(effectiveRole) ? t(roleLabelKey(effectiveRole)!) : effectiveRole;
  const quarter = quarterQuery.data;
  const campaign = isCompany ? campaignPhrase(quarter, locale) : null;
  const campaignText = campaign && quarter?.isOpen && quarter.deadline
    ? t("homeLandingPage.campaignOpenUntil", { campaign, date: formatCampaignDate(quarter.deadline) })
    : campaign;
  const lede = [typeLabel, campaignText].filter(Boolean).join(" · ");

  return (
    <div>
      {/* A respondent's start page names the establishment and states what
          is open, then offers the one task: declare. The "N sections
          disponibles dans le menu" line said nothing the menu does not. */}
      <h1 style={{ fontSize: "var(--cam-font-size-xl)", fontWeight: 700, margin: "0 0 var(--cam-space-2)" }}>
        {isCompany && companyQuery.data?.name ? companyQuery.data.name : t("homeLandingPage.welcomeTitle")}
      </h1>
      {lede && (
        <p style={{ color: "var(--cam-text-muted)", margin: "0 0 var(--cam-space-5)" }}>{lede}</p>
      )}

      {user.role !== "COMPANY" && (
        <section style={{ maxWidth: 680, marginTop: "var(--cam-space-5)" }}>
          <h2 style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: 700, margin: "0 0 var(--cam-space-2)", color: "var(--cam-text)" }}>
            {t("homeLandingPage.staffConsoleTitle")}
          </h2>
          <p style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)", margin: "0 0 var(--cam-space-3)" }}>
            {t("homeLandingPage.staffConsoleBody")}
          </p>
          {/* A ruled list of links, not a grid of cards. */}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {STAFF_LINKS.map((link) => (
              <li key={link.href} style={{ padding: "var(--cam-space-3) 0", borderTop: "var(--cam-border-width) solid var(--cam-border)" }}>
                <Link href={link.href} style={{ fontWeight: 600, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-green)" }}>
                  {t(link.titleKey)}
                </Link>
                <div style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)" }}>{t(link.hintKey)}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {user.role === "COMPANY" && (
        <section style={{ maxWidth: 680, marginTop: "var(--cam-space-5)" }}>
          <h2 style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: 700, margin: "0 0 var(--cam-space-2)", color: "var(--cam-text)" }}>
            {t("homeLandingPage.newDeclarationHeading")}
          </h2>
          <p style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)", margin: "0 0 var(--cam-space-4)" }}>
            {t("homeLandingPage.newDeclarationDesc")}
          </p>
          <button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="cam-button cam-button-primary"
          >
            {t("homeLandingPage.startDeclarationButton")}
          </button>
        </section>
      )}

      <NewDeclarationDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
