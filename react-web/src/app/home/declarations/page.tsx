"use client";

// Port of lib/screens/dsmo/company_declarations_screen.dart
// Merges GET /dsmo/declarations and GET /onefop/submissions into a unified
// timeline, grouped by status (Draft / Pending / Approved / Rejected).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  getMyDeclarations,
  getMyOnefopSubmissions,
  getDeclarationPdfUrl,
  getCachedUser,
  type DsmoDeclaration,
  type OnefopSubmission,
} from "@/lib/api-client";
import { NewDeclarationDialog } from "@/components/NewDeclarationDialog";

// ── History entry model (matches _HistoryEntry in Flutter) ────────────────

type Stream = "DSMO" | "ONEFOP";
type Group = "draft" | "pending" | "approved" | "rejected";

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
  CORRECTION_REQUESTED: "pending",
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

const GROUP_COLOR: Record<Group, string> = {
  draft: "var(--cam-text-muted)",
  pending: "#2563eb",
  approved: "var(--cam-success, #16a34a)",
  rejected: "var(--cam-error, #dc2626)",
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

function mapOnefop(s: OnefopSubmission, t: Translator): HistoryEntry {
  const group = ONEFOP_GROUP[s.status] ?? "pending";
  const period = s.quarterCode ?? s.period ?? "—";
  const label = s.entityType
    ? t("homeDeclarationsPage.onefopLabelWithEntity", { entityType: s.entityType })
    : t("homeDeclarationsPage.onefopOption");
  return {
    id: s.id,
    stream: "ONEFOP",
    status: s.status,
    group,
    period,
    subtitle: `${label}${period !== "—" ? " · " + period : ""}`,
    date: s.updatedAt ? new Date(s.updatedAt) : s.createdAt ? new Date(s.createdAt) : null,
    raw: s,
  };
}

// ── Component ─────────────────────────────────────────────────────────────

export default function CompanyDeclarationsPage() {
  const router = useRouter();
  const t = useTranslations();

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
      const onefop = onefopRes.status === "fulfilled" ? onefopRes.value.map((s) => mapOnefop(s, t)) : [];
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
      const onefop = onefopRes.status === "fulfilled" ? onefopRes.value.map((s) => mapOnefop(s, t)) : [];
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
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--cam-text)" }}>
            {t("homeDeclarationsPage.pageTitle")}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--cam-text-muted)" }}>
            {t("homeDeclarationsPage.pageSubtitle")}
          </p>
        </div>
        <button
          className="cam-button cam-button-primary"
          onClick={() => setIsNewDialogOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
          {t("homeDeclarationsPage.newDeclarationButton")}
        </button>
      </div>

      {/* Summary cards */}
      {!loading && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          <SummaryCard label={t("homeDeclarationsPage.statusSubmitted")} value={submittedCount} color="#2563eb" />
          <SummaryCard label={t("homeDeclarationsPage.statusPendingReview")} value={underReviewCount} color="#2563eb" />
          <SummaryCard label={t("homeDeclarationsPage.summaryApprovedLabel")} value={approvedCount} color="var(--cam-success, #16a34a)" />
          <SummaryCard label={t("homeDeclarationsPage.summaryDraftLabel")} value={draftCount} color="var(--cam-text-muted)" />
        </div>
      )}

      {/* Toolbar — filter chips + search + campaign selector */}
      {!loading && !error && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {chipDefs.map((c) => (
              <button
                key={c.label}
                onClick={() => setGroupFilter(c.value)}
                style={{
                  padding: "4px 14px",
                  borderRadius: 20,
                  border: `1.5px solid ${groupFilter === c.value ? c.color : "var(--cam-border)"}`,
                  background: groupFilter === c.value ? c.color : "transparent",
                  color: groupFilter === c.value ? "#fff" : "var(--cam-text)",
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: groupFilter === c.value ? 600 : 400,
                  transition: "all 0.15s",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              className="cam-input"
              placeholder={t("homeDeclarationsPage.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, fontSize: 13 }}
            />
            <select
              className="cam-input"
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value as "ALL" | Stream)}
              style={{ width: 160, fontSize: 13 }}
            >
              <option value="ALL">{t("homeDeclarationsPage.allCampaignsOption")}</option>
              <option value="DSMO">{t("homeDeclarationsPage.dsmoOption")}</option>
              <option value="ONEFOP">{t("homeDeclarationsPage.onefopOption")}</option>
            </select>
            <button
              className="cam-button cam-button-secondary"
              onClick={load}
              title={t("homeDeclarationsPage.refreshTitle")}
              style={{ padding: "8px 12px" }}
            >
              ↻
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      {loading && (
        <div style={{ textAlign: "center", padding: 48, color: "var(--cam-text-muted)" }}>
          {t("common.loading")}
        </div>
      )}
      {!loading && error && (
        <div className="cam-error-box" style={{ marginBottom: 16 }}>
          {error}
          <button
            className="cam-button cam-button-secondary"
            onClick={load}
            style={{ marginLeft: 16, fontSize: 12 }}
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
          <p style={{ fontSize: 13, color: "var(--cam-text-muted)", marginBottom: 10 }}>
            {t("homeDeclarationsPage.historyLabel")}
          </p>
          {filtered.map((entry) => (
            <DeclarationTile
              key={entry.id}
              entry={entry}
              hasPdf={hasPdf(entry)}
              onPdf={() => openPdf(entry)}
              onContinue={entry.group === "draft" ? () => router.push("/home/declarations/new") : undefined}
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

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: "var(--cam-surface)",
      border: "1px solid var(--cam-border)",
      borderRadius: 10,
      padding: "14px 16px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--cam-text-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function DeclarationTile({
  entry,
  hasPdf,
  onPdf,
  onContinue,
}: {
  entry: HistoryEntry;
  hasPdf: boolean;
  onPdf: () => void;
  onContinue?: () => void;
}) {
  const t = useTranslations();
  const statusLabel = entry.stream === "DSMO"
    ? getDsmoStatusLabel(t, entry.status)
    : getOnefopStatusLabel(t, entry.status);
  const color = GROUP_COLOR[entry.group];

  return (
    <div style={{
      background: "var(--cam-surface)",
      border: "1px solid var(--cam-border)",
      borderRadius: 10,
      padding: "14px 18px",
      marginBottom: 8,
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}>
      {/* Stream badge */}
      <div style={{
        padding: "3px 9px",
        borderRadius: 6,
        background: entry.stream === "DSMO" ? "var(--cam-accent-soft, #e8f0fe)" : "#f0fdf4",
        color: entry.stream === "DSMO" ? "var(--cam-accent)" : "#16a34a",
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}>
        {entry.stream}
      </div>

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--cam-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.subtitle}
        </div>
        <div style={{ fontSize: 12, color: "var(--cam-text-muted)", marginTop: 2 }}>
          {formatDate(entry.date, t)} · {t("homeDeclarationsPage.periodLabel", { period: entry.period })}
        </div>
      </div>

      {/* Status pill */}
      <div style={{
        padding: "3px 10px",
        borderRadius: 20,
        border: `1.5px solid ${color}`,
        color,
        fontSize: 11,
        fontWeight: 600,
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}>
        {statusLabel}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {onContinue && (
          <button
            className="cam-button cam-button-secondary"
            onClick={onContinue}
            style={{ fontSize: 12, padding: "5px 12px" }}
          >
            {t("homeDeclarationsPage.continueButton")}
          </button>
        )}
        {hasPdf && (
          <button
            className="cam-button cam-button-secondary"
            onClick={onPdf}
            style={{ fontSize: 12, padding: "5px 12px" }}
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
    <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--cam-text-muted)" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
      <p style={{ fontWeight: 600, color: "var(--cam-text)", marginBottom: 6 }}>
        {hasEntries ? t("homeDeclarationsPage.emptyNoResultsTitle") : t("homeDeclarationsPage.emptyNoDeclarationsTitle")}
      </p>
      <p style={{ fontSize: 13, marginBottom: 20 }}>
        {hasEntries
          ? t("homeDeclarationsPage.emptyNoResultsBody")
          : t("homeDeclarationsPage.emptyNoDeclarationsBody")}
      </p>
      {!hasEntries && (
        <button className="cam-button cam-button-primary" onClick={onNew}>
          {t("homeDeclarationsPage.newDeclarationButton")}
        </button>
      )}
    </div>
  );
}
