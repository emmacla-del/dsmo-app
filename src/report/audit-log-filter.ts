import { BadRequestException } from '@nestjs/common';
import { ADMIN_LIST_PERIODS, AdminListPeriod, periodStart } from '../questionnaires/admin-list-filter';

/**
 * Filters of GET /audit/reports (admin/journal-audit). The single source of
 * the audit list's Prisma `where`, so a page and its `total` always select
 * the same rows.
 */
export interface AuditLogFilters {
  period?: AdminListPeriod;
  /** Free text matched against the acting user's first name, last name or email. */
  actor?: string;
  action?: string;
  resourceType?: string;
  /** Free text matched against resourceId (IDs are not unique across types). */
  resourceId?: string;
}

export const AUDIT_PAGE_MAX_LIMIT = 100;
export const AUDIT_PAGE_DEFAULT_LIMIT = 20;
const TEXT_MAX_LENGTH = 100;

// Query params arrive as strings (the global ValidationPipe runs with
// transform: false). Parse here and answer a clear 400 rather than letting
// Prisma fail with a 500 — same contract as the dossier list.
export function parseIntParam(raw: unknown, fallback: number, min: number, max: number, message: string): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) throw new BadRequestException(message);
  const value = Number(text);
  if (value < min || value > max) throw new BadRequestException(message);
  return value;
}

export function optionalText(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim().slice(0, TEXT_MAX_LENGTH);
  return text || undefined;
}

export function parseAuditLogFilters(raw: {
  period?: unknown;
  actor?: unknown;
  action?: unknown;
  resourceType?: unknown;
  resourceId?: unknown;
}): AuditLogFilters {
  const period = optionalText(raw.period);
  if (period && !(ADMIN_LIST_PERIODS as readonly string[]).includes(period)) {
    throw new BadRequestException('Période inconnue.');
  }
  return {
    period: period as AdminListPeriod | undefined,
    actor: optionalText(raw.actor),
    action: optionalText(raw.action),
    resourceType: optionalText(raw.resourceType),
    resourceId: optionalText(raw.resourceId),
  };
}

/** Filters are combined with AND; no filter = every row (the legacy behaviour). */
export function buildAuditLogWhere(
  filters: AuditLogFilters,
  now: Date = new Date(),
): { AND: Record<string, unknown>[] } {
  const and: Record<string, unknown>[] = [];
  // timestamp: indexed and the list's sort key.
  if (filters.period) and.push({ timestamp: { gte: periodStart(filters.period, now) } });
  if (filters.action) and.push({ action: filters.action });
  if (filters.resourceType) and.push({ resourceType: filters.resourceType });
  if (filters.resourceId) and.push({ resourceId: { contains: filters.resourceId, mode: 'insensitive' } });
  if (filters.actor) {
    const contains = { contains: filters.actor, mode: 'insensitive' };
    and.push({
      user: { OR: [{ firstName: contains }, { lastName: contains }, { email: contains }] },
    });
  }
  return { AND: and };
}
