// src/report/distribution.controller.ts
import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../types/prisma.types';

@Controller('distribution')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DistributionController {
    constructor(private reportService: ReportService) { }

    // ── GET /distribution/lists ───────────────────────────────────────────────
    @Get('lists')
    @Roles(UserRole.SUPER_ADMIN, UserRole.CENTRAL, UserRole.AUDITOR)
    async getDistributionLists() {
        return this.reportService.getDistributionLists();
    }

    // ── POST /distribution/send ───────────────────────────────────────────────
    @Post('send')
    @Roles(UserRole.SUPER_ADMIN, UserRole.CENTRAL)
    async sendDistribution(
        @Body('reportId') reportId: string,
        @Body('distributionListIds') distributionListIds: string[],
        @Body('comment') comment: string | undefined,
        @Req() req: any,
    ) {
        return this.reportService.sendDistribution(
            reportId,
            distributionListIds,
            comment,
            req.user?.id ?? req.user?.userId,
        );
    }
}
