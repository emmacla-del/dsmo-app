// analytics/domain/inclusion.analytics.service.ts

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
import { TableName, Gender, CspCategory, AgeBand, StatusFlag } from '../core/analytics-enums';
import type { EmploymentAnalyticsService } from './employment.analytics.service';

@Injectable()
export class InclusionAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly query: AnalyticsQueryService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // 1. Disability data
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
    // 2. Vulnerable workers
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
    // 3. Inclusion metrics
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
    // 4. First-time workers
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
    // 5. Inclusion dashboard (aggregate) — employment injected by facade
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