// src/lib/actor-summary.ts
//
// GET /audit/actor-summary and POST /audit/nudge — the territorial admin
// monitoring dashboard. Phase 4 of docs/plans/territorial-admin-monitoring.md.
//
// The dashboard reports output (`lastActionAt`, decisions, registrations),
// never presence: there is no last-login field here by design (DECISION 4).
import { apiFetch } from "./api-client";

export type ActorSummaryPeriod = "7d" | "30d" | "90d" | "12m";

/** Labels live at adminEquipePage.period.<value>. */
export const ACTOR_SUMMARY_PERIODS: readonly ActorSummaryPeriod[] = ["7d", "30d", "90d", "12m"];

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
   * NO_RECENT_ACTIVITY reminder counts from.
   */
  lastDecisionAt: string | null;
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
  /** The server's stale-backlog threshold in days (STALE_AFTER_DAYS). */
  staleAfterDays: number;
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

/** Labels live at adminEquipePage.template.<value>. */
export const NUDGE_TEMPLATE_OPTIONS: readonly NudgeTemplate[] = ["STALE_BACKLOG", "BEHIND_TARGET", "NO_RECENT_ACTIVITY"];

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
