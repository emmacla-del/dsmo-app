// src/report/audit.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../types/prisma.types';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
    constructor(private reportService: ReportService) { }

    // ── GET /audit/reports ────────────────────────────────────────────────────
    @Get('reports')
    @Roles(UserRole.SUPER_ADMIN, UserRole.AUDITOR)
    async getAuditLog(@Query('limit') limit?: string) {
        return this.reportService.getAuditLog(limit ? parseInt(limit, 10) : 100);
    }
}
