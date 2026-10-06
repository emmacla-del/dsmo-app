"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import {
  ANOMALY_DEROGATION_ROLES,
  ANOMALY_REGISTRY_ROLES,
  ANOMALY_STATUS_LABELS,
  anomalyCompanyName,
  anomalyDossierRef,
  listAnomalyRegistry,
  resolveAnomalyRecord,
  getQualitySummary,
  getValidationRules,
  type AnomalyRecord,
  type AnomalyResolutionType,
  type QualitySummary,
  type ValidationRuleItem,
} from "@/lib/anomaly-registry";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  hrefWith,
  parseAnomalyStatusFilter,
  parseQualiteVue,
  parseSeverityFilter,
  type QualiteVue,
} from "@/lib/admin-url";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import {
  NOT_PROVIDED,
  count,
  percent,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";

const REGISTRY_PAGE_SIZE = 50;

const QUALITE_TABS: { vue: QualiteVue; label: string }[] = [
  { vue: "indicateurs", label: "Indicateurs" },
  { vue: "registre", label: "Registre des anomalies" },
  { vue: "regles", label: "Règles de validation" },
];

// Suspense because useSearchParams() requires it in the app router.
export default function CentreQualitePage() {
  return (
    <Suspense fallback={null}>
      <CentreQualiteContent />
    </Suspense>
  );
}

function CentreQualiteContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const vue = parseQualiteVue(searchParams.get("vue"));
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const canReadRegistry = !!role && ANOMALY_REGISTRY_ROLES.includes(role);
  const canGrantDerogation = !!role && ANOMALY_DEROGATION_ROLES.includes(role);

  // Both filters are sent to the server, so `total` always describes the same
  // query as the rows on screen and there is no client-side re-filtering that
  // could make the two disagree. They live in the URL (?status=, ?severity=),
  // so "open blocking anomalies" is a link that can be reloaded and shared.
  const filterStatus = parseAnomalyStatusFilter(searchParams.get("status"));
  const filterSeverity = parseSeverityFilter(searchParams.get("severity"));
  const setRegisterFilter = (key: "status" | "severity", value: string) =>
    router.replace(hrefWith(pathname, searchParams.toString(), { [key]: value === "ALL" ? null : value }));

  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyRecord | null>(null);
  const [resolutionType, setResolutionType] = useState<AnomalyResolutionType>("DECLARANT_CORRECTION");
  const [resolutionNote, setResolutionNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  /**
   * Anomaly registry.
   *
   * Source: GET /admin/questionnaires/anomalies/registry
   * (EligibilityEngineService.listAnomalies). Rows are scoped server-side to
   * the caller's territory; `total` counts the filtered query.
   *
   * There is no fallback dataset. If the registry is empty the screen says so
   * — which today is the truthful answer for every caller, because nothing in
   * the backend writes to `onefop_anomalies` yet (see
   * docs/admin-data-integrity-inventory.md §7.1).
   */
  // Each of the three queries runs only on its own tab (?vue=).
  const anomaliesQuery = useQuery({
    queryKey: ["admin", "anomalies", "registry", filterStatus, filterSeverity],
    queryFn: () =>
      listAnomalyRegistry({
        limit: REGISTRY_PAGE_SIZE,
        status: filterStatus === "ALL" ? undefined : filterStatus,
        isBlocking:
          filterSeverity === "BLOCKING" ? true : filterSeverity === "WARNING" ? false : undefined,
      }),
    enabled: canReadRegistry && vue === "registre",
  });

  const qualityQuery = useQuery({
    queryKey: ["admin", "questionnaires", "quality", "summary"],
    queryFn: () => getQualitySummary(),
    enabled: canReadRegistry && vue === "indicateurs",
  });

  const quality = qualityQuery.data ?? null;

  const rulesQuery = useQuery({
    queryKey: ["admin", "questionnaires", "rules"],
    queryFn: getValidationRules,
    enabled: canReadRegistry && vue === "regles",
  });

  const rulesState = resolveDataState({
    roleAllowed: canReadRegistry,
    isLoading: rulesQuery.isLoading,
    isError: rulesQuery.isError,
    error: rulesQuery.error,
    rowCount: rulesQuery.data?.length ?? null,
  });

  const items = useMemo(() => anomaliesQuery.data?.items ?? [], [anomaliesQuery.data]);
  const totalCount = anomaliesQuery.data?.total ?? null;

  const registryState = resolveDataState({
    roleAllowed: canReadRegistry,
    isLoading: anomaliesQuery.isLoading,
    isError: anomaliesQuery.isError,
    error: anomaliesQuery.error,
    rowCount: anomaliesQuery.data?.items.length ?? null,
  });

  /**
   * "Contrôles récents" panel: the five most recently detected rows of the
   * same real registry, by `detectedAt`. Not a separate event log — the system
   * keeps none — so the panel is labelled as a view of the registry.
   */

  const resolveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { resolutionType: AnomalyResolutionType; resolutionNote: string; evidenceUrl?: string } }) =>
      resolveAnomalyRecord(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "anomalies"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] });
      setSelectedAnomaly(null);
      setResolutionNote("");
      setEvidenceUrl("");
      setActionError(null);
      setSuccessToast("L'anomalie a été résolue et l'opération consignée au journal d'audit.");
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: unknown) => {
      setActionError(
        err instanceof Error ? err.message : "Erreur lors de la résolution de l'anomalie.",
      );
    },
  });

  const handleOpenResolveModal = (a: AnomalyRecord) => {
    setSelectedAnomaly(a);
    setResolutionType("DECLARANT_CORRECTION");
    setResolutionNote("");
    setEvidenceUrl("");
    setActionError(null);
  };

  const handleConfirmResolution = () => {
    if (!selectedAnomaly) return;
    if (!resolutionNote.trim()) {
      setActionError("Veuillez saisir un motif ou une justification pour la résolution de l'anomalie.");
      return;
    }
    resolveMutation.mutate({
      id: selectedAnomaly.id,
      payload: {
        resolutionType,
        resolutionNote: resolutionNote.trim(),
        evidenceUrl: evidenceUrl.trim() || undefined,
      },
    });
  };


  return (
    <div className="cam-admin-page" style={{ padding: "16px 28px 40px", maxWidth: 1440, margin: "0 auto", background: "#f8fafc" }}>
      {/* Shared header. Its tabs are the page's three sections, held in
          ?vue= so a reload or a shared link reopens the same one. They
          replace a self-link pill and a scroll button. A "Contrôle régional"
          tab returns once GET quality/summary and anomalies/registry accept
          a `region` filter (both are territory-scoped by territoryFromUser
          today, so a REGIONAL_ADMIN cannot widen past its own ressort). */}
      <AdminPageHeader
        breadcrumb={[{ label: "Contrôle Qualité" }, { label: "Centre Qualité" }]}
        title="Centre de Contrôle de Qualité"
        actions={<AdminHeaderActions />}
        tabs={QUALITE_TABS.map((item) => ({
          label: item.label,
          href: hrefWith(pathname, searchParams.toString(), { vue: item.vue }),
          isActive: vue === item.vue,
        }))}
      />

      {/* ── Toast Alert ── */}
      {successToast && (
        <div role="status" className="cam-admin-notice cam-admin-notice--success" style={{ marginBottom: 20 }}>
          <span>{successToast}</span>
          <button type="button" className="cam-admin-notice-close" onClick={() => setSuccessToast(null)}>×</button>
        </div>
      )}

      {/* ── Indicateurs: the five rates and the anomaly aggregates ── */}
      {vue === "indicateurs" && (
        <>
          {/* Quality indicators.
              No endpoint computes completeness, coherence, anomaly or warning
              rates over a scope, so no figure is printed. The one rate the system
              can compute (statistically-ready dossiers / total dossiers) belongs
              to /admin/pilotage, which owns it, and is linked rather than
              duplicated here. */}
          <section
            aria-labelledby="quality-kpis-title"
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "20px 24px",
              marginBottom: 24,
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <h2
              id="quality-kpis-title"
              style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: "#0f172a", textTransform: "uppercase", margin: "0 0 14px" }}
            >
              INDICATEURS DE QUALITÉ
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px", background: "#ffffff" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#475569", textTransform: "uppercase" }}>
                  Complétude
                </span>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1e6b3a", letterSpacing: "-0.02em", margin: "6px 0 0", lineHeight: 1 }}>
                  {qualityQuery.isLoading ? "…" : percent(quality?.completenessRate)}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Dossiers complets</div>
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px", background: "#ffffff" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#475569", textTransform: "uppercase" }}>
                  Cohérence
                </span>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1e6b3a", letterSpacing: "-0.02em", margin: "6px 0 0", lineHeight: 1 }}>
                  {qualityQuery.isLoading ? "…" : percent(quality?.coherenceRate)}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Sans contradiction</div>
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px", background: "#ffffff" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#475569", textTransform: "uppercase" }}>
                  Taux d&apos;anomalies
                </span>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#b91c1c", letterSpacing: "-0.02em", margin: "6px 0 0", lineHeight: 1 }}>
                  {qualityQuery.isLoading ? "…" : percent(quality?.anomalyRate)}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{count(quality?.blockingAnomaliesCount)} bloquante(s)</div>
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px", background: "#ffffff" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#475569", textTransform: "uppercase" }}>
                  Avertissements
                </span>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#d97706", letterSpacing: "-0.02em", margin: "6px 0 0", lineHeight: 1 }}>
                  {qualityQuery.isLoading ? "…" : percent(quality?.warningRate)}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{count(quality?.warningsCount)} alerte(s)</div>
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px", background: "#ffffff" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#475569", textTransform: "uppercase" }}>
                  Éligibilité statistique
                </span>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1e6b3a", letterSpacing: "-0.02em", margin: "6px 0 0", lineHeight: 1 }}>
                  {qualityQuery.isLoading ? "…" : percent(quality?.statisticalEligibilityRate)}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{count(quality?.statisticallyReadyCount)} dossier(s) prêts</div>
              </div>
            </div>
          </section>

          {/* Authoritative aggregates by anomaly type and by region. */}
          <section
            aria-labelledby="anomalies-aggregates-title"
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "20px 24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <h2
              id="anomalies-aggregates-title"
              style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: "#0f172a", textTransform: "uppercase", margin: "0 0 16px" }}
            >
              ANOMALIES PAR TYPE ET PAR RÉGION
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <h3 style={{ fontSize: 12, fontWeight: 600, color: "#475569", margin: "0 0 10px", textTransform: "uppercase" }}>
                  Par famille de règles
                </h3>
                {qualityQuery.isLoading ? (
                  <p style={{ fontSize: 13, color: "#64748b" }}>Chargement des familles…</p>
                ) : (quality?.byRuleFamily?.length ?? 0) === 0 ? (
                  <p style={{ fontSize: 13, color: "#64748b" }}>Aucune anomalie ouverte par famille.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {quality?.byRuleFamily.map((f) => (
                      <div key={f.ruleFamily} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 10px", background: "#f8fafc", borderRadius: 6 }}>
                        <span style={{ fontWeight: 500, color: "#1e293b" }}>{f.ruleFamily}</span>
                        <span style={{ fontWeight: 700, color: "#b91c1c" }}>{count(f.count)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: 12, fontWeight: 600, color: "#475569", margin: "0 0 10px", textTransform: "uppercase" }}>
                  Par région
                </h3>
                {qualityQuery.isLoading ? (
                  <p style={{ fontSize: 13, color: "#64748b" }}>Chargement des régions…</p>
                ) : (quality?.byRegion?.length ?? 0) === 0 ? (
                  <p style={{ fontSize: 13, color: "#64748b" }}>Aucune anomalie ouverte par région.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {quality?.byRegion.map((r) => (
                      <div key={r.region} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 10px", background: "#f8fafc", borderRadius: 6 }}>
                        <span style={{ fontWeight: 500, color: "#1e293b" }}>{r.region}</span>
                        <span style={{ fontWeight: 700, color: "#b91c1c" }}>{count(r.count)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* ── Règles de validation ── */}
      {vue === "regles" && (
        <>
          {/* Card D: validation rules.
              Rule definitions and their enabled state are not persisted
              anywhere (docs/admin-data-integrity-inventory.md §7.6), so no
              rule list and no on/off state is shown. The rule codes that do
              appear in the registry below come from the stored anomalies
              themselves. */}
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "20px 24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
            aria-labelledby="regles-validation-title"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 id="regles-validation-title" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: "#0f172a", textTransform: "uppercase", margin: 0 }}>
                RÈGLES DE VALIDATION{rulesQuery.data?.length !== undefined ? ` (${count(rulesQuery.data.length)})` : ""}
              </h2>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#15803d", background: "#dcfce7", padding: "2px 8px", borderRadius: 9999 }}>
                ACTIVES
              </span>
            </div>

            {rulesState !== "ready" ? (
              <DataState
                dense
                state={rulesState}
                resource="le référentiel des règles"
                error={rulesQuery.error}
                onRetry={() => rulesQuery.refetch()}
                title={rulesState === "empty" ? "Aucune règle répertoriée" : undefined}
                hint={rulesState === "empty" ? "Les règles de contrôle configurées s'afficheront ici." : undefined}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {rulesQuery.data?.map((rule) => (
                  <div
                    key={rule.code}
                    style={{
                      border: "1px solid #f1f5f9",
                      borderRadius: 8,
                      padding: "12px 14px",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                          {rule.name}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", marginTop: 2 }}>
                          {rule.code} • Famille : {rule.family}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          whiteSpace: "nowrap",
                          background: rule.isBlocking ? "#fee2e2" : "#fef3c7",
                          color: rule.isBlocking ? "#b91c1c" : "#b45309",
                        }}
                      >
                        {rule.isBlocking ? "BLOQUANTE" : "AVERTISSEMENT"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 6, lineHeight: 1.4 }}>
                      {rule.description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Registre des anomalies. "Détections récentes" — the first five rows
          of this same query, following its filters — sat beside the rules;
          it is folded into the register rather than shown twice. ── */}
      {vue === "registre" && (
        <>
          {/* ── Retained Functional Widget: Registre Opérationnel des Contrôles & Anomalies ── */}
          <section
            id="registre-anomalies"
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "20px 24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              marginBottom: 32,
            }}
            aria-labelledby="anomalies-registry-title"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 18 }}>
              <div>
                <h2 id="anomalies-registry-title" style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Registre des Contrôles &amp; Anomalies{totalCount === null ? "" : ` (${count(totalCount)})`}
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
                  Tableau d&apos;instruction détaillé des anomalies détectées sur les déclarations soumises.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  className="cam-select"
                  style={{ width: "auto", minWidth: 140, height: 34, fontSize: 13, borderRadius: 6, borderColor: "#cbd5e1" }}
                  value={filterStatus}
                  onChange={(e) => setRegisterFilter("status", e.target.value)}
                >
                  <option value="ALL">Tous statuts</option>
                  <option value="OPEN">Ouvertes</option>
                  <option value="RESOLVED">Résolues</option>
                  <option value="WAIVED">Dispensées</option>
                </select>
                <select
                  className="cam-select"
                  style={{ width: "auto", minWidth: 160, height: 34, fontSize: 13, borderRadius: 6, borderColor: "#cbd5e1" }}
                  value={filterSeverity}
                  onChange={(e) => setRegisterFilter("severity", e.target.value)}
                >
                  <option value="ALL">Toutes sévérités</option>
                  <option value="BLOCKING">Bloquantes uniquement</option>
                  <option value="WARNING">Avertissements uniquement</option>
                </select>
                <button
                  type="button"
                  className="cam-button cam-button-sm cam-button-secondary"
                  onClick={() => anomaliesQuery.refetch()}
                  style={{ height: 34, padding: "0 14px", fontSize: 13 }}
                >
                  Actualiser
                </button>
              </div>
            </div>

            <div className="cam-table-wrapper" style={{ border: "1px solid #f1f5f9", borderRadius: 8 }}>
              <table className="cam-table" style={{ width: "100%", margin: 0 }}>
                <thead style={{ background: "#f8fafc" }}>
                  <tr>
                    <th style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Déclaration / Dossier</th>
                    <th style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Règle &amp; Code</th>
                    <th style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Description de l&apos;Anomalie</th>
                    <th style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Sévérité</th>
                    <th style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Détectée le</th>
                    <th style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Statut</th>
                    <th style={{ fontSize: 12, fontWeight: 600, color: "#475569", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Loading, error, authorization refusal and "no records" are
                      reported separately. No branch substitutes sample rows. */}
                  <DataStateRow
                    colSpan={7}
                    state={registryState}
                    resource="le registre des anomalies"
                    error={anomaliesQuery.error}
                    onRetry={() => anomaliesQuery.refetch()}
                    title={registryState === "empty" ? "Aucune anomalie enregistrée" : undefined}
                    hint={
                      registryState === "empty"
                        ? "Aucune anomalie correspondant à ce périmètre n'est actuellement enregistrée."
                        : undefined
                    }
                  />
                  {items.map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ fontSize: 13 }}>
                        {a.submission ? (
                          <div>
                            <Link
                              href={`/admin/dossiers/${encodeURIComponent(a.submission.id)}`}
                              style={{ fontWeight: 600, color: "#007a5e", textDecoration: "none" }}
                            >
                              {anomalyDossierRef(a)}
                            </Link>
                            {/* Establishment name as stored on the submission's
                                company record, or nothing at all. */}
                            {anomalyCompanyName(a) && (
                              <div style={{ fontSize: 12, color: "#0f172a", marginTop: 2 }}>
                                {anomalyCompanyName(a)}
                              </div>
                            )}
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                              {a.submission.region ?? NOT_PROVIDED}
                              {a.submission.department ? ` · ${a.submission.department}` : ""}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>{NOT_PROVIDED}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                          {a.ruleCode}
                        </span>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          {a.ruleFamily}
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        <div style={{ maxWidth: 360, wordBreak: "break-word", color: "#0f172a" }}>{a.description}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                          Observé : <strong>{a.observedValue}</strong> &middot; Attendu : <strong>{a.expectedValue}</strong>
                          {a.deltaValue ? <> &middot; Écart : <strong>{a.deltaValue}</strong></> : null}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "3px 8px",
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: a.isBlocking ? "#fdecea" : "#fef9e7",
                            color: a.isBlocking ? "#b3202c" : "#b8860b",
                          }}
                        >
                          {a.isBlocking ? "Bloquante" : "Avertissement"}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "#64748b" }} title={stamp(a.detectedAt)}>
                        {stamp(a.detectedAt)}
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "3px 8px",
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: a.status === "OPEN" ? (a.isBlocking ? "#fdecea" : "#fef9e7") : "#e8f7f3",
                            color: a.status === "OPEN" ? (a.isBlocking ? "#b3202c" : "#b8860b") : "#007a5e",
                          }}
                        >
                          {ANOMALY_STATUS_LABELS[a.status]}
                        </span>
                        {/* Resolution metadata only when the record carries it. */}
                        {a.resolvedAt && (
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                            {stamp(a.resolvedAt)}
                            {a.resolvedBy
                              ? ` · ${[a.resolvedBy.firstName, a.resolvedBy.lastName].filter(Boolean).join(" ").trim() || a.resolvedBy.email}`
                              : ""}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {a.status === "OPEN" ? (
                          <button
                            type="button"
                            className="cam-button cam-button-sm cam-button-primary"
                            onClick={() => handleOpenResolveModal(a)}
                            style={{ padding: "3px 10px", fontSize: 12, background: "#007a5e", borderColor: "#007a5e" }}
                          >
                            Résoudre
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#007a5e" }}>Traitée</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ── Modal: Résolution d'Anomalie (Retained Functional Widget) ── */}
      {selectedAnomaly && (
        <AdminDialog
          open={!!selectedAnomaly}
          onClose={() => setSelectedAnomaly(null)}
          eyebrow="Contrôle Qualité &middot; Décision de Levée"
          title={`Résolution de l'anomalie : ${selectedAnomaly.ruleCode}`}
          wide
          footer={
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="cam-button cam-button-secondary"
                onClick={() => setSelectedAnomaly(null)}
                disabled={resolveMutation.isPending}
              >
                Annuler
              </button>
              <button
                type="button"
                className="cam-button cam-button-primary"
                onClick={handleConfirmResolution}
                disabled={resolveMutation.isPending}
                style={{ background: "#007a5e", borderColor: "#007a5e" }}
              >
                {resolveMutation.isPending ? "Enregistrement…" : "Confirmer la Résolution"}
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {actionError && (
              <div role="alert" className="cam-admin-notice cam-admin-notice--error">
                <span>{actionError}</span>
              </div>
            )}

            <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{selectedAnomaly.description}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                {/* A submission with no stored region is reported as such.
                    Printing "National" here would invent a territorial fact on
                    an authorization-sensitive field. */}
                Déclaration : <strong>{anomalyDossierRef(selectedAnomaly)}</strong> &middot; Région : <strong>{selectedAnomaly.submission?.region ?? NOT_PROVIDED}</strong>
              </div>
            </div>

            <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <legend className="cam-admin-label" style={{ padding: 0, marginBottom: 8, fontWeight: 600, color: "#0f172a" }}>
                Mode de résolution administratif
              </legend>

              <label className="cam-admin-choice" style={{ border: "1px solid #e2e8f0", padding: "10px 14px", borderRadius: 8 }}>
                <input
                  type="radio"
                  name="resolution-type"
                  checked={resolutionType === "DECLARANT_CORRECTION"}
                  onChange={() => setResolutionType("DECLARANT_CORRECTION")}
                />
                <span>
                  Correction validée du déclarant
                  <span className="cam-admin-choice-hint" style={{ fontSize: 12, color: "#64748b" }}>
                    Les données ont été vérifiées et mises en conformité suite au retour de révision
                  </span>
                </span>
              </label>

              <label className="cam-admin-choice" style={{ border: "1px solid #e2e8f0", padding: "10px 14px", borderRadius: 8 }}>
                <input
                  type="radio"
                  name="resolution-type"
                  checked={resolutionType === "FIELD_INSPECTION"}
                  onChange={() => setResolutionType("FIELD_INSPECTION")}
                />
                <span>
                  Contrôle physique / Enquête de terrain concluante
                  <span className="cam-admin-choice-hint" style={{ fontSize: 12, color: "#64748b" }}>
                    Un agent ONEFOP assermenté a vérifié la conformité in situ
                  </span>
                </span>
              </label>

              <label className={`cam-admin-choice${!canGrantDerogation ? " is-disabled" : ""}`} style={{ border: "1px solid #e2e8f0", padding: "10px 14px", borderRadius: 8 }}>
                <input
                  type="radio"
                  name="resolution-type"
                  disabled={!canGrantDerogation}
                  checked={resolutionType === "LEGAL_DEROGATION"}
                  onChange={() => setResolutionType("LEGAL_DEROGATION")}
                />
                <span>
                  Dispense légale / Dérogation administrative (WAIVED)
                  <span className="cam-admin-choice-hint" style={{ fontSize: 12, color: "#64748b" }}>
                    Réservée à la Direction Centrale ONEFOP / SuperAdmin National avec visa motivé
                  </span>
                </span>
              </label>
            </fieldset>

            <div className="cam-field">
              <label className="cam-label" htmlFor="resolution-note" style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                Justification administrative &amp; Note d&apos;audit *
              </label>
              <textarea
                id="resolution-note"
                className="cam-textarea"
                rows={3}
                placeholder="Précisez les constatations, références de pièces ou motifs légaux justifiant la résolution de cette anomalie…"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                style={{ fontSize: 13, borderRadius: 6, borderColor: "#cbd5e1" }}
              />
            </div>

            <div className="cam-field">
              <label className="cam-label" htmlFor="evidence-url" style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                Lien de la pièce justificative ou PV d&apos;enquête (optionnel)
              </label>
              <input
                id="evidence-url"
                type="text"
                className="cam-input"
                placeholder="https://... ou réf. archivage"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                style={{ fontSize: 13, borderRadius: 6, borderColor: "#cbd5e1" }}
              />
            </div>
          </div>
        </AdminDialog>
      )}

    </div>
  );
}
