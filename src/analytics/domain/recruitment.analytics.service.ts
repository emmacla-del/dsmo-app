// analytics/domain/recruitment.analytics.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryService } from '../core/analytics-query.service';
import { calculateRate } from '../core/analytics-utils';
import { TableName, Gender, CspCategory, AgeBand, DiplomaFlag } from '../core/analytics-enums';
import type {
    AnalyticsFilter,
    RecruitmentTrendFilter,
    LaborMarketTensionFilter,
    RecruitmentTrend,
    HireDemographicsRow,
    YouthEmploymentResult,
    DiplomaSummaryRow,
    DiplomaDistributionRow,
    LaborMarketTension,
    LaborMarketTensionByPeriod,
    LaborMarketCspRow,
    VacancyTotalDbRow,
    SubmissionMeta,
    PrismaAggregateResult,
    CspGenderAgeGroupRow,
    DiplomaGroupRow,
    DiplomaSummaryGroupRow,
    RecruitmentDbRow,
} from '../core/analytics-types';

// ─────────────────────────────────────────────────────────────
// Inline filter shapes for getHiresByDemographics —
// use enum members instead of raw string literals.
// ─────────────────────────────────────────────────────────────
type HiresDemographicsFilter = AnalyticsFilter & {
    csp?: CspCategory.CADRES | CspCategory.FOREMEN | CspCategory.WORKERS;
    gender?: Gender.MALE | Gender.FEMALE;
    ageBand?: AgeBand.AGE_15_24 | AgeBand.AGE_25_34 | AgeBand.AGE_35_PLUS;
};

@Injectable()
export class RecruitmentAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly query: AnalyticsQueryService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // 1. Recruitment trends
    // ─────────────────────────────────────────────────────────────
    async getRecruitmentTrends(filter: RecruitmentTrendFilter): Promise<RecruitmentTrend[]> {
        if (filter.startYear > filter.endYear) return [];

        const submissions = await this.query.resolveSubmissions(filter);
        const inRange = submissions.filter(
            (s) => s.surveyYear >= filter.startYear && s.surveyYear <= filter.endYear,
        );
        if (!inRange.length) return [];

        const ids = inRange.map((s) => s.id);

        const [permanent, temporary] = await Promise.all([
            (this.prisma as any).onefopCspGenderAge.findMany({
                where: {
                    submissionId: { in: ids },
                    tableName: TableName.PERMANENT_HIRE,
                    cspCategory: CspCategory.TOTAL,
                    gender: Gender.TOTAL,
                    ageBand: AgeBand.TOTAL,
                },
                select: { submissionId: true, value: true },
            }) as Promise<RecruitmentDbRow[]>,
            (this.prisma as any).onefopCspGenderAge.findMany({
                where: {
                    submissionId: { in: ids },
                    tableName: TableName.TEMP_HIRE,
                    cspCategory: CspCategory.TOTAL,
                    gender: Gender.TOTAL,
                    ageBand: AgeBand.TOTAL,
                },
                select: { submissionId: true, value: true },
            }) as Promise<RecruitmentDbRow[]>,
        ]);

        const permMap = new Map(permanent.map((r) => [r.submissionId, r.value ?? 0]));
        const tempMap = new Map(temporary.map((r) => [r.submissionId, r.value ?? 0]));

        const trendsMap = new Map<string, { permanent: number; temporary: number }>();
        for (const s of inRange) {
            const key = this.query.periodKey(s, filter.granularity);
            if (!trendsMap.has(key)) trendsMap.set(key, { permanent: 0, temporary: 0 });
            const stats = trendsMap.get(key)!;
            stats.permanent += permMap.get(s.id) ?? 0;
            stats.temporary += tempMap.get(s.id) ?? 0;
        }

        return Array.from(trendsMap.entries())
            .map(([period, stats]) => ({
                period,
                permanentRecruitments: stats.permanent,
                temporaryRecruitments: stats.temporary,
                totalRecruitments: stats.permanent + stats.temporary,
            }))
            .sort((a, b) => a.period.localeCompare(b.period));
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Hires by demographics
    // ─────────────────────────────────────────────────────────────
    async getHiresByDemographics(filter: HiresDemographicsFilter): Promise<HireDemographicsRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const where: Record<string, unknown> = {
            submissionId: { in: ids },
            tableName: TableName.PERMANENT_HIRE,
            cspCategory: { not: CspCategory.TOTAL },
            gender: { not: Gender.TOTAL },
            ageBand: { not: AgeBand.TOTAL },
        };

        if (filter.csp) where['cspCategory'] = filter.csp;
        if (filter.gender) where['gender'] = filter.gender;
        if (filter.ageBand) where['ageBand'] = filter.ageBand;

        const rows: CspGenderAgeGroupRow[] = await (this.prisma as any).onefopCspGenderAge.groupBy({
            by: ['cspCategory', 'gender', 'ageBand'],
            where,
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
    // 3. Youth employment
    // ─────────────────────────────────────────────────────────────
    async getYouthEmployment(filter: AnalyticsFilter): Promise<YouthEmploymentResult> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return { youthHires: 0, totalHires: 0, youthPercentage: 0 };

        const [youth, total] = await Promise.all([
            (this.prisma as any).onefopCspGenderAge.aggregate({
                where: {
                    submissionId: { in: ids },
                    tableName: TableName.PERMANENT_HIRE,
                    cspCategory: CspCategory.TOTAL,
                    gender: Gender.TOTAL,
                    ageBand: AgeBand.AGE_15_24,
                },
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
        ]);

        const youthCount = youth._sum.value ?? 0;
        const totalCount = total._sum.value ?? 0;

        return {
            youthHires: youthCount,
            totalHires: totalCount,
            youthPercentage: calculateRate(youthCount, totalCount),
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Diploma distribution
    // ─────────────────────────────────────────────────────────────
    async getDiplomaDistribution(filter: AnalyticsFilter): Promise<DiplomaDistributionRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: DiplomaGroupRow[] = await (this.prisma as any).onefopDiplomaData.groupBy({
            by: ['diploma', 'gender', 'ageBand'],
            where: { submissionId: { in: ids }, diploma: { not: DiplomaFlag.TOTAL } },
            _sum: { value: true },
            orderBy: [{ diploma: 'asc' }, { gender: 'asc' }],
        });

        return rows.map((r) => ({
            diploma: r.diploma,
            gender: r.gender,
            ageBand: r.ageBand,
            count: r._sum.value ?? 0,
        }));
    }

    async getDiplomaSummary(filter: AnalyticsFilter & { limit?: number }): Promise<DiplomaSummaryRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: DiplomaSummaryGroupRow[] = await (this.prisma as any).onefopDiplomaData.groupBy({
            by: ['diploma'],
            where: {
                submissionId: { in: ids },
                gender: Gender.TOTAL,
                ageBand: AgeBand.TOTAL,
                diploma: { not: DiplomaFlag.TOTAL },
            },
            _sum: { value: true },
            orderBy: { _sum: { value: 'desc' } },
        });

        const result = rows.map((r) => ({ diploma: r.diploma, total: r._sum.value ?? 0 }));
        return filter.limit ? result.slice(0, filter.limit) : result;
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Labor market tension
    //
    // Vacancies come from onefopEnterpriseDetail (enterprise-level total).
    // Hires come from s22q01 + s22q02 (permanent + temporary).
    // CSP breakdown is available on the hires side only — the survey does not
    // capture vacancies at CSP granularity.
    //
    // granularity:
    //   'annual'   (default) — aggregate all matching submissions → LaborMarketTension
    //   'quarter'            — one result per quarter code        → LaborMarketTensionByPeriod[]
    //   'semester'           — one result per semester            → LaborMarketTensionByPeriod[]
    // ─────────────────────────────────────────────────────────────
    async getLaborMarketTension(
        filter: LaborMarketTensionFilter,
    ): Promise<LaborMarketTension | LaborMarketTensionByPeriod[]> {
        const granularity = filter.granularity ?? 'annual';

        if (granularity === 'annual') {
            return this._tensionForIds(await this.query.resolveSubmissionIds(filter));
        }

        const submissions = await this.query.resolveSubmissions(filter);
        if (!submissions.length) return [];

        const periodMap = new Map<string, string[]>();
        for (const s of submissions) {
            const key = granularity === 'quarter'
                ? this._quarterKey(s)
                : this._semesterKey(s);
            if (!periodMap.has(key)) periodMap.set(key, []);
            periodMap.get(key)!.push(s.id);
        }

        const periods = Array.from(periodMap.entries()).sort(([a], [b]) => a.localeCompare(b));
        return Promise.all(
            periods.map(([period, ids]) =>
                this._tensionForIds(ids).then((tension) => ({ period, tension })),
            ),
        );
    }

    // ─── Private: compute tension for a fixed set of submission IDs ───

    private async _tensionForIds(ids: string[]): Promise<LaborMarketTension> {
        if (!ids.length) {
            return { totalVacancies: 0, totalRecruitments: 0, gap: 0, absorptionRate: null, byCsp: [] };
        }

        const [vacancyRows, permanentHires, temporaryHires, hiresByCspRaw] = await Promise.all([
            (this.prisma as any).onefopEnterpriseDetail.findMany({
                where: { submissionId: { in: ids } },
                select: { vacancies: true },
            }) as Promise<VacancyTotalDbRow[]>,

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

            (this.prisma as any).onefopCspGenderAge.aggregate({
                where: {
                    submissionId: { in: ids },
                    tableName: TableName.TEMP_HIRE,
                    cspCategory: CspCategory.TOTAL,
                    gender: Gender.TOTAL,
                    ageBand: AgeBand.TOTAL,
                },
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,

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
                orderBy: [{ cspCategory: 'asc' }],
            }) as Promise<{ cspCategory: CspCategory; _sum: { value: number | null } }[]>,
        ]);

        const totalVacancies = vacancyRows.reduce((sum, r) => sum + (r.vacancies ?? 0), 0);
        const totalRecruitments = (permanentHires._sum.value ?? 0) + (temporaryHires._sum.value ?? 0);
        const gap = totalVacancies - totalRecruitments;
        const absorptionRate = totalVacancies > 0
            ? +((totalRecruitments / totalVacancies) * 100).toFixed(1)
            : null;

        const byCsp: LaborMarketCspRow[] = hiresByCspRaw.map((r) => ({
            cspCategory: r.cspCategory,
            hires: r._sum.value ?? 0,
            vacancies: null,
            hireSharePct: calculateRate(r._sum.value ?? 0, totalRecruitments > 0 ? totalRecruitments : 1),
        }));

        return { totalVacancies, totalRecruitments, gap, absorptionRate, byCsp };
    }

    private _quarterKey(s: SubmissionMeta): string {
        if (s.quarterCode) return s.quarterCode;
        return `${s.surveyYear}-T${Math.ceil((s.createdAt.getMonth() + 1) / 3)}`;
    }

    private _semesterKey(s: SubmissionMeta): string {
        return `${s.surveyYear}-S${s.createdAt.getMonth() < 6 ? 1 : 2}`;
    }

    /** Alias for frontend compatibility */
    async getHiresByDiploma(filter: AnalyticsFilter & { limit?: number }): Promise<DiplomaSummaryRow[]> {
        return this.getDiplomaSummary(filter);
    }
}