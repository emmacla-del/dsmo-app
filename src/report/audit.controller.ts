// src/report/audit.controller.ts
import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { ActorSummaryService } from './actor-summary.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveCompanyGuard } from '../auth/active-company.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../types/prisma.types';
import {
    AUDIT_PAGE_DEFAULT_LIMIT,
    AUDIT_PAGE_MAX_LIMIT,
    parseAuditLogFilters,
    parseIntParam,
} from './audit-log-filter';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
export class AuditController {
    constructor(
        private reportService: ReportService,
        private actorSummaryService: ActorSummaryService,
    ) { }


    // ── GET /audit/reports ────────────────────────────────────────────────────
    // Without `paginate=true` the response is the legacy plain array (Flutter
    // report_service.dart, admin/parametres ?limit=5). With it, the response is
    // { items, total, limit, offset } for admin/journal-audit. Filters apply
    // to both shapes and default to "none".
    @Get('reports')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.AUDITOR)
    async getAuditLog(
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @Query('paginate') paginate?: string,
        @Query('period') period?: string,
        @Query('actor') actor?: string,
        @Query('action') action?: string,
        @Query('resourceType') resourceType?: string,
        @Query('resourceId') resourceId?: string,
    ) {
        const filters = parseAuditLogFilters({ period, actor, action, resourceType, resourceId });
        if (paginate !== 'true') {
            return this.reportService.getAuditLog(limit ? parseInt(limit, 10) : 100, filters);
        }
        return this.reportService.getAuditLogPage(
            filters,
            parseIntParam(limit, AUDIT_PAGE_DEFAULT_LIMIT, 1, AUDIT_PAGE_MAX_LIMIT,
                `Le paramètre « limit » doit être un entier entre 1 et ${AUDIT_PAGE_MAX_LIMIT}.`),
            parseIntParam(offset, 0, 0, Number.MAX_SAFE_INTEGER,
                'Le paramètre « offset » doit être un entier positif ou nul.'),
        );
    }

    // ── GET /audit/actor-summary ──────────────────────────────────────────────
    // Phase 4 monitoring dashboard: one entry per territorial admin. A
    // REGIONAL_ADMIN only sees admins of its own region; the service applies
    // that, so the scope cannot be widened from the query string.
    @Get('actor-summary')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN)
    async getActorSummary(
        @Request() req: any,
        @Query('period') period?: string,
        @Query('role') role?: string,
        @Query('region') region?: string,
        @Query('department') department?: string,
    ) {
        return this.actorSummaryService.getActorSummary(req.user, { period, role, region, department });
    }

    // ── POST /audit/nudge ─────────────────────────────────────────────────────
    // Delivers a templated reminder to a territorial admin's in-app inbox.
    // Returns the created notification's id.
    @Post('nudge')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.REGIONAL_ADMIN)
    async nudge(@Request() req: any, @Body() body: unknown) {
        return this.actorSummaryService.nudge(req.user, body);
    }
}
