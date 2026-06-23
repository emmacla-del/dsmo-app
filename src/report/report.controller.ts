// src/report/report.controller.ts
import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../types/prisma.types';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
    constructor(private reportService: ReportService) { }

    // ── POST /reports/completion-rate ─────────────────────────────────────────
    @Post('completion-rate')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN, UserRole.ANALYST)
    async generateCompletionRateReport(@Body() params: any, @Req() req: any) {
        return this.reportService.generateCompletionRateReport({
            ...params,
            createdBy: req.user?.id ?? req.user?.userId ?? 'system',
        });
    }

    // ── POST /reports/employment-trends ───────────────────────────────────────
    @Post('employment-trends')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN, UserRole.ANALYST)
    async generateEmploymentTrends(@Body() params: any) {
        return this.reportService.generateEmploymentTrendsReport(params);
    }

    // ── POST /reports/schedule ────────────────────────────────────────────────
    @Post('schedule')
    @Roles(UserRole.SUPER_ADMIN)
    async scheduleReport(@Body() config: any, @Req() req: any) {
        return this.reportService.scheduleReport({
            ...config,
            createdBy: req.user?.id ?? req.user?.userId ?? 'system',
        });
    }

    // ── POST /reports/dynamic ─────────────────────────────────────────────────
    @Post('dynamic')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN, UserRole.ANALYST)
    async generateDynamic(@Body() body: any, @Req() req: any) {
        return this.reportService.generateDynamicReport({
            ...body,
            createdBy: req.user?.id ?? req.user?.userId ?? 'system',
        });
    }

    // ── GET /reports/history ──────────────────────────────────────────────────
    // IMPORTANT: all static GET routes (/history, /scheduled, /pending-approval,
    // /batch-jobs) MUST be declared before the parameterised route
    // GET /reports/:id/data — otherwise NestJS matches them as the :id param
    // and calls getReportData.
    @Get('history')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN, UserRole.ANALYST, UserRole.AUDITOR)
    async getHistory() {
        return this.reportService.getReportHistory();
    }

    // ── GET /reports/scheduled ────────────────────────────────────────────────
    @Get('scheduled')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN, UserRole.ANALYST)
    async getScheduled() {
        return this.reportService.getScheduledReports();
    }

    // ── GET /reports/pending-approval ─────────────────────────────────────────
    @Get('pending-approval')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN)
    async getPendingApprovals() {
        return this.reportService.getPendingApprovals();
    }

    // ── POST /reports/approve ─────────────────────────────────────────────────
    @Post('approve')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN)
    async approveReport(
        @Body('reportId') reportId: string,
        @Body('approved') approved: boolean,
        @Body('rejectionReason') rejectionReason: string | undefined,
        @Req() req: any,
    ) {
        return this.reportService.approveReport(
            reportId,
            approved,
            req.user?.id ?? req.user?.userId ?? 'system',
            rejectionReason,
        );
    }

    // ── GET /reports/batch-jobs ───────────────────────────────────────────────
    @Get('batch-jobs')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN, UserRole.ANALYST)
    async getBatchJobs() {
        return this.reportService.getBatchJobs();
    }

    // ── POST /reports/batch ───────────────────────────────────────────────────
    @Post('batch')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN)
    async generateBatch(@Body() body: any, @Req() req: any) {
        return this.reportService.generateBatchReports({
            ...body,
            createdBy: req.user?.id ?? req.user?.userId ?? 'system',
        });
    }

    // ── POST /reports/retry/:jobId ────────────────────────────────────────────
    @Post('retry/:jobId')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN)
    async retryJob(@Param('jobId') jobId: string) {
        return this.reportService.retryJob(jobId);
    }

    // ── GET /reports/:id/data ─────────────────────────────────────────────────
    // Returns the frozen snapshot for a specific report.
    // Numbers are exactly as they were at generation time — never recomputed.
    // Throws 404 if the report predates the snapshot system.
    @Get(':id/data')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN, UserRole.ANALYST, UserRole.AUDITOR)
    async getReportData(@Param('id') id: string) {
        return this.reportService.getReportData(id);
    }
}