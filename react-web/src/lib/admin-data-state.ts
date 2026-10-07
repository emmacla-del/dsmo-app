// src/lib/admin-data-state.ts
//
// Honest-state primitives for the administrative/supervision UI.
//
// CAM-LEAP is a statistical information system of record. Every administrative
// fact an admin screen renders must be traceable to an authoritative backend
// field or to a documented deterministic derivation over authoritative fields.
// A plausible-looking placeholder is still a fabricated government fact, so
// when authoritative data is absent the UI renders the *absence*, never a
// substitute.
//
// Rules these helpers exist to enforce:
//
//  1. Never `value || "SomeFact"` / `value ?? "SomeFact"` for an administrative
//     fact. Use `fact()` / `factOr()` — they only ever degrade to a neutral
//     marker, never to another entity's data.
//  2. Zero is data. `count()` prints `0` for 0 and only degrades for
//     null/undefined, so truthiness can never swallow a legitimate zero.
//  3. An API error is not an empty result. `resolveDataState()` keeps
//     loading / error / forbidden / not-found / empty / ready distinct so a
//     failure can never be dressed up as "nothing to show".
//  4. A territorial figure may only come from a territory-scoped endpoint.
//     `UNSCOPED_ENDPOINTS` names the ones that are not, so they are never
//     wired into a per-actor figure.

import { ApiError } from "./api-client";
import { NATIONAL_ROLES, hasRole } from "./roles";
import type { UiLocale } from "./register-i18n";

/** Neutral marker for a field the system holds no value for. */
export const NOT_PROVIDED = "—";

/** Field exists in the model but the record carries no value. */
export const NOT_RECORDED = "Non renseigné";

/** The system has no source for this figure at all (no endpoint, no derivation). */
export const METRIC_UNAVAILABLE = "Données non disponibles";

// The helpers below take the console locale as their last argument and
// default to French, so a caller that has not been translated yet renders
// exactly what it did before. Components pass asUiLocale(useLocale()).

/** Intl tag per UI locale. en-GB keeps the dd/mm/yyyy order the console uses. */
const INTL_LOCALE: Record<UiLocale, string> = { fr: "fr-FR", en: "en-GB" };

const NOT_RECORDED_BY_LOCALE: Record<UiLocale, string> = { fr: NOT_RECORDED, en: "Not recorded" };
const METRIC_UNAVAILABLE_BY_LOCALE: Record<UiLocale, string> = { fr: METRIC_UNAVAILABLE, en: "Data not available" };

/** `NOT_RECORDED` in the given locale. */
export function notRecorded(locale: UiLocale = "fr"): string {
  return NOT_RECORDED_BY_LOCALE[locale];
}

/** `METRIC_UNAVAILABLE` in the given locale. */
export function metricUnavailable(locale: UiLocale = "fr"): string {
  return METRIC_UNAVAILABLE_BY_LOCALE[locale];
}

/**
 * Backend endpoints that return platform-wide figures with no territorial
 * filter. Their values are only truthful for an actor whose authorised scope
 * *is* national (SUPER_ADMIN / ADMIN_ONEFOP).
 *
 * - GET /audit/reports (src/report/audit.controller.ts — platform-wide
 *   by design, which is why it is restricted to the super-admin and auditor
 *   roles)
 *
 * Note: GET /data-management/stats was previously unscoped, but is now
 * territory-scoped on the backend via `territoryWhere(territory)`.
 */
export const UNSCOPED_ENDPOINTS = [
  "/audit/reports",
] as const;

export { NATIONAL_ROLES } from "./roles";

export interface UserScopeCandidate {
  role?: string | null;
  region?: string | null;
  department?: string | null;
}

/**
 * Determine the honest territorial scope label for an authenticated user.
 * Never widens an unassigned REGIONAL_ADMIN or DIVISIONAL_ADMIN account to "National".
 */
export function computeUserScopeLabel(user: UserScopeCandidate | null | undefined, locale: UiLocale = "fr"): string {
  const en = locale === "en";
  const department = (name: string) => (en ? `Department ${name}` : `Département ${name}`);
  const region = (name: string) => (en ? `Region ${name}` : `Région ${name}`);
  if (!user || !user.role) return NOT_PROVIDED;
  if (user.role === "DIVISIONAL_ADMIN") {
    if (user.department) return department(user.department);
    if (user.region) return region(user.region);
    return en ? "Departmental (unassigned)" : "Départemental (non assigné)";
  }
  if (user.role === "REGIONAL_ADMIN") {
    if (user.region) return region(user.region);
    return en ? "Regional (unassigned)" : "Régional (non assigné)";
  }
  if (hasRole(user.role, NATIONAL_ROLES)) {
    return "National";
  }
  return user.department
    ? department(user.department)
    : user.region
      ? region(user.region)
      : notRecorded(locale);
}

/**
 * Render a single administrative *fact* (a name, an identifier, a territory, a
 * date). Returns the neutral marker for null / undefined / blank — never
 * another value.
 *
 * `0` and `false` are legitimate recorded values and pass through.
 */
export function fact(value: unknown): string {
  if (value === null || value === undefined) return NOT_PROVIDED;
  if (typeof value === "string" && value.trim() === "") return NOT_PROVIDED;
  return String(value);
}

/**
 * Same as `fact()` but with caller-chosen wording for the absent case — use
 * `NOT_RECORDED` where "the respondent did not fill this in" is the right
 * reading, and `NOT_PROVIDED` where "the system holds nothing here" is.
 *
 * `marker` must be one of this module's absence markers. It is deliberately
 * not a free-text escape hatch for substituting a real-looking default.
 */
export function factOr(value: unknown, marker: typeof NOT_PROVIDED | typeof NOT_RECORDED | typeof METRIC_UNAVAILABLE): string {
  const resolved = fact(value);
  return resolved === NOT_PROVIDED ? marker : resolved;
}

/** First non-empty fact among several authoritative candidates, else the marker. */
export function firstFact(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    const resolved = fact(candidate);
    if (resolved !== NOT_PROVIDED) return resolved;
  }
  return NOT_PROVIDED;
}

/**
 * Render a count or other integral measure. `0` prints as `0`; only
 * null/undefined/NaN degrade to the neutral marker. Never apply `||` to a
 * count — that is how a real zero becomes an invented number.
 */
export function count(value: number | null | undefined, locale: UiLocale = "fr"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NOT_PROVIDED;
  return value.toLocaleString(INTL_LOCALE[locale]);
}

/**
 * Render a percentage. Pass `null` when the rate is not calculable (e.g. the
 * denominator is 0 or either operand is missing) — do not pass a stand-in.
 *
 * `fractionDigits` is the most decimals shown; `minFractionDigits` (default:
 * the same) the fewest. Pass 1 and 0 for "50 %" alongside "50,5 %", as the
 * quota and coverage tables do, rather than "50,0 %".
 */
export function percent(
  value: number | null | undefined,
  fractionDigits = 0,
  locale: UiLocale = "fr",
  minFractionDigits: number = fractionDigits,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NOT_PROVIDED;
  const digits = value.toLocaleString(INTL_LOCALE[locale], { minimumFractionDigits: minFractionDigits, maximumFractionDigits: fractionDigits });
  // French sets a space before the percent sign; English does not.
  return locale === "en" ? `${digits}%` : `${digits} %`;
}

/**
 * `numerator / denominator * 100`, rounded, or `null` when it is not
 * calculable from authoritative values. Both operands must be real backend
 * figures over the *same* server-side scope.
 */
export function rate(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  if (numerator === null || numerator === undefined) return null;
  if (denominator === null || denominator === undefined || denominator === 0) return null;
  return Math.round((numerator / denominator) * 100);
}

/** Bar/meter width for a rate; an unavailable rate renders no fill at all. */
export function meterWidth(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0%";
  return `${Math.max(0, Math.min(100, value))}%`;
}

/**
 * Format a stored timestamp. Returns the neutral marker when the record has no
 * timestamp — never substitutes "now", which would invent an event time.
 */
export function stamp(iso: string | null | undefined, withTime = true, locale: UiLocale = "fr"): string {
  if (!iso) return NOT_PROVIDED;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NOT_PROVIDED;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

/** Short stamp for dense feeds: time of day for today, day+month otherwise. */
/**
 * Time of day to the second (HH:mm:ss), for an indicator whose point is
 * recency, such as "saved at". The neutral marker when there is no time.
 */
export function clockTime(value: Date | string | null | undefined, locale: UiLocale = "fr"): string {
  if (!value) return NOT_PROVIDED;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return NOT_PROVIDED;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);
}

export function shortStamp(iso: string | null | undefined, locale: UiLocale = "fr"): string {
  if (!iso) return NOT_PROVIDED;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NOT_PROVIDED;
  const sameDay = d.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(
    INTL_LOCALE[locale],
    sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short" },
  ).format(d);
}

/**
 * Elapsed time since a *stored* timestamp. Derived exclusively from the
 * recorded value and the clock, so it is traceable; there is no variant that
 * accepts a missing timestamp.
 */
export function elapsedSince(iso: string | null | undefined, locale: UiLocale = "fr"): string {
  if (!iso) return NOT_PROVIDED;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return NOT_PROVIDED;
  const en = locale === "en";
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 0) return stamp(iso, true, locale);
  if (minutes < 1) return en ? "Just now" : "À l'instant";
  if (minutes < 60) return en ? `${minutes} min ago` : `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return en ? `${hours} h ago` : `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return en ? `${days} d ago` : `Il y a ${days} j`;
  return stamp(iso, false, locale);
}

// ── Query state ───────────────────────────────────────────────────────────

export type DataState =
  | "loading"
  | "error"
  | "forbidden"
  | "notFound"
  | "unavailable"
  | "empty"
  | "ready";

export interface DataStateInput {
  /** The query is in flight and has nothing to show yet. */
  isLoading?: boolean;
  isPending?: boolean;
  isError?: boolean;
  error?: unknown;
  /** The actor's role is not permitted to read this resource at all. */
  roleAllowed?: boolean;
  /** The resource is served but the system has no source for it. */
  sourceAvailable?: boolean;
  /** Number of rows the server returned. `0` is a real, successful answer. */
  rowCount?: number | null;
}

/**
 * Collapse a react-query result into exactly one honest state.
 *
 * The order matters: a role refusal outranks an error, an error outranks
 * emptiness, and emptiness is only ever reported for a *successful* response.
 * There is no path from `error` to `empty`, which is what stops a failure
 * being rendered as "no records".
 */
export function resolveDataState(input: DataStateInput): DataState {
  if (input.roleAllowed === false) return "forbidden";
  if (input.sourceAvailable === false) return "unavailable";
  if (input.isError) {
    const status = input.error instanceof ApiError ? input.error.status : undefined;
    if (status === 401 || status === 403) return "forbidden";
    if (status === 404) return "notFound";
    return "error";
  }
  if (input.isLoading || input.isPending) return "loading";
  if (input.rowCount !== undefined && input.rowCount !== null && input.rowCount === 0) return "empty";
  return "ready";
}

/** Human message for a non-ready state. `null` for `ready`. */
export function dataStateMessage(state: DataState, resource: string, locale: UiLocale = "fr"): string | null {
  const en = locale === "en";
  switch (state) {
    case "loading":
      return en ? `Loading ${resource}…` : `Chargement de ${resource}…`;
    case "forbidden":
      return en
        ? "Access denied. Your role does not allow you to view this data."
        : "Accès non autorisé. Votre rôle ne permet pas de consulter ces données.";
    case "notFound":
      return en ? "Record not found." : "Enregistrement introuvable.";
    case "unavailable":
      return metricUnavailable(locale);
    case "error":
      return en ? `Unable to load ${resource}.` : `Impossible de charger ${resource}.`;
    case "empty":
      // "Found", not "recorded" (D11): the list may be empty because a filter
      // excluded everything, not because nothing was ever recorded.
      return en ? `No results found for ${resource}.` : `Aucun résultat trouvé pour ${resource}.`;
    case "ready":
      return null;
  }
}

/** Server-reported error text, when there is one worth showing. */
export function errorDetail(error: unknown): string | null {
  if (error instanceof ApiError) return error.message || null;
  if (error instanceof Error) return error.message || null;
  return null;
}
