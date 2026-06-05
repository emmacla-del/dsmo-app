// analytics/domain/enterprise-profile.analytics.service.ts
//
// NEW service extracted from education.analytics.service.ts and extended.
// Covers all enterprise-profile dimensions from OnefopEnterpriseDetail
// and the equivalent cooperative / CTD / ONG detail models.
//
// Also absorbs getVacanciesBySegment (previously in EducationAnalyticsService)
// so that service can be deprecated or kept lean for true education analytics.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryService } from '../core/analytics-query.service';
import type { AnalyticsFilter } from '../core/analytics-types';
import type {
    EnterpriseProfileSegment,
    EnterpriseProfileDimension,
    EnterpriseProfileDbRow,
} from '../core/analytics-types';

// All text fields that can carry "Inconnu" when null
const UNKNOWN = 'Inconnu';

@Injectable()
export class EnterpriseProfileAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly query: AnalyticsQueryService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // Core: profile breakdown by any dimension
    //
    // groupBy options:
    //   legalStatus   – Sole proprietorship, SARL, SA, etc.
    //   area          – Urban / Rural (directly from the form)
    //   branch        – Branch of activity (free-text, grouped by value)
    //   mainActivity  – Primary activity (free-text, grouped by value)
    //   sector        – Sector (already available in getVacanciesBySegment)
    //   enterpriseSize– TPE / PME / GE etc.
    //
    // For cooperative / CTD / ONG submissions the equivalent detail tables
    // are queried and merged so aggregations span all entity types.
    // ─────────────────────────────────────────────────────────────
    async getEnterpriseProfileBreakdown(
        filter: AnalyticsFilter & { groupBy: EnterpriseProfileDimension },
    ): Promise<EnterpriseProfileSegment[]> {
        const submissions = await this.query.resolveSubmissions(filter);
        if (!submissions.length) return [];

        const ids = submissions.map((s) => s.id);

        // Pull from all four entity-detail tables. Each returns the same
        // shape: the groupBy field + permanentWorkers + vacancies.
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

            // Cooperatives share area/sector/branch/mainActivity fields
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

        const allRows: Partial<EnterpriseProfileDbRow>[] = [
            ...enterprise,
            ...cooperative,
            ...ctd,
            ...ong,
        ];

        return this.aggregateByDimension(allRows, filter.groupBy);
    }

    // ─────────────────────────────────────────────────────────────
    // Convenience: urban vs rural split
    //    Returns exactly two rows: Urban / Rural (+ Inconnu if any nulls).
    // ─────────────────────────────────────────────────────────────
    async getUrbanRuralSplit(filter: AnalyticsFilter): Promise<EnterpriseProfileSegment[]> {
        return this.getEnterpriseProfileBreakdown({ ...filter, groupBy: 'area' });
    }

    // ─────────────────────────────────────────────────────────────
    // Convenience: legal status distribution
    // ─────────────────────────────────────────────────────────────
    async getLegalStatusBreakdown(filter: AnalyticsFilter): Promise<EnterpriseProfileSegment[]> {
        return this.getEnterpriseProfileBreakdown({ ...filter, groupBy: 'legalStatus' });
    }

    // ─────────────────────────────────────────────────────────────
    // Convenience: top N branches by employment
    // ─────────────────────────────────────────────────────────────
    async getTopBranches(
        filter: AnalyticsFilter & { limit?: number },
    ): Promise<EnterpriseProfileSegment[]> {
        const rows = await this.getEnterpriseProfileBreakdown({ ...filter, groupBy: 'branch' });
        return filter.limit ? rows.slice(0, filter.limit) : rows;
    }

    // ─────────────────────────────────────────────────────────────
    // Convenience: top N main activities by employment
    // ─────────────────────────────────────────────────────────────
    async getTopMainActivities(
        filter: AnalyticsFilter & { limit?: number },
    ): Promise<EnterpriseProfileSegment[]> {
        const rows = await this.getEnterpriseProfileBreakdown({ ...filter, groupBy: 'mainActivity' });
        return filter.limit ? rows.slice(0, filter.limit) : rows;
    }

    // ─────────────────────────────────────────────────────────────
    // Vacancies by segment (migrated from EducationAnalyticsService)
    //    Kept here so the facade can call one service for all
    //    enterprise-profile + vacancy segmentation queries.
    // ─────────────────────────────────────────────────────────────
    async getVacanciesBySegment(
        filter: AnalyticsFilter & { groupBy: 'enterpriseSize' | 'sector' },
    ): Promise<EnterpriseProfileSegment[]> {
        return this.getEnterpriseProfileBreakdown({ ...filter, groupBy: filter.groupBy });
    }

    // ─────────────────────────────────────────────────────────────
    // Facade-facing alias: getEnterpriseProfile
    //   Called by the facade with { dimension } instead of { groupBy }.
    // ─────────────────────────────────────────────────────────────
    async getEnterpriseProfile(
        filter: AnalyticsFilter & { dimension?: EnterpriseProfileDimension },
    ): Promise<EnterpriseProfileSegment[]> {
        return this.getEnterpriseProfileBreakdown({
            ...filter,
            groupBy: filter.dimension ?? 'sector',
        });
    }

    // ─────────────────────────────────────────────────────────────
    // Registered job seekers (S23Q01)
    // ─────────────────────────────────────────────────────────────
    async getRegisteredSeekers(
        filter: AnalyticsFilter,
    ): Promise<{ total: number; male: number | null; female: number | null }> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return { total: 0, male: null, female: null };

        const rows: {
            registeredSeekers: number | null;
            registeredSeekersMale: number | null;
            registeredSeekersFemale: number | null;
        }[] = await (this.prisma as any).onefopEnterpriseDetail.findMany({
            where: { submissionId: { in: ids } },
            select: {
                registeredSeekers: true,
                registeredSeekersMale: true,
                registeredSeekersFemale: true,
            },
        });

        return {
            total: rows.reduce((sum, r) => sum + (r.registeredSeekers ?? 0), 0),
            male: rows.reduce((sum, r) => sum + (r.registeredSeekersMale ?? 0), 0),
            female: rows.reduce((sum, r) => sum + (r.registeredSeekersFemale ?? 0), 0),
        };
    }

    // ─────────────────────────────────────────────────────────────
    // First-time labour market entrants gap (S23)
    // ─────────────────────────────────────────────────────────────
    async getFirstTimeLaborGap(
        filter: AnalyticsFilter,
    ): Promise<{ registeredFirstTime: number; hiredFirstTime: number; gap: number; absorptionRate: number | null }> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return { registeredFirstTime: 0, hiredFirstTime: 0, gap: 0, absorptionRate: null };

        const rows: {
            firstTimeSeekers: number | null;
            firstTimeWorkers: number | null;
        }[] = await (this.prisma as any).onefopEnterpriseDetail.findMany({
            where: { submissionId: { in: ids } },
            select: {
                firstTimeSeekers: true,
                firstTimeWorkers: true,
            },
        });

        const registered = rows.reduce((sum, r) => sum + (r.firstTimeSeekers ?? 0), 0);
        const hired = rows.reduce((sum, r) => sum + (r.firstTimeWorkers ?? 0), 0);

        return {
            registeredFirstTime: registered,
            hiredFirstTime: hired,
            gap: registered - hired,
            absorptionRate: registered > 0 ? +((hired / registered) * 100).toFixed(1) : null,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // Private: group rows by a chosen dimension and aggregate
    // ─────────────────────────────────────────────────────────────
    private aggregateByDimension(
        rows: Partial<EnterpriseProfileDbRow>[],
        dimension: EnterpriseProfileDimension,
    ): EnterpriseProfileSegment[] {
        const map = new Map<string, { totalEmployees: number; totalVacancies: number; companyCount: number }>();

        for (const row of rows) {
            const rawKey: string | null | undefined = (row as any)[dimension];
            const key = rawKey?.trim() || UNKNOWN;

            if (!map.has(key)) map.set(key, { totalEmployees: 0, totalVacancies: 0, companyCount: 0 });
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
                avgEmployeesPerCompany: stats.companyCount > 0
                    ? Math.round(stats.totalEmployees / stats.companyCount)
                    : 0,
            }))
            .sort((a, b) => b.totalEmployees - a.totalEmployees);
    }
}