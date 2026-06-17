// analytics/domain/mobility.analytics.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryService } from '../core/analytics-query.service';
import { classifyDepartureType, computeMobilityRates } from '../core/analytics-utils';
import { DepartureType, Gender, CspCategory, InternshipType } from '../core/analytics-enums';
import type {
    AnalyticsFilter,
    DepartureRow,
    DepartureSummaryRow,
    DismissalReason,
    DismissalUnemploymentRow,
    InternshipRow,
    MobilityDashboard,
    DepartureGroupRow,
    DepartureSummaryGroupRow,
    DismissalReasonDbRow,
    DismissalUnemploymentGroupRow,
    InternshipGroupRow,
    DeparturesByLocationRow,
} from '../core/analytics-types';

// ─── Internal helper ─────────────────────────────────────────────────────────

interface DetailRow {
    submissionId: string;
    permanentEmployees: number;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MobilityAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly query: AnalyticsQueryService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // Private: read permanent employees from all 4 detail tables.
    // Mirrors the approach in EmploymentAnalyticsService.
    // Used ONLY by the standalone getMobilityDashboard() path.
    // ─────────────────────────────────────────────────────────────
    private async fetchPermanentEmployees(ids: string[]): Promise<number> {
        if (!ids.length) return 0;

        const [enterprises, cooperatives, ctds, ongs] = await Promise.all([
            (this.prisma as any).onefopEnterpriseDetail.aggregate({
                where: { submissionId: { in: ids } },
                _sum: { permanentWorkers: true },
            }),
            (this.prisma as any).onefopCooperativeDetail.aggregate({
                where: { submissionId: { in: ids } },
                _sum: { permanentWorkers: true },
            }),
            (this.prisma as any).onefopCtdDetail.aggregate({
                where: { submissionId: { in: ids } },
                _sum: { permanentWorkers: true },
            }),
            (this.prisma as any).onefopOngDetail.aggregate({
                where: { submissionId: { in: ids } },
                _sum: { permanentWorkers: true },
            }),
        ]);

        return (
            (enterprises._sum.permanentWorkers ?? 0) +
            (cooperatives._sum.permanentWorkers ?? 0) +
            (ctds._sum.permanentWorkers ?? 0) +
            (ongs._sum.permanentWorkers ?? 0)
        );
    }

    // ─────────────────────────────────────────────────────────────
    // 1. Departures detail — S3Q01
    //    Full breakdown: CSP × departure type × gender
    // ─────────────────────────────────────────────────────────────
    async getDepartures(filter: AnalyticsFilter): Promise<DepartureRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: DepartureGroupRow[] = await (this.prisma as any).onefopDepartureData.groupBy({
            by: ['cspCategory', 'departureType', 'gender'],
            where: { submissionId: { in: ids } },
            _sum: { value: true },
            orderBy: [{ departureType: 'asc' }, { cspCategory: 'asc' }],
        });

        return rows.map((r) => ({
            cspCategory: r.cspCategory,
            departureType: r.departureType,
            gender: r.gender,
            count: r._sum.value ?? 0,
        }));
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Departure summary — S3Q01 TOTAL rows
    //    One row per departure type, summed across all CSPs and genders.
    // ─────────────────────────────────────────────────────────────
    async getDepartureSummary(filter: AnalyticsFilter): Promise<DepartureSummaryRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: DepartureSummaryGroupRow[] = await (this.prisma as any).onefopDepartureData.groupBy({
            by: ['departureType'],
            where: {
                submissionId: { in: ids },
                cspCategory: CspCategory.TOTAL,
                gender: Gender.TOTAL,
                departureType: { not: DepartureType.ENSEMBLE },
            },
            _sum: { value: true },
            orderBy: { _sum: { value: 'desc' } },
        });

        return rows.map((r) => ({ departureType: r.departureType, total: r._sum.value ?? 0 }));
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Dismissal reasons — S3Q02
    //    Free-text, grouped in-memory. Top 3 reasons per submission.
    // ─────────────────────────────────────────────────────────────
    async getDismissalReasons(
        filter: AnalyticsFilter & { limit?: number },
    ): Promise<DismissalReason[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: DismissalReasonDbRow[] = await (this.prisma as any).onefopDismissalReason.findMany({
            where: { submissionId: { in: ids } },
            select: {
                reasonIndex: true,
                reasonText: true,
                maleCount: true,
                femaleCount: true,
                totalCount: true,
            },
            orderBy: { reasonIndex: 'asc' },
        });

        const grouped: Record<string, { male: number; female: number; total: number }> = {};
        for (const r of rows) {
            const key = r.reasonText?.trim() || `Raison ${r.reasonIndex}`;
            if (!grouped[key]) grouped[key] = { male: 0, female: 0, total: 0 };
            grouped[key].male += r.maleCount ?? 0;
            grouped[key].female += r.femaleCount ?? 0;
            grouped[key].total += r.totalCount ?? 0;
        }

        const result = Object.entries(grouped)
            .map(([reason, c]) => ({
                reason,
                maleCount: c.male,
                femaleCount: c.female,
                totalCount: c.total,
            }))
            .sort((a, b) => b.totalCount - a.totalCount);

        return filter.limit ? result.slice(0, filter.limit) : result;
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Dismissal & technical unemployment — S3Q03
    //    CSP × type × gender
    // ─────────────────────────────────────────────────────────────
    async getDismissalUnemployment(filter: AnalyticsFilter): Promise<DismissalUnemploymentRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: DismissalUnemploymentGroupRow[] = await (this.prisma as any).onefopDismissalUnemployment.groupBy({
            by: ['cspCategory', 'type', 'gender'],
            where: { submissionId: { in: ids } },
            _sum: { value: true },
            orderBy: [{ type: 'asc' }, { cspCategory: 'asc' }],
        });

        return rows.map((r) => ({
            cspCategory: r.cspCategory,
            type: r.type,
            gender: r.gender,
            count: r._sum.value ?? 0,
        }));
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Internships — S4Q01
    //    Internship type × gender
    // ─────────────────────────────────────────────────────────────
    async getInternships(filter: AnalyticsFilter): Promise<InternshipRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: InternshipGroupRow[] = await (this.prisma as any).onefopInternshipData.groupBy({
            by: ['internshipType', 'gender'],
            where: {
                submissionId: { in: ids },
                internshipType: { not: InternshipType.TOTAL },
            },
            _sum: { value: true },
            orderBy: { internshipType: 'asc' },
        });

        return rows.map((r) => ({
            internshipType: r.internshipType,
            gender: r.gender,
            count: r._sum.value ?? 0,
        }));
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Departures by location
    //    Groups S3Q01 departure counts by region / department / subdivision.
    //    Answers: "which areas have the highest turnover?"
    // ─────────────────────────────────────────────────────────────
    async getDeparturesByLocation(
        filter: AnalyticsFilter & { groupBy: 'region' | 'department' | 'subdivision' },
    ): Promise<DeparturesByLocationRow[]> {
        const submissions = await this.query.resolveSubmissions(filter);
        if (!submissions.length) return [];

        const ids = submissions.map((s) => s.id);

        // TOTAL CSP + TOTAL gender rows avoid double-counting
        const rows: { submissionId: string; departureType: DepartureType; value: number | null }[] =
            await (this.prisma as any).onefopDepartureData.findMany({
                where: {
                    submissionId: { in: ids },
                    cspCategory: CspCategory.TOTAL,
                    gender: Gender.TOTAL,
                    departureType: { not: DepartureType.ENSEMBLE },
                },
                select: { submissionId: true, departureType: true, value: true },
            });

        type Bucket = { total: number; resignations: number; dismissals: number };
        const bySubmission = new Map<string, Bucket>();

        for (const r of rows) {
            if (!bySubmission.has(r.submissionId)) {
                bySubmission.set(r.submissionId, { total: 0, resignations: 0, dismissals: 0 });
            }
            const b = bySubmission.get(r.submissionId)!;
            const v = r.value ?? 0;
            b.total += v;
            const classified = classifyDepartureType(r.departureType);
            if (classified === DepartureType.RESIGNATION) b.resignations += v;
            if (classified === DepartureType.DISMISSAL) b.dismissals += v;
        }

        const map = new Map<string, { total: number; resignations: number; dismissals: number; companyCount: number }>();

        for (const s of submissions) {
            const key =
                filter.groupBy === 'region'
                    ? (s.region ?? 'Inconnu')
                    : filter.groupBy === 'department'
                        ? (s.department ?? 'Inconnu')
                        : (s.subdivision ?? 'Inconnu');

            if (!map.has(key)) map.set(key, { total: 0, resignations: 0, dismissals: 0, companyCount: 0 });
            const stats = map.get(key)!;
            const bucket = bySubmission.get(s.id) ?? { total: 0, resignations: 0, dismissals: 0 };
            stats.total += bucket.total;
            stats.resignations += bucket.resignations;
            stats.dismissals += bucket.dismissals;
            stats.companyCount += 1;
        }

        return Array.from(map.entries())
            .map(([name, stats]) => ({
                name,
                totalDepartures: stats.total,
                resignations: stats.resignations,
                dismissals: stats.dismissals,
                companyCount: stats.companyCount,
            }))
            .sort((a, b) => b.totalDepartures - a.totalDepartures);
    }

    // ─────────────────────────────────────────────────────────────
    // 7. Mobility dashboard — standalone path
    //
    //    In production the facade calls computeMobilityDashboard()
    //    directly with the totalPermanentEmployees already resolved
    //    from EmploymentAnalyticsService, avoiding a duplicate query.
    //
    //    This standalone wrapper is for tests and batch jobs that
    //    don't go through the facade.  It reads permanent employees
    //    directly from the 4 entity detail tables (S1Q10/S1Q09),
    //    which is the only correct source — onefopCspGenderAge has
    //    no WORKFORCE table.
    // ─────────────────────────────────────────────────────────────
    async getMobilityDashboard(filter: AnalyticsFilter): Promise<MobilityDashboard> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) {
            return {
                totalEmployees: 0,
                totalDepartures: 0,
                resignationRate: 0,
                dismissalRate: 0,
                retirementRate: 0,
                turnoverRate: 0,
                retentionRate: 0,
            };
        }

        const f: AnalyticsFilter = { ...filter, _ids: ids };

        const [totalPermanentEmployees, departures] = await Promise.all([
            // Source: S1Q10 / S1Q09 — self-reported scalar in each detail table
            this.fetchPermanentEmployees(ids),
            this.getDepartureSummary(f),
        ]);

        return this.computeMobilityDashboard(totalPermanentEmployees, departures);
    }

    // ─────────────────────────────────────────────────────────────
    // Pure compute — shared by facade and standalone path
    // ─────────────────────────────────────────────────────────────
    computeMobilityDashboard(
        totalEmployees: number,
        departures: DepartureSummaryRow[],
    ): MobilityDashboard {
        const totalDepartures = departures.reduce((sum, r) => sum + r.total, 0);

        if (totalEmployees === 0) {
            return {
                totalEmployees: 0,
                totalDepartures: 0,
                resignationRate: 0,
                dismissalRate: 0,
                retirementRate: 0,
                turnoverRate: 0,
                retentionRate: 0,
            };
        }

        const resignations = departures
            .filter((r) => classifyDepartureType(r.departureType) === DepartureType.RESIGNATION)
            .reduce((s, r) => s + r.total, 0);

        const dismissals = departures
            .filter((r) => classifyDepartureType(r.departureType) === DepartureType.DISMISSAL)
            .reduce((s, r) => s + r.total, 0);

        const retirements = departures
            .filter((r) => classifyDepartureType(r.departureType) === DepartureType.RETIREMENT)
            .reduce((s, r) => s + r.total, 0);

        return {
            totalEmployees,
            totalDepartures,
            ...computeMobilityRates(totalEmployees, totalDepartures, resignations, dismissals, retirements),
        };
    }
}