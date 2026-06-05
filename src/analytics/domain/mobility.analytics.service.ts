// analytics/domain/mobility.analytics.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryService } from '../core/analytics-query.service';
import { classifyDepartureType, computeMobilityRates } from '../core/analytics-utils';
import { DepartureType, Gender, CspCategory, AgeBand, StatusFlag, TableName, InternshipType } from '../core/analytics-enums';
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
} from '../core/analytics-types';

@Injectable()
export class MobilityAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly query: AnalyticsQueryService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // 1. Departures (detail)
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

        return rows.map((r) => ({ cspCategory: r.cspCategory, departureType: r.departureType, gender: r.gender, count: r._sum.value ?? 0 }));
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Departure summary
    // ─────────────────────────────────────────────────────────────
    async getDepartureSummary(filter: AnalyticsFilter): Promise<DepartureSummaryRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: DepartureSummaryGroupRow[] = await (this.prisma as any).onefopDepartureData.groupBy({
            by: ['departureType'],
            where: { submissionId: { in: ids }, cspCategory: CspCategory.TOTAL, gender: Gender.TOTAL, departureType: { not: DepartureType.ENSEMBLE } },
            _sum: { value: true },
            orderBy: { _sum: { value: 'desc' } },
        });

        return rows.map((r) => ({ departureType: r.departureType, total: r._sum.value ?? 0 }));
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Dismissal reasons
    // ─────────────────────────────────────────────────────────────
    async getDismissalReasons(filter: AnalyticsFilter): Promise<DismissalReason[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: DismissalReasonDbRow[] = await (this.prisma as any).onefopDismissalReason.findMany({
            where: { submissionId: { in: ids } },
            select: { reasonIndex: true, reasonText: true, maleCount: true, femaleCount: true, totalCount: true },
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

        return Object.entries(grouped)
            .map(([reason, c]) => ({ reason, maleCount: c.male, femaleCount: c.female, totalCount: c.total }))
            .sort((a, b) => b.totalCount - a.totalCount);
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Dismissal & technical unemployment
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

        return rows.map((r) => ({ cspCategory: r.cspCategory, type: r.type, gender: r.gender, count: r._sum.value ?? 0 }));
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Internships
    // ─────────────────────────────────────────────────────────────
    async getInternships(filter: AnalyticsFilter): Promise<InternshipRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: InternshipGroupRow[] = await (this.prisma as any).onefopInternshipData.groupBy({
            by: ['internshipType', 'gender'],
            where: { submissionId: { in: ids }, internshipType: { not: InternshipType.TOTAL } },
            _sum: { value: true },
            orderBy: { internshipType: 'asc' },
        });

        return rows.map((r) => ({ internshipType: r.internshipType, gender: r.gender, count: r._sum.value ?? 0 }));
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Mobility dashboard (aggregate)
    // ─────────────────────────────────────────────────────────────
    async getMobilityDashboard(filter: AnalyticsFilter): Promise<MobilityDashboard> {
        const [{ totalEmployees }, departures] = await Promise.all([
            // re-use departure summary — employment summary is fetched by the facade
            (async () => {
                const ids = await this.query.resolveSubmissionIds(filter);
                const agg = await (this.prisma as any).onefopCspGenderAge.aggregate({
                    where: { submissionId: { in: ids }, tableName: TableName.WORKFORCE, cspCategory: CspCategory.TOTAL, gender: Gender.TOTAL, ageBand: AgeBand.TOTAL },
                    _sum: { value: true },
                });
                return { totalEmployees: agg._sum.value ?? 0 };
            })(),
            this.getDepartureSummary(filter),
        ]);
        return this.computeMobilityDashboard(totalEmployees, departures);
    }

    computeMobilityDashboard(
        totalEmployees: number,
        departures: DepartureSummaryRow[],
    ): MobilityDashboard {
        const totalDepartures = departures.reduce((sum, r) => sum + r.total, 0);

        if (totalEmployees === 0) {
            return { totalEmployees: 0, totalDepartures: 0, resignationRate: 0, dismissalRate: 0, retirementRate: 0, turnoverRate: 0, retentionRate: 0 };
        }

        const resignations = departures.filter((r) => classifyDepartureType(r.departureType) === DepartureType.RESIGNATION).reduce((s, r) => s + r.total, 0);
        const dismissals = departures.filter((r) => classifyDepartureType(r.departureType) === DepartureType.DISMISSAL).reduce((s, r) => s + r.total, 0);
        const retirements = departures.filter((r) => classifyDepartureType(r.departureType) === DepartureType.RETIREMENT).reduce((s, r) => s + r.total, 0);

        return {
            totalEmployees,
            totalDepartures,
            ...computeMobilityRates(totalEmployees, totalDepartures, resignations, dismissals, retirements),
        };
    }
}