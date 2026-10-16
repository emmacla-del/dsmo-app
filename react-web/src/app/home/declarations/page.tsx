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
    <div style={{ maxWidth: "var(--vt-content-max)", margin: "0 auto", padding: "var(--cam-space-5) var(--cam-space-4)" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--cam-space-3)",
          marginBottom: "var(--cam-space-5)",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "var(--cam-font-size-xl)", fontWeight: 700, color: "var(--cam-text)" }}>
            {t("homeDeclarationsPage.pageTitle")}
          </h1>
          <p style={{ margin: "var(--cam-space-1) 0 0", fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)" }}>
            {t("homeDeclarationsPage.pageSubtitle")}
          </p>
        </div>
        <button
          type="button"
          className="cam-button cam-button-primary"
          onClick={() => setIsNewDialogOpen(true)}
          style={{ whiteSpace: "nowrap", fontWeight: 600 }}
        >
          + {t("homeDeclarationsPage.newDeclarationButton")}
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--cam-space-2)",
          borderBottom: "var(--cam-border-width) solid var(--cam-border)",
          overflowX: "auto",
        }}
        role="tablist"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--cam-space-2)",
                padding: "var(--cam-space-3) var(--cam-space-3)",
                fontSize: "var(--cam-font-size-sm)",
                fontWeight: active ? 700 : 500,
                color: active ? "var(--cam-green)" : "var(--cam-text-muted)",
                borderBottom: active ? "2px solid var(--cam-green)" : "2px solid transparent",
                background: "transparent",
                borderTop: 0,
                borderLeft: 0,
                borderRight: 0,
                cursor: "pointer",
                whiteSpace: "nowrap",
                marginBottom: 0,
                transition: "color 0.15s ease",
              }}
            >
              <span>{tab.label}</span>
              {tab.alert && (
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: "var(--cam-warning)",
                    display: "inline-block",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Search and filter toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--cam-space-3)",
          margin: "var(--cam-space-4) 0",
        }}
      >
        <div style={{ flex: "1 1 14rem", maxWidth: 360 }}>
          <input
            type="search"
            className="cam-input"
            placeholder={t("homeDeclarationsPage.searchPlaceholder")}
            aria-label={t("homeDeclarationsPage.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", fontSize: "var(--cam-font-size-sm)" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)" }}>
          {hasMultipleStreams && (
            <select
              className="cam-input"
              value={campaignFilter}
              aria-label={t("homeDeclarationsPage.allCampaignsOption")}
              onChange={(e) => setCampaignFilter(e.target.value as "ALL" | Stream)}
              style={{ width: "auto", fontSize: "var(--cam-font-size-sm)" }}
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
            style={{ padding: "0 var(--cam-space-3)" }}
          >
            ↻
          </button>
        </div>
      </div>

      {/* Content */}
      {submissionsQuery.isLoading && (
        <div style={{ textAlign: "center", padding: "var(--cam-space-7)", color: "var(--cam-text-muted)" }}>
          {t("common.loading")}
        </div>
      )}

      {submissionsQuery.isError && (
        <div className="cam-error-box" style={{ marginBottom: "var(--cam-space-4)" }}>
          {(submissionsQuery.error as Error).message || t("homeDeclarationsPage.errorLoading")}
          <button
            type="button"
            className="cam-button cam-button-secondary cam-button-sm"
            onClick={() => submissionsQuery.refetch()}
            style={{ marginLeft: "var(--cam-space-4)" }}
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {!submissionsQuery.isLoading && !submissionsQuery.isError && filteredEntries.length === 0 && (
        <EmptyState
          hasEntries={entries.length > 0}
          onNew={() => setIsNewDialogOpen(true)}
        />
      )}

      {!submissionsQuery.isLoading && !submissionsQuery.isError && filteredEntries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
          {filteredEntries.map((entry) => {
            const statusLabel =
              entry.stream === "DSMO"
                ? getDsmoStatusLabel(t, entry.status)
                : getOnefopStatusLabel(t, entry.status);

            return (
              <div
                key={entry.id}
                style={{
                  background: "var(--cam-surface)",
                  border: "var(--cam-border-width) solid var(--cam-border)",
                  borderRadius: "var(--cam-radius-md)",
                  padding: "var(--cam-space-4)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--cam-space-3)",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
                }}
              >
                {/* Top header of filing */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "var(--cam-space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", flexWrap: "wrap", marginBottom: "var(--cam-space-1)" }}>
                      <span className="cam-badge cam-badge-neutral" style={{ fontSize: "var(--cam-font-size-2xs)", fontWeight: 600 }}>
                        {entry.stream}
                      </span>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: "var(--cam-font-size-base)",
                          fontWeight: 600,
                          color: "var(--cam-text)",
                        }}
                      >
                        {entry.subtitle}
                      </h2>
                    </div>
                    <div style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)" }}>
                      {formatDate(entry.date, t)} · {t("homeDeclarationsPage.periodLabel", { period: entry.period })}
                    </div>
                  </div>

                  <span className={`cam-badge ${GROUP_BADGE[entry.group]}`} style={{ flexShrink: 0 }}>
                    {statusLabel}
                  </span>
                </div>

                {/* Correction note from MINEFOP if returned */}
                {entry.status === "CORRECTION_REQUESTED" && (
                  <div
                    style={{
                      padding: "var(--cam-space-3)",
                      borderRadius: "var(--cam-radius-sm)",
                      background: "var(--cam-warning-bg)",
                      border: "var(--cam-border-width) solid var(--cam-warning-border)",
                      color: "var(--cam-text)",
                      fontSize: "var(--cam-font-size-xs)",
                    }}
                  >
                    <strong style={{ display: "block", color: "var(--cam-warning)", marginBottom: "var(--cam-space-1)" }}>
                      {t("homeDeclarationsPage.correctionRequestedTitle")}
                    </strong>
                    <span>
                      {(entry.raw as { rejectionReason?: string | null }).rejectionReason ||
                        t("homeDeclarationsPage.correctionRequestedFallback")}
                    </span>
                  </div>
                )}

                {/* Bottom actions */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "var(--cam-space-2)",
                    paddingTop: "var(--cam-space-2)",
                    borderTop: "1px solid var(--cam-border)",
                    flexWrap: "wrap",
                  }}
                >
                  {entry.status === "CORRECTION_REQUESTED" && !liveQuarterCodes.has(entry.period) && (
                    <button
                      type="button"
                      className="cam-button cam-button-primary cam-button-sm"
                      onClick={() => router.push(wizardHref(entry))}
                      style={{ fontWeight: 600 }}
                    >
                      {t("homeDeclarationsPage.correctAndResubmit")} →
                    </button>
                  )}
                  {entry.group === "draft" && (
                    <button
                      type="button"
                      className="cam-button cam-button-primary cam-button-sm"
                      onClick={() => router.push(wizardHref(entry))}
                      style={{ fontWeight: 600 }}
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
              </div>
            );
          })}
        </div>
      )}

      {/* Attestation link callout */}
      <div
        style={{
          marginTop: "var(--cam-space-6)",
          padding: "var(--cam-space-3) var(--cam-space-4)",
          borderRadius: "var(--cam-radius-md)",
          background: "var(--cam-surface)",
          border: "var(--cam-border-width) solid var(--cam-border)",
          fontSize: "var(--cam-font-size-xs)",
          color: "var(--cam-text-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--cam-space-2)",
        }}
      >
        <span>
          {t("homeDeclarationsPage.attestationNotice")}{" "}
          <Link
            href="/home/etablissement"
            style={{ color: "var(--cam-green)", fontWeight: 600, textDecoration: "underline" }}
          >
            {t("homeDeclarationsPage.attestationLink")}
          </Link>
          .
        </span>
      </div>

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
    <div
      style={{
        textAlign: "center",
        padding: "var(--cam-space-7) var(--cam-space-5)",
        background: "var(--cam-surface)",
        border: "var(--cam-border-width) solid var(--cam-border)",
        borderRadius: "var(--cam-radius-md)",
        color: "var(--cam-text-muted)",
      }}
    >
      <p style={{ fontWeight: 600, color: "var(--cam-text)", marginBottom: "var(--cam-space-2)" }}>
        {hasEntries ? t("homeDeclarationsPage.emptyNoResultsTitle") : t("homeDeclarationsPage.emptyNoDeclarationsTitle")}
      </p>
      <p style={{ fontSize: "var(--cam-font-size-sm)", marginBottom: "var(--cam-space-5)" }}>
        {hasEntries
          ? t("homeDeclarationsPage.emptyNoResultsBody")
          : t("homeDeclarationsPage.emptyNoDeclarationsBody")}
      </p>
      {!hasEntries && (
        <button type="button" className="cam-button cam-button-primary" onClick={onNew}>
          {t("homeDeclarationsPage.newDeclarationButton")}
        </button>
      )}
    </div>
  );
}
