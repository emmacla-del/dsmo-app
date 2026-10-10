"use client";

// Port of lib/screens/dsmo/company_declarations_screen.dart
// Merges GET /dsmo/declarations and GET /onefop/submissions into a unified
// timeline, grouped by status (Draft / Pending / Approved / Rejected).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  getMyDeclarations,
  getMyOnefopSubmissions,
  getDeclarationPdfUrl,
  getCachedUser,
  type DsmoDeclaration,
  type OnefopSubmission,
} from "@/lib/api-client";
import { NewDeclarationDialog } from "@/components/NewDeclarationDialog";
import { asUiLocale } from "@/lib/register-i18n";
import { ENTITY_TYPE_OPTION_KEYS } from "@/lib/companies-directory";
import { referencePeriodLabel } from "@/lib/onefop-period-label";

// ── History entry model (matches _HistoryEntry in Flutter) ────────────────

type Stream = "DSMO" | "ONEFOP";
type Group = "draft" | "pending" | "approved" | "rejected" | "correction";

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

// ── Status helpers (mirrors Flutter's _kDsmoStatus / _kOnefopStatus) ──────

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
  const map: Record<string, string> = {
    DRAFT: t("homeDeclarationsPage.statusDraft"),
    PENDING_REVIEW: t("homeDeclarationsPage.statusPendingReview"),
    CORRECTION_REQUESTED: t("homeDeclarationsPage.statusCorrectionRequested"),
    APPROVED: t("homeDeclarationsPage.statusFinalApproved"),
    REJECTED: t("homeDeclarationsPage.statusRejected"),
  };
  return map[status] ?? status;
}

// The .cam-badge variant that names each group's status.
const GROUP_BADGE: Record<Group, string> = {
  draft: "cam-badge-neutral",
  pending: "cam-badge-info",
  approved: "cam-badge-success",
  rejected: "cam-badge-error",
  correction: "cam-badge-warning",
};

const GROUP_COLOR: Record<Group, string> = {
  draft: "var(--cam-text-muted)",
  pending: "var(--cam-info)",
  approved: "var(--cam-success)",
  rejected: "var(--cam-error)",
  correction: "var(--cam-warning)",
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
  // Readable period ("4e trimestre 2026") and type ("Centre de formation
  // professionnelle"), not their codes; an unknown code is shown as is.
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
    // GET /onefop/submissions returns `submittedAt` (onefop.service.ts
    // getSubmissions maps createdAt -> submittedAt); updatedAt/createdAt are
    // kept as fallbacks only in case the shape changes.
    date: s.submittedAt ? new Date(s.submittedAt) : s.updatedAt ? new Date(s.updatedAt) : s.createdAt ? new Date(s.createdAt) : null,
    raw: s,
  };
}

// ── Component ─────────────────────────────────────────────────────────────

// The wizard a declaration is continued or corrected in follows its stream.
// Every entry used to open the DSMO wizard, so an ONEFOP draft or correction
// request landed in the wrong questionnaire. /onefop/preview accepts the
// stored entityType code (ENTERPRISE, VOCATIONAL_TRAINING, ...) as `entity`.
function wizardHref(entry: HistoryEntry): string {
  if (entry.stream === "DSMO") return "/home/declarations/new";
  const entityType = (entry.raw as { entityType?: string | null }).entityType;
  return entityType
    ? `/onefop/preview?entity=${encodeURIComponent(entityType)}`
    : "/onefop/preview";
}

export default function CompanyDeclarationsPage() {
  const router = useRouter();
  const t = useTranslations();
  const uiLocale = asUiLocale(useLocale());

  // Role guard: this page is only for COMPANY accounts. Admins and other
  // staff roles have no company profile and cannot submit declarations.
  useEffect(() => {
    const user = getCachedUser();
    if (user && user.role !== "COMPANY") {
      router.replace("/home");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<Group | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<"ALL" | Stream>("ALL");
  const [search, setSearch] = useState("");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [dsmoRes, onefopRes] = await Promise.allSettled([
        getMyDeclarations(),
        getMyOnefopSubmissions(),
      ]);
      const dsmo = dsmoRes.status === "fulfilled" ? dsmoRes.value.map((d) => mapDsmo(d, t)) : [];
      const onefop = onefopRes.status === "fulfilled" ? onefopRes.value.map((s) => mapOnefop(s, t, uiLocale)) : [];
      const merged = [...dsmo, ...onefop].sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.getTime() - a.date.getTime();
      });
      setEntries(merged);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("homeDeclarationsPage.errorLoading"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      getMyDeclarations(),
      getMyOnefopSubmissions(),
    ]).then(([dsmoRes, onefopRes]) => {
      if (!active) return;
      const dsmo = dsmoRes.status === "fulfilled" ? dsmoRes.value.map((d) => mapDsmo(d, t)) : [];
      const onefop = onefopRes.status === "fulfilled" ? onefopRes.value.map((s) => mapOnefop(s, t, uiLocale)) : [];
      const merged = [...dsmo, ...onefop].sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.getTime() - a.date.getTime();
      });
      setEntries(merged);
      setLoading(false);
    }).catch((e: unknown) => {
      if (!active) return;
      setError(e instanceof Error ? e.message : t("homeDeclarationsPage.errorLoading"));
      setLoading(false);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (groupFilter && e.group !== groupFilter) return false;
      if (campaignFilter !== "ALL" && e.stream !== campaignFilter) return false;
      if (q) {
        return e.subtitle.toLowerCase().includes(q)
          || e.period.toLowerCase().includes(q)
          || e.stream.toLowerCase().includes(q);
      }
      return true;
    });
  }, [entries, groupFilter, campaignFilter, search]);

  // Summary counts
  const submittedCount = entries.filter(
    (e) => e.status === "SUBMITTED" || e.status === "PENDING_REVIEW"
  ).length;
  const pendingCount = entries.filter((e) => e.group === "pending").length;
  const underReviewCount = Math.max(0, pendingCount - submittedCount);
  const approvedCount = entries.filter((e) => e.group === "approved").length;
  const draftCount = entries.filter((e) => e.group === "draft").length;

  function openPdf(entry: HistoryEntry) {
    if (entry.stream === "DSMO") {
      window.open(getDeclarationPdfUrl(entry.id), "_blank");
    }
  }

  function hasPdf(entry: HistoryEntry): boolean {
    if (entry.stream === "DSMO") {
      return !!(entry.pdfUrl && entry.pdfUrl.length > 0);
    }
    return entry.group !== "draft";
  }

  const chipDefs: { label: string; value: Group | null; count: number; color: string }[] = [
    { label: t("homeDeclarationsPage.chipAll", { count: entries.length }), value: null, count: entries.length, color: "var(--cam-accent)" },
    { label: t("homeDeclarationsPage.chipDraft", { count: draftCount }), value: "draft", count: draftCount, color: GROUP_COLOR.draft },
    { label: t("homeDeclarationsPage.chipPending", { count: pendingCount }), value: "pending", count: pendingCount, color: GROUP_COLOR.pending },
    { label: t("homeDeclarationsPage.chipApproved", { count: approvedCount }), value: "approved", count: approvedCount, color: GROUP_COLOR.approved },
    { label: t("homeDeclarationsPage.chipRejected", { count: entries.filter((e) => e.group === "rejected").length }), value: "rejected", count: entries.filter((e) => e.group === "rejected").length, color: GROUP_COLOR.rejected },
  ];

  return (
    // The respondent content measure (--vt-content-max, 940px), so /home has
    // two measures — 600 wizard, 940 content — rather than a third.
    <div style={{ maxWidth: "var(--vt-content-max)", margin: "0 auto", padding: "var(--cam-space-5) var(--cam-space-4)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--cam-space-3)", marginBottom: "var(--cam-space-5)" }}>
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
          style={{ whiteSpace: "nowrap" }}
        >
          {t("homeDeclarationsPage.newDeclarationButton")}
        </button>
      </div>

      {/* Summary cards */}
      {!loading && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))", gap: "var(--cam-space-3)", marginBottom: "var(--cam-space-5)" }}>
          <SummaryCard label={t("homeDeclarationsPage.statusSubmitted")} value={submittedCount} tone="info" />
          <SummaryCard label={t("homeDeclarationsPage.statusPendingReview")} value={underReviewCount} tone="info" />
          <SummaryCard label={t("homeDeclarationsPage.summaryApprovedLabel")} value={approvedCount} tone="success" />
          <SummaryCard label={t("homeDeclarationsPage.summaryDraftLabel")} value={draftCount} tone="muted" />
        </div>
      )}

      {/* Toolbar — filter chips + search + campaign selector */}
      {!loading && !error && (
        <div style={{ marginBottom: "var(--cam-space-4)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--cam-space-2)", marginBottom: "var(--cam-space-3)" }}>
            {chipDefs.map((c) => (
              <button
                key={c.label}
                type="button"
                aria-pressed={groupFilter === c.value}
                onClick={() => setGroupFilter(c.value)}
                style={{
                  padding: "var(--cam-space-1) var(--cam-space-3)",
                  borderRadius: "var(--cam-radius-full)",
                  border: `var(--cam-border-width) solid ${groupFilter === c.value ? c.color : "var(--cam-border-strong)"}`,
                  background: groupFilter === c.value ? c.color : "transparent",
                  color: groupFilter === c.value ? "var(--cam-surface)" : "var(--cam-text)",
                  fontSize: "var(--cam-font-size-xs)",
                  cursor: "pointer",
                  fontWeight: groupFilter === c.value ? 600 : 400,
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--cam-space-2)", alignItems: "center" }}>
            <input
              className="cam-input"
              placeholder={t("homeDeclarationsPage.searchPlaceholder")}
              aria-label={t("homeDeclarationsPage.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: "1 1 14rem", width: "auto", minWidth: 0 }}
            />
            <select
              className="cam-input"
              value={campaignFilter}
              aria-label={t("homeDeclarationsPage.allCampaignsOption")}
              onChange={(e) => setCampaignFilter(e.target.value as "ALL" | Stream)}
              style={{ flex: "0 1 10rem", width: "auto" }}
            >
              <option value="ALL">{t("homeDeclarationsPage.allCampaignsOption")}</option>
              <option value="DSMO">{t("homeDeclarationsPage.dsmoOption")}</option>
              <option value="ONEFOP">{t("homeDeclarationsPage.onefopOption")}</option>
            </select>
            <button
              type="button"
              className="cam-button cam-button-secondary"
              onClick={load}
              title={t("homeDeclarationsPage.refreshTitle")}
              aria-label={t("homeDeclarationsPage.refreshTitle")}
              style={{ padding: "0 var(--cam-space-3)" }}
            >
              ↻
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      {loading && (
        <div style={{ textAlign: "center", padding: "var(--cam-space-7)", color: "var(--cam-text-muted)" }}>
          {t("common.loading")}
        </div>
      )}
      {!loading && error && (
        <div className="cam-error-box" style={{ marginBottom: 16 }}>
          {error}
          <button
            type="button"
            className="cam-button cam-button-secondary cam-button-sm"
            onClick={load}
            style={{ marginLeft: "var(--cam-space-4)" }}
          >
            {t("common.retry")}
          </button>
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState hasEntries={entries.length > 0} onNew={() => router.push("/home/declarations/new")} />
      )}
      {!loading && !error && filtered.length > 0 && (
        <div>
          <h2 style={{ fontSize: "var(--cam-font-size-sm)", fontWeight: 600, color: "var(--cam-text-muted)", margin: "0 0 var(--cam-space-2)" }}>
            {t("homeDeclarationsPage.historyLabel")}
          </h2>
          {filtered.map((entry) => (
            <DeclarationTile
              key={entry.id}
              entry={entry}
              hasPdf={hasPdf(entry)}
              onPdf={() => openPdf(entry)}
              onContinue={entry.group === "draft" ? () => router.push(wizardHref(entry)) : undefined}
              onCorrect={entry.status === "CORRECTION_REQUESTED" ? () => router.push(wizardHref(entry)) : undefined}
            />
          ))}
        </div>
      )}

      {/* New Declaration Dialog (DSMO vs ONEFOP -> Entity selection) */}
      <NewDeclarationDialog
        isOpen={isNewDialogOpen}
        onClose={() => setIsNewDialogOpen(false)}
      />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

// Respondent-styled, not KpiTile (plan D10): KpiTile carries a staff work
// queue's semantics — tone edge, arrow, link — that mean nothing here.
function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "info" | "success" | "muted" }) {
  return (
    <div className="cam-dash-card" style={{ textAlign: "center" }}>
      <div className={`cam-summary-value cam-summary-value--${tone}`}>{value}</div>
      <div className="cam-summary-label">{label}</div>
    </div>
  );
}

function DeclarationTile({
  entry,
  hasPdf,
  onPdf,
  onContinue,
  onCorrect,
}: {
  entry: HistoryEntry;
  hasPdf: boolean;
  onPdf: () => void;
  onContinue?: () => void;
  onCorrect?: () => void;
}) {
  const t = useTranslations();
  const statusLabel = entry.stream === "DSMO"
    ? getDsmoStatusLabel(t, entry.status)
    : getOnefopStatusLabel(t, entry.status);
  // A ruled row, not a card: the history reads as one list.
  return (
    <div style={{
      padding: "var(--cam-space-3) 0",
      borderBottom: "var(--cam-border-width) solid var(--cam-border)",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "var(--cam-space-3)",
    }}>
      {/* Stream: the programme's name, neutral; the status badge carries the colour. */}
      <span className="cam-badge cam-badge-neutral" style={{ flexShrink: 0 }}>
        {entry.stream === "DSMO" ? t("homeDeclarationsPage.dsmoOption") : t("homeDeclarationsPage.onefopOption")}
      </span>

      {/* Title + meta + correction notice */}
      <div style={{ flex: "1 1 auto", minWidth: 0, maxWidth: "100%" }}>
        <div style={{ fontWeight: 600, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.subtitle}
        </div>
        <div style={{ fontSize: "var(--cam-font-size-2xs)", color: "var(--cam-text-muted)" }}>
          {formatDate(entry.date, t)} · {t("homeDeclarationsPage.periodLabel", { period: entry.period })}
        </div>
        {entry.status === "CORRECTION_REQUESTED" && (
          <div style={{
            marginTop: "var(--cam-space-2)",
            padding: "var(--cam-space-2) var(--cam-space-3)",
            borderRadius: "var(--cam-radius-sm)",
            background: "var(--cam-warning-bg)",
            border: "var(--cam-border-width) solid var(--cam-warning-border)",
            color: "var(--cam-text)",
            fontSize: "var(--cam-font-size-2xs)",
            whiteSpace: "normal",
          }}>
            <strong style={{ display: "block" }}>{t("homeDeclarationsPage.correctionRequestedTitle")}</strong>
            <span>{(entry.raw as { rejectionReason?: string | null }).rejectionReason || t("homeDeclarationsPage.correctionRequestedFallback")}</span>
          </div>
        )}
      </div>

      {/* Status */}
      <span className={`cam-badge ${GROUP_BADGE[entry.group]}`} style={{ flexShrink: 0 }}>
        {statusLabel}
      </span>

      {/* Actions */}
      <div style={{ display: "flex", gap: "var(--cam-space-2)", flexShrink: 0 }}>
        {onCorrect && (
          <button
            type="button"
            className="cam-button cam-button-primary cam-button-sm"
            onClick={onCorrect}
          >
            {t("homeDeclarationsPage.correctAndResubmit")}
          </button>
        )}
        {onContinue && (
          <button
            type="button"
            className="cam-button cam-button-secondary cam-button-sm"
            onClick={onContinue}
          >
            {t("homeDeclarationsPage.continueButton")}
          </button>
        )}
        {hasPdf && (
          <button
            type="button"
            className="cam-button cam-button-secondary cam-button-sm"
            onClick={onPdf}
            title={t("homeDeclarationsPage.downloadPdfTitle")}
          >
            {t("homeDeclarationsPage.pdfButtonLabel")}
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasEntries, onNew }: { hasEntries: boolean; onNew: () => void }) {
  const t = useTranslations();
  return (
    <div style={{ textAlign: "center", padding: "var(--cam-space-7) var(--cam-space-5)", color: "var(--cam-text-muted)" }}>
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
