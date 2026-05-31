// src/report/report.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportType, ReportFormat } from '../types/prisma.types';
import { ReportPdfService } from './report-pdf.service';

// ── Camel-case helper (COMPLETION_RATE → completionRate) ────────────────────
function toCamel(s: string): string {
    return s.toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

// ── Section map: ReportType → default sections ──────────────────────────────
const SECTIONS_BY_TYPE: Record<string, string[]> = {
    COMPLETION_RATE: ['kpi', 'regionalBreakdown', 'insights'],
    EMPLOYMENT_TRENDS: ['kpi', 'trends', 'sectorAnalysis', 'establishmentPanel', 'insights'],
    EMPLOYMENT_SUMMARY: ['kpi', 'regionalBreakdown', 'demographics', 'insights'],
    RECRUITMENT_ANALYSIS: ['kpi', 'trends', 'sectorAnalysis', 'insights'],
    DEPARTURE_ANALYSIS: ['kpi', 'trends', 'insights'],
    GENDER_PARITY: ['kpi', 'demographics', 'regionalBreakdown', 'insights'],
    REGIONAL_SUMMARY: ['kpi', 'regionalBreakdown', 'sectorAnalysis', 'insights'],
    SKILLS_NEEDS: ['kpi', 'sectorAnalysis', 'insights'],
    TRAINING_NEEDS: ['kpi', 'sectorAnalysis', 'insights'],
    SECTOR_BREAKDOWN: ['kpi', 'sectorAnalysis', 'insights'],
};

// ── Frontend baseType → Prisma ReportType mapping ───────────────────────────
// Prisma enum only has these 8 values; map unsupported frontend types to valid ones.
const BASE_TYPE_TO_PRISMA: Record<string, ReportType> = {
    completionRate: 'COMPLETION_RATE',
    employmentSummary: 'EMPLOYMENT_SUMMARY',
    employmentTrends: 'EMPLOYMENT_SUMMARY',      // not in Prisma enum → closest match
    recruitmentAnalysis: 'RECRUITMENT_ANALYSIS',
    departureAnalysis: 'DEPARTURE_ANALYSIS',
    genderParity: 'EMPLOYMENT_SUMMARY',           // not in Prisma enum → closest match
    regionalSummary: 'REGIONAL_SUMMARY',
    sectorBreakdown: 'SECTOR_BREAKDOWN',
    skillsNeeds: 'SKILLS_NEEDS',
    trainingNeeds: 'TRAINING_NEEDS',
};

@Injectable()
export class ReportService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly reportPdfService: ReportPdfService,
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
        const data = await this.getCompletionRateData(params);

        // Persist in PENDING state so history tracks who triggered it
        const report = await this.prisma.report.create({
            data: {
                name: `Completion Rate · ${new Date().getFullYear()}`,
                type: 'COMPLETION_RATE',
                format: params.format,
                parameters: params,
                isScheduled: false,
                status: 'PENDING',
                createdBy: params.createdBy ?? null,
            },
        });

        try {
            let result: any;
            switch (params.format) {
                case 'PDF': result = await this.generatePDF(data); break;
                case 'EXCEL': result = await this.generateExcel(data); break;
                case 'CSV': result = await this.generateCSV(data); break;
                default: result = data;
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
        });

        return reports.map(r => {
            const params = (r.parameters as any) ?? {};
            const downloadUrls: Record<string, string | null> = {};
            if (r.fileUrl) downloadUrls['PDF'] = r.fileUrl;

            return {
                id: r.id,
                name: r.name,
                type: r.type ?? r.reportType ?? 'UNKNOWN',
                year: params.scope?.year ?? new Date(r.createdAt).getFullYear(),
                region: params.scope?.region ?? params.region ?? null,
                formats: r.format ? [r.format] : ['PDF'],
                generatedAt: r.createdAt,
                status: r.status ?? 'READY',
                downloadUrls,
                createdBy: r.createdBy ?? null,
            };
        });
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
        const year = params.scope?.year ?? new Date().getFullYear();

        // ① Map frontend camelCase to a valid Prisma enum value
        const reportType = BASE_TYPE_TO_PRISMA[params.baseType] ?? 'COMPLETION_RATE';
        const format = (params.formats?.[0] ?? 'PDF') as ReportFormat;

        // ② Persist in PENDING state so Flutter history shows it immediately
        const report = await this.prisma.report.create({
            data: {
                name: `${params.baseType} · ${year}`,
                type: reportType,
                format,
                parameters: params,
                isScheduled: false,
                status: 'PENDING',
                createdBy: params.createdBy ?? null,
            },
        });

        // ③ Fetch data for the requested type (non-fatal if it fails)
        let reportData: any = null;
        try {
            // Use the original baseType for data building (SECTIONS_BY_TYPE uses SNAKE_CASE keys)
            const dataType = params.baseType
                .replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
                .toUpperCase();
            reportData = await this.buildDataForType(dataType, params.scope);
        } catch { /* sections render empty-state gracefully */ }

        // ④ Generate PDF and upload to Supabase
        try {
            const sections = params.sections.length > 0
                ? params.sections
                : (SECTIONS_BY_TYPE[reportType] ?? ['kpi', 'insights']);

            const { url, storagePath, hash } = await this.reportPdfService.generateAnalyticsReport({
                reportId: report.id,
                title: report.name,
                type: toCamel(reportType),           // converts COMPLETION_RATE → completionRate
                sections,
                scope: params.scope,
                data: reportData,
                generatedAt: new Date(),
            });

            // ⑤ Mark READY and persist the signed URL
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

            return { id: report.id, name: report.name, status: 'READY', url };

        } catch (err) {
            // ⑥ Mark FAILED so Flutter shows the error badge
            await this.prisma.report.update({
                where: { id: report.id },
                data: { status: 'FAILED' },
            });
            throw err;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PRIVATE — data builders
    // ═══════════════════════════════════════════════════════════

    /**
     * Fetches real DB data for each report type so PDF sections
     * have content when the report is generated.
     *
     * NOTE: type is passed as string to avoid Prisma enum comparison issues.
     * The frontend sends baseType like 'employmentTrends' which we uppercase
     * to 'EMPLOYMENT_TRENDS' for matching, but Prisma's ReportType enum
     * may not contain all these values. We use string comparison here.
     */
    private async buildDataForType(type: string, scope: any): Promise<any> {
        switch (type) {
            case 'COMPLETION_RATE':
                return this.getCompletionRateData({
                    campaignId: scope?.campaignId,
                    region: scope?.region,
                    department: scope?.department,
                });

            case 'EMPLOYMENT_TRENDS':
            case 'EMPLOYMENT_SUMMARY':
            case 'RECRUITMENT_ANALYSIS':
            case 'DEPARTURE_ANALYSIS': {
                const year = scope?.year ?? new Date().getFullYear();
                const fromQuarter = scope?.fromQuarter ?? `${year - 1}-T1`;
                const toQuarter = scope?.toQuarter ?? `${year}-T4`;
                const submissions = await this.prisma.onefopSubmission.findMany({
                    where: {
                        quarterCode: { gte: fromQuarter, lte: toQuarter },
                        status: 'APPROVED',
                        ...(scope?.region && { region: scope.region }),
                        ...(scope?.department && { department: scope.department }),
                    },
                    include: { company: true },
                    orderBy: [{ establishmentId: 'asc' }, { quarterCode: 'asc' }],
                });
                return {
                    data: this.transformToPanelData(submissions),
                    summary: {
                        totalEstablishments: new Set(submissions.map((s: any) => s.establishmentId)).size,
                        quartersRange: `${fromQuarter} - ${toQuarter}`,
                        totalObservations: submissions.length,
                    },
                };
            }

            case 'GENDER_PARITY': {
                const year = scope?.year ?? new Date().getFullYear();
                const submissions = await this.prisma.onefopSubmission.findMany({
                    where: {
                        surveyYear: year,
                        status: 'APPROVED',
                        ...(scope?.region && { region: scope.region }),
                        ...(scope?.department && { department: scope.department }),
                    },
                    include: { company: true },
                });
                return { data: submissions };
            }

            case 'SECTOR_BREAKDOWN':
            case 'SKILLS_NEEDS':
            case 'TRAINING_NEEDS': {
                const year = scope?.year ?? new Date().getFullYear();
                const submissions = await this.prisma.onefopSubmission.findMany({
                    where: {
                        surveyYear: year,
                        status: 'APPROVED',
                        ...(scope?.region && { region: scope.region }),
                    },
                    include: { company: { include: { sector: true } } },
                });
                return { data: submissions };
            }

            case 'REGIONAL_SUMMARY': {
                const submissions = await this.prisma.campaignSubmission.findMany({
                    include: {
                        campaign: { select: { name: true, code: true } },
                    },
                });
                return { data: submissions };
            }

            default:
                return null;
        }
    }

    private async getCompletionRateData(params: {
        campaignId?: string;
        region?: string;
        department?: string;
    }) {
        const where: any = {};
        if (params.campaignId) where.campaignId = params.campaignId;

        const submissions = await this.prisma.campaignSubmission.findMany({
            where,
            include: {
                campaign: { select: { name: true, code: true, deadline: true } },
            },
        });

        const total = submissions.length;
        const submitted = submissions.filter(s => s.status === 'SUBMITTED').length;
        const validated = submissions.filter(s => s.status === 'VALIDATED').length;
        const notStarted = submissions.filter(s => s.status === 'NOT_STARTED').length;
        const inProgress = submissions.filter(s => s.status === 'IN_PROGRESS').length;

        return {
            type: 'COMPLETION_RATE',
            generatedAt: new Date(),
            parameters: params,
            data: submissions,
            summary: {
                total,
                submitted,
                validated,
                notStarted,
                inProgress,
                completionRate: total > 0 ? ((submitted / total) * 100).toFixed(1) : '0.0',
            },
        };
    }

    // ── Format generators ────────────────────────────────────────────────────

    private async generatePDF(data: {
        type: string;
        generatedAt: Date;
        parameters: any;
        data: any;
        summary: any;
    }): Promise<{ url: string; storagePath: string; hash: string }> {
        const type = String(data.type);
        const sections = SECTIONS_BY_TYPE[type] ?? ['kpi', 'insights'];

        return this.reportPdfService.generateAnalyticsReport({
            reportId: crypto.randomUUID(),
            title: type.replace(/_/g, ' '),
            type: toCamel(type),
            sections,
            scope: data.parameters,
            data,
            generatedAt: data.generatedAt,
        });
    }

    private async generateExcel(_data: any): Promise<Buffer> {
        // TODO: implement with exceljs or xlsx
        return Buffer.from('Excel content');
    }

    private async generateCSV(_data: any): Promise<string> {
        // TODO: implement CSV serialization
        return 'CSV content';
    }

    // ── Misc helpers ─────────────────────────────────────────────────────────

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