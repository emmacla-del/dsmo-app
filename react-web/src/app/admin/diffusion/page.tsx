"use client";

import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
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
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { NATIONAL_ROLES } from "@/lib/roles";
import { DataState } from "@/components/admin/DataState";
import { useOnefopSchema } from "@/lib/use-onefop-schema";
import { entityTypeLabel } from "@/lib/companies-directory";
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

const ENTITY_TYPE_OPTIONS = [
  { value: "", label: "Tous les employeurs (6 types)" },
  { value: "ENTREPRISE", label: "Entreprises privées" },
  { value: "COOPERATIVE", label: "Coopératives" },
  { value: "CTD", label: "Collectivités Territoriales (CTD)" },
  { value: "ONG", label: "Organisations Non Gouvernementales (ONG)" },
  { value: "ADMINISTRATION", label: "Administrations publiques" },
  { value: "PROJECT_PROGRAM", label: "Projets et Programmes" },
  { value: "VOCATIONAL_TRAINING", label: "Centres de formation professionnelle" },
];

const STATUS_OPTIONS = [
  { value: "APPROVED", label: "Validé uniquement" },
  { value: "ALL", label: "Tous les statuts" },
  { value: "PENDING_REVIEW", label: "En attente uniquement" },
  { value: "REJECTED", label: "Rejeté uniquement" },
];

const SECTIONS_LIST = [
  { id: "ident", label: "Identification du Répondant" },
  { id: "loc", label: "Localisation Administrative" },
  { id: "struct", label: "Informations Structure" },
  { id: "ops", label: "Données Opérationnelles" },
  { id: "rh", label: "Ressources Humaines" },
];

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

function formatExportScope(filters: Record<string, unknown> | null | undefined): string {
  if (!filters || typeof filters !== "object" || Object.keys(filters).length === 0) {
    return "Périmètre complet autorisé";
  }
  const parts: string[] = [];
  if (filters.region && typeof filters.region === "string") parts.push(`Région: ${filters.region}`);
  if (filters.department && typeof filters.department === "string") parts.push(`Dép: ${filters.department}`);
  if (filters.campaign && typeof filters.campaign === "string") parts.push(`Campagne: ${filters.campaign}`);
  if (filters.entityType && typeof filters.entityType === "string") parts.push(`Type: ${entityTypeLabel(filters.entityType)}`);
  if (Array.isArray(filters.statuses) && filters.statuses.length > 0) parts.push(`Statuts: ${filters.statuses.join(", ")}`);
  return parts.length > 0 ? parts.join(" • ") : "Périmètre complet autorisé";
}

export default function DiffusionPage() {
  const { isLoading, forbidden } = useAdminScreenGuard(NATIONAL_ROLES);
  const user = useAuthStore((s) => s.user);

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

  // Sections selection
  const [selectedSections, setSelectedSections] = useState<string[]>([
    "ident", "loc", "struct", "ops", "rh",
  ]);

  // Dropdown states
  const [selectedCampaign, setSelectedCampaign] = useState("");

  useMemo(() => {
    if (campaignsQuery.data && campaignsQuery.data.length > 0 && !selectedCampaign) {
      const active = campaignsQuery.data.find((c) => c.status === "ACTIVE");
      setSelectedCampaign(active?.code || active?.name || campaignsQuery.data[0].code || campaignsQuery.data[0].name || "");
    }
  }, [campaignsQuery.data, selectedCampaign]);

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
      label: entityTypeLabel(formType),
      total: typeTotals[i].data?.total ?? null,
    }));
    const sum = rows.reduce((acc, r) => acc + (r.total ?? 0), 0);
    return rows
      .map((r) => ({ ...r, share: rate(r.total, sum) }))
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeTotalsKey]);

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

  const toggleSection = (id: string) => {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

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
      setErrorAlert("Le serveur n'a pas fourni de syntaxe SPSS pour ce périmètre.");
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
      ".sav": { download: downloadSpssSavBlob, ext: "sav", label: "Fichier SPSS (.sav)" },
      ".csv": { download: downloadSpssCsvBlob, ext: "csv", label: "Fichier CSV (.csv)" },
      ".xlsx": { download: downloadExcelWorkbookBlob, ext: "xlsx", label: "Classeur Excel (.xlsx)" },
    }[selectedFormat];

    try {
      setIsExporting(true);
      setErrorAlert(null);

      const blob = await plan.download(currentFilters);
      if (blob.size === 0) {
        setErrorAlert(
          "Le serveur a renvoyé un fichier vide : aucun enregistrement ne correspond au périmètre demandé, ou l'extraction a échoué côté serveur. Aucun fichier n'a été téléchargé.",
        );
        return;
      }

      const filename = `onefop_export_${selectedCampaign}_${timestamp}.${plan.ext}`;
      triggerFileDownload(blob, filename);
      recordExport();
      showSuccess(`${plan.label} téléchargé avec succès.`);

      if (includeCodebook && selectedFormat === ".sav") {
        await downloadCodebook(`onefop_codebook_${selectedCampaign}_${timestamp}.sps`);
      }
    } catch (err: unknown) {
      setErrorAlert(
        `L'export n'a pas pu être généré : ${err instanceof Error ? err.message : "erreur inconnue"}. Aucun fichier n'a été téléchargé.`,
      );
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
      showSuccess("Syntaxe SPSS téléchargée avec succès.");
    } catch (err: unknown) {
      setErrorAlert(
        `Impossible de télécharger la syntaxe SPSS : ${err instanceof Error ? err.message : "erreur inconnue"}.`,
      );
    }
  };

  if (isLoading) return null;

  if (forbidden) {
    return (
      <div className="cam-admin-page">
        <p className="cam-admin-lede">Accès restreint à la gestion et diffusion nationale des données.</p>
      </div>
    );
  }

  return (
    <div className="cam-admin-page">
      {/* ── Top App Bar (AdminPageHeader with right search, territory & flag) ── */}
      <AdminPageHeader
        breadcrumb={[{ label: "Données" }, { label: "Exports" }]}
        title="Gestion des Données et Exports"
        subtitle="Gérer, filtrer et exporter les données collectées - Campagne 2026"
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
          <button type="button" onClick={() => setErrorAlert(null)} className="text-red-500 hover:text-red-800 text-lg font-bold cursor-pointer">×</button>
        </div>
      )}
      {successToast && (
        <div role="status" className="flex items-center justify-between p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          <span>{successToast}</span>
          <button type="button" onClick={() => setSuccessToast(null)} className="text-emerald-600 hover:text-emerald-900 text-lg font-bold cursor-pointer">×</button>
        </div>
      )}

      {/* ── 4 KPI Cards (Figma donnees/exports.png) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Déclarations */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              Total Déclarations
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <IconFileCheck />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[32px] font-extrabold tracking-tight text-slate-900 leading-none">
              {statsQuery.isLoading ? "…" : count(totalSubmissions)}
            </div>
            {/* No month-over-month trend: /data-management/stats returns a
                single snapshot with no prior period to compare against. */}
            <div className="text-xs font-semibold text-slate-500 mt-2">
              Dossiers enregistrés, hors brouillons
            </div>
          </div>
        </div>

        {/* Card 2: Déclarations Validées */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              Déclarations Validées
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <IconCheckCircle />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[32px] font-extrabold tracking-tight text-slate-900 leading-none">
              {statsQuery.isLoading ? "…" : count(approvedCount)}
            </div>
            <div className="text-xs font-semibold text-slate-600 mt-2">
              {percent(approvedRate)} Taux de validation
            </div>
          </div>
        </div>

        {/* Card 3: En Attente de Révision */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              En Attente de Révision
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <IconClock />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[32px] font-extrabold tracking-tight text-slate-900 leading-none">
              {statsQuery.isLoading ? "…" : count(pendingCount)}
            </div>
            <div className="text-xs font-semibold text-amber-600 mt-2">
              {percent(pendingRate)} en attente
            </div>
          </div>
        </div>

        {/* Card 4: Déclarations Rejetées */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              Déclarations Rejetées
            </span>
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <IconXCircle />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[32px] font-extrabold tracking-tight text-slate-900 leading-none">
              {statsQuery.isLoading ? "…" : count(rejectedCount)}
            </div>
            <div className="text-xs font-semibold text-rose-600 mt-2">
              {percent(rejectedRate)} taux de rejet
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
              Configuration de l&apos;Export
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Définissez le format, le périmètre et les sections à inclure avant la génération du fichier.
            </p>
          </div>

          {/* Section 1: FORMAT DE FICHIER */}
          <div className="mb-5">
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">
              Format de fichier
            </div>
            <div className="space-y-2.5">
              {[
                { id: ".sav", label: ".SAV (Format natif SPSS Data)" },
                { id: ".csv", label: ".CSV (Données tabulaires)" },
                { id: ".xlsx", label: ".XLSX (Microsoft Excel)" },
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
              Codebook &amp; Syntaxe
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
                    Générer le Codebook (.sps)
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Fichier de syntaxe SPSS avec les définitions de variables et les étiquettes de valeurs
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="border-t border-slate-100 my-5" />

          {/* Section 3: PÉRIMÈTRE DES DONNÉES */}
          <div className="mb-5">
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">
              Périmètre des données
            </div>
            <div className="space-y-2.5">
              {[
                {
                  id: "all",
                  label:
                    totalSubmissions === null
                      ? "Toutes les données autorisées"
                      : `Toutes les données autorisées (${count(totalSubmissions)})`,
                },
                { id: "campaign", label: "Par campagne" },
                { id: "region", label: "Par région" },
                { id: "custom", label: "Sélection personnalisée" },
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

          {/* Section 4: SECTIONS À INCLURE */}
          <div className="mb-5">
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">
              Sections à inclure
            </div>
            <div className="space-y-2.5">
              {SECTIONS_LIST.map((sec) => {
                const isChecked = selectedSections.includes(sec.id);
                return (
                  <label
                    key={sec.id}
                    className="flex items-center gap-3 cursor-pointer select-none group"
                  >
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSection(sec.id)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isChecked
                            ? "border-[#006644] bg-[#006644] text-white"
                            : "border-slate-300 bg-white group-hover:border-slate-400"
                        }`}
                      >
                        {isChecked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 4 3.5 6.5 9 1" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className={`text-sm ${isChecked ? "font-semibold text-slate-800" : "text-slate-600"}`}>
                      {sec.label}
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
                Campagne
              </label>
              <div className="relative">
                <select
                  id="select-campagne"
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
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
                      {campaignsQuery.isLoading ? "Chargement…" : "Aucune campagne enregistrée"}
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
                Région
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
                    <option key={r} value={r}>{r}</option>
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
                Statut
              </label>
              <div className="relative">
                <select
                  id="select-statut"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006644] focus:border-transparent transition-all cursor-pointer"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
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
              <span>{showAdvancedFilters ? "Masquer les filtres fins" : "Filtres complémentaires (Département, Type d'employeur)"}</span>
              <span className="text-[10px]">{showAdvancedFilters ? "▲" : "▼"}</span>
            </button>

            {showAdvancedFilters && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="adv-dept" className="block text-[10px] font-semibold text-slate-600 mb-1">
                    Département ({selectedRegion !== "Toutes" ? selectedRegion : "National"})
                  </label>
                  <select
                    id="adv-dept"
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    disabled={selectedRegion === "Toutes"}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-800 disabled:opacity-50"
                  >
                    <option value="">Tous les départements</option>
                    {availableDepartments.map((d) => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="adv-entity" className="block text-[10px] font-semibold text-slate-600 mb-1">
                    Type d&apos;établissement
                  </label>
                  <select
                    id="adv-entity"
                    value={selectedEntityType}
                    onChange={(e) => setSelectedEntityType(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-800"
                  >
                    {ENTITY_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
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
              <span>{isExporting ? "Génération en cours…" : "Lancer l'Export"}</span>
            </button>
            <div className="text-[11px] text-slate-400 text-center mt-2.5">
              Compatible avec IBM SPSS Statistics 25+
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
                Résumé du Jeu de Données
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Aperçu du volume et de la structure du jeu exporté.
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
                <span>Total enregistrements</span>
                <span className="font-bold text-slate-900">
                  {statsQuery.isLoading ? "…" : count(totalSubmissions)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Variables au schéma canonique</span>
                <span className="font-bold text-slate-900">
                  {schemaQuery.isLoading ? "…" : count(schemaQuery.data?.astTotals.questions ?? null)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Sections au schéma canonique</span>
                <span className="font-bold text-slate-900">
                  {schemaQuery.isLoading ? "…" : count(schemaQuery.data?.astTotals.sections ?? null)}
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
                Répartition par type
              </div>

              {typeBreakdownState !== "ready" ? (
                <DataState
                  dense
                  state={typeBreakdownState}
                  resource="la répartition par type"
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
                        {count(row.total)}
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
                Documentation du jeu de données
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Syntaxe générée par le serveur pour le périmètre sélectionné.
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
                    Syntaxe SPSS du périmètre courant
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    .sps &bull; générée à la demande
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <DataState
                dense
                state="unavailable"
                resource="la documentation de référence"
                title="Dictionnaire des variables et guide de recodage : non disponibles"
                hint="Ces référentiels ne sont pas encore produits par le système. Ils seront proposés ici dès qu'un service les générera à partir du schéma canonique ONEFOP."
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
            Historique des exports récents
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Journal d&apos;audit des extractions de données enregistrées sur la plateforme.
          </p>
        </div>

        {serverHistoryQuery.isLoading ? (
          <DataState
            state="loading"
            resource="l'historique des exports"
            title="Chargement de l'historique des exports..."
          />
        ) : serverHistoryQuery.isError ? (
          <DataState
            state="error"
            resource="l'historique des exports"
            error={serverHistoryQuery.error}
            onRetry={() => serverHistoryQuery.refetch()}
          />
        ) : !serverHistoryQuery.data || serverHistoryQuery.data.length === 0 ? (
          <DataState
            state="empty"
            resource="l'historique des exports"
            title="Aucun export enregistré"
            hint="Les extractions de données générées par les administrateurs et analystes apparaîtront ici."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 tracking-wider">
                  <th className="py-3 px-3">Date &amp; Heure</th>
                  <th className="py-3 px-3">Utilisateur</th>
                  <th className="py-3 px-3">Format</th>
                  <th className="py-3 px-3">Périmètre</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-700 divide-y divide-slate-50">
                {serverHistoryQuery.data.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-3 whitespace-nowrap text-slate-600">
                      {stamp(row.timestamp)}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                      {row.user?.name || row.user?.email || NOT_PROVIDED}
                      {row.user?.role && (
                        <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                          ({row.user.role})
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      {formatExportFormat(row.format)}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600">
                      {formatExportScope(row.filters)}
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
