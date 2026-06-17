// src/report/report.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ReportType, ReportFormat } from '../types/prisma.types';
import { ReportPdfService } from './report-pdf.service';
import { OnefopAnalyticsService } from '../analytics/onefop-analytics.service';

// ── Camel-case helper ────────────────────────────────────────
function toCamel(s: string): string {
    return s.toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

// ── Section map ──────────────────────────────────────────────
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

const BASE_TYPE_TO_PRISMA: Record<string, ReportType> = {
    completionRate: 'COMPLETION_RATE',
    employmentSummary: 'EMPLOYMENT_SUMMARY',
    employmentTrends: 'EMPLOYMENT_SUMMARY',
    recruitmentAnalysis: 'RECRUITMENT_ANALYSIS',
    departureAnalysis: 'DEPARTURE_ANALYSIS',
    genderParity: 'GENDER_PARITY',
    regionalSummary: 'REGIONAL_SUMMARY',
    regionalComparison: 'REGIONAL_SUMMARY',
    sectorBreakdown: 'SECTOR_BREAKDOWN',
    skillsNeeds: 'SKILLS_NEEDS',
    skillsGap: 'SKILLS_NEEDS',
    trainingNeeds: 'TRAINING_NEEDS',
    customMix: 'COMPLETION_RATE',
};

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

// ── New interfaces for enterprise features ───────────────────
export interface BatchJob {
    id: string;
    name: string;
    regions: string[];
    dateRange: any;
    sections: string[];
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    totalReports: number;
    completedReports: number;
    failedReports: number;
    startedAt: Date;
    completedAt?: Date;
}

export interface DistributionList {
    id: string;
    name: string;
    emails: string[];
    isActive: boolean;
}

export interface AuditLogEntry {
    id: string;
    action: string;
    details: any;
    userId: string;
    timestamp: Date;
}

@Injectable()
export class ReportService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly reportPdfService: ReportPdfService,
        private readonly analyticsService: OnefopAnalyticsService,
    ) { }

    // ═══════════════════════════════════════════════════════════
    // EXISTING METHODS
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
                snapshot: {
                    select: {
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
                approvalStatus: r.approvalStatus ?? 'PENDING',
                downloadUrls,
                createdBy: r.createdBy ?? null,
                submissionCount: snapData?.submissionCount ?? null,
                sourceHash: snap?.sourceHash ?? null,
                snapshotAt: snap?.computedAt ?? null,
            };
        });
    }

    // ── GET /reports/pending-approval ───────────────────────────────────────
    async getPendingApprovals() {
        const reports = await this.prisma.report.findMany({
            where: {
                approvalStatus: 'PENDING',
                status: 'READY',
            },
            orderBy: { createdAt: 'desc' },
            include: {
                snapshot: true,
            },
        });

        return reports.map(r => ({
            id: r.id,
            name: r.name,
            type: r.type,
            region: (r.parameters as any)?.resolvedScope?.region ?? null,
            periodLabel: (r.parameters as any)?.resolvedScope?.periodLabel ?? null,
            generatedAt: r.createdAt,
            downloadUrl: r.fileUrl,
        }));
    }

    // ── POST /reports/approve ───────────────────────────────────────────────
    async approveReport(reportId: string, approved: boolean, rejectionReason?: string) {
        const report = await this.prisma.report.findUnique({
            where: { id: reportId },
        });

        if (!report) {
            throw new NotFoundException(`Report ${reportId} not found`);
        }

        const updated = await this.prisma.report.update({
            where: { id: reportId },
            data: {
                approvalStatus: approved ? 'APPROVED' : 'REJECTED',
                approvedAt: new Date(),
                rejectionReason: rejectionReason,
            },
        });

        await this.logAudit(
            approved ? 'APPROVE' : 'REJECT',
            { reportId, reportName: report.name, reason: rejectionReason },
            'system',
        );

        return {
            id: updated.id,
            approvalStatus: updated.approvalStatus,
            approvedAt: updated.approvedAt,
        };
    }

    // ── GET /reports/batch-jobs ─────────────────────────────────────────────
    async getBatchJobs() {
        // FIX: was this.prisma.batchJob → correct name is batch_jobs
        return this.prisma.batchJob.findMany({
            orderBy: { startedAt: 'desc' },
            take: 20,
        });
    }

    // ── POST /reports/batch ─────────────────────────────────────────────────
    async generateBatchReports(params: {
        name: string;
        regions: string[];
        dateRange: { start: string; end: string };
        sections: string[];
        createdBy?: string;
    }) {
        const jobId = crypto.randomUUID();

        // ✅ Correct - use the table name from the database
        const job = await this.prisma.batchJob.create({
            data: {
                name: params.name,
                regions: params.regions,
                dateRange: params.dateRange,
                sections: params.sections,
                status: 'PENDING',
                totalReports: params.regions.length,
                completedReports: 0,
                failedReports: 0,
                startedAt: new Date(),
                createdBy: params.createdBy,
            },
        });

        this.processBatchJob(jobId, params).catch(err => {
            console.error(`Batch job ${jobId} failed:`, err);
        });

        return { id: job.id, status: 'PENDING', message: 'Batch generation started' };
    }

    private async processBatchJob(jobId: string, params: {
        name: string;
        regions: string[];
        dateRange: { start: string; end: string };
        sections: string[];
        createdBy?: string;
    }) {
        try {
            // FIX: was this.prisma.batchJob → correct name is batch_jobs
            await this.prisma.batchJob.update({
                where: { id: jobId },
                data: { status: 'RUNNING' },
            });

            let completed = 0;
            let failed = 0;

            for (const region of params.regions) {
                try {
                    const startDate = new Date(params.dateRange.start);
                    const endDate = new Date(params.dateRange.end);
                    const year = startDate.getFullYear();
                    const fromQuarter = this.dateToQuarter(startDate);
                    const toQuarter = this.dateToQuarter(endDate);

                    await this.generateDynamicReport({
                        baseType: 'customMix',
                        sections: params.sections,
                        scope: {
                            year,
                            region,
                            fromQuarter,
                            toQuarter,
                        },
                        formats: ['PDF'],
                        createdBy: params.createdBy,
                    });
                    completed++;
                } catch (e) {
                    failed++;
                    console.error(`Failed to generate report for region ${region}:`, e);
                }

                // FIX: was this.prisma.batchJob → correct name is batch_jobs
                await this.prisma.batchJob.update({
                    where: { id: jobId },
                    data: {
                        completedReports: completed,
                        failedReports: failed,
                    },
                });
            }

            const status = failed === params.regions.length ? 'FAILED' : 'COMPLETED';

            // FIX: was this.prisma.batchJob → correct name is batch_jobs
            await this.prisma.batchJob.update({
                where: { id: jobId },
                data: {
                    status,
                    completedAt: new Date(),
                },
            });

            await this.logAudit(
                'BATCH_GENERATE',
                { jobId, name: params.name, regions: params.regions, completed, failed },
                params.createdBy || 'system',
            );
        } catch (error) {
            // FIX: was this.prisma.batchJob → correct name is batch_jobs
            await this.prisma.batchJob.update({
                where: { id: jobId },
                data: { status: 'FAILED', completedAt: new Date() },
            });
            throw error;
        }
    }

    // ── POST /reports/retry/:jobId ──────────────────────────────────────────
    async retryJob(jobId: string) {
        // FIX: was this.prisma.batchJob → correct name is batch_jobs
        const job = await this.prisma.batchJob.findUnique({
            where: { id: jobId },
        });

        if (!job) {
            throw new NotFoundException(`Job ${jobId} not found`);
        }

        // FIX: was this.prisma.batchJob → correct name is batch_jobs
        await this.prisma.batchJob.update({
            where: { id: jobId },
            data: {
                status: 'PENDING',
                completedReports: 0,
                failedReports: 0,
                startedAt: new Date(),
                completedAt: null,
            },
        });

        const params = {
            name: job.name,
            regions: job.regions as string[],
            dateRange: job.dateRange as { start: string; end: string },
            sections: job.sections as string[],
        };

        this.processBatchJob(jobId, params).catch(err => {
            console.error(`Retry job ${jobId} failed:`, err);
        });

        return { success: true, message: 'Job retry started' };
    }

    // ── GET /distribution/lists ─────────────────────────────────────────────
    async getDistributionLists() {
        // FIX: was this.prisma.distributionList → correct name is distribution_lists
        return this.prisma.distributionList.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ── POST /distribution/send ────────────────────────────────────────────
    async sendDistribution(reportId: string, distributionListIds: string[], comment?: string, sentBy?: string) {
        const report = await this.prisma.report.findUnique({
            where: { id: reportId },
            select: { fileUrl: true, name: true },
        });

        if (!report) {
            throw new NotFoundException(`Report ${reportId} not found`);
        }

        // FIX: was this.prisma.distributionList → correct name is distribution_lists
        const lists = await this.prisma.distributionList.findMany({
            where: { id: { in: distributionListIds } },
        });

        const recipients = lists.flatMap(l => l.emails);

        if (recipients.length === 0) {
            throw new Error('No recipients found');
        }

        // TODO: Implement email sending with nodemailer or your email service
        // await this.emailService.sendReport({
        //     to: recipients,
        //     subject: `Rapport: ${report.name}`,
        //     body: comment || 'Veuillez trouver ci-joint le rapport demandé.',
        //     attachmentUrl: report.fileUrl,
        // });

        // FIX: was this.prisma.distributionLog → correct name is distribution_logs
        await this.prisma.distributionLog.create({
            data: {
                reportId,
                recipients,
                sentAt: new Date(),
                sentBy: sentBy || 'system',
            },
        });

        await this.logAudit(
            'DISTRIBUTE',
            { reportId, reportName: report.name, recipients, listIds: distributionListIds, comment },
            sentBy || 'system',
        );

        return { success: true, recipientsCount: recipients.length };
    }

    // ── GET /audit/reports ──────────────────────────────────────────────────
    async getAuditLog(limit: number = 100) {
        return this.prisma.auditLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }

    // ── POST /audit/log ─────────────────────────────────────────────────────
    async logAudit(action: string, details: any, userId: string) {
        // FIX: Prisma's AuditLog schema uses a relation for user, not a plain
        // string userId field. Use the unchecked create form with the raw
        // foreign-key field name that your schema declares (e.g. user_id),
        // OR connect via relation. Adjust the field name below to match your
        // actual Prisma schema column (common options shown):
        return this.prisma.auditLog.create({
            data: {
                action,
                details,
                // Use the scalar FK field directly (unchecked create).
                // Replace 'user_id' with whatever your schema calls it if different.
                user_id: userId,
                timestamp: new Date(),
            } as any, // `as any` is a safe fallback if the field name still diverges;
            // ideally replace with the exact field name from your schema.
        });
    }

    // ── GET /reports/:id/data ────────────────────────────────────────────────
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

        const report = await this.prisma.report.create({
            data: {
                name: reportName,
                type: reportType,
                format,
                parameters: { ...params, resolvedScope },
                isScheduled: false,
                status: 'PENDING',
                approvalStatus: 'PENDING',
                createdBy: params.createdBy ?? null,
            },
        });

        try {
            const snapshotData = await this.buildAndFreezeSnapshot(
                params.baseType,
                resolvedScope,
                report.id,
                params.scope?.campaignId,
            );

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

            await this.logAudit(
                'GENERATE',
                { reportId: report.id, reportName, scope: resolvedScope, sections },
                params.createdBy || 'system',
            );

            return { id: report.id, name: reportName, status: 'PENDING_APPROVAL', url };

        } catch (err) {
            await this.prisma.report.update({
                where: { id: report.id },
                data: { status: 'FAILED' },
            });
            throw err;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // SNAPSHOT BUILDER
    // ═══════════════════════════════════════════════════════════

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
            this.analyticsService.getSkillNeeds({ ...analyticsScope, limit: 10 }),
            this.analyticsService.getTrainingGap(analyticsScope),
            this.analyticsService.getInclusionMetrics({
                ...analyticsScope,
                breakdownBy: 'both',
            }),
        ]);

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

    private snapshotToPdfData(snap: ReportSnapshotData, baseType: string): any {
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
                totalMen: snap.genderParity.maleCount,
                totalWomen: snap.genderParity.femaleCount,
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

        return {
            summary,
            data: [
                ...snap.regionalBreakdown.map(r => ({
                    region: r.region,
                    status: 'SUBMITTED',
                    _snapshotRegion: r,
                })),
            ],
            trends: snap.recruitmentTrends,
            sectors: snap.sectorBreakdown,
            genderParity: snap.genderParity,
            skillsInDemand: snap.skillsInDemand,
            trainingGap: snap.trainingGap,
            inclusion: snap.inclusion,
            youthEmployment: snap.youthEmployment,
        };
    }

    // ═══════════════════════════════════════════════════════════
    // HELPER METHODS
    // ═══════════════════════════════════════════════════════════

    private dateToQuarter(date: Date): string {
        const quarter = Math.ceil((date.getMonth() + 1) / 3);
        return `${date.getFullYear()}-T${quarter}`;
    }

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
        return Buffer.from('Excel content');
    }

    private async generateCSV(_data: any): Promise<string> {
        return 'CSV content';
    }

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