// src/report/report.service.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ReportType, ReportFormat } from '../types/prisma.types';
import { ReportPdfService } from './report-pdf.service';

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

// ── Human-readable type labels (mirrors report-pdf.service.ts typeLabel) ────
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
        // ① Resolve the actual collection period from the campaign if one is given.
        //    Without this, the report title defaults to the current year regardless
        //    of which campaign period is being reported on.
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

        const data = await this.getCompletionRateData(params);
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
            let result: any;
            switch (params.format) {
                case 'PDF':
                    result = await this._generatePDF(data, 'completionRate', resolvedScope);
                    break;
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
            const resolvedScope = params.resolvedScope ?? {};
            const downloadUrls: Record<string, string | null> = {};
            if (r.fileUrl) downloadUrls['PDF'] = r.fileUrl;

            return {
                id: r.id,
                name: r.name,
                type: r.type ?? r.reportType ?? 'UNKNOWN',
                year: resolvedScope?.year ?? params.scope?.year ?? new Date(r.createdAt).getFullYear(),
                region: resolvedScope?.region ?? params.scope?.region ?? params.region ?? null,
                periodLabel: resolvedScope?.periodLabel ?? null,
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
        // ① Resolve the actual collection period.
        //    Priority order:
        //      a) Flutter sent explicit fromQuarter + toQuarter → use them as-is
        //      b) Flutter sent campaignId but no quarter range  → derive from campaign
        //      c) Neither                                       → fall back to year
        let resolvedScope: Record<string, any> = { ...params.scope };

        if (
            params.scope?.campaignId &&
            (!params.scope.fromQuarter || !params.scope.toQuarter)
        ) {
            resolvedScope = await this.resolveScopeFromCampaign(
                params.scope.campaignId,
                params.scope,   // Flutter values win over derived ones
            );
        } else if (params.scope?.fromQuarter && params.scope?.toQuarter) {
            // Flutter sent explicit quarters; still compute periodLabel for the title
            resolvedScope = {
                ...resolvedScope,
                periodLabel: this.derivePeriodLabel(
                    params.scope.fromQuarter,
                    params.scope.toQuarter,
                ),
            };
        }

        const year = resolvedScope?.year ?? new Date().getFullYear();
        const format = (params.formats?.[0] ?? 'PDF') as ReportFormat;
        const reportType = BASE_TYPE_TO_PRISMA[params.baseType] ?? 'COMPLETION_RATE';

        // ② Title now always carries a meaningful period + optional region
        const reportName = this.buildReportTitle(params.baseType, resolvedScope);

        // ③ Persist in PENDING state immediately so Flutter history shows it
        const report = await this.prisma.report.create({
            data: {
                name: reportName,
                type: reportType,
                format,
                // Store both raw params and resolved scope for auditability
                parameters: { ...params, resolvedScope },
                isScheduled: false,
                status: 'PENDING',
                createdBy: params.createdBy ?? null,
            },
        });

        // ④ Fetch real data for the report type
        let reportData: any = null;
        try {
            const dataType = params.baseType
                .replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
                .toUpperCase();
            reportData = await this.buildDataForType(dataType, resolvedScope);
        } catch { /* each section renders its own empty-state gracefully */ }

        // ⑤ Generate the PDF and upload to Supabase
        try {
            const sections = params.sections.length > 0
                ? params.sections
                : (SECTIONS_BY_TYPE[params.baseType] ?? ['kpi', 'insights']);

            const { url, storagePath, hash } = await this.reportPdfService.generateAnalyticsReport({
                reportId: report.id,
                title: reportName,       // ← full dynamic title on the PDF cover
                type: params.baseType,  // ← camelCase baseType for PDF section rendering
                sections,
                scope: resolvedScope,    // ← resolved scope with period info
                data: reportData,
                generatedAt: new Date(),
            });

            // ⑥ Mark READY and persist the signed URL
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
    // PERIOD RESOLUTION
    // ═══════════════════════════════════════════════════════════

    /**
     * Reads a campaign's startDate, deadline and type from the DB
     * and derives fromQuarter, toQuarter, year and a human-readable
     * periodLabel. Flutter-supplied values in `overrides` always win.
     *
     * Examples:
     *   QUARTERLY  T3 2024      → "T3 2024"
     *   SEMESTER   T1–T2 2024   → "1er Semestre 2024"
     *   ANNUAL     T1–T4 2024   → "Annuel 2024"
     *   Multi-year T4 2024–T1 2025 → "2024-T4 – 2025-T1"
     */
    private async resolveScopeFromCampaign(
        campaignId: string,
        overrides: Record<string, any> = {},
    ): Promise<Record<string, any>> {
        const campaign = await this.prisma.dataCampaign.findUnique({
            where: { id: campaignId },
            select: {
                startDate: true,
                deadline: true,
                type: true,
                name: true,
            },
        });

        if (!campaign) return overrides;

        const start = new Date(campaign.startDate);
        const end = new Date(campaign.deadline);
        const year = start.getFullYear();
        const endYear = end.getFullYear();

        const toQ = (d: Date) => Math.ceil((d.getMonth() + 1) / 3);
        const fromQ = toQ(start);
        const endQ = toQ(end);

        const fromQuarter = `${year}-T${fromQ}`;
        const toQuarter = `${endYear}-T${endQ}`;

        const periodLabel = this.derivePeriodLabel(fromQuarter, toQuarter, campaign.type);

        return {
            year,
            fromQuarter,
            toQuarter,
            periodLabel,
            campaignName: campaign.name,
            // Flutter overrides always win if explicitly provided
            ...overrides,
        };
    }

    /**
     * Derives a human-readable period label from a quarter range string pair.
     * Can be called independently when Flutter supplies explicit quarters.
     *
     * @param campaignType  optional campaign type for ANNUAL shortcut
     */
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

        if (campaignType === 'ANNUAL' || (sameYear && fromQ === 1 && endQ === 4)) {
            return `Annuel ${fromYear}`;
        }
        if (sameYear && fromQ === 1 && endQ === 2) return `1er Semestre ${fromYear}`;
        if (sameYear && fromQ === 3 && endQ === 4) return `2e Semestre ${fromYear}`;
        if (sameYear && fromQ === endQ) return `T${fromQ} ${fromYear}`;

        // Multi-year or non-standard range
        return `${fromQuarter} \u2013 ${toQuarter}`;
    }

    // ═══════════════════════════════════════════════════════════
    // TITLE BUILDER
    // ═══════════════════════════════════════════════════════════

    /**
     * Builds the full report title used on the PDF cover and in the DB.
     *
     * Priority for period:
     *   1. scope.periodLabel  (set by resolveScopeFromCampaign or derivePeriodLabel)
     *   2. scope.fromQuarter + scope.toQuarter  (Flutter explicit)
     *   3. scope.year  (last resort)
     *
     * Examples:
     *   "Taux de Complétion · T3 2024"
     *   "Tendances de l'Emploi · 1er Semestre 2024 — Littoral"
     *   "Parité & Inclusion · Annuel 2024"
     */
    private buildReportTitle(baseType: string, scope: any): string {
        const label = TYPE_LABELS[baseType] ?? baseType;
        const region = scope?.region ? ` \u2014 ${scope.region}` : '';

        // ① Best case: period already resolved to a clean label
        if (scope?.periodLabel) {
            return `${label} \u00B7 ${scope.periodLabel}${region}`;
        }

        // ② Flutter sent explicit quarter range — compute label inline
        const from: string = scope?.fromQuarter ?? '';
        const to: string = scope?.toQuarter ?? '';

        if (from && to) {
            const periodLabel = this.derivePeriodLabel(from, to);
            return `${label} \u00B7 ${periodLabel}${region}`;
        }

        // ③ Last resort: year only
        const year = scope?.year ?? new Date().getFullYear();
        return `${label} \u00B7 ${year}${region}`;
    }

    // ═══════════════════════════════════════════════════════════
    // PRIVATE — data builders
    // ═══════════════════════════════════════════════════════════

    /**
     * Fetches real DB data for each report type so PDF sections have content.
     * `type` is the SNAKE_CASE version of the frontend baseType.
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

                // FIX: include summary so KPI cards are not blank for gender parity reports
                let men = 0;
                let women = 0;
                for (const sub of submissions) {
                    men += (sub as any).company?.menCount ?? (sub as any).menCount ?? 0;
                    women += (sub as any).company?.womenCount ?? (sub as any).womenCount ?? 0;
                }

                return {
                    data: submissions,
                    summary: {
                        totalEstablishments: new Set(submissions.map((s: any) => s.establishmentId)).size,
                        year,
                        totalMen: men,
                        totalWomen: women,
                    },
                };
            }

            case 'SECTOR_BREAKDOWN':
            case 'SKILLS_NEEDS':
            case 'SKILLS_GAP':
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

                return {
                    data: submissions,
                    summary: {
                        totalEstablishments: new Set(submissions.map((s: any) => s.establishmentId)).size,
                        year,
                        totalObservations: submissions.length,
                    },
                };
            }

            case 'REGIONAL_SUMMARY':
            case 'REGIONAL_COMPARISON': {
                const submissions = await this.prisma.campaignSubmission.findMany({
                    include: {
                        campaign: { select: { name: true, code: true } },
                    },
                });

                return {
                    data: submissions,
                    summary: {
                        totalEstablishments: new Set(submissions.map((s: any) => s.establishmentId)).size,
                        totalObservations: submissions.length,
                    },
                };
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

    private async _generatePDF(
        data: { type: string; generatedAt: Date; parameters: any; data: any; summary: any },
        baseType?: string,
        resolvedScope?: Record<string, any>,
    ): Promise<{ url: string; storagePath: string; hash: string }> {
        const type = baseType ?? toCamel(String(data.type));
        const sections = SECTIONS_BY_TYPE[type] ?? ['kpi', 'insights'];
        const scope = resolvedScope ?? data.parameters;
        const title = this.buildReportTitle(type, scope);

        return this.reportPdfService.generateAnalyticsReport({
            reportId: crypto.randomUUID(),
            title,
            type,
            sections,
            scope,
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