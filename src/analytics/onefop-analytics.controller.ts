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

function toDate(val: any): Date | undefined {
    if (!val) return undefined;
    try {
        return new Date(val);
    } catch {
        return undefined;
    }
}

@Controller('onefop-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP', 'COMPANY')
export class OnefopAnalyticsController {
    constructor(private readonly analytics: OnefopAnalyticsService) { }

    // ─────────────────────────────────────────────────────────────
    // DASHBOARD & SUMMARY
    // ─────────────────────────────────────────────────────────────

    @Get('dashboard')
    async getDashboard(@Query() q: any) {
        return this.analytics.getDashboard({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            entityType: q.entityType,
        });
    }

    @Get('employment-summary')
    async getEmploymentSummary(@Query() q: any) {
        return this.analytics.getEmploymentSummary({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    // ─────────────────────────────────────────────────────────────
    // EMPLOYMENT
    // ─────────────────────────────────────────────────────────────

    @Get('employment')
    async getEmployment(@Query() q: any) {
        return this.analytics.getEmploymentByLocation({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            groupBy: q.groupBy || 'region',
        });
    }

    @Get('employment-by-csp')
    async getEmploymentByCsp(@Query() q: any) {
        return this.analytics.getEmploymentByCsp({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    @Get('employment-by-location')
    async getEmploymentByLocation(@Query() q: any) {
        return this.analytics.getEmploymentByLocation({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            groupBy: q.groupBy || 'region',
        });
    }

    // ─────────────────────────────────────────────────────────────
    // RECRUITMENT & HIRES
    // ─────────────────────────────────────────────────────────────

    @Get('recruitment-trends')
    async getRecruitmentTrends(@Query() q: any) {
        return this.analytics.getRecruitmentTrends({
            startYear: toInt(q.startYear)!,
            endYear: toInt(q.endYear)!,
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            granularity: q.granularity || 'year',
        });
    }

    @Get('hires')
    async getHires(@Query() q: any) {
        return this.analytics.getHiresByDemographics({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            csp: q.csp,
            gender: q.gender,
            ageBand: q.ageGroup || q.ageBand,
        });
    }

    @Get('hires-by-demographics')
    async getHiresByDemographics(@Query() q: any) {
        return this.analytics.getHiresByDemographics({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            csp: q.csp,
            gender: q.gender,
            ageBand: q.ageGroup || q.ageBand,
        });
    }

    @Get('hires/diploma')
    async getHiresByDiploma(@Query() q: any) {
        return this.analytics.getDiplomaSummary({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            limit: toInt(q.limit),
        });
    }

    // ─────────────────────────────────────────────────────────────
    // DEMOGRAPHICS & SOCIAL
    // ─────────────────────────────────────────────────────────────

    @Get('gender-parity')
    async getGenderParity(@Query() q: any) {
        return this.analytics.getGenderParity({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    @Get('youth-employment')
    async getYouthEmployment(@Query() q: any) {
        return this.analytics.getYouthEmployment({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    @Get('inclusion')
    async getInclusion(@Query() q: any) {
        return this.analytics.getInclusionMetrics({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            breakdownBy: q.breakdownBy,
        });
    }

    @Get('inclusion-metrics')
    async getInclusionMetrics(@Query() q: any) {
        return this.analytics.getInclusionMetrics({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            breakdownBy: q.breakdownBy,
        });
    }

    // ─────────────────────────────────────────────────────────────
    // SKILLS & TRAINING
    // ─────────────────────────────────────────────────────────────

    @Get('skills')
    async getSkills(@Query() q: any) {
        return this.analytics.getSkillNeeds({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            limit: toInt(q.limit),
        });
    }

    @Get('skill-needs')
    async getSkillNeeds(@Query() q: any) {
        return this.analytics.getSkillNeeds({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            limit: toInt(q.limit),
        });
    }

    @Get('training-needs')
    async getTrainingNeeds(@Query() q: any) {
        return this.analytics.getTrainingNeeds({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            limit: toInt(q.limit),
        });
    }

    @Get('training-gap')
    async getTrainingGap(@Query() q: any) {
        return this.analytics.getTrainingGap({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    // ─────────────────────────────────────────────────────────────
    // VACANCIES
    // ─────────────────────────────────────────────────────────────

    @Get('vacancies')
    async getVacancies(@Query() q: any) {
        return this.analytics.getVacanciesBySegment({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            groupBy: q.groupBy || 'businessSector',
        });
    }

    @Get('vacancies-by-segment')
    async getVacanciesBySegment(@Query() q: any) {
        return this.analytics.getVacanciesBySegment({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            groupBy: q.groupBy || 'companySize',
        });
    }

    // ─────────────────────────────────────────────────────────────
    // DIPLOMA
    // ─────────────────────────────────────────────────────────────

    @Get('diploma-distribution')
    async getDiplomaDistribution(@Query() q: any) {
        return this.analytics.getDiplomaDistribution({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    @Get('diploma-summary')
    async getDiplomaSummary(@Query() q: any) {
        return this.analytics.getDiplomaSummary({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            limit: toInt(q.limit),
        });
    }

    // ─────────────────────────────────────────────────────────────
    // DISABILITY & VULNERABLE
    // ─────────────────────────────────────────────────────────────

    @Get('disability-data')
    async getDisabilityData(@Query() q: any) {
        return this.analytics.getDisabilityData({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    @Get('vulnerable-workers')
    async getVulnerableWorkers(@Query() q: any) {
        return this.analytics.getVulnerableWorkers({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    // ─────────────────────────────────────────────────────────────
    // FIRST-TIME WORKERS & DEPARTURES
    // ─────────────────────────────────────────────────────────────

    @Get('first-time-workers')
    async getFirstTimeWorkers(@Query() q: any) {
        return this.analytics.getFirstTimeWorkers({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    @Get('departures')
    async getDepartures(@Query() q: any) {
        return this.analytics.getDepartures({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    @Get('departure-summary')
    async getDepartureSummary(@Query() q: any) {
        return this.analytics.getDepartureSummary({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    // ─────────────────────────────────────────────────────────────
    // DISMISSALS
    // ─────────────────────────────────────────────────────────────

    @Get('dismissal-reasons')
    async getDismissalReasons(@Query() q: any) {
        return this.analytics.getDismissalReasons({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    @Get('dismissal-unemployment')
    async getDismissalUnemployment(@Query() q: any) {
        return this.analytics.getDismissalUnemployment({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    // ─────────────────────────────────────────────────────────────
    // INTERNSHIPS
    // ─────────────────────────────────────────────────────────────

    @Get('internships')
    async getInternships(@Query() q: any) {
        return this.analytics.getInternships({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    // ─────────────────────────────────────────────────────────────
    // SUBMISSIONS
    // ─────────────────────────────────────────────────────────────

    @Get('submissions')
    async getSubmissions(@Query() q: any) {
        return this.analytics.getSubmissions({
            year: toInt(q.year),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            entityType: q.entityType,
            status: q.status,
            limit: toInt(q.limit),
            offset: toInt(q.offset),
        });
    }
}