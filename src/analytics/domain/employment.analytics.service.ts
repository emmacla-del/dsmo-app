// analytics/domain/employment.analytics.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryService } from '../core/analytics-query.service';
import { calculateRate, computeAverageAge, computeFemaleLeadershipRate } from '../core/analytics-utils';
import { TableName, Gender, CspCategory, AgeBand } from '../core/analytics-enums';
import type {
    AnalyticsFilter,
    EmploymentSummary,
    EmploymentByCspRow,
    EmploymentLocation,
    GenderParityResult,
    WorkforceSnapshot,
    PrismaAggregateResult,
    CspGenderAgeGroupRow,
    GenderGroupRow,
    CspGroupRow,
    LocationTotalDbRow,
} from '../core/analytics-types';

@Injectable()
export class EmploymentAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly query: AnalyticsQueryService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // Shared helper: sum rows matching a predicate
    // ─────────────────────────────────────────────────────────────
    sumRows(
        rows: EmploymentByCspRow[],
        predicate: (row: EmploymentByCspRow) => boolean,
    ): number {
        return rows.filter(predicate).reduce((sum, row) => sum + row.total, 0);
    }

    // ─────────────────────────────────────────────────────────────
    // 1. Employment summary
    // ─────────────────────────────────────────────────────────────
    async getEmploymentSummary(filter: AnalyticsFilter): Promise<EmploymentSummary> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return { totalEmployees: 0, byGender: [], byCsp: [] };

        const [totals, byGender, byCsp] = await Promise.all([
            (this.prisma as any).onefopCspGenderAge.aggregate({
                where: { submissionId: { in: ids }, tableName: TableName.WORKFORCE, cspCategory: CspCategory.TOTAL, gender: Gender.TOTAL, ageBand: AgeBand.TOTAL },
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,

            (this.prisma as any).onefopCspGenderAge.groupBy({
                by: ['gender'],
                where: { submissionId: { in: ids }, tableName: TableName.WORKFORCE, cspCategory: CspCategory.TOTAL, ageBand: AgeBand.TOTAL, gender: { in: [Gender.MALE, Gender.FEMALE] } },
                _sum: { value: true },
            }) as Promise<GenderGroupRow[]>,

            (this.prisma as any).onefopCspGenderAge.groupBy({
                by: ['cspCategory'],
                where: { submissionId: { in: ids }, tableName: TableName.WORKFORCE, gender: Gender.TOTAL, ageBand: AgeBand.TOTAL, cspCategory: { in: [CspCategory.CADRES, CspCategory.FOREMEN, CspCategory.WORKERS] } },
                _sum: { value: true },
            }) as Promise<CspGroupRow[]>,
        ]);

        return {
            totalEmployees: totals._sum.value ?? 0,
            byGender: byGender.map((r) => ({ gender: r.gender, count: r._sum.value ?? 0 })),
            byCsp: byCsp.map((r) => ({ cspCategory: r.cspCategory, count: r._sum.value ?? 0 })),
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Full CSP × Gender × AgeBand breakdown
    // ─────────────────────────────────────────────────────────────
    async getEmploymentByCsp(filter: AnalyticsFilter): Promise<EmploymentByCspRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: CspGenderAgeGroupRow[] = await (this.prisma as any).onefopCspGenderAge.groupBy({
            by: ['tableName', 'cspCategory', 'gender', 'ageBand'],
            where: { submissionId: { in: ids } },
            _sum: { value: true },
            orderBy: [{ tableName: 'asc' }, { cspCategory: 'asc' }, { gender: 'asc' }, { ageBand: 'asc' }],
        });

        return rows.map((r) => ({
            tableName: r.tableName,
            cspCategory: r.cspCategory,
            gender: r.gender,
            ageBand: r.ageBand,
            total: r._sum.value ?? 0,
        }));
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Employment by location
    // ─────────────────────────────────────────────────────────────
    async getEmploymentByLocation(
        filter: AnalyticsFilter & { groupBy: 'region' | 'department' | 'subdivision' },
    ): Promise<EmploymentLocation[]> {
        const submissions = await this.query.resolveSubmissions(filter);
        if (!submissions.length) return [];

        const ids = submissions.map((s) => s.id);

        const totals: LocationTotalDbRow[] = await (this.prisma as any).onefopCspGenderAge.findMany({
            where: { submissionId: { in: ids }, tableName: TableName.WORKFORCE, cspCategory: CspCategory.TOTAL, gender: Gender.TOTAL, ageBand: AgeBand.TOTAL },
            select: { submissionId: true, value: true },
        });

        const valueBySubmission = new Map<string, number>(totals.map((t) => [t.submissionId, t.value ?? 0]));

        const map = new Map<string, { totalEmployees: number; companyCount: number }>();
        for (const s of submissions) {
            const key = filter.groupBy === 'region'
                ? (s.region ?? 'Inconnu')
                : filter.groupBy === 'department'
                    ? (s.department ?? 'Inconnu')
                    : (s.subdivision ?? 'Inconnu');

            if (!map.has(key)) map.set(key, { totalEmployees: 0, companyCount: 0 });
            const stats = map.get(key)!;
            stats.totalEmployees += valueBySubmission.get(s.id) ?? 0;
            stats.companyCount += 1;
        }

        return Array.from(map.entries())
            .map(([name, stats]) => ({
                name,
                totalEmployees: stats.totalEmployees,
                companyCount: stats.companyCount,
                avgEmployeesPerCompany: stats.companyCount > 0 ? Math.round(stats.totalEmployees / stats.companyCount) : 0,
            }))
            .sort((a, b) => b.totalEmployees - a.totalEmployees);
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Gender parity
    // ─────────────────────────────────────────────────────────────
    async getGenderParity(filter: AnalyticsFilter): Promise<GenderParityResult> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return { maleCount: 0, femaleCount: 0, malePercentage: 0, femalePercentage: 0, ratioFemaleToMale: null };

        const rows: GenderGroupRow[] = await (this.prisma as any).onefopCspGenderAge.groupBy({
            by: ['gender'],
            where: { submissionId: { in: ids }, tableName: TableName.WORKFORCE, cspCategory: CspCategory.TOTAL, ageBand: AgeBand.TOTAL, gender: { in: [Gender.MALE, Gender.FEMALE] } },
            _sum: { value: true },
        });

        const male = rows.find((r) => r.gender === Gender.MALE)?._sum?.value ?? 0;
        const female = rows.find((r) => r.gender === Gender.FEMALE)?._sum?.value ?? 0;
        const total = male + female;

        return {
            maleCount: male,
            femaleCount: female,
            malePercentage: calculateRate(male, total),
            femalePercentage: calculateRate(female, total),
            ratioFemaleToMale: male > 0 ? +(female / male).toFixed(2) : null,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Workforce snapshot (aggregate)
    // ─────────────────────────────────────────────────────────────
    async getWorkforceSnapshot(filter: AnalyticsFilter): Promise<WorkforceSnapshot> {
        const [employment, cspRows, genderParity] = await Promise.all([
            this.getEmploymentSummary(filter),
            this.getEmploymentByCsp(filter),
            this.getGenderParity(filter),
        ]);
        return this.computeWorkforceSnapshot(employment, cspRows, genderParity);
    }

    computeWorkforceSnapshot(
        employment: EmploymentSummary,
        cspRows: EmploymentByCspRow[],
        genderParity: GenderParityResult,
    ): WorkforceSnapshot {
        const totalEmployees = employment.totalEmployees;
        if (totalEmployees === 0) return { totalEmployees: 0, cadres: 0, foremen: 0, workers: 0, male: 0, female: 0, youth: 0, averageAge: 0 };

        const workforceRow = (csp: CspCategory, gender: Gender, ageBand: AgeBand) =>
            (r: EmploymentByCspRow) =>
                r.tableName === TableName.WORKFORCE &&
                r.cspCategory === csp &&
                r.gender === gender &&
                r.ageBand === ageBand;

        const cadres = this.sumRows(cspRows, workforceRow(CspCategory.CADRES, Gender.TOTAL, AgeBand.TOTAL));
        const foremen = this.sumRows(cspRows, workforceRow(CspCategory.FOREMEN, Gender.TOTAL, AgeBand.TOTAL));
        const workers = this.sumRows(cspRows, workforceRow(CspCategory.WORKERS, Gender.TOTAL, AgeBand.TOTAL));
        const youth = this.sumRows(cspRows, workforceRow(CspCategory.TOTAL, Gender.TOTAL, AgeBand.AGE_15_24));
        const age15_24 = youth;
        const age25_34 = this.sumRows(cspRows, workforceRow(CspCategory.TOTAL, Gender.TOTAL, AgeBand.AGE_25_34));
        const age35Plus = this.sumRows(cspRows, workforceRow(CspCategory.TOTAL, Gender.TOTAL, AgeBand.AGE_35_PLUS));

        return {
            totalEmployees,
            cadres,
            foremen,
            workers,
            male: genderParity.maleCount,
            female: genderParity.femaleCount,
            youth,
            averageAge: computeAverageAge(age15_24, age25_34, age35Plus),
        };
    }

    computeFemaleLeadershipRate(cspRows: EmploymentByCspRow[]): number {
        const femaleCadres = this.sumRows(
            cspRows,
            (r) => r.tableName === TableName.WORKFORCE && r.cspCategory === CspCategory.CADRES && r.gender === Gender.FEMALE && r.ageBand === AgeBand.TOTAL,
        );
        const totalCadres = this.sumRows(
            cspRows,
            (r) => r.tableName === TableName.WORKFORCE && r.cspCategory === CspCategory.CADRES && r.gender !== Gender.TOTAL && r.ageBand === AgeBand.TOTAL,
        );
        return computeFemaleLeadershipRate(femaleCadres, totalCadres);
    }
}