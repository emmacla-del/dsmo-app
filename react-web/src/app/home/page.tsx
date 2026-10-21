"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  getCachedUser,
  getDeclarationPdfUrl,
  type DsmoDeclaration,
  type OnefopSubmission,
} from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { resolveEffectiveRole, roleLabelKey } from "@/lib/role-navigation";
import { NewDeclarationDialog } from "@/components/NewDeclarationDialog";
import { activeQuarterQueryOptions, meQueryOptions, myCompanyQueryOptions, mySubmissionsQueryOptions, myNotificationsQueryOptions } from "@/lib/shared-queries";
import { campaignPhrase, respondentTypeLabel } from "@/lib/respondent-identity";
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

  function handleOpenPdf(entry: SubmissionSummary) {
    if (entry.stream === "DSMO") {
      window.open(getDeclarationPdfUrl(entry.id), "_blank");
    } else {
      router.push("/home/declarations");
    }
  }

  if (!user) {
    return (
      <p className="cam-home-state">{t("common.loading")}</p>
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
      <div className="cam-home-page">
        <header className="cam-home-head">
          <div>
            <h1 className="cam-home-title">{t("homeLandingPage.welcomeTitle")}</h1>
            {lede && <p className="cam-home-lede">{lede}</p>}
          </div>
        </header>
        <section className="cam-home-section">
          <h2 className="cam-home-h2">{t("homeLandingPage.staffConsoleTitle")}</h2>
          <p className="cam-home-intro">
            {t("homeLandingPage.staffConsoleBody")}
          </p>
          <ul className="cam-home-list">
            {STAFF_LINKS.map((link) => (
              <li key={link.href} className="cam-home-row cam-home-row--stacked">
                <Link href={link.href} className="cam-home-link">
                  {t(link.titleKey)}
                </Link>
                <span className="cam-home-meta">{t(link.hintKey)}</span>
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
  // Identity line: what the respondent is and the number they sign in with.
  // The NIU and CNPS live on the Establishment page, and the "verified"
  // badge said nothing: an account that is not active never reaches here
  // (tidy pass, owner 2026-10-20).
  const identity = [typeLabel, company?.establishmentId, locationText].filter(Boolean);

  // The campaign's own filing is the survey block above; the list below holds
  // the others, so the same filing is not shown, with the same button, twice.
  const earlierEntries = allEntries
    .filter((e) => e !== campaignSubmission && e !== endorsedAlongside)
    .slice(0, 3);

  return (
    <div className="cam-home-page">
      {/* ── Who this is ── */}
      <header className="cam-home-head">
        <div>
          <h1 className="cam-home-title">{company?.name || t("homeLandingPage.welcomeTitle")}</h1>
          {identity.length > 0 && <p className="cam-home-lede">{identity.join(" · ")}</p>}
        </div>
      </header>

      {/* ── The one thing to do: this campaign's survey ──
          Its state and a single action that follows it. No box: sections are
          told apart by their headings and a hairline (CLAUDE.md §8). */}
      <section aria-labelledby="home-survey-heading" className="cam-home-section">
        <h2 id="home-survey-heading" className="cam-home-h2">
          {campaign || (quarter?.label ?? t("homeLandingPage.campaignStatusTitle"))}
        </h2>
        <div className="cam-home-row-side">
          {quarter && !quarter.isOpen && (
            <span className="cam-badge cam-badge-neutral">{t("homeLandingPage.campaignClosedBadge")}</span>
          )}
          {quarter?.isOpen && !surveyLoading && campaignSubmission && (
            <span className={`cam-badge ${STATUS_BADGE_CLASS[campaignSubmission.group]}`}>
              {groupStatusLabel(t, campaignSubmission.group)}
            </span>
          )}
          <span className="cam-home-body">
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
          </span>
        </div>
        {quarter?.isOpen && surveyState === "correction" && correctionReason && (
          <p className="cam-home-body">{correctionReason}</p>
        )}
        {quarter?.isOpen && endorsedAlongside && (
          <p className="cam-home-body">{t("homeLandingPage.surveyAlsoEndorsed")}</p>
        )}
        {quarter?.deadline && quarter.isOpen && (
          <p className="cam-home-meta">
            {t("homeLandingPage.deadlineBadge", { date: formatCampaignDate(quarter.deadline) })}
          </p>
        )}

        {quarter?.isOpen && !surveyLoading && (
          <div className="cam-home-actions">
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
              >
                {t("homeLandingPage.takeSurveyButton")} →
              </button>
            )}
            {(surveyState === "draft" || surveyState === "correction") && campaignSubmission && (
              <button
                type="button"
                onClick={() => router.push(wizardHref(campaignSubmission))}
                className="cam-button cam-button-primary"
              >
                {surveyState === "draft" ? t("homeLandingPage.resumeDraftButton") : t("homeLandingPage.correctSurveyButton")} →
              </button>
            )}
            {endorsedAlongside && (
              <button type="button" onClick={() => handleOpenPdf(endorsedAlongside)} className="cam-button cam-button-secondary">
                {t("homeLandingPage.downloadReceipt")}
              </button>
            )}
            {(surveyState === "pending" || surveyState === "approved" || surveyState === "rejected") && campaignSubmission && (
              <button type="button" onClick={() => handleOpenPdf(campaignSubmission)} className="cam-button cam-button-secondary">
                {surveyState === "rejected" ? t("homeLandingPage.viewFilingButton") : t("homeLandingPage.downloadReceipt")}
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── Earlier declarations: only when there are some ── */}
      {!submissionsQuery.isLoading && earlierEntries.length > 0 && (
        <section aria-labelledby="home-earlier-heading" className="cam-home-section">
          <div className="cam-home-section-head">
            <h2 id="home-earlier-heading" className="cam-home-h2">{t("homeLandingPage.earlierDeclarationsHeading")}</h2>
            <Link href="/home/declarations" className="cam-home-link">{t("homeLandingPage.viewAllSubmissions")}</Link>
          </div>
          <ul className="cam-home-list">
            {earlierEntries.map((entry) => (
              <li key={entry.id} className="cam-home-row">
                <div className="cam-home-row-main">
                  <p className="cam-home-row-title">{entry.period}</p>
                  <p className="cam-home-meta">
                    {entry.stream === "DSMO" ? `${t("homeLandingPage.dsmoDeclarationLabel")} · ` : ""}
                    {formatSubmissionDate(entry.date)}
                  </p>
                </div>
                <div className="cam-home-row-side">
                  <span className={`cam-badge ${STATUS_BADGE_CLASS[entry.group]}`}>{groupStatusLabel(t, entry.group)}</span>
                  {entry.group === "draft" || entry.group === "correction" ? (
                    <button type="button" onClick={() => router.push(wizardHref(entry))} className="cam-button cam-button-secondary cam-button-sm">
                      {entry.group === "draft" ? t("homeLandingPage.continueDraft") : t("homeLandingPage.correctButton")}
                    </button>
                  ) : (
                    <button type="button" onClick={() => handleOpenPdf(entry)} className="cam-button cam-button-secondary cam-button-sm">
                      {t("homeLandingPage.downloadReceipt")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Messages: only when there are some; the rail links to the box ── */}
      {recentMessages.length > 0 && (
        <section aria-labelledby="home-messages-heading" className="cam-home-section">
          <div className="cam-home-section-head">
            <h2 id="home-messages-heading" className="cam-home-h2">{t("homeLandingPage.latestMessagesHeading")}</h2>
            <Link href="/home/messages" className="cam-home-link">{t("homeLandingPage.viewAllMessages")}</Link>
          </div>
          <ul className="cam-home-list">
            {recentMessages.map((msg) => (
              <li key={msg.id} className="cam-home-row cam-home-row--stacked">
                <div className="cam-home-section-head">
                  <span className={`cam-home-row-title${msg.readAt ? "" : " is-unread"}`}>
                    {!msg.readAt && (
                      <span className="cam-badge cam-badge-success">
                        {t("homeMessagesPage.unreadBadge")}
                      </span>
                    )}
                    {msg.subject}
                  </span>
                  <time className="cam-home-meta">{formatDoualaDate(msg.createdAt) ?? msg.createdAt.slice(0, 10)}</time>
                </div>
                <p className="cam-home-meta">{msg.body.length > 180 ? `${msg.body.slice(0, 180)}…` : msg.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NewDeclarationDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
