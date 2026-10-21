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
    <div className="cam-home-page">
      <header className="cam-home-head">
        <div>
          <h1 className="cam-home-title">{t("homeHelpPage.pageTitle")}</h1>
          <p className="cam-home-lede">{t("homeHelpPage.pageSubtitle")}</p>
        </div>
      </header>

      {/* 1. Support channels: one row each, the contact and its action. */}
      <section className="cam-home-section" aria-labelledby="help-support-heading">
        <div className="cam-home-section-head">
          <h2 id="help-support-heading" className="cam-home-h2">{t("homeHelpPage.supportHeading")}</h2>
          <span className="cam-home-meta">{t("homeHelpPage.supportHours")}</span>
        </div>
        <ul className="cam-home-list">
          <li className="cam-home-row">
            <div className="cam-home-row-main">
              <h3 className="cam-home-row-title">{t("homeHelpPage.whatsappTitle")}</h3>
              <p className="cam-home-meta">{t("homeHelpPage.whatsappDesc")}</p>
              <p className="cam-home-body">{SITE_CONTACT.whatsappDisplay}</p>
            </div>
            <div className="cam-home-row-side">
              <a
                href={SITE_CONTACT.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="cam-button cam-button-primary cam-button-sm"
              >
                {t("homeLandingPage.whatsappButton")}
              </a>
            </div>
          </li>
          <li className="cam-home-row">
            <div className="cam-home-row-main">
              <h3 className="cam-home-row-title">{t("homeHelpPage.emailTitle")}</h3>
              <p className="cam-home-meta">{t("homeHelpPage.emailDesc")}</p>
              <p className="cam-home-body">{SITE_CONTACT.email}</p>
            </div>
            <div className="cam-home-row-side">
              <a href={`mailto:${SITE_CONTACT.email}`} className="cam-button cam-button-secondary cam-button-sm">
                {t("homeLandingPage.emailButton")}
              </a>
            </div>
          </li>
        </ul>
      </section>

      {/* 2. The delegation that supervises this establishment. */}
      <section className="cam-home-section" aria-labelledby="help-delegation-heading">
        <h2 id="help-delegation-heading" className="cam-home-h2">{t("homeHelpPage.delegationHeading")}</h2>
        <p className="cam-home-intro">
          {t("homeHelpPage.delegationDesc")}
        </p>
        <p className="cam-home-body">
          {t("homeLandingPage.regionName", { region: company?.region || t("homeLandingPage.noLocation") })}
          {company?.department && (
            <>
              <br />
              {t("homeLandingPage.departmentName", { department: company.department })}
            </>
          )}
          {company?.subdivision && (
            <>
              <br />
              {t("homeEstablishmentPage.subdivision")} : <strong>{company.subdivision}</strong>
            </>
          )}
        </p>
      </section>

      {/* 3. The portal guide. */}
      <section className="cam-home-section" aria-labelledby="help-guide-heading">
        <h2 id="help-guide-heading" className="cam-home-h2">{t("homeHelpPage.portalGuideHeading")}</h2>
        <p className="cam-home-meta">{t("homeHelpPage.portalGuideDesc")}</p>
        <div className="cam-home-actions">
          <Link href="/assistance" className="cam-button cam-button-secondary cam-button-sm">
            {t("homeHelpPage.portalGuideButton")}
          </Link>
        </div>
      </section>
    </div>
  );
}
