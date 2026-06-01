// src/report/report.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ReportType, ReportFormat } from '../types/prisma.types';
import { ReportPdfService } from './report-pdf.service';
import { OnefopAnalyticsService } from '../analytics/onefop-analytics.service';

// ── Camel-case helper (COMPLETION_RATE → completionRate) ────────────────────
function toCamel(s: string): string {
    return s.toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

// ── Section map: keyed by frontend baseType (camelCase) ─────────────────────
const SECTIONS_BY_TYPE: Record<string, string[]> = {
    completionRate: ['kpi', 'regionalBreakdown', 'insights'],
    employmentTrends: ['kpi', 'trends', 'sectorAnalysis', 'establishmentPanel', 'insights'],
    employmentSummary: ['kpi', 'regionalBreakdown', 'demographics', 'insights'],
    recruitmentAnalysis: ['kpi', 'trends', 'sectorAnalysis', 'insights'],
    departureAnalysis: ['kpi', 'trends', 'insights'],
    genderParity: ['kpi', 'demographics', 'regionalBreakdown', 'insights'],
    regionalSummary: ['kpi', 'regionalBreakdown', 'sectorAnalysis', 'insights'],
    regionalComparison: ['kpi', 'regionalBreakdown', 'sectorAnalysis', 'insights'],
    skillsNeeds: ['kpi', 'sectorAnalysis', 'insights'],
    skillsGap: ['kpi', 'sectorAnalysis', 'insights'],
    trainingNeeds: ['kpi', 'sectorAnalysis', 'insights'],
    sectorBreakdown: ['kpi', 'sectorAnalysis', 'insights'],
    customMix: ['kpi', 'insights'],
};

// ── Frontend baseType → Prisma ReportType mapping ───────────────────────────
const BASE_TYPE_TO_PRISMA: Record<string, ReportType> = {
    completionRate: 'COMPLETION_RATE',
    employmentSummary: 'EMPLOYMENT_SUMMARY',
    employmentTrends: 'EMPLOYMENT_SUMMARY',
    recruitmentAnalysis: 'RECRUITMENT_ANALYSIS',
    departureAnalysis: 'DEPARTURE_ANALYSIS',
    genderParity: 'EMPLOYMENT_SUMMARY',
    regionalSummary: 'REGIONAL_SUMMARY',
    regionalComparison: 'REGIONAL_SUMMARY',
    sectorBreakdown: 'SECTOR_BREAKDOWN',
    skillsNeeds: 'SKILLS_NEEDS',
    skillsGap: 'SKILLS_NEEDS',
    trainingNeeds: 'TRAINING_NEEDS',
    customMix: 'COMPLETION_RATE',
};

// ── Human-readable type labels ───────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
    completionRate: 'Taux de Complétion',
    employmentTrends: "Tendances de l'Emploi",
    employmentSummary: 'Synthèse Emploi',
    recruitmentAnalysis: 'Analyse des Recrutements',
    departureAnalysis: 'Analyse des Départs',
    genderParity: 'Parité & Inclusion',
    regionalSummary: 'Synthèse Régionale',
    regionalComparison: 'Comparaison Régionale',
    sectorBreakdown: 'Répartition Sectorielle',
    skillsNeeds: 'Besoins en Compétences',
    skillsGap: 'Analyse des Compétences',
    trainingNeeds: 'Besoins en Formation',
    customMix: 'Rapport sur Mesure',
};

// ── Snapshot data shape ──────────────────────────────────────────────────────
// FIX 3: exported so ReportController can reference it in its return type annotation.

interface SnapshotScope {
    year: number | null;
    region: string | null;
    department: string | null;
    subdivision: string | null;
    fromQuarter: string | null;
    toQuarter: string | null;
    periodLabel: string | null;
}

export interface ReportSnapshotData {
    computedAt: string;
    scope: SnapshotScope;
    submissionCount: number;
    completionRate: Record<string, any> | null;
    genderParity: Record<string, any> | null;
    youthEmployment: Record<string, any> | null;
    recruitmentTrends: any[];
    skillsInDemand: any[];
    trainingGap: Record<string, any> | null;
    inclusion: Record<string, any> | null;
    regionalBreakdown: any[];
    sectorBreakdown: any[];
}

@Injectable()
export class ReportService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly reportPdfService: ReportPdfService,
        // ← Inject analytics service so reports use the same correct
        //   flat-key aggregation as the live analytics screen.
        //   Register OnefopAnalyticsService in your ReportModule providers.
        private readonly analyticsService: OnefopAnalyticsService,
    ) { }

    // ═══════════════════════════════════════════════════════════
    // PUBLIC — called by ReportController
    // ═══════════════════════════════════════════════════════════

    async generateCompletionRateReport(params: {
        campaignId?: string;
        region?: string;
        department?: string;
        format: ReportFormat;
        createdBy?: string | null;
    }) {
        let resolvedScope: Record<string, any> = {
            region: params.region ?? null,
            department: params.department ?? null,
            campaignId: params.campaignId ?? null,
        };

        if (params.campaignId) {
            resolvedScope = await this.resolveScopeFromCampaign(
                params.campaignId,
                resolvedScope,
            );
        }

        const reportName = this.buildReportTitle('completionRate', resolvedScope);

        const report = await this.prisma.report.create({
            data: {
                name: reportName,
                type: 'COMPLETION_RATE',
                format: params.format,
                parameters: { ...params, resolvedScope },
                isScheduled: false,
                status: 'PENDING',
                createdBy: params.createdBy ?? null,
            },
        });

        try {
            // Build and freeze the snapshot using the analytics service.
            // This is the single source of truth for this report forever.
            const snapshotData = await this.buildAndFreezeSnapshot(
                'completionRate',
                resolvedScope,
                report.id,
                params.campaignId,
            );

            let result: any;
            switch (params.format) {
                case 'PDF':
                    result = await this._generatePDF(snapshotData, 'completionRate', resolvedScope);
                    break;
                case 'EXCEL': result = await this.generateExcel(snapshotData); break;
                case 'CSV': result = await this.generateCSV(snapshotData); break;
                default: result = snapshotData;
            }

            await this.prisma.report.update({
                where: { id: report.id },
                data: {
                    status: 'READY',
                    ...(result?.url && { fileUrl: result.url }),
                    ...(result?.storagePath && { filePath: result.storagePath }),
                    ...(result?.hash && { fileHash: result.hash }),
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            });

            return result;
        } catch (err) {
            await this.prisma.report.update({
                where: { id: report.id },
                data: { status: 'FAILED' },
            });
            throw err;
        }
    }

    async generateEmploymentTrendsReport(params: {
        establishmentId?: string;
        sector?: string;
        region?: string;
        fromQuarter: string;
        toQuarter: string;
    }) {
        const submissions = await this.prisma.onefopSubmission.findMany({
            where: {
                quarterCode: { gte: params.fromQuarter, lte: params.toQuarter },
                status: 'APPROVED',
                ...(params.establishmentId && { establishmentId: params.establishmentId }),
                ...(params.sector && { company: { sectorId: params.sector } }),
                ...(params.region && { region: params.region }),
            },
            include: { company: true },
            orderBy: [{ establishmentId: 'asc' }, { quarterCode: 'asc' }],
        });

        const panelData = this.transformToPanelData(submissions);

        return {
            type: 'EMPLOYMENT_TRENDS',
            generatedAt: new Date(),
            parameters: params,
            data: panelData,
            summary: {
                totalEstablishments: new Set(submissions.map(s => s.establishmentId)).size,
                quartersRange: `${params.fromQuarter} - ${params.toQuarter}`,
                totalObservations: submissions.length,
            },
        };
    }

    async scheduleReport(reportConfig: {
        name: string;
        type: ReportType;
        parameters: any;
        schedule: string;
        recipients: string[];
        format: ReportFormat;
        createdBy?: string | null;
    }) {
        const report = await this.prisma.report.create({
            data: {
                name: reportConfig.name,
                type: reportConfig.type,
                format: reportConfig.format,
                parameters: reportConfig.parameters,
                isScheduled: true,
                schedule: reportConfig.schedule,
                status: 'READY',
                expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                createdBy: reportConfig.createdBy ?? null,
            },
        });

        await this.prisma.scheduledReport.create({
            data: {
                reportId: report.id,
                reportType: reportConfig.type,
                format: reportConfig.format,
                parameters: reportConfig.parameters,
                schedule: reportConfig.schedule,
                recipients: reportConfig.recipients,
                frequency: this.parseScheduleToFrequency(reportConfig.schedule),
                isActive: true,
            },
        });

        return report;
    }

    // ── GET /reports/history ─────────────────────────────────────────────────
    async getReportHistory() {
        const reports = await this.prisma.report.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                // Include snapshot so history cards can show submissionCount
                // and sourceHash without a second query.
                snapshot: {
                    select: {
                        // FIX 1: removed `submissionCount: false` — not a DB column;
                        // submissionCount lives inside snapshotData JSON and is read below.
                        computedAt: true,
                        sourceHash: true,
                        snapshotData: true,
                    },
                },
            },
        });

        return reports.map(r => {
            const params = (r.parameters as any) ?? {};
            const resolvedScope = params.resolvedScope ?? {};
            const snap = (r as any).snapshot;
            const snapData = snap?.snapshotData as ReportSnapshotData | undefined;

            const downloadUrls: Record<string, string | null> = {};
            if (r.fileUrl) downloadUrls['PDF'] = r.fileUrl;

            return {
                id: r.id,
                name: r.name,
                type: r.type ?? 'UNKNOWN',
                year: resolvedScope?.year ?? new Date(r.createdAt).getFullYear(),
                region: resolvedScope?.region ?? null,
                periodLabel: resolvedScope?.periodLabel ?? null,
                formats: r.format ? [r.format] : ['PDF'],
                generatedAt: r.createdAt,
                status: r.status ?? 'READY',
                downloadUrls,
                createdBy: r.createdBy ?? null,
                // Snapshot metadata shown in history card
                submissionCount: snapData?.submissionCount ?? null,
                sourceHash: snap?.sourceHash ?? null,
                snapshotAt: snap?.computedAt ?? null,
            };
        });
    }

    // ── GET /reports/:id/data ────────────────────────────────────────────────
    // Returns the frozen snapshot for a report.
    // NEVER recomputes — this is the authoritative historical record.
    async getReportData(reportId: string): Promise<ReportSnapshotData> {
        const snapshot = await this.prisma.reportSnapshot.findUnique({
            where: { reportId },
        });

        if (!snapshot) {
            throw new NotFoundException(
                `No snapshot found for report ${reportId}. ` +
                `This report was generated before snapshots were introduced. ` +
                `Re-generate it to create a frozen record.`,
            );
        }

        // FIX 2: cast through `unknown` first because Prisma types snapshotData
        // as JsonValue (which doesn't structurally overlap with ReportSnapshotData).
        // The runtime value is already the correct shape — this is TypeScript-only.
        return snapshot.snapshotData as unknown as ReportSnapshotData;
    }

    // ── GET /reports/scheduled ───────────────────────────────────────────────
    async getScheduledReports() {
        const rows = await this.prisma.scheduledReport.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });

        return rows.map(s => ({
            id: s.id,
            name: `${s.reportType} (auto)`,
            reportType: s.reportType,
            schedule: s.schedule,
            frequency: s.frequency ?? 'monthly',
            recipients: s.recipients ?? [],
            nextRun: null,
            isActive: s.isActive,
        }));
    }

    // ── POST /reports/dynamic ────────────────────────────────────────────────
    async generateDynamicReport(params: {
        baseType: string;
        sections: string[];
        scope: any;
        formats: string[];
        createdBy?: string | null;
    }) {
        // ① Resolve the actual collection period from campaign dates if needed
        let resolvedScope: Record<string, any> = { ...params.scope };

        if (
            params.scope?.campaignId &&
            (!params.scope.fromQuarter || !params.scope.toQuarter)
        ) {
            resolvedScope = await this.resolveScopeFromCampaign(
                params.scope.campaignId,
                params.scope,
            );
        } else if (params.scope?.fromQuarter && params.scope?.toQuarter) {
            resolvedScope = {
                ...resolvedScope,
                periodLabel: this.derivePeriodLabel(
                    params.scope.fromQuarter,
                    params.scope.toQuarter,
                ),
            };
        }

        const format = (params.formats?.[0] ?? 'PDF') as ReportFormat;
        const reportType = BASE_TYPE_TO_PRISMA[params.baseType] ?? 'COMPLETION_RATE';
        const reportName = this.buildReportTitle(params.baseType, resolvedScope);

        // ② Persist immediately in PENDING so Flutter history shows it
        const report = await this.prisma.report.create({
            data: {
                name: reportName,
                type: reportType,
                format,
                parameters: { ...params, resolvedScope },
                isScheduled: false,
                status: 'PENDING',
                createdBy: params.createdBy ?? null,
            },
        });

        try {
            // ③ Build and freeze the snapshot.
            //    Uses OnefopAnalyticsService (correct flat-key aggregation).
            //    Runs ONCE. Result stored in report_snapshots table permanently.
            //    Future reads return this record — DB is never queried again
            //    for these numbers.
            const snapshotData = await this.buildAndFreezeSnapshot(
                params.baseType,
                resolvedScope,
                report.id,
                params.scope?.campaignId,
            );

            // ④ Generate PDF from the frozen snapshot data
            const sections = params.sections.length > 0
                ? params.sections
                : (SECTIONS_BY_TYPE[params.baseType] ?? ['kpi', 'insights']);

            const { url, storagePath, hash } = await this.reportPdfService.generateAnalyticsReport({
                reportId: report.id,
                title: reportName,
                type: params.baseType,
                sections,
                scope: resolvedScope,
                data: this.snapshotToPdfData(snapshotData, params.baseType),
                generatedAt: new Date(),
            });

            // ⑤ Mark READY
            await this.prisma.report.update({
                where: { id: report.id },
                data: {
                    status: 'READY',
                    fileUrl: url,
                    fileHash: hash,
                    filePath: storagePath,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            });

            return { id: report.id, name: reportName, status: 'READY', url };

        } catch (err) {
            await this.prisma.report.update({
                where: { id: report.id },
                data: { status: 'FAILED' },
            });
            throw err;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // SNAPSHOT BUILDER — the heart of the architecture
    // ═══════════════════════════════════════════════════════════

    /**
     * Computes ALL aggregated numbers for a report using OnefopAnalyticsService
     * (which correctly reads flat rawData cell keys after BUG-3 fix), then
     * stores the result permanently in report_snapshots.
     *
     * This method runs EXACTLY ONCE per report.
     * It must never be called again for the same reportId.
     * All future reads go through getReportData() which returns the stored JSON.
     *
     * The PDF is built from this snapshot — so the PDF and the DB record
     * are guaranteed to show identical numbers.
     */
    private async buildAndFreezeSnapshot(
        baseType: string,
        resolvedScope: Record<string, any>,
        reportId: string,
        campaignId?: string,
    ): Promise<ReportSnapshotData> {

        const analyticsScope = {
            year: resolvedScope.year as number | undefined,
            region: resolvedScope.region as string | undefined,
            department: resolvedScope.department as string | undefined,
            subdivision: resolvedScope.subdivision as string | undefined,
        };

        const year = analyticsScope.year ?? new Date().getFullYear();
        const fromQ = resolvedScope.fromQuarter as string | undefined;
        const toQ = resolvedScope.toQuarter as string | undefined;

        // ── Fetch all analytics in parallel using the correct service ─────────
        // Each call uses OnefopAnalyticsService which reads flat rawData keys.
        // Non-applicable sections return null and are handled gracefully by PDF.

        const [
            genderParity,
            youthEmployment,
            recruitmentTrends,
            skillsInDemand,
            trainingGap,
            inclusion,
        ] = await Promise.allSettled([
            this.analyticsService.getGenderParity(analyticsScope),
            this.analyticsService.getYouthEmployment(analyticsScope),
            this.analyticsService.getRecruitmentTrends({
                startYear: fromQ ? parseInt(fromQ.split('-T')[0], 10) : year - 1,
                endYear: toQ ? parseInt(toQ.split('-T')[0], 10) : year,
                region: analyticsScope.region,
                department: analyticsScope.department,
                subdivision: analyticsScope.subdivision,
                granularity: 'quarter',
            }),
            this.analyticsService.getSkillDemand({ ...analyticsScope, limit: 10 }),
            this.analyticsService.getTrainingGap(analyticsScope),
            this.analyticsService.getInclusionMetrics({
                ...analyticsScope,
                breakdownBy: 'both',
            }),
        ]);

        // ── Completion rate: read from campaignSubmission, not onefopSubmission ─
        let completionRate: Record<string, any> | null = null;
        if (baseType === 'completionRate' || campaignId) {
            try {
                const where: any = {};
                if (campaignId) where.campaignId = campaignId;

                const subs = await this.prisma.campaignSubmission.findMany({ where });
                const total = subs.length;
                const submitted = subs.filter(s => s.status === 'SUBMITTED').length;
                const validated = subs.filter(s => s.status === 'VALIDATED').length;
                const notStarted = subs.filter(s => s.status === 'NOT_STARTED').length;
                const inProgress = subs.filter(s => s.status === 'IN_PROGRESS').length;

                completionRate = {
                    total,
                    submitted,
                    validated,
                    notStarted,
                    inProgress,
                    rate: total > 0 ? ((submitted / total) * 100).toFixed(1) : '0.0',
                };
            } catch { /* non-fatal */ }
        }

        // ── Regional breakdown from campaignSubmission ───────────────────────
        let regionalBreakdown: any[] = [];
        try {
            const where: any = {};
            if (campaignId) where.campaignId = campaignId;
            const subs = await this.prisma.campaignSubmission.findMany({
                where,
                include: { campaign: { select: { name: true } } },
            });

            const byRegion: Record<string, { total: number; submitted: number }> = {};
            for (const sub of subs) {
                const company = await this.prisma.company.findFirst({
                    where: { establishmentId: sub.establishmentId },
                    select: { region: true },
                });
                const region = company?.region ?? 'Inconnue';
                if (!byRegion[region]) byRegion[region] = { total: 0, submitted: 0 };
                byRegion[region].total++;
                if (['SUBMITTED', 'VALIDATED', 'APPROVED'].includes(sub.status)) {
                    byRegion[region].submitted++;
                }
            }

            regionalBreakdown = Object.entries(byRegion)
                .map(([region, counts]) => ({
                    region,
                    total: counts.total,
                    submitted: counts.submitted,
                    rate: counts.total > 0
                        ? Math.round((counts.submitted / counts.total) * 100)
                        : 0,
                }))
                .sort((a, b) => b.total - a.total);
        } catch { /* non-fatal */ }

        // ── Sector breakdown from onefopSubmission ───────────────────────────
        let sectorBreakdown: any[] = [];
        try {
            const onefopSubs = await this.prisma.onefopSubmission.findMany({
                where: {
                    status: 'APPROVED',
                    ...(analyticsScope.year && { surveyYear: analyticsScope.year }),
                    ...(analyticsScope.region && { region: analyticsScope.region }),
                    ...(analyticsScope.department && { department: analyticsScope.department }),
                },
                include: { company: { include: { sector: true } } },
            });

            const bySector: Record<string, number> = {};
            for (const sub of onefopSubs) {
                const sector = (sub as any).company?.sector?.name ?? 'Non classifié';
                bySector[sector] = (bySector[sector] ?? 0) + 1;
            }

            const sectorTotal = Object.values(bySector).reduce((a, b) => a + b, 0);
            sectorBreakdown = Object.entries(bySector)
                .map(([sector, count]) => ({
                    sector,
                    count,
                    pct: sectorTotal > 0 ? Math.round((count / sectorTotal) * 100) : 0,
                }))
                .sort((a, b) => b.count - a.count);
        } catch { /* non-fatal */ }

        // ── Collect submission IDs for audit trail ───────────────────────────
        let submissionIds: string[] = [];
        try {
            const subs = await this.prisma.onefopSubmission.findMany({
                where: {
                    status: 'APPROVED',
                    ...(analyticsScope.year && { surveyYear: analyticsScope.year }),
                    ...(analyticsScope.region && { region: analyticsScope.region }),
                },
                select: { id: true },
            });
            submissionIds = subs.map(s => s.id);
        } catch { /* non-fatal */ }

        const sourceHash = crypto
            .createHash('sha256')
            .update([...submissionIds].sort().join(','))
            .digest('hex');

        // ── Assemble the frozen snapshot ─────────────────────────────────────
        const snapshotData: ReportSnapshotData = {
            computedAt: new Date().toISOString(),
            scope: {
                year: resolvedScope.year ?? null,
                region: resolvedScope.region ?? null,
                department: resolvedScope.department ?? null,
                subdivision: resolvedScope.subdivision ?? null,
                fromQuarter: resolvedScope.fromQuarter ?? null,
                toQuarter: resolvedScope.toQuarter ?? null,
                periodLabel: resolvedScope.periodLabel ?? null,
            },
            submissionCount: submissionIds.length,
            completionRate,
            genderParity: genderParity.status === 'fulfilled' ? genderParity.value : null,
            youthEmployment: youthEmployment.status === 'fulfilled' ? youthEmployment.value : null,
            recruitmentTrends: recruitmentTrends.status === 'fulfilled' ? recruitmentTrends.value : [],
            skillsInDemand: skillsInDemand.status === 'fulfilled' ? skillsInDemand.value : [],
            trainingGap: trainingGap.status === 'fulfilled' ? trainingGap.value : null,
            inclusion: inclusion.status === 'fulfilled' ? inclusion.value : null,
            regionalBreakdown,
            sectorBreakdown,
        };

        // ── Persist permanently ──────────────────────────────────────────────
        await this.prisma.reportSnapshot.create({
            data: {
                reportId: reportId,
                snapshotData: snapshotData as any,
                sourceHash,
                submissionIds,
            },
        });

        return snapshotData;
    }

    // ═══════════════════════════════════════════════════════════
    // SNAPSHOT → PDF DATA ADAPTER
    // ═══════════════════════════════════════════════════════════

    /**
     * Converts the flat snapshot structure into the shape that
     * report-pdf.service.ts expects for each section renderer.
     *
     * This decouples the snapshot storage format from the PDF rendering format,
     * so either can evolve independently.
     */
    private snapshotToPdfData(
        snap: ReportSnapshotData,
        baseType: string,
    ): any {
        // Build the summary shape each KPI card renderer expects
        let summary: Record<string, any> = {};

        if (baseType === 'completionRate' && snap.completionRate) {
            summary = {
                total: snap.completionRate.total,
                submitted: snap.completionRate.submitted,
                validated: snap.completionRate.validated,
                notStarted: snap.completionRate.notStarted,
                inProgress: snap.completionRate.inProgress,
                completionRate: snap.completionRate.rate,
            };
        } else if (baseType === 'genderParity' && snap.genderParity) {
            summary = {
                totalEstablishments: snap.submissionCount,
                year: snap.scope.year,
                totalMen: snap.genderParity.maleApplicants,
                totalWomen: snap.genderParity.femaleApplicants,
            };
        } else if (
            ['employmentTrends', 'employmentSummary',
                'recruitmentAnalysis', 'departureAnalysis'].includes(baseType)
        ) {
            summary = {
                totalEstablishments: snap.submissionCount,
                quartersRange: snap.scope.fromQuarter && snap.scope.toQuarter
                    ? `${snap.scope.fromQuarter} - ${snap.scope.toQuarter}`
                    : String(snap.scope.year ?? ''),
                totalObservations: snap.recruitmentTrends.reduce(
                    (acc, t) => acc + t.totalRecruitments, 0,
                ),
            };
        } else {
            summary = {
                totalEstablishments: snap.submissionCount,
                year: snap.scope.year,
                totalObservations: snap.submissionCount,
            };
        }

        // Shape that each PDF section renderer reads:
        //   _drawKpiSection       → data.summary
        //   _drawRegionalBreakdown → data.data (array of submission-like objects)
        //   _drawTrendsSection    → data.data (panel array with .quarters)
        //   _drawSectorAnalysis   → data.data (array with .company.sector)
        //   _drawDemographics     → data.data (array with .menCount/.womenCount)

        return {
            summary,
            // Regional breakdown: pass pre-aggregated snapshot rows.
            // _drawRegionalBreakdown reads item.region + item.status,
            // so we reshape to match.
            data: [
                // Regional rows reshaped to what _drawRegionalBreakdown expects
                ...snap.regionalBreakdown.map(r => ({
                    region: r.region,
                    status: 'SUBMITTED', // pre-aggregated — rate is in r.rate
                    _snapshotRegion: r,  // carry full row for custom rendering
                })),
            ],
            // Trends: pass recruitment trend periods
            trends: snap.recruitmentTrends,
            // Sector: pass sector breakdown
            sectors: snap.sectorBreakdown,
            // Demographics: pass gender parity
            genderParity: snap.genderParity,
            // Skills
            skillsInDemand: snap.skillsInDemand,
            trainingGap: snap.trainingGap,
            // Inclusion
            inclusion: snap.inclusion,
            // Youth
            youthEmployment: snap.youthEmployment,
        };
    }

    // ═══════════════════════════════════════════════════════════
    // PERIOD RESOLUTION
    // ═══════════════════════════════════════════════════════════

    private async resolveScopeFromCampaign(
        campaignId: string,
        overrides: Record<string, any> = {},
    ): Promise<Record<string, any>> {
        const campaign = await this.prisma.dataCampaign.findUnique({
            where: { id: campaignId },
            select: { startDate: true, deadline: true, type: true, name: true },
        });

        if (!campaign) return overrides;

        const start = new Date(campaign.startDate);
        const end = new Date(campaign.deadline);
        const year = start.getFullYear();
        const endYear = end.getFullYear();

        const toQ = (d: Date) => Math.ceil((d.getMonth() + 1) / 3);
        const fromQuarter = `${year}-T${toQ(start)}`;
        const toQuarter = `${endYear}-T${toQ(end)}`;
        const periodLabel = this.derivePeriodLabel(fromQuarter, toQuarter, campaign.type);

        return {
            year,
            fromQuarter,
            toQuarter,
            periodLabel,
            campaignName: campaign.name,
            ...overrides,
        };
    }

    private derivePeriodLabel(
        fromQuarter: string,
        toQuarter: string,
        campaignType?: string,
    ): string {
        const [fromYear, fromQStr] = fromQuarter.split('-T');
        const [toYear, toQStr] = toQuarter.split('-T');
        const fromQ = parseInt(fromQStr, 10);
        const endQ = parseInt(toQStr, 10);
        const sameYear = fromYear === toYear;

        if (campaignType === 'ANNUAL' || (sameYear && fromQ === 1 && endQ === 4)) return `Annuel ${fromYear}`;
        if (sameYear && fromQ === 1 && endQ === 2) return `1er Semestre ${fromYear}`;
        if (sameYear && fromQ === 3 && endQ === 4) return `2e Semestre ${fromYear}`;
        if (sameYear && fromQ === endQ) return `T${fromQ} ${fromYear}`;
        return `${fromQuarter} \u2013 ${toQuarter}`;
    }

    private buildReportTitle(baseType: string, scope: any): string {
        const label = TYPE_LABELS[baseType] ?? baseType;
        const region = scope?.region ? ` \u2014 ${scope.region}` : '';

        if (scope?.periodLabel) {
            return `${label} \u00B7 ${scope.periodLabel}${region}`;
        }

        const from: string = scope?.fromQuarter ?? '';
        const to: string = scope?.toQuarter ?? '';
        if (from && to) {
            return `${label} \u00B7 ${this.derivePeriodLabel(from, to)}${region}`;
        }

        const year = scope?.year ?? new Date().getFullYear();
        return `${label} \u00B7 ${year}${region}`;
    }

    // ═══════════════════════════════════════════════════════════
    // FORMAT GENERATORS
    // ═══════════════════════════════════════════════════════════

    private async _generatePDF(
        data: any,
        baseType: string,
        resolvedScope: Record<string, any>,
    ): Promise<{ url: string; storagePath: string; hash: string }> {
        const sections = SECTIONS_BY_TYPE[baseType] ?? ['kpi', 'insights'];
        const title = this.buildReportTitle(baseType, resolvedScope);

        return this.reportPdfService.generateAnalyticsReport({
            reportId: crypto.randomUUID(),
            title,
            type: baseType,
            sections,
            scope: resolvedScope,
            data: this.snapshotToPdfData(data, baseType),
            generatedAt: new Date(),
        });
    }

    private async generateExcel(_data: any): Promise<Buffer> {
        // TODO: implement with exceljs
        return Buffer.from('Excel content');
    }

    private async generateCSV(_data: any): Promise<string> {
        // TODO: implement CSV serialization
        return 'CSV content';
    }

    // ═══════════════════════════════════════════════════════════
    // MISC HELPERS
    // ═══════════════════════════════════════════════════════════

    private parseScheduleToFrequency(schedule: string): string {
        if (schedule.includes('0 0 * * 0')) return 'weekly';
        if (schedule.includes('0 0 1 * *')) return 'monthly';
        if (schedule.includes('0 0 1 1,4,7,10 *')) return 'quarterly';
        return 'daily';
    }

    private transformToPanelData(submissions: any[]) {
        const panel: Record<string, any> = {};
        for (const sub of submissions) {
            if (!panel[sub.establishmentId]) {
                panel[sub.establishmentId] = {
                    establishmentId: sub.establishmentId,
                    companyName: sub.company?.name,
                    region: sub.region,
                    department: sub.department,
                    quarters: {},
                };
            }
            panel[sub.establishmentId].quarters[sub.quarterCode] = {
                submittedAt: sub.createdAt,
                status: sub.status,
                data: sub.rawData,
            };
        }
        return Object.values(panel);
    }
}