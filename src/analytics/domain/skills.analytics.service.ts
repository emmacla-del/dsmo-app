// analytics/domain/skills.analytics.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryService } from '../core/analytics-query.service';
import { computeTrainingGap } from '../core/analytics-utils';
import type {
    AnalyticsFilter,
    SkillNeedRow,
    TrainingNeedRow,
    TrainingGapResult,
    SkillsDashboard,
    SkillItem,
    TrainingDomainItem,
    SkillNeedDbRow,
    TrainingNeedDbRow,
} from '../core/analytics-types';

@Injectable()
export class SkillsAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly query: AnalyticsQueryService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // 1. Skill needs
    // ─────────────────────────────────────────────────────────────
    async getSkillNeeds(filter: AnalyticsFilter & { limit?: number }): Promise<SkillNeedRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: SkillNeedDbRow[] = await (this.prisma as any).onefopSkillNeed.findMany({
            where: { submissionId: { in: ids }, skillDescription: { not: null } },
            select: { skillDescription: true, maleCount: true, femaleCount: true, totalCount: true },
        });

        const grouped = this.groupTextRows(rows, (r) => r.skillDescription?.trim() || 'Non précisé', (r) => ({
            male: r.maleCount ?? 0,
            female: r.femaleCount ?? 0,
            total: r.totalCount ?? 0,
        }));

        const result = grouped
            .map(([skill, c]) => ({ skill, maleCount: c.male, femaleCount: c.female, totalCount: c.total }))
            .sort((a, b) => b.totalCount - a.totalCount);

        return filter.limit ? result.slice(0, filter.limit) : result;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Training needs
    // ─────────────────────────────────────────────────────────────
    async getTrainingNeeds(filter: AnalyticsFilter & { limit?: number }): Promise<TrainingNeedRow[]> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return [];

        const rows: TrainingNeedDbRow[] = await (this.prisma as any).onefopTrainingNeed.findMany({
            where: { submissionId: { in: ids }, trainingDomain: { not: null } },
            select: { trainingDomain: true, maleCount: true, femaleCount: true, totalCount: true },
        });

        const grouped = this.groupTextRows(rows, (r) => r.trainingDomain?.trim() || 'Non précisé', (r) => ({
            male: r.maleCount ?? 0,
            female: r.femaleCount ?? 0,
            total: r.totalCount ?? 0,
        }));

        const result = grouped
            .map(([domain, c]) => ({ domain, maleCount: c.male, femaleCount: c.female, totalCount: c.total }))
            .sort((a, b) => b.totalCount - a.totalCount);

        return filter.limit ? result.slice(0, filter.limit) : result;
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Training gap
    // ─────────────────────────────────────────────────────────────
    async getTrainingGap(filter: AnalyticsFilter): Promise<TrainingGapResult> {
        const [skillNeeds, trainingNeeds] = await Promise.all([
            this.getSkillNeeds(filter),
            this.getTrainingNeeds(filter),
        ]);
        return computeTrainingGap(skillNeeds, trainingNeeds);
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Skills dashboard (aggregate) — called with pre-fetched data from facade
    // ─────────────────────────────────────────────────────────────
    computeSkillsDashboard(
        skillNeeds: SkillNeedRow[],
        trainingNeeds: TrainingNeedRow[],
        trainingGap: TrainingGapResult,
    ): SkillsDashboard {
        const topSkills: SkillItem[] = skillNeeds.map((s) => ({ skill: s.skill, totalCount: s.totalCount }));
        const topTrainingDomains: TrainingDomainItem[] = trainingNeeds.map((t) => ({ domain: t.domain, totalCount: t.totalCount }));

        const biggestSkillGaps = [...trainingGap.skillsInDemand, ...trainingGap.skillsInSurplus]
            .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
            .slice(0, 10);

        return { topSkills, topTrainingDomains, biggestSkillGaps };
    }

    async getSkillsDashboard(filter: AnalyticsFilter): Promise<SkillsDashboard> {
        const [skillNeeds, trainingNeeds, trainingGap] = await Promise.all([
            this.getSkillNeeds({ ...filter, limit: 10 }),
            this.getTrainingNeeds({ ...filter, limit: 10 }),
            this.getTrainingGap(filter),
        ]);
        return this.computeSkillsDashboard(skillNeeds, trainingNeeds, trainingGap);
    }

    // Alias for frontend compatibility
    async getSkillDemand(filter: AnalyticsFilter & { limit?: number }): Promise<SkillNeedRow[]> {
        return this.getSkillNeeds(filter);
    }

    // ─────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────
    private groupTextRows<T>(
        rows: T[],
        keyFn: (row: T) => string,
        valueFn: (row: T) => { male: number; female: number; total: number },
    ): [string, { male: number; female: number; total: number }][] {
        const map: Record<string, { male: number; female: number; total: number }> = {};

        for (const row of rows) {
            const key = keyFn(row);
            if (!map[key]) map[key] = { male: 0, female: 0, total: 0 };
            const v = valueFn(row);
            map[key].male += v.male;
            map[key].female += v.female;
            map[key].total += v.total;
        }

        return Object.entries(map);
    }
}