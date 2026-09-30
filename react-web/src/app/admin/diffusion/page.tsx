"use client";

import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  getDataStats,
  getExportSummary,
  getSpssManifest,
  downloadSpssCsvBlob,
  downloadSpssSavBlob,
  downloadExcelWorkbookBlob,
} from "@/lib/api-client";
import { entityTypeLabel } from "@/lib/companies-directory";
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

// Values must match the OnefopStatus Prisma enum (DRAFT excluded — drafts
// are never exported). Previous values (SUBMITTED, DIVISION_APPROVED, …)
// were DSMO statuses and produced 400 responses from the ONEFOP endpoint.
const STATUS_OPTIONS = [
  { value: "PENDING_REVIEW", label: "En instance de visa" },
  { value: "APPROVED", label: "Visée" },
  { value: "CORRECTION_REQUESTED", label: "Correction demandée" },
  { value: "REJECTED", label: "Rejetée" },
];

type ExportFormat = ".sav" | ".csv" | ".xlsx";

const FORMAT_OPTIONS: { ext: ExportFormat; label: string; hint: string }[] = [
  { ext: ".sav", label: ".SAV (format natif SPSS)", hint: "Données avec étiquettes de variables et de valeurs" },
  { ext: ".csv", label: ".CSV (données tabulaires)", hint: "À ouvrir dans SPSS avec la syntaxe .sps du codebook" },
  { ext: ".xlsx", label: ".XLSX (Microsoft Excel)", hint: "Classeur multi-feuilles avec ventilations thématiques" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR - i));

function fmt(n: number) {
  return n.toLocaleString("fr-FR");
}

function pct(part: number, total: number) {
  return total > 0 ? `${((part / total) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—";
}

const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

function errorMessage(err: unknown): string {
  return (err instanceof Error && err.message) || "Vérifiez la connexion au serveur.";
}

function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      if (document.body.contains(a)) document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // safe ignore
    }
  }, 2500);
}

export default function DiffusionPage() {
  // Filters: location, entity type, year, statistical scope
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  // "official" = APPROVED with no open blocking anomaly (the server default);
  // "custom" = exactly the ticked administrative statuses.
  const [scopeMode, setScopeMode] = useState<"official" | "custom">("official");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(STATUS_OPTIONS.map((s) => s.value));
  const noStatusChosen = scopeMode === "custom" && selectedStatuses.length === 0;

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(".sav");
  // Also download the .sps syntax (variable definitions + value labels).
  const [includeCodebook, setIncludeCodebook] = useState(true);

  const [busy, setBusy] = useState<"" | "export" | "codebook">("");
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

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
    const filters: Record<string, unknown> = {};
    if (selectedRegion) filters.region = selectedRegion;
    if (selectedDepartment) filters.department = selectedDepartment;
    if (selectedEntityType) filters.entityType = selectedEntityType;
    if (selectedYear) filters.year = Number(selectedYear);
    if (scopeMode === "custom") filters.statuses = selectedStatuses;
    return filters;
  }, [selectedRegion, selectedDepartment, selectedEntityType, selectedYear, scopeMode, selectedStatuses]);

  // KPI tiles: ONEFOP submissions in the caller's territory, drafts excluded.
  const statsQuery = useQuery({ queryKey: ["admin", "diffusion", "stats"], queryFn: getDataStats });
  const scoped = statsQuery.data?.onefopInScope;

  // Dataset summary: the rows the export would contain with these filters.
  const summaryQuery = useQuery({
    queryKey: ["admin", "diffusion", "summary", currentFilters],
    queryFn: () => getExportSummary(currentFilters),
    enabled: !noStatusChosen,
    placeholderData: keepPreviousData,
  });
  const summary = summaryQuery.data;

  const scopeSummary =
    scopeMode === "official"
      ? "Données officielles"
      : STATUS_OPTIONS.filter((s) => selectedStatuses.includes(s.value)).map((s) => s.label).join(", ") || "Aucun statut";

  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const downloadCodebook = async () => {
    const manifest = await getSpssManifest(currentFilters);
    if (!manifest?.sps) throw new Error("Le serveur n'a retourné aucune syntaxe SPSS.");
    triggerFileDownload(new Blob([manifest.sps], { type: "text/plain;charset=utf-8" }), "onefop_submissions.sps");
  };

  const handleLaunchExport = async () => {
    setBusy("export");
    setErrorAlert(null);
    try {
      if (selectedFormat === ".sav") {
        const blob = await downloadSpssSavBlob(currentFilters);
        if (!blob) throw new Error("Le serveur n'a retourné aucun fichier SPSS .sav.");
        if (blob.size === 0) throw new Error("Aucune soumission ne correspond aux filtres sélectionnés.");
        triggerFileDownload(blob, "onefop_submissions.sav");
      } else if (selectedFormat === ".csv") {
        const blob = await downloadSpssCsvBlob(currentFilters);
        if (!blob || blob.size === 0) throw new Error("Le serveur n'a retourné aucun fichier CSV.");
        triggerFileDownload(blob, "onefop_submissions.csv");
      } else {
        const blob = await downloadExcelWorkbookBlob(currentFilters);
        if (!blob || blob.size === 0) throw new Error("Le serveur n'a retourné aucun classeur Excel.");
        triggerFileDownload(blob, "onefop_submissions.xlsx");
      }
      if (includeCodebook) await downloadCodebook();
      showSuccess(`Export ${selectedFormat}${includeCodebook ? " et codebook .sps" : ""} téléchargé.`);
    } catch (err: unknown) {
      setErrorAlert(`Erreur lors de l'export ${selectedFormat} : ${errorMessage(err)}`);
    } finally {
      setBusy("");
    }
  };

  const handleCodebookOnly = async () => {
    setBusy("codebook");
    setErrorAlert(null);
    try {
      await downloadCodebook();
      showSuccess("Codebook (.sps) téléchargé.");
    } catch (err: unknown) {
      setErrorAlert(`Erreur lors de la génération du codebook (.sps) : ${errorMessage(err)}`);
    } finally {
      setBusy("");
    }
  };

  const total = scoped?.total ?? 0;
  const approved = scoped?.byStatus.APPROVED ?? 0;
  const pending = scoped?.byStatus.PENDING_REVIEW ?? 0;
  const corrections = scoped?.byStatus.CORRECTION_REQUESTED ?? 0;
  const rejected = scoped?.byStatus.REJECTED ?? 0;
  const kpi = (n: number) => (scoped ? fmt(n) : statsQuery.isLoading ? "…" : "—");

  return (
    <div className="cam-admin-page">
      {errorAlert && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>{errorAlert}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer le message" onClick={() => setErrorAlert(null)}>×</button>
        </div>
      )}
      {successToast && (
        <div role="status" className="cam-admin-notice cam-admin-notice--success">
          <span>{successToast}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer le message" onClick={() => setSuccessToast(null)}>×</button>
        </div>
      )}

      {/* KPI strip — caller's territory, drafts excluded */}
      <div className="cam-admin-stats" aria-label="Déclarations ONEFOP de votre périmètre">
        <div className="cam-admin-stat">
          <div className="cam-admin-stat-label">Total déclarations</div>
          <div className="cam-admin-stat-value">{kpi(total)}</div>
          <div className="cam-admin-stat-hint">{scoped ? `+${fmt(scoped.newThisMonth)} ce mois` : "Hors brouillons"}</div>
        </div>
        <div className="cam-admin-stat">
          <div className="cam-admin-stat-label">Déclarations validées</div>
          <div className="cam-admin-stat-value is-good">{kpi(approved)}</div>
          <div className="cam-admin-stat-hint">{scoped ? `${pct(approved, total)} visées` : "Visa accordé"}</div>
        </div>
        <div className="cam-admin-stat">
          <div className="cam-admin-stat-label">En attente de révision</div>
          <div className="cam-admin-stat-value is-warn">{kpi(pending)}</div>
          <div className="cam-admin-stat-hint">
            {scoped ? `${pct(pending, total)} en instance${corrections > 0 ? ` · ${fmt(corrections)} en correction` : ""}` : "En instance de visa"}
          </div>
        </div>
        <div className="cam-admin-stat">
          <div className="cam-admin-stat-label">Déclarations rejetées</div>
          <div className="cam-admin-stat-value is-alert">{kpi(rejected)}</div>
          <div className="cam-admin-stat-hint">{scoped ? `${pct(rejected, total)} du total` : "Rejet définitif"}</div>
        </div>
      </div>
      {statsQuery.isError && (
        <p className="cam-admin-meta" role="alert" style={{ margin: 0 }}>
          Indicateurs indisponibles : {(statsQuery.error as Error)?.message}
        </p>
      )}

      <div className="cam-admin-grid">
        {/* Configuration de l'export */}
        <section className="cam-admin-section" aria-labelledby="export-config-title">
          <div className="cam-admin-section-head">
            <div>
              <h2 className="cam-admin-h2" id="export-config-title">Configuration de l&apos;export</h2>
              <p className="cam-admin-meta" style={{ margin: "2px 0 0" }}>
                Définissez le format et le périmètre avant la génération du fichier.
              </p>
            </div>
            {hasActiveFilters && (
              <button type="button" className="cam-text-button" onClick={handleResetFilters}>Réinitialiser</button>
            )}
          </div>
          <div className="cam-admin-section-body cam-diff-form">
            <fieldset className="cam-diff-fieldset">
              <legend className="cam-admin-label">Format de fichier</legend>
              {FORMAT_OPTIONS.map((f) => (
                <label key={f.ext} className="cam-admin-choice">
                  <input type="radio" name="export-format" checked={selectedFormat === f.ext} onChange={() => setSelectedFormat(f.ext)} />
                  <span>
                    {f.label}
                    <span className="cam-admin-choice-hint">{f.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="cam-diff-fieldset">
              <legend className="cam-admin-label">Codebook &amp; syntaxe</legend>
              <label className="cam-admin-choice">
                <input type="checkbox" checked={includeCodebook} onChange={(e) => setIncludeCodebook(e.target.checked)} />
                <span>
                  Générer le codebook (.sps)
                  <span className="cam-admin-choice-hint">Fichier de syntaxe SPSS avec les définitions de variables et les étiquettes de valeurs</span>
                </span>
              </label>
            </fieldset>

            <fieldset className="cam-diff-fieldset">
              <legend className="cam-admin-label">Périmètre des données</legend>
              <label className="cam-admin-choice">
                <input type="radio" name="export-scope" checked={scopeMode === "official"} onChange={() => setScopeMode("official")} />
                <span>
                  Données officielles{summary && scopeMode === "official" ? ` (${fmt(summary.rowCount)})` : ""}
                  <span className="cam-admin-choice-hint">Déclarations visées, sans anomalie bloquante ouverte</span>
                </span>
              </label>
              <label className="cam-admin-choice">
                <input type="radio" name="export-scope" checked={scopeMode === "custom"} onChange={() => setScopeMode("custom")} />
                <span>
                  Sélection personnalisée des statuts
                  <span className="cam-admin-choice-hint">Le statut de chaque déclaration figure dans le fichier pour filtrer ensuite dans SPSS</span>
                </span>
              </label>
              {scopeMode === "custom" && (
                <div className="cam-diff-statuses">
                  {STATUS_OPTIONS.map((s) => (
                    <label key={s.value} className="cam-admin-choice">
                      <input type="checkbox" checked={selectedStatuses.includes(s.value)} onChange={(e) => toggleStatus(s.value, e.target.checked)} />
                      <span>{s.label}</span>
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

            <div className="cam-admin-filters">
              <div className="cam-field">
                <label className="cam-label" htmlFor="filter-entity-type">Questionnaire / type d&apos;entité</label>
                <select id="filter-entity-type" className="cam-select" value={selectedEntityType} onChange={(e) => setSelectedEntityType(e.target.value)}>
                  {ENTITY_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div className="cam-field">
                <label className="cam-label" htmlFor="filter-year">Année d&apos;enquête</label>
                <select id="filter-year" className="cam-select" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                  <option value="">Toutes les années</option>
                  {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="cam-field">
                <label className="cam-label" htmlFor="filter-region">Région</label>
                <select
                  id="filter-region"
                  className="cam-select"
                  value={selectedRegion}
                  onChange={(e) => { setSelectedRegion(e.target.value); setSelectedDepartment(""); }}
                >
                  <option value="">Toutes les régions</option>
                  {CAMEROON_ADMIN_HIERARCHY.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
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
                  {availableDepartments.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <p className="cam-admin-meta" style={{ margin: 0 }}>
              La formation professionnelle a son propre questionnaire, donc son propre fichier.
            </p>

            <p className="cam-admin-meta cam-diff-scope">
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

            <button
              type="button"
              className="cam-button cam-button-primary cam-diff-launch"
              onClick={handleLaunchExport}
              disabled={busy !== "" || noStatusChosen}
              aria-busy={busy === "export"}
            >
              <IconDownload />
              {busy === "export" ? "Génération du fichier…" : `Lancer l'export ${selectedFormat}`}
            </button>
          </div>
        </section>

        <div className="cam-diff-side">
          {/* Résumé du jeu de données */}
          <section className="cam-admin-section" aria-labelledby="dataset-summary-title">
            <div className="cam-admin-section-head">
              <div>
                <h2 className="cam-admin-h2" id="dataset-summary-title">Résumé du jeu de données</h2>
                <p className="cam-admin-meta" style={{ margin: "2px 0 0" }}>Volume et structure du fichier avec les filtres actuels.</p>
              </div>
            </div>
            <div className="cam-admin-section-body">
              {noStatusChosen ? (
                <p className="cam-admin-meta" style={{ margin: 0 }}>Cochez au moins un statut pour calculer le résumé.</p>
              ) : summaryQuery.isError ? (
                <p className="cam-admin-meta" role="alert" style={{ margin: 0 }}>
                  Résumé indisponible : {(summaryQuery.error as Error)?.message}
                </p>
              ) : !summary ? (
                <p className="cam-admin-meta" style={{ margin: 0 }}>{summaryQuery.isLoading ? "Calcul du résumé…" : "Résumé indisponible."}</p>
              ) : (
                <>
                  <dl className="cam-diff-summary" aria-busy={summaryQuery.isFetching}>
                    <div><dt>Total enregistrements</dt><dd>{fmt(summary.rowCount)}</dd></div>
                    <div><dt>Variables</dt><dd>{fmt(summary.variableCount)}</dd></div>
                    {summary.sectionCount !== null && (
                      <div><dt>Sections</dt><dd>{fmt(summary.sectionCount)}</dd></div>
                    )}
                  </dl>
                  <div className="cam-diff-breakdown">
                    <div className="cam-admin-label">Répartition par type</div>
                    {summary.byFormType.length === 0 ? (
                      <p className="cam-admin-meta" style={{ margin: 0 }}>Aucune déclaration ne correspond aux filtres.</p>
                    ) : (
                      <div className="cam-pilot-hbars">
                        {summary.byFormType.map((row) => (
                          <div key={row.formType} className="cam-pilot-hbar">
                            <span className="cam-pilot-hbar-label" title={entityTypeLabel(row.formType)}>{entityTypeLabel(row.formType)}</span>
                            <div className="cam-pilot-hbar-track">
                              <div className="cam-pilot-hbar-fill" style={{ width: `${summary.rowCount > 0 ? (row.count / summary.rowCount) * 100 : 0}%` }} />
                            </div>
                            <span className="cam-admin-meta" style={{ textAlign: "right" }}>{fmt(row.count)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Codebooks disponibles */}
          <section className="cam-admin-section" aria-labelledby="codebooks-title">
            <div className="cam-admin-section-head">
              <div>
                <h2 className="cam-admin-h2" id="codebooks-title">Codebooks disponibles</h2>
                <p className="cam-admin-meta" style={{ margin: "2px 0 0" }}>Référentiels associés au dictionnaire SPSS.</p>
              </div>
            </div>
            <div className="cam-admin-section-body">
              <button
                type="button"
                className="cam-diff-codebook"
                onClick={handleCodebookOnly}
                disabled={busy !== "" || noStatusChosen}
                aria-busy={busy === "codebook"}
              >
                <IconDownload />
                <span>
                  <span className="cam-admin-strong">Codebook principal</span>
                  <span className="cam-admin-meta" style={{ display: "block" }}>
                    {busy === "codebook" ? "Génération…" : ".sps · syntaxe SPSS pour le questionnaire sélectionné"}
                  </span>
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Historique des exports récents — no data source yet */}
      <section className="cam-admin-section" aria-labelledby="export-history-title">
        <div className="cam-admin-section-head">
          <h2 className="cam-admin-h2" id="export-history-title">Historique des exports récents</h2>
        </div>
        {/* TODO(backend, M): SPSS/Excel exports write no audit row, and size/status/re-download need an export-job table (deferred.md) */}
        <div className="cam-admin-empty">
          <strong>Historique non disponible</strong>
          Les exports de cette page ne sont pas encore enregistrés : l&apos;historique (date, utilisateur, format, périmètre, taille) apparaîtra ici une fois le registre des exports en place.
        </div>
      </section>
    </div>
  );
}
