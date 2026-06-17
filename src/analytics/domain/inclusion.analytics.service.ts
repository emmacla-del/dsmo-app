// analytics/domain/inclusion.analytics.service.ts
//
// DATA SOURCE — all 4 questionnaires (Entreprise, Coopérative, CTD, ONG)
//
// All inclusion data comes from RECRUITMENT FLOWS only.
// The questionnaire does not collect a CSP×gender breakdown of existing staff.
//
// Source mapping:
//   S22Q01 → onefopCspGenderAge  tableName: PERMANENT_HIRE  all permanent recruits
//   S22Q02 → onefopCspGenderAge  tableName: TEMPORARY_HIRE  all temporary recruits
//   S22Q04 → onefopDisabilityData   disabled recruits  (CSP × permanent/temporary × gender)
//   S22Q05 → onefopVulnerableData   vulnerable recruits (type × permanent/temporary × gender)
//   S23Q01 → onefopRegisteredSeeker first-time seekers registered (CSP × gender × age)
//   S23Q02 → onefopFirstTimeWorker  first-time workers recruited  (CSP × contract × gender × age)
//
// Denominator logic:
//   totalHires     = S22Q01 + S22Q02   (permanent + temporary)
//   permanentHires = S22Q01 only
//   temporaryHires = S22Q02 only
//
//   disabilityHireRate_total     = S22Q04_total     / totalHires     × 100
//   disabilityHireRate_permanent = S22Q04_permanent / permanentHires × 100
//   disabilityHireRate_temporary = S22Q04_temporary / temporaryHires × 100
//   (same pattern for vulnerability)
//
//   femaleExecutiveHireRate = female CADRES hires (perm+temp) / total CADRES hires (perm+temp) × 100
//   absorptionRate          = S23Q02 / S23Q01 × 100
//
// What this service deliberately does NOT compute (not collected):
//   - Any rate against permanent employee STOCK (no CSP×gender stock data)
//   - Female share of existing executive staff
//   - femaleLeadershipRate of existing workforce

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryService } from '../core/analytics-query.service';
import { calculateRate } from '../core/analytics-utils';
import { TableName, Gender, CspCategory, AgeBand, StatusFlag } from '../core/analytics-enums';

import type {
    AnalyticsFilter,
    DisabilityRow,
    VulnerableWorkerRow,
    FirstTimeWorkerRow,
    InclusionMetricsResult,
    PrismaAggregateResult,
    DisabilityGroupRow,
    VulnerableGroupRow,
    DisabledByCspGroupRow,
    VulnerableByTypeGroupRow,
    FirstTimeWorkerGroupRow,
    RegisteredSeekerRow,
    FirstTimeLaborGapResult,
    InclusionTrendPeriod,
    RegisteredSeekerGroupRow,
    TrendFilter,
} from '../core/analytics-types';

// ─── Output types ─────────────────────────────────────────────────────────────

/**
 * Hire counts and rates for one contract type slice (total / permanent / temporary).
 */
export interface InclusionByContractSlice {
    /** Total recruits in this slice — denominator for rates */
    totalHires: number;
    /** Disabled recruits in this slice — S22Q04 */
    disabledHires: number;
    /** Vulnerable recruits in this slice — S22Q05 */
    vulnerableHires: number;
    /** disabledHires / totalHires × 100 */
    disabilityHireRate: number;
    /** vulnerableHires / totalHires × 100 */
    vulnerableHireRate: number;
}

/**
 * Full inclusion detail — total, permanent, and temporary slices side by side.
 */
export interface InclusionDetail {
    /** S22Q01 + S22Q02 combined */
    total: InclusionByContractSlice;
    /** S22Q01 permanent recruits only */
    permanent: InclusionByContractSlice;
    /** S22Q02 temporary recruits only */
    temporary: InclusionByContractSlice;
    /**
     * Female share of executive-level hires (permanent + temporary combined).
     * femaleExecHires / totalExecHires × 100  — source: S22Q01 + S22Q02, CADRES rows.
     * NOTE: measures hiring flow, not existing staff composition.
     */
    femaleExecutiveHireRate: number;
    /** Disability breakdown by CSP across all contract types */
    disabilityByCsp: { cspCategory: CspCategory; total: number; permanent: number; temporary: number }[];
    /** Vulnerability breakdown by type across all contract types */
    vulnerableByType: { vulnerableType: string; total: number; permanent: number; temporary: number }[];
}

/**
 * Summary dashboard — total slice only, for top-level KPI cards.
 */
export interface InclusionDashboard {
    /** disabledHires / totalHires × 100  (perm + temp) */
    disabilityHireRate: number;
    /** vulnerableHires / totalHires × 100  (perm + temp) */
    vulnerableHireRate: number;
    /** femaleExecHires / totalExecHires × 100  (perm + temp) */
    femaleExecutiveHireRate: number;
    disabledHireCount: number;
    vulnerableHireCount: number;
    permanentHires: number;
    temporaryHires: number;
    totalHires: number;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class InclusionAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly query: AnalyticsQueryService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────

    /**
     * Returns total hires from onefopCspGenderAge for one or both tableName values.
     * Always reads the TOTAL CSP / TOTAL gender / TOTAL ageBand row.
     */
    private async sumHires(
        ids: string[],
        tableNames: TableName[],
    ): Promise<number> {
        const agg = await (this.prisma as any).onefopCspGenderAge.aggregate({
            where: {
                submissionId: { in: ids },
                tableName: { in: tableNames },
                cspCategory: CspCategory.TOTAL,
                gender: Gender.TOTAL,
                ageBand: AgeBand.TOTAL,
            },
            _sum: { value: true },
        }) as PrismaAggregateResult;
        return agg._sum.value ?? 0;
    }

    /**
     * Returns total hires from onefopCspGenderAge for one or both tableName values,
     * broken down by CSP (excluding TOTAL row).
     */
    private async sumHiresByCsp(
        ids: string[],
        tableNames: TableName[],
    ): Promise<Map<CspCategory, number>> {
        const rows = await (this.prisma as any).onefopCspGenderAge.groupBy({
            by: ['cspCategory'],
            where: {
                submissionId: { in: ids },
                tableName: { in: tableNames },
                gender: Gender.TOTAL,
                ageBand: AgeBand.TOTAL,
                cspCategory: { not: CspCategory.TOTAL },
            },
            _sum: { value: true },
        }) as { cspCategory: CspCategory; _sum: { value: number | null } }[];
        return new Map(rows.map((r) => [r.cspCategory, r._sum.value ?? 0]));
    }

    /**
     * Returns disabled hire counts from onefopDisabilityData filtered by StatusFlag.
     * status: TOTAL    → all disabled hires (perm + temp)
     * status: PERMANENT → disabled permanent hires only
     * status: TEMPORARY → disabled temporary hires only
     */
    private async sumDisabled(
        ids: string[],
        status: StatusFlag,
    ): Promise<number> {
        const agg = await (this.prisma as any).onefopDisabilityData.aggregate({
            where: {
                submissionId: { in: ids },
                cspCategory: CspCategory.TOTAL,
                status,
                gender: Gender.TOTAL,
            },
            _sum: { value: true },
        }) as PrismaAggregateResult;
        return agg._sum.value ?? 0;
    }

    /**
     * Returns vulnerable hire counts from onefopVulnerableData filtered by StatusFlag.
     */
    private async sumVulnerable(
        ids: string[],
        status: StatusFlag,
    ): Promise<number> {
        const agg = await (this.prisma as any).onefopVulnerableData.aggregate({
            where: {
                submissionId: { in: ids },
                status,
                gender: Gender.TOTAL,
            },
            _sum: { value: true },
        }) as PrismaAggregateResult;
        return agg._sum.value ?? 0;
    }

    /**
     * Builds one InclusionByContractSlice from pre-fetched counts.
     */
    private buildSlice(
        totalHires: number,
        disabledHires: number,
        vulnerableHires: number,
    ): InclusionByContractSlice {
        return {
            totalHires,
            disabledHires,
            vulnerableHires,
            disabilityHireRate: calculateRate(disabledHires, totalHires),
            vulnerableHireRate: calculateRate(vulnerableHires, totalHires),
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 1. Disability recruits raw — S22Q04
    //    Full breakdown: CSP × contract type (status) × gender
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

        return rows.map((r) => ({
            cspCategory: r.cspCategory,
            status: r.status,
            gender: r.gender,
            count: r._sum.value ?? 0,
        }));
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Vulnerable recruits raw — S22Q05
    //    Full breakdown: vulnerability type × contract type (status) × gender
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

        return rows.map((r) => ({
            vulnerableType: r.vulnerableType,
            status: r.status,
            gender: r.gender,
            count: r._sum.value ?? 0,
        }));
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Inclusion metrics — summary with optional CSP/type breakdown
    //    Denominator = S22Q01 + S22Q02 (total hires)
    // ─────────────────────────────────────────────────────────────
    async getInclusionMetrics(
        filter: AnalyticsFilter & { breakdownBy?: 'disability' | 'vulnerability' | 'both' },
    ): Promise<InclusionMetricsResult> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) {
            return { disabled: 0, vulnerable: 0, totalHires: 0, disabledByCsp: [], vulnerableByType: [] };
        }

        const includeDisability =
            !filter.breakdownBy || filter.breakdownBy === 'disability' || filter.breakdownBy === 'both';
        const includeVulnerability =
            !filter.breakdownBy || filter.breakdownBy === 'vulnerability' || filter.breakdownBy === 'both';

        const [disabled, vulnerable, totalHires, disabledByCspRaw, vulnerableByTypeRaw] =
            await Promise.all([
                this.sumDisabled(ids, StatusFlag.TOTAL),
                this.sumVulnerable(ids, StatusFlag.TOTAL),
                // S22Q01 + S22Q02 combined
                this.sumHires(ids, [TableName.PERMANENT_HIRE, TableName.TEMPORARY_HIRE]),

                includeDisability
                    ? (this.prisma as any).onefopDisabilityData.groupBy({
                        by: ['cspCategory'],
                        where: {
                            submissionId: { in: ids },
                            status: StatusFlag.TOTAL,
                            gender: Gender.TOTAL,
                            cspCategory: { not: CspCategory.TOTAL },
                        },
                        _sum: { value: true },
                    }) as Promise<DisabledByCspGroupRow[]>
                    : Promise.resolve([] as DisabledByCspGroupRow[]),

                includeVulnerability
                    ? (this.prisma as any).onefopVulnerableData.groupBy({
                        by: ['vulnerableType'],
                        where: {
                            submissionId: { in: ids },
                            status: StatusFlag.TOTAL,
                            gender: Gender.TOTAL,
                        },
                        _sum: { value: true },
                    }) as Promise<VulnerableByTypeGroupRow[]>
                    : Promise.resolve([] as VulnerableByTypeGroupRow[]),
            ]);

        return {
            disabled,
            vulnerable,
            totalHires,
            disabledByCsp: disabledByCspRaw.map((r) => ({
                cspCategory: r.cspCategory,
                count: r._sum.value ?? 0,
            })),
            vulnerableByType: vulnerableByTypeRaw.map((r) => ({
                vulnerableType: r.vulnerableType,
                count: r._sum.value ?? 0,
            })),
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 4. First-time workers recruited — S23Q02
    //    CSP × contract type × gender × age
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

        return rows.map((r) => ({
            contractType: r.contractType,
            cspCategory: r.cspCategory,
            gender: r.gender,
            ageBand: r.ageBand,
            count: r._sum.value ?? 0,
        }));
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Registered first-time job seekers — S23Q01
    //    People who registered looking for their first job.
    //    Compare with S23Q02 via getFirstTimeLaborGap().
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
    // 6. First-time labour gap — S23Q01 vs S23Q02
    //    absorptionRate = firstTimeRecruited / firstTimeRegistered × 100
    // ─────────────────────────────────────────────────────────────
    async getFirstTimeLaborGap(filter: AnalyticsFilter): Promise<FirstTimeLaborGapResult> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) {
            return { registered: 0, recruited: 0, absorptionRate: null, byCsp: [] };
        }

        const [regTotal, recTotal, regByCspRaw, recByCspRaw] = await Promise.all([
            (this.prisma as any).onefopRegisteredSeeker.aggregate({
                where: { submissionId: { in: ids }, cspCategory: CspCategory.TOTAL, gender: Gender.TOTAL },
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,

            (this.prisma as any).onefopFirstTimeWorker.aggregate({
                where: { submissionId: { in: ids }, cspCategory: CspCategory.TOTAL, gender: Gender.TOTAL },
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
    // 7. Full inclusion detail — total, permanent, temporary slices
    //    This is the main detailed analysis method.
    //
    //    For each slice:
    //      denominator  = S22Q01 (permanent) | S22Q02 (temporary) | both (total)
    //      disabled     = S22Q04 filtered by status PERMANENT/TEMPORARY/TOTAL
    //      vulnerable   = S22Q05 filtered by status PERMANENT/TEMPORARY/TOTAL
    //
    //    Also provides:
    //      disabilityByCsp   — disabled counts per CSP, all three slices
    //      vulnerableByType  — vulnerable counts per type, all three slices
    //      femaleExecutiveHireRate — female CADRES hires / total CADRES hires (perm+temp)
    // ─────────────────────────────────────────────────────────────
    async getInclusionDetail(filter: AnalyticsFilter): Promise<InclusionDetail> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) {
            const emptySlice = this.buildSlice(0, 0, 0);
            return {
                total: emptySlice,
                permanent: emptySlice,
                temporary: emptySlice,
                femaleExecutiveHireRate: 0,
                disabilityByCsp: [],
                vulnerableByType: [],
            };
        }

        // ── Fetch all scalars in parallel ──────────────────────────
        const [
            permanentHires,
            temporaryHires,
            disabledTotal,
            disabledPermanent,
            disabledTemporary,
            vulnerableTotal,
            vulnerablePermanent,
            vulnerableTemporary,
            femaleExecHires,
            totalExecHires,
            disabledByCspTotal,
            disabledByCspPermanent,
            disabledByCspTemporary,
            vulnerableByTypeTotal,
            vulnerableByTypePermanent,
            vulnerableByTypeTemporary,
        ] = await Promise.all([
            // denominators — S22Q01 and S22Q02
            this.sumHires(ids, [TableName.PERMANENT_HIRE]),
            this.sumHires(ids, [TableName.TEMPORARY_HIRE]),

            // S22Q04 disabled counts by contract slice
            this.sumDisabled(ids, StatusFlag.TOTAL),
            this.sumDisabled(ids, StatusFlag.PERMANENT),
            this.sumDisabled(ids, StatusFlag.TEMPORARY),

            // S22Q05 vulnerable counts by contract slice
            this.sumVulnerable(ids, StatusFlag.TOTAL),
            this.sumVulnerable(ids, StatusFlag.PERMANENT),
            this.sumVulnerable(ids, StatusFlag.TEMPORARY),

            // femaleExecutiveHireRate — S22Q01 + S22Q02, CADRES × FEMALE vs CADRES × TOTAL
            (this.prisma as any).onefopCspGenderAge.aggregate({
                where: {
                    submissionId: { in: ids },
                    tableName: { in: [TableName.PERMANENT_HIRE, TableName.TEMPORARY_HIRE] },
                    cspCategory: CspCategory.CADRES,
                    gender: Gender.FEMALE,
                    ageBand: AgeBand.TOTAL,
                },
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,

            (this.prisma as any).onefopCspGenderAge.aggregate({
                where: {
                    submissionId: { in: ids },
                    tableName: { in: [TableName.PERMANENT_HIRE, TableName.TEMPORARY_HIRE] },
                    cspCategory: CspCategory.CADRES,
                    gender: Gender.TOTAL,
                    ageBand: AgeBand.TOTAL,
                },
                _sum: { value: true },
            }) as Promise<PrismaAggregateResult>,

            // S22Q04 disability by CSP — three slices
            (this.prisma as any).onefopDisabilityData.groupBy({
                by: ['cspCategory'],
                where: { submissionId: { in: ids }, status: StatusFlag.TOTAL, gender: Gender.TOTAL, cspCategory: { not: CspCategory.TOTAL } },
                _sum: { value: true },
            }) as Promise<DisabledByCspGroupRow[]>,

            (this.prisma as any).onefopDisabilityData.groupBy({
                by: ['cspCategory'],
                where: { submissionId: { in: ids }, status: StatusFlag.PERMANENT, gender: Gender.TOTAL, cspCategory: { not: CspCategory.TOTAL } },
                _sum: { value: true },
            }) as Promise<DisabledByCspGroupRow[]>,

            (this.prisma as any).onefopDisabilityData.groupBy({
                by: ['cspCategory'],
                where: { submissionId: { in: ids }, status: StatusFlag.TEMPORARY, gender: Gender.TOTAL, cspCategory: { not: CspCategory.TOTAL } },
                _sum: { value: true },
            }) as Promise<DisabledByCspGroupRow[]>,

            // S22Q05 vulnerability by type — three slices
            (this.prisma as any).onefopVulnerableData.groupBy({
                by: ['vulnerableType'],
                where: { submissionId: { in: ids }, status: StatusFlag.TOTAL, gender: Gender.TOTAL },
                _sum: { value: true },
            }) as Promise<VulnerableByTypeGroupRow[]>,

            (this.prisma as any).onefopVulnerableData.groupBy({
                by: ['vulnerableType'],
                where: { submissionId: { in: ids }, status: StatusFlag.PERMANENT, gender: Gender.TOTAL },
                _sum: { value: true },
            }) as Promise<VulnerableByTypeGroupRow[]>,

            (this.prisma as any).onefopVulnerableData.groupBy({
                by: ['vulnerableType'],
                where: { submissionId: { in: ids }, status: StatusFlag.TEMPORARY, gender: Gender.TOTAL },
                _sum: { value: true },
            }) as Promise<VulnerableByTypeGroupRow[]>,
        ]);

        const totalHires = permanentHires + temporaryHires;

        // ── Build CSP disability cross-slice ───────────────────────
        const disabledCspTotalMap = new Map(disabledByCspTotal.map((r) => [r.cspCategory, r._sum.value ?? 0]));
        const disabledCspPermMap = new Map(disabledByCspPermanent.map((r) => [r.cspCategory, r._sum.value ?? 0]));
        const disabledCspTempMap = new Map(disabledByCspTemporary.map((r) => [r.cspCategory, r._sum.value ?? 0]));
        const allCspCategories = [...new Set([
            ...disabledByCspTotal.map((r) => r.cspCategory),
            ...disabledByCspPermanent.map((r) => r.cspCategory),
            ...disabledByCspTemporary.map((r) => r.cspCategory),
        ])];

        const disabilityByCsp = allCspCategories.map((csp) => ({
            cspCategory: csp,
            total: disabledCspTotalMap.get(csp) ?? 0,
            permanent: disabledCspPermMap.get(csp) ?? 0,
            temporary: disabledCspTempMap.get(csp) ?? 0,
        }));

        // ── Build vulnerability type cross-slice ───────────────────
        const vulnTotalMap = new Map(vulnerableByTypeTotal.map((r) => [r.vulnerableType, r._sum.value ?? 0]));
        const vulnPermMap = new Map(vulnerableByTypePermanent.map((r) => [r.vulnerableType, r._sum.value ?? 0]));
        const vulnTempMap = new Map(vulnerableByTypeTemporary.map((r) => [r.vulnerableType, r._sum.value ?? 0]));
        const allVulnTypes = [...new Set([
            ...vulnerableByTypeTotal.map((r) => r.vulnerableType),
            ...vulnerableByTypePermanent.map((r) => r.vulnerableType),
            ...vulnerableByTypeTemporary.map((r) => r.vulnerableType),
        ])];

        const vulnerableByType = allVulnTypes.map((type) => ({
            vulnerableType: type,
            total: vulnTotalMap.get(type) ?? 0,
            permanent: vulnPermMap.get(type) ?? 0,
            temporary: vulnTempMap.get(type) ?? 0,
        }));

        return {
            total: this.buildSlice(totalHires, disabledTotal, vulnerableTotal),
            permanent: this.buildSlice(permanentHires, disabledPermanent, vulnerablePermanent),
            temporary: this.buildSlice(temporaryHires, disabledTemporary, vulnerableTemporary),
            femaleExecutiveHireRate: calculateRate(
                femaleExecHires._sum.value ?? 0,
                totalExecHires._sum.value ?? 0,
            ),
            disabilityByCsp,
            vulnerableByType,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 8. Inclusion trends over time
    //    disabilityHireRate and vulnerableHireRate per period.
    //    Denominator = S22Q01 + S22Q02 per period.
    // ─────────────────────────────────────────────────────────────
    async getInclusionTrends(filter: TrendFilter): Promise<InclusionTrendPeriod[]> {
        const granularity = filter.granularity ?? 'year';
        const submissions = await this.query.resolveSubmissions(filter);

        const inRange = filter.startYear && filter.endYear
            ? submissions.filter((s) => s.surveyYear >= filter.startYear! && s.surveyYear <= filter.endYear!)
            : submissions;

        if (!inRange.length) return [];

        const periodMap = new Map<string, string[]>();
        for (const s of inRange) {
            const key = this.query.periodKey(s, granularity);
            if (!periodMap.has(key)) periodMap.set(key, []);
            periodMap.get(key)!.push(s.id);
        }

        const periods = Array.from(periodMap.entries()).sort(([a], [b]) => a.localeCompare(b));

        return Promise.all(
            periods.map(async ([period, ids]) => {
                const [disabledCount, vulnerableCount, totalHires] = await Promise.all([
                    this.sumDisabled(ids, StatusFlag.TOTAL),
                    this.sumVulnerable(ids, StatusFlag.TOTAL),
                    this.sumHires(ids, [TableName.PERMANENT_HIRE, TableName.TEMPORARY_HIRE]),
                ]);

                return {
                    period,
                    disabledCount,
                    vulnerableCount,
                    totalHires,
                    disabilityHireRate: calculateRate(disabledCount, totalHires),
                    vulnerableHireRate: calculateRate(vulnerableCount, totalHires),
                };
            }),
        );
    }

    // ─────────────────────────────────────────────────────────────
    // 9. Inclusion dashboard — top-level KPI summary
    //    Uses total slice (permanent + temporary combined).
    // ─────────────────────────────────────────────────────────────
    async getInclusionDashboard(filter: AnalyticsFilter): Promise<InclusionDashboard> {
        const detail = await this.getInclusionDetail(filter);

        return {
            disabilityHireRate: detail.total.disabilityHireRate,
            vulnerableHireRate: detail.total.vulnerableHireRate,
            femaleExecutiveHireRate: detail.femaleExecutiveHireRate,
            disabledHireCount: detail.total.disabledHires,
            vulnerableHireCount: detail.total.vulnerableHires,
            permanentHires: detail.permanent.totalHires,
            temporaryHires: detail.temporary.totalHires,
            totalHires: detail.total.totalHires,
        };
    }
}