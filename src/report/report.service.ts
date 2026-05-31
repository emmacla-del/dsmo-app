// src/report/report.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportType, ReportFormat } from '../types/prisma.types';

@Injectable()
export class ReportService {
    constructor(private prisma: PrismaService) { }

    // ═══════════════════════════════════════════════════════════
    // PUBLIC — called by ReportController
    // ═══════════════════════════════════════════════════════════

    async generateCompletionRateReport(params: {
        campaignId?: string;
        region?: string;
        department?: string;
        format: ReportFormat;
    }) {
        const data = await this.getCompletionRateData(params);

        switch (params.format) {
            case 'PDF':
                return this.generatePDF(data);
            case 'EXCEL':
                return this.generateExcel(data);
            case 'CSV':
                return this.generateCSV(data);
            default:
                return data;
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
                createdBy: 'system',
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

    async getReportHistory() {
        const reports = await this.prisma.report.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        return reports.map(r => ({
            id: r.id,
            name: r.name,
            type: r.type,
            year: new Date(r.createdAt).getFullYear(),
            region: (r.parameters as any)?.region ?? null,
            formats: r.format ? [r.format] : ['PDF'],
            generatedAt: r.createdAt,
            status: r.status ?? 'READY',
            downloadUrls: {},
        }));
    }

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
            frequency: s.frequency,
            recipients: s.recipients ?? [],
            nextRun: null,
            isActive: s.isActive,
        }));
    }

    async generateDynamicReport(params: {
        baseType: string;
        sections: string[];
        scope: any;
        formats: string[];
    }) {
        const report = await this.prisma.report.create({
            data: {
                name: `${params.baseType} · ${params.scope?.year ?? new Date().getFullYear()}`,
                type: params.baseType.toUpperCase() as ReportType,
                format: (params.formats?.[0] ?? 'PDF') as ReportFormat,
                parameters: params,
                isScheduled: false,
                status: 'PENDING',
                createdBy: 'system',
            },
        });

        // TODO: enqueue to a background job queue for actual generation
        return { id: report.id, name: report.name, status: 'PENDING' };
    }

    // ═══════════════════════════════════════════════════════════
    // PRIVATE — internal helpers
    // ═══════════════════════════════════════════════════════════

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
            type: 'COMPLETION_RATE' as ReportType,
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

    private async generatePDF(data: any): Promise<Buffer> {
        // TODO: implement with pdfkit or puppeteer
        return Buffer.from('PDF content');
    }

    private async generateExcel(data: any): Promise<Buffer> {
        // TODO: implement with exceljs or xlsx
        return Buffer.from('Excel content');
    }

    private async generateCSV(data: any): Promise<string> {
        // TODO: implement CSV serialization
        return 'CSV content';
    }
}