/**
 * employment.analytics.service.ts
 *
 * DATA SOURCE — all 4 questionnaires (Entreprise, Coopérative, CTD, ONG)
 *
 * Permanent employees stock (S1Q10 / S1Q09) is a single integer self-reported
 * by the respondent. It is stored directly in each entity detail table:
 *
 *   onefop_enterprise_details   → permanentWorkers  (S1Q10)  vacancies (S1Q11)
 *   onefop_cooperative_details  → permanentWorkers  (S1Q11)  vacancies (S1Q12)
 *   onefop_ctd_details          → permanentWorkers  (S1Q09)  vacancies (S1Q10)
 *   onefop_ong_details          → permanentWorkers  (S1Q10)  vacancies (S1Q11)
 *
 * There is NO breakdown of permanent employee stock by gender, CSP, or age.
 * Those dimensions only exist for FLOWS (recruits, applications, departures).
 *
 * This service exposes:
 *   - getPermanentEmployeeSummary()       total permanent employees + vacancies
 *   - getPermanentEmployeesByLocation()   grouped by region / department / subdivision
 *   - getPermanentEmployeesByEntityType() grouped by entity type
 *   - getPermanentEmployeesBySize()       Enterprise only, grouped by S1Q12 size category
 *
 * What this service deliberately does NOT compute (not collected):
 *   - Gender / CSP / age split of permanent employee stock
 *   - Average age of permanent employees
 *   - Female leadership rate
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryService } from '../core/analytics-query.service';
import { calculateRate } from '../core/analytics-utils';
import { EntityType } from '../core/analytics-enums';
import type { AnalyticsFilter } from '../core/analytics-types';

// ─── Output types ────────────────────────────────────────────────────────────

export interface PermanentEmployeeSummary {
    /** Sum of S1Q10 (or equivalent) across all matching submissions */
    totalPermanentEmployees: number;
    /** Sum of vacancies across all matching submissions */
    totalVacancies: number;
    /**
     * vacancies / (permanentEmployees + vacancies) × 100
     * Share of total positions that are unfilled.
     */
    vacancyRate: number;
    /** Number of approved submissions included in this aggregate */
    reportingEntities: number;
}

export interface PermanentEmployeesByLocation {
    name: string;
    totalEmployees: number;
    /** Number of entities reporting from this location */
    entityCount: number;
    avgEmployeesPerEntity: number;
}

export interface PermanentEmployeesByEntityType {
    entityType: string;
    totalPermanentEmployees: number;
    totalVacancies: number;
    entityCount: number;
}

export interface PermanentEmployeesBySize {
    sizeCategory: string; // TPE / PE / ME / GE
    totalPermanentEmployees: number;
    entityCount: number;
}

// ─── Internal helper ─────────────────────────────────────────────────────────

interface DetailRow {
    submissionId: string;
    permanentEmployees: number;
    vacancies: number;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class EmploymentAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly query: AnalyticsQueryService,
    ) { }

    /**
     * Reads permanentWorkers + vacancies from all 4 entity detail tables in
     * parallel and merges them into a single flat list.
     *
     * Each submission appears in exactly ONE detail table depending on its
     * formType (ENTREPRISE / COOPERATIVE / CTD / ONG).
     * Nullable columns (Cooperative / CTD / ONG) are normalised to 0.
     */
    private async fetchDetailRows(ids: string[]): Promise<DetailRow[]> {
        if (!ids.length) return [];

        const [enterprises, cooperatives, ctds, ongs] = await Promise.all([
            (this.prisma as any).onefopEnterpriseDetail.findMany({
                where: { submissionId: { in: ids } },
                select: { submissionId: true, permanentWorkers: true, vacancies: true },
            }),
            (this.prisma as any).onefopCooperativeDetail.findMany({
                where: { submissionId: { in: ids } },
                select: { submissionId: true, permanentWorkers: true, vacancies: true },
            }),
            (this.prisma as any).onefopCtdDetail.findMany({
                where: { submissionId: { in: ids } },
                select: { submissionId: true, permanentWorkers: true, vacancies: true },
            }),
            (this.prisma as any).onefopOngDetail.findMany({
                where: { submissionId: { in: ids } },
                select: { submissionId: true, permanentWorkers: true, vacancies: true },
            }),
        ]);

        const normalise = (rows: any[]): DetailRow[] =>
            rows.map((r) => ({
                submissionId: r.submissionId,
                permanentEmployees: r.permanentWorkers ?? 0,
                vacancies: r.vacancies ?? 0,
            }));

        return [
            ...normalise(enterprises),
            ...normalise(cooperatives),
            ...normalise(ctds),
            ...normalise(ongs),
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Permanent employee summary
    //    Source: S1Q10 (Nombre d'employé permanent) — self-reported scalar
    // ─────────────────────────────────────────────────────────────────────────
    async getPermanentEmployeeSummary(filter: AnalyticsFilter): Promise<PermanentEmployeeSummary> {
        const submissions = await this.query.resolveSubmissions(filter);
        if (!submissions.length) {
            return {
                totalPermanentEmployees: 0,
                totalVacancies: 0,
                vacancyRate: 0,
                reportingEntities: 0,
            };
        }

        const rows = await this.fetchDetailRows(submissions.map((s) => s.id));

        const totalPermanentEmployees = rows.reduce((sum, r) => sum + r.permanentEmployees, 0);
        const totalVacancies = rows.reduce((sum, r) => sum + r.vacancies, 0);

        return {
            totalPermanentEmployees,
            totalVacancies,
            vacancyRate: calculateRate(totalVacancies, totalPermanentEmployees + totalVacancies),
            reportingEntities: submissions.length,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Permanent employees by location
    //    Groups S1Q10 by region / department / subdivision from Section 1.
    // ─────────────────────────────────────────────────────────────────────────
    async getPermanentEmployeesByLocation(
        filter: AnalyticsFilter & { groupBy: 'region' | 'department' | 'subdivision' },
    ): Promise<PermanentEmployeesByLocation[]> {
        const submissions = await this.query.resolveSubmissions(filter);
        if (!submissions.length) return [];

        const rows = await this.fetchDetailRows(submissions.map((s) => s.id));
        const employeesBySubmission = new Map<string, number>(
            rows.map((r) => [r.submissionId, r.permanentEmployees]),
        );

        const map = new Map<string, { totalEmployees: number; entityCount: number }>();

        for (const s of submissions) {
            const key =
                filter.groupBy === 'region'
                    ? (s.region ?? 'Inconnu')
                    : filter.groupBy === 'department'
                        ? (s.department ?? 'Inconnu')
                        : (s.subdivision ?? 'Inconnu');

            const entry = map.get(key) ?? { totalEmployees: 0, entityCount: 0 };
            entry.totalEmployees += employeesBySubmission.get(s.id) ?? 0;
            entry.entityCount += 1;
            map.set(key, entry);
        }

        return Array.from(map.entries())
            .map(([name, stats]) => ({
                name,
                totalEmployees: stats.totalEmployees,
                entityCount: stats.entityCount,
                avgEmployeesPerEntity:
                    stats.entityCount > 0
                        ? Math.round(stats.totalEmployees / stats.entityCount)
                        : 0,
            }))
            .sort((a, b) => b.totalEmployees - a.totalEmployees);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Permanent employees by entity type
    //    Compares ENTREPRISE / COOPERATIVE / CTD / ONG side by side.
    //    Uses formType from OnefopSubmission, which is always populated.
    // ─────────────────────────────────────────────────────────────────────────
    async getPermanentEmployeesByEntityType(
        filter: AnalyticsFilter,
    ): Promise<PermanentEmployeesByEntityType[]> {
        const submissions = await this.query.resolveSubmissions(filter);
        if (!submissions.length) return [];

        const rows = await this.fetchDetailRows(submissions.map((s) => s.id));
        const detailBySubmission = new Map<string, DetailRow>(
            rows.map((r) => [r.submissionId, r]),
        );

        const map = new Map<string, { employees: number; vacancies: number; count: number }>();

        for (const s of submissions) {
            // formType is the canonical entity discriminator on SubmissionMeta
            const key = s.formType ?? 'Unknown';
            const entry = map.get(key) ?? { employees: 0, vacancies: 0, count: 0 };
            const detail = detailBySubmission.get(s.id);
            entry.employees += detail?.permanentEmployees ?? 0;
            entry.vacancies += detail?.vacancies ?? 0;
            entry.count += 1;
            map.set(key, entry);
        }

        return Array.from(map.entries())
            .map(([entityType, stats]) => ({
                entityType,
                totalPermanentEmployees: stats.employees,
                totalVacancies: stats.vacancies,
                entityCount: stats.count,
            }))
            .sort((a, b) => b.totalPermanentEmployees - a.totalPermanentEmployees);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Permanent employees by enterprise size (Enterprise only)
    //    Source: S1Q12 — TPE / PE / ME / GE (collected for enterprises only)
    // ─────────────────────────────────────────────────────────────────────────
    async getPermanentEmployeesBySize(filter: AnalyticsFilter): Promise<PermanentEmployeesBySize[]> {
        // Filter to ENTREPRISE submissions using the correct EntityType value
        const submissions = await this.query.resolveSubmissions({
            ...filter,
            entityType: EntityType.ENTREPRISE,
        });
        if (!submissions.length) return [];

        const enterpriseRows: Array<{
            submissionId: string;
            permanentWorkers: number;
            enterpriseSize: string | null;
        }> = await (this.prisma as any).onefopEnterpriseDetail.findMany({
            where: { submissionId: { in: submissions.map((s) => s.id) } },
            select: { submissionId: true, permanentWorkers: true, enterpriseSize: true },
        });

        const map = new Map<string, { employees: number; count: number }>();

        for (const r of enterpriseRows) {
            const key = r.enterpriseSize ?? 'Unknown';
            const entry = map.get(key) ?? { employees: 0, count: 0 };
            entry.employees += r.permanentWorkers ?? 0;
            entry.count += 1;
            map.set(key, entry);
        }

        const order = ['TPE', 'PE', 'ME', 'GE', 'Unknown'];
        return order
            .filter((k) => map.has(k))
            .map((sizeCategory) => {
                const stats = map.get(sizeCategory)!;
                return {
                    sizeCategory,
                    totalPermanentEmployees: stats.employees,
                    entityCount: stats.count,
                };
            });
    }
}