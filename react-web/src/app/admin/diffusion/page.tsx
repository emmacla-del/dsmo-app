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
  buildExportFilters,
  DEMAND_ENTITY_TYPES,
  EXPORT_QUESTIONNAIRES,
  type ExportQuestionnaire,
  type ExportStatusChoice,
} from "@/lib/diffusion-export-filters";
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

// Labels: adminDiffusionPage.status.<value>.
const STATUS_VALUES: ExportStatusChoice[] = ["APPROVED", "ALL", "PENDING_REVIEW", "REJECTED"];

// Export formats offered. Labels: adminDiffusionPage.<labelKey>.
const EXPORT_FORMATS = [
  { id: ".sav", labelKey: "formatSav" },
  { id: ".csv", labelKey: "formatCsv" },
  { id: ".xlsx", labelKey: "formatXlsx" },
] as const;

type ScopeMode = "all" | "campaign" | "region" | "custom";

// Scope radio. "all" carries its own count-bearing label; the others are
// labelled through adminDiffusionPage.<key>.
const SCOPE_MODES: ScopeMode[] = ["all", "campaign", "region", "custom"];
const SCOPE_LABEL_KEYS: Record<Exclude<ScopeMode, "all">, string> = {
  campaign: "scopeByCampaign",
  region: "scopeByRegion",
  custom: "scopeCustom",
};

type Translate = ReturnType<typeof useTranslations>;

function typeLabel(tRoot: Translate, type: string): string {
  return ENTITY_TYPE_OPTION_KEYS[type] ? tRoot(ENTITY_TYPE_OPTION_KEYS[type]) : entityTypeLabel(type);
}

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
  else if (filters.partition === "DEMAND") parts.push(t("scopeQuestionnaire", { value: t("questionnaire.DEMAND") }));
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
  const [scopeMode, setScopeMode] = useState<ScopeMode>("all");

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
  const [selectedStatus, setSelectedStatus] = useState<ExportStatusChoice>("APPROVED");
  // The questionnaire decides the SPSS file's variables: employers (1–6) or
  // training centres. The default keeps the employer file.
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<ExportQuestionnaire>("DEMAND");

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

  // See lib/diffusion-export-filters.ts for the two server rules it encodes.
  const currentFilters = useMemo(
    () =>
      buildExportFilters({
        questionnaire: selectedQuestionnaire,
        status: selectedStatus,
        region: selectedRegion,
        department: selectedDepartment,
        entityType: selectedEntityType,
        campaign: selectedCampaign,
        campaignId: selectedCampaignId,
      }),
    [selectedQuestionnaire, selectedRegion, selectedDepartment, selectedEntityType, selectedCampaign, selectedCampaignId, selectedStatus],
  );

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

  const header = (
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
  );

  // The screen guard's two non-ready outcomes keep the page chrome and say
  // what is happening. Neither renders nothing (G10).
  if (isLoading || forbidden) {
    return (
      <div className="cam-admin-page">
        {header}
        <DataState
          state={isLoading ? "loading" : "forbidden"}
          resource={t("historyResource")}
          title={isLoading ? tRoot("common.loading") : t("forbidden")}
        />
      </div>
    );
  }

  // Repository KPIs: counts from GET /data-management/stats, rates derived
  // from them. No month-over-month trend: the endpoint returns a single
  // snapshot with no prior period to compare against.
  const repositoryKpis = [
    { key: "total", label: t("kpiTotal"), value: totalSubmissions, hint: t("kpiTotalHint") },
    { key: "approved", label: t("kpiValidated"), value: approvedCount, hint: t("kpiValidatedRate", { rate: percent(approvedRate, 0, locale) }) },
    { key: "pending", label: t("kpiPending"), value: pendingCount, hint: t("kpiPendingRate", { rate: percent(pendingRate, 0, locale) }) },
    { key: "rejected", label: t("kpiRejected"), value: rejectedCount, hint: t("kpiRejectedRate", { rate: percent(rejectedRate, 0, locale) }) },
  ];

  // Volume and structure of the dataset.
  //  - Total enregistrements: GET /data-management/stats (totals.onefopSubmissions).
  //  - Variables / Sections: the canonical ONEFOP schema served at
  //    /schemas/onefop.schema.json (astTotals.questions / astTotals.sections),
  //    compiled from onefop_ast.dart.
  // "Taille estimée" is not shown: nothing computes the byte size of an
  // extract before it is generated.
  const datasetFigures = [
    { key: "records", label: t("totalRecords"), loading: statsQuery.isLoading, value: totalSubmissions },
    { key: "variables", label: t("schemaVariables"), loading: schemaQuery.isLoading, value: schemaQuery.data?.astTotals.questions ?? null },
    { key: "sections", label: t("schemaSections"), loading: schemaQuery.isLoading, value: schemaQuery.data?.astTotals.sections ?? null },
  ];

  const historyState = serverHistoryQuery.isLoading
    ? "loading"
    : serverHistoryQuery.isError
      ? "error"
      : !serverHistoryQuery.data || serverHistoryQuery.data.length === 0
        ? "empty"
        : "ready";

  return (
    <div className="cam-admin-page">
      {header}

      {errorAlert && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>{errorAlert}</span>
          <button type="button" className="cam-admin-notice-close" aria-label={t("closeAriaLabel")} onClick={() => setErrorAlert(null)}>×</button>
        </div>
      )}
      {successToast && (
        <div role="status" className="cam-admin-notice cam-admin-notice--success">
          <span>{successToast}</span>
          <button type="button" className="cam-admin-notice-close" aria-label={t("closeAriaLabel")} onClick={() => setSuccessToast(null)}>×</button>
        </div>
      )}

      <div className="cam-pilot-kpis">
        {repositoryKpis.map((k) => (
          <div key={k.key} className="cam-pilot-kpi">
            <span className="cam-pilot-kpi-label">{k.label}</span>
            <span className="cam-pilot-kpi-value" aria-busy={statsQuery.isLoading || undefined}>
              {statsQuery.isLoading ? NOT_PROVIDED : count(k.value, locale)}
            </span>
            <span className="cam-pilot-kpi-trend">{k.hint}</span>
          </div>
        ))}
      </div>

      <div className="cam-admin-grid">
        {/* ── Left column: export configuration ── */}
        <section className="cam-admin-section" aria-labelledby="export-config-heading">
          <div className="cam-admin-section-head">
            <div>
              <h2 id="export-config-heading" className="cam-admin-h2">{t("configTitle")}</h2>
              <p className="cam-admin-meta" style={{ margin: "var(--cam-space-1) 0 0" }}>{t("configSubtitle")}</p>
            </div>
          </div>

          <div className="cam-admin-section-body" style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-5)" }}>
            {/* Native radios and checkbox (CLAUDE.md §9). They were hidden
                with sr-only behind a drawn circle, which left keyboard focus
                with no visible indicator. */}
            <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
              <legend className="cam-admin-label" style={{ padding: 0, marginBottom: "var(--cam-space-2)" }}>{t("formatTitle")}</legend>
              {EXPORT_FORMATS.map((fmt) => (
                <label key={fmt.id} className="cam-admin-choice">
                  <input
                    type="radio"
                    name="file-format"
                    checked={selectedFormat === fmt.id}
                    onChange={() => setSelectedFormat(fmt.id)}
                  />
                  <span>{t(fmt.labelKey)}</span>
                </label>
              ))}
            </fieldset>

            <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
              <legend className="cam-admin-label" style={{ padding: 0, marginBottom: "var(--cam-space-2)" }}>{t("codebookTitle")}</legend>
              <label className="cam-admin-choice">
                <input
                  type="checkbox"
                  checked={includeCodebook}
                  onChange={(e) => setIncludeCodebook(e.target.checked)}
                />
                <span>
                  {t("codebookLabel")}
                  <span className="cam-admin-choice-hint">{t("codebookHint")}</span>
                </span>
              </label>
            </fieldset>

            <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
              <legend className="cam-admin-label" style={{ padding: 0, marginBottom: "var(--cam-space-2)" }}>{t("scopeTitle")}</legend>
              {SCOPE_MODES.map((id) => (
                <label key={id} className="cam-admin-choice">
                  <input
                    type="radio"
                    name="scope-mode"
                    checked={scopeMode === id}
                    onChange={() => setScopeMode(id)}
                  />
                  <span>
                    {id === "all"
                      ? totalSubmissions === null
                        ? t("scopeAll")
                        : t("scopeAllCount", { count: count(totalSubmissions, locale) })
                      : t(SCOPE_LABEL_KEYS[id])}
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="cam-admin-filters">
              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="select-campagne">{t("campaignLabel")}</label>
                <select
                  id="select-campagne"
                  className="cam-select"
                  value={selectedCampaign}
                  onChange={(e) => setCampaignChoice(e.target.value)}
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
              </div>

              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="select-region">{t("regionLabel")}</label>
                <select
                  id="select-region"
                  className="cam-select"
                  value={selectedRegion}
                  onChange={(e) => {
                    setSelectedRegion(e.target.value);
                    setSelectedDepartment("");
                  }}
                >
                  {CAMEROON_REGIONS.map((r) => (
                    <option key={r} value={r}>{r === "Toutes" ? t("allRegions") : r}</option>
                  ))}
                </select>
              </div>

              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="select-questionnaire">{t("questionnaireLabel")}</label>
                <select
                  id="select-questionnaire"
                  className="cam-select"
                  value={selectedQuestionnaire}
                  onChange={(e) => {
                    setSelectedQuestionnaire(e.target.value as ExportQuestionnaire);
                    setSelectedEntityType("");
                  }}
                >
                  {EXPORT_QUESTIONNAIRES.map((value) => (
                    <option key={value} value={value}>{t(`questionnaire.${value}`)}</option>
                  ))}
                </select>
              </div>

              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="select-statut">{t("statusLabel")}</label>
                <select
                  id="select-statut"
                  className="cam-select"
                  value={selectedStatus}
                  aria-describedby="select-statut-hint"
                  onChange={(e) => setSelectedStatus(e.target.value as ExportStatusChoice)}
                >
                  {STATUS_VALUES.map((value) => (
                    <option key={value} value={value}>{t(`status.${value}`)}</option>
                  ))}
                </select>
                <p id="select-statut-hint" className="cam-admin-meta" style={{ margin: "var(--cam-space-1) 0 0" }}>
                  {t("statusHint")}
                </p>
              </div>
            </div>

            {/* Granular filters (collapsible, never dropped) */}
            <div>
              <button
                type="button"
                className="cam-text-button"
                aria-expanded={showAdvancedFilters}
                aria-controls="diffusion-advanced-filters"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? t("hideFilters") : t("showFilters")} {showAdvancedFilters ? "▲" : "▼"}
              </button>

              {showAdvancedFilters && (
                <div id="diffusion-advanced-filters" className="cam-admin-filters" style={{ marginTop: "var(--cam-space-3)" }}>
                  <div className="cam-field">
                    <label className="cam-admin-label" htmlFor="adv-dept">
                      {t("departmentFor", { scope: selectedRegion !== "Toutes" ? selectedRegion : t("national") })}
                    </label>
                    <select
                      id="adv-dept"
                      className="cam-select"
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      disabled={selectedRegion === "Toutes"}
                    >
                      <option value="">{t("allDepartments")}</option>
                      {availableDepartments.map((d) => (
                        <option key={d.name} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* The training-centre questionnaire has a single type. */}
                  {selectedQuestionnaire === "DEMAND" && (
                    <div className="cam-field">
                      <label className="cam-admin-label" htmlFor="adv-entity">{t("establishmentType")}</label>
                      <select
                        id="adv-entity"
                        className="cam-select"
                        value={selectedEntityType}
                        onChange={(e) => setSelectedEntityType(e.target.value)}
                      >
                        <option value="">{t("allEmployers")}</option>
                        {DEMAND_ENTITY_TYPES.map((value) => (
                          <option key={value} value={value}>{typeLabel(tRoot, value)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* The page's one primary action. */}
            <div>
              <button
                type="button"
                className="cam-button cam-button-primary"
                style={{ width: "100%" }}
                onClick={handleLaunchExport}
                disabled={isExporting}
              >
                {isExporting ? t("generating") : t("launch")}
              </button>
              <p className="cam-admin-meta" style={{ margin: "var(--cam-space-2) 0 0", textAlign: "center" }}>
                {t("spssCompatible")}
              </p>
            </div>
          </div>
        </section>

        {/* ── Right column: dataset summary and documentation ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-5)", minWidth: 0 }}>
          <section className="cam-admin-section" aria-labelledby="dataset-summary-heading">
            <div className="cam-admin-section-head">
              <div>
                <h2 id="dataset-summary-heading" className="cam-admin-h2">{t("summaryTitle")}</h2>
                <p className="cam-admin-meta" style={{ margin: "var(--cam-space-1) 0 0" }}>{t("summarySubtitle")}</p>
              </div>
            </div>

            <div className="cam-admin-section-body" style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-5)" }}>
              <dl className="cam-admin-kv">
                {datasetFigures.map((f) => (
                  <div key={f.key}>
                    <dt>{f.label}</dt>
                    <dd aria-busy={f.loading || undefined}>{f.loading ? NOT_PROVIDED : count(f.value, locale)}</dd>
                  </div>
                ))}
              </dl>

              {/* Breakdown by employer type.
                  Source: GET /admin/questionnaires?formType=<T>&limit=1 per
                  type — `total` is the count of the whole filtered query under
                  the caller's server-side scope, not of the returned page.
                  Share = that type's total / the sum of the retrieved totals,
                  rendered only once every query has answered, so a partial load
                  can never produce a wrong share. */}
              <div>
                <h3 className="cam-admin-label" style={{ margin: "0 0 var(--cam-space-3)" }}>{t("breakdownTitle")}</h3>
                {typeBreakdownState !== "ready" ? (
                  <DataState
                    dense
                    state={typeBreakdownState}
                    resource={t("breakdownResource")}
                    error={typeTotals.find((q) => q.isError)?.error}
                  />
                ) : (
                  <ul className="cam-admin-bars">
                    {typeBreakdown.map((row) => (
                      <li key={row.formType} className="cam-admin-bar">
                        <span>{row.label}</span>
                        <div className="cam-admin-bar-track">
                          <div className="cam-admin-bar-fill" style={{ width: meterWidth(row.share) }} />
                        </div>
                        <span className="cam-admin-bar-value">{count(row.total, locale)}</span>
                        <span className="cam-admin-bar-note">{percent(row.share, 0, locale)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="cam-admin-section" aria-labelledby="codebooks-heading">
            <div className="cam-admin-section-head">
              <div>
                <h2 id="codebooks-heading" className="cam-admin-h2">{t("docsTitle")}</h2>
                <p className="cam-admin-meta" style={{ margin: "var(--cam-space-1) 0 0" }}>{t("docsSubtitle")}</p>
              </div>
            </div>

            <div className="cam-admin-section-body" style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
              {/* Server-generated SPSS syntax — the only documentation
                  artefact with an authoritative source. Its size is unknown
                  before the request, so none is claimed. */}
              <div>
                <button type="button" className="cam-text-button" onClick={handleDownloadCodebookSps}>
                  {t("spssCurrent")}
                </button>
                <div className="cam-admin-meta">{t("spssOnDemand")}</div>
              </div>

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

      {/* ── Recent export history ── */}
      <section className="cam-admin-section" aria-labelledby="recent-exports-heading">
        <div className="cam-admin-section-head">
          <div>
            <h2 id="recent-exports-heading" className="cam-admin-h2">{t("historyTitle")}</h2>
            <p className="cam-admin-meta" style={{ margin: "var(--cam-space-1) 0 0" }}>{t("historySubtitle")}</p>
          </div>
        </div>

        {historyState !== "ready" ? (
          <div className="cam-admin-section-body">
            <DataState
              state={historyState}
              resource={t("historyResource")}
              error={serverHistoryQuery.error}
              onRetry={() => serverHistoryQuery.refetch()}
              title={historyState === "loading" ? t("historyLoading") : historyState === "empty" ? t("historyEmptyTitle") : undefined}
              hint={historyState === "empty" ? t("historyEmptyHint") : undefined}
            />
          </div>
        ) : (
          <div className="cam-table-wrapper">
            <table className="cam-table">
              <thead>
                <tr>
                  <th scope="col">{t("dateColumn")}</th>
                  <th scope="col">{t("userColumn")}</th>
                  <th scope="col">{t("formatColumn")}</th>
                  <th scope="col">{t("scopeColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {(serverHistoryQuery.data ?? []).map((row) => (
                  <tr key={row.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span className="cam-admin-meta">{stamp(row.timestamp, true, locale)}</span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span className="cam-admin-strong">{row.user?.name || row.user?.email || NOT_PROVIDED}</span>
                      {row.user?.role && (
                        <span className="cam-admin-meta" style={{ display: "block" }}>
                          {directoryRoleLabel(row.user.role, locale)}
                        </span>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatExportFormat(row.format)}</td>
                    <td>{formatExportScope(row.filters, tRoot)}</td>
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
