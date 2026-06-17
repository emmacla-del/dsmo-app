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
// Local aliases for economic clarity — map legacy type names to their correct meaning
type YouthRecruitmentResult = YouthEmploymentResult;
type VacancyFulfilmentResult = LaborMarketTension;
type VacancyFulfilmentByPeriod = LaborMarketTensionByPeriod;
type OccupationalDemandRow = LaborMarketCspRow;


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
    // 1. Recruitment trends — S22Q01 (permanent) + S22Q02 (temporary)
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
    // 2. Hires by demographics — S22Q01 + S22Q02
    //    Measures the share of all recruits aged 15-24 out of total
    //    recruits. Not a true youth employment rate (which requires
    //    youth population as denominator). Correctly: Youth Share of Recruitment.
    // ─────────────────────────────────────────────────────────────
    async getHiresByDemographics(filter: HiresDemographicsFilter): Promise<HireDemographicsRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const baseWhere = (tableName: string): Record<string, unknown> => {
            const w: Record<string, unknown> = {
                submissionId: { in: ids },
                tableName,
                cspCategory: { not: CspCategory.TOTAL },
                gender: { not: Gender.TOTAL },
                ageBand: { not: AgeBand.TOTAL },
            };
            if (filter.csp) w['cspCategory'] = filter.csp;
            if (filter.gender) w['gender'] = filter.gender;
            if (filter.ageBand) w['ageBand'] = filter.ageBand;
            return w;
        };

        const [permRows, tempRows]: [CspGenderAgeGroupRow[], CspGenderAgeGroupRow[]] =
            await Promise.all([
                (this.prisma as any).onefopCspGenderAge.groupBy({
                    by: ['cspCategory', 'gender', 'ageBand'],
                    where: baseWhere(TableName.PERMANENT_HIRE),
                    _sum: { value: true },
                }),
                (this.prisma as any).onefopCspGenderAge.groupBy({
                    by: ['cspCategory', 'gender', 'ageBand'],
                    where: baseWhere(TableName.TEMP_HIRE),
                    _sum: { value: true },
                }),
            ]);

        // merge permanent + temporary counts per CSP × gender × ageBand cell
        const key = (r: CspGenderAgeGroupRow) => `${r.cspCategory}|${r.gender}|${r.ageBand}`;
        const merged = new Map<string, HireDemographicsRow>();

        for (const r of permRows) {
            const k = key(r);
            merged.set(k, {
                cspCategory: r.cspCategory,
                gender: r.gender,
                ageBand: r.ageBand,
                count: r._sum.value ?? 0,
            });
        }
        for (const r of tempRows) {
            const k = key(r);
            const existing = merged.get(k);
            if (existing) {
                existing.count += r._sum.value ?? 0;
            } else {
                merged.set(k, {
                    cspCategory: r.cspCategory,
                    gender: r.gender,
                    ageBand: r.ageBand,
                    count: r._sum.value ?? 0,
                });
            }
        }

        return Array.from(merged.values()).sort((a, b) =>
            a.cspCategory.localeCompare(b.cspCategory) ||
            a.gender.localeCompare(b.gender),
        );
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Youth share of recruitment — S22Q01 + S22Q02
    //    Youth (15-24) hires and total hires must include both
    //    permanent and temporary contracts collected in the survey.
    // ─────────────────────────────────────────────────────────────
    async getYouthShareOfRecruitment(filter: AnalyticsFilter): Promise<YouthRecruitmentResult> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return { youthHires: 0, totalHires: 0, youthSharePct: 0 };

        const hireWhere = (tableName: string, ageBand: AgeBand) => ({
            submissionId: { in: ids },
            tableName,
            cspCategory: CspCategory.TOTAL,
            gender: Gender.TOTAL,
            ageBand,
        });

        const [permYouth, tempYouth, permTotal, tempTotal] = await Promise.all([
            (this.prisma as any).onefopCspGenderAge.aggregate({
                where: hireWhere(TableName.PERMANENT_HIRE, AgeBand.AGE_15_24),
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,
            (this.prisma as any).onefopCspGenderAge.aggregate({
                where: hireWhere(TableName.TEMP_HIRE, AgeBand.AGE_15_24),
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,
            (this.prisma as any).onefopCspGenderAge.aggregate({
                where: hireWhere(TableName.PERMANENT_HIRE, AgeBand.TOTAL),
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,
            (this.prisma as any).onefopCspGenderAge.aggregate({
                where: hireWhere(TableName.TEMP_HIRE, AgeBand.TOTAL),
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,
        ]);

        const youthHires = (permYouth._sum.value ?? 0) + (tempYouth._sum.value ?? 0);
        const totalHires = (permTotal._sum.value ?? 0) + (tempTotal._sum.value ?? 0);

        return {
            youthHires,
            totalHires,
            youthSharePct: calculateRate(youthHires, totalHires),
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Diploma distribution — S22Q03
    //    The questionnaire captures diploma by total recruits (no
    //    contract type split), so onefopDiplomaData is already the
    //    combined permanent + temporary count. No change needed.
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
    // 5. Vacancy fulfilment / Recruitment absorption
    //
    //    Vacancies (S1Q11/S1Q12/S1Q10/S1Q11) vs total hires (S22Q01+S22Q02).
    //    Reports: gap (unfilled positions), vacancy fulfilment rate,
    //    and occupational demand structure. Not true labour market
    //    tension (which needs job-seeker counts as denominator).
    //    byCsp is occupational demand structure, not CSP-level tension.
    // ─────────────────────────────────────────────────────────────
    async getVacancyFulfilment(
        filter: LaborMarketTensionFilter,
    ): Promise<VacancyFulfilmentResult | VacancyFulfilmentByPeriod[]> {
        const granularity = filter.granularity ?? 'annual';

        if (granularity === 'annual') {
            return this._vacancyFulfilmentForIds(await this.query.resolveSubmissionIds(filter));
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
                this._vacancyFulfilmentForIds(ids).then((tension) => ({ period, tension })),
            ),
        );
    }

    private async _vacancyFulfilmentForIds(ids: string[]): Promise<VacancyFulfilmentResult> {
        if (!ids.length) {
            return { totalVacancies: 0, totalRecruitments: 0, gap: 0, vacancyFulfilmentRate: null, occupationalDemand: [] };
        }

        const [
            enterpriseVacancies,
            cooperativeVacancies,
            ctdVacancies,
            ongVacancies,
            permanentHires,
            temporaryHires,
            permHiresByCspRaw,
            tempHiresByCspRaw,
        ] = await Promise.all([
            // vacancies from all four entity detail models (S1Q11 / S1Q12 / S1Q10 / S1Q11)
            (this.prisma as any).onefopEnterpriseDetail.findMany({
                where: { submissionId: { in: ids } },
                select: { vacancies: true },
            }) as Promise<VacancyTotalDbRow[]>,

            (this.prisma as any).onefopCooperativeDetail.findMany({
                where: { submissionId: { in: ids } },
                select: { vacancies: true },
            }) as Promise<VacancyTotalDbRow[]>,

            (this.prisma as any).onefopCtdDetail.findMany({
                where: { submissionId: { in: ids } },
                select: { vacancies: true },
            }) as Promise<VacancyTotalDbRow[]>,

            (this.prisma as any).onefopOngDetail.findMany({
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

            // CSP breakdown — permanent hires
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

            // CSP breakdown — temporary hires
            (this.prisma as any).onefopCspGenderAge.groupBy({
                by: ['cspCategory'],
                where: {
                    submissionId: { in: ids },
                    tableName: TableName.TEMP_HIRE,
                    gender: Gender.TOTAL,
                    ageBand: AgeBand.TOTAL,
                    cspCategory: { in: [CspCategory.CADRES, CspCategory.FOREMEN, CspCategory.WORKERS] },
                },
                _sum: { value: true },
                orderBy: [{ cspCategory: 'asc' }],
            }) as Promise<{ cspCategory: CspCategory; _sum: { value: number | null } }[]>,
        ]);

        const totalVacancies = [
            ...enterpriseVacancies,
            ...cooperativeVacancies,
            ...ctdVacancies,
            ...ongVacancies,
        ].reduce((sum, r) => sum + (r.vacancies ?? 0), 0);

        const totalRecruitments =
            (permanentHires._sum.value ?? 0) + (temporaryHires._sum.value ?? 0);

        const gap = totalVacancies - totalRecruitments;
        const vacancyFulfilmentRate = totalVacancies > 0
            ? +((totalRecruitments / totalVacancies) * 100).toFixed(1)
            : null;

        // merge permanent + temporary hire counts per CSP
        const hireMap = new Map<CspCategory, number>();
        for (const r of permHiresByCspRaw) {
            hireMap.set(r.cspCategory, (hireMap.get(r.cspCategory) ?? 0) + (r._sum.value ?? 0));
        }
        for (const r of tempHiresByCspRaw) {
            hireMap.set(r.cspCategory, (hireMap.get(r.cspCategory) ?? 0) + (r._sum.value ?? 0));
        }

        // Occupational demand structure: hire share per CSP.
        // Vacancies are not collected at CSP granularity in the questionnaire,
        // so this is recruitment distribution, not CSP-level tension.
        const occupationalDemand: OccupationalDemandRow[] = [
            CspCategory.CADRES,
            CspCategory.FOREMEN,
            CspCategory.WORKERS,
        ].map((csp) => {
            const hires = hireMap.get(csp) ?? 0;
            return {
                cspCategory: csp,
                hires,
                vacancies: null, // not collected at CSP granularity
                hireSharePct: calculateRate(hires, totalRecruitments > 0 ? totalRecruitments : 1),
            };
        });

        return { totalVacancies, totalRecruitments, gap, vacancyFulfilmentRate, occupationalDemand };
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

    // ─────────────────────────────────────────────────────────────
    // 6. Recruitment by location — S22Q01 + S22Q02
    // ─────────────────────────────────────────────────────────────
    async getRecruitmentByLocation(
        filter: AnalyticsFilter & { groupBy?: 'region' | 'department' | 'subdivision' },
    ): Promise<{ location: string; totalRecruitments: number; permanentRecruitments: number; temporaryRecruitments: number }[]> {
        const submissions = await this.query.resolveSubmissions(filter);
        if (!submissions.length) return [];

        const ids = submissions.map((s) => s.id);
        const groupBy = filter.groupBy ?? 'region';

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

        const locationMap = new Map<string, { permanent: number; temporary: number }>();
        for (const s of submissions) {
            const location: string = (s as any)[groupBy] ?? 'Inconnu';
            if (!locationMap.has(location)) locationMap.set(location, { permanent: 0, temporary: 0 });
            const stats = locationMap.get(location)!;
            stats.permanent += permMap.get(s.id) ?? 0;
            stats.temporary += tempMap.get(s.id) ?? 0;
        }

        return Array.from(locationMap.entries())
            .map(([location, stats]) => ({
                location,
                permanentRecruitments: stats.permanent,
                temporaryRecruitments: stats.temporary,
                totalRecruitments: stats.permanent + stats.temporary,
            }))
            .sort((a, b) => b.totalRecruitments - a.totalRecruitments);
    }
}