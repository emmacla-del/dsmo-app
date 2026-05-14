// src/dsmo/analytics.controller.ts
import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('dsmo/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get('employment-by-region')
    async getEmploymentByRegion(@Query('year') year: number) {
        return this.analyticsService.getEmploymentByRegion(year);
    }

    @Get('employment-trends')
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
    async getSectorDistribution(
        @Query('year') year: number,
        @Query('region') region?: string,
    ) {
        return this.analyticsService.getSectorDistribution(year, region);
    }

    @Get('gender-distribution')
    async getGenderDistribution(
        @Query('year') year: number,
        @Query('region') region?: string,
    ) {
        return this.analyticsService.getGenderDistribution(year, region);
    }

    @Get('category-distribution')
    async getCategoryDistribution(@Query('year') year: number) {
        return this.analyticsService.getCategoryDistribution(year);
    }

    @Get('recruitment-forecast')
    async getRecruitmentForecast(
        @Query('years') years?: number,
        @Query('forecastYears') forecastYears?: number,
    ) {
        return this.analyticsService.getRecruitmentForecast(years, forecastYears);
    }

    @Get('unemployment-risk-regions')
    async getUnemploymentRiskRegions(@Query('year') year: number) {
        return this.analyticsService.getUnemploymentRiskRegions(year);
    }

    @Get('sector-labor-shortages')
    async getSectorLaborShortages(@Query('year') year: number) {
        return this.analyticsService.getSectorLaborShortages(year);
    }

    @Get('companies-with-recruitment-plans')
    async getCompaniesWithRecruitmentPlans(
        @Query('year') year: number,
        @Query('limit') limit?: number,
    ) {
        return this.analyticsService.getCompaniesWithRecruitmentPlans(year, limit);
    }

    @Get('dashboard-summary')
    async getDashboardSummary(
        @Query('year') year: number,
        @Query('region') region?: string,
    ) {
        return this.analyticsService.getDashboardSummary(year, region);
    }

    /**
     * Bulk CSV export — streams employment trend data for a year range.
     * GET /dsmo/analytics/export?startYear=2020&endYear=2024&format=csv
     */
    @Get('export')
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

        // Build CSV
        const lines: string[] = [
            'year,period,label,totalEmployees'
        ];
        for (const t of trends) {
            lines.push(
                `${t.year},"${t.period ?? ''}","${t.label ?? t.year}",${t.totalEmployees ?? 0}`
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