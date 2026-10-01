"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { listAnomaliesRegistry, resolveAnomaly } from "@/lib/api-client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";

const REGISTRY_ROLES = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "CENTRAL", "REGIONAL", "DIVISIONAL"];
const DEROGATION_ROLES = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "CENTRAL"];

interface AnomalyItem {
  id: string;
  ruleCode: string;
  ruleFamily?: string;
  description: string;
  observedValue?: string;
  expectedValue?: string;
  status: "OPEN" | "RESOLVED" | "WAIVED";
  isBlocking: boolean;
  detectedAt: string;
  submission: { id: string; submissionId: string | null; region: string | null; companyName?: string } | null;
}

// Canonical ONEFOP Quality Rules Reference
const VALIDATION_RULES = [
  {
    code: "R1-EFFECTIFS",
    name: "Égalité Effectif Total = Hommes + Femmes",
    family: "Cohérence interne",
    severity: "CRITICAL",
    isBlocking: true,
    section: "Section 2 (Effectifs)",
    status: "ACTIVE",
  },
  {
    code: "R2-IDENTIFIANT",
    name: "Validité Identifiant Fiscal / RCCM",
    family: "Identification légale",
    severity: "CRITICAL",
    isBlocking: true,
    section: "Section 1 (Entreprise)",
    status: "ACTIVE",
  },
  {
    code: "R3-DEPARTS",
    name: "Départs Annuels Déclarés ≤ Effectif Global",
    family: "Plausibilité des flux",
    severity: "CRITICAL",
    isBlocking: true,
    section: "Section 2 (Mouvements)",
    status: "ACTIVE",
  },
  {
    code: "R4-CNAE",
    name: "Secteur d'activité CNAE valide et renseigné",
    family: "Nomenclature",
    severity: "CRITICAL",
    isBlocking: true,
    section: "Section 1 (Activité)",
    status: "ACTIVE",
  },
  {
    code: "R5-SALAIRES",
    name: "Masse salariale proportionnée aux effectifs",
    family: "Vraisemblance économique",
    severity: "WARNING",
    isBlocking: false,
    section: "Section 2 (Salaires)",
    status: "ACTIVE",
  },
  {
    code: "R6-COMPETENCES",
    name: "Besoins futurs en compétences qualifiés",
    family: "Complétude prospective",
    severity: "WARNING",
    isBlocking: false,
    section: "Section 3 (Besoins)",
    status: "ACTIVE",
  },
];

function stamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function CentreQualitePage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const canReadRegistry = !!role && REGISTRY_ROLES.includes(role);
  const canGrantDerogation = !!role && DEROGATION_ROLES.includes(role);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");

  // Selected anomaly for resolution modal
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyItem | null>(null);
  const [resolutionType, setResolutionType] = useState<"DECLARANT_CORRECTION" | "FIELD_INSPECTION" | "LEGAL_DEROGATION">("DECLARANT_CORRECTION");
  const [resolutionNote, setResolutionNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Query registry
  const anomaliesQuery = useQuery({
    queryKey: ["admin", "anomalies", "registry", filterStatus, filterSeverity],
    queryFn: () => {
      const params: Record<string, any> = { limit: 100 };
      if (filterStatus !== "ALL") params.status = filterStatus;
      if (filterSeverity === "BLOCKING") params.isBlocking = true;
      if (filterSeverity === "WARNING") params.isBlocking = false;
      return listAnomaliesRegistry(params);
    },
    enabled: canReadRegistry,
  });

  const items = (anomaliesQuery.data?.items ?? []) as AnomalyItem[];
  const totalCount = anomaliesQuery.data?.total ?? items.length;

  // Mutation to resolve anomaly
  const resolveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: { resolutionType: string; resolutionNote: string; evidenceUrl?: string } }) => {
      return resolveAnomaly(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "anomalies"] });
      setSelectedAnomaly(null);
      setResolutionNote("");
      setEvidenceUrl("");
      setActionError(null);
      setSuccessToast("L'anomalie a été résolue avec succès et consignée au journal d'audit.");
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      setActionError(err.message || "Erreur lors de la résolution de l'anomalie.");
    },
  });

  // Calculate Aggregates
  const stats = useMemo(() => {
    let openBlocking = 0;
    let openWarning = 0;
    let resolvedCount = 0;

    const byType: Record<string, number> = {};
    const byRegion: Record<string, { total: number; blocking: number }> = {};

    items.forEach((item) => {
      if (item.status === "OPEN") {
        if (item.isBlocking) openBlocking++;
        else openWarning++;
      } else {
        resolvedCount++;
      }

      // Group by rule / family
      const typeKey = item.ruleFamily || item.ruleCode || "Autre contrôle";
      byType[typeKey] = (byType[typeKey] || 0) + 1;

      // Group by region
      const reg = item.submission?.region || "Non renseignée";
      if (!byRegion[reg]) byRegion[reg] = { total: 0, blocking: 0 };
      byRegion[reg].total++;
      if (item.isBlocking && item.status === "OPEN") {
        byRegion[reg].blocking++;
      }
    });

    const complianceRate = totalCount > 0
      ? (((totalCount - openBlocking) / totalCount) * 100).toFixed(1)
      : "100.0";

    return {
      openBlocking,
      openWarning,
      resolvedCount,
      complianceRate,
      byType: Object.entries(byType).sort((a, b) => b[1] - a[1]),
      byRegion: Object.entries(byRegion).sort((a, b) => b[1].total - a[1].total),
    };
  }, [items, totalCount]);

  const handleOpenResolveModal = (a: AnomalyItem) => {
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
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Données" }, { label: "Centre de Contrôle de Qualité" }]}
        title="Centre de Contrôle de Qualité"
        actions={<AdminHeaderActions />}
      />

      {successToast && (
        <div role="status" className="cam-admin-notice cam-admin-notice--success">
          <span>{successToast}</span>
          <button type="button" className="cam-admin-notice-close" onClick={() => setSuccessToast(null)}>×</button>
        </div>
      )}

      {/* KPI Cards — Figma qualite/centre.png */}
      <div className="cam-pilot-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="cam-pilot-kpi">
          <span className="cam-admin-meta" style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.04em", fontWeight: 600 }}>Total Anomalies Détectées</span>
          <div className="cam-pilot-kpi-value">{anomaliesQuery.isLoading ? "…" : totalCount}</div>
          <div className="cam-admin-meta" style={{ color: "var(--cam-text-muted)" }}>Sur l&apos;ensemble du périmètre</div>
        </div>

        <div className="cam-pilot-kpi">
          <span className="cam-admin-meta" style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.04em", fontWeight: 600 }}>Anomalies Bloquantes</span>
          <div className="cam-pilot-kpi-value" style={{ color: "#dc2626" }}>
            {anomaliesQuery.isLoading ? "…" : stats.openBlocking}
          </div>
          <div className="cam-admin-meta" style={{ color: "#dc2626", fontWeight: 500 }}>Empêchent la délivrance du visa</div>
        </div>

        <div className="cam-pilot-kpi">
          <span className="cam-admin-meta" style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.04em", fontWeight: 600 }}>Avertissements Consultatifs</span>
          <div className="cam-pilot-kpi-value" style={{ color: "#d97706" }}>
            {anomaliesQuery.isLoading ? "…" : stats.openWarning}
          </div>
          <div className="cam-admin-meta" style={{ color: "#d97706", fontWeight: 500 }}>Non bloquants pour le visa</div>
        </div>

        <div className="cam-pilot-kpi">
          <span className="cam-admin-meta" style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.04em", fontWeight: 600 }}>Anomalies Résolues</span>
          <div className="cam-pilot-kpi-value" style={{ color: "var(--cam-green)" }}>
            {anomaliesQuery.isLoading ? "…" : stats.resolvedCount}
          </div>
          <div className="cam-admin-meta" style={{ color: "var(--cam-green)", fontWeight: 500 }}>Traitées ou dispensées</div>
        </div>

        <div className="cam-pilot-kpi">
          <span className="cam-admin-meta" style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.04em", fontWeight: 600 }}>Taux de Conformité</span>
          <div className="cam-pilot-kpi-value" style={{ color: "var(--cam-green)" }}>
            {anomaliesQuery.isLoading ? "…" : `${stats.complianceRate}%`}
          </div>
          <div className="cam-admin-meta" style={{ color: "var(--cam-green)", fontWeight: 500 }}>Éligibilité statistique</div>
        </div>
      </div>

      {/* Two Columns: Visual Aggregates (Left) & Validation Rules (Right) */}
      <div style={{ display: "flex", gap: "var(--cam-space-5)", alignItems: "flex-start", flexWrap: "wrap" }}>
        
        {/* Left Column: Anomalies par Type & Anomalies par Région */}
        <div style={{ flex: "3 1 540px", minWidth: 320, display: "flex", flexDirection: "column", gap: "var(--cam-space-5)" }}>
          
          {/* Anomalies par Type */}
          <section className="cam-admin-section" aria-labelledby="anomalies-by-type-title">
            <div className="cam-admin-section-head">
              <h2 className="cam-admin-h2" id="anomalies-by-type-title">Anomalies par Type de Règle</h2>
            </div>
            <div className="cam-admin-section-body">
              {stats.byType.length === 0 ? (
                <div style={{ color: "var(--cam-text-muted)", fontSize: "0.875rem" }}>
                  {anomaliesQuery.isLoading ? "Calcul des agrégats…" : "Aucune anomalie enregistrée pour ces critères."}
                </div>
              ) : (
                <div className="cam-pilot-hbars">
                  {stats.byType.map(([name, count]) => {
                    const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                    return (
                      <div key={name} className="cam-pilot-hbar">
                        <span style={{ minWidth: 160, fontSize: "0.8125rem", color: "var(--cam-text)" }}>{name}</span>
                        <div className="cam-pilot-hbar-track" style={{ flex: 1 }}>
                          <div className="cam-pilot-hbar-fill" style={{ width: `${pct}%`, background: "var(--cam-primary)" }} />
                        </div>
                        <span className="cam-admin-meta" style={{ minWidth: 50, textAlign: "right", fontWeight: 600 }}>
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Anomalies par Région */}
          <section className="cam-admin-section" aria-labelledby="anomalies-by-region-title">
            <div className="cam-admin-section-head">
              <h2 className="cam-admin-h2" id="anomalies-by-region-title">Ventilation Territoriale des Anomalies</h2>
            </div>
            <div className="cam-admin-section-body">
              {stats.byRegion.length === 0 ? (
                <div style={{ color: "var(--cam-text-muted)", fontSize: "0.875rem" }}>
                  {anomaliesQuery.isLoading ? "Chargement…" : "Aucune donnée régionale disponible."}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--cam-space-3)" }}>
                  {stats.byRegion.map(([regionName, regStat]) => {
                    const isCritical = regStat.blocking >= 3;
                    return (
                      <div key={regionName} style={{ border: "1px solid var(--cam-border)", borderRadius: "8px", padding: "0.75rem", background: "var(--cam-surface-card)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{regionName}</span>
                          <span
                            className="cam-pilot-badge"
                            style={{
                              background: isCritical ? "#fdecea" : "#fef9e7",
                              color: isCritical ? "#b3202c" : "#b8860b",
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                            }}
                          >
                            {isCritical ? "CRITIQUE" : "MODÉRÉ"}
                          </span>
                        </div>
                        <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--cam-text)" }}>
                          {regStat.total} {regStat.total > 1 ? "anomalies" : "anomalie"}
                        </div>
                        <div className="cam-admin-meta" style={{ fontSize: "0.75rem", color: regStat.blocking > 0 ? "#dc2626" : "var(--cam-text-muted)" }}>
                          {regStat.blocking} bloquante{regStat.blocking > 1 ? "s" : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

        </div>

        {/* Right Column: Référentiel des Règles de Validation */}
        <div style={{ flex: "2 1 380px", minWidth: 320, display: "flex", flexDirection: "column", gap: "var(--cam-space-5)" }}>
          <section className="cam-admin-section" aria-labelledby="qc-rules-title">
            <div className="cam-admin-section-head">
              <h2 className="cam-admin-h2" id="qc-rules-title">Règles de Contrôle Qualité</h2>
            </div>
            <div className="cam-admin-section-body" style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
              <p className="cam-admin-meta" style={{ margin: 0 }}>
                Règles de validation actives et opposables conformément au cadre réglementaire ONEFOP.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
                {VALIDATION_RULES.map((rule) => (
                  <div
                    key={rule.code}
                    style={{
                      padding: "0.625rem 0.75rem",
                      borderRadius: "6px",
                      background: "var(--cam-surface-subtle)",
                      borderLeft: `4px solid ${rule.isBlocking ? "#dc2626" : "#d97706"}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "0.75rem", fontWeight: 700, color: "var(--cam-text)" }}>
                        {rule.code}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          color: rule.isBlocking ? "#dc2626" : "#d97706",
                        }}
                      >
                        {rule.isBlocking ? "BLOQUANTE" : "AVERTISSEMENT"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 500, marginTop: "2px", color: "var(--cam-text)" }}>
                      {rule.name}
                    </div>
                    <div className="cam-admin-meta" style={{ fontSize: "0.75rem", marginTop: "2px" }}>
                      {rule.section} &middot; {rule.family}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

      </div>

      {/* Bottom: Registre Détaillé des Anomalies & Actions */}
      <section className="cam-admin-section" aria-labelledby="anomalies-registry-title">
        <div className="cam-admin-section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--cam-space-3)" }}>
          <h2 className="cam-admin-h2" id="anomalies-registry-title">
            Registre des Contrôles &amp; Anomalies ({totalCount})
          </h2>
          <div style={{ display: "flex", gap: "var(--cam-space-3)", alignItems: "center", flexWrap: "wrap" }}>
            <select
              className="cam-select"
              style={{ width: "auto", minWidth: 150, height: 34, fontSize: "0.8125rem" }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">Tous statuts</option>
              <option value="OPEN">Ouvertes</option>
              <option value="RESOLVED">Résolues</option>
              <option value="WAIVED">Dispensées (Dérogations)</option>
            </select>
            <select
              className="cam-select"
              style={{ width: "auto", minWidth: 160, height: 34, fontSize: "0.8125rem" }}
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
            >
              <option value="ALL">Toutes sévérités</option>
              <option value="BLOCKING">Bloquantes uniquement</option>
              <option value="WARNING">Avertissements uniquement</option>
            </select>
            <button
              type="button"
              className="cam-button cam-button-sm cam-button-secondary"
              onClick={() => anomaliesQuery.refetch()}
            >
              Actualiser
            </button>
          </div>
        </div>

        <div className="cam-table-wrapper">
          <table className="cam-table">
            <thead>
              <tr>
                <th>Déclaration / Dossier</th>
                <th>Règle &amp; Code</th>
                <th>Description de l&apos;Anomalie</th>
                <th>Sévérité</th>
                <th>Détectée le</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "var(--cam-space-6)", color: "var(--cam-text-muted)" }}>
                    {anomaliesQuery.isLoading ? "Chargement des anomalies…" : "Aucune anomalie ne correspond aux filtres."}
                  </td>
                </tr>
              ) : (
                items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.submission ? (
                        <div>
                          <Link href={`/admin/dossiers/${a.submission.id}`} style={{ fontWeight: 600, color: "var(--cam-primary)", textDecoration: "underline" }}>
                            {a.submission.submissionId || "Dossier #" + a.submission.id.slice(0, 8)}
                          </Link>
                          {a.submission.region && (
                            <div className="cam-admin-meta" style={{ fontSize: "0.75rem" }}>
                              {a.submission.region}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="cam-admin-meta">—</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: "0.8125rem", fontWeight: 600 }}>
                        {a.ruleCode}
                      </span>
                      {a.ruleFamily && (
                        <div className="cam-admin-meta" style={{ fontSize: "0.75rem" }}>
                          {a.ruleFamily}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ maxWidth: 360, wordBreak: "break-word" }}>{a.description}</div>
                      {(a.observedValue || a.expectedValue) && (
                        <div className="cam-admin-meta" style={{ fontSize: "0.75rem", marginTop: "2px" }}>
                          Observé : <strong>{a.observedValue ?? "—"}</strong> &middot; Attendu : <strong>{a.expectedValue ?? "—"}</strong>
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className="cam-pilot-badge"
                        style={{
                          background: a.isBlocking ? "#fdecea" : "#fef9e7",
                          color: a.isBlocking ? "#b3202c" : "#b8860b",
                        }}
                      >
                        {a.isBlocking ? "Bloquante" : "Avertissement"}
                      </span>
                    </td>
                    <td>
                      <span className="cam-admin-meta">{stamp(a.detectedAt)}</span>
                    </td>
                    <td>
                      <span
                        className="cam-pilot-badge"
                        style={{
                          background: a.status === "OPEN" ? (a.isBlocking ? "#fdecea" : "#fef9e7") : "#e8f7f3",
                          color: a.status === "OPEN" ? (a.isBlocking ? "#b3202c" : "#b8860b") : "#007a5e",
                        }}
                      >
                        {a.status === "OPEN" ? "Ouverte" : a.status === "RESOLVED" ? "Résolue" : "Dispensée"}
                      </span>
                    </td>
                    <td>
                      {a.status === "OPEN" ? (
                        <button
                          type="button"
                          className="cam-button cam-button-sm cam-button-primary"
                          onClick={() => handleOpenResolveModal(a)}
                          style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
                        >
                          Résoudre
                        </button>
                      ) : (
                        <span className="cam-admin-meta" style={{ color: "var(--cam-success)" }}>
                          Traitée
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal: Résolution d'Anomalie */}
      {selectedAnomaly && (
        <AdminDialog
          open={!!selectedAnomaly}
          onClose={() => setSelectedAnomaly(null)}
          eyebrow="Contrôle Qualité &middot; Décision de Levée"
          title={`Résolution de l'anomalie : ${selectedAnomaly.ruleCode}`}
          wide
          footer={
            <div style={{ display: "flex", gap: "var(--cam-space-3)", justifyContent: "flex-end" }}>
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
              >
                {resolveMutation.isPending ? "Enregistrement…" : "Confirmer la Résolution"}
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
            {actionError && (
              <div role="alert" className="cam-admin-notice cam-admin-notice--error">
                <span>{actionError}</span>
              </div>
            )}

            <div style={{ background: "var(--cam-surface-subtle)", padding: "0.75rem 1rem", borderRadius: "6px" }}>
              <div style={{ fontWeight: 600, color: "var(--cam-text)" }}>{selectedAnomaly.description}</div>
              <div className="cam-admin-meta" style={{ marginTop: "4px" }}>
                Déclaration : <strong>{selectedAnomaly.submission?.submissionId || selectedAnomaly.submission?.id}</strong> &middot; Région : <strong>{selectedAnomaly.submission?.region || "National"}</strong>
              </div>
            </div>

            <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
              <legend className="cam-admin-label" style={{ padding: 0, marginBottom: "var(--cam-space-2)" }}>
                Mode de résolution administratif
              </legend>

              <label className="cam-admin-choice">
                <input
                  type="radio"
                  name="resolution-type"
                  checked={resolutionType === "DECLARANT_CORRECTION"}
                  onChange={() => setResolutionType("DECLARANT_CORRECTION")}
                />
                <span>
                  Correction validée du déclarant
                  <span className="cam-admin-choice-hint">Les données ont été vérifiées et mises en conformité suite au retour de révision</span>
                </span>
              </label>

              <label className="cam-admin-choice">
                <input
                  type="radio"
                  name="resolution-type"
                  checked={resolutionType === "FIELD_INSPECTION"}
                  onChange={() => setResolutionType("FIELD_INSPECTION")}
                />
                <span>
                  Contrôle physique / Enquête de terrain concluante
                  <span className="cam-admin-choice-hint">Un agent ONEFOP assermenté a vérifié la conformité in situ</span>
                </span>
              </label>

              <label className={`cam-admin-choice${!canGrantDerogation ? " is-disabled" : ""}`}>
                <input
                  type="radio"
                  name="resolution-type"
                  disabled={!canGrantDerogation}
                  checked={resolutionType === "LEGAL_DEROGATION"}
                  onChange={() => setResolutionType("LEGAL_DEROGATION")}
                />
                <span>
                  Dispense légale / Dérogation administrative (WAIVED)
                  <span className="cam-admin-choice-hint">
                    Réservée à la Direction Centrale ONEFOP / SuperAdmin National avec visa motivé
                  </span>
                </span>
              </label>
            </fieldset>

            <div className="cam-field">
              <label className="cam-label" htmlFor="resolution-note">
                Justification administrative &amp; Note d&apos;audit *
              </label>
              <textarea
                id="resolution-note"
                className="cam-textarea"
                rows={3}
                placeholder="Précisez les constatations, références de pièces ou motifs légaux justifiant la résolution de cette anomalie…"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
              />
            </div>

            <div className="cam-field">
              <label className="cam-label" htmlFor="evidence-url">
                Lien de la pièce justificative ou PV d&apos;enquête (optionnel)
              </label>
              <input
                id="evidence-url"
                type="text"
                className="cam-input"
                placeholder="https://... ou réf. archivage"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
              />
            </div>
          </div>
        </AdminDialog>
      )}
    </div>
  );
}
