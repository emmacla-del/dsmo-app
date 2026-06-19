// analytics/core/analytics-query.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPeriodWhere } from '../helpers/analytics-period.helper';
import type { AnalyticsFilter, SubmissionMeta } from './analytics-types';
import { SubmissionStatus } from './analytics-enums';

@Injectable()
export class AnalyticsQueryService {
    constructor(private readonly prisma: PrismaService) { }

    // ─────────────────────────────────────────────────────────────
    // Build the Prisma where clause for onefopSubmission queries
    // ─────────────────────────────────────────────────────────────
    buildSubmissionWhere(
        filter: AnalyticsFilter,
        status: SubmissionStatus = SubmissionStatus.APPROVED,
    ): Record<string, unknown> {
        const where: Record<string, unknown> = {
            status,
            ...buildPeriodWhere(filter),
        };

        if (filter.submissionId) where['id'] = filter.submissionId;
        if (filter.entityType) where['formType'] = filter.entityType;
        if (filter.region) where['region'] = { contains: filter.region, mode: 'insensitive' };
        if (filter.department) where['department'] = { contains: filter.department, mode: 'insensitive' };
        if (filter.subdivision) where['subdivision'] = { contains: filter.subdivision, mode: 'insensitive' };

        return where;
    }

    // ─────────────────────────────────────────────────────────────
    // Resolve approved submission IDs matching the given filter.
    // Short-circuits when filter._ids is already populated —
    // callers (e.g. the facade) should pre-resolve once and stamp
    // _ids on the filter to avoid redundant DB round-trips.
    // ─────────────────────────────────────────────────────────────
    async resolveSubmissionIds(filter: AnalyticsFilter): Promise<string[]> {
        if (filter._ids) return [...filter._ids];
        const submissions = await this.resolveSubmissions(filter);
        return submissions.map((s) => s.id);
    }

    async resolveSubmissions(filter: AnalyticsFilter): Promise<SubmissionMeta[]> {
        const where = this.buildSubmissionWhere(filter);

        // `sector` (S1Q07) lives on the entity-detail tables, not on
        // OnefopSubmission, so it can't be expressed in buildSubmissionWhere
        // directly — resolve the matching submission ids first and intersect.
        if (filter.sector) {
            const sectorIds = await this.resolveSubmissionIdsBySector(filter.sector);
            if (!sectorIds.length) return [];
            where['id'] = { in: sectorIds };
        }

        return (this.prisma as any).onefopSubmission.findMany({
            where,
            select: {
                id: true,
                surveyYear: true,
                quarterCode: true,
                region: true,
                department: true,
                subdivision: true,
                formType: true,
                createdAt: true,
            },
        });
    }

    // ─────────────────────────────────────────────────────────────
    // Resolve the submission ids whose entity-detail row has the given
    // sector (S1Q07), across all 4 entity types.
    // ─────────────────────────────────────────────────────────────
    private async resolveSubmissionIdsBySector(sector: string): Promise<string[]> {
        const where = { sector: { equals: sector, mode: 'insensitive' as const } };
        const [enterprises, cooperatives, ctds, ongs] = await Promise.all([
            (this.prisma as any).onefopEnterpriseDetail.findMany({ where, select: { submissionId: true } }),
            (this.prisma as any).onefopCooperativeDetail.findMany({ where, select: { submissionId: true } }),
            (this.prisma as any).onefopCtdDetail.findMany({ where, select: { submissionId: true } }),
            (this.prisma as any).onefopOngDetail.findMany({ where, select: { submissionId: true } }),
        ]);
        return [...enterprises, ...cooperatives, ...ctds, ...ongs].map((r) => r.submissionId);
    }

    // ─────────────────────────────────────────────────────────────
    // Distinct sector values actually in use, for the analytics filter
    // picker. Only looks at entities belonging to an approved submission.
    // ─────────────────────────────────────────────────────────────
    async getDistinctSectors(): Promise<string[]> {
        const approvedIds = (
            await (this.prisma as any).onefopSubmission.findMany({
                where: { status: SubmissionStatus.APPROVED },
                select: { id: true },
            })
        ).map((s: { id: string }) => s.id);
        if (!approvedIds.length) return [];

        // No `sector: { not: null }` here — onefopEnterpriseDetail.sector is a
        // required (non-nullable) column, so Prisma rejects a `not: null`
        // filter against it (StringFilter, not NullableStringFilter). Null/empty
        // values from the other 3 (nullable) tables are filtered out below instead.
        const where = { submissionId: { in: approvedIds } };
        const [enterprises, cooperatives, ctds, ongs] = await Promise.all([
            (this.prisma as any).onefopEnterpriseDetail.findMany({ where, select: { sector: true } }),
            (this.prisma as any).onefopCooperativeDetail.findMany({ where, select: { sector: true } }),
            (this.prisma as any).onefopCtdDetail.findMany({ where, select: { sector: true } }),
            (this.prisma as any).onefopOngDetail.findMany({ where, select: { sector: true } }),
        ]);

        const sectors = new Set<string>();
        for (const row of [...enterprises, ...cooperatives, ...ctds, ...ongs]) {
            const value = (row.sector as string | null)?.trim();
            if (value) sectors.add(value);
        }
        return [...sectors].sort((a, b) => a.localeCompare(b));
    }

    // ─────────────────────────────────────────────────────────────
    // Derive period key for trend grouping
    // ─────────────────────────────────────────────────────────────
    periodKey(
        s: SubmissionMeta,
        granularity: 'year' | 'quarter' | 'semester' | 'month' = 'year',
    ): string {
        switch (granularity) {
            case 'quarter':
                if (s.quarterCode) return s.quarterCode;
                return `${s.surveyYear}-T${Math.ceil((s.createdAt.getMonth() + 1) / 3)}`;

            case 'semester':
                return `${s.surveyYear}-S${s.createdAt.getMonth() < 6 ? 1 : 2}`;

            case 'month':
                return `${s.surveyYear}-${String(s.createdAt.getMonth() + 1).padStart(2, '0')}`;

            case 'year':
            default:
                return String(s.surveyYear);
        }
    }
}