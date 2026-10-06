// analytics/core/analytics-territory.ts

import { territoryFromUser, territoryWhere } from '../../auth/territory';

/**
 * The territory restriction an ONEFOP analytics request runs under, or
 * `undefined` when it runs nationally.
 *
 * The rule (ruled 2026-10-06, "national, no breakdowns"):
 * - National roles (SUPER_ADMIN, ADMIN_ONEFOP) are never restricted.
 * - A territorial admin (REGIONAL_ADMIN, DIVISIONAL_ADMIN) sees national
 *   totals when it passes no geographic filter. National totals are the
 *   public figure; a per-territory figure is not.
 * - As soon as it passes a region, department or subdivision filter, or asks
 *   for a breakdown by region / department / subdivision, its own territory
 *   is ANDed into the query. A filter naming another region then matches
 *   nothing, and a breakdown shows its own territory's rows only. That closes
 *   the disclosure risk: another territory's small-population figures pulled
 *   through a filter or a groupBy.
 * - An account whose territory cannot be resolved (an unknown role, or a
 *   territorial admin with no assignment) gets territoryWhere's fail-closed
 *   fragment on every request, filter or not: no results.
 *
 * The fragment is carried on AnalyticsFilter._territory, set by the
 * controller from req.user and never from the query string, and
 * buildSubmissionWhere puts it under `where.AND`.
 */
export function analyticsTerritoryScope(
    user: unknown,
    query: Record<string, unknown> | undefined,
    options: { geographicBreakdown?: boolean } = {},
): Record<string, unknown> | undefined {
    const scope = territoryWhere(territoryFromUser(user));
    if (Object.keys(scope).length === 0) return undefined; // national role
    if (isNoRows(scope)) return scope;
    const filtered = ['region', 'department', 'subdivision'].some((key) => hasValue(query?.[key]));
    return filtered || options.geographicBreakdown ? scope : undefined;
}

/** territoryWhere's fail-closed fragment, `{ id: { in: [] } }`. */
function isNoRows(scope: Record<string, unknown>): boolean {
    const id = scope['id'] as { in?: unknown } | undefined;
    return Array.isArray(id?.in) && id.in.length === 0;
}

/**
 * Whether a query parameter was actually sent. A blank string is no filter;
 * an array (`?region=a&region=b`) counts as one, so it cannot slip past the
 * scope.
 */
function hasValue(value: unknown): boolean {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim() !== '';
    return value !== undefined && value !== null;
}
