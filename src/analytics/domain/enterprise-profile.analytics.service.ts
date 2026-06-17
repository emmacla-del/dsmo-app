// analytics/domain/enterprise-profile.analytics.service.ts
//
// Covers all entity-profile dimensions from Section 1 of all 4 questionnaires.
//
// Source mapping:
//   S1Q01 → legalStatus         (Enterprise only)
//   S1Q04 → area                (Urban / Rural — all entity types)
//   S1Q07 → sector              (all entity types)
//   S1Q08 → branch              (all entity types)
//   S1Q08/S1Q09 → mainActivity  (Enterprise / Cooperative / ONG)
//   S1Q12 → enterpriseSize      (Enterprise only: TPE/PE/ME/GE)
//   S1Q10/S1Q11/S1Q09 → permanentWorkers  (scalar per entity, see employment service)
//   S1Q11/S1Q12/S1Q10/S1Q11 → vacancies  (scalar per entity)
//
// NOTE on S23Q01 / S23Q02 (registered seekers / first-time workers):
//   These are stored in onefopRegisteredSeeker and onefopFirstTimeWorker.
//   They are NOT columns on the entity detail tables.
//   The correct implementations for those queries live in
//   InclusionAnalyticsService. This service does NOT duplicate them.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryService } from '../core/analytics-query.service';
import type { AnalyticsFilter } from '../core/analytics-types';
import type {
    EnterpriseProfileSegment,
    EnterpriseProfileDimension,
    EnterpriseProfileDbRow,
} from '../core/analytics-types';

const UNKNOWN = 'Inconnu';

@Injectable()
export class EnterpriseProfileAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly query: AnalyticsQueryService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // Core: profile breakdown by any Section 1 dimension.
    //
    // groupBy options:
    //   legalStatus   — S1Q01 (Enterprise only)
    //   area          — S1Q04 Urban/Rural (all entity types)
    //   branch        — S1Q08 (all entity types)
    //   mainActivity  — S1Q08/S1Q09 (Enterprise / Cooperative / ONG)
    //   sector        — S1Q07 (all entity types)
    //   enterpriseSize— S1Q12 (Enterprise only: TPE/PE/ME/GE)
    //
    // All four entity detail tables are queried in parallel and merged
    // so aggregations span all entity types. Fields not collected for
    // a given type (e.g. legalStatus for CTD) resolve to UNKNOWN.
    // ─────────────────────────────────────────────────────────────
    async getEnterpriseProfileBreakdown(
        filter: AnalyticsFilter & { groupBy: EnterpriseProfileDimension },
    ): Promise<EnterpriseProfileSegment[]> {
        const submissions = await this.query.resolveSubmissions(filter);
        if (!submissions.length) return [];

        const ids = submissions.map((s) => s.id);

        const [enterprise, cooperative, ctd, ong] = await Promise.all([
            (this.prisma as any).onefopEnterpriseDetail.findMany({
                where: { submissionId: { in: ids } },
                select: {
                    legalStatus: true,
                    area: true,
                    branch: true,
                    mainActivity: true,
                    sector: true,
                    enterpriseSize: true,
                    permanentWorkers: true,
                    vacancies: true,
                },
            }) as Promise<EnterpriseProfileDbRow[]>,

            (this.prisma as any).onefopCooperativeDetail.findMany({
                where: { submissionId: { in: ids } },
                select: {
                    area: true,
                    sector: true,
                    branch: true,
                    mainActivity: true,
                    permanentWorkers: true,
                    vacancies: true,
                },
            }) as Promise<Partial<EnterpriseProfileDbRow>[]>,

            (this.prisma as any).onefopCtdDetail.findMany({
                where: { submissionId: { in: ids } },
                select: {
                    area: true,
                    sector: true,
                    branch: true,
                    permanentWorkers: true,
                    vacancies: true,
                },
            }) as Promise<Partial<EnterpriseProfileDbRow>[]>,

            (this.prisma as any).onefopOngDetail.findMany({
                where: { submissionId: { in: ids } },
                select: {
                    area: true,
                    sector: true,
                    branch: true,
                    permanentWorkers: true,
                    vacancies: true,
                },
            }) as Promise<Partial<EnterpriseProfileDbRow>[]>,
        ]);

        return this.aggregateByDimension(
            [...enterprise, ...cooperative, ...ctd, ...ong],
            filter.groupBy,
        );
    }

    // ─────────────────────────────────────────────────────────────
    // Convenience methods
    // ─────────────────────────────────────────────────────────────

    /** S1Q04 Urban / Rural split across all entity types */
    async getUrbanRuralSplit(filter: AnalyticsFilter): Promise<EnterpriseProfileSegment[]> {
        return this.getEnterpriseProfileBreakdown({ ...filter, groupBy: 'area' });
    }

    /** S1Q01 legal status distribution (Enterprise only) */
    async getLegalStatusBreakdown(filter: AnalyticsFilter): Promise<EnterpriseProfileSegment[]> {
        return this.getEnterpriseProfileBreakdown({ ...filter, groupBy: 'legalStatus' });
    }

    /** S1Q08 top branches by permanent employees */
    async getTopBranches(
        filter: AnalyticsFilter & { limit?: number },
    ): Promise<EnterpriseProfileSegment[]> {
        const rows = await this.getEnterpriseProfileBreakdown({ ...filter, groupBy: 'branch' });
        return filter.limit ? rows.slice(0, filter.limit) : rows;
    }

    /** S1Q08/S1Q09 top main activities by permanent employees */
    async getTopMainActivities(
        filter: AnalyticsFilter & { limit?: number },
    ): Promise<EnterpriseProfileSegment[]> {
        const rows = await this.getEnterpriseProfileBreakdown({ ...filter, groupBy: 'mainActivity' });
        return filter.limit ? rows.slice(0, filter.limit) : rows;
    }

    /** Vacancies grouped by enterpriseSize (S1Q12) or sector (S1Q07) */
    async getVacanciesBySegment(
        filter: AnalyticsFilter & { groupBy: 'enterpriseSize' | 'sector' },
    ): Promise<EnterpriseProfileSegment[]> {
        return this.getEnterpriseProfileBreakdown({ ...filter, groupBy: filter.groupBy });
    }

    /** Facade alias — accepts { dimension } instead of { groupBy } */
    async getEnterpriseProfile(
        filter: AnalyticsFilter & { dimension?: EnterpriseProfileDimension },
    ): Promise<EnterpriseProfileSegment[]> {
        return this.getEnterpriseProfileBreakdown({
            ...filter,
            groupBy: filter.dimension ?? 'sector',
        });
    }

    // ─────────────────────────────────────────────────────────────
    // Private: group and aggregate rows by dimension
    // ─────────────────────────────────────────────────────────────
    private aggregateByDimension(
        rows: Partial<EnterpriseProfileDbRow>[],
        dimension: EnterpriseProfileDimension,
    ): EnterpriseProfileSegment[] {
        const map = new Map<string, {
            totalEmployees: number;
            totalVacancies: number;
            companyCount: number;
        }>();

        for (const row of rows) {
            const rawKey: string | null | undefined = (row as any)[dimension];
            const key = rawKey?.trim() || UNKNOWN;

            if (!map.has(key)) {
                map.set(key, { totalEmployees: 0, totalVacancies: 0, companyCount: 0 });
            }
            const stats = map.get(key)!;
            stats.totalEmployees += row.permanentWorkers ?? 0;
            stats.totalVacancies += row.vacancies ?? 0;
            stats.companyCount += 1;
        }

        return Array.from(map.entries())
            .map(([segment, stats]) => ({
                segment,
                companyCount: stats.companyCount,
                totalEmployees: stats.totalEmployees,
                totalVacancies: stats.totalVacancies,
                avgEmployeesPerCompany:
                    stats.companyCount > 0
                        ? Math.round(stats.totalEmployees / stats.companyCount)
                        : 0,
            }))
            .sort((a, b) => b.totalEmployees - a.totalEmployees);
    }
}