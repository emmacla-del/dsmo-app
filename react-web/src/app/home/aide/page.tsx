"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getCachedUser } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { myCompanyQueryOptions, meQueryOptions } from "@/lib/shared-queries";
import { SITE_CONTACT } from "@/components/landing/site/site-content";

export default function HomeHelpPage() {
  const t = useTranslations();
  const authUser = useAuthStore((s) => s.user);

  const meQuery = useQuery({
    ...meQueryOptions,
    initialData: authUser ?? getCachedUser() ?? undefined,
  });
  const user = meQuery.data ?? authUser ?? getCachedUser();

  const companyQuery = useQuery({
    ...myCompanyQueryOptions,
    enabled: user?.role === "COMPANY",
  });
  const company = companyQuery.data;

  return (
    <div style={{ maxWidth: "var(--vt-content-max)", margin: "0 auto", padding: "var(--cam-space-5) var(--cam-space-4)", display: "flex", flexDirection: "column", gap: "var(--cam-space-6)" }}>
      {/* Page Header */}
      <div>
        <h1 style={{ margin: "0 0 var(--cam-space-2)", fontSize: "var(--cam-font-size-2xl)", fontWeight: 700, color: "var(--cam-text)" }}>
          {t("homeHelpPage.pageTitle")}
        </h1>
        <p style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)" }}>
          {t("homeHelpPage.pageSubtitle")}
        </p>
      </div>

      {/* 1. Support Channels Card */}
      <section
        style={{
          background: "var(--cam-surface)",
          border: "var(--cam-border-width) solid var(--cam-border)",
          borderRadius: "var(--cam-radius-lg)",
          padding: "var(--cam-space-5) var(--cam-space-6)",
          boxShadow: "var(--cam-shadow-sm)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--cam-space-4)", flexWrap: "wrap", gap: "var(--cam-space-2)" }}>
          <h2 style={{ fontSize: "var(--cam-font-size-base)", fontWeight: 700, margin: 0, color: "var(--cam-text)" }}>
            {t("homeHelpPage.supportHeading")}
          </h2>
          <span style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", background: "var(--cam-surface-subtle)", padding: "var(--cam-space-1) var(--cam-space-3)", borderRadius: "var(--cam-radius-full)" }}>
            {t("homeHelpPage.supportHours")}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))", gap: "var(--cam-space-4)" }}>
          {/* WhatsApp Channel */}
          <div
            style={{
              border: "var(--cam-border-width) solid var(--cam-border)",
              borderRadius: "var(--cam-radius-md)",
              padding: "var(--cam-space-4)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "var(--cam-space-3)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", marginBottom: "var(--cam-space-1)" }}>
                <span aria-hidden="true" style={{ fontSize: "var(--cam-font-size-lg)" }}>💬</span>
                <h3 style={{ fontSize: "var(--cam-font-size-sm)", fontWeight: 700, margin: 0, color: "var(--cam-text)" }}>
                  {t("homeHelpPage.whatsappTitle")}
                </h3>
              </div>
              <p style={{ margin: "0 0 var(--cam-space-2)", fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", lineHeight: "var(--cam-line-height-base)" }}>
                {t("homeHelpPage.whatsappDesc")}
              </p>
              <div style={{ fontSize: "var(--cam-font-size-xs)", fontWeight: 600, color: "var(--cam-text)" }}>
                {SITE_CONTACT.whatsappDisplay}
              </div>
            </div>

            <div>
              <a
                href={SITE_CONTACT.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="cam-button cam-button-primary cam-button-sm"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "var(--cam-space-1)" }}
              >
                <span>💬</span>
                <span>{t("homeLandingPage.whatsappButton")}</span>
              </a>
            </div>
          </div>

          {/* Email Channel */}
          <div
            style={{
              border: "var(--cam-border-width) solid var(--cam-border)",
              borderRadius: "var(--cam-radius-md)",
              padding: "var(--cam-space-4)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "var(--cam-space-3)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", marginBottom: "var(--cam-space-1)" }}>
                <span aria-hidden="true" style={{ fontSize: "var(--cam-font-size-lg)" }}>✉</span>
                <h3 style={{ fontSize: "var(--cam-font-size-sm)", fontWeight: 700, margin: 0, color: "var(--cam-text)" }}>
                  {t("homeHelpPage.emailTitle")}
                </h3>
              </div>
              <p style={{ margin: "0 0 var(--cam-space-2)", fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", lineHeight: "var(--cam-line-height-base)" }}>
                {t("homeHelpPage.emailDesc")}
              </p>
              <div style={{ fontSize: "var(--cam-font-size-xs)", fontWeight: 600, color: "var(--cam-text)" }}>
                {SITE_CONTACT.email}
              </div>
            </div>

            <div>
              <a
                href={`mailto:${SITE_CONTACT.email}`}
                className="cam-button cam-button-secondary cam-button-sm"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "var(--cam-space-1)" }}
              >
                <span>✉</span>
                <span>{t("homeLandingPage.emailButton")}</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Regional Delegation Supervision */}
      <section
        style={{
          background: "var(--cam-surface)",
          border: "var(--cam-border-width) solid var(--cam-border)",
          borderRadius: "var(--cam-radius-lg)",
          padding: "var(--cam-space-5) var(--cam-space-6)",
          boxShadow: "var(--cam-shadow-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", marginBottom: "var(--cam-space-2)" }}>
          <span aria-hidden="true" style={{ fontSize: "var(--cam-font-size-lg)" }}>🏛️</span>
          <h2 style={{ fontSize: "var(--cam-font-size-base)", fontWeight: 700, margin: 0, color: "var(--cam-text)" }}>
            {t("homeHelpPage.delegationHeading")}
          </h2>
        </div>
        <p style={{ margin: "0 0 var(--cam-space-3)", fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", lineHeight: "var(--cam-line-height-base)" }}>
          {t("homeHelpPage.delegationDesc")}
        </p>

        <div style={{ background: "var(--cam-surface-subtle)", padding: "var(--cam-space-3) var(--cam-space-4)", borderRadius: "var(--cam-radius-md)", display: "flex", flexDirection: "column", gap: "var(--cam-space-1)", fontSize: "var(--cam-font-size-xs)" }}>
          <div>{t("homeLandingPage.regionName", { region: company?.region || t("homeLandingPage.noLocation") })}</div>
          {company?.department && (
            <div>{t("homeLandingPage.departmentName", { department: company.department })}</div>
          )}
          {company?.subdivision && (
            <div>{t("homeEstablishmentPage.subdivision")} : <strong>{company.subdivision}</strong></div>
          )}
        </div>
      </section>

      {/* 3. Portal Guide & FAQ Link */}
      <section
        style={{
          background: "var(--cam-surface-subtle)",
          border: "var(--cam-border-width) solid var(--cam-border)",
          borderRadius: "var(--cam-radius-lg)",
          padding: "var(--cam-space-5) var(--cam-space-6)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--cam-space-4)",
        }}
      >
        <div style={{ flex: "1 1 20rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", marginBottom: "var(--cam-space-1)" }}>
            <span aria-hidden="true" style={{ fontSize: "var(--cam-font-size-lg)" }}>📖</span>
            <h2 style={{ fontSize: "var(--cam-font-size-sm)", fontWeight: 700, margin: 0, color: "var(--cam-text)" }}>
              {t("homeHelpPage.portalGuideHeading")}
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", lineHeight: "var(--cam-line-height-base)" }}>
            {t("homeHelpPage.portalGuideDesc")}
          </p>
        </div>

        <div>
          <Link
            href="/assistance"
            className="cam-button cam-button-secondary cam-button-sm"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "var(--cam-space-1)" }}
          >
            <span>{t("homeHelpPage.portalGuideButton")}</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
