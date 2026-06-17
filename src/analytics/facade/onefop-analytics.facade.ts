// analytics/facade/onefop-analytics.facade.ts

import { Injectable } from '@nestjs/common';
import { AnalyticsQueryService } from '../core/analytics-query.service';
import { computeTrainingGap } from '../core/analytics-utils';
import { Gender } from '../core/analytics-enums';
import { EmploymentAnalyticsService } from '../domain/employment.analytics.service';
import { RecruitmentAnalyticsService } from '../domain/recruitment.analytics.service';
import { MobilityAnalyticsService } from '../domain/mobility.analytics.service';
import { InclusionAnalyticsService } from '../domain/inclusion.analytics.service';
import { SkillsAnalyticsService } from '../domain/skills.analytics.service';
import { EducationAnalyticsService } from '../domain/education.analytics.service';
import { EnterpriseProfileAnalyticsService } from '../domain/enterprise-profile.analytics.service';
import { JobApplicationsAnalyticsService } from '../domain/job-applications.analytics.service';
import type {
    AnalyticsFilter,
    RecruitmentTrendFilter,
    LaborMarketTensionFilter,
    SubmissionListFilter,
    TrendFilter,
    SkillsDashboard,
} from '../core/analytics-types';

@Injectable()
export class OnefopAnalyticsFacade {
    constructor(
        private readonly query: AnalyticsQueryService,
        private readonly employment: EmploymentAnalyticsService,
        private readonly recruitment: RecruitmentAnalyticsService,
        private readonly mobility: MobilityAnalyticsService,
        private readonly inclusion: InclusionAnalyticsService,
        private readonly skills: SkillsAnalyticsService,
        private readonly education: EducationAnalyticsService,
        private readonly enterpriseProfile: EnterpriseProfileAnalyticsService,
        private readonly jobApplications: JobApplicationsAnalyticsService,
    ) { }

    // ─────────────────────────────────────────────────────────────
    // EMPLOYMENT
    // Stock of permanent employees — S1Q10/S1Q09/S1Q11 (scalar per entity).
    // No gender / CSP / age breakdown exists for the stock; those dimensions
    // are only collected for FLOWS (recruits, departures, applications).
    // ─────────────────────────────────────────────────────────────

    getPermanentEmployeeSummary = (f: AnalyticsFilter) =>
        this.employment.getPermanentEmployeeSummary(f);

    getPermanentEmployeesByLocation = (
        f: Parameters<EmploymentAnalyticsService['getPermanentEmployeesByLocation']>[0],
    ) => this.employment.getPermanentEmployeesByLocation(f);

    getPermanentEmployeesByEntityType = (f: AnalyticsFilter) =>
        this.employment.getPermanentEmployeesByEntityType(f);

    getPermanentEmployeesBySize = (f: AnalyticsFilter) =>
        this.employment.getPermanentEmployeesBySize(f);

    // ─────────────────────────────────────────────────────────────
    // RECRUITMENT
    // ─────────────────────────────────────────────────────────────

    getRecruitmentTrends = (f: RecruitmentTrendFilter) =>
        this.recruitment.getRecruitmentTrends(f);

    getHiresByDemographics = (
        f: Parameters<RecruitmentAnalyticsService['getHiresByDemographics']>[0],
    ) => this.recruitment.getHiresByDemographics(f);

    /** Youth share of recruitment (15-24 hires / total hires). */
    getYouthShareOfRecruitment = (f: AnalyticsFilter) =>
        this.recruitment.getYouthShareOfRecruitment(f);

    /** @deprecated Use getYouthShareOfRecruitment */
    getYouthEmployment = (f: AnalyticsFilter) =>
        this.recruitment.getYouthShareOfRecruitment(f);

    getDiplomaDistribution = (f: AnalyticsFilter) =>
        this.recruitment.getDiplomaDistribution(f);

    getDiplomaSummary = (f: AnalyticsFilter & { limit?: number }) =>
        this.recruitment.getDiplomaSummary(f);

    getHiresByDiploma = (f: AnalyticsFilter & { limit?: number }) =>
        this.recruitment.getHiresByDiploma(f);

    /** Vacancy fulfilment rate and occupational demand structure. */
    getVacancyFulfilment = (f: LaborMarketTensionFilter) =>
        this.recruitment.getVacancyFulfilment(f);

    /** @deprecated Use getVacancyFulfilment */
    getLaborMarketTension = (f: LaborMarketTensionFilter) =>
        this.recruitment.getVacancyFulfilment(f);

    getRecruitmentByLocation = (
        f: Parameters<RecruitmentAnalyticsService['getRecruitmentByLocation']>[0],
    ) => this.recruitment.getRecruitmentByLocation(f);

    // ─────────────────────────────────────────────────────────────
    // MOBILITY
    // ─────────────────────────────────────────────────────────────

    getDepartures = (f: AnalyticsFilter) =>
        this.mobility.getDepartures(f);

    getDepartureSummary = (f: AnalyticsFilter) =>
        this.mobility.getDepartureSummary(f);

    getDismissalReasons = (f: AnalyticsFilter) =>
        this.mobility.getDismissalReasons(f);

    getDismissalUnemployment = (f: AnalyticsFilter) =>
        this.mobility.getDismissalUnemployment(f);

    getInternships = (f: AnalyticsFilter) =>
        this.mobility.getInternships(f);

    getDeparturesByLocation = (
        f: Parameters<MobilityAnalyticsService['getDeparturesByLocation']>[0],
    ) => this.mobility.getDeparturesByLocation(f);

    // ─────────────────────────────────────────────────────────────
    // INCLUSION
    // ─────────────────────────────────────────────────────────────

    getDisabilityData = (f: AnalyticsFilter) =>
        this.inclusion.getDisabilityData(f);

    getVulnerableWorkers = (f: AnalyticsFilter) =>
        this.inclusion.getVulnerableWorkers(f);

    getInclusionMetrics = (
        f: Parameters<InclusionAnalyticsService['getInclusionMetrics']>[0],
    ) => this.inclusion.getInclusionMetrics(f);

    getFirstTimeWorkers = (f: AnalyticsFilter) =>
        this.inclusion.getFirstTimeWorkers(f);

    getInclusionTrends = (f: TrendFilter) =>
        this.inclusion.getInclusionTrends(f);

    // ─────────────────────────────────────────────────────────────
    // SKILLS
    // ─────────────────────────────────────────────────────────────

    getSkillNeeds = (f: AnalyticsFilter & { limit?: number }) =>
        this.skills.getSkillNeeds(f);

    getSkillDemand = (f: AnalyticsFilter & { limit?: number }) =>
        this.skills.getSkillDemand(f);

    getTrainingNeeds = (f: AnalyticsFilter & { limit?: number }) =>
        this.skills.getTrainingNeeds(f);

    getTrainingGap = (f: AnalyticsFilter) =>
        this.skills.getTrainingGap(f);

    getSkillTrends = (f: TrendFilter) =>
        this.skills.getSkillTrends(f);

    // ─────────────────────────────────────────────────────────────
    // ENTERPRISE PROFILE
    // ─────────────────────────────────────────────────────────────

    getEnterpriseProfile = (
        f: Parameters<EnterpriseProfileAnalyticsService['getEnterpriseProfile']>[0],
    ) => this.enterpriseProfile.getEnterpriseProfile(f);

    getVacanciesBySegment = (
        f: AnalyticsFilter & { groupBy: 'enterpriseSize' | 'sector' },
    ) => this.enterpriseProfile.getVacanciesBySegment(f);

    // ─────────────────────────────────────────────────────────────
    // JOB APPLICATIONS
    // ─────────────────────────────────────────────────────────────

    getJobApplications = (f: AnalyticsFilter) =>
        this.jobApplications.getJobApplications(f);

    getApplicationConversion = (f: AnalyticsFilter) =>
        this.jobApplications.getApplicationConversionRate(f);

    getApplicationTrend = (f: TrendFilter) =>
        this.jobApplications.getApplicationTrends(f);

    // ─────────────────────────────────────────────────────────────
    // REGISTERED SEEKERS / FIRST-TIME LABOUR GAP
    // Source: S23Q01 (registered seekers) + S23Q02 (first-time workers recruited)
    // Owned by InclusionAnalyticsService.
    // ─────────────────────────────────────────────────────────────

    /** @deprecated Use getRegisteredFirstTimeSeekers */
    getRegisteredSeekers = (f: AnalyticsFilter) =>
        this.inclusion.getRegisteredFirstTimeSeekers(f);

    getFirstTimeLaborGap = (f: AnalyticsFilter) =>
        this.inclusion.getFirstTimeLaborGap(f);

    // ─────────────────────────────────────────────────────────────
    // EDUCATION / SUBMISSIONS
    // ─────────────────────────────────────────────────────────────

    getSubmissions = (f: SubmissionListFilter) =>
        this.education.getSubmissions(f);

    // ─────────────────────────────────────────────────────────────
    // AGGREGATE HELPERS
    // ─────────────────────────────────────────────────────────────

    async getSkillsDashboard(filter: AnalyticsFilter): Promise<SkillsDashboard> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) {
            return { topSkills: [], topTrainingDomains: [], biggestSkillGaps: [] };
        }
        const f: AnalyticsFilter = { ...filter, _ids: ids };
        const [skillNeeds, trainingNeeds] = await Promise.all([
            this.skills.getSkillNeeds({ ...f, limit: 10 }),
            this.skills.getTrainingNeeds({ ...f, limit: 10 }),
        ]);
        const gap = computeTrainingGap(skillNeeds, trainingNeeds);
        return this.skills.computeSkillsDashboard(skillNeeds, trainingNeeds, gap);
    }

    async getInclusionDashboard(filter: AnalyticsFilter) {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) {
            return { disabilityRate: 0, vulnerableRate: 0, femaleLeadershipRate: 0, disabledCount: 0, vulnerableCount: 0 };
        }
        const f: AnalyticsFilter = { ...filter, _ids: ids };
        return this.inclusion.getInclusionDashboard(f) as any;
    }

    /** Gender split of job applicants (S21Q01) — only flow with a gender breakdown. */
    async getGenderParity(filter: AnalyticsFilter) {
        const summary = await this.jobApplications.getJobApplicationSummary(filter);
        const maleApplicants = summary.byGender.find((g) => g.gender === Gender.MALE)?.count ?? 0;
        const femaleApplicants = summary.byGender.find((g) => g.gender === Gender.FEMALE)?.count ?? 0;
        return {
            maleApplicants,
            femaleApplicants,
            totalApplications: summary.totalApplications,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // FULL DASHBOARD
    // ─────────────────────────────────────────────────────────────

    async getDashboard(filter: AnalyticsFilter) {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) return this.emptyDashboard(filter);

        const f: AnalyticsFilter = { ...filter, _ids: ids };

        const [
            employmentSummary,
            youthShareOfRecruitment,
            diplomas,
            disability,
            inclusion,
            vulnerable,
            firstTimeWorkers,
            departures,
            dismissalReasons,
            dismissalUnemployment,
            internships,
            allSkillNeeds,
            allTrainingNeeds,
        ] = await Promise.all([
            this.employment.getPermanentEmployeeSummary(f),
            this.recruitment.getYouthShareOfRecruitment(f),
            this.recruitment.getDiplomaSummary({ ...f, limit: 10 }),
            this.inclusion.getDisabilityData(f),
            this.inclusion.getInclusionMetrics({ ...f, breakdownBy: 'both' }),
            this.inclusion.getVulnerableWorkers(f),
            this.inclusion.getFirstTimeWorkers(f),
            this.mobility.getDepartureSummary(f),
            this.mobility.getDismissalReasons(f),
            this.mobility.getDismissalUnemployment(f),
            this.mobility.getInternships(f),
            this.skills.getSkillNeeds(f),
            this.skills.getTrainingNeeds(f),
        ]);

        const trainingGap = computeTrainingGap(allSkillNeeds, allTrainingNeeds);

        return {
            submissionCount: ids.length,
            filter,
            employmentSummary,
            youthShareOfRecruitment,
            diplomas,
            disability,
            inclusion,
            vulnerable,
            firstTimeWorkers,
            departures,
            dismissalReasons,
            dismissalUnemployment,
            internships,
            skillNeeds: allSkillNeeds.slice(0, 10),
            trainingNeeds: allTrainingNeeds.slice(0, 10),
            trainingGap,
            skillsDashboard: this.skills.computeSkillsDashboard(
                allSkillNeeds.slice(0, 10),
                allTrainingNeeds.slice(0, 10),
                trainingGap,
            ),
        };
    }

    // ─────────────────────────────────────────────────────────────
    // PRIVATE
    // ─────────────────────────────────────────────────────────────

    private emptyDashboard(filter: AnalyticsFilter) {
        return {
            submissionCount: 0,
            filter,
            employmentSummary: {
                totalPermanentEmployees: 0,
                totalVacancies: 0,
                vacancyRate: 0,
                reportingEntities: 0,
            },
            youthShareOfRecruitment: { youthHires: 0, totalHires: 0, youthSharePct: 0 },
            diplomas: [],
            disability: [],
            inclusion: { disabled: 0, vulnerable: 0, totalHires: 0, disabledByCsp: [], vulnerableByType: [] },
            vulnerable: [],
            firstTimeWorkers: [],
            departures: [],
            dismissalReasons: [],
            dismissalUnemployment: [],
            internships: [],
            skillNeeds: [],
            trainingNeeds: [],
            trainingGap: { skillsInDemand: [], skillsInSurplus: [], balanced: [] },
            skillsDashboard: { topSkills: [], topTrainingDomains: [], biggestSkillGaps: [] },
        };
    }
}