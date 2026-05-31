// src/report/report.controller.ts
import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
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
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN)
    async generateCompletionRateReport(@Body() params: any, @Req() req: any) {
        return this.reportService.generateCompletionRateReport({
            ...params,
            createdBy: req.user?.id ?? req.user?.userId ?? 'system',
        });
    }

    // ── POST /reports/employment-trends ───────────────────────────────────────
    @Post('employment-trends')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN)
    async generateEmploymentTrends(@Body() params: any) {
        return this.reportService.generateEmploymentTrendsReport(params);
    }

    // ── POST /reports/schedule ──────────────────────────────────────────────
    @Post('schedule')
    @Roles(UserRole.SUPER_ADMIN)
    async scheduleReport(@Body() config: any, @Req() req: any) {
        return this.reportService.scheduleReport({
            ...config,
            createdBy: req.user?.id ?? req.user?.userId ?? 'system',
        });
    }

    // ── GET /reports/history ────────────────────────────────────────────────
    @Get('history')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN)
    async getHistory() {
        return this.reportService.getReportHistory();
    }

    // ── GET /reports/scheduled ──────────────────────────────────────────────
    @Get('scheduled')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN)
    async getScheduled() {
        return this.reportService.getScheduledReports();
    }

    // ── POST /reports/dynamic ───────────────────────────────────────────────
    @Post('dynamic')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN)
    async generateDynamic(@Body() body: any, @Req() req: any) {
        return this.reportService.generateDynamicReport({
            ...body,
            createdBy: req.user?.id ?? req.user?.userId ?? 'system',
        });
    }
}