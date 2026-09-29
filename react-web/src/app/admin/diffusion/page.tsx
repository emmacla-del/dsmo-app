"use client";

import { useMemo, useState } from "react";
import {
  getSpssManifest,
  downloadSpssSavBlob,
  downloadExcelWorkbookBlob,
} from "@/lib/api-client";
import { CAMEROON_ADMIN_HIERARCHY } from "@/components/onefop/vt-cameroon-admin-data";

// The demand questionnaire (6 entity types) and the vocational-training one
// have different variables, so an SPSS file holds one or the other — "" is
// the whole demand side, VOCATIONAL_TRAINING is its own file.
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

// These values must match the OnefopSubmissionStatus enum on the backend
// (src/questionnaires/onefop-submission.entity.ts). Previous values
// (DRAFT, PENDING_REVIEW, APPROVED…) did not exist in the enum and produced
// silent empty exports.
const STATUS_OPTIONS = [
  { value: "SUBMITTED", label: "Soumise" },
  { value: "DIVISION_APPROVED", label: "Visée (Divisionnaire)" },
  { value: "REGION_APPROVED", label: "Visée (Régional)" },
  { value: "FINAL_APPROVED", label: "Visée finale (Centrale)" },
  { value: "REJECTED", label: "Rejetée" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR - i));

// SVG icons for KPI cards
const IconFileCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <polyline points="9 15 11 17 15 13"/>
  </svg>
);

const IconCheckCircle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconXCircle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

export default function DiffusionPage() {
  // Download states
  const [downloadingSav, setDownloadingSav] = useState(false);
  const [downloadingSps, setDownloadingSps] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);

  // Filters: Location & Entity Type
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  // "official" = APPROVED with no open blocking anomaly (the server default);
  // "custom" = exactly the ticked administrative statuses.
  const [scopeMode, setScopeMode] = useState<"official" | "custom">("official");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(STATUS_OPTIONS.map((s) => s.value));
  const noStatusChosen = scopeMode === "custom" && selectedStatuses.length === 0;

  // Format selection (radio)
  const [selectedFormat, setSelectedFormat] = useState<".sav" | ".sps" | ".xlsx">(".sav");

  // Codebook checkbox
  const [includeCodebook, setIncludeCodebook] = useState(false);

  // Feedback
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

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
      ? "Données officielles"
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

  // 1. Download SPSS .sav
  const handleDownloadSav = async () => {
    try {
      setDownloadingSav(true);
      setErrorAlert(null);
      const blob = await downloadSpssSavBlob(currentFilters);
      if (!blob) {
        throw new Error("Le serveur backend n'a retourné aucun fichier SPSS .sav.");
      }
      if (blob.size === 0) {
        throw new Error("Aucune soumission ne correspond aux filtres sélectionnés. Vérifiez les critères de filtrage.");
      }
      triggerFileDownload(blob, "onefop_submissions.sav");
      showSuccess("Fichier SPSS (.sav) téléchargé avec succès.");
    } catch (err: any) {
      setErrorAlert("Erreur lors de l'export SPSS (.sav) : " + (err.message || "Vérifiez la connexion au serveur."));
    } finally {
      setDownloadingSav(false);
    }
  };

  // 2. Download SPSS .sps syntax
  const handleDownloadSps = async () => {
    try {
      setDownloadingSps(true);
      setErrorAlert(null);
      const manifest = await getSpssManifest(currentFilters);
      if (!manifest?.sps) {
        throw new Error("Le serveur backend n'a retourné aucune syntaxe SPSS.");
      }
      const blob = new Blob([manifest.sps], { type: "text/plain;charset=utf-8" });
      triggerFileDownload(blob, "onefop_submissions.sps");
      showSuccess("Syntaxe SPSS (.sps) téléchargée avec succès.");
    } catch (err: any) {
      setErrorAlert("Erreur lors de la génération de la syntaxe (.sps) : " + (err.message || "Vérifiez la connexion au serveur."));
    } finally {
      setDownloadingSps(false);
    }
  };

  // 3. Download Excel .xlsx
  const handleDownloadExcel = async () => {
    try {
      setDownloadingXlsx(true);
      setErrorAlert(null);
      const blob = await downloadExcelWorkbookBlob(currentFilters);
      if (!blob || blob.size === 0) {
        throw new Error("Le serveur backend n'a retourné aucun classeur Excel.");
      }
      triggerFileDownload(blob, "onefop_submissions.xlsx");
      showSuccess("Classeur Excel (.xlsx) téléchargé avec succès.");
    } catch (err: any) {
      setErrorAlert("Erreur lors de l'export Excel (.xlsx) : " + (err.message || "Vérifiez la connexion au serveur."));
    } finally {
      setDownloadingXlsx(false);
    }
  };

  const handleLaunchExport = () => {
    if (selectedFormat === ".sav") handleDownloadSav();
    else if (selectedFormat === ".sps") handleDownloadSps();
    else handleDownloadExcel();
  };

  const isExporting = downloadingSav || downloadingSps || downloadingXlsx;

  const exportBusyLabel = downloadingSav
    ? "Génération du fichier…"
    : downloadingSps
    ? "Génération de la syntaxe…"
    : downloadingXlsx
    ? "Génération du classeur…"
    : "";

  return (
    <div className="cam-admin-page">

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

      {/* KPI Cards */}
      <div className="cam-pilot-kpis">
        <div className="cam-pilot-kpi">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="cam-admin-meta">Total Déclarations</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(30,107,58,0.12)", display: "grid", placeItems: "center", color: "var(--cam-green)", flexShrink: 0 }}>
              <IconFileCheck />
            </div>
          </div>
          <div className="cam-pilot-kpi-value">—</div>
          <div className="cam-admin-meta" style={{ color: "var(--cam-success)" }}>Campagne active</div>
        </div>

        <div className="cam-pilot-kpi">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="cam-admin-meta">Déclarations Validées</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(30,107,58,0.12)", display: "grid", placeItems: "center", color: "var(--cam-green)", flexShrink: 0 }}>
              <IconCheckCircle />
            </div>
          </div>
          <div className="cam-pilot-kpi-value">—</div>
          <div className="cam-admin-meta">Visées finales</div>
        </div>

        <div className="cam-pilot-kpi">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="cam-admin-meta">En Attente de Révision</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(217,119,6,0.10)", display: "grid", placeItems: "center", color: "#d97706", flexShrink: 0 }}>
              <IconClock />
            </div>
          </div>
          <div className="cam-pilot-kpi-value">—</div>
          <div className="cam-admin-meta">En cours de traitement</div>
        </div>

        <div className="cam-pilot-kpi">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="cam-admin-meta">Déclarations Rejetées</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(220,38,38,0.10)", display: "grid", placeItems: "center", color: "#dc2626", flexShrink: 0 }}>
              <IconXCircle />
            </div>
          </div>
          <div className="cam-pilot-kpi-value">—</div>
          <div className="cam-admin-meta">Rejetées</div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "flex", gap: "var(--cam-space-6)", alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* Left column — Configuration de l'Export */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-6)" }}>
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
                  { ext: ".sav" as const, label: "Données SPSS (.sav)", hint: "Fichier IBM SPSS avec étiquettes de variables" },
                  { ext: ".sps" as const, label: "Syntaxe SPSS (.sps)", hint: "Script de syntaxe pour reproduire ou importer le jeu de données" },
                  { ext: ".xlsx" as const, label: "Classeur Excel (.xlsx)", hint: "Classeur multi-feuilles avec ventilations thématiques" },
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
                  <span>Inclure le codebook</span>
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
                    Données officielles
                    <span className="cam-admin-choice-hint">Déclarations visées, sans anomalie bloquante ouverte</span>
                  </span>
                </label>
                <label className="cam-admin-choice">
                  <input type="radio" name="export-scope" checked={scopeMode === "custom"} onChange={() => setScopeMode("custom")} />
                  <span>
                    Choisir les statuts
                    <span className="cam-admin-choice-hint">Le statut de chaque déclaration figure dans le fichier pour filtrer ensuite dans SPSS</span>
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
                      <input type="checkbox" style={{ marginTop: 0 }} defaultChecked />
                      {section}
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Advanced filters */}
              <details>
                <summary className="cam-admin-label" style={{ cursor: "pointer", userSelect: "none" }}>
                  Filtres avancés
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
                      <span className="cam-admin-meta">
                        La formation professionnelle a son propre questionnaire, donc son propre fichier.
                      </span>
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
                        <option value="">Toutes les régions</option>
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
                Périmètre :{" "}
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
                >
                  <IconDownload />
                  {isExporting ? exportBusyLabel : `Lancer l'export ${selectedFormat}`}
                </button>
              </div>

            </div>
          </section>
        </div>

        {/* Right column */}
        <div style={{ width: 380, flexShrink: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-5)", minWidth: 0 }}>

          {/* Dataset Summary Card */}
          <section className="cam-admin-section" aria-labelledby="dataset-summary-title">
            <div className="cam-admin-section-head">
              <h2 className="cam-admin-h2" id="dataset-summary-title">Résumé du Jeu de Données</h2>
            </div>
            <div className="cam-admin-section-body" style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--cam-space-3)" }}>
                {[
                  { label: "Total enregistrements", value: "—" },
                  { label: "Variables", value: "156" },
                  { label: "Sections", value: "6" },
                  { label: "Taille estimée", value: "~48 MB" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="cam-admin-meta">{item.label}</div>
                    <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--cam-text)" }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ paddingTop: "var(--cam-space-3)", borderTop: "var(--cam-border-width) solid var(--cam-border)" }}>
                <div className="cam-admin-meta" style={{ marginBottom: "var(--cam-space-3)" }}>Répartition par type</div>
                <div className="cam-pilot-hbars">
                  {[
                    { label: "Entreprises", pct: 60 },
                    { label: "Administrations", pct: 18 },
                    { label: "ONG", pct: 10 },
                    { label: "CTD", pct: 7 },
                    { label: "Autres", pct: 5 },
                  ].map((row) => (
                    <div key={row.label} className="cam-pilot-hbar">
                      <span style={{ minWidth: 100, fontSize: "0.8125rem" }}>{row.label}</span>
                      <div className="cam-pilot-hbar-track">
                        <div className="cam-pilot-hbar-fill" style={{ width: `${row.pct}%` }} />
                      </div>
                      <span className="cam-admin-meta" style={{ minWidth: 32, textAlign: "right" }}>—</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Codebooks Card */}
          <section className="cam-admin-section" aria-labelledby="codebooks-title">
            <div className="cam-admin-section-head">
              <h2 className="cam-admin-h2" id="codebooks-title">Codebooks Disponibles</h2>
            </div>
            <div className="cam-admin-section-body" style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
              {[
                { name: "Codebook Principal (v2.4)", ext: ".sps", size: "234 KB" },
                { name: "Dictionnaire des Variables", ext: ".pdf", size: "1.2 MB" },
                { name: "Guide de Recodage", ext: ".sps", size: "89 KB" },
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
                  <span className="cam-pilot-badge">{cb.ext}</span>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>

      {/* Export History Table */}
      <section className="cam-admin-section" aria-labelledby="export-history-title">
        <div className="cam-admin-section-head">
          <h2 className="cam-admin-h2" id="export-history-title">Historique des Exports Récents</h2>
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
              <tr>
                <td>26/10/2026 14:32</td>
                <td>Admin</td>
                <td><span className="cam-pilot-badge">.sav</span></td>
                <td>National</td>
                <td>2.4 MB</td>
                <td><span style={{ color: "var(--cam-success)", fontWeight: 500 }}>&#x2713; Succès</span></td>
                <td>
                  <button type="button" className="cam-button cam-button-sm cam-button-secondary" aria-label="Télécharger l'export du 26/10/2026">
                    <IconDownload />
                  </button>
                </td>
              </tr>
              <tr>
                <td>25/10/2026 09:15</td>
                <td>Admin</td>
                <td><span className="cam-pilot-badge">.xlsx</span></td>
                <td>Littoral</td>
                <td>1.1 MB</td>
                <td><span style={{ color: "var(--cam-success)", fontWeight: 500 }}>&#x2713; Succès</span></td>
                <td>
                  <button type="button" className="cam-button cam-button-sm cam-button-secondary" aria-label="Télécharger l'export du 25/10/2026">
                    <IconDownload />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
