"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { getPilotageQueues } from "@/lib/api-client";
import {
  AUDIT_ACTIONS,
  auditActionLabel,
  auditActionTone,
  auditActorName,
  auditDetailsSummary,
  auditResourceLabel,
  listAuditLog,
} from "@/lib/audit-log";
import {
  ANOMALY_REGISTRY_ROLES,
  anomalyCompanyName,
  anomalyDossierRef,
  listAnomalyRegistry,
} from "@/lib/anomaly-registry";
import { AUDIT_ROLES, hasRole } from "@/lib/roles";
import { directoryRoleLabel } from "@/lib/user-directory";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { DataState } from "@/components/admin/DataState";
import {
  NOT_PROVIDED,
  count,
  elapsedSince,
  resolveDataState,
  shortStamp,
  stamp,
} from "@/lib/admin-data-state";

const EVENT_PAGE_SIZE = 25;
const ALERT_PAGE_SIZE = 20;

const CARD: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
};

const SELECT: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  fontSize: 13,
  background: "#ffffff",
};

const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "#6b7280",
  textTransform: "uppercase",
  marginBottom: 6,
};

/**
 * One KPI tile.
 *
 * `value` is `null` whenever the figure has not been retrieved — it then
 * renders as an em dash. A zero is rendered as "0", because zero is an answer.
 */
function Kpi({
  label,
  value,
  accent,
  note,
}: {
  label: string;
  value: number | null;
  accent: string;
  note: string;
}) {
  return (
    <div style={{ ...CARD, borderLeft: `4px solid ${accent}`, padding: "16px 20px" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#111827", marginTop: 4 }}>
        {count(value)}
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, fontWeight: 500 }}>{note}</div>
    </div>
  );
}

function ActiviteContent() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  const canReadAudit = hasRole(role, AUDIT_ROLES);
  const canReadAnomalies = hasRole(role, ANOMALY_REGISTRY_ROLES);

  // Filters. `action` and `period` are sent to the server; nothing is filtered
  // client-side, so the counts shown always match the query that produced them.
  const [period, setPeriod] = useState("7d");
  const [action, setAction] = useState("");

  /**
   * Work-queue counters.
   *
   * Source: GET /admin/questionnaires/pilotage/queues
   * (EligibilityEngineService.getPilotageQueues). Every figure is a Prisma
   * count/groupBy over `territoryWhere(territory)`, so a REGIONAL_ADMIN or
   * DIVISIONAL_ADMIN actor sees only its own ressort. Drafts are excluded server-side.
   *
   * On error the figures stay `null` rather than falling back to 0 or to a
   * national number: an unreachable queue is not an empty queue.
   */
  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues"],
    queryFn: getPilotageQueues,
  });
  const queues = queuesQuery.data ?? null;

  /**
   * Event journal.
   *
   * Source: GET /audit/reports?paginate=true — stored AuditLog rows, newest
   * first. This is the only record of who did what in the system; there is no
   * second source and no fallback. Readable by super-admins and auditors only,
   * which is why the panel reports an authorization state for other roles
   * instead of inventing a feed.
   */
  const auditQuery = useQuery({
    queryKey: ["admin", "activite", "audit", { period, action }],
    queryFn: () =>
      listAuditLog({
        period: period === "all" ? undefined : period,
        action: action || undefined,
        limit: EVENT_PAGE_SIZE,
        offset: 0,
      }),
    enabled: canReadAudit,
  });

  /**
   * Priority alerts.
   *
   * Source: GET /admin/questionnaires/anomalies/registry?status=OPEN&isBlocking=true
   * — territory-scoped open blocking anomalies, newest detection first. Ageing
   * is derived from each row's stored `detectedAt`, never from a literal.
   */
  const alertsQuery = useQuery({
    queryKey: ["admin", "activite", "alerts"],
    queryFn: () => listAnomalyRegistry({ status: "OPEN", isBlocking: true, limit: ALERT_PAGE_SIZE }),
    enabled: canReadAnomalies,
  });

  const events = useMemo(() => {
    const items = auditQuery.data?.items ?? [];
    return items.map((e) => {
      const tone = auditActionTone(e.action);
      return {
        id: e.id,
        iso: e.timestamp,
        actor: auditActorName(e),
        actorRole: e.user ? directoryRoleLabel(e.user.role) : null,
        action: auditActionLabel(e.action),
        tone,
        resource: e.resourceId ?? auditResourceLabel(e.resourceType),
        resourceType: e.resourceType,
        details: auditDetailsSummary(e),
      };
    });
  }, [auditQuery.data]);

  const eventsState = resolveDataState({
    roleAllowed: canReadAudit,
    isLoading: auditQuery.isLoading,
    isError: auditQuery.isError,
    error: auditQuery.error,
    rowCount: auditQuery.data?.items.length ?? null,
  });

  const alerts = alertsQuery.data?.items ?? [];
  const alertsState = resolveDataState({
    roleAllowed: canReadAnomalies,
    isLoading: alertsQuery.isLoading,
    isError: alertsQuery.isError,
    error: alertsQuery.error,
    rowCount: alertsQuery.data?.items.length ?? null,
  });

  const eventTotal = auditQuery.data?.total ?? null;

  return (
    <div className="cam-admin-page" style={{ maxWidth: 1440, margin: "0 auto" }}>
      <AdminPageHeader
        breadcrumb={[{ label: "Supervision" }, { label: "Activité & alertes" }]}
        title="Activité Récente & Alertes"
        subtitle="Traçabilité des opérations d'instruction, journal d'événements et alertes de contrôle"
        actions={<AdminHeaderActions />}
      />

      {/* ── Work-queue counters, all from pilotage/queues ── */}
      {queuesQuery.isError ? (
        <div style={{ marginBottom: 24 }}>
          <DataState
            state="error"
            resource="les compteurs de supervision"
            error={queuesQuery.error}
            onRetry={() => queuesQuery.refetch()}
            hint="Les compteurs ne sont pas affichés tant que le serveur ne les a pas fournis."
          />
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <Kpi
            label="Anomalies bloquantes ouvertes"
            value={queues?.blockingAnomaliesCount ?? null}
            accent="#dc2626"
            note="Dans votre ressort"
          />
          <Kpi
            label="Dossiers en instance"
            value={queues?.pendingNationalVisasCount ?? null}
            accent="#f59e0b"
            note="En attente de visa administratif"
          />
          <Kpi
            label="Corrections en cours"
            value={queues?.correctionsUnderReviewCount ?? null}
            accent="#3b82f6"
            note="Chez les déclarants"
          />
          <Kpi
            label="Dossiers visés"
            value={queues?.approvedCount ?? null}
            accent="#1e6b3a"
            note="Visa administratif accordé"
          />
        </div>
      )}

      {/* ── Filters. Both are applied server-side on /audit/reports. ── */}
      <section style={{ ...CARD, padding: "16px 20px", marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div>
            <label htmlFor="act-period" style={LABEL}>Période</label>
            <select id="act-period" value={period} onChange={(e) => setPeriod(e.target.value)} style={SELECT}>
              <option value="7d">7 derniers jours</option>
              <option value="30d">30 derniers jours</option>
              <option value="3m">3 derniers mois</option>
              <option value="12m">12 derniers mois</option>
              <option value="all">Toutes les dates</option>
            </select>
          </div>
          <div>
            <label htmlFor="act-action" style={LABEL}>Type d&apos;événement</label>
            <select id="act-action" value={action} onChange={(e) => setAction(e.target.value)} style={SELECT}>
              <option value="">Tous les types</option>
              {/* Only actions the backend actually writes. */}
              {Object.entries(AUDIT_ACTIONS).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "start" }}>
        {/* ── Event journal ── */}
        <section style={{ ...CARD, overflow: "hidden" }}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
              Journal des Événements Récents
            </h2>
            {/* Server-reported count for the same filtered query. */}
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {eventsState === "ready" && eventTotal !== null
                ? `${count(events.length)} affiché(s) sur ${count(eventTotal)}`
                : NOT_PROVIDED}
            </span>
          </div>

          {eventsState !== "ready" ? (
            <div style={{ padding: 20 }}>
              <DataState
                state={eventsState}
                resource="le journal d'événements"
                error={auditQuery.error}
                onRetry={() => auditQuery.refetch()}
                title={
                  eventsState === "forbidden"
                    ? "Journal d'audit non accessible à votre rôle"
                    : eventsState === "empty"
                      ? "Aucun événement enregistré"
                      : undefined
                }
                hint={
                  eventsState === "forbidden"
                    ? "Le journal d'audit systémique est réservé aux super-administrateurs et aux auditeurs. Les alertes de contrôle de votre ressort restent affichées ci-contre."
                    : eventsState === "empty"
                      ? "Aucun événement consigné sur la période sélectionnée. Les opérations d'instruction apparaîtront ici dès qu'elles seront enregistrées."
                      : undefined
                }
              />
            </div>
          ) : (
            <div style={{ padding: "8px 0" }}>
              {events.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                    padding: "14px 20px",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  {/* Both lines derive from the entry's stored timestamp. */}
                  <div style={{ textAlign: "center", width: 56, flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                      {shortStamp(ev.iso)}
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }} title={stamp(ev.iso)}>
                      {elapsedSince(ev.iso)}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{ev.actor}</span>
                      {/* Role shown only when the entry carries a user record. */}
                      {ev.actorRole && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 9999,
                            background: "#f3f4f6",
                            color: "#4b5563",
                            fontWeight: 500,
                          }}
                        >
                          {ev.actorRole}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          background:
                            ev.tone === "error" ? "#fef2f2"
                              : ev.tone === "success" ? "#ecfdf5"
                                : ev.tone === "warning" ? "#fffbeb"
                                  : "#eff6ff",
                          color:
                            ev.tone === "error" ? "#dc2626"
                              : ev.tone === "success" ? "#16a34a"
                                : ev.tone === "warning" ? "#d97706"
                                  : "#2563eb",
                        }}
                      >
                        {ev.action}
                      </span>
                    </div>

                    <p style={{ margin: "2px 0 6px", fontSize: 13, color: "#4b5563", lineHeight: 1.4 }}>
                      {ev.details}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      {/* Deep link only for resource types that have a page.
                          Other types show the identifier without pretending a
                          dossier exists behind it. */}
                      {ev.resourceType === "OnefopSubmission" ? (
                        <Link
                          href={`/admin/dossiers/${encodeURIComponent(ev.resource)}`}
                          style={{ fontSize: 12, fontWeight: 600, color: "#1e6b3a", textDecoration: "none" }}
                        >
                          Dossier {ev.resource} →
                        </Link>
                      ) : (
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          {auditResourceLabel(ev.resourceType)} · {ev.resource}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Priority alerts ── */}
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...CARD, padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626" }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
                  Alertes de Contrôle Prioritaires
                </h2>
              </div>
              {alertsState === "ready" && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: "#fee2e2",
                    color: "#dc2626",
                    padding: "2px 8px",
                    borderRadius: 9999,
                  }}
                >
                  {count(alertsQuery.data?.total ?? null)} ouverte(s)
                </span>
              )}
            </div>

            {alertsState !== "ready" ? (
              <DataState
                dense
                state={alertsState}
                resource="les alertes de contrôle"
                error={alertsQuery.error}
                onRetry={() => alertsQuery.refetch()}
                title={
                  alertsState === "empty"
                    ? "Aucune anomalie bloquante enregistrée"
                    : alertsState === "forbidden"
                      ? "Registre d'anomalies non accessible à votre rôle"
                      : undefined
                }
                hint={
                  alertsState === "empty"
                    ? "Aucune anomalie bloquante ouverte dans votre ressort. Les anomalies détectées et enregistrées apparaîtront ici."
                    : undefined
                }
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {alerts.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 8,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
                      <strong style={{ fontSize: 13, color: "#991b1b" }}>{a.ruleFamily}</strong>
                      {/* Ageing derived from the stored detectedAt only. */}
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#dc2626", whiteSpace: "nowrap" }}>
                        {elapsedSince(a.detectedAt)}
                      </span>
                    </div>

                    <p style={{ margin: "2px 0 8px", fontSize: 12, color: "#374151", lineHeight: 1.4 }}>
                      {anomalyCompanyName(a) ? `${anomalyCompanyName(a)} — ` : ""}
                      {a.description}
                    </p>

                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
                      Règle <strong>{a.ruleCode}</strong> · Observé {a.observedValue} · Attendu {a.expectedValue}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      {/* Region printed only when the submission carries one. */}
                      <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
                        {a.submission?.region ? `Région : ${a.submission.region}` : NOT_PROVIDED}
                      </span>
                      {a.submission?.id && (
                        <Link
                          href={`/admin/dossiers/${encodeURIComponent(a.submission.id)}`}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#b91c1c",
                            textDecoration: "none",
                            background: "#ffffff",
                            padding: "3px 10px",
                            borderRadius: 4,
                            border: "1px solid rgba(0,0,0,0.1)",
                          }}
                        >
                          Examiner {anomalyDossierRef(a)} →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* The detection engine exposes no run history, rule count or
              service-health endpoint, so none is claimed here. */}
          <div style={{ ...CARD, padding: "16px 20px" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>
              Moteur de Contrôle Statistique
            </h3>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>
              Les règles arithmétiques et les seuils de complétude sont évalués à
              chaque consultation du diagnostic d&apos;un dossier.
            </p>
            <DataState
              dense
              state="unavailable"
              resource="l'état du moteur de contrôle"
              title="État d'exécution non disponible"
              hint="Le système ne publie pas d'historique d'exécution, de décompte de règles actives ni d'indicateur de disponibilité pour le moteur de contrôle."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ActivitePage() {
  return (
    <Suspense fallback={null}>
      <ActiviteContent />
    </Suspense>
  );
}
