"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  getDeclarationPdfUrl,
  getOnefopSubmissionPdfUrl,
  getCachedUser,
  type DsmoDeclaration,
  type OnefopSubmission,
} from "@/lib/api-client";
import { mySubmissionsQueryOptions } from "@/lib/shared-queries";
import { NewDeclarationDialog } from "@/components/NewDeclarationDialog";
import { asUiLocale } from "@/lib/register-i18n";
import { ENTITY_TYPE_OPTION_KEYS } from "@/lib/companies-directory";
import { referencePeriodLabel } from "@/lib/onefop-period-label";

type Stream = "DSMO" | "ONEFOP";
type Group = "draft" | "pending" | "approved" | "rejected" | "correction";
type FilterTab = "ALL" | "ACTION_REQUIRED" | "PENDING" | "APPROVED";

interface HistoryEntry {
  id: string;
  stream: Stream;
  status: string;
  group: Group;
  period: string;
  subtitle: string;
  date: Date | null;
  pdfUrl?: string;
  raw: DsmoDeclaration | OnefopSubmission;
}

const DSMO_GROUP: Record<string, Group> = {
  DRAFT: "draft",
  SUBMITTED: "pending",
  DIVISION_APPROVED: "pending",
  REGION_APPROVED: "pending",
  FINAL_APPROVED: "approved",
  REJECTED: "rejected",
};

const ONEFOP_GROUP: Record<string, Group> = {
  DRAFT: "draft",
  PENDING_REVIEW: "pending",
  CORRECTION_REQUESTED: "correction",
  APPROVED: "approved",
  REJECTED: "rejected",
};

type Translator = ReturnType<typeof useTranslations>;

function getDsmoStatusLabel(t: Translator, status: string): string {
  const map: Record<string, string> = {
    DRAFT: t("homeDeclarationsPage.statusDraft"),
    SUBMITTED: t("homeDeclarationsPage.statusSubmitted"),
    DIVISION_APPROVED: t("homeDeclarationsPage.statusDivisionApproved"),
    REGION_APPROVED: t("homeDeclarationsPage.statusRegionApproved"),
    FINAL_APPROVED: t("homeDeclarationsPage.statusFinalApproved"),
    REJECTED: t("homeDeclarationsPage.statusRejected"),
  };
  return map[status] ?? status;
}

function getOnefopStatusLabel(t: Translator, status: string): string {
  // Same words as the home card, so one filing is not "Visé" in one place
  // and "Approuvé" in another.
  const map: Record<string, string> = {
    DRAFT: t("homeLandingPage.statusDraft"),
    PENDING_REVIEW: t("homeLandingPage.statusPending"),
    CORRECTION_REQUESTED: t("homeLandingPage.statusCorrection"),
    APPROVED: t("homeLandingPage.statusApproved"),
    REJECTED: t("homeLandingPage.statusRefused"),
  };
  return map[status] ?? status;
}

const GROUP_BADGE: Record<Group, string> = {
  draft: "cam-badge-neutral",
  pending: "cam-badge-info",
  approved: "cam-badge-success",
  rejected: "cam-badge-error",
  correction: "cam-badge-warning",
};

function formatDate(d: Date | null, t: Translator): string {
  if (!d) return t("homeDeclarationsPage.dateUnknown");
  const months = [
    "",
    t("homeDeclarationsPage.month1"),
    t("homeDeclarationsPage.month2"),
    t("homeDeclarationsPage.month3"),
    t("homeDeclarationsPage.month4"),
    t("homeDeclarationsPage.month5"),
    t("homeDeclarationsPage.month6"),
    t("homeDeclarationsPage.month7"),
    t("homeDeclarationsPage.month8"),
    t("homeDeclarationsPage.month9"),
    t("homeDeclarationsPage.month10"),
    t("homeDeclarationsPage.month11"),
    t("homeDeclarationsPage.month12"),
  ];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth() + 1]} ${d.getFullYear()}`;
}

function mapDsmo(d: DsmoDeclaration, t: Translator): HistoryEntry {
  const group = DSMO_GROUP[d.status] ?? "pending";
  return {
    id: d.id,
    stream: "DSMO",
    status: d.status,
    group,
    period: d.year ? String(d.year) : "—",
    subtitle: t("homeDeclarationsPage.dsmoDeclarationSubtitle", { year: d.year ? String(d.year) : "" }),
    date: d.updatedAt ? new Date(d.updatedAt) : d.createdAt ? new Date(d.createdAt) : null,
    pdfUrl: d.pdfUrl,
    raw: d,
  };
}

function mapOnefop(s: OnefopSubmission, t: Translator, locale: "fr" | "en"): HistoryEntry {
  const group = ONEFOP_GROUP[s.status] ?? "pending";
  const periodCode = s.quarterCode ?? s.period;
  const period = periodCode ? referencePeriodLabel(periodCode, locale) : "—";
  const entityKey = s.entityType ? ENTITY_TYPE_OPTION_KEYS[s.entityType] : undefined;
  const label = s.entityType
    ? t("homeDeclarationsPage.onefopLabelWithEntity", { entityType: entityKey ? t(entityKey) : s.entityType })
    : t("homeDeclarationsPage.onefopOption");
  return {
    id: s.id,
    stream: "ONEFOP",
    status: s.status,
    group,
    period,
    subtitle: `${label}${period !== "—" ? " · " + period : ""}`,
    date: s.submittedAt ? new Date(s.submittedAt) : s.updatedAt ? new Date(s.updatedAt) : s.createdAt ? new Date(s.createdAt) : null,
    raw: s,
  };
}

function wizardHref(entry: HistoryEntry): string {
  if (entry.stream === "DSMO") return "/home/declarations/new";
  const entityType = (entry.raw as { entityType?: string | null }).entityType;
  return entityType
    ? `/onefop/preview?entity=${encodeURIComponent(entityType)}`
    : "/onefop/preview";
}

function hasPdf(entry: HistoryEntry): boolean {
  if (entry.stream === "DSMO") {
    return !!(entry.pdfUrl && entry.pdfUrl.length > 0) || entry.group === "approved";
  }
  return entry.group !== "draft";
}

function openPdf(entry: HistoryEntry) {
  if (entry.stream === "DSMO") {
    window.open(getDeclarationPdfUrl(entry.id), "_blank");
  } else {
    window.open(getOnefopSubmissionPdfUrl(entry.id), "_blank");
  }
}

export default function CompanyDeclarationsPage() {
  const router = useRouter();
  const t = useTranslations();
  const uiLocale = asUiLocale(useLocale());

  useEffect(() => {
    const user = getCachedUser();
    if (user && user.role !== "COMPANY") {
      router.replace("/home");
    }
  }, [router]);

  const submissionsQuery = useQuery(mySubmissionsQueryOptions);

  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [campaignFilter, setCampaignFilter] = useState<"ALL" | Stream>("ALL");
  const [search, setSearch] = useState("");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);

  const entries = useMemo(() => {
    if (!submissionsQuery.data) return [];
    const dsmo = (submissionsQuery.data.dsmo || []).map((d) => mapDsmo(d, t));
    const onefop = (submissionsQuery.data.onefop || []).map((s) => mapOnefop(s, t, uiLocale));
    return [...dsmo, ...onefop].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.getTime() - a.date.getTime();
    });
  }, [submissionsQuery.data, t, uiLocale]);

  const hasMultipleStreams = useMemo(() => {
    const streams = new Set(entries.map((e) => e.stream));
    return streams.size > 1;
  }, [entries]);

  const liveQuarterCodes = useMemo(() => {
    return new Set(
      entries
        .filter((e) => e.group === "approved" || e.group === "pending")
        .map((e) => e.period),
    );
  }, [entries]);

  const actionRequiredCount = useMemo(
    () => entries.filter((e) => (e.group === "draft" || e.group === "correction") && !liveQuarterCodes.has(e.period)).length,
    [entries, liveQuarterCodes]
  );
  const pendingCount = useMemo(
    () => entries.filter((e) => e.group === "pending").length,
    [entries]
  );
  const approvedCount = useMemo(
    () => entries.filter((e) => e.group === "approved").length,
    [entries]
  );

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (
        activeTab === "ACTION_REQUIRED" &&
        ((e.group !== "draft" && e.group !== "correction") || liveQuarterCodes.has(e.period))
      ) {
        return false;
      }
      if (activeTab === "PENDING" && e.group !== "pending") {
        return false;
      }
      if (activeTab === "APPROVED" && e.group !== "approved") {
        return false;
      }
      if (campaignFilter !== "ALL" && e.stream !== campaignFilter) {
        return false;
      }
      if (q) {
        return (
          e.subtitle.toLowerCase().includes(q) ||
          e.period.toLowerCase().includes(q) ||
          e.stream.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [entries, activeTab, campaignFilter, search]);

  const tabs: { id: FilterTab; label: string; count: number; alert?: boolean }[] = [
    {
      id: "ALL",
      label: t("homeDeclarationsPage.tabAll", { count: entries.length }),
      count: entries.length,
    },
    {
      id: "ACTION_REQUIRED",
      label: t("homeDeclarationsPage.tabActionRequired", { count: actionRequiredCount }),
      count: actionRequiredCount,
      alert: actionRequiredCount > 0,
    },
    {
      id: "PENDING",
      label: t("homeDeclarationsPage.tabPending", { count: pendingCount }),
      count: pendingCount,
    },
    {
      id: "APPROVED",
      label: t("homeDeclarationsPage.tabApproved", { count: approvedCount }),
      count: approvedCount,
    },
  ];

  return (
    <div className="cam-home-page">
      <header className="cam-home-head">
        <div>
          <h1 className="cam-home-title">{t("homeDeclarationsPage.pageTitle")}</h1>
          <p className="cam-home-lede">{t("homeDeclarationsPage.pageSubtitle")}</p>
        </div>
        {/* Secondary: the green action on this page is the one that resumes
            or corrects a filing, when there is one. */}
        <button type="button" className="cam-button cam-button-secondary" onClick={() => setIsNewDialogOpen(true)}>
          {t("homeDeclarationsPage.newDeclarationButton")}
        </button>
      </header>

      <div className="cam-home-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="cam-home-tab"
          >
            <span>{tab.label}</span>
            {tab.alert && <span aria-hidden="true" className="cam-home-nav-dot is-warning" />}
          </button>
        ))}
      </div>

      <div className="cam-home-toolbar">
        <input
          type="search"
          className="cam-input"
          placeholder={t("homeDeclarationsPage.searchPlaceholder")}
          aria-label={t("homeDeclarationsPage.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)" }}>
          {hasMultipleStreams && (
            <select
              className="cam-select"
              value={campaignFilter}
              aria-label={t("homeDeclarationsPage.allCampaignsOption")}
              onChange={(e) => setCampaignFilter(e.target.value as "ALL" | Stream)}
            >
              <option value="ALL">{t("homeDeclarationsPage.allCampaignsOption")}</option>
              <option value="ONEFOP">{t("homeDeclarationsPage.onefopOption")}</option>
              <option value="DSMO">{t("homeDeclarationsPage.dsmoOption")}</option>
            </select>
          )}
          <button
            type="button"
            className="cam-button cam-button-secondary"
            onClick={() => submissionsQuery.refetch()}
            title={t("homeDeclarationsPage.refreshTitle")}
            aria-label={t("homeDeclarationsPage.refreshTitle")}
          >
            ↻
          </button>
        </div>
      </div>

      {submissionsQuery.isLoading && <p className="cam-home-state">{t("common.loading")}</p>}

      {submissionsQuery.isError && (
        <div className="cam-admin-notice cam-admin-notice--error" role="alert">
          <span>{(submissionsQuery.error as Error).message || t("homeDeclarationsPage.errorLoading")}</span>
          <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => submissionsQuery.refetch()}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {!submissionsQuery.isLoading && !submissionsQuery.isError && filteredEntries.length === 0 && (
        <EmptyState hasEntries={entries.length > 0} onNew={() => setIsNewDialogOpen(true)} />
      )}

      {!submissionsQuery.isLoading && !submissionsQuery.isError && filteredEntries.length > 0 && (
        <ul className="cam-home-list">
          {filteredEntries.map((entry) => {
            const statusLabel =
              entry.stream === "DSMO"
                ? getDsmoStatusLabel(t, entry.status)
                : getOnefopStatusLabel(t, entry.status);

            return (
              <li key={entry.id} className="cam-home-row">
                <div className="cam-home-row-main">
                  <h2 className="cam-home-row-title">{entry.subtitle}</h2>
                  <p className="cam-home-meta">
                    {formatDate(entry.date, t)} · {t("homeDeclarationsPage.periodLabel", { period: entry.period })}
                  </p>
                </div>
                <div className="cam-home-row-side">
                  <span className={`cam-badge ${GROUP_BADGE[entry.group]}`}>{statusLabel}</span>
                  {entry.status === "CORRECTION_REQUESTED" && !liveQuarterCodes.has(entry.period) && (
                    <button
                      type="button"
                      className="cam-button cam-button-secondary cam-button-sm"
                      onClick={() => router.push(wizardHref(entry))}
                    >
                      {t("homeDeclarationsPage.correctAndResubmit")} →
                    </button>
                  )}
                  {entry.group === "draft" && (
                    <button
                      type="button"
                      className="cam-button cam-button-secondary cam-button-sm"
                      onClick={() => router.push(wizardHref(entry))}
                    >
                      {t("homeDeclarationsPage.continueButton")} →
                    </button>
                  )}
                  {hasPdf(entry) && (
                    <button
                      type="button"
                      className="cam-button cam-button-secondary cam-button-sm"
                      onClick={() => openPdf(entry)}
                      title={t("homeDeclarationsPage.downloadPdfTitle")}
                    >
                      {t("homeDeclarationsPage.pdfButtonLabel")}
                    </button>
                  )}
                </div>
                {/* The reviewer's note, when MINEFOP returned the file. */}
                {entry.status === "CORRECTION_REQUESTED" && (
                  <div className="cam-admin-notice cam-admin-notice--warn">
                    <span>
                      <strong>{t("homeDeclarationsPage.correctionRequestedTitle")}</strong>{" "}
                      {(entry.raw as { rejectionReason?: string | null }).rejectionReason ||
                        t("homeDeclarationsPage.correctionRequestedFallback")}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="cam-home-footnote">
        {t("homeDeclarationsPage.attestationNotice")}{" "}
        <Link href="/home/etablissement" className="cam-home-link">
          {t("homeDeclarationsPage.attestationLink")}
        </Link>
        .
      </p>

      {/* New Declaration Dialog (DSMO vs ONEFOP -> Entity selection) */}
      <NewDeclarationDialog
        isOpen={isNewDialogOpen}
        onClose={() => setIsNewDialogOpen(false)}
      />
    </div>
  );
}

function EmptyState({ hasEntries, onNew }: { hasEntries: boolean; onNew: () => void }) {
  const t = useTranslations();
  return (
    <div className="cam-home-state">
      <strong>
        {hasEntries ? t("homeDeclarationsPage.emptyNoResultsTitle") : t("homeDeclarationsPage.emptyNoDeclarationsTitle")}
      </strong>
      {hasEntries ? t("homeDeclarationsPage.emptyNoResultsBody") : t("homeDeclarationsPage.emptyNoDeclarationsBody")}
      {!hasEntries && (
        <div className="cam-home-actions">
          <button type="button" className="cam-button cam-button-primary" onClick={onNew}>
            {t("homeDeclarationsPage.newDeclarationButton")}
          </button>
        </div>
      )}
    </div>
  );
}
