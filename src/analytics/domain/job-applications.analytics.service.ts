// analytics/domain/job-applications.analytics.service.ts
//
// Covers S21Q01: job applications by CSP × gender × age band.
// Depends on the new OnefopJobApplicationData model (see schema.prisma.patch).

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryService } from '../core/analytics-query.service';
import { calculateRate } from '../core/analytics-utils';
import { TableName, Gender, CspCategory, AgeBand } from '../core/analytics-enums';
import type {
    AnalyticsFilter,
    PrismaAggregateResult,
} from '../core/analytics-types';
import type {
    JobApplicationRow,
    JobApplicationSummary,
    ApplicationConversionResult,
    ApplicationTrend,
    JobApplicationGroupRow,
    JobApplicationCspGroupRow,
    TrendFilter,
} from '../core/analytics-types';

@Injectable()
export class JobApplicationsAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly query: AnalyticsQueryService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // 1. Raw breakdown – CSP × gender × age band
    // ─────────────────────────────────────────────────────────────
    async getJobApplications(filter: AnalyticsFilter): Promise<JobApplicationRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: JobApplicationGroupRow[] = await (this.prisma as any).onefopJobApplicationData.groupBy({
            by: ['cspCategory', 'gender', 'ageBand'],
            where: {
                submissionId: { in: ids },
                cspCategory: { not: CspCategory.TOTAL },
                gender: { not: Gender.TOTAL },
            },
            _sum: { value: true },
            orderBy: [{ cspCategory: 'asc' }, { gender: 'asc' }, { ageBand: 'asc' }],
        });

        return rows.map((r) => ({
            cspCategory: r.cspCategory,
            gender: r.gender,
            ageBand: r.ageBand,
            count: r._sum.value ?? 0,
        }));
    }

    // ─────────────────────────────────────────────────────────────
    // 2. High-level summary
    // ─────────────────────────────────────────────────────────────
    async getJobApplicationSummary(filter: AnalyticsFilter): Promise<JobApplicationSummary> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) {
            return { totalApplications: 0, byGender: [], byCsp: [] };
        }

        const [totals, byGender, byCsp] = await Promise.all([
            (this.prisma as any).onefopJobApplicationData.aggregate({
                where: {
                    submissionId: { in: ids },
                    cspCategory: CspCategory.TOTAL,
                    gender: Gender.TOTAL,
                },
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,

            (this.prisma as any).onefopJobApplicationData.groupBy({
                by: ['gender'],
                where: {
                    submissionId: { in: ids },
                    cspCategory: CspCategory.TOTAL,
                    gender: { in: [Gender.MALE, Gender.FEMALE] },
                },
                _sum: { value: true },
            }) as Promise<{ gender: Gender; _sum: { value: number | null } }[]>,

            (this.prisma as any).onefopJobApplicationData.groupBy({
                by: ['cspCategory'],
                where: {
                    submissionId: { in: ids },
                    gender: Gender.TOTAL,
                    cspCategory: { in: [CspCategory.CADRES, CspCategory.FOREMEN, CspCategory.WORKERS] },
                },
                _sum: { value: true },
            }) as Promise<JobApplicationCspGroupRow[]>,
        ]);

        return {
            totalApplications: totals._sum.value ?? 0,
            byGender: byGender.map((r) => ({ gender: r.gender, count: r._sum.value ?? 0 })),
            byCsp: byCsp.map((r) => ({ cspCategory: r.cspCategory, count: r._sum.value ?? 0 })),
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Application → hire conversion rate
    //    Applications  = onefopJobApplicationData (S21Q01)
    //    Hires         = onefopCspGenderAge PERMANENT_HIRE totals
    //    byCsp shows both sides so analysts can spot where the
    //    funnel narrows.
    // ─────────────────────────────────────────────────────────────
    async getApplicationConversionRate(filter: AnalyticsFilter): Promise<ApplicationConversionResult> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) {
            return { totalApplications: 0, totalHires: 0, conversionRate: null, byCsp: [] };
        }

        const [appTotal, hireTotal, appByCspRaw, hireByCspRaw] = await Promise.all([
            (this.prisma as any).onefopJobApplicationData.aggregate({
                where: { submissionId: { in: ids }, cspCategory: CspCategory.TOTAL, gender: Gender.TOTAL },
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,

            (this.prisma as any).onefopCspGenderAge.aggregate({
                where: {
                    submissionId: { in: ids },
                    tableName: TableName.PERMANENT_HIRE,
                    cspCategory: CspCategory.TOTAL,
                    gender: Gender.TOTAL,
                    ageBand: AgeBand.TOTAL,
                },
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,

            (this.prisma as any).onefopJobApplicationData.groupBy({
                by: ['cspCategory'],
                where: {
                    submissionId: { in: ids },
                    gender: Gender.TOTAL,
                    cspCategory: { in: [CspCategory.CADRES, CspCategory.FOREMEN, CspCategory.WORKERS] },
                },
                _sum: { value: true },
            }) as Promise<JobApplicationCspGroupRow[]>,

            (this.prisma as any).onefopCspGenderAge.groupBy({
                by: ['cspCategory'],
                where: {
                    submissionId: { in: ids },
                    tableName: TableName.PERMANENT_HIRE,
                    gender: Gender.TOTAL,
                    ageBand: AgeBand.TOTAL,
                    cspCategory: { in: [CspCategory.CADRES, CspCategory.FOREMEN, CspCategory.WORKERS] },
                },
                _sum: { value: true },
            }) as Promise<JobApplicationCspGroupRow[]>,
        ]);

        const totalApplications = appTotal._sum.value ?? 0;
        const totalHires = hireTotal._sum.value ?? 0;

        const appMap = new Map(appByCspRaw.map((r) => [r.cspCategory, r._sum.value ?? 0]));
        const hireMap = new Map(hireByCspRaw.map((r) => [r.cspCategory, r._sum.value ?? 0]));

        const allCsp = [CspCategory.CADRES, CspCategory.FOREMEN, CspCategory.WORKERS];
        const byCsp = allCsp.map((csp) => {
            const applications = appMap.get(csp) ?? 0;
            const hires = hireMap.get(csp) ?? 0;
            return {
                cspCategory: csp,
                applications,
                hires,
                conversionRate: applications > 0 ? +((hires / applications) * 100).toFixed(1) : null,
            };
        });

        return {
            totalApplications,
            totalHires,
            conversionRate: totalApplications > 0
                ? +((totalHires / totalApplications) * 100).toFixed(1)
                : null,
            byCsp,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Application trend over time (quarterly / semester / annual)
    //    Mirrors the pattern used in RecruitmentAnalyticsService.
    // ─────────────────────────────────────────────────────────────
    async getApplicationTrends(filter: TrendFilter): Promise<ApplicationTrend[]> {
        const granularity = filter.granularity ?? 'year';
        const submissions = await this.query.resolveSubmissions(filter);

        const inRange = (filter.startYear && filter.endYear)
            ? submissions.filter((s) => s.surveyYear >= filter.startYear! && s.surveyYear <= filter.endYear!)
            : submissions;

        if (!inRange.length) return [];

        const ids = inRange.map((s) => s.id);

        const [appRows, hireRows] = await Promise.all([
            (this.prisma as any).onefopJobApplicationData.findMany({
                where: { submissionId: { in: ids }, cspCategory: CspCategory.TOTAL, gender: Gender.TOTAL },
                select: { submissionId: true, value: true },
            }) as Promise<{ submissionId: string; value: number | null }[]>,

            (this.prisma as any).onefopCspGenderAge.findMany({
                where: {
                    submissionId: { in: ids },
                    tableName: TableName.PERMANENT_HIRE,
                    cspCategory: CspCategory.TOTAL,
                    gender: Gender.TOTAL,
                    ageBand: AgeBand.TOTAL,
                },
                select: { submissionId: true, value: true },
            }) as Promise<{ submissionId: string; value: number | null }[]>,
        ]);

        const appMap = new Map(appRows.map((r) => [r.submissionId, r.value ?? 0]));
        const hireMap = new Map(hireRows.map((r) => [r.submissionId, r.value ?? 0]));

        const periodMap = new Map<string, { apps: number; hires: number }>();
        for (const s of inRange) {
            const key = this.query.periodKey(s, granularity);
            if (!periodMap.has(key)) periodMap.set(key, { apps: 0, hires: 0 });
            const stats = periodMap.get(key)!;
            stats.apps += appMap.get(s.id) ?? 0;
            stats.hires += hireMap.get(s.id) ?? 0;
        }

        return Array.from(periodMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([period, stats]) => ({
                period,
                totalApplications: stats.apps,
                totalHires: stats.hires,
                conversionRate: stats.apps > 0
                    ? +((stats.hires / stats.apps) * 100).toFixed(1)
                    : null,
            }));
    }
}