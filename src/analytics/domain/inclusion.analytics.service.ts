// analytics/domain/inclusion.analytics.service.ts  (FULL REPLACEMENT)
//
// Changes vs original:
//  • getRegisteredFirstTimeSeekers() — S23Q01, new table
//  • getFirstTimeLaborGap()          — registered vs recruited absorption
//  • getInclusionTrends()            — disability/vulnerability rates over time (P3)
//  All original methods preserved unchanged.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryService } from '../core/analytics-query.service';
import { calculateRate } from '../core/analytics-utils';

import type {
    AnalyticsFilter,
    DisabilityRow,
    VulnerableWorkerRow,
    FirstTimeWorkerRow,
    InclusionMetricsResult,
    InclusionDashboard,
    EmploymentByCspRow,
    PrismaAggregateResult,
    DisabilityGroupRow,
    VulnerableGroupRow,
    DisabledByCspGroupRow,
    VulnerableByTypeGroupRow,
    FirstTimeWorkerGroupRow,
} from '../core/analytics-types';
import type {
    RegisteredSeekerRow,
    FirstTimeLaborGapResult,
    InclusionTrendPeriod,
    RegisteredSeekerGroupRow,
    TrendFilter,
} from '../core/analytics-types';
import { TableName, Gender, CspCategory, AgeBand, StatusFlag } from '../core/analytics-enums';
import type { EmploymentAnalyticsService } from './employment.analytics.service';

@Injectable()
export class InclusionAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly query: AnalyticsQueryService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // 1. Disability data (unchanged)
    // ─────────────────────────────────────────────────────────────
    async getDisabilityData(filter: AnalyticsFilter): Promise<DisabilityRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: DisabilityGroupRow[] = await (this.prisma as any).onefopDisabilityData.groupBy({
            by: ['cspCategory', 'status', 'gender'],
            where: { submissionId: { in: ids } },
            _sum: { value: true },
            orderBy: [{ cspCategory: 'asc' }, { status: 'asc' }],
        });

        return rows.map((r) => ({ cspCategory: r.cspCategory, status: r.status, gender: r.gender, count: r._sum.value ?? 0 }));
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Vulnerable workers (unchanged)
    // ─────────────────────────────────────────────────────────────
    async getVulnerableWorkers(filter: AnalyticsFilter): Promise<VulnerableWorkerRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: VulnerableGroupRow[] = await (this.prisma as any).onefopVulnerableData.groupBy({
            by: ['vulnerableType', 'status', 'gender'],
            where: { submissionId: { in: ids } },
            _sum: { value: true },
            orderBy: [{ vulnerableType: 'asc' }, { status: 'asc' }],
        });

        return rows.map((r) => ({ vulnerableType: r.vulnerableType, status: r.status, gender: r.gender, count: r._sum.value ?? 0 }));
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Inclusion metrics (unchanged)
    // ─────────────────────────────────────────────────────────────
    async getInclusionMetrics(
        filter: AnalyticsFilter & { breakdownBy?: 'disability' | 'vulnerability' | 'both' },
    ): Promise<InclusionMetricsResult> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return { disabled: 0, vulnerable: 0, totalHires: 0, disabledByCsp: [], vulnerableByType: [] };

        const includeDisability = !filter.breakdownBy || filter.breakdownBy === 'disability' || filter.breakdownBy === 'both';
        const includeVulnerability = !filter.breakdownBy || filter.breakdownBy === 'vulnerability' || filter.breakdownBy === 'both';

        const [disabledTotal, vulnerableTotal, totalHires, disabledByCspRaw, vulnerableByTypeRaw] = await Promise.all([
            (this.prisma as any).onefopDisabilityData.aggregate({
                where: { submissionId: { in: ids }, cspCategory: CspCategory.TOTAL, status: StatusFlag.TOTAL, gender: Gender.TOTAL },
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,

            (this.prisma as any).onefopVulnerableData.aggregate({
                where: { submissionId: { in: ids }, status: StatusFlag.TOTAL, gender: Gender.TOTAL },
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,

            (this.prisma as any).onefopCspGenderAge.aggregate({
                where: { submissionId: { in: ids }, tableName: TableName.PERMANENT_HIRE, cspCategory: CspCategory.TOTAL, gender: Gender.TOTAL, ageBand: AgeBand.TOTAL },
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,

            includeDisability
                ? (this.prisma as any).onefopDisabilityData.groupBy({
                    by: ['cspCategory'],
                    where: { submissionId: { in: ids }, status: StatusFlag.TOTAL, gender: Gender.TOTAL, cspCategory: { not: CspCategory.TOTAL } },
                    _sum: { value: true },
                }) as Promise<DisabledByCspGroupRow[]>
                : Promise.resolve([] as DisabledByCspGroupRow[]),

            includeVulnerability
                ? (this.prisma as any).onefopVulnerableData.groupBy({
                    by: ['vulnerableType'],
                    where: { submissionId: { in: ids }, status: StatusFlag.TOTAL, gender: Gender.TOTAL },
                    _sum: { value: true },
                }) as Promise<VulnerableByTypeGroupRow[]>
                : Promise.resolve([] as VulnerableByTypeGroupRow[]),
        ]);

        return {
            disabled: disabledTotal._sum.value ?? 0,
            vulnerable: vulnerableTotal._sum.value ?? 0,
            totalHires: totalHires._sum.value ?? 0,
            disabledByCsp: disabledByCspRaw.map((r) => ({ cspCategory: r.cspCategory, count: r._sum.value ?? 0 })),
            vulnerableByType: vulnerableByTypeRaw.map((r) => ({ vulnerableType: r.vulnerableType, count: r._sum.value ?? 0 })),
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 4. First-time workers recruited (unchanged)
    // ─────────────────────────────────────────────────────────────
    async getFirstTimeWorkers(filter: AnalyticsFilter): Promise<FirstTimeWorkerRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: FirstTimeWorkerGroupRow[] = await (this.prisma as any).onefopFirstTimeWorker.groupBy({
            by: ['contractType', 'cspCategory', 'gender', 'ageBand'],
            where: { submissionId: { in: ids } },
            _sum: { value: true },
            orderBy: [{ contractType: 'asc' }, { cspCategory: 'asc' }],
        });

        return rows.map((r) => ({ contractType: r.contractType, cspCategory: r.cspCategory, gender: r.gender, ageBand: r.ageBand, count: r._sum.value ?? 0 }));
    }

    // ─────────────────────────────────────────────────────────────
    // 5. NEW – Registered first-time job seekers (S23Q01)
    //    These are people who registered, not necessarily hired.
    // ─────────────────────────────────────────────────────────────
    async getRegisteredFirstTimeSeekers(filter: AnalyticsFilter): Promise<RegisteredSeekerRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: RegisteredSeekerGroupRow[] = await (this.prisma as any).onefopRegisteredSeeker.groupBy({
            by: ['contractType', 'cspCategory', 'gender', 'ageBand'],
            where: { submissionId: { in: ids } },
            _sum: { value: true },
            orderBy: [{ contractType: 'asc' }, { cspCategory: 'asc' }],
        });

        return rows.map((r) => ({
            contractType: r.contractType,
            cspCategory: r.cspCategory,
            gender: r.gender,
            ageBand: r.ageBand,
            count: r._sum.value ?? 0,
        }));
    }

    // ─────────────────────────────────────────────────────────────
    // 6. NEW – First-time labor gap: registered vs recruited
    //    The absorption rate measures how effectively the market
    //    converts registered seekers into hired workers.
    //    Runs both queries in parallel then merges by CSP.
    // ─────────────────────────────────────────────────────────────
    async getFirstTimeLaborGap(filter: AnalyticsFilter): Promise<FirstTimeLaborGapResult> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) {
            return { registered: 0, recruited: 0, absorptionRate: null, byCsp: [] };
        }

        // Registered: sum across all contractTypes at TOTAL csp/gender level
        const [regTotal, recTotal, regByCspRaw, recByCspRaw] = await Promise.all([
            (this.prisma as any).onefopRegisteredSeeker.aggregate({
                where: {
                    submissionId: { in: ids },
                    cspCategory: CspCategory.TOTAL,
                    gender: Gender.TOTAL,
                },
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,

            (this.prisma as any).onefopFirstTimeWorker.aggregate({
                where: {
                    submissionId: { in: ids },
                    cspCategory: CspCategory.TOTAL,
                    gender: Gender.TOTAL,
                },
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,

            (this.prisma as any).onefopRegisteredSeeker.groupBy({
                by: ['cspCategory'],
                where: {
                    submissionId: { in: ids },
                    gender: Gender.TOTAL,
                    cspCategory: { in: [CspCategory.CADRES, CspCategory.FOREMEN, CspCategory.WORKERS] },
                },
                _sum: { value: true },
            }) as Promise<{ cspCategory: CspCategory; _sum: { value: number | null } }[]>,

            (this.prisma as any).onefopFirstTimeWorker.groupBy({
                by: ['cspCategory'],
                where: {
                    submissionId: { in: ids },
                    gender: Gender.TOTAL,
                    cspCategory: { in: [CspCategory.CADRES, CspCategory.FOREMEN, CspCategory.WORKERS] },
                },
                _sum: { value: true },
            }) as Promise<{ cspCategory: CspCategory; _sum: { value: number | null } }[]>,
        ]);

        const registered = regTotal._sum.value ?? 0;
        const recruited = recTotal._sum.value ?? 0;

        const regMap = new Map(regByCspRaw.map((r) => [r.cspCategory, r._sum.value ?? 0]));
        const recMap = new Map(recByCspRaw.map((r) => [r.cspCategory, r._sum.value ?? 0]));

        const byCsp = [CspCategory.CADRES, CspCategory.FOREMEN, CspCategory.WORKERS].map((csp) => {
            const reg = regMap.get(csp) ?? 0;
            const rec = recMap.get(csp) ?? 0;
            return {
                cspCategory: csp,
                registered: reg,
                recruited: rec,
                absorptionRate: reg > 0 ? +((rec / reg) * 100).toFixed(1) : null,
            };
        });

        return {
            registered,
            recruited,
            absorptionRate: registered > 0 ? +((recruited / registered) * 100).toFixed(1) : null,
            byCsp,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 7. NEW (P3) – Inclusion trends over time
    //    Disability rate and vulnerability rate by quarter/semester.
    // ─────────────────────────────────────────────────────────────
    async getInclusionTrends(filter: TrendFilter): Promise<InclusionTrendPeriod[]> {
        const granularity = filter.granularity ?? 'year';
        const submissions = await this.query.resolveSubmissions(filter);

        const inRange = (filter.startYear && filter.endYear)
            ? submissions.filter((s) => s.surveyYear >= filter.startYear! && s.surveyYear <= filter.endYear!)
            : submissions;

        if (!inRange.length) return [];

        // Group submission IDs by period first, then run one DB call per period.
        // Periods are typically ≤8, so this is acceptable (avoids a complex
        // GROUP BY submissionId join that Prisma can't express cleanly).
        const periodMap = new Map<string, string[]>();
        for (const s of inRange) {
            const key = this.query.periodKey(s, granularity);
            if (!periodMap.has(key)) periodMap.set(key, []);
            periodMap.get(key)!.push(s.id);
        }

        const periods = Array.from(periodMap.entries()).sort(([a], [b]) => a.localeCompare(b));

        return Promise.all(
            periods.map(async ([period, ids]) => {
                const [disabledAgg, vulnerableAgg, employmentAgg] = await Promise.all([
                    (this.prisma as any).onefopDisabilityData.aggregate({
                        where: { submissionId: { in: ids }, cspCategory: CspCategory.TOTAL, status: StatusFlag.TOTAL, gender: Gender.TOTAL },
                        _sum: { value: true },
                    }) as Promise<PrismaAggregateResult>,

                    (this.prisma as any).onefopVulnerableData.aggregate({
                        where: { submissionId: { in: ids }, status: StatusFlag.TOTAL, gender: Gender.TOTAL },
                        _sum: { value: true },
                    }) as Promise<PrismaAggregateResult>,

                    (this.prisma as any).onefopCspGenderAge.aggregate({
                        where: { submissionId: { in: ids }, tableName: TableName.WORKFORCE, cspCategory: CspCategory.TOTAL, gender: Gender.TOTAL, ageBand: AgeBand.TOTAL },
                        _sum: { value: true },
                    }) as Promise<PrismaAggregateResult>,
                ]);

                const disabledCount = disabledAgg._sum.value ?? 0;
                const vulnerableCount = vulnerableAgg._sum.value ?? 0;
                const totalEmployees = employmentAgg._sum.value ?? 0;

                return {
                    period,
                    disabledCount,
                    vulnerableCount,
                    totalEmployees,
                    disabilityRate: calculateRate(disabledCount, totalEmployees),
                    vulnerableRate: calculateRate(vulnerableCount, totalEmployees),
                };
            }),
        );
    }

    // ─────────────────────────────────────────────────────────────
    // 8. Inclusion dashboard – compute (unchanged)
    // ─────────────────────────────────────────────────────────────
    computeInclusionDashboard(
        totalEmployees: number,
        inclusion: InclusionMetricsResult,
        cspRows: EmploymentByCspRow[],
        computeFemaleLeadershipRate: (cspRows: EmploymentByCspRow[]) => number,
    ): InclusionDashboard {
        return {
            disabilityRate: calculateRate(inclusion.disabled, totalEmployees),
            vulnerableRate: calculateRate(inclusion.vulnerable, totalEmployees),
            femaleLeadershipRate: computeFemaleLeadershipRate(cspRows),
            disabledCount: inclusion.disabled,
            vulnerableCount: inclusion.vulnerable,
        };
    }

    async getInclusionDashboard(
        filter: AnalyticsFilter,
        employmentService: Pick<EmploymentAnalyticsService, 'getEmploymentSummary' | 'getEmploymentByCsp' | 'computeFemaleLeadershipRate'>,
    ): Promise<InclusionDashboard> {
        const [employment, inclusion, cspRows] = await Promise.all([
            employmentService.getEmploymentSummary(filter),
            this.getInclusionMetrics(filter),
            employmentService.getEmploymentByCsp(filter),
        ]);
        return this.computeInclusionDashboard(
            employment.totalEmployees,
            inclusion,
            cspRows,
            (rows) => employmentService.computeFemaleLeadershipRate(rows),
        );
    }
}