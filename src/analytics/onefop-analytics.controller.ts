// src/analytics/onefop-analytics.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OnefopAnalyticsFacade } from './facade/onefop-analytics.facade';

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
    constructor(private readonly analytics: OnefopAnalyticsFacade) { }

    // ─────────────────────────────────────────────────────────────
    // DASHBOARD & SUMMARY
    // ─────────────────────────────────────────────────────────────

    @Get('dashboard')
    async getDashboard(@Query() q: any) {
        return this.analytics.getDashboard({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            startYear: toInt(q.startYear) ?? toInt(q.year) ?? new Date().getFullYear(),
            endYear: toInt(q.endYear) ?? toInt(q.year) ?? new Date().getFullYear(),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            limit: toInt(q.limit),
        });
    }

    // ─────────────────────────────────────────────────────────────
    // LABOR MARKET TENSION
    // ─────────────────────────────────────────────────────────────

    @Get('labor-market-tension')
    async getLaborMarketTension(@Query() q: any) {
        return this.analytics.getLaborMarketTension({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            granularity: q.granularity || 'annual',
        });
    }

    // ─────────────────────────────────────────────────────────────
    // DEMOGRAPHICS & SOCIAL
    // ─────────────────────────────────────────────────────────────

    @Get('gender-parity')
    async getGenderParity(@Query() q: any) {
        return this.analytics.getGenderParity({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            limit: toInt(q.limit),
        });
    }

    @Get('skill-needs')
    async getSkillNeeds(@Query() q: any) {
        return this.analytics.getSkillNeeds({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            limit: toInt(q.limit),
        });
    }

    @Get('training-needs')
    async getTrainingNeeds(@Query() q: any) {
        return this.analytics.getTrainingNeeds({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            limit: toInt(q.limit),
        });
    }

    @Get('training-gap')
    async getTrainingGap(@Query() q: any) {
        return this.analytics.getTrainingGap({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            groupBy: q.groupBy || 'businessSector',
        });
    }

    @Get('vacancies-by-segment')
    async getVacanciesBySegment(@Query() q: any) {
        return this.analytics.getVacanciesBySegment({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    // ─────────────────────────────────────────────────────────────
    // INTERNSHIPS (ONLY ONE!)
    // ─────────────────────────────────────────────────────────────

    @Get('internships')
    async getInternships(@Query() q: any) {
        return this.analytics.getInternships({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    // ─────────────────────────────────────────────────────────────
    // JOB APPLICATIONS (S21Q01)
    // ─────────────────────────────────────────────────────────────

    @Get('job-applications')
    async getJobApplications(@Query() q: any) {
        return this.analytics.getJobApplications({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    @Get('job-applications/conversion')
    async getApplicationConversion(@Query() q: any) {
        return this.analytics.getApplicationConversion({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    @Get('job-applications/trend')
    async getApplicationTrend(@Query() q: any) {
        return this.analytics.getApplicationTrend({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            granularity: q.granularity || 'quarter',
        });
    }

    // ─────────────────────────────────────────────────────────────
    // REGISTERED SEEKERS (S23Q01)
    // ─────────────────────────────────────────────────────────────

    @Get('registered-seekers')
    async getRegisteredSeekers(@Query() q: any) {
        return this.analytics.getRegisteredSeekers({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    @Get('first-time-labor-gap')
    async getFirstTimeLaborGap(@Query() q: any) {
        return this.analytics.getFirstTimeLaborGap({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
    // ENTERPRISE PROFILE
    // ─────────────────────────────────────────────────────────────

    @Get('enterprise-profile')
    async getEnterpriseProfile(@Query() q: any) {
        return this.analytics.getEnterpriseProfile({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            dimension: q.dimension || 'sector',
        });
    }

    @Get('gender-parity-by-csp')
    async getGenderParityByCsp(@Query() q: any) {
        return this.analytics.getGenderParityByCsp({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }

    @Get('recruitment-by-location')
    async getRecruitmentByLocation(@Query() q: any) {
        return this.analytics.getRecruitmentByLocation({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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

    @Get('departures-by-location')
    async getDeparturesByLocation(@Query() q: any) {
        return this.analytics.getDeparturesByLocation({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
    // YOUTH IN WORKFORCE (STOCK)
    // ─────────────────────────────────────────────────────────────

    @Get('workforce-youth')
    async getWorkforceYouth(@Query() q: any) {
        return this.analytics.getWorkforceYouth({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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
    // SKILL TRENDS
    // ─────────────────────────────────────────────────────────────

    @Get('skill-trends')
    async getSkillTrends(@Query() q: any) {
        return this.analytics.getSkillTrends({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            granularity: q.granularity || 'quarter',
        });
    }

    // ─────────────────────────────────────────────────────────────
    // INCLUSION TRENDS
    // ─────────────────────────────────────────────────────────────

    @Get('inclusion-trends')
    async getInclusionTrends(@Query() q: any) {
        return this.analytics.getInclusionTrends({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
            fromQuarter: q.fromQuarter,
            toQuarter: q.toQuarter,
            startDate: toDate(q.startDate),
            endDate: toDate(q.endDate),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            granularity: q.granularity || 'quarter',
        });
    }

    // ─────────────────────────────────────────────────────────────
    // SUBMISSIONS (ONLY ONE!)
    // ─────────────────────────────────────────────────────────────

    @Get('submissions')
    async getSubmissions(@Query() q: any) {
        return this.analytics.getSubmissions({
            surveyYear: toInt(q.year) ?? toInt(q.surveyYear),
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