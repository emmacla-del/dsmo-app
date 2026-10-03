"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getPilotageQueues } from "@/lib/api-client";
import {
  anomalyCompanyName,
  anomalyDossierRef,
  listAnomalyRegistry,
  resolveAnomalyRecord,
  type AnomalyRecord,
  type AnomalyResolutionType,
} from "@/lib/anomaly-registry";
import { useAuthStore } from "@/lib/auth-store";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataStateRow } from "@/components/admin/DataState";
import { NOT_PROVIDED, count, resolveDataState } from "@/lib/admin-data-state";

// Roles whose authorised scope genuinely is national (src/common territory
// helpers: territoryWhere returns an unfiltered query for these only).
const NATIONAL_SCOPE_ROLES = [
  "SUPER_ADMIN",
  "SUPER_ADMIN_DSMO",
  "SUPER_ADMIN_ONEFOP",
  "CENTRAL",
];

type QueueTab = "anomalies" | "visas" | "corrections";
const QUEUE_TABS: QueueTab[] = ["anomalies", "visas", "corrections"];

// Suspense because useSearchParams() requires it in the app router.
export default function FilesAttentePage() {
  return (
    <Suspense fallback={null}>
      <FilesAttenteContent />
    </Suspense>
  );
}

function FilesAttenteContent() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  // The dashboard's priority links deep-link here with ?tab=visas|corrections.
  const requestedTab = useSearchParams().get("tab") as QueueTab | null;
  const [activeTab, setActiveTab] = useState<QueueTab>(
    requestedTab && QUEUE_TABS.includes(requestedTab) ? requestedTab : "anomalies",
  );

  useEffect(() => {
    if (requestedTab && QUEUE_TABS.includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyRecord | null>(null);

  // Form state for anomaly resolution
  const [resType, setResType] = useState<AnomalyResolutionType>("FIELD_INSPECTION");
  const [resNote, setResNote] = useState("");
  const [resEvidence, setResEvidence] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues"],
    queryFn: getPilotageQueues,
  });

  /**
   * Source: GET /admin/questionnaires/anomalies/registry
   * ?status=OPEN&isBlocking=true — territory-scoped server-side.
   */
  const anomaliesQuery = useQuery({
    queryKey: ["admin", "anomalies", "open"],
    queryFn: () => listAnomalyRegistry({ status: "OPEN", isBlocking: true, limit: 50 }),
  });

  const resolveMutation = useMutation({
    mutationFn: (payload: { id: string; type: AnomalyResolutionType; note: string; evidenceUrl?: string }) =>
      resolveAnomalyRecord(payload.id, {
        resolutionType: payload.type,
        resolutionNote: payload.note,
        evidenceUrl: payload.evidenceUrl,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "anomalies"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "pilotage", "queues"] });
      setSelectedAnomaly(null);
      setResNote("");
      setResEvidence("");
      setActionError(null);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : "Erreur lors de la résolution de l'anomalie");
    },
  });

  // Real rows only. An empty registry renders an empty state; there is no
  // sample dataset to fall back to.
  const anomalies = anomaliesQuery.data?.items ?? [];

  const anomaliesState = resolveDataState({
    isLoading: anomaliesQuery.isLoading,
    isError: anomaliesQuery.isError,
    error: anomaliesQuery.error,
    rowCount: anomaliesQuery.data?.items.length ?? null,
  });

  /**
   * Queue counters. Source: GET /admin/questionnaires/pilotage/queues,
   * territory-scoped. `null` until the server answers — an unreachable queue
   * is not an empty queue, so the tab badges show an em dash rather than a
   * number the server never gave.
   */
  const queues = queuesQuery.data ?? null;

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnomaly) return;
    if (resNote.trim().length < 10) {
      setActionError("La justification doit comporter au moins 10 caractères.");
      return;
    }
    resolveMutation.mutate({
      id: selectedAnomaly.id,
      type: resType,
      note: resNote,
      evidenceUrl: resEvidence || undefined,
    });
  };

  const tabs: { key: QueueTab; label: string; count: number | null }[] = [
    { key: "anomalies", label: "Anomalies bloquantes", count: queues?.blockingAnomaliesCount ?? null },
    { key: "visas", label: "Visas en instance", count: queues?.pendingNationalVisasCount ?? null },
    { key: "corrections", label: "Corrections demandées", count: queues?.correctionsUnderReviewCount ?? null },
  ];

  const scopeLabel = user?.department
    ? `Département ${user.department}`
    : user?.region
      ? `Délégation ${user.region}`
      : user?.role && NATIONAL_SCOPE_ROLES.includes(user.role)
        ? "Territoire national"
        : "Ressort non affecté";

  const closeResolution = () => {
    setSelectedAnomaly(null);
    setActionError(null);
  };

  return (
    <div className="cam-admin-page">
      <div className="cam-admin-page-toolbar">
        <span className="cam-admin-meta">
          {/* Scope comes from the actor's own stored territory and role. An
              account with no assignment is reported as unassigned, never as
              national: the backend fails such a scope closed. */}
          Ressort : <strong className="cam-admin-strong">{scopeLabel}</strong>
        </span>
      </div>

      <div role="tablist" aria-label="Files de traitement" className="cam-admin-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={`panel-${tab.key}`}
            className="cam-admin-tab"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <span className={`cam-admin-tab-count${tab.key === "anomalies" && (tab.count ?? 0) > 0 ? " is-alert" : ""}`}>
              {count(tab.count)}
            </span>
          </button>
        ))}
      </div>

      {activeTab === "anomalies" && (
        <section className="cam-admin-section" role="tabpanel" id="panel-anomalies" aria-labelledby="tab-anomalies">
          <div className="cam-admin-section-head">
            <div>
              <h2 className="cam-admin-h2">Registre des anomalies bloquantes</h2>
              <p className="cam-admin-meta" style={{ margin: "2px 0 0" }}>
                Ces anomalies excluent le dossier du lot statistique tant qu&apos;elles ne sont pas résolues ou dispensées.
              </p>
            </div>
            <span className="cam-admin-meta">
              {/* Server-reported total for the same filtered query. */}
              {count(anomaliesQuery.data?.total ?? null)} anomalie(s)
            </span>
          </div>
          <div className="cam-table-wrapper">
            <table className="cam-table">
              <thead>
                <tr>
                  <th scope="col">Règle</th>
                  <th scope="col">Établissement</th>
                  <th scope="col">Description</th>
                  <th scope="col">Observé / attendu</th>
                  <th scope="col" className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <DataStateRow
                  colSpan={5}
                  state={anomaliesState}
                  resource="les anomalies bloquantes"
                  error={anomaliesQuery.error}
                  onRetry={() => anomaliesQuery.refetch()}
                  title={anomaliesState === "empty" ? "Aucune anomalie bloquante" : undefined}
                  hint={
                    anomaliesState === "empty"
                      ? "Aucune anomalie ouverte dans votre ressort territorial."
                      : undefined
                  }
                />
                {anomalies.map((a) => (
                  <tr key={a.id}>
                    <td style={{ verticalAlign: "top" }}>
                      <span className="cam-badge cam-badge-error cam-admin-code">{a.ruleCode}</span>
                      <div className="cam-admin-meta" style={{ marginTop: 4 }}>{a.ruleFamily}</div>
                    </td>
                    <td style={{ verticalAlign: "top" }}>
                      {/* Establishment name as stored, or the neutral marker.
                          Never a generic stand-in like "Établissement". */}
                      <div className="cam-admin-strong">{anomalyCompanyName(a) ?? NOT_PROVIDED}</div>
                      <div className="cam-admin-meta">
                        {a.submission?.region ?? NOT_PROVIDED} ·{" "}
                        <span className="cam-admin-code">{anomalyDossierRef(a)}</span>
                      </div>
                    </td>
                    <td style={{ verticalAlign: "top", maxWidth: 360 }}>{a.description}</td>
                    <td style={{ verticalAlign: "top", fontVariantNumeric: "tabular-nums" }}>
                      <div>
                        <span className="cam-admin-muted">Obs. </span>
                        <strong style={{ color: "var(--cam-error)" }}>{a.observedValue}</strong>
                      </div>
                      <div className="cam-admin-muted">Att. {a.expectedValue}</div>
                      {a.deltaValue && <div className="cam-admin-meta">Écart {a.deltaValue}</div>}
                    </td>
                    <td style={{ verticalAlign: "top" }} className="text-right">
                      <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={() => setSelectedAnomaly(a)}>
                        Résoudre
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "visas" && (
        <section className="cam-admin-section" role="tabpanel" id="panel-visas" aria-labelledby="tab-visas">
          <div className="cam-admin-section-head">
            <h2 className="cam-admin-h2">File des visas administratifs</h2>
            <span className="cam-admin-meta">{count(queues?.pendingNationalVisasCount ?? null)} en attente</span>
          </div>
          <div className="cam-admin-section-body" style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)", alignItems: "flex-start" }}>
            <p style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", lineHeight: "var(--cam-line-height-base)" }}>
              Le visa confirme la conformité légale du déclarant. Un dossier visé reste exclu du lot statistique tant
              qu&apos;une anomalie bloquante persiste.
            </p>
            <Link href="/admin/dossiers?status=PENDING_REVIEW" className="cam-button cam-button-primary cam-button-sm">
              Instruire les dossiers en attente de visa →
            </Link>
          </div>
        </section>
      )}

      {activeTab === "corrections" && (
        <section className="cam-admin-section" role="tabpanel" id="panel-corrections" aria-labelledby="tab-corrections">
          <div className="cam-admin-section-head">
            <h2 className="cam-admin-h2">Corrections demandées</h2>
            <span className="cam-admin-meta">{count(queues?.correctionsUnderReviewCount ?? null)} dossier(s)</span>
          </div>
          <div className="cam-admin-section-body" style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)", alignItems: "flex-start" }}>
            <p style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", lineHeight: "var(--cam-line-height-base)" }}>
              Ces déclarations ont été renvoyées aux employeurs avec un motif de non-conformité. Elles reviennent dans la
              file dès leur nouvelle soumission.
            </p>
            <Link href="/admin/dossiers?status=CORRECTION_REQUESTED" className="cam-button cam-button-secondary cam-button-sm">
              Voir les dossiers en correction →
            </Link>
          </div>
        </section>
      )}

      <AdminDialog
        open={!!selectedAnomaly}
        onClose={closeResolution}
        eyebrow="Résolution formelle"
        title={selectedAnomaly ? <>Anomalie <span className="cam-admin-code">{selectedAnomaly.ruleCode}</span></> : ""}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={closeResolution}>
              Annuler
            </button>
            <button type="submit" form="resolve-form" className="cam-button cam-button-primary cam-button-sm" disabled={resolveMutation.isPending}>
              {resolveMutation.isPending ? "Enregistrement…" : "Confirmer la résolution"}
            </button>
          </>
        }
      >
        {selectedAnomaly && (
          <form id="resolve-form" onSubmit={handleResolveSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
            <div className="cam-admin-notice cam-admin-notice--error">
              <div>
                <strong>{selectedAnomaly.description}</strong>
                <div className="cam-admin-meta" style={{ marginTop: 4 }}>
                  Observé : <span className="cam-admin-code">{selectedAnomaly.observedValue}</span> · Attendu :{" "}
                  <span className="cam-admin-code">{selectedAnomaly.expectedValue}</span>
                </div>
              </div>
            </div>

            {actionError && (
              <div role="alert" className="cam-admin-notice cam-admin-notice--error">
                <span>{actionError}</span>
              </div>
            )}

            <div className="cam-field" style={{ margin: 0 }}>
              <label className="cam-admin-label" htmlFor="res-type">Mode de résolution</label>
              <select id="res-type" className="cam-select" value={resType} onChange={(e) => setResType(e.target.value as typeof resType)}>
                <option value="FIELD_INSPECTION">Contrôle sur pièces / enquête téléphonique (PV d&apos;inspection)</option>
                <option value="DECLARANT_CORRECTION">Correction confirmée par l&apos;employeur</option>
                <option value="LEGAL_DEROGATION">Dispense légale / dérogation ministérielle (Central uniquement)</option>
              </select>
              {resType === "LEGAL_DEROGATION" && (
                <span className="cam-admin-meta" style={{ color: "var(--cam-error)" }}>
                  Seule la Direction centrale ONEFOP peut accorder une dispense légale.
                </span>
              )}
            </div>

            <div className="cam-field" style={{ margin: 0 }}>
              <label className="cam-admin-label" htmlFor="res-note">Justification détaillée</label>
              <textarea
                id="res-note"
                className="cam-admin-textarea"
                value={resNote}
                onChange={(e) => setResNote(e.target.value)}
                rows={3}
                required
                aria-describedby="res-note-hint"
              />
              <span id="res-note-hint" className="cam-admin-meta">10 caractères minimum.</span>
            </div>

            <div className="cam-field" style={{ margin: 0 }}>
              <label className="cam-admin-label" htmlFor="res-evidence">
                Lien vers la pièce justificative <span className="cam-admin-muted">(facultatif)</span>
              </label>
              <input id="res-evidence" type="url" className="cam-input" value={resEvidence} onChange={(e) => setResEvidence(e.target.value)} />
            </div>
          </form>
        )}
      </AdminDialog>
    </div>
  );
}
