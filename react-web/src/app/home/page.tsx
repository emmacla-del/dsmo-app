"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  getCachedUser,
  getMyDeclarations,
  getMyOnefopSubmissions,
  getDeclarationPdfUrl,
  type DsmoDeclaration,
  type OnefopSubmission,
} from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { resolveEffectiveRole, roleLabelKey } from "@/lib/role-navigation";
import { NewDeclarationDialog } from "@/components/NewDeclarationDialog";
import { activeQuarterQueryOptions, meQueryOptions, myCompanyQueryOptions, mySubmissionsQueryOptions, myNotificationsQueryOptions } from "@/lib/shared-queries";
import { campaignPhrase, declaredWorkforce, respondentNiu, respondentTypeLabel } from "@/lib/respondent-identity";
import { formatCampaignDate } from "@/lib/campaigns";
import { formatDoualaDate } from "@/lib/douala-date";
import { asUiLocale } from "@/lib/register-i18n";
import { referencePeriodLabel } from "@/lib/onefop-period-label";

// The four staff destinations, in the order the console lists them.
const STAFF_LINKS = [
  { href: "/admin/pilotage", titleKey: "homeLandingPage.staffDashboard", hintKey: "homeLandingPage.staffDashboardHint" },
  { href: "/admin/dossiers?status=PENDING_REVIEW", titleKey: "homeLandingPage.staffPending", hintKey: "homeLandingPage.staffPendingHint" },
  { href: "/admin/dossiers", titleKey: "homeLandingPage.staffReview", hintKey: "homeLandingPage.staffReviewHint" },
  { href: "/admin/diffusion", titleKey: "homeLandingPage.staffStatistics", hintKey: "homeLandingPage.staffStatisticsHint" },
] as const;

type Stream = "DSMO" | "ONEFOP";
type SubmissionGroup = "draft" | "pending" | "approved" | "correction" | "rejected";

interface SubmissionSummary {
  id: string;
  stream: Stream;
  status: string;
  group: SubmissionGroup;
  title: string;
  period: string;
  date: Date | null;
  raw: DsmoDeclaration | OnefopSubmission;
  pdfUrl?: string;
}

const DSMO_GROUP_MAP: Record<string, SubmissionGroup> = {
  DRAFT: "draft",
  SUBMITTED: "pending",
  DIVISION_APPROVED: "pending",
  REGION_APPROVED: "pending",
  FINAL_APPROVED: "approved",
  REJECTED: "rejected",
};

const ONEFOP_GROUP_MAP: Record<string, SubmissionGroup> = {
  DRAFT: "draft",
  PENDING_REVIEW: "pending",
  CORRECTION_REQUESTED: "correction",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const STATUS_BADGE_CLASS: Record<SubmissionGroup, string> = {
  draft: "cam-badge-neutral",
  pending: "cam-badge-info",
  approved: "cam-badge-success",
  correction: "cam-badge-warning",
  rejected: "cam-badge-error",
};

function groupStatusLabel(t: ReturnType<typeof useTranslations>, group: SubmissionGroup): string {
  switch (group) {
    case "draft":
      return t("homeLandingPage.statusDraft");
    case "approved":
      return t("homeLandingPage.statusApproved");
    case "correction":
      return t("homeLandingPage.statusCorrection");
    case "rejected":
      return t("homeLandingPage.statusRefused");
    default:
      return t("homeLandingPage.statusPending");
  }
}

function sameCampaign(entry: SubmissionSummary, code: string): boolean {
  const raw = entry.raw as { quarterCode?: string; period?: string };
  return raw.quarterCode === code || raw.period === code;
}

function formatSubmissionDate(d: Date | null): string {
  if (!d) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function wizardHref(entry: SubmissionSummary): string {
  if (entry.stream === "DSMO") return "/home/declarations/new";
  const entityType = (entry.raw as { entityType?: string | null }).entityType;
  return entityType
    ? `/onefop/preview?entity=${encodeURIComponent(entityType)}`
    : "/onefop/preview";
}

export default function HomeLandingPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = asUiLocale(useLocale());
  const authUser = useAuthStore((s) => s.user);
  const cachedUser = getCachedUser();

  const meQuery = useQuery({
    ...meQueryOptions,
    initialData: authUser ?? cachedUser ?? undefined,
  });

  const user = meQuery.data ?? authUser ?? cachedUser;
  const isCompany = user?.role === "COMPANY";
  const isActive = user?.status === "ACTIVE";

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const companyQuery = useQuery({ ...myCompanyQueryOptions, enabled: isCompany });
  const quarterQuery = useQuery({ ...activeQuarterQueryOptions, enabled: isCompany && isActive });

  const submissionsQuery = useQuery({
    ...mySubmissionsQueryOptions,
    enabled: isCompany && isActive,
  });

  const notificationsQuery = useQuery({
    ...myNotificationsQueryOptions,
    enabled: isCompany,
  });

  const recentMessages = useMemo(() => {
    return (notificationsQuery.data ?? []).slice(0, 2);
  }, [notificationsQuery.data]);

  const allEntries: SubmissionSummary[] = useMemo(() => {
    if (!submissionsQuery.data) return [];
    const dsmoEntries: SubmissionSummary[] = submissionsQuery.data.dsmo.map((d) => ({
      id: d.id,
      stream: "DSMO",
      status: d.status,
      group: DSMO_GROUP_MAP[d.status] ?? "pending",
      title: t("homeLandingPage.submissionDsmo"),
      period: d.year ? String(d.year) : "—",
      date: d.updatedAt ? new Date(d.updatedAt) : d.createdAt ? new Date(d.createdAt) : null,
      raw: d,
      pdfUrl: d.pdfUrl,
    }));
    const onefopEntries: SubmissionSummary[] = submissionsQuery.data.onefop.map((s) => {
      const periodCode = s.quarterCode ?? s.period;
      const period = periodCode ? referencePeriodLabel(periodCode, locale) : "—";
      return {
        id: s.id,
        stream: "ONEFOP",
        status: s.status,
        group: ONEFOP_GROUP_MAP[s.status] ?? "pending",
        title: t("homeLandingPage.submissionOnefop"),
        period,
        date: s.submittedAt ? new Date(s.submittedAt) : s.updatedAt ? new Date(s.updatedAt) : s.createdAt ? new Date(s.createdAt) : null,
        raw: s,
      };
    });
    return [...dsmoEntries, ...onefopEntries].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.getTime() - a.date.getTime();
    });
  }, [submissionsQuery.data, locale, t]);

  const recentEntries = useMemo(() => allEntries.slice(0, 3), [allEntries]);

  function handleOpenPdf(entry: SubmissionSummary) {
    if (entry.stream === "DSMO") {
      window.open(getDeclarationPdfUrl(entry.id), "_blank");
    } else {
      router.push("/home/declarations");
    }
  }

  if (!user) {
    return (
      <div style={{ padding: "var(--cam-space-6)", color: "var(--cam-text-muted)" }}>
        {t("common.loading")}
      </div>
    );
  }

  const effectiveRole = resolveEffectiveRole(user);
  const company = companyQuery.data;
  const quarter = quarterQuery.data;
  const campaign = isCompany ? campaignPhrase(quarter, locale) : null;
  const typeLabel = isCompany
    ? respondentTypeLabel(company?.entityType, locale)
    : roleLabelKey(effectiveRole) ? t(roleLabelKey(effectiveRole)!) : effectiveRole;

  // Staff console view for non-company roles
  if (!isCompany) {
    const lede = [typeLabel, campaign].filter(Boolean).join(" · ");
    return (
      <div>
        <h1 style={{ fontSize: "var(--cam-font-size-xl)", fontWeight: "var(--cam-font-weight-bold)", margin: "0 0 var(--cam-space-2)" }}>
          {t("homeLandingPage.welcomeTitle")}
        </h1>
        {lede && (
          <p style={{ color: "var(--cam-text-muted)", margin: "0 0 var(--cam-space-5)" }}>{lede}</p>
        )}
        <section style={{ maxWidth: 680, marginTop: "var(--cam-space-5)" }}>
          <h2 style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-bold)", margin: "0 0 var(--cam-space-2)", color: "var(--cam-text)" }}>
            {t("homeLandingPage.staffConsoleTitle")}
          </h2>
          <p style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)", margin: "0 0 var(--cam-space-3)" }}>
            {t("homeLandingPage.staffConsoleBody")}
          </p>
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
      </div>
    );
  }

  // Filings for the open campaign, newest first. If a filing was already endorsed or is pending review,
  // that live state governs the card.
  const campaignCode = quarter?.code;
  const campaignEntries = campaignCode ? allEntries.filter((e) => sameCampaign(e, campaignCode)) : [];
  const liveCampaignEntry = campaignEntries.find((e) => e.group === "approved" || e.group === "pending");
  const openCorrection = !liveCampaignEntry ? campaignEntries.find((e) => e.group === "correction") ?? null : null;
  const campaignSubmission = liveCampaignEntry ?? openCorrection ?? campaignEntries.at(0) ?? null;
  const endorsedAlongside =
    openCorrection && campaignEntries.some((e) => e.group === "approved") ? campaignEntries.find((e) => e.group === "approved") ?? null : null;
  const surveyState: SubmissionGroup | "none" = campaignSubmission?.group ?? "none";
  // Until the filings have loaded the state is unknown: saying "expected
  // before the deadline · Take the survey" for those seconds told a centre
  // that had already filed to file again (2026-10-16 re-test, defect 23).
  const surveyLoading = submissionsQuery.isLoading;
  const correctionReason =
    surveyState === "correction"
      ? (campaignSubmission?.raw as { rejectionReason?: string | null }).rejectionReason ?? null
      : null;

  const locationParts = [company?.subdivision, company?.department, company?.region].filter(Boolean);
  const locationText = locationParts.length > 0 ? locationParts.join(", ") : null;
  // Identity strip: only what this account actually declared (B6).
  const niu = respondentNiu(company?.taxNumber);
  const workforce = declaredWorkforce(company);

  return (
    <div style={{ maxWidth: "var(--vt-content-max-wide)", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--cam-space-6)" }}>
      {/* ── 1. Clean, Airy Header ── */}
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "var(--cam-font-size-2xl)", fontWeight: "var(--cam-font-weight-bold)", margin: 0, color: "var(--cam-text)" }}>
            {company?.name || t("homeLandingPage.welcomeTitle")}
          </h1>
          <span className="cam-badge cam-badge-success" style={{ display: "inline-flex", alignItems: "center", gap: "var(--cam-space-1)" }}>
            <span aria-hidden="true">✓</span>
            <span>{t("homeLandingPage.verifiedAccount")}</span>
          </span>
        </div>

        {/* Lightweight meta strip */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--cam-space-1) var(--cam-space-3)", fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)" }}>
          {typeLabel && <span style={{ fontWeight: 600, color: "var(--cam-text)" }}>{typeLabel}</span>}
          {/* Shown only when the account declared one: an administration and
              a project/programme are never asked for a NIU, and their row
              carries an internal `NA-<uuid>` placeholder (B6). */}
          {niu && (
            <>
              <span aria-hidden="true">·</span>
              <span>{t("homeLandingPage.niuLabel")} <strong style={{ color: "var(--cam-text)" }}>{niu}</strong></span>
            </>
          )}
          {company?.cnpsNumber && (
            <>
              <span aria-hidden="true">·</span>
              <span>{t("homeLandingPage.cnpsLabel")} <strong style={{ color: "var(--cam-text)" }}>{company.cnpsNumber}</strong></span>
            </>
          )}
          {locationText && (
            <>
              <span aria-hidden="true">·</span>
              <span>{locationText}</span>
            </>
          )}
          {/* The DSMO company profile's headcount, shown only when someone
              entered one. ONEFOP never asks for it, so it stayed at 0 and the
              header read « 0 declared employees » beside a declaration of 12
              (B6); a training centre declares trainees, not employees. */}
          {workforce !== null && (
            <>
              <span aria-hidden="true">·</span>
              <span>{t("homeLandingPage.employeesCount", { count: workforce })}</span>
            </>
          )}
        </div>
      </section>

      {/* ── 2. Survey status: the one thing this respondent has to do ──
          The campaign and the survey's state for it, with a single action
          that follows that state. Replaces the campaign banner and the
          three "Key actions" cards: the attestation and the new-filing
          entry already live in the rail (home/layout.tsx), and the
          history lives in the filings list below. */}
      <section style={{
        background: "var(--cam-surface)",
        border: "var(--cam-border-width) solid var(--cam-border)",
        borderRadius: "var(--cam-radius-lg)",
        padding: "var(--cam-space-5) var(--cam-space-6)",
        boxShadow: "var(--cam-shadow-sm)",
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--cam-space-2)", marginBottom: "var(--cam-space-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", flexWrap: "wrap" }}>
            <span style={{ fontSize: "var(--cam-font-size-xs)", fontWeight: 600, color: "var(--cam-text-muted)" }}>
              {campaign || (quarter?.label ?? t("homeLandingPage.campaignStatusTitle"))}
            </span>
            {quarter && !quarter.isOpen && (
              <span className="cam-badge cam-badge-neutral">{t("homeLandingPage.campaignClosedBadge")}</span>
            )}
            {quarter?.isOpen && campaignSubmission && (
              <span className={`cam-badge ${STATUS_BADGE_CLASS[campaignSubmission.group]}`}>
                {groupStatusLabel(t, campaignSubmission.group)}
              </span>
            )}
          </div>
          {quarter?.deadline && quarter.isOpen && (
            <span style={{ fontSize: "var(--cam-font-size-xs)", fontWeight: 600, color: "var(--cam-primary-dark)", background: "var(--cam-primary-tint)", padding: "var(--cam-space-1) var(--cam-space-3)", borderRadius: "var(--cam-radius-full)" }}>
              {t("homeLandingPage.deadlineBadge", { date: formatCampaignDate(quarter.deadline) })}
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--cam-space-4)" }}>
          <div style={{ flex: "1 1 24rem" }}>
            <h2 style={{ fontSize: "var(--cam-font-size-xl)", fontWeight: "var(--cam-font-weight-bold)", margin: "0 0 var(--cam-space-2)", color: "var(--cam-text)" }}>
              {t("homeLandingPage.surveyCardTitle")}
            </h2>
            <p style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)", lineHeight: "var(--cam-line-height-base)" }}>
              {!quarter?.isOpen
                ? t("homeLandingPage.campaignClosedNotice")
                : surveyLoading
                ? t("common.loading")
                : surveyState === "none"
                ? t("homeLandingPage.submissionStatusNone")
                : surveyState === "draft"
                ? t("homeLandingPage.surveyDraft")
                : surveyState === "pending"
                ? t("homeLandingPage.surveyPending")
                : surveyState === "approved"
                ? t("homeLandingPage.surveyApproved")
                : surveyState === "correction"
                ? t("homeLandingPage.surveyCorrection")
                : t("homeLandingPage.surveyRejected")}
            </p>
            {quarter?.isOpen && surveyState === "correction" && correctionReason && (
              <p style={{ margin: "var(--cam-space-2) 0 0", fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text)", lineHeight: "var(--cam-line-height-base)" }}>
                {correctionReason}
              </p>
            )}
            {quarter?.isOpen && endorsedAlongside && (
              <p style={{ margin: "var(--cam-space-2) 0 0", fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text)", lineHeight: "var(--cam-line-height-base)" }}>
                {t("homeLandingPage.surveyAlsoEndorsed")}
              </p>
            )}
          </div>

          {quarter?.isOpen && !surveyLoading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "var(--cam-space-2)", flexShrink: 0 }}>
              {surveyState === "none" && (
                <button
                  type="button"
                  // The campaign's survey is the account's own questionnaire,
                  // as the rail's button opens it: no chooser offering a
                  // training centre the employers' DSMO declaration.
                  onClick={() =>
                    company?.entityType
                      ? router.push(`/onefop/preview?entity=${encodeURIComponent(company.entityType)}`)
                      : setIsDialogOpen(true)
                  }
                  className="cam-button cam-button-primary"
                  style={{ padding: "var(--cam-space-2) var(--cam-space-5)", fontSize: "var(--cam-font-size-sm)" }}
                >
                  {t("homeLandingPage.takeSurveyButton")} →
                </button>
              )}
              {(surveyState === "draft" || surveyState === "correction") && campaignSubmission && (
                <button
                  type="button"
                  onClick={() => router.push(wizardHref(campaignSubmission))}
                  className="cam-button cam-button-primary"
                  style={{ padding: "var(--cam-space-2) var(--cam-space-5)", fontSize: "var(--cam-font-size-sm)" }}
                >
                  {surveyState === "draft" ? t("homeLandingPage.resumeDraftButton") : t("homeLandingPage.correctSurveyButton")} →
                </button>
              )}
              {endorsedAlongside && (
                <button
                  type="button"
                  onClick={() => handleOpenPdf(endorsedAlongside)}
                  className="cam-button cam-button-secondary"
                  style={{ padding: "var(--cam-space-2) var(--cam-space-5)", fontSize: "var(--cam-font-size-sm)" }}
                >
                  {t("homeLandingPage.downloadReceipt")}
                </button>
              )}
              {(surveyState === "pending" || surveyState === "approved" || surveyState === "rejected") && campaignSubmission && (
                <button
                  type="button"
                  onClick={() => handleOpenPdf(campaignSubmission)}
                  className="cam-button cam-button-secondary"
                  style={{ padding: "var(--cam-space-2) var(--cam-space-5)", fontSize: "var(--cam-font-size-sm)" }}
                >
                  {surveyState === "rejected" ? t("homeLandingPage.viewFilingButton") : t("homeLandingPage.downloadReceipt")}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── 3. Recent Filings & Official Receipts ── */}
      <section style={{
        background: "var(--cam-surface)",
        border: "var(--cam-border-width) solid var(--cam-border)",
        borderRadius: "var(--cam-radius-lg)",
        padding: "var(--cam-space-5) var(--cam-space-6)",
        boxShadow: "var(--cam-shadow-sm)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--cam-space-3)" }}>
          <h2 style={{ fontSize: "var(--cam-font-size-base)", fontWeight: "var(--cam-font-weight-bold)", margin: 0, color: "var(--cam-text)" }}>
            {t("homeLandingPage.recentSubmissionsHeading")}
          </h2>
          <Link
            href="/home/declarations"
            style={{ fontSize: "var(--cam-font-size-xs)", fontWeight: 600, color: "var(--cam-primary)", textDecoration: "none" }}
          >
            {t("homeLandingPage.viewAllSubmissions")}
          </Link>
        </div>

        {submissionsQuery.isLoading && (
          <p style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)", margin: 0 }}>
            {t("common.loading")}
          </p>
        )}

        {!submissionsQuery.isLoading && recentEntries.length === 0 && (
          <p style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)", margin: 0 }}>
            {t("homeLandingPage.emptyRecentSubmissions")}
          </p>
        )}

        {!submissionsQuery.isLoading && recentEntries.length > 0 && (
          <div>
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--cam-space-3)",
                  padding: "var(--cam-space-3) 0",
                  borderTop: "var(--cam-border-width) solid var(--cam-border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)", minWidth: 0 }}>
                  <span className="cam-badge cam-badge-neutral" style={{ flexShrink: 0 }}>
                    {entry.stream}
                  </span>
                  <div>
                    <div style={{ fontSize: "var(--cam-font-size-sm)", fontWeight: 600, color: "var(--cam-text)" }}>
                      {entry.period}
                    </div>
                    <div style={{ fontSize: "var(--cam-font-size-2xs)", color: "var(--cam-text-muted)" }}>
                      {formatSubmissionDate(entry.date)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)" }}>
                  <span className={`cam-badge ${STATUS_BADGE_CLASS[entry.group]}`}>
                    {groupStatusLabel(t, entry.group)}
                  </span>
                  {(!liveCampaignEntry || !sameCampaign(entry, quarter?.code ?? "")) &&
                  (entry.group === "draft" || entry.group === "correction") ? (
                    <button
                      type="button"
                      onClick={() => router.push(wizardHref(entry))}
                      className="cam-button cam-button-secondary cam-button-sm"
                    >
                      {entry.group === "draft" ? t("homeLandingPage.continueDraft") : t("homeLandingPage.correctButton")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenPdf(entry)}
                      className="cam-button cam-button-secondary cam-button-sm"
                    >
                      {t("homeLandingPage.downloadReceipt")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 4. Derniers messages MINEFOP ── */}
      <section style={{
        background: "var(--cam-surface)",
        border: "var(--cam-border-width) solid var(--cam-border)",
        borderRadius: "var(--cam-radius-lg)",
        padding: "var(--cam-space-5) var(--cam-space-6)",
        boxShadow: "var(--cam-shadow-sm)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--cam-space-3)" }}>
          <h2 style={{ fontSize: "var(--cam-font-size-base)", fontWeight: "var(--cam-font-weight-bold)", margin: 0, color: "var(--cam-text)" }}>
            {t("homeLandingPage.latestMessagesHeading")}
          </h2>
          <Link
            href="/home/messages"
            style={{ fontSize: "var(--cam-font-size-xs)", fontWeight: 600, color: "var(--cam-primary)", textDecoration: "none" }}
          >
            {t("homeLandingPage.viewAllMessages")}
          </Link>
        </div>

        {notificationsQuery.isLoading && (
          <p style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)", margin: 0 }}>
            {t("common.loading")}
          </p>
        )}

        {!notificationsQuery.isLoading && recentMessages.length === 0 && (
          <p style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)", margin: 0 }}>
            {t("homeLandingPage.noMessages")}
          </p>
        )}

        {!notificationsQuery.isLoading && recentMessages.length > 0 && (
          <div>
            {recentMessages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  padding: "var(--cam-space-3) 0",
                  borderTop: "var(--cam-border-width) solid var(--cam-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--cam-space-1)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--cam-space-2)", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)" }}>
                    {!msg.readAt && (
                      <span className="cam-badge cam-badge-success" style={{ fontSize: "var(--cam-font-size-2xs)" }}>
                        {t("homeMessagesPage.unreadBadge")}
                      </span>
                    )}
                    <span style={{ fontSize: "var(--cam-font-size-sm)", fontWeight: !msg.readAt ? 700 : 600, color: "var(--cam-text)" }}>
                      {msg.subject}
                    </span>
                  </div>
                  <time style={{ fontSize: "var(--cam-font-size-2xs)", color: "var(--cam-text-muted)" }}>
                    {formatDoualaDate(msg.createdAt) ?? msg.createdAt.slice(0, 10)}
                  </time>
                </div>
                <p style={{ margin: 0, fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", lineHeight: "var(--cam-line-height-base)" }}>
                  {msg.body.length > 180 ? `${msg.body.slice(0, 180)}…` : msg.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <NewDeclarationDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
