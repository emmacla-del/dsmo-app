// src/lib/registration-queue.ts
//
// The registrations list (/admin/inscriptions): its URL state, the
// role-aware geography filter, and the pending queue's waiting time.
//
// What the default queue lists is decided by the server, not here:
//   status=PENDING_APPROVAL — pending review only;
//   unassigned=true          — « À réclamer », files nobody holds;
//   assignedToMe=true        — « Réclamées par moi », the officer's own files;
//   assignedToOthers=true    — « Réclamées par un collègue », files another
//     officer holds, with their name and the time their claim has left.
// A claim lapses 2 hours after it is taken (CLAUDE.md §21, 2026-11-09): the
// server then lists the file as free. Territory is the server's: a geography
// filter only narrows inside the actor's scope.
import { ApiError } from "./api-client";
import { REGISTRATION_NATIONAL_ROLES, hasRole } from "./roles";
import type { RegistrationListParams } from "./registration-trail";
import { REGISTRATION_ENTITY_TYPES } from "./inscriptions";
import type { UiLocale } from "./register-i18n";

export type QueueOwnership = "available" | "mine" | "others";
export type QueueSort = "oldest" | "newest";
export type RegistrationStatusFilter = "PENDING_APPROVAL" | "COMPLEMENTS_REQUESTED" | "ACTIVE" | "REJECTED" | "ALL";

/** Which level of the territory the officer may pick, one below their own. */
export type QueueGeoLevel = "region" | "department" | "subdivision" | null;

export const REGISTRATION_QUEUE_PAGE_SIZE = 20;
export const REGISTRATION_QUEUE_PATH = "/admin/inscriptions";

export interface QueueUrlState {
  status: RegistrationStatusFilter;
  ownership: QueueOwnership;
  search: string;
  /** One value, at the level `geoLevelFor(role)` names. */
  geo: string;
  type: string;
  sort: QueueSort;
  page: number;
  includeArchived: boolean;
  /** Audit drill-down from the territorial-team page. */
  createdBy: string;
}

/** National picks a region, regional a department, divisional a subdivision; anyone else nothing. */
export function geoLevelFor(role: string | null | undefined): QueueGeoLevel {
  if (hasRole(role, REGISTRATION_NATIONAL_ROLES)) return "region";
  if (role === "REGIONAL_ADMIN") return "department";
  if (role === "DIVISIONAL_ADMIN") return "subdivision";
  return null;
}

/** The URL parameter that carries the geography value at a level. */
export function geoParam(level: QueueGeoLevel): "region" | "department" | "subdivision" | null {
  return level;
}

/**
 * Reads the queue's state from its query string. Unknown values fall back to
 * the defaults (available, oldest first, page 1) rather than being trusted.
 * `assignedToMe=1` is the address older links and bookmarks carry.
 */
export function parseQueueUrl(query: string | URLSearchParams, role: string | null | undefined): QueueUrlState {
  const params = typeof query === "string" ? new URLSearchParams(query) : query;
  const owner = params.get("owner");
  const legacyMine = params.get("assignedToMe") === "1" || params.get("assignedToMe") === "true";
  const level = geoLevelFor(role);
  const type = params.get("type")?.trim() ?? "";
  const rawPage = Number(params.get("page"));
  const rawStatus = params.get("status")?.trim().toUpperCase();
  const status: RegistrationStatusFilter = rawStatus === "COMPLEMENTS_REQUESTED" || rawStatus === "ACTIVE" || rawStatus === "REJECTED" || rawStatus === "ALL"
    ? rawStatus
    : "PENDING_APPROVAL";
  const rawSort = params.get("sort");
  return {
    status,
    ownership: owner === "mine" || (owner === null && legacyMine) ? "mine" : owner === "others" ? "others" : "available",
    search: (params.get("search") ?? "").trim(),
    geo: level ? (params.get(level) ?? "").trim() : "",
    type: (REGISTRATION_ENTITY_TYPES as readonly string[]).includes(type) ? type : "",
    sort: rawSort === "oldest" || rawSort === "newest" ? rawSort : status === "PENDING_APPROVAL" ? "oldest" : "newest",
    page: Number.isInteger(rawPage) && rawPage > 1 ? rawPage : 1,
    includeArchived: status !== "PENDING_APPROVAL" && params.get("includeArchived") === "true",
    createdBy: (params.get("createdBy") ?? "").trim(),
  };
}

/** The canonical address of a queue state: defaults are left out. */
export function queueHref(state: QueueUrlState, role: string | null | undefined): string {
  const params = new URLSearchParams();
  params.set("vue", "queue");
  if (state.status !== "PENDING_APPROVAL") params.set("status", state.status);
  if (state.status === "PENDING_APPROVAL" && state.ownership !== "available") params.set("owner", state.ownership);
  if (state.search) params.set("search", state.search);
  const level = geoLevelFor(role);
  if (level && state.geo) params.set(level, state.geo);
  if (state.type) params.set("type", state.type);
  const defaultSort: QueueSort = state.status === "PENDING_APPROVAL" ? "oldest" : "newest";
  if (state.sort !== defaultSort) params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.status !== "PENDING_APPROVAL" && state.includeArchived) params.set("includeArchived", "true");
  if (state.createdBy) params.set("createdBy", state.createdBy);
  return `${REGISTRATION_QUEUE_PATH}?${params.toString()}`;
}

/**
 * The queue a « waiting too long » figure elsewhere opens: unclaimed files,
 * oldest first, narrowed to the figure's territory and type. The queue has no
 * overdue filter (the brief removed it), so the files past the deadline are
 * the ones at the top. A territory finer or coarser than the reader's own
 * geography filter is dropped: their scope still bounds the list server-side.
 */
export function oldestPendingHref(
  filters: { region?: string; department?: string; entityType?: string },
  role: string | null | undefined,
): string {
  const level = geoLevelFor(role);
  const geo = level === "region" ? filters.region : level === "department" ? filters.department : undefined;
  const type = filters.entityType && (REGISTRATION_ENTITY_TYPES as readonly string[]).includes(filters.entityType) ? filters.entityType : "";
  return queueHref({ status: "PENDING_APPROVAL", ownership: "available", search: "", geo: geo ?? "", type, sort: "oldest", page: 1, includeArchived: false, createdBy: "" }, role);
}

/** Search, geography or type narrows the list. Ownership and order do not count. */
export function hasActiveQueueFilters(state: Pick<QueueUrlState, "status" | "search" | "geo" | "type" | "includeArchived" | "createdBy">): boolean {
  return state.status !== "PENDING_APPROVAL" || Boolean(state.search || state.geo || state.type || state.includeArchived || state.createdBy);
}

/** The geography filter as list-request fields. */
function geoRequest(level: QueueGeoLevel, value: string): Pick<RegistrationListParams, "region" | "department" | "subdivision"> {
  if (!level || !value) return {};
  return { [level]: value };
}

function ownershipRequest(ownership: QueueOwnership): Pick<RegistrationListParams, "unassigned" | "assignedToMe" | "assignedToOthers"> {
  if (ownership === "mine") return { assignedToMe: true };
  if (ownership === "others") return { assignedToOthers: true };
  return { unassigned: true };
}

/** The list request without paging: every filter applies. */
export function queueListParams(state: QueueUrlState, role: string | null | undefined): RegistrationListParams {
  const common: RegistrationListParams = {
    ...geoRequest(geoLevelFor(role), state.geo),
    ...(state.search ? { search: state.search } : {}),
    ...(state.type ? { entityType: state.type } : {}),
    ...(state.createdBy ? { createdBy: state.createdBy } : {}),
    sortOrder: state.sort,
  };
  if (state.status !== "PENDING_APPROVAL") {
    return {
      ...common,
      // Keep the API's existing include-archived contract while the
      // organisations screen itself is retired.
      view: "organisations",
      status: state.status,
      includeArchived: state.includeArchived,
    };
  }
  return {
    ...common,
    view: "queue",
    status: "PENDING_APPROVAL",
    ...ownershipRequest(state.ownership),
  };
}

/**
 * The summary request for one ownership view: geography only, never search or
 * type, oldest first and one row. Its `total` is the count, its first row's
 * receipt time the oldest wait.
 */
export function queueSummaryParams(
  ownership: QueueOwnership,
  geo: string,
  role: string | null | undefined,
): RegistrationListParams & { page: number; pageSize: number } {
  return {
    view: "queue",
    status: "PENDING_APPROVAL",
    ...ownershipRequest(ownership),
    ...geoRequest(geoLevelFor(role), geo),
    sortOrder: "oldest",
    page: 1,
    pageSize: 1,
  };
}

/**
 * Whether a row belongs in the view. The server applies the same rule; this
 * keeps a file claimed by someone else off the screen if an older server
 * ignored `unassigned` or `assignedToOthers`.
 */
export function rowInView(row: { assigneeId: string | null }, ownership: QueueOwnership, userId: string | null | undefined): boolean {
  if (ownership === "mine") return !!userId && row.assigneeId === userId;
  if (ownership === "others") return row.assigneeId != null && row.assigneeId !== userId;
  return row.assigneeId == null;
}

/** Under this, a claim's time left is shown as a warning. */
export const CLAIM_URGENT_MS = 30 * 60_000;

export interface ClaimTimeLeft {
  /** « 1 h 20 min », « 12 min »; « 0 min » once lapsed. */
  label: string;
  urgent: boolean;
  lapsed: boolean;
}

/**
 * What is left of a claim before it lapses and the file returns to the queue.
 * Null when the server sent no deadline (a server deployed before it, or no
 * clock on the file), so the cell shows nothing rather than a guess.
 */
export function claimTimeLeft(expiresAt: string | null | undefined, now: Date, locale: UiLocale): ClaimTimeLeft | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  const left = end - now.getTime();
  const minutes = Math.max(0, Math.ceil(left / 60_000));
  const unit = (value: number, name: "minute" | "hour") =>
    new Intl.NumberFormat(INTL_LOCALE[locale], { style: "unit", unit: name, unitDisplay: "short" }).format(value);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const label = hours === 0 ? unit(rest, "minute") : rest === 0 ? unit(hours, "hour") : `${unit(hours, "hour")} ${unit(rest, "minute")}`;
  return { label, urgent: left < CLAIM_URGENT_MS, lapsed: left <= 0 };
}

const INTL_LOCALE: Record<UiLocale, string> = { fr: "fr-FR", en: "en-GB" };

/**
 * How long a registration has waited since the server received it, to the
 * minute (owner, 2026-11-09): minutes under an hour (« 45 min »), then hours
 * and minutes (« 6 h 20 min »), then days, hours and minutes (« 18 j 3 h
 * 12 min »); a part that is zero is left out. Null when the receipt time is
 * missing or unreadable, so the cell can say « Indisponible » instead of
 * guessing. A receipt time in the future (clock skew) reads as under a minute.
 */
export function waitingDuration(receivedAt: string | null | undefined, now: Date, locale: UiLocale): string | null {
  if (!receivedAt) return null;
  const then = new Date(receivedAt).getTime();
  if (Number.isNaN(then)) return null;
  const total = Math.max(1, Math.floor((now.getTime() - then) / 60_000));
  const unit = (value: number, name: "minute" | "hour" | "day") =>
    new Intl.NumberFormat(INTL_LOCALE[locale], { style: "unit", unit: name, unitDisplay: "short" }).format(value);
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(unit(days, "day"));
  if (hours > 0) parts.push(unit(hours, "hour"));
  if (minutes > 0) parts.push(unit(minutes, "minute"));
  return parts.join(" ");
}

/** The exact receipt date and time, for the cell's accessible label and tooltip. */
export function receiptStamp(receivedAt: string | null | undefined, locale: UiLocale): string | null {
  if (!receivedAt) return null;
  const date = new Date(receivedAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Douala",
    timeZoneName: "short",
  }).format(date);
}

/** A claim refused because someone else took the file first. */
export function isClaimConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

/** The territory cell's parts for the officer's level, most general first. */
export function territoryParts(
  row: { region: string | null; department: string | null; subdivision: string | null },
  role: string | null | undefined,
): string[] {
  const level = geoLevelFor(role);
  const parts = level === "region"
    ? [row.region, row.department]
    : level === "department"
      ? [row.department, row.subdivision]
      : level === "subdivision"
        ? [row.subdivision]
        : [row.region, row.department];
  return parts.filter((part): part is string => !!part && part.trim() !== "");
}
