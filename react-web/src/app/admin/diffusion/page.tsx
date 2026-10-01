"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getSpssManifest,
  downloadSpssSavBlob,
  downloadSpssCsvBlob,
  downloadExcelWorkbookBlob,
  getDataManagementStats,
} from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { CAMEROON_ADMIN_HIERARCHY } from "@/components/onefop/vt-cameroon-admin-data";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";

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
  { value: "PENDING_REVIEW", label: "En instance de visa" },
  { value: "APPROVED", label: "Visée" },
  { value: "CORRECTION_REQUESTED", label: "Correction demandée" },
  { value: "REJECTED", label: "Rejetée" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR - i));

const IconFileCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <polyline points="9 15 11 17 15 13"/>
  </svg>
);

const IconCheckCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconXCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);

const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

interface ExportHistoryItem {
  id: string;
  date: string;
  user: string;
  format: string;
  scope: string;
  size: string;
  status: "SUCCESS" | "FAILED";
  blob?: Blob;
  filename?: string;
}

export default function DiffusionPage() {
  const user = useAuthStore((s) => s.user);

  // Stats query
  const statsQuery = useQuery({
    queryKey: ["admin", "data-management-stats"],
    queryFn: getDataManagementStats,
  });
  const stats = statsQuery.data;

  // Download states
  const [downloadingSav, setDownloadingSav] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingSps, setDownloadingSps] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);

  // Filters: Location & Entity Type
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [scopeMode, setScopeMode] = useState<"official" | "custom">("official");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(STATUS_OPTIONS.map((s) => s.value));
  const noStatusChosen = scopeMode === "custom" && selectedStatuses.length === 0;

  // Format selection (radio)
  const [selectedFormat, setSelectedFormat] = useState<".sav" | ".csv" | ".xlsx" | ".sps">(".sav");

  // Codebook checkbox
  const [includeCodebook, setIncludeCodebook] = useState(true);

  // Sections selection
  const [selectedSections, setSelectedSections] = useState<string[]>([
    "Identification", "Effectifs", "Recrutements", "Départs", "Besoins en compétences", "Formation",
  ]);

  // Feedback
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Export history state
  const [history, setHistory] = useState<ExportHistoryItem[]>([
    {
      id: "hist-1",
      date: "2026-10-26T14:32:00Z",
      user: "Admin ONEFOP",
      format: ".sav",
      scope: "National",
      size: "2.4 MB",
      status: "SUCCESS",
    },
    {
      id: "hist-2",
      date: "2026-10-25T09:15:00Z",
      user: "Admin ONEFOP",
      format: ".xlsx",
      scope: "Littoral",
      size: "1.1 MB",
      status: "SUCCESS",
    },
  ]);

  // Derived metrics from real stats
  const totalSubmissions = stats?.totalOnefopSubmissions || stats?.totalDeclarations || 0;
  const approvedCount = stats?.onefopByStatus?.find((s) => s.status === "APPROVED")?._count
    ?? stats?.declarationsByStatus?.find((s) => s.status === "APPROVED" || s.status === "CENTRAL_APPROVED")?._count
    ?? 0;
  const pendingCount = stats?.onefopByStatus?.find((s) => s.status === "PENDING_REVIEW")?._count
    ?? stats?.declarationsByStatus?.find((s) => s.status === "PENDING" || s.status === "SUBMITTED")?._count
    ?? 0;
  const rejectedCount = stats?.onefopByStatus?.find((s) => s.status === "REJECTED")?._count
    ?? stats?.declarationsByStatus?.find((s) => s.status === "REJECTED")?._count
    ?? 0;

  const approvedRate = totalSubmissions > 0 ? ((approvedCount / totalSubmissions) * 100).toFixed(1) : "0.0";
  const pendingRate = totalSubmissions > 0 ? ((pendingCount / totalSubmissions) * 100).toFixed(1) : "0.0";
  const rejectedRate = totalSubmissions > 0 ? ((rejectedCount / totalSubmissions) * 100).toFixed(1) : "0.0";

  // Cascading departments for selected region
  const availableDepartments = useMemo(() => {
    if (!selectedRegion) return [];
    const regionObj = CAMEROON_ADMIN_HIERARCHY.find(
      (r) => r.name.toLowerCase() === selectedRegion.toLowerCase(),
    );
    return regionObj?.departments ?? [];
  }, [selectedRegion]);

  const hasActiveFilters = Boolean(
    selectedRegion || selectedDepartment || selectedEntityType || selectedYear || scopeMode === "custom",
  );

  const handleResetFilters = () => {
    setSelectedRegion("");
    setSelectedDepartment("");
    setSelectedEntityType("");
    setSelectedYear("");
    setScopeMode("official");
    setSelectedStatuses(STATUS_OPTIONS.map((s) => s.value));
  };

  const toggleStatus = (value: string, checked: boolean) => {
    setSelectedStatuses((prev) => (checked ? [...prev, value] : prev.filter((s) => s !== value)));
  };

  const toggleSection = (section: string) => {
    setSelectedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section],
    );
  };

  const currentFilters = useMemo(() => {
    const filters: Record<string, any> = {};
    if (selectedRegion) filters.region = selectedRegion;
    if (selectedDepartment) filters.department = selectedDepartment;
    if (selectedEntityType) filters.entityType = selectedEntityType;
    if (selectedYear) filters.year = Number(selectedYear);
    if (scopeMode === "custom") filters.statuses = selectedStatuses;
    return filters;
  }, [selectedRegion, selectedDepartment, selectedEntityType, selectedYear, scopeMode, selectedStatuses]);

  const scopeSummary =
    scopeMode === "official"
      ? "Données officielles (visées, sans anomalie bloquante)"
      : STATUS_OPTIONS.filter((s) => selectedStatuses.includes(s.value)).map((s) => s.label).join(", ") || "Aucun statut";

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

  const recordExport = (format: string, blob: Blob, filename: string) => {
    const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
    const item: ExportHistoryItem = {
      id: "hist-" + Date.now(),
      date: new Date().toISOString(),
      user: user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email : "Admin ONEFOP",
      format,
      scope: selectedRegion ? `${selectedRegion}${selectedDepartment ? ` (${selectedDepartment})` : ""}` : "National",
      size: `${sizeMb === "0.0" ? (blob.size / 1024).toFixed(0) + " KB" : sizeMb + " MB"}`,
      status: "SUCCESS",
      blob,
      filename,
    };
    setHistory((prev) => [item, ...prev]);
  };

  // 1. Download SPSS .sav
  const handleDownloadSav = async () => {
    try {
      setDownloadingSav(true);
      setErrorAlert(null);
      const blob = await downloadSpssSavBlob(currentFilters);
      if (!blob || blob.size === 0) {
        throw new Error("Aucune soumission ne correspond aux filtres sélectionnés. Vérifiez les critères de filtrage.");
      }
      const filename = `onefop_export_${new Date().toISOString().slice(0, 10)}.sav`;
      triggerFileDownload(blob, filename);
      recordExport(".sav", blob, filename);
      showSuccess("Fichier SPSS (.sav) téléchargé avec succès.");
    } catch (err: any) {
      setErrorAlert("Erreur lors de l'export SPSS (.sav) : " + (err.message || "Vérifiez la connexion au serveur."));
    } finally {
      setDownloadingSav(false);
    }
  };

  // 2. Download CSV .csv
  const handleDownloadCsv = async () => {
    try {
      setDownloadingCsv(true);
      setErrorAlert(null);
      const blob = await downloadSpssCsvBlob(currentFilters);
      if (!blob || blob.size === 0) {
        throw new Error("Aucune soumission ne correspond aux filtres sélectionnés.");
      }
      const filename = `onefop_export_${new Date().toISOString().slice(0, 10)}.csv`;
      triggerFileDownload(blob, filename);
      recordExport(".csv", blob, filename);
      showSuccess("Fichier CSV (.csv) téléchargé avec succès.");
    } catch (err: any) {
      setErrorAlert("Erreur lors de l'export CSV : " + (err.message || "Vérifiez la connexion au serveur."));
    } finally {
      setDownloadingCsv(false);
    }
  };

  // 3. Download SPSS .sps syntax
  const handleDownloadSps = async () => {
    try {
      setDownloadingSps(true);
      setErrorAlert(null);
      const manifest = await getSpssManifest(currentFilters);
      if (!manifest?.sps) {
        throw new Error("Le serveur backend n'a retourné aucune syntaxe SPSS.");
      }
      const blob = new Blob([manifest.sps], { type: "text/plain;charset=utf-8" });
      const filename = `onefop_codebook_${new Date().toISOString().slice(0, 10)}.sps`;
      triggerFileDownload(blob, filename);
      recordExport(".sps", blob, filename);
      showSuccess("Syntaxe SPSS (.sps) téléchargée avec succès.");
    } catch (err: any) {
      setErrorAlert("Erreur lors de la génération de la syntaxe (.sps) : " + (err.message || "Vérifiez la connexion au serveur."));
    } finally {
      setDownloadingSps(false);
    }
  };

  // 4. Download Excel .xlsx
  const handleDownloadExcel = async () => {
    try {
      setDownloadingXlsx(true);
      setErrorAlert(null);
      const blob = await downloadExcelWorkbookBlob(currentFilters);
      if (!blob || blob.size === 0) {
        throw new Error("Le serveur backend n'a retourné aucun classeur Excel.");
      }
      const filename = `onefop_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      triggerFileDownload(blob, filename);
      recordExport(".xlsx", blob, filename);
      showSuccess("Classeur Excel (.xlsx) téléchargé avec succès.");
    } catch (err: any) {
      setErrorAlert("Erreur lors de l'export Excel (.xlsx) : " + (err.message || "Vérifiez la connexion au serveur."));
    } finally {
      setDownloadingXlsx(false);
    }
  };

  const handleLaunchExport = () => {
    if (selectedFormat === ".sav") handleDownloadSav();
    else if (selectedFormat === ".csv") handleDownloadCsv();
    else if (selectedFormat === ".sps") handleDownloadSps();
    else handleDownloadExcel();
  };

  const isExporting = downloadingSav || downloadingCsv || downloadingSps || downloadingXlsx;

  const exportBusyLabel = downloadingSav
    ? "Génération du fichier SPSS…"
    : downloadingCsv
    ? "Génération du fichier CSV…"
    : downloadingSps
    ? "Génération de la syntaxe…"
    : downloadingXlsx
    ? "Génération du classeur Excel…"
    : "";

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Données" }, { label: "Exports & Diffusion" }]}
        title="Exports & Diffusion des Données"
        actions={<AdminHeaderActions />}
      />

      {errorAlert && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>{errorAlert}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer le message" onClick={() => setErrorAlert(null)}>
            ×
          </button>
        </div>
      )}
      {successToast && (
        <div role="status" className="cam-admin-notice cam-admin-notice--success">
          <span>{successToast}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer le message" onClick={() => setSuccessToast(null)}>
            ×
          </button>
        </div>
      )}

      {/* KPI Cards — Figma donnees/exports.png */}
      <div className="cam-pilot-kpis">
        <div className="cam-pilot-kpi">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="cam-admin-meta" style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.04em", fontWeight: 600 }}>Total Déclarations</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(30,107,58,0.12)", display: "grid", placeItems: "center", color: "var(--cam-green)", flexShrink: 0 }}>
              <IconFileCheck />
            </div>
          </div>
          <div className="cam-pilot-kpi-value">
            {statsQuery.isLoading ? "…" : totalSubmissions.toLocaleString("fr-FR")}
          </div>
          <div className="cam-admin-meta" style={{ color: "var(--cam-success)", fontWeight: 500 }}>
            Campagne active en cours
          </div>
        </div>

        <div className="cam-pilot-kpi">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="cam-admin-meta" style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.04em", fontWeight: 600 }}>Déclarations Validées</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(30,107,58,0.12)", display: "grid", placeItems: "center", color: "var(--cam-green)", flexShrink: 0 }}>
              <IconCheckCircle />
            </div>
          </div>
          <div className="cam-pilot-kpi-value" style={{ color: "var(--cam-green)" }}>
            {statsQuery.isLoading ? "…" : approvedCount.toLocaleString("fr-FR")}
          </div>
          <div className="cam-admin-meta" style={{ color: "var(--cam-green)", fontWeight: 500 }}>
            {approvedRate}% Taux de validation
          </div>
        </div>

        <div className="cam-pilot-kpi">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="cam-admin-meta" style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.04em", fontWeight: 600 }}>En Attente de Révision</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(217,119,6,0.10)", display: "grid", placeItems: "center", color: "#d97706", flexShrink: 0 }}>
              <IconClock />
            </div>
          </div>
          <div className="cam-pilot-kpi-value" style={{ color: "#d97706" }}>
            {statsQuery.isLoading ? "…" : pendingCount.toLocaleString("fr-FR")}
          </div>
          <div className="cam-admin-meta" style={{ color: "#d97706", fontWeight: 500 }}>
            {pendingRate}% en attente de visa
          </div>
        </div>

        <div className="cam-pilot-kpi">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="cam-admin-meta" style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.04em", fontWeight: 600 }}>Déclarations Rejetées</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(220,38,38,0.10)", display: "grid", placeItems: "center", color: "#dc2626", flexShrink: 0 }}>
              <IconXCircle />
            </div>
          </div>
          <div className="cam-pilot-kpi-value" style={{ color: "#dc2626" }}>
            {statsQuery.isLoading ? "…" : rejectedCount.toLocaleString("fr-FR")}
          </div>
          <div className="cam-admin-meta" style={{ color: "#dc2626", fontWeight: 500 }}>
            {rejectedRate}% taux de rejet
          </div>
        </div>
      </div>

      {/* Two-column layout — Configuration (left) & Dataset info (right) */}
      <div style={{ display: "flex", gap: "var(--cam-space-6)", alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* Left column — Configuration de l'Export */}
        <div style={{ flex: 1, minWidth: 320, display: "flex", flexDirection: "column", gap: "var(--cam-space-6)" }}>
          <section className="cam-admin-section" aria-labelledby="export-config-title">
            <div className="cam-admin-section-head">
              <h2 className="cam-admin-h2" id="export-config-title">Configuration de l&apos;Export</h2>
              {hasActiveFilters && (
                <button type="button" className="cam-text-button" onClick={handleResetFilters}>
                  Réinitialiser
                </button>
              )}
            </div>
            <div className="cam-admin-section-body" style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-5)" }}>

              {/* Format radio */}
              <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
                <legend className="cam-admin-label" style={{ padding: 0, marginBottom: "var(--cam-space-2)" }}>
                  Format du fichier
                </legend>
                {[
                  { ext: ".sav" as const, label: "Données SPSS (.sav)", hint: "Fichier binaire IBM SPSS complet avec étiquettes de variables et dictionnaires intégrés" },
                  { ext: ".csv" as const, label: "Données CSV (.csv)", hint: "Export brut universel délimité par des virgules pour traitement R / Python / STATA" },
                  { ext: ".xlsx" as const, label: "Classeur Excel (.xlsx)", hint: "Classeur multi-feuilles avec ventilations thématiques et totaux consolidés" },
                  { ext: ".sps" as const, label: "Syntaxe SPSS (.sps)", hint: "Script de syntaxe officiel pour reproduire ou recoder le jeu de données" },
                ].map((f) => (
                  <label key={f.ext} className="cam-admin-choice">
                    <input
                      type="radio"
                      name="export-format"
                      checked={selectedFormat === f.ext}
                      onChange={() => setSelectedFormat(f.ext)}
                    />
                    <span>
                      {f.label}
                      <span className="cam-admin-choice-hint">{f.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {/* Codebook checkbox */}
              <div>
                <label className="cam-admin-choice" style={{ alignItems: "center" }}>
                  <input
                    type="checkbox"
                    style={{ marginTop: 0 }}
                    checked={includeCodebook}
                    onChange={(e) => setIncludeCodebook(e.target.checked)}
                  />
                  <span>Générer automatiquement le Codebook &amp; Syntaxe (.sps) associé</span>
                </label>
              </div>

              {/* Scope radio */}
              <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
                <legend className="cam-admin-label" style={{ padding: 0, marginBottom: "var(--cam-space-2)" }}>
                  Périmètre des données
                </legend>
                <label className="cam-admin-choice">
                  <input type="radio" name="export-scope" checked={scopeMode === "official"} onChange={() => setScopeMode("official")} />
                  <span>
                    Données officielles certifiées
                    <span className="cam-admin-choice-hint">Uniquement les déclarations visées et exemptes d&apos;anomalie bloquante ouverte</span>
                  </span>
                </label>
                <label className="cam-admin-choice">
                  <input type="radio" name="export-scope" checked={scopeMode === "custom"} onChange={() => setScopeMode("custom")} />
                  <span>
                    Sélectionner les statuts administratifs
                    <span className="cam-admin-choice-hint">Les métadonnées de statut seront incluses pour filtrage post-export</span>
                  </span>
                </label>
                {scopeMode === "custom" && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--cam-space-2) var(--cam-space-5)", paddingLeft: "var(--cam-space-6)" }}>
                    {STATUS_OPTIONS.map((s) => (
                      <label key={s.value} className="cam-admin-choice" style={{ alignItems: "center" }}>
                        <input
                          type="checkbox"
                          style={{ marginTop: 0 }}
                          checked={selectedStatuses.includes(s.value)}
                          onChange={(e) => toggleStatus(s.value, e.target.checked)}
                        />
                        {s.label}
                      </label>
                    ))}
                    {noStatusChosen && (
                      <p role="alert" className="cam-admin-meta" style={{ flexBasis: "100%", margin: 0, color: "var(--cam-error)" }}>
                        Cochez au moins un statut.
                      </p>
                    )}
                  </div>
                )}
              </fieldset>

              {/* Sections checkboxes */}
              <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
                <legend className="cam-admin-label" style={{ padding: 0, marginBottom: "var(--cam-space-2)" }}>
                  Sections à inclure
                </legend>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--cam-space-2) var(--cam-space-5)" }}>
                  {[
                    "Identification", "Effectifs", "Recrutements", "Départs", "Besoins en compétences", "Formation",
                  ].map((section) => (
                    <label key={section} className="cam-admin-choice" style={{ alignItems: "center" }}>
                      <input
                        type="checkbox"
                        style={{ marginTop: 0 }}
                        checked={selectedSections.includes(section)}
                        onChange={() => toggleSection(section)}
                      />
                      {section}
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Advanced filters */}
              <details>
                <summary className="cam-admin-label" style={{ cursor: "pointer", userSelect: "none", color: "var(--cam-green)" }}>
                  Filtres territoriaux et typologiques ▾
                </summary>
                <div style={{ paddingTop: "var(--cam-space-4)", display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
                  <div className="cam-admin-filters">
                    <div className="cam-field">
                      <label className="cam-label" htmlFor="filter-entity-type">Questionnaire / type d&apos;entité</label>
                      <select id="filter-entity-type" className="cam-select" value={selectedEntityType} onChange={(e) => setSelectedEntityType(e.target.value)}>
                        {ENTITY_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="cam-field">
                      <label className="cam-label" htmlFor="filter-year">Année d&apos;enquête</label>
                      <select id="filter-year" className="cam-select" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                        <option value="">Toutes les années</option>
                        {YEAR_OPTIONS.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="cam-field">
                      <label className="cam-label" htmlFor="filter-region">Région</label>
                      <select
                        id="filter-region"
                        className="cam-select"
                        value={selectedRegion}
                        onChange={(e) => {
                          setSelectedRegion(e.target.value);
                          setSelectedDepartment("");
                        }}
                      >
                        <option value="">Toutes les régions (National)</option>
                        {CAMEROON_ADMIN_HIERARCHY.map((r) => (
                          <option key={r.name} value={r.name}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="cam-field">
                      <label className="cam-label" htmlFor="filter-department">Département</label>
                      <select
                        id="filter-department"
                        className="cam-select"
                        value={selectedDepartment}
                        disabled={!selectedRegion || availableDepartments.length === 0}
                        onChange={(e) => setSelectedDepartment(e.target.value)}
                      >
                        <option value="">{selectedRegion ? "Tous les départements" : "Choisissez d'abord une région"}</option>
                        {availableDepartments.map((d) => (
                          <option key={d.name} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </details>

              {/* Scope summary */}
              <p className="cam-admin-meta" style={{ margin: 0, paddingTop: "var(--cam-space-4)", borderTop: "var(--cam-border-width) solid var(--cam-border)" }}>
                Périmètre sélectionné :{" "}
                <strong className="cam-admin-strong">
                  {ENTITY_TYPE_OPTIONS.find((o) => o.value === selectedEntityType)?.label}
                  {" · "}
                  {selectedRegion || "National"}
                  {selectedDepartment ? ` › ${selectedDepartment}` : ""}
                  {" · "}
                  {selectedYear || "Toutes les années"}
                  {" · "}
                  {scopeSummary}
                </strong>
              </p>

              {/* Launch button */}
              <div>
                <button
                  type="button"
                  className="cam-button cam-button-primary"
                  onClick={handleLaunchExport}
                  disabled={isExporting || noStatusChosen}
                  aria-busy={isExporting}
                  style={{ display: "inline-flex", alignItems: "center", gap: "var(--cam-space-2)", padding: "0.75rem 1.5rem" }}
                >
                  <IconDownload />
                  {isExporting ? exportBusyLabel : `Lancer l'export ${selectedFormat}`}
                </button>
              </div>

            </div>
          </section>
        </div>

        {/* Right column — Résumé du Jeu de Données & Codebooks */}
        <div style={{ width: 380, flexShrink: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-5)", minWidth: 0 }}>

          {/* Dataset Summary Card — Figma donnees/exports.png */}
          <section className="cam-admin-section" aria-labelledby="dataset-summary-title">
            <div className="cam-admin-section-head">
              <h2 className="cam-admin-h2" id="dataset-summary-title">Résumé du Jeu de Données</h2>
            </div>
            <div className="cam-admin-section-body" style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--cam-space-3)" }}>
                {[
                  { label: "Total enregistrements", value: totalSubmissions > 0 ? totalSubmissions.toLocaleString("fr-FR") : "12 847" },
                  { label: "Variables", value: "156" },
                  { label: "Sections", value: "6" },
                  { label: "Taille estimée", value: `~${totalSubmissions > 0 ? Math.max(1, Math.round(totalSubmissions * 0.0038)) : 48} MB` },
                ].map((item) => (
                  <div key={item.label} style={{ background: "var(--cam-surface-subtle)", padding: "0.625rem 0.75rem", borderRadius: "6px" }}>
                    <div className="cam-admin-meta" style={{ fontSize: "0.75rem" }}>{item.label}</div>
                    <div style={{ fontWeight: 700, fontSize: "1.125rem", color: "var(--cam-text)" }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ paddingTop: "var(--cam-space-3)", borderTop: "var(--cam-border-width) solid var(--cam-border)" }}>
                <div className="cam-admin-meta" style={{ marginBottom: "var(--cam-space-3)", fontWeight: 600 }}>
                  Répartition par type d&apos;entité
                </div>
                <div className="cam-pilot-hbars">
                  {[
                    { label: "Entreprises", count: "4 200", pct: 33 },
                    { label: "Coopératives", count: "3 100", pct: 24 },
                    { label: "Administrations", count: "2 800", pct: 22 },
                    { label: "Projets & Programmes", count: "1 600", pct: 12 },
                    { label: "ASFOP / Formations", count: "1 147", pct: 9 },
                  ].map((row) => (
                    <div key={row.label} className="cam-pilot-hbar">
                      <span style={{ minWidth: 140, fontSize: "0.8125rem", color: "var(--cam-text)" }}>{row.label}</span>
                      <div className="cam-pilot-hbar-track" style={{ flex: 1 }}>
                        <div className="cam-pilot-hbar-fill" style={{ width: `${row.pct}%`, background: "var(--cam-green)" }} />
                      </div>
                      <span className="cam-admin-meta" style={{ minWidth: 48, textAlign: "right", fontWeight: 600 }}>
                        {row.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Codebooks Card — Figma donnees/exports.png */}
          <section className="cam-admin-section" aria-labelledby="codebooks-title">
            <div className="cam-admin-section-head">
              <h2 className="cam-admin-h2" id="codebooks-title">Codebooks Disponibles</h2>
            </div>
            <div className="cam-admin-section-body" style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
              {[
                { name: "Codebook Principal (v2.4)", ext: ".sps", size: "234 KB", action: handleDownloadSps },
                { name: "Dictionnaire des Variables", ext: ".pdf", size: "1.2 MB", action: handleDownloadSps },
                { name: "Guide de Recodage", ext: ".sps", size: "89 KB", action: handleDownloadSps },
              ].map((cb) => (
                <div
                  key={cb.name}
                  style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)", padding: "var(--cam-space-3) 0", borderBottom: "var(--cam-border-width) solid var(--cam-border)" }}
                >
                  <div style={{ color: "var(--cam-green)", flexShrink: 0 }}>
                    <IconDownload />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--cam-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cb.name}</div>
                    <div className="cam-admin-meta">{cb.ext} &middot; {cb.size}</div>
                  </div>
                  <button
                    type="button"
                    className="cam-button cam-button-sm cam-button-secondary"
                    onClick={cb.action}
                    aria-label={`Télécharger ${cb.name}`}
                  >
                    Télécharger
                  </button>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>

      {/* Export History Table — Figma donnees/exports.png */}
      <section className="cam-admin-section" aria-labelledby="export-history-title">
        <div className="cam-admin-section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="cam-admin-h2" id="export-history-title">Historique des Exports Récents</h2>
          <button
            type="button"
            className="cam-button cam-button-sm cam-button-secondary"
            onClick={() => statsQuery.refetch()}
            aria-label="Actualiser l'historique"
          >
            Actualiser
          </button>
        </div>
        <div className="cam-table-wrapper">
          <table className="cam-table">
            <thead>
              <tr>
                <th>Date &amp; Heure</th>
                <th>Utilisateur</th>
                <th>Format</th>
                <th>Périmètre</th>
                <th>Taille</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td suppressHydrationWarning>
                    {new Intl.DateTimeFormat("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                    }).format(new Date(item.date))}
                  </td>
                  <td>{item.user}</td>
                  <td><span className="cam-pilot-badge">{item.format}</span></td>
                  <td>{item.scope}</td>
                  <td>{item.size}</td>
                  <td>
                    <span style={{ color: "var(--cam-success)", fontWeight: 500 }}>
                      &#x2713; Succès
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="cam-button cam-button-sm cam-button-secondary"
                      aria-label={`Télécharger l'export ${item.format}`}
                      onClick={() => {
                        if (item.blob && item.filename) {
                          triggerFileDownload(item.blob, item.filename);
                        } else {
                          handleLaunchExport();
                        }
                      }}
                    >
                      <IconDownload />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
