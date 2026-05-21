import {
    Controller,
    Get,
    Query,
    Res,
    Req,
    UseGuards,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('dsmo/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
    constructor(
        private readonly analyticsService: AnalyticsService,
        private readonly prisma: PrismaService,
    ) { }

    // ═══════════════════════════════════════════════════════════
    // NATIONAL/REGIONAL ENDPOINTS — MINEFOP roles only
    // ═══════════════════════════════════════════════════════════

    @Get('employment-by-region')
    @Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN')
    async getEmploymentByRegion(@Query('year') year: number) {
        return this.analyticsService.getEmploymentByRegion(year);
    }

    @Get('employment-trends')
    @Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN')
    async getEmploymentTrends(
        @Query('startYear') startYear: number,
        @Query('endYear') endYear: number,
        @Query('region') region?: string,
        @Query('granularity') granularity?: 'year' | 'semester' | 'quarter',
    ) {
        return this.analyticsService.getEmploymentTrends(
            startYear,
            endYear,
            region,
            granularity ?? 'year',
        );
    }

    @Get('sector-distribution')
    @Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN')
    async getSectorDistribution(
        @Query('year') year: number,
        @Query('region') region?: string,
    ) {
        return this.analyticsService.getSectorDistribution(year, region);
    }

    @Get('gender-distribution')
    @Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN')
    async getGenderDistribution(
        @Query('year') year: number,
        @Query('region') region?: string,
    ) {
        return this.analyticsService.getGenderDistribution(year, region);
    }

    @Get('category-distribution')
    @Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN')
    async getCategoryDistribution(@Query('year') year: number) {
        return this.analyticsService.getCategoryDistribution(year);
    }

    @Get('recruitment-forecast')
    @Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN')
    async getRecruitmentForecast(
        @Query('years') years?: number,
        @Query('forecastYears') forecastYears?: number,
    ) {
        return this.analyticsService.getRecruitmentForecast(years, forecastYears);
    }

    @Get('unemployment-risk-regions')
    @Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN')
    async getUnemploymentRiskRegions(@Query('year') year: number) {
        return this.analyticsService.getUnemploymentRiskRegions(year);
    }

    @Get('sector-labor-shortages')
    @Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN')
    async getSectorLaborShortages(@Query('year') year: number) {
        return this.analyticsService.getSectorLaborShortages(year);
    }

    @Get('companies-with-recruitment-plans')
    @Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN')
    async getCompaniesWithRecruitmentPlans(
        @Query('year') year: number,
        @Query('limit') limit?: number,
    ) {
        return this.analyticsService.getCompaniesWithRecruitmentPlans(year, limit);
    }

    @Get('dashboard-summary')
    @Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN')
    async getDashboardSummary(
        @Query('year') year: number,
        @Query('region') region?: string,
    ) {
        return this.analyticsService.getDashboardSummary(year, region);
    }

    // ═══════════════════════════════════════════════════════════
    // COMPANY-SCOPED ENDPOINTS
    // ═══════════════════════════════════════════════════════════

    @Get('company-summary')
    @Roles('COMPANY')
    async getCompanySummary(
        @Query('year') year: any,
        @Req() req: any,
    ) {
        console.log('[company-summary] user:', JSON.stringify(req.user));
        console.log('[company-summary] year param:', year, typeof year);

        if (!req.user.features?.onefopBasicAnalytics) {
            throw new ForbiddenException(
                'Soumettez le questionnaire ONEFOP pour accéder à vos analyses.',
            );
        }

        const userId = req.user?.sub;
        if (!userId) throw new BadRequestException('Utilisateur non identifié');

        const company = await this.prisma.company.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!company) throw new BadRequestException('Entreprise non trouvée');

        const resolvedYear = year ? parseInt(year, 10) : new Date().getFullYear();
        return this.analyticsService.getCompanySummary(company.id, resolvedYear);
    }

    @Get('company-benchmarks')
    @Roles('COMPANY')
    async getCompanyBenchmarks(
        @Query('year') year: number,
        @Query('groupBy') groupBy: 'sector' | 'size' | 'region',
        @Req() req: any,
    ) {
        if (!req.user.features?.onefopBenchmarking) {
            throw new ForbiddenException(
                'Le benchmarking sera disponible après approbation de votre questionnaire ONEFOP.',
            );
        }

        const company = await this.prisma.company.findUnique({
            where: { userId: req.user.sub },
        });
        if (!company) throw new BadRequestException('Entreprise non trouvée');

        return this.analyticsService.getCompanyBenchmarks(company.id, year, groupBy);
    }

    // ═══════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════

    @Get('export')
    @Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN')
    async exportData(
        @Query('startYear') startYear: number,
        @Query('endYear') endYear: number,
        @Query('region') region: string | undefined,
        @Query('format') format: 'csv' | 'json' = 'csv',
        @Res() res: Response,
    ) {
        const start = Number(startYear) || new Date().getFullYear() - 4;
        const end = Number(endYear) || new Date().getFullYear();

        const [trends, summary] = await Promise.all([
            this.analyticsService.getEmploymentTrends(start, end, region, 'year'),
            this.analyticsService.getDashboardSummary(end, region),
        ]);

        if (format === 'json') {
            return res.json({ trends, summary });
        }

        const lines: string[] = ['year,period,label,totalEmployees'];
        for (const t of trends) {
            lines.push(
                `${t.year},"${t.period ?? ''}","${t.label ?? t.year}",${t.totalEmployees ?? 0}`,
            );
        }

        const csv = lines.join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="dsmo_export_${start}-${end}.csv"`,
        );
        res.send(csv);
    }
}