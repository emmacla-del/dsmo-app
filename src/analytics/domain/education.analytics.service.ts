// analytics/domain/education.analytics.service.ts  (FULL REPLACEMENT)
//
// Changes vs original:
//  • getVacanciesBySegment() now delegates to EnterpriseProfileAnalyticsService
//    (kept here for backwards-compat; facade still wires both)
//  • getSubmissions() now lives here but is clearly labelled as an
//    administrative query, not an analytics function — move to a
//    SubmissionQueryService when you have time.
//  No new analytics added; the real enterprise-profile analytics are
//  in enterprise-profile.analytics.service.ts.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryService } from '../core/analytics-query.service';
import { SubmissionStatus } from '../core/analytics-enums';
import type { AnalyticsFilter, SubmissionListFilter } from '../core/analytics-types';
import type { EnterpriseProfileSegment } from '../core/analytics-types';
import type { EnterpriseProfileAnalyticsService } from './enterprise-profile.analytics.service';

@Injectable()
export class EducationAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly query: AnalyticsQueryService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // Vacancies by segment – delegates to EnterpriseProfileService.
    // Kept for backwards compatibility with existing facade wiring.
    // ─────────────────────────────────────────────────────────────
    async getVacanciesBySegment(
        filter: AnalyticsFilter & { groupBy: 'enterpriseSize' | 'sector' },
        enterpriseProfile: Pick<EnterpriseProfileAnalyticsService, 'getVacanciesBySegment'>,
    ): Promise<EnterpriseProfileSegment[]> {
        return enterpriseProfile.getVacanciesBySegment(filter);
    }

    // ─────────────────────────────────────────────────────────────
    // Administrative: raw submission list
    // TODO: move to SubmissionQueryService when architecture allows.
    // ─────────────────────────────────────────────────────────────
    async getSubmissions(filter: SubmissionListFilter) {
        return (this.prisma as any).onefopSubmission.findMany({
            where: this.query.buildSubmissionWhere(filter, filter.status ?? SubmissionStatus.APPROVED),
            orderBy: { createdAt: 'desc' },
            take: filter.limit ?? 50,
            skip: filter.offset ?? 0,
            include: {
                respondent: true,
                enterpriseDetail: true,
                cooperativeDetail: true,
                ctdDetail: true,
                ongDetail: true,
            },
        });
    }
}