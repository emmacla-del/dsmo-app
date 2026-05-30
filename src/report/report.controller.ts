// src/report/report.controller.ts
import { Controller, Post, Get, Body, UseGuards, Req, Query, Res } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../types/prisma.types';

@Controller('report')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
    constructor(private reportService: ReportService) { }

    @Post('completion-rate')
    @Roles(UserRole.CENTRAL, UserRole.SUPER_ADMIN)
    async generateCompletionRateReport(@Body() params: any, @Res() res: any) {
        const report = await this.reportService.generateCompletionRateReport(params);

        if (params.format === 'PDF') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
            return res.send(report);
        }

        return report;
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
}