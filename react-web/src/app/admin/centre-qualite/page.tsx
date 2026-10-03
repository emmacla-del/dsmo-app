"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
  type AnomalyRecord,
  type AnomalyResolutionType,
  type AnomalyStatus,
} from "@/lib/anomaly-registry";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataState, DataStateRow } from "@/components/admin/DataState";
import {
  NOT_PROVIDED,
  count,
  elapsedSince,
  resolveDataState,
  stamp,
} from "@/lib/admin-data-state";

const REGISTRY_PAGE_SIZE = 50;

/**
 * Quality indicators the Figma frame shows for this screen.
 *
 * None of them has a backend source: no endpoint computes completeness,
 * coherence, warning or statistical-eligibility rates over a scope
 * (docs/admin-data-integrity-inventory.md §7.4). They are listed here so the
 * screen can name precisely what is missing instead of printing a number.
 *
 * The one rate the system *can* compute —
 * statisticallyReadyCount / totalSubmissionsCount from pilotage/queues — is
 * surfaced on /admin/pilotage, which owns that figure.
 */
const UNSOURCED_QUALITY_KPIS = [
  "Complétude",
  "Cohérence",
  "Taux d'anomalies",
  "Avertissements",
  "Éligibilité statistique",
];

export default function CentreQualitePage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const canReadRegistry = !!role && ANOMALY_REGISTRY_ROLES.includes(role);
  const canGrantDerogation = !!role && ANOMALY_DEROGATION_ROLES.includes(role);

  // Both filters are sent to the server, so `total` always describes the same
  // query as the rows on screen and there is no client-side re-filtering that
  // could make the two disagree.
  const [filterStatus, setFilterStatus] = useState<"ALL" | AnomalyStatus>("ALL");
  const [filterSeverity, setFilterSeverity] = useState<"ALL" | "BLOCKING" | "WARNING">("ALL");

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
  const anomaliesQuery = useQuery({
    queryKey: ["admin", "anomalies", "registry", filterStatus, filterSeverity],
    queryFn: () =>
      listAnomalyRegistry({
        limit: REGISTRY_PAGE_SIZE,
        status: filterStatus === "ALL" ? undefined : filterStatus,
        isBlocking:
          filterSeverity === "BLOCKING" ? true : filterSeverity === "WARNING" ? false : undefined,
      }),
    enabled: canReadRegistry,
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
  const recentDetections = useMemo(() => items.slice(0, 5), [items]);

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

  const scrollToRegistry = () => {
    const el = document.getElementById("registre-anomalies");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="cam-admin-page" style={{ padding: "16px 28px 40px", maxWidth: 1440, margin: "0 auto", background: "#f8fafc" }}>
      {/* ── Top Header matching Figma qualite/centre.png ── */}
      <header style={{ marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          {/* Left: Breadcrumbs + Title */}
          <div>
            <nav aria-label="Fil d'Ariane" style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
              <Link href="/admin/centre-qualite" style={{ color: "#64748b", textDecoration: "none" }}>Contrôle Qualité</Link>
              <span style={{ margin: "0 6px" }}>›</span>
              <span style={{ color: "#1e293b" }}>Centre qualité</span>
            </nav>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "#0f172a", margin: 0 }}>
              Centre de Contrôle de Qualité
            </h1>
          </div>

          {/* Right: Actions Chips & User Tools */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AdminHeaderActions />
          </div>
        </div>

        {/* Sub-navigation Pill Tabs immediately under Title, above the divider */}
        <nav aria-label="Sections du module Contrôle Qualité" style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <Link
            href="/admin/centre-qualite"
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              color: "#007a5e",
              background: "#ffffff",
              border: "1.5px solid #007a5e",
              boxShadow: "0 1px 2px rgba(0, 122, 94, 0.08)",
            }}
          >
            Centre Qualité
          </Link>
          <Link
            href="/admin/files-attente?tab=anomalies"
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              color: "#475569",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
          >
            Anomalies
          </Link>
          <Link
            href="/admin/centre-qualite?tab=regional"
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              color: "#475569",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
          >
            Contrôle régional
          </Link>
        </nav>
      </header>

      {/* ── Toast Alert ── */}
      {successToast && (
        <div role="status" className="cam-admin-notice cam-admin-notice--success" style={{ marginBottom: 20 }}>
          <span>{successToast}</span>
          <button type="button" className="cam-admin-notice-close" onClick={() => setSuccessToast(null)}>×</button>
        </div>
      )}

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
            marginBottom: 16,
          }}
        >
          {UNSOURCED_QUALITY_KPIS.map((label) => (
            <div key={label} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#475569", textTransform: "uppercase" }}>
                {label}
              </span>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#94a3b8", letterSpacing: "-0.02em", margin: "6px 0 0", lineHeight: 1 }}>
                {NOT_PROVIDED}
              </div>
            </div>
          ))}
        </div>

        <DataState
          dense
          state="unavailable"
          resource="les indicateurs de qualité"
          title="Indicateurs non calculés par le système"
          hint={
            <>
              Aucun service ne calcule aujourd&apos;hui ces taux sur un périmètre
              territorial. Le seul indicateur disponible — la part des dossiers
              éligibles au traitement statistique — est publié sur le{" "}
              <Link href="/admin/pilotage" style={{ color: "#007a5e", fontWeight: 600 }}>
                tableau de bord de supervision
              </Link>
              .
            </>
          }
        />
      </section>

      {/* ── Main Content Grid matching Figma qualite/centre.png ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.62fr) minmax(0, 1fr)", gap: 24, alignItems: "start", marginBottom: 32 }}>
        
        {/* ── Left Column: ANOMALIES PAR TYPE & ANOMALIES PAR RÉGION ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Aggregates by anomaly type and by region.
              Nothing serves anomalies grouped by rule family or by region
              (docs/admin-data-integrity-inventory.md §7.3). Deriving either
              from the capped registry page below would state a share of a
              total the page does not contain, so neither table is rendered. */}
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
            <DataState
              state="unavailable"
              resource="les agrégats d'anomalies"
              title="Répartition agrégée non disponible"
              hint="Le système ne publie pas d'agrégat d'anomalies par famille de règle ni par région. Le registre détaillé ci-dessous reste consultable et reflète votre ressort."
            />
          </section>

        </div>

        {/* ── Right Column: détections récentes & référentiel des règles ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Card C: the five most recently detected rows of the same real
              registry. The system keeps no separate "controls performed" log,
              so this is presented as a view of the registry, not as one. */}
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "20px 24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
            aria-labelledby="controles-recents-title"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10 }}>
              <h2 id="controles-recents-title" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: "#0f172a", textTransform: "uppercase", margin: 0 }}>
                DÉTECTIONS RÉCENTES
              </h2>
              <button
                type="button"
                onClick={scrollToRegistry}
                style={{ background: "none", border: "none", padding: 0, fontSize: 13, fontWeight: 600, color: "#007a5e", cursor: "pointer" }}
              >
                Voir le registre →
              </button>
            </div>

            {registryState !== "ready" ? (
              <DataState
                dense
                state={registryState}
                resource="les détections récentes"
                error={anomaliesQuery.error}
                onRetry={() => anomaliesQuery.refetch()}
                title={registryState === "empty" ? "Aucune détection enregistrée" : undefined}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {recentDetections.map((a, idx) => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: idx < recentDetections.length - 1 ? "1px solid #f8fafc" : "none",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: a.isBlocking ? "#dc2626" : "#f59e0b",
                        flexShrink: 0,
                        marginTop: 6,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", lineHeight: 1.35 }}>
                        {a.ruleFamily} — {anomalyDossierRef(a)}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }} title={stamp(a.detectedAt)}>
                        {elapsedSince(a.detectedAt)}
                        {" · "}
                        {ANOMALY_STATUS_LABELS[a.status]}
                      </div>
                      {/* Region badge only when the submission carries one. */}
                      {a.submission?.region && (
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: 4,
                            fontSize: 11,
                            fontWeight: 500,
                            color: "#475569",
                            background: "#f1f5f9",
                            padding: "1px 7px",
                            borderRadius: 4,
                          }}
                        >
                          {a.submission.region}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

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
            <h2 id="regles-validation-title" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: "#0f172a", textTransform: "uppercase", margin: "0 0 16px" }}>
              RÈGLES DE VALIDATION
            </h2>
            <DataState
              dense
              state="unavailable"
              resource="le référentiel des règles"
              title="Référentiel des règles non publié"
              hint="Le système ne conserve pas de référentiel de règles de contrôle ni leur état d'activation. Les codes de règle visibles dans le registre proviennent des anomalies effectivement enregistrées."
            />
          </section>

        </div>

      </div>

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
              onChange={(e) => setFilterStatus(e.target.value as "ALL" | AnomalyStatus)}
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
              onChange={(e) => setFilterSeverity(e.target.value as "ALL" | "BLOCKING" | "WARNING")}
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
