// src/report/report.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportType, ReportFormat } from '../types/prisma.types';

@Injectable()
export class ReportService {
    constructor(private prisma: PrismaService) { }

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
            orderBy: [{ establishmentId: 'asc' }, { quarterCode: 'asc' }]
        });

        // Transform into panel data format
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
            }
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
        // Create report template
        const report = await this.prisma.report.create({
            data: {
                name: reportConfig.name,
                type: reportConfig.type,
                format: reportConfig.format,
                parameters: reportConfig.parameters,
                isScheduled: true,
                schedule: reportConfig.schedule,
                expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
                createdBy: 'system',
            }
        });

        // Create scheduled delivery
        await this.prisma.scheduledReport.create({
            data: {
                reportId: report.id,
                recipients: reportConfig.recipients,
                frequency: this.parseScheduleToFrequency(reportConfig.schedule),
                nextSendAt: this.calculateNextRun(reportConfig.schedule),
                isActive: true,
            }
        });

        return report;
    }

    private parseScheduleToFrequency(schedule: string): string {
        if (schedule.includes('0 0 * * 0')) return 'weekly';
        if (schedule.includes('0 0 1 * *')) return 'monthly';
        if (schedule.includes('0 0 1 1,4,7,10 *')) return 'quarterly';
        return 'daily';
    }

    private calculateNextRun(schedule: string): Date {
        // Implementation for calculating next run time based on cron expression
        return new Date();
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
                    quarters: {}
                };
            }

            panel[sub.establishmentId].quarters[sub.quarterCode] = {
                submittedAt: sub.createdAt,
                status: sub.status,
                data: sub.rawData
            };
        }

        return Object.values(panel);
    }

    private async generatePDF(data: any): Promise<Buffer> {
        // Implementation using PDF generation library
        return Buffer.from('PDF content');
    }

    private async generateExcel(data: any): Promise<Buffer> {
        // Implementation using Excel generation library
        return Buffer.from('Excel content');
    }

    private async generateCSV(data: any): Promise<string> {
        // Implementation for CSV generation
        return 'CSV content';
    }
}