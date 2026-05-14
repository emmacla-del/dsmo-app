// src/analytics/onefop-analytics.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OnefopAnalyticsService } from './onefop-analytics.service';

function toInt(val: any): number | undefined {
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}

@Controller('onefop-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN')
export class OnefopAnalyticsController {
    constructor(private readonly analytics: OnefopAnalyticsService) { }

    @Get('employment')
    getEmployment(@Query() q: any) {
        return this.analytics.getEmploymentByLocation({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            groupBy: q.groupBy || 'region',
        });
    }

    @Get('recruitment-trends')
    getRecruitmentTrends(@Query() q: any) {
        return this.analytics.getRecruitmentTrends({
            startYear: toInt(q.startYear)!,
            endYear: toInt(q.endYear)!,
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            granularity: q.granularity || 'year',
        });
    }

    @Get('hires')
    getHires(@Query() q: any) {
        return this.analytics.getHiresByDemographics({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            csp: q.csp,
            gender: q.gender,
            ageGroup: q.ageGroup,
        });
    }

    @Get('hires/diploma')
    getHiresByDiploma(@Query() q: any) {
        return this.analytics.getHiresByDiploma({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            diploma: q.diploma,
            limit: toInt(q.limit),
        });
    }

    @Get('vacancies')
    getVacancies(@Query() q: any) {
        return this.analytics.getVacanciesBySegment({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            groupBy: q.groupBy || 'companySize',
        });
    }

    @Get('skills')
    getSkills(@Query() q: any) {
        return this.analytics.getSkillDemand({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            limit: toInt(q.limit),
        });
    }

    @Get('training-gap')
    getTrainingGap(@Query() q: any) {
        return this.analytics.getTrainingGap({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    @Get('gender-parity')
    getGenderParity(@Query() q: any) {
        return this.analytics.getGenderParity({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    @Get('youth-employment')
    getYouthEmployment(@Query() q: any) {
        return this.analytics.getYouthEmployment({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    @Get('inclusion')
    getInclusion(@Query() q: any) {
        return this.analytics.getInclusionMetrics({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            breakdownBy: q.breakdownBy,
        });
    }

    @Get('dashboard')
    getDashboard(@Query() q: any) {
        return this.analytics.getDashboardSummary({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }
}
