"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale, type UiLocale } from "@/lib/register-i18n";
import { submissionStatusLabel } from "@/lib/audit-log";
import { directoryRoleLabel } from "@/lib/user-directory";
import {
  getSpssManifest,
  downloadSpssSavBlob,
  downloadSpssCsvBlob,
  downloadExcelWorkbookBlob,
  downloadVtContactCsvBlob,
  downloadVtContactSavBlob,
  downloadVtRosterCsvBlob,
  downloadVtRosterSavBlob,
  getDataManagementStats,
  getExportHistory,
  getVtContactManifest,
  getVtRosterManifest,
  countExport,
} from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { useTerritoryDepartments, useTerritoryRegions } from "@/hooks/useTerritoryStructure";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTablePanel } from "@/components/admin/AdminTablePanel";
import { StatStrip } from "@/components/admin/StatStrip";
import { useActiveCampaign } from "@/components/admin/AdminHeaderActions";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { NATIONAL_ROLES } from "@/lib/roles";
import { DataState } from "@/components/admin/DataState";
import { useOnefopSchema } from "@/lib/use-onefop-schema";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { formatCampaignDisplayName, listCampaigns } from "@/lib/campaigns";
import { referencePeriodLabel } from "@/lib/onefop-period-label";
import {
  ALL_EXPORT_STATUSES,
  buildExportFilters,
  csvExportNames,
  defaultQuestionnaire,
  DEMAND_ENTITY_TYPES,
  EXPORT_QUESTIONNAIRES,
  repositoryCounts,
  TVET_ENTITY_TYPE,
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

function formatExportFormat(fmt: string, t: Translate): string {
  switch (fmt?.toUpperCase()) {
    case "ROSTER_SAV":
      return t("adminDiffusionPage.rosterHistoryFormat", { ext: ".sav" });
    case "ROSTER_CSV":
      return t("adminDiffusionPage.rosterHistoryFormat", { ext: ".csv" });
    case "CONTACT_SAV":
      return t("adminDiffusionPage.contactHistoryFormat", { ext: ".sav" });
    case "CONTACT_CSV":
      return t("adminDiffusionPage.contactHistoryFormat", { ext: ".csv" });
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

/**
 * A campaign in the picker: its period in the page's language. The stored
 * title is added only to tell apart two campaigns of the same period.
 */
function campaignOptionLabel(
  c: { id: string; code?: string | null; name?: string | null },
  all: { code?: string | null }[],
  locale: UiLocale,
): string {
  if (!c.code) return c.name ? formatCampaignDisplayName(c.name) : c.id;
  const period = referencePeriodLabel(c.code, locale);
  const shared = all.filter((o) => o.code && referencePeriodLabel(o.code, locale) === period).length > 1;
  return shared && c.name ? `${period} — ${formatCampaignDisplayName(c.name)}` : period;
}

function formatExportScope(filters: Record<string, unknown> | null | undefined, tRoot: Translate, locale: UiLocale): string {
  const t = (key: string, values?: Record<string, string>) => tRoot(`adminDiffusionPage.${key}`, values);
  if (!filters || typeof filters !== "object" || Object.keys(filters).length === 0) {
    return t("fullScope");
  }
  const parts: string[] = [];
  if (filters.region && typeof filters.region === "string") parts.push(t("scopeRegion", { value: filters.region }));
  if (filters.department && typeof filters.department === "string") parts.push(t("scopeDepartment", { value: filters.department }));
  if (filters.campaign && typeof filters.campaign === "string") parts.push(t("scopeCampaign", { value: referencePeriodLabel(filters.campaign, locale) }));
  if (filters.entityType && typeof filters.entityType === "string") parts.push(t("scopeType", { value: typeLabel(tRoot, filters.entityType) }));
  else if (filters.partition === "DEMAND") parts.push(t("scopeQuestionnaire", { value: t("questionnaire.DEMAND") }));
  if (Array.isArray(filters.statuses) && filters.statuses.length > 0) parts.push(t("scopeStatuses", { value: filters.statuses.map((st) => submissionStatusLabel(String(st), locale)).join(", ") }));
  return parts.length > 0 ? parts.join(" • ") : t("fullScope");
}

export default function DiffusionPage() {
  const { isLoading, forbidden } = useAdminScreenGuard(NATIONAL_ROLES);
  const tRoot = useTranslations();
  const t = useTranslations("adminDiffusionPage");
  const tStats = useTranslations("adminLayout");
  const locale = asUiLocale(useLocale());
  const user = useAuthStore((s) => s.user);
  // The subtitle names the active campaign, when there is one, instead of
  // a fixed « Campagne 2026 »: by its period in the page's language ("Q4
  // 2026"), not its stored title, which is French, in capitals, and worded
  // for one questionnaire while the campaign covers all of them (defect 22).
  const { activeCampaign } = useActiveCampaign();
  const activeCampaignName = activeCampaign?.code
    ? referencePeriodLabel(activeCampaign.code, locale)
    : activeCampaign?.name || null;

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
  // training centres. Until the user picks one, the one with more files in
  // the register (defaultQuestionnaire); it was always the employer one.
  const registerCountQuery = useQuery({
    queryKey: ["admin", "export-count", "register"],
    queryFn: () => countExport({ partition: "ALL", statuses: ALL_EXPORT_STATUSES }),
    enabled: !isLoading && !forbidden,
  });
  const [questionnaireChoice, setQuestionnaireChoice] = useState<ExportQuestionnaire | null>(null);
  const selectedQuestionnaire = questionnaireChoice ?? defaultQuestionnaire(registerCountQuery.data?.byFormType);

  // Additional granular filters (preserved so no capabilities are dropped)
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // 8.8 named staff list: its own file and format, same filters.
  const [rosterFormat, setRosterFormat] = useState<".sav" | ".csv">(".sav");
  const [isExportingRoster, setIsExportingRoster] = useState(false);
  const [contactFormat, setContactFormat] = useState<".sav" | ".csv">(".sav");
  const [isExportingContact, setIsExportingContact] = useState(false);

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
   * Source: GET /data-management/stats (DataManagementService.getDataStats),
   * onefopByStatus. That endpoint applies no territorial filter. It is only
   * truthful here because this screen is guarded to NATIONAL_ROLES
   * (SUPER_ADMIN, ADMIN_ONEFOP). Do not reuse it on a screen reachable by
   * REGIONAL_ADMIN or DIVISIONAL_ADMIN.
   *
   * The total is the four submitted statuses added up (repositoryCounts), so
   * the figures add up; "returned for correction" was missing, and the total
   * counted drafts. `null` means "not retrieved" and renders as an em dash.
   */
  const repository = repositoryCounts(stats?.onefopByStatus);
  const totalSubmissions = repository.total;
  const approvedRate = rate(repository.approved, totalSubmissions);
  const pendingRate = rate(repository.pending, totalSubmissions);
  const correctionRate = rate(repository.correction, totalSubmissions);
  const rejectedRate = rate(repository.rejected, totalSubmissions);

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

  /**
   * What the export will hold with the current filters: the export's own
   * selection (filters, statistical eligibility, territory), counted by the
   * server. POST /data-management/export/submissions/count. The summary used
   * per-type counts of the whole register, which ignored every filter.
   */
  const exportCountQuery = useQuery({
    queryKey: ["admin", "export-count", currentFilters],
    queryFn: () => countExport(currentFilters),
    enabled: !isLoading && !forbidden,
  });
  const exportTotal = exportCountQuery.data?.total ?? null;
  const typeBreakdownState = resolveDataState({
    isLoading: exportCountQuery.isLoading,
    isError: exportCountQuery.isError,
    error: exportCountQuery.error,
  });
  // The types this export can hold, each with its share of the export.
  const breakdownTypes =
    selectedQuestionnaire === "TVET"
      ? [TVET_ENTITY_TYPE]
      : selectedEntityType
        ? [selectedEntityType]
        : DEMAND_ENTITY_TYPES;
  const typeBreakdown = breakdownTypes
    .map((formType) => {
      const total = exportCountQuery.data?.byFormType[formType] ?? 0;
      return { formType, label: typeLabel(tRoot, formType), total, share: rate(total, exportTotal) };
    })
    .sort((a, b) => b.total - a.total);

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
  const downloadCodebook = async (filename: string, csvFilename?: string) => {
    // csvFilename: the CSV this syntax opens, as it was saved.
    const manifest = await getSpssManifest(csvFilename ? { ...currentFilters, csvFilename } : currentFilters);
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

      const base = `onefop_export_${selectedCampaign}_${timestamp}`;
      triggerFileDownload(blob, `${base}.${plan.ext}`);
      recordExport();
      showSuccess(t("downloaded", { label: plan.label }));

      // The .sps loads a CSV (GET DATA) and labels it: it goes with the CSV,
      // under the same name, and opens that file. A .sav already carries its
      // labels; the syntax used to come with it, opening a CSV that was not
      // there.
      if (includeCodebook && selectedFormat === ".csv") {
        const names = csvExportNames(base);
        await downloadCodebook(names.sps, names.csv);
      }
    } catch (err: unknown) {
      setErrorAlert(t("exportFailed", { message: err instanceof Error ? err.message : t("unknownError") }));
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Downloads the 8.8 named staff list (one row per person) for the files the
   * current filters select. Source: POST /data-management/export/vt-roster/{sav,csv};
   * a CSV comes with the syntax that reads it (…/vt-roster/manifest). The
   * server limits it to central ONEFOP admins and records every download.
   */
  const handleRosterExport = async () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const base = `onefop_8-8_liste_nominative_${selectedCampaign}_${timestamp}`;
    try {
      setIsExportingRoster(true);
      setErrorAlert(null);
      if (rosterFormat === ".sav") {
        triggerFileDownload(await downloadVtRosterSavBlob(currentFilters), `${base}.sav`);
      } else {
        // The .sps opens the CSV under the name it is saved as.
        const names = csvExportNames(base);
        triggerFileDownload(await downloadVtRosterCsvBlob(currentFilters), names.csv);
        const manifest = await getVtRosterManifest(names.csv);
        if (manifest?.sps) triggerFileDownload(new Blob([manifest.sps], { type: "text/plain;charset=utf-8" }), names.sps);
      }
      recordExport();
      showSuccess(t("rosterDownloaded"));
    } catch (err: unknown) {
      setErrorAlert(t("exportFailed", { message: err instanceof Error ? err.message : t("unknownError") }));
    } finally {
      setIsExportingRoster(false);
    }
  };

  /**
   * Downloads the VT contact details (1.15, 1.16, 2.1.12; one row per file)
   * for the files the current filters select, out of the anonymous dataset
   * since v11. Source: POST /data-management/export/vt-contact/{sav,csv}; a
   * CSV comes with its .sps (…/vt-contact/manifest). The server limits it to
   * central ONEFOP admins and refuses a download it cannot record (§21).
   */
  const handleContactExport = async () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const base = `onefop_coordonnees_${selectedCampaign}_${timestamp}`;
    try {
      setIsExportingContact(true);
      setErrorAlert(null);
      if (contactFormat === ".sav") {
        triggerFileDownload(await downloadVtContactSavBlob(currentFilters), `${base}.sav`);
      } else {
        const names = csvExportNames(base);
        triggerFileDownload(await downloadVtContactCsvBlob(currentFilters), names.csv);
        const manifest = await getVtContactManifest(names.csv);
        if (manifest?.sps) triggerFileDownload(new Blob([manifest.sps], { type: "text/plain;charset=utf-8" }), names.sps);
      }
      recordExport();
      showSuccess(t("contactDownloaded"));
    } catch (err: unknown) {
      setErrorAlert(t("exportFailed", { message: err instanceof Error ? err.message : t("unknownError") }));
    } finally {
      setIsExportingContact(false);
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
    { key: "approved", label: t("kpiValidated"), value: repository.approved, hint: t("kpiValidatedRate", { rate: percent(approvedRate, 0, locale) }) },
    { key: "pending", label: t("kpiPending"), value: repository.pending, hint: t("kpiPendingRate", { rate: percent(pendingRate, 0, locale) }) },
    { key: "correction", label: t("kpiCorrection"), value: repository.correction, hint: t("kpiCorrectionRate", { rate: percent(correctionRate, 0, locale) }) },
    { key: "rejected", label: t("kpiRejected"), value: repository.rejected, hint: t("kpiRejectedRate", { rate: percent(rejectedRate, 0, locale) }) },
  ];

  // Volume and structure of the dataset.
  //  - Total enregistrements: GET /data-management/stats (totals.onefopSubmissions).
  //  - Variables / Sections: the canonical ONEFOP schema served at
  //    /schemas/onefop.schema.json (astTotals.questions / astTotals.sections),
  //    compiled from onefop_ast.dart.
  // "Taille estimée" is not shown: nothing computes the byte size of an
  // extract before it is generated.
  const datasetFigures = [
    { key: "records", label: t("exportRecords"), loading: exportCountQuery.isLoading, value: exportTotal },
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

      <StatStrip
        label={tStats("keyFigures")}
        loadingLabel={tStats("loadingFigures")}
        loading={statsQuery.isLoading}
        error={statsQuery.isError}
        errorLabel={tStats("figuresUnavailable")}
        items={repositoryKpis.map((k) => ({ key: k.key, value: count(k.value, locale), label: k.label, hint: k.hint }))}
      />

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

            {/* The syntax opens a CSV: offered with the CSV only. */}
            {selectedFormat === ".csv" && (
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
            )}

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
                    campaignsQuery.data.map((c, _i, all) => (
                      <option key={c.id} value={c.code || c.name || c.id}>
                        {campaignOptionLabel(c, all, locale)}
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
                    setQuestionnaireChoice(e.target.value as ExportQuestionnaire);
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

            {/* 8.8 names people, so it is never in the file above: its own
                download, same filters (spss/vt-roster-export.ts). */}
            {selectedQuestionnaire === "TVET" && (
              <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
                <legend className="cam-admin-label" style={{ padding: 0, marginBottom: "var(--cam-space-1)" }}>{t("rosterTitle")}</legend>
                <p className="cam-admin-meta" style={{ margin: 0 }}>{t("rosterHint")}</p>
                {([".sav", ".csv"] as const).map((fmt) => (
                  <label key={fmt} className="cam-admin-choice">
                    <input
                      type="radio"
                      name="roster-format"
                      checked={rosterFormat === fmt}
                      onChange={() => setRosterFormat(fmt)}
                    />
                    <span>{fmt === ".sav" ? t("planSav") : t("planCsv")}</span>
                  </label>
                ))}
                <button
                  type="button"
                  className="cam-button cam-button-secondary"
                  onClick={handleRosterExport}
                  disabled={isExportingRoster}
                >
                  {isExportingRoster ? t("generating") : t("rosterButton")}
                </button>
              </fieldset>
            )}

            {/* Contact details (1.15, 1.16, 2.1.12) name and reach people, so
                they left the file above in v11: their own download, same
                filters (spss/vt-contact-export.ts). */}
            {selectedQuestionnaire === "TVET" && (
              <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
                <legend className="cam-admin-label" style={{ padding: 0, marginBottom: "var(--cam-space-1)" }}>{t("contactTitle")}</legend>
                <p className="cam-admin-meta" style={{ margin: 0 }}>{t("contactHint")}</p>
                {([".sav", ".csv"] as const).map((fmt) => (
                  <label key={fmt} className="cam-admin-choice">
                    <input
                      type="radio"
                      name="contact-format"
                      checked={contactFormat === fmt}
                      onChange={() => setContactFormat(fmt)}
                    />
                    <span>{fmt === ".sav" ? t("planSav") : t("planCsv")}</span>
                  </label>
                ))}
                <button
                  type="button"
                  className="cam-button cam-button-secondary"
                  onClick={handleContactExport}
                  disabled={isExportingContact}
                >
                  {isExportingContact ? t("generating") : t("contactButton")}
                </button>
              </fieldset>
            )}
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

              {/* Breakdown by type of the files this export holds, from the
                  same server count as the total above. */}
              <div>
                <h3 className="cam-admin-label" style={{ margin: "0 0 var(--cam-space-3)" }}>{t("breakdownTitle")}</h3>
                {typeBreakdownState !== "ready" ? (
                  <DataState
                    dense
                    state={typeBreakdownState}
                    resource={t("breakdownResource")}
                    error={exportCountQuery.error}
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
            </div>
          </section>
        </div>
      </div>

      {/* ── Recent export history ── */}
      <AdminTablePanel
        headingId="recent-exports-heading"
        title={t("historyTitle")}
        description={t("historySubtitle")}
      >

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
                    <td style={{ whiteSpace: "nowrap" }}>{formatExportFormat(row.format, tRoot)}</td>
                    <td>{formatExportScope(row.filters, tRoot, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminTablePanel>
    </div>
  );
}
