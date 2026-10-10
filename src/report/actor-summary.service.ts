import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PilotageService } from '../pilotage/pilotage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TERRITORIAL_APPROVER_ROLES } from '../auth/staff-scope';

/**
 * Territorial admin monitoring — Phase 4 of
 * docs/plans/territorial-admin-monitoring.md.
 *
 * Shows output, not presence: `lastActionAt` is the latest audit-log row the
 * admin wrote, and `lastLoginAt` is deliberately never read (DECISION 4).
 * No scores and no rankings — the numbers are the product.
 */

export const ACTOR_SUMMARY_PERIODS = ['7d', '30d', '90d', '12m'] as const;
export type ActorSummaryPeriod = (typeof ACTOR_SUMMARY_PERIODS)[number];

/** A dossier assigned to an admin and unanswered this long is "stale". */
export const STALE_AFTER_DAYS = 7;

/**
 * audit_logs.action values that are an admin's decision on a file, grouped the
 * way the dashboard reports them. These are the values the writers in
 * auth.service.ts, questionnaires.service.ts and eligibility-engine.service.ts
 * emit today.
 */
export const DECISION_ACTIONS = {
  approved: ['COMPANY_REGISTRATION_APPROVED', 'AUDIT_APPROVE', 'AUDIT_BULK_VISA_GRANTED'],
  rejected: ['COMPANY_REGISTRATION_REJECTED', 'STAFF_REGISTRATION_REJECTED', 'AUDIT_REJECT', 'AUDIT_BULK_REJECT'],
  corrections: ['COMPANY_REGISTRATION_COMPLEMENTS_REQUESTED', 'AUDIT_CORRECTION'],
} as const;

const ALL_DECISION_ACTIONS: string[] = [
  ...DECISION_ACTIONS.approved,
  ...DECISION_ACTIONS.rejected,
  ...DECISION_ACTIONS.corrections,
];

/** Registration statuses that wait on an admin (not on the company). */
const BACKLOG_STATUSES = ['PENDING_APPROVAL', 'UNDER_REVIEW'] as const;

export const NUDGE_TEMPLATES = ['STALE_BACKLOG', 'BEHIND_TARGET', 'NO_RECENT_ACTIVITY'] as const;
export type NudgeTemplate = (typeof NUDGE_TEMPLATES)[number];

const MAX_CUSTOM_MESSAGE = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ActorSummaryQuery {
  period?: string;
  role?: string;
  region?: string;
  department?: string;
}

export interface ActorSummaryActor {
  userId: string;
  displayName: string;
  role: string;
  region: string | null;
  department: string | null;
  lastActionAt: string | null;
  /**
   * The latest decision (ALL_DECISION_ACTIONS) the admin recorded, at any
   * time — the moment the NO_RECENT_ACTIVITY reminder counts from, so the
   * dashboard can preview that reminder exactly.
   */
  lastDecisionAt: string | null;
  field: {
    registrationsMade: number;
    conversions: number;
    conversionRate: number | null;
    lastRegistrationAt: string | null;
  };
  coverage: { target: number | null; current: number | null; percent: number | null };
  processing: {
    backlog: number;
    stale: number;
    decisions: { approved: number; rejected: number; corrections: number };
    medianDaysToDecision: number | null;
  };
}

interface ActingUser {
  id: string;
  role: string;
  region?: string | null;
  department?: string | null;
}

interface MonitoredUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  region: string | null;
  department: string | null;
}

function clean(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function nameEquals(value: string) {
  return { equals: value, mode: 'insensitive' as const };
}

export function periodStart(period: ActorSummaryPeriod, now: Date): Date {
  const start = new Date(now);
  if (period === '12m') {
    start.setUTCMonth(start.getUTCMonth() - 12);
    return start;
  }
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  return new Date(now.getTime() - days * DAY_MS);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function displayName(user: MonitoredUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email;
}

@Injectable()
export class ActorSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pilotage: PilotageService,
    private readonly notifications: NotificationsService,
  ) {}

  async getActorSummary(actor: ActingUser, query: ActorSummaryQuery, now = new Date()) {
    const period = parsePeriod(query.period);
    const role = parseRoleFilter(query.role);
    const start = periodStart(period, now);

    const users = await this.loadMonitoredUsers(actor, {
      role,
      region: clean(query.region),
      department: clean(query.department),
    });
    const actors = await this.summarize(users, start, now);

    // Worst cases first: most stale, then largest backlog, then name.
    actors.sort(
      (a, b) =>
        b.processing.stale - a.processing.stale ||
        b.processing.backlog - a.processing.backlog ||
        a.displayName.localeCompare(b.displayName),
    );

    // staleAfterDays: the threshold behind processing.stale and the
    // STALE_BACKLOG reminder, so the dashboard states it instead of copying it.
    return {
      periodStart: start.toISOString(),
      periodEnd: now.toISOString(),
      staleAfterDays: STALE_AFTER_DAYS,
      actors,
    };
  }

  async nudge(actor: ActingUser, body: unknown, now = new Date()) {
    const { userId, template, customMessage } = parseNudgeBody(body);

    const [target] = await this.loadMonitoredUsers(actor, { userId });
    // Out of the caller's scope and non-existent are the same answer.
    if (!target) throw new NotFoundException('Administrateur introuvable.');

    const [summary] = await this.summarize([target], periodStart('30d', now), now);
    const message = await this.buildMessage(template, target, summary, now);

    const text = customMessage ? `${message.body}\n\n${customMessage}` : message.body;
    // Awaited, unlike the fire-and-forget call sites Phase 3-full will add: the
    // notification is the whole point of this request, so a failure to write
    // it must reach the caller rather than report a nudge that never landed.
    const created = await this.notifications.create(target.id, 'NUDGE', message.subject, text, message.linkHref);
    return { id: created.id };
  }

  // ── Population ─────────────────────────────────────────────────────────────

  /**
   * The admins the caller may see. Fails closed: a REGIONAL_ADMIN without a
   * region sees nobody, never everybody.
   */
  private async loadMonitoredUsers(
    actor: ActingUser,
    filters: { userId?: string; role?: string | null; region?: string | null; department?: string | null },
  ): Promise<MonitoredUser[]> {
    const where: Record<string, unknown> = {
      role: filters.role ? filters.role : { in: [...TERRITORIAL_APPROVER_ROLES] },
      isActive: true,
      status: 'ACTIVE',
    };
    if (filters.userId) where.id = filters.userId;

    const and: Record<string, unknown>[] = [];
    if (actor.role === 'REGIONAL_ADMIN') {
      const ownRegion = clean(actor.region);
      if (!ownRegion) return [];
      and.push({ region: nameEquals(ownRegion) });
    }
    if (filters.region) and.push({ region: nameEquals(filters.region) });
    if (filters.department) and.push({ department: nameEquals(filters.department) });
    if (and.length > 0) where.AND = and;

    return this.prisma.user.findMany({
      where: where as any,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        region: true,
        department: true,
      },
    });
  }

  // ── Aggregation ────────────────────────────────────────────────────────────

  private async summarize(users: MonitoredUser[], start: Date, now: Date): Promise<ActorSummaryActor[]> {
    if (users.length === 0) return [];
    const ids = users.map((user) => user.id);
    const staleBefore = new Date(now.getTime() - STALE_AFTER_DAYS * DAY_MS);

    // Six reads plus getCoverage's, at most three in flight (was five in one
    // Promise.all, one of them getCoverage, whose own final pair could overlap
    // the other four: six at once). The pooler runs in session mode with a
    // tenant pool of 15 and Prisma opens one connection per concurrent query,
    // so wide fan-outs on admin screens exhausted it (EMAXCONNSESSION). The
    // queries and their filters are unchanged; only their timing is.
    //
    // One groupBy per (user, action) yields both the latest action of any kind
    // and the latest decision, so no separate latest-decision query is needed.
    const [lastActions, decisionRows, backlogRows] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['userId', 'action'],
        where: { userId: { in: ids } },
        _max: { timestamp: true },
      }),
      this.prisma.auditLog.findMany({
        where: { userId: { in: ids }, timestamp: { gte: start, lte: now }, action: { in: ALL_DECISION_ACTIONS } },
        select: { userId: true, action: true, resourceType: true, resourceId: true, timestamp: true },
      }),
      this.prisma.user.findMany({
        where: { assigneeId: { in: ids }, status: { in: [...BACKLOG_STATUSES] } },
        select: { assigneeId: true, createdAt: true },
      }),
    ]);

    // Days-to-decision needs when each decided registration was filed.
    const registrantIds = [
      ...new Set(decisionRows.filter((row) => row.resourceType === 'User').map((row) => row.resourceId)),
    ];

    // getCoverage reads one query at a time except for a final pair, so it
    // holds at most two connections; the field read, then the registrant
    // read, share the third.
    const [coverage, { fieldRows, registrants }] = await Promise.all([
      this.loadCoverage(now),
      (async () => {
        const fieldRows = await this.prisma.user.findMany({
          where: { createdBy: { in: ids }, registrationMethod: 'ASSISTED', createdAt: { gte: start, lte: now } },
          select: { createdBy: true, createdAt: true, _count: { select: { onefopSubmissions: true } } },
        });
        const registrants = registrantIds.length
          ? await this.prisma.user.findMany({
              where: { id: { in: registrantIds } },
              select: { id: true, createdAt: true },
            })
          : [];
        return { fieldRows, registrants };
      })(),
    ]);
    const filedAt = new Map(registrants.map((row) => [row.id, row.createdAt]));

    return users.map((user) => {
      const own = lastActions.filter((row) => row.userId === user.id);
      const lastAction = latest(own.map((row) => row._max.timestamp));
      const lastDecision = latest(
        own.filter((row) => ALL_DECISION_ACTIONS.includes(row.action)).map((row) => row._max.timestamp),
      );

      const decisions = { approved: 0, rejected: 0, corrections: 0 };
      const days: number[] = [];
      for (const row of decisionRows) {
        if (row.userId !== user.id) continue;
        if ((DECISION_ACTIONS.approved as readonly string[]).includes(row.action)) decisions.approved += 1;
        else if ((DECISION_ACTIONS.rejected as readonly string[]).includes(row.action)) decisions.rejected += 1;
        else decisions.corrections += 1;

        const filed = row.resourceType === 'User' ? filedAt.get(row.resourceId) : undefined;
        if (filed) days.push(Math.max(0, (row.timestamp.getTime() - filed.getTime()) / DAY_MS));
      }

      const made = fieldRows.filter((row) => row.createdBy === user.id);
      const conversions = made.filter((row) => row._count.onefopSubmissions > 0).length;
      const lastRegistration = made.reduce<Date | null>(
        (latest, row) => (!latest || row.createdAt > latest ? row.createdAt : latest),
        null,
      );

      const backlog = backlogRows.filter((row) => row.assigneeId === user.id);
      const medianDays = median(days);

      return {
        userId: user.id,
        displayName: displayName(user),
        role: user.role,
        region: user.region,
        department: user.department,
        lastActionAt: lastAction ? lastAction.toISOString() : null,
        lastDecisionAt: lastDecision ? lastDecision.toISOString() : null,
        field: {
          registrationsMade: made.length,
          conversions,
          conversionRate: made.length > 0 ? conversions / made.length : null,
          lastRegistrationAt: lastRegistration ? lastRegistration.toISOString() : null,
        },
        coverage: coverageFor(user, coverage),
        processing: {
          backlog: backlog.length,
          stale: backlog.filter((row) => row.createdAt < staleBefore).length,
          decisions,
          medianDaysToDecision: medianDays == null ? null : Math.round(medianDays * 10) / 10,
        },
      };
    });
  }

  /**
   * One national coverage read per request, indexed afterwards — reusing
   * PilotageService.getCoverage rather than re-deriving "registered", so the
   * dashboard can never disagree with /admin/cibles. A national territory is
   * passed on purpose: this is an internal read, and the caller's own scope is
   * applied to *which admins* are listed, not to the figures about them.
   *
   * What the reused getCoverage returns: since 8c, the annual sum of the
   * year's registration campaigns' quotas (purpose = REGISTRATION) — not
   * declaration quotas, and not a stored annual inscription target. The
   * targets this column compares against are therefore only as complete as
   * the quarters that have registration quotas — a year with quotas on two
   * quarters yields a two-quarter target, not a padded one, and a year with
   * none yields null.
   */
  private async loadCoverage(now: Date) {
    // Douala calendar year (UTC+1), matching the registration-year bounds.
    const year = new Date(now.getTime() + 60 * 60 * 1000).getUTCFullYear();
    // `inscriptionTarget` is the response field name, kept deliberately: the
    // literal is the HTTP wire name shared with /admin/cibles, and renaming it
    // is deferred naming debt (campaign-model-refactor.md §12).
    const result = await this.pilotage.getCoverage({ role: 'SUPER_ADMIN' }, year);
    return { year, regions: result.regions };
  }

  private async buildMessage(
    template: NudgeTemplate,
    target: MonitoredUser,
    summary: ActorSummaryActor,
    now: Date,
  ): Promise<{ subject: string; body: string; linkHref: string }> {
    if (template === 'STALE_BACKLOG') {
      const stale = summary.processing.stale;
      if (stale === 0) {
        throw new BadRequestException(`Aucun dossier en attente depuis plus de ${STALE_AFTER_DAYS} jours pour cet administrateur.`);
      }
      return {
        subject: 'Relance : dossiers en attente',
        body: `Vous avez ${stale} dossier${stale > 1 ? 's' : ''} en attente depuis plus de ${STALE_AFTER_DAYS} jours.`,
        linkHref: '/admin/inscriptions',
      };
    }

    if (template === 'BEHIND_TARGET') {
      const percent = summary.coverage.percent;
      if (percent == null) {
        throw new BadRequestException('Aucune cible définie pour le ressort de cet administrateur.');
      }
      const year = new Date(now.getTime() + 60 * 60 * 1000).getUTCFullYear();
      const scope = target.role === 'DIVISIONAL_ADMIN' ? 'Votre département' : 'Votre région';
      return {
        subject: 'Relance : couverture de la cible',
        body: `${scope} est à ${Math.round(percent * 100)}% de la cible ${year}.`,
        linkHref: '/admin/cibles',
      };
    }

    // NO_RECENT_ACTIVITY — measured against the last decision, not the last
    // action of any kind: an admin who only browses has not decided anything.
    const last = await this.prisma.auditLog.findFirst({
      where: { userId: target.id, action: { in: ALL_DECISION_ACTIONS } },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    const body = last
      ? `Aucune décision enregistrée sur votre compte depuis ${daysSince(last.timestamp, now)} jours.`
      : 'Aucune décision n’a encore été enregistrée sur votre compte.';
    return { subject: 'Relance : aucune activité récente', body, linkHref: '/admin/dossiers' };
  }
}

// ── Pure helpers (exported for tests) ──────────────────────────────────────

/** The latest of several timestamps, or null when there is none. */
export function latest(timestamps: (Date | null | undefined)[]): Date | null {
  return timestamps.reduce<Date | null>((max, value) => (value && (!max || value > max) ? value : max), null);
}

/**
 * Whole days from `since` to `now`, at least 1 — the figure the
 * NO_RECENT_ACTIVITY reminder states. The dashboard's preview repeats this
 * formula (react-web/src/lib/actor-summary.ts); keep the two in step.
 */
export function daysSince(since: Date, now: Date): number {
  return Math.max(1, Math.floor((now.getTime() - since.getTime()) / DAY_MS));
}

export function parsePeriod(raw: unknown): ActorSummaryPeriod {
  if (raw == null || raw === '') return '30d';
  if ((ACTOR_SUMMARY_PERIODS as readonly string[]).includes(String(raw))) return raw as ActorSummaryPeriod;
  throw new BadRequestException(
    `Le paramètre « period » doit valoir ${ACTOR_SUMMARY_PERIODS.join(', ')}.`,
  );
}

function parseRoleFilter(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if ((TERRITORIAL_APPROVER_ROLES as readonly string[]).includes(String(raw))) return String(raw);
  throw new BadRequestException(
    `Le paramètre « role » doit valoir ${TERRITORIAL_APPROVER_ROLES.join(' ou ')}.`,
  );
}

export function parseNudgeBody(body: unknown): { userId: string; template: NudgeTemplate; customMessage: string | null } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Corps de requête invalide.');
  }
  const { userId, template, customMessage } = body as Record<string, unknown>;
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new BadRequestException('« userId » est requis.');
  }
  if (typeof template !== 'string' || !(NUDGE_TEMPLATES as readonly string[]).includes(template)) {
    throw new BadRequestException(`« template » doit valoir ${NUDGE_TEMPLATES.join(', ')}.`);
  }
  let message: string | null = null;
  if (customMessage != null && customMessage !== '') {
    if (typeof customMessage !== 'string') throw new BadRequestException('« customMessage » doit être un texte.');
    message = customMessage.trim() || null;
    if (message && message.length > MAX_CUSTOM_MESSAGE) {
      throw new BadRequestException(`« customMessage » est limité à ${MAX_CUSTOM_MESSAGE} caractères.`);
    }
  }
  return { userId: userId.trim(), template: template as NudgeTemplate, customMessage: message };
}

type CoverageRegions = {
  year: number;
  regions: Array<{
    name: string;
    registered: number | null;
    inscriptionTarget: number | null;
    rate: number | null;
    departments: Array<{ name: string; registered: number; inscriptionTarget: number | null; rate: number | null }>;
  }>;
};

/**
 * Coverage of the admin's ressort: the region for a REGIONAL_ADMIN, the
 * department for a DIVISIONAL_ADMIN. Names match case-insensitively, as
 * territoryWhere does. No match or no target gives nulls, which the page
 * renders as "—" (plan 4d) rather than as a false zero.
 */
export function coverageFor(
  user: Pick<MonitoredUser, 'role' | 'region' | 'department'>,
  coverage: CoverageRegions,
): ActorSummaryActor['coverage'] {
  const empty = { target: null, current: null, percent: null };
  const regionName = clean(user.region)?.toLowerCase();
  if (!regionName) return empty;
  const region = coverage.regions.find((row) => row.name.toLowerCase() === regionName);
  if (!region) return empty;

  if (user.role === 'DIVISIONAL_ADMIN') {
    const departmentName = clean(user.department)?.toLowerCase();
    const department = departmentName
      ? region.departments.find((row) => row.name.toLowerCase() === departmentName)
      : undefined;
    if (!department) return empty;
    return { target: department.inscriptionTarget, current: department.registered, percent: department.rate };
  }

  return { target: region.inscriptionTarget, current: region.registered, percent: region.rate };
}
