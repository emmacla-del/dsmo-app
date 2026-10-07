// src/lib/actor-summary.ts
//
// GET /audit/actor-summary and POST /audit/nudge — the territorial admin
// monitoring dashboard. Phase 4 of docs/plans/territorial-admin-monitoring.md.
//
// The dashboard reports output (`lastActionAt`, decisions, registrations),
// never presence: there is no last-login field here by design (DECISION 4).
import { apiFetch } from "./api-client";

export type ActorSummaryPeriod = "7d" | "30d" | "90d" | "12m";

export const ACTOR_SUMMARY_PERIODS: readonly { value: ActorSummaryPeriod; label: string }[] = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "12m", label: "12 mois" },
];

/** The two roles the dashboard lists. Mirrors the backend's role filter. */
export const MONITORED_ROLES: readonly { value: string; label: string }[] = [
  { value: "REGIONAL_ADMIN", label: "Administrateur régional" },
  { value: "DIVISIONAL_ADMIN", label: "Administrateur départemental" },
];

export interface ActorSummaryActor {
  userId: string;
  displayName: string;
  role: string;
  region: string | null;
  department: string | null;
  lastActionAt: string | null;
  /**
   * The latest decision the admin recorded, at any time — what the
   * NO_RECENT_ACTIVITY reminder counts from. Absent from an older server.
   */
  lastDecisionAt?: string | null;
  field: {
    registrationsMade: number;
    conversions: number;
    /** 0–1, or null when the admin made no registration in the period. */
    conversionRate: number | null;
    lastRegistrationAt: string | null;
  };
  coverage: {
    target: number | null;
    current: number | null;
    /** 0–1, or null when no target is set for the ressort. */
    percent: number | null;
  };
  processing: {
    backlog: number;
    stale: number;
    decisions: { approved: number; rejected: number; corrections: number };
    medianDaysToDecision: number | null;
  };
}

export interface ActorSummaryResponse {
  periodStart: string;
  periodEnd: string;
  /** The server's stale-backlog threshold in days. Absent from an older server. */
  staleAfterDays?: number;
  actors: ActorSummaryActor[];
}

export interface ActorSummaryParams {
  period?: ActorSummaryPeriod;
  role?: string;
  region?: string;
  department?: string;
}

export function getActorSummary(params: ActorSummaryParams = {}) {
  const query = new URLSearchParams();
  if (params.period) query.set("period", params.period);
  if (params.role) query.set("role", params.role);
  if (params.region) query.set("region", params.region);
  if (params.department) query.set("department", params.department);
  const qs = query.toString();
  return apiFetch<ActorSummaryResponse>(`/audit/actor-summary${qs ? `?${qs}` : ""}`);
}

export type NudgeTemplate = "STALE_BACKLOG" | "BEHIND_TARGET" | "NO_RECENT_ACTIVITY";

export const NUDGE_TEMPLATE_OPTIONS: readonly { value: NudgeTemplate; label: string }[] = [
  { value: "STALE_BACKLOG", label: "Dossiers en attente depuis plus de 7 jours" },
  { value: "BEHIND_TARGET", label: "Retard sur la cible de couverture" },
  { value: "NO_RECENT_ACTIVITY", label: "Aucune décision récente" },
];

export interface NudgePayload {
  userId: string;
  template: NudgeTemplate;
  customMessage?: string;
}

export function sendNudge(payload: NudgePayload) {
  return apiFetch<{ id: string }>("/audit/nudge", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Shared query key for the dashboard list. */
export const ACTOR_SUMMARY_QUERY_KEY = ["admin", "equipe", "actor-summary"] as const;
