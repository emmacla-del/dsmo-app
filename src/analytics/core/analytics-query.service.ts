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
        return (this.prisma as any).onefopSubmission.findMany({
            where: this.buildSubmissionWhere(filter),
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