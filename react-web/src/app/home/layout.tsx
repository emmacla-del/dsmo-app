"use client";

import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { getCachedUser } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { useRequireAuth } from "@/lib/use-require-auth";
import { navItemsForRole, resolveEffectiveRole, roleLabelKey } from "@/lib/role-navigation";
import { respondentRailItems } from "@/lib/respondent-rail";
import { LanguageLink } from "@/components/LanguageLink";
import { AuthLoadingSplash } from "@/components/auth/AuthLoadingSplash";
import { NewDeclarationDialog } from "@/components/NewDeclarationDialog";
import {
  activeQuarterQueryOptions,
  meQueryOptions,
  myCompanyQueryOptions,
  mySubmissionsQueryOptions,
  unreadNotificationCountQueryOptions,
} from "@/lib/shared-queries";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { useIsClient } from "@/lib/use-is-client";
import { respondentTypeLabel } from "@/lib/respondent-identity";
import { asUiLocale } from "@/lib/register-i18n";
import { referencePeriodLabel } from "@/lib/onefop-period-label";
import type { ActiveQuarter } from "@/lib/onefop-submission";

// null when no campaign is known: the rail then shows no line rather than
// the label "Current campaign" as if it were the value.
function formatCampaignLine(quarter: ActiveQuarter | null | undefined, locale: "fr" | "en"): string | null {
  if (!quarter) return null;
  if (quarter.isOpen === false) {
    return locale === "fr" ? "Période fermée" : "Period closed";
  }
  let periodStr = "";
  if (quarter.code) {
    const match = /^(?:QUARTERLY_)?(\d{4})[-_]T([1-4])(?:_\d+)?$/.exec(quarter.code);
    if (match) {
      periodStr = locale === "fr" ? `T${match[2]} ${match[1]}` : `Q${match[2]} ${match[1]}`;
    } else {
      periodStr = referencePeriodLabel(quarter.code, locale);
    }
  } else {
    periodStr = quarter.label ?? "";
  }
  if (!periodStr) return null;

  if (!quarter.deadline) return periodStr;
  try {
    const d = new Date(quarter.deadline);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const closesPart = locale === "fr" ? `clôture ${day}/${month}` : `closes ${day}/${month}`;
    return `${periodStr} · ${closesPart}`;
  } catch {
    return periodStr;
  }
}

export default function HomeLayout({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const uiLocale = asUiLocale(useLocale());
  const router = useRouter();
  const pathname = usePathname();
  const authState = useRequireAuth();
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const meQuery = useQuery({
    ...meQueryOptions,
    enabled: authState === "authed",
    initialData: authUser ?? getCachedUser() ?? undefined,
  });
  const user = meQuery.data ?? authUser ?? getCachedUser();
  const isCompany = user?.role === "COMPANY";
  const awaitingApproval =
    isCompany &&
    (user.status === "PENDING_APPROVAL" || user.status === "COMPLEMENTS_REQUESTED");

  const quarterQuery = useQuery({
    ...activeQuarterQueryOptions,
    enabled: authState === "authed" && !awaitingApproval,
  });

  const companyQuery = useQuery({
    ...myCompanyQueryOptions,
    enabled: authState === "authed" && isCompany,
  });

  const submissionsQuery = useQuery({
    ...mySubmissionsQueryOptions,
    enabled: authState === "authed" && isCompany && !awaitingApproval,
  });

  const unreadNotificationsQuery = useQuery({
    ...unreadNotificationCountQueryOptions,
    enabled: authState === "authed" && isCompany,
  });

  const [isNewDeclarationOpen, setIsNewDeclarationOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  useDialogFocus(menuOpen, railRef, () => setMenuOpen(false));

  const mounted = useIsClient();

  useEffect(() => {
    if (!mounted || authState !== "authed") return;
    if (awaitingApproval && pathname !== "/home/inscription-en-attente") {
      router.replace("/home/inscription-en-attente");
    }
  }, [mounted, authState, awaitingApproval, pathname, router]);

  const quarter = quarterQuery.data;

  // Active campaign survey state
  const quarterCode = quarter?.code;
  const activeSubmission = useMemo(() => {
    if (!quarterCode || !submissionsQuery.data) return null;
    const matches = submissionsQuery.data.onefop.filter((s) => (s.quarterCode ?? s.period) === quarterCode);
    // If a filing for this campaign was already endorsed or is pending review, that live state governs.
    const liveMatch = matches.find((s) => s.status === "APPROVED" || s.status === "PENDING_REVIEW");
    if (liveMatch) return liveMatch;

    return (
      matches.find((s) => s.status === "CORRECTION_REQUESTED") ??
      matches.find((s) => s.status === "DRAFT") ??
      matches[0] ??
      null
    );
  }, [quarterCode, submissionsQuery.data]);

  const surveyState = useMemo(() => {
    if (!activeSubmission) return "none";
    if (activeSubmission.status === "DRAFT") return "draft";
    if (activeSubmission.status === "CORRECTION_REQUESTED") return "correction";
    if (activeSubmission.status === "APPROVED") return "approved";
    if (activeSubmission.status === "REJECTED") return "rejected";
    return "pending";
  }, [activeSubmission]);

  // Count of drafts + corrections requiring action (excluding superseded filings whose quarter is already approved/pending):
  const actionRequiredCount = useMemo(() => {
    if (!submissionsQuery.data) return 0;
    const dsmoDrafts = submissionsQuery.data.dsmo.filter((d) => d.status === "DRAFT").length;
    const liveQuarterCodes = new Set(
      submissionsQuery.data.onefop
        .filter((s) => s.status === "APPROVED" || s.status === "PENDING_REVIEW")
        .map((s) => s.quarterCode ?? s.period)
        .filter(Boolean),
    );
    const onefopAction = submissionsQuery.data.onefop.filter(
      (s) =>
        (s.status === "DRAFT" || s.status === "CORRECTION_REQUESTED") &&
        !liveQuarterCodes.has(s.quarterCode ?? s.period),
    ).length;
    return dsmoDrafts + onefopAction;
  }, [submissionsQuery.data]);

  const unreadCount = unreadNotificationsQuery.data?.count ?? 0;

  if (!mounted || authState !== "authed") {
    return <AuthLoadingSplash />;
  }

  const effectiveRole = user ? resolveEffectiveRole(user) : null;
  // While the registration awaits approval, only its status page: every
  // other page sends the respondent back to it (respondent-rail.ts).
  const navItems = respondentRailItems(
    (effectiveRole ? navItemsForRole(effectiveRole) : []).filter(
      (item) => !item.rawRoles || (!!user && item.rawRoles.includes(user.role)),
    ),
    awaitingApproval,
  );

  const campaignLine = awaitingApproval ? null : formatCampaignLine(quarter, uiLocale);
  const companyName = companyQuery.data?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const companyType = respondentTypeLabel(companyQuery.data?.entityType, uiLocale);

  // Button follows survey state: Take survey, Resume, or Correct
  // It disappears once the survey is submitted / pending / approved / rejected or period is closed
  // Not on /home itself, whose survey card carries the same action: one
  // primary action per screen (§11, defect 23 of the 2026-10-16 VT run).
  const showSurveyButton =
    pathname !== "/home" &&
    isCompany &&
    !awaitingApproval &&
    quarter?.isOpen &&
    (surveyState === "none" || surveyState === "draft" || surveyState === "correction");

  return (
    <div className={`cam-home${menuOpen ? " is-menu-open" : ""}`}>
      <div className="cam-home-mobilebar">
        <button
          type="button"
          className="cam-home-menu-button"
          aria-label={t("adminLayout.openMenuAriaLabel")}
          aria-expanded={menuOpen}
          aria-controls="cam-home-rail"
          onClick={() => setMenuOpen(true)}
        >
          <span aria-hidden="true">☰</span>
          <span aria-hidden="true">{t("homeLayout.menuLabel")}</span>
        </button>
        <Link href="/" title={t("homeLayout.backToPublicPortal")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/camleap-logo.svg" alt="CAMLEAP" width={270} height={38} style={{ display: "block", width: 120, height: "auto" }} />
        </Link>
      </div>
      <div className="cam-home-backdrop" aria-hidden="true" onClick={() => setMenuOpen(false)} />
      <aside
        id="cam-home-rail"
        ref={railRef}
        className="cam-home-rail"
        {...(menuOpen ? { role: "dialog", "aria-modal": true, "aria-label": t("homeLayout.menuLabel") } : {})}
      >
        <div style={{ padding: "var(--cam-space-4)", borderBottom: "var(--cam-border-width) solid var(--cam-border)" }}>
          <Link href="/" title={t("homeLayout.backToPublicPortal")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/camleap-logo.svg" alt="CAMLEAP" width={270} height={38} style={{ display: "block", width: 120, height: "auto" }} />
          </Link>
        </div>

        {/* Survey state action button: follows state (Take the survey, Resume, Correct), disappears once submitted */}
        {showSurveyButton && (
          <div style={{ padding: "var(--cam-space-3) var(--cam-space-4) var(--cam-space-1)" }}>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                if (surveyState === "none") {
                  const entityType = companyQuery.data?.entityType;
                  if (entityType) {
                    router.push(`/onefop/preview?entity=${encodeURIComponent(entityType)}`);
                  } else {
                    setIsNewDeclarationOpen(true);
                  }
                } else if (activeSubmission) {
                  const entityType = activeSubmission.entityType;
                  router.push(entityType ? `/onefop/preview?entity=${encodeURIComponent(entityType)}` : "/onefop/preview");
                }
              }}
              className="cam-button cam-button-primary cam-button-block cam-button-sm"
              style={{ fontWeight: 600 }}
            >
              {surveyState === "none"
                ? t("homeLandingPage.takeSurveyButton")
                : surveyState === "draft"
                ? t("homeLandingPage.resumeDraftButton")
                : t("homeLandingPage.correctSurveyButton")} →
            </button>
          </div>
        )}

        <nav style={{ flex: 1, padding: "var(--cam-space-2) 0", overflowY: "auto" }}>
          {navItems.map((item) => {
            const href = item.route ?? `/home/${item.slug}`;
            const active = item.route ? pathname === item.route : pathname === `/home/${item.slug}`;
            const count =
              item.slug === "declarations"
                ? actionRequiredCount
                : item.slug === "messages"
                ? unreadCount
                : 0;

            return (
              <Link
                key={item.slug}
                href={href}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--cam-space-2) var(--cam-space-4)",
                  fontSize: "var(--cam-font-size-sm)",
                  color: active ? "var(--cam-green)" : "var(--cam-text)",
                  background: active ? "var(--cam-green-wash)" : "transparent",
                  borderLeft: active ? "3px solid var(--cam-green)" : "3px solid transparent",
                  textDecoration: "none",
                  fontWeight: active ? 700 : 500,
                }}
              >
                <span>{t(item.labelKey)}</span>
                {count > 0 && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "var(--cam-font-size-xs)",
                      fontWeight: 600,
                      color: active ? "var(--cam-green)" : "var(--cam-text-muted)",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        backgroundColor: item.slug === "declarations" ? "var(--cam-warning)" : "var(--cam-primary)",
                        display: "inline-block",
                      }}
                    />
                    <span>{count}</span>
                  </span>
                )}
              </Link>
            );
          })}
          {awaitingApproval && (
            <p style={{ margin: 0, padding: "var(--cam-space-2) var(--cam-space-4)", fontSize: "var(--cam-font-size-2xs)", color: "var(--cam-text-muted)" }}>
              {t("homeLayout.pendingNavHint")}
            </p>
          )}
        </nav>

        {/* Footer: Establishment identity + language switcher and Logout */}
        <div
          style={{
            padding: "var(--cam-space-3) var(--cam-space-4)",
            borderTop: "var(--cam-border-width) solid var(--cam-border)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--cam-space-3)",
            background: "var(--cam-surface)",
          }}
        >
          {user && (
            <div>
              {isCompany ? (
                <>
                  <div
                    style={{
                      fontSize: "var(--cam-font-size-sm)",
                      fontWeight: 700,
                      color: "var(--cam-text)",
                      overflowWrap: "break-word",
                      lineHeight: 1.3,
                    }}
                  >
                    {companyName || user.email}
                  </div>
                  {companyType && (
                    <div style={{ fontSize: "var(--cam-font-size-2xs)", color: "var(--cam-text-muted)", marginTop: "var(--cam-space-hairline)" }}>
                      {companyType}
                    </div>
                  )}
                  {campaignLine && (
                    <div style={{ fontSize: "var(--cam-font-size-2xs)", color: "var(--cam-text-muted)", marginTop: "var(--cam-space-1)" }}>
                      {campaignLine}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: "var(--cam-font-size-xs)",
                      fontWeight: 600,
                      color: "var(--cam-text)",
                      overflowWrap: "break-word",
                    }}
                  >
                    {user.email}
                  </div>
                  <div style={{ fontSize: "var(--cam-font-size-2xs)", color: "var(--cam-text-muted)" }}>
                    {roleLabelKey(effectiveRole!) ? t(roleLabelKey(effectiveRole!)!) : effectiveRole}
                  </div>
                  {campaignLine && (
                    <div style={{ fontSize: "var(--cam-font-size-2xs)", color: "var(--cam-text-muted)", marginTop: "4px" }}>
                      {campaignLine}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--cam-space-2)",
              paddingTop: "var(--cam-space-2)",
              borderTop: "1px dashed var(--cam-border)",
            }}
          >
            <LanguageLink />
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace("/");
              }}
              className="cam-text-button"
              style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)" }}
            >
              {t("homeLayout.logoutButton")}
            </button>
          </div>
        </div>
      </aside>

      <main className="cam-home-main">
        {meQuery.isLoading && <p>{t("common.loading")}</p>}
        {meQuery.isError && (
          <p role="alert" style={{ color: "var(--cam-error)" }}>
            {(meQuery.error as Error).message}
          </p>
        )}
        {children}
      </main>

      {/* New Declaration Dialog (DSMO vs ONEFOP -> Entity selection) */}
      <NewDeclarationDialog
        isOpen={isNewDeclarationOpen}
        onClose={() => setIsNewDeclarationOpen(false)}
      />
    </div>
  );
}
