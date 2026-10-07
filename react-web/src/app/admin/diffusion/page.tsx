"use client";

import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { directoryRoleLabel } from "@/lib/user-directory";
import {
  getSpssManifest,
  downloadSpssSavBlob,
  downloadSpssCsvBlob,
  downloadExcelWorkbookBlob,
  getDataManagementStats,
  getExportHistory,
} from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { useTerritoryDepartments, useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions, useActiveCampaign } from "@/components/admin/AdminHeaderActions";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { NATIONAL_ROLES } from "@/lib/roles";
import { DataState } from "@/components/admin/DataState";
import { useOnefopSchema } from "@/lib/use-onefop-schema";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { listAdminQuestionnaires } from "@/lib/api-client";
import { listCampaigns } from "@/lib/campaigns";
import {
  NOT_PROVIDED,
  count,
  meterWidth,
  percent,
  rate,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";

// Mirrors ADMIN_LIST_FORM_TYPES on the backend (src/questionnaires/
// admin-list-filter.ts); each one is counted with its own scoped query.
const BREAKDOWN_FORM_TYPES = [
  "ENTREPRISE",
  "COOPERATIVE",
  "ADMINISTRATION",
  "PROJECT_PROGRAM",
  "CTD",
  "ONG",
  "VOCATIONAL_TRAINING",
] as const;

function getStatusCount(
  source: Record<string, number> | { status: string; _count: number }[] | undefined | null,
  statuses: string[],
): number | null {
  if (!source) return null;
  if (Array.isArray(source)) {
    const item = source.find((s) => statuses.includes(s.status));
    return item ? item._count : null;
  }
  if (typeof source === "object") {
    for (const st of statuses) {
      if (typeof (source as Record<string, number>)[st] === "number") {
        return (source as Record<string, number>)[st];
      }
    }
  }
  return null;
}

// Employer-type filter: the seven types, labelled through ENTITY_TYPE_OPTION_KEYS.
// The empty option used to read "(6 types)" over seven.
const ENTITY_TYPE_VALUES = ["ENTREPRISE", "COOPERATIVE", "CTD", "ONG", "ADMINISTRATION", "PROJECT_PROGRAM", "VOCATIONAL_TRAINING"];

// Labels: adminDiffusionPage.status.<value>.
const STATUS_VALUES = ["APPROVED", "ALL", "PENDING_REVIEW", "REJECTED"];

type Translate = ReturnType<typeof useTranslations>;

function typeLabel(tRoot: Translate, type: string): string {
  return ENTITY_TYPE_OPTION_KEYS[type] ? tRoot(ENTITY_TYPE_OPTION_KEYS[type]) : entityTypeLabel(type);
}

// Icons matching Figma donnees/exports.png
const IconFileCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconCheckCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconXCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const IconDownloadTray = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconPlayLaunch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const IconSpinner = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" aria-hidden="true">
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
  </svg>
);

function formatExportFormat(fmt: string): string {
  switch (fmt?.toUpperCase()) {
    case "SPSS_SAV":
      return "SPSS (.sav)";
    case "SPSS_CSV":
      return "CSV (.csv)";
    case "EXCEL":
      return "Excel (.xlsx)";
    default:
      return fmt || NOT_PROVIDED;
  }
}

function formatExportScope(filters: Record<string, unknown> | null | undefined, tRoot: Translate): string {
  const t = (key: string, values?: Record<string, string>) => tRoot(`adminDiffusionPage.${key}`, values);
  if (!filters || typeof filters !== "object" || Object.keys(filters).length === 0) {
    return t("fullScope");
  }
  const parts: string[] = [];
  if (filters.region && typeof filters.region === "string") parts.push(t("scopeRegion", { value: filters.region }));
  if (filters.department && typeof filters.department === "string") parts.push(t("scopeDepartment", { value: filters.department }));
  if (filters.campaign && typeof filters.campaign === "string") parts.push(t("scopeCampaign", { value: filters.campaign }));
  if (filters.entityType && typeof filters.entityType === "string") parts.push(t("scopeType", { value: typeLabel(tRoot, filters.entityType) }));
  if (Array.isArray(filters.statuses) && filters.statuses.length > 0) parts.push(t("scopeStatuses", { value: filters.statuses.join(", ") }));
  return parts.length > 0 ? parts.join(" • ") : t("fullScope");
}

export default function DiffusionPage() {
  const { isLoading, forbidden } = useAdminScreenGuard(NATIONAL_ROLES);
  const tRoot = useTranslations();
  const t = useTranslations("adminDiffusionPage");
  const locale = asUiLocale(useLocale());
  const user = useAuthStore((s) => s.user);
  // The subtitle names the active campaign, when there is one, instead of
  // a fixed « Campagne 2026 ».
  const { activeCampaign } = useActiveCampaign();
  const activeCampaignName = activeCampaign?.name || activeCampaign?.code || null;

  // Stats query
  const statsQuery = useQuery({
    queryKey: ["admin", "data-management-stats"],
    queryFn: getDataManagementStats,
    enabled: !isLoading && !forbidden,
  });
  const stats = statsQuery.data;

  // Campaigns query
  const campaignsQuery = useQuery({
    queryKey: ["campaigns", "all"],
    queryFn: () => listCampaigns(),
    enabled: !isLoading && !forbidden,
  });

  // Export formats
  const [selectedFormat, setSelectedFormat] = useState<".sav" | ".csv" | ".xlsx">(".sav");

  // Codebook syntax checkbox
  const [includeCodebook, setIncludeCodebook] = useState(true);

  // Scope mode radio: all | campaign | region | custom
  const [scopeMode, setScopeMode] = useState<"all" | "campaign" | "region" | "custom">("all");

  // Dropdown states. The campaign the actor picked, or "" until they pick
  // one; until then the active campaign (else the first listed) is used.
  // Derived rather than copied into state, so no setState runs in render.
  const [campaignChoice, setCampaignChoice] = useState("");
  const defaultCampaign = useMemo(() => {
    const campaigns = campaignsQuery.data ?? [];
    if (campaigns.length === 0) return "";
    const active = campaigns.find((c) => c.status === "ACTIVE");
    return active?.code || active?.name || campaigns[0].code || campaigns[0].name || "";
  }, [campaignsQuery.data]);
  const selectedCampaign = campaignChoice || defaultCampaign;

  // The <select> carries code || name || id (that is what the filename and the
  // scope label show), so the campaign's real id has to be resolved back out
  // of the list: the backend filter is OnefopSubmission.campaignId.
  const selectedCampaignId = useMemo(() => {
    const campaigns = campaignsQuery.data ?? [];
    const match = campaigns.find((c) => (c.code || c.name || c.id) === selectedCampaign);
    return match?.id ?? null;
  }, [campaignsQuery.data, selectedCampaign]);

  const [selectedRegion, setSelectedRegion] = useState("Toutes");
  const [selectedStatus, setSelectedStatus] = useState("APPROVED");

  // Additional granular filters (preserved so no capabilities are dropped)
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Download states
  const [isExporting, setIsExporting] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const serverHistoryQuery = useQuery({
    queryKey: ["admin", "data-management", "export", "history"],
    queryFn: () => getExportHistory(20),
    enabled: !isLoading && !forbidden,
  });

  const schemaQuery = useOnefopSchema();

  /**
   * Repository KPIs.
   *
   * Source: GET /data-management/stats (DataManagementService.getDataStats).
   * Fields: totals.onefopSubmissions, onefopByStatus[APPROVED |
   * PENDING_REVIEW | REJECTED].
   *
   * That endpoint applies no territorial filter. It is only truthful here
   * because this screen is guarded to NATIONAL_ROLES (SUPER_ADMIN, ADMIN_ONEFOP)
   * - all national-scope roles. Do not reuse it on a screen reachable by
   * REGIONAL_ADMIN or DIVISIONAL_ADMIN.
   *
   * `null` means "not retrieved" and renders as an em dash. It is never
   * replaced by a stand-in, and 0 is reported as 0.
   */
  const totalSubmissions: number | null =
    stats?.totals?.onefopSubmissions ?? stats?.totalOnefopSubmissions ?? null;

  const approvedCount = getStatusCount(stats?.onefopByStatus, ["APPROVED"]);
  const pendingCount = getStatusCount(stats?.onefopByStatus, ["PENDING_REVIEW"]);
  const rejectedCount = getStatusCount(stats?.onefopByStatus, ["REJECTED"]);

  // One scoped count per employer type. `total` from each response is the
  // count of the whole filtered query, so summing them counts real dossiers,
  // not the rows that happen to be on a page.
  const typeTotals = useQueries({
    queries: BREAKDOWN_FORM_TYPES.map((formType) => ({
      queryKey: ["admin", "questionnaires", "total", formType],
      queryFn: () => listAdminQuestionnaires({ formType, limit: 1 }),
      enabled: !isLoading && !forbidden,
    })),
  });

  const typeBreakdownState = resolveDataState({
    isLoading: typeTotals.some((q) => q.isLoading),
    isError: typeTotals.some((q) => q.isError),
    error: typeTotals.find((q) => q.isError)?.error,
  });

  const typeTotalsKey = typeTotals.map((q) => q.data?.total ?? "").join("|");
  const typeBreakdown = useMemo(() => {
    const rows = BREAKDOWN_FORM_TYPES.map((formType, i) => ({
      formType,
      label: typeLabel(tRoot, formType),
      total: typeTotals[i].data?.total ?? null,
    }));
    const sum = rows.reduce((acc, r) => acc + (r.total ?? 0), 0);
    return rows
      .map((r) => ({ ...r, share: rate(r.total, sum) }))
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeTotalsKey, locale]);

  // Derived exclusively from the two backend values above, over the same
  // server-side scope. null whenever either operand is missing or the
  // denominator is 0 - the UI then renders an em dash, never an estimate.
  const approvedRate = rate(approvedCount, totalSubmissions);
  const pendingRate = rate(pendingCount, totalSubmissions);
  const rejectedRate = rate(rejectedCount, totalSubmissions);

  const { regions: territoryRegions } = useTerritoryRegions();
  const CAMEROON_REGIONS = useMemo(() => ["Toutes", ...territoryRegions], [territoryRegions]);
  const { departments: deptList } = useTerritoryDepartments(selectedRegion === "Toutes" ? null : selectedRegion);

  // Cascading departments for selected region
  const availableDepartments = useMemo(() => {
    if (!selectedRegion || selectedRegion === "Toutes") return [];
    return deptList.map((d) => ({ name: d }));
  }, [selectedRegion, deptList]);

  const currentFilters = useMemo(() => {
    const filters: Record<string, any> = {};
    if (selectedRegion && selectedRegion !== "Toutes") filters.region = selectedRegion;
    if (selectedDepartment) filters.department = selectedDepartment;
    if (selectedEntityType) filters.entityType = selectedEntityType;
    // campaignId is the one the export actually filters on
    // (buildOnefopExportWhere); `campaign` is kept alongside it because it
    // carries the human-readable code that formatExportScope renders in the
    // export history. Sending only the id would show a UUID there.
    if (selectedCampaign) filters.campaign = selectedCampaign;
    if (selectedCampaignId) filters.campaignId = selectedCampaignId;
    if (selectedStatus === "APPROVED") {
      filters.statuses = ["APPROVED"];
    } else if (selectedStatus === "PENDING_REVIEW") {
      filters.statuses = ["PENDING_REVIEW"];
    } else if (selectedStatus === "REJECTED") {
      filters.statuses = ["REJECTED"];
    }
    return filters;
  }, [selectedRegion, selectedDepartment, selectedEntityType, selectedCampaign, selectedCampaignId, selectedStatus]);

  const triggerFileDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      } catch {
        // safe ignore
      }
    }, 2500);
  };

  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const recordExport = () => {
    serverHistoryQuery.refetch();
  };

  /**
   * Downloads the SPSS syntax the server generated for the current filters.
   *
   * Source: POST /data-management/export/submissions/spss/manifest -> { sps }.
   * The syntax describes the variable dictionary of the real extract, so it is
   * never substituted: a hand-written codebook would mislabel the data it
   * claims to describe.
   */
  const downloadCodebook = async (filename: string) => {
    const manifest = await getSpssManifest(currentFilters);
    if (!manifest?.sps) {
      setErrorAlert(t("noSpssSyntax"));
      return;
    }
    triggerFileDownload(new Blob([manifest.sps], { type: "text/plain;charset=utf-8" }), filename);
  };

  /**
   * Launches the export the actor configured.
   *
   * There is no fallback payload. If the server cannot produce the extract the
   * real error is surfaced and nothing is downloaded - handing someone a
   * synthesised file that looks like an official extract is the worst failure
   * mode available to a statistical register.
   */
  const handleLaunchExport = async () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const plan = {
      ".sav": { download: downloadSpssSavBlob, ext: "sav", label: t("planSav") },
      ".csv": { download: downloadSpssCsvBlob, ext: "csv", label: t("planCsv") },
      ".xlsx": { download: downloadExcelWorkbookBlob, ext: "xlsx", label: t("planXlsx") },
    }[selectedFormat];

    try {
      setIsExporting(true);
      setErrorAlert(null);

      const blob = await plan.download(currentFilters);
      if (blob.size === 0) {
        setErrorAlert(t("emptyFile"));
        return;
      }

      const filename = `onefop_export_${selectedCampaign}_${timestamp}.${plan.ext}`;
      triggerFileDownload(blob, filename);
      recordExport();
      showSuccess(t("downloaded", { label: plan.label }));

      if (includeCodebook && selectedFormat === ".sav") {
        await downloadCodebook(`onefop_codebook_${selectedCampaign}_${timestamp}.sps`);
      }
    } catch (err: unknown) {
      setErrorAlert(t("exportFailed", { message: err instanceof Error ? err.message : t("unknownError") }));
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * The documentation downloads offered next to the export.
   *
   * Only the SPSS syntax has an authoritative source. The variable dictionary
   * and the CNAE/FAP recoding guide have none
   * (docs/admin-data-integrity-inventory.md section 7), so they are not
   * offered: a hand-written dictionary shipped under an official filename
   * would be read as the register's real metadata.
   */
  const handleDownloadCodebookSps = async () => {
    try {
      setErrorAlert(null);
      await downloadCodebook("onefop_codebook_principal.sps");
      showSuccess(t("spssDownloaded"));
    } catch (err: unknown) {
      setErrorAlert(t("spssFailed", { message: err instanceof Error ? err.message : t("unknownError") }));
    }
  };

  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <p className="cam-admin-lede">{t("forbidden")}</p>
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      {/* ── Top App Bar (AdminPageHeader with right search, territory & flag) ── */}
      <AdminPageHeader
        breadcrumb={[{ label: tRoot("adminNav.hubs.donnees") }, { label: tRoot("adminNav.routes.diffusion") }]}
        title={tRoot("adminNav.routes.diffusion")}
        subtitle={activeCampaignName ? t("subtitleWithCampaign", { campaign: activeCampaignName }) : t("subtitle")}
        actions={
          <AdminHeaderActions
            showCampaignPill={false}
            showBell={false}
            showSearchInput={true}
          />
        }
      />

      {/* Alerts / feedback */}
      {errorAlert && (
        <div role="alert" className="flex items-center justify-between p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <span>{errorAlert}</span>
          <button type="button" aria-label={t("closeAriaLabel")} onClick={() => setErrorAlert(null)} className="text-red-500 hover:text-red-800 text-lg font-bold cursor-pointer">×</button>
        </div>
      )}
      {successToast && (
        <div role="status" className="flex items-center justify-between p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          <span>{successToast}</span>
          <button type="button" aria-label={t("closeAriaLabel")} onClick={() => setSuccessToast(null)} className="text-emerald-600 hover:text-emerald-900 text-lg font-bold cursor-pointer">×</button>
        </div>
      )}

      {/* ── 4 KPI Cards (Figma donnees/exports.png) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Déclarations */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              {t("kpiTotal")}
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <IconFileCheck />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[32px] font-extrabold tracking-tight text-slate-900 leading-none">
              {statsQuery.isLoading ? "…" : count(totalSubmissions, locale)}
            </div>
            {/* No month-over-month trend: /data-management/stats returns a
                single snapshot with no prior period to compare against. */}
            <div className="text-xs font-semibold text-slate-500 mt-2">
              {t("kpiTotalHint")}
            </div>
          </div>
        </div>

        {/* Card 2: Déclarations Validées */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              {t("kpiValidated")}
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <IconCheckCircle />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[32px] font-extrabold tracking-tight text-slate-900 leading-none">
              {statsQuery.isLoading ? "…" : count(approvedCount, locale)}
            </div>
            <div className="text-xs font-semibold text-slate-600 mt-2">
              {t("kpiValidatedRate", { rate: percent(approvedRate, 0, locale) })}
            </div>
          </div>
        </div>

        {/* Card 3: En Attente de Révision */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              {t("kpiPending")}
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <IconClock />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[32px] font-extrabold tracking-tight text-slate-900 leading-none">
              {statsQuery.isLoading ? "…" : count(pendingCount, locale)}
            </div>
            <div className="text-xs font-semibold text-amber-600 mt-2">
              {t("kpiPendingRate", { rate: percent(pendingRate, 0, locale) })}
            </div>
          </div>
        </div>

        {/* Card 4: Déclarations Rejetées */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              {t("kpiRejected")}
            </span>
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <IconXCircle />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[32px] font-extrabold tracking-tight text-slate-900 leading-none">
              {statsQuery.isLoading ? "…" : count(rejectedCount, locale)}
            </div>
            <div className="text-xs font-semibold text-rose-600 mt-2">
              {t("kpiRejectedRate", { rate: percent(rejectedRate, 0, locale) })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-Column Layout (Configuration & Dataset Summary) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── Left Column: Configuration de l'Export ── */}
        <section
          aria-labelledby="export-config-heading"
          className="lg:col-span-7 bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs"
        >
          <div className="mb-5">
            <h2 id="export-config-heading" className="text-lg font-bold text-slate-900">
              {t("configTitle")}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("configSubtitle")}
            </p>
          </div>

          {/* Section 1: FORMAT DE FICHIER */}
          <div className="mb-5">
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">
              {t("formatTitle")}
            </div>
            <div className="space-y-2.5">
              {[
                { id: ".sav", label: t("formatSav") },
                { id: ".csv", label: t("formatCsv") },
                { id: ".xlsx", label: t("formatXlsx") },
              ].map((fmt) => {
                const isChecked = selectedFormat === fmt.id;
                return (
                  <label
                    key={fmt.id}
                    className="flex items-center gap-3 cursor-pointer group select-none"
                  >
                    <div className="relative flex items-center justify-center">
                      <input
                        type="radio"
                        name="file-format"
                        checked={isChecked}
                        onChange={() => setSelectedFormat(fmt.id as any)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                          isChecked
                            ? "border-[#006644] bg-[#006644]"
                            : "border-slate-300 bg-white group-hover:border-slate-400"
                        }`}
                      >
                        {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <span className={`text-sm ${isChecked ? "font-semibold text-slate-900" : "font-normal text-slate-700"}`}>
                      {fmt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-100 my-5" />

          {/* Section 2: CODEBOOK & SYNTAXE */}
          <div className="mb-5">
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">
              {t("codebookTitle")}
            </div>
            <div>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={includeCodebook}
                    onChange={(e) => setIncludeCodebook(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      includeCodebook
                        ? "border-[#006644] bg-[#006644] text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {includeCodebook && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 3.5 6.5 9 1" />
                      </svg>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-semibold text-slate-800">
                    {t("codebookLabel")}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t("codebookHint")}
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="border-t border-slate-100 my-5" />

          {/* Section 3: PÉRIMÈTRE DES DONNÉES */}
          <div className="mb-5">
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">
              {t("scopeTitle")}
            </div>
            <div className="space-y-2.5">
              {[
                {
                  id: "all",
                  label:
                    totalSubmissions === null
                      ? t("scopeAll")
                      : t("scopeAllCount", { count: count(totalSubmissions, locale) }),
                },
                { id: "campaign", label: t("scopeByCampaign") },
                { id: "region", label: t("scopeByRegion") },
                { id: "custom", label: t("scopeCustom") },
              ].map((scp) => {
                const isChecked = scopeMode === scp.id;
                return (
                  <label
                    key={scp.id}
                    className="flex items-center gap-3 cursor-pointer group select-none"
                  >
                    <div className="relative flex items-center justify-center">
                      <input
                        type="radio"
                        name="scope-mode"
                        checked={isChecked}
                        onChange={() => setScopeMode(scp.id as any)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                          isChecked
                            ? "border-[#006644] bg-[#006644]"
                            : "border-slate-300 bg-white group-hover:border-slate-400"
                        }`}
                      >
                        {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <span className={`text-sm ${isChecked ? "font-semibold text-slate-900" : "font-normal text-slate-700"}`}>
                      {scp.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-100 my-5" />

          {/* ── Dropdowns Row (Campagne, Région, Statut) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {/* Dropdown 1: CAMPAGNE */}
            <div>
              <label htmlFor="select-campagne" className="block text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
                {t("campaignLabel")}
              </label>
              <div className="relative">
                <select
                  id="select-campagne"
                  value={selectedCampaign}
                  onChange={(e) => setCampaignChoice(e.target.value)}
                  className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
                >
                  {campaignsQuery.data && campaignsQuery.data.length > 0 ? (
                    campaignsQuery.data.map((c) => (
                      <option key={c.id} value={c.code || c.name || c.id}>
                        {c.name || c.code || c.id}
                      </option>
                    ))
                  ) : (
                    <option value="">
                      {campaignsQuery.isLoading ? tRoot("common.loading") : t("noCampaign")}
                    </option>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 1 5 5 9 1" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Dropdown 2: RÉGION */}
            <div>
              <label htmlFor="select-region" className="block text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
                {t("regionLabel")}
              </label>
              <div className="relative">
                <select
                  id="select-region"
                  value={selectedRegion}
                  onChange={(e) => {
                    setSelectedRegion(e.target.value);
                    setSelectedDepartment("");
                  }}
                  className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
                >
                  {CAMEROON_REGIONS.map((r) => (
                    <option key={r} value={r}>{r === "Toutes" ? t("allRegions") : r}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 1 5 5 9 1" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Dropdown 3: STATUT */}
            <div>
              <label htmlFor="select-statut" className="block text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-1.5">
                {t("statusLabel")}
              </label>
              <div className="relative">
                <select
                  id="select-statut"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
                >
                  {STATUS_VALUES.map((value) => (
                    <option key={value} value={value}>{t(`status.${value}`)}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 1 5 5 9 1" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Granular filters (collapsible, never dropped) */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-xs font-medium text-[#006644] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{showAdvancedFilters ? t("hideFilters") : t("showFilters")}</span>
              <span className="text-[10px]">{showAdvancedFilters ? "▲" : "▼"}</span>
            </button>

            {showAdvancedFilters && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="adv-dept" className="block text-[10px] font-semibold text-slate-600 mb-1">
                    {t("departmentFor", { scope: selectedRegion !== "Toutes" ? selectedRegion : t("national") })}
                  </label>
                  <select
                    id="adv-dept"
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    disabled={selectedRegion === "Toutes"}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-800 disabled:opacity-50"
                  >
                    <option value="">{t("allDepartments")}</option>
                    {availableDepartments.map((d) => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="adv-entity" className="block text-[10px] font-semibold text-slate-600 mb-1">
                    {t("establishmentType")}
                  </label>
                  <select
                    id="adv-entity"
                    value={selectedEntityType}
                    onChange={(e) => setSelectedEntityType(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-800"
                  >
                    <option value="">{t("allEmployers")}</option>
                    {ENTITY_TYPE_VALUES.map((value) => (
                      <option key={value} value={value}>{typeLabel(tRoot, value)}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* ── Main CTA: Lancer l'Export ── */}
          <div>
            <button
              type="button"
              onClick={handleLaunchExport}
              disabled={isExporting}
              className="w-full bg-[#006644] hover:bg-[#005438] active:bg-[#004730] text-white font-semibold text-sm py-3 px-6 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isExporting ? <IconSpinner /> : <IconPlayLaunch />}
              <span>{isExporting ? t("generating") : t("launch")}</span>
            </button>
            <div className="text-[11px] text-slate-400 text-center mt-2.5">
              {t("spssCompatible")}
            </div>
          </div>
        </section>

        {/* ── Right Column: Résumé & Codebooks Disponibles ── */}
        <div className="lg:col-span-5 flex flex-col gap-6">

          {/* ── Card 1: Résumé du Jeu de Données ── */}
          <section
            aria-labelledby="dataset-summary-heading"
            className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs"
          >
            <div className="mb-5">
              <h2 id="dataset-summary-heading" className="text-base font-bold text-slate-900">
                {t("summaryTitle")}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("summarySubtitle")}
              </p>
            </div>

            {/* Volume and structure of the dataset.
                - Total enregistrements: GET /data-management/stats
                  (totals.onefopSubmissions).
                - Variables / Sections: the canonical ONEFOP schema served at
                  /schemas/onefop.schema.json (astTotals.questions /
                  astTotals.sections), compiled from onefop_ast.dart.
                "Taille estimée" is not shown: nothing computes the byte size
                of an extract before it is generated. */}
            <div className="space-y-2.5 text-sm text-slate-600 mb-5">
              <div className="flex items-center justify-between">
                <span>{t("totalRecords")}</span>
                <span className="font-bold text-slate-900">
                  {statsQuery.isLoading ? "…" : count(totalSubmissions, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t("schemaVariables")}</span>
                <span className="font-bold text-slate-900">
                  {schemaQuery.isLoading ? "…" : count(schemaQuery.data?.astTotals.questions ?? null, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t("schemaSections")}</span>
                <span className="font-bold text-slate-900">
                  {schemaQuery.isLoading ? "…" : count(schemaQuery.data?.astTotals.sections ?? null, locale)}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-100 my-4" />

            {/* Breakdown by employer type.
                Source: GET /admin/questionnaires?formType=<T>&limit=1 per
                type — `total` is the count of the whole filtered query under
                the caller's server-side scope, not of the returned page.
                Share = that type's total / the sum of the retrieved totals,
                rendered only once every query has answered, so a partial load
                can never produce a wrong share. */}
            <div>
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">
                {t("breakdownTitle")}
              </div>

              {typeBreakdownState !== "ready" ? (
                <DataState
                  dense
                  state={typeBreakdownState}
                  resource={t("breakdownResource")}
                  error={typeTotals.find((q) => q.isError)?.error}
                />
              ) : (
                <div className="space-y-3">
                  {typeBreakdown.map((row) => (
                    <div key={row.formType} className="flex items-center text-xs">
                      <span className="w-28 font-medium text-slate-700 shrink-0">
                        {row.label}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 mx-3 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#006644]"
                          style={{ width: meterWidth(row.share) }}
                        />
                      </div>
                      <span className="w-12 text-right font-bold text-slate-800 shrink-0">
                        {count(row.total, locale)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── Card 2: Documentation du jeu de données ── */}
          <section
            aria-labelledby="codebooks-heading"
            className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs"
          >
            <div className="mb-4">
              <h2 id="codebooks-heading" className="text-base font-bold text-slate-900">
                {t("docsTitle")}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("docsSubtitle")}
              </p>
            </div>

            <div className="space-y-3.5 pt-2">
              {/* Server-generated SPSS syntax — the only documentation
                  artefact with an authoritative source. Its size is unknown
                  before the request, so none is claimed. */}
              <button
                type="button"
                onClick={handleDownloadCodebookSps}
                className="w-full text-left flex items-start gap-3 group cursor-pointer p-1.5 -mx-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="text-[#006644] mt-0.5 shrink-0 group-hover:scale-105 transition-transform">
                  <IconDownloadTray />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800 group-hover:text-[#006644] transition-colors">
                    {t("spssCurrent")}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {t("spssOnDemand")}
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <DataState
                dense
                state="unavailable"
                resource={t("referenceResource")}
                title={t("referenceTitle")}
                hint={t("referenceHint")}
              />
            </div>
          </section>

        </div>
      </div>

      {/* ── Bottom Section: Historique des Exports Récents (Figma donnees/exports.png) ── */}
      <section
        aria-labelledby="recent-exports-heading"
        className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs"
      >
        <div className="mb-4">
          <h2 id="recent-exports-heading" className="text-base font-bold text-slate-900">
            {t("historyTitle")}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t("historySubtitle")}
          </p>
        </div>

        {serverHistoryQuery.isLoading ? (
          <DataState
            state="loading"
            resource={t("historyResource")}
            title={t("historyLoading")}
          />
        ) : serverHistoryQuery.isError ? (
          <DataState
            state="error"
            resource={t("historyResource")}
            error={serverHistoryQuery.error}
            onRetry={() => serverHistoryQuery.refetch()}
          />
        ) : !serverHistoryQuery.data || serverHistoryQuery.data.length === 0 ? (
          <DataState
            state="empty"
            resource={t("historyResource")}
            title={t("historyEmptyTitle")}
            hint={t("historyEmptyHint")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 tracking-wider">
                  <th className="py-3 px-3">{t("dateColumn")}</th>
                  <th className="py-3 px-3">{t("userColumn")}</th>
                  <th className="py-3 px-3">{t("formatColumn")}</th>
                  <th className="py-3 px-3">{t("scopeColumn")}</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-700 divide-y divide-slate-50">
                {serverHistoryQuery.data.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-3 whitespace-nowrap text-slate-600">
                      {stamp(row.timestamp, true, locale)}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                      {row.user?.name || row.user?.email || NOT_PROVIDED}
                      {row.user?.role && (
                        <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                          ({directoryRoleLabel(row.user.role, locale)})
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      {formatExportFormat(row.format)}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600">
                      {formatExportScope(row.filters, tRoot)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}
