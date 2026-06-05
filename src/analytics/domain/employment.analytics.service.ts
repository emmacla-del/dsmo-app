// analytics/domain/employment.analytics.service.ts  (FULL REPLACEMENT)
//
// Changes vs original:
//  • getGenderParityByCsp()      — parity broken down per CSP category (P2)
//  • getWorkforceYouth()         — youth count + rate from workforce stock (P2)
//  • computeWorkforceSnapshot()  — now returns youthRate; averageAge is number|null (bugfix)
//  • computeAverageAge internal  — returns null when all bands are zero (bugfix)
//  All original methods preserved with identical signatures.

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
import type {
    GenderParityByCspRow,
    CspGenderGroupRow,
    WorkforceYouthResult,

} from '../core/analytics-types';

@Injectable()
export class EmploymentAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly query: AnalyticsQueryService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // Shared helper
    // ─────────────────────────────────────────────────────────────
    sumRows(
        rows: EmploymentByCspRow[],
        predicate: (row: EmploymentByCspRow) => boolean,
    ): number {
        return rows.filter(predicate).reduce((sum, row) => sum + row.total, 0);
    }

    // ─────────────────────────────────────────────────────────────
    // 1. Employment summary (unchanged)
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
    // 2. Full CSP × Gender × AgeBand breakdown (unchanged)
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
    // 3. Employment by location (unchanged)
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
    // 4. Gender parity – total level (unchanged)
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
    // 5. NEW – Gender parity broken down by CSP category (P2)
    //    Answers: "where in the org chart is the gender gap worst?"
    // ─────────────────────────────────────────────────────────────
    async getGenderParityByCsp(filter: AnalyticsFilter): Promise<GenderParityByCspRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: CspGenderGroupRow[] = await (this.prisma as any).onefopCspGenderAge.groupBy({
            by: ['cspCategory', 'gender'],
            where: {
                submissionId: { in: ids },
                tableName: TableName.WORKFORCE,
                ageBand: AgeBand.TOTAL,
                gender: { in: [Gender.MALE, Gender.FEMALE] },
                cspCategory: { in: [CspCategory.CADRES, CspCategory.FOREMEN, CspCategory.WORKERS] },
            },
            _sum: { value: true },
            orderBy: [{ cspCategory: 'asc' }, { gender: 'asc' }],
        });

        // Pivot: for each cspCategory collect male + female counts
        const pivot = new Map<CspCategory, { male: number; female: number }>();
        for (const r of rows) {
            if (!pivot.has(r.cspCategory)) pivot.set(r.cspCategory, { male: 0, female: 0 });
            const entry = pivot.get(r.cspCategory)!;
            if (r.gender === Gender.MALE) entry.male = r._sum.value ?? 0;
            if (r.gender === Gender.FEMALE) entry.female = r._sum.value ?? 0;
        }

        return Array.from(pivot.entries()).map(([cspCategory, counts]) => {
            const total = counts.male + counts.female;
            return {
                cspCategory,
                maleCount: counts.male,
                femaleCount: counts.female,
                malePercentage: calculateRate(counts.male, total),
                femalePercentage: calculateRate(counts.female, total),
                ratioFemaleToMale: counts.male > 0 ? +(counts.female / counts.male).toFixed(2) : null,
            };
        });
    }

    // ─────────────────────────────────────────────────────────────
    // 6. NEW – Youth in workforce stock (P2)
    //    Distinct from RecruitmentAnalyticsService.getYouthEmployment
    //    which measures new hires; this measures the standing workforce.
    // ─────────────────────────────────────────────────────────────
    async getWorkforceYouth(filter: AnalyticsFilter): Promise<WorkforceYouthResult> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return { youthCount: 0, totalEmployees: 0, youthRate: 0 };

        const [youth, total] = await Promise.all([
            (this.prisma as any).onefopCspGenderAge.aggregate({
                where: {
                    submissionId: { in: ids },
                    tableName: TableName.WORKFORCE,
                    cspCategory: CspCategory.TOTAL,
                    gender: Gender.TOTAL,
                    ageBand: AgeBand.AGE_15_24,
                },
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,

            (this.prisma as any).onefopCspGenderAge.aggregate({
                where: {
                    submissionId: { in: ids },
                    tableName: TableName.WORKFORCE,
                    cspCategory: CspCategory.TOTAL,
                    gender: Gender.TOTAL,
                    ageBand: AgeBand.TOTAL,
                },
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,
        ]);

        const youthCount = youth._sum.value ?? 0;
        const totalEmployees = total._sum.value ?? 0;

        return {
            youthCount,
            totalEmployees,
            youthRate: calculateRate(youthCount, totalEmployees),
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 7. Workforce snapshot – UPDATED return type (WorkforceSnapshotV2)
    //    • averageAge is now number | null
    //    • youthRate added
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
        if (totalEmployees === 0) {
            return { totalEmployees: 0, cadres: 0, foremen: 0, workers: 0, male: 0, female: 0, youth: 0, youthRate: 0, averageAge: null };
        }

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

        // computeAverageAge returns null when all bands are zero (see analytics-utils fix below)
        const averageAge = this.computeAverageAgeNullable(age15_24, age25_34, age35Plus);

        return {
            totalEmployees,
            cadres,
            foremen,
            workers,
            male: genderParity.maleCount,
            female: genderParity.femaleCount,
            youth,
            youthRate: calculateRate(youth, totalEmployees),
            averageAge,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // Private – null-aware average age
    //    Mid-points: 15-24 → 20, 25-34 → 30, 35+ → 42 (conservative)
    // ─────────────────────────────────────────────────────────────
    private computeAverageAgeNullable(age15_24: number, age25_34: number, age35Plus: number): number | null {
        const total = age15_24 + age25_34 + age35Plus;
        if (total === 0) return null;
        return +((age15_24 * 20 + age25_34 * 30 + age35Plus * 42) / total).toFixed(1);
    }

    // ─────────────────────────────────────────────────────────────
    // 8. Female leadership rate (unchanged)
    // ─────────────────────────────────────────────────────────────
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