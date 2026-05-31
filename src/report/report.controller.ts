// src/report/report.controller.ts
import { Controller, Post, Get, Body, UseGuards, Query, Res } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../types/prisma.types';

@Controller('reports')   // FIX: was 'report' — Flutter calls /reports/*
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
    constructor(private reportService: ReportService) { }

    // ── Existing routes (paths unchanged, just under correct prefix now) ──

    @Post('completion-rate')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN)
    async generateCompletionRateReport(@Body() params: any, @Res() res: any) {
        const report = await this.reportService.generateCompletionRateReport(params);

        if (params.format === 'PDF') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
            return res.send(report);
        }

        return res.json(report);  // FIX: was bare `return report` which hangs when @Res() is used
    }

    @Post('employment-trends')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN)
    async generateEmploymentTrends(@Body() params: any) {
        return this.reportService.generateEmploymentTrendsReport(params);
    }

    @Post('schedule')
    @Roles(UserRole.SUPER_ADMIN)
    async scheduleReport(@Body() config: any) {
        return this.reportService.scheduleReport(config);
    }

    // ── New routes expected by ReportScreen ──

    @Get('history')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN)
    async getHistory() {
        return this.reportService.getReportHistory();
    }

    @Get('scheduled')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN)
    async getScheduled() {
        return this.reportService.getScheduledReports();
    }

    @Post('dynamic')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN)
    async generateDynamic(@Body() body: any) {
        return this.reportService.generateDynamicReport(body);
    }
}