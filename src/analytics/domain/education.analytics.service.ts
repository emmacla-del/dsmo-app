// analytics/domain/education.analytics.service.ts
//
// Covers: vacancies by segment and the submission list query.
// (The diploma methods live in recruitment.analytics.service.ts
//  since they're hire-side data, not education-side.)

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryService } from '../core/analytics-query.service';
import { SubmissionStatus } from '../core/analytics-enums';
import type {
    AnalyticsFilter,
    SubmissionListFilter,
    VacancySegment,
    EnterpriseDetailDbRow,
} from '../core/analytics-types';

@Injectable()
export class EducationAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly query: AnalyticsQueryService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // 1. Vacancies by segment
    // ─────────────────────────────────────────────────────────────
    async getVacanciesBySegment(
        filter: AnalyticsFilter & { groupBy: 'companySize' | 'sector' },
    ): Promise<VacancySegment[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const details: EnterpriseDetailDbRow[] = await (this.prisma as any).onefopEnterpriseDetail.findMany({
            where: { submissionId: { in: ids } },
            select: { enterpriseSize: true, sector: true, vacancies: true },
        });

        const map = new Map<string, { vacancies: number; count: number }>();
        for (const d of details) {
            const key = filter.groupBy === 'companySize'
                ? (d.enterpriseSize ?? 'Inconnu')
                : (d.sector ?? 'Inconnu');

            if (!map.has(key)) map.set(key, { vacancies: 0, count: 0 });
            const stats = map.get(key)!;
            stats.vacancies += d.vacancies ?? 0;
            stats.count += 1;
        }

        return Array.from(map.entries())
            .map(([segment, stats]) => ({
                segment,
                totalVacancies: stats.vacancies,
                companyCount: stats.count,
                avgVacanciesPerCompany: stats.count > 0 ? Math.round(stats.vacancies / stats.count) : 0,
            }))
            .sort((a, b) => b.totalVacancies - a.totalVacancies);
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Submission list
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