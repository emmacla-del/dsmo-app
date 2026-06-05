// analytics/facade/onefop-analytics.facade.ts

import { Injectable } from '@nestjs/common';
import { AnalyticsQueryService } from '../core/analytics-query.service';
import { computeTrainingGap } from '../core/analytics-utils';
import { EmploymentAnalyticsService } from '../domain/employment.analytics.service';
import { RecruitmentAnalyticsService } from '../domain/recruitment.analytics.service';
import { MobilityAnalyticsService } from '../domain/mobility.analytics.service';
import { InclusionAnalyticsService } from '../domain/inclusion.analytics.service';
import { SkillsAnalyticsService } from '../domain/skills.analytics.service';
import { EducationAnalyticsService } from '../domain/education.analytics.service';
import type {
    AnalyticsFilter,
    RecruitmentTrendFilter,
    LaborMarketTensionFilter,
    SubmissionListFilter,
    WorkforceSnapshot,
    MobilityDashboard,
    SkillsDashboard,
    InclusionDashboard,
} from '../core/analytics-types';

import { EnterpriseProfileAnalyticsService } from '../domain/enterprise-profile.analytics.service';

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
        private readonly enterpriseProfile: EnterpriseProfileAnalyticsService, // add this
    ) { }

    // ─────────────────────────────────────────────────────────────
    // Convenience pass-throughs for single-domain queries
    // (controllers call these so they don't import domain services)
    // ─────────────────────────────────────────────────────────────

    getEmploymentSummary = (f: AnalyticsFilter) => this.employment.getEmploymentSummary(f);
    getEmploymentByCsp = (f: AnalyticsFilter) => this.employment.getEmploymentByCsp(f);
    getEmploymentByLocation = (f: Parameters<EmploymentAnalyticsService['getEmploymentByLocation']>[0]) => this.employment.getEmploymentByLocation(f);
    getGenderParity = (f: AnalyticsFilter) => this.employment.getGenderParity(f);

    getRecruitmentTrends = (f: RecruitmentTrendFilter) => this.recruitment.getRecruitmentTrends(f);
    getHiresByDemographics = (f: Parameters<RecruitmentAnalyticsService['getHiresByDemographics']>[0]) => this.recruitment.getHiresByDemographics(f);
    getYouthEmployment = (f: AnalyticsFilter) => this.recruitment.getYouthEmployment(f);
    getDiplomaDistribution = (f: AnalyticsFilter) => this.recruitment.getDiplomaDistribution(f);
    getDiplomaSummary = (f: AnalyticsFilter & { limit?: number }) => this.recruitment.getDiplomaSummary(f);
    getHiresByDiploma = (f: AnalyticsFilter & { limit?: number }) => this.recruitment.getHiresByDiploma(f);
    getLaborMarketTension = (f: LaborMarketTensionFilter) => this.recruitment.getLaborMarketTension(f);

    getDepartures = (f: AnalyticsFilter) => this.mobility.getDepartures(f);
    getDepartureSummary = (f: AnalyticsFilter) => this.mobility.getDepartureSummary(f);
    getDismissalReasons = (f: AnalyticsFilter) => this.mobility.getDismissalReasons(f);
    getDismissalUnemployment = (f: AnalyticsFilter) => this.mobility.getDismissalUnemployment(f);
    getInternships = (f: AnalyticsFilter) => this.mobility.getInternships(f);

    getDisabilityData = (f: AnalyticsFilter) => this.inclusion.getDisabilityData(f);
    getVulnerableWorkers = (f: AnalyticsFilter) => this.inclusion.getVulnerableWorkers(f);
    getInclusionMetrics = (f: Parameters<InclusionAnalyticsService['getInclusionMetrics']>[0]) => this.inclusion.getInclusionMetrics(f);
    getFirstTimeWorkers = (f: AnalyticsFilter) => this.inclusion.getFirstTimeWorkers(f);

    getSkillNeeds = (f: AnalyticsFilter & { limit?: number }) => this.skills.getSkillNeeds(f);
    getSkillDemand = (f: AnalyticsFilter & { limit?: number }) => this.skills.getSkillDemand(f);
    getTrainingNeeds = (f: AnalyticsFilter & { limit?: number }) => this.skills.getTrainingNeeds(f);
    getTrainingGap = (f: AnalyticsFilter) => this.skills.getTrainingGap(f);

    getVacanciesBySegment = (f: AnalyticsFilter & { groupBy: 'enterpriseSize' | 'sector' }) =>
        this.education.getVacanciesBySegment(f, this.enterpriseProfile);
    getSubmissions = (f: SubmissionListFilter) => this.education.getSubmissions(f);

    // ─────────────────────────────────────────────────────────────
    // Aggregate helpers — each resolves _ids once before delegating
    // ─────────────────────────────────────────────────────────────

    async getWorkforceSnapshot(filter: AnalyticsFilter): Promise<WorkforceSnapshot> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) {
            return { totalEmployees: 0, cadres: 0, foremen: 0, workers: 0, male: 0, female: 0, youth: 0, youthRate: 0, averageAge: null };
        }
        const f: AnalyticsFilter = { ...filter, _ids: ids };
        const [emp, cspRows, genderParity] = await Promise.all([
            this.employment.getEmploymentSummary(f),
            this.employment.getEmploymentByCsp(f),
            this.employment.getGenderParity(f),
        ]);
        return this.employment.computeWorkforceSnapshot(emp, cspRows, genderParity);
    }

    async getMobilityDashboard(filter: AnalyticsFilter): Promise<MobilityDashboard> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) {
            return { totalEmployees: 0, totalDepartures: 0, resignationRate: 0, dismissalRate: 0, retirementRate: 0, turnoverRate: 0, retentionRate: 0 };
        }
        const f: AnalyticsFilter = { ...filter, _ids: ids };
        const [emp, departures] = await Promise.all([
            this.employment.getEmploymentSummary(f),
            this.mobility.getDepartureSummary(f),
        ]);
        return this.mobility.computeMobilityDashboard(emp.totalEmployees, departures);
    }

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

    async getInclusionDashboard(filter: AnalyticsFilter): Promise<InclusionDashboard> {
        const ids = await this.query.resolveSubmissionIds(filter);
        if (!ids.length) {
            return { disabilityRate: 0, vulnerableRate: 0, femaleLeadershipRate: 0, disabledCount: 0, vulnerableCount: 0 };
        }
        const f: AnalyticsFilter = { ...filter, _ids: ids };
        return this.inclusion.getInclusionDashboard(f, this.employment);
    }

    // ─────────────────────────────────────────────────────────────
    // Full dashboard — single DB round-trip per dataset
    // ─────────────────────────────────────────────────────────────
    async getDashboard(filter: AnalyticsFilter) {
        const ids = await this.query.resolveSubmissionIds(filter);

        if (!ids.length) {
            return this.emptyDashboard(filter);
        }

        const f: AnalyticsFilter = { ...filter, _ids: ids };

        const [
            employment,
            genderParity,
            youthEmployment,
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
            cspRows,
        ] = await Promise.all([
            this.employment.getEmploymentSummary(f),
            this.employment.getGenderParity(f),
            this.recruitment.getYouthEmployment(f),
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
            this.employment.getEmploymentByCsp(f),
        ]);

        const trainingGap = computeTrainingGap(allSkillNeeds, allTrainingNeeds);

        return {
            submissionCount: ids.length,
            filter,
            employment,
            genderParity,
            youthEmployment,
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
            workforceSnapshot: this.employment.computeWorkforceSnapshot(employment, cspRows, genderParity),
            mobilityDashboard: this.mobility.computeMobilityDashboard(employment.totalEmployees, departures),
            skillsDashboard: this.skills.computeSkillsDashboard(allSkillNeeds.slice(0, 10), allTrainingNeeds.slice(0, 10), trainingGap),
            inclusionDashboard: this.inclusion.computeInclusionDashboard(
                employment.totalEmployees,
                inclusion,
                cspRows,
                (rows) => this.employment.computeFemaleLeadershipRate(rows),
            ),
        };
    }

    // ─────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────
    private emptyDashboard(filter: AnalyticsFilter) {
        return {
            submissionCount: 0,
            filter,
            employment: { totalEmployees: 0, byGender: [], byCsp: [] },
            genderParity: { maleCount: 0, femaleCount: 0, malePercentage: 0, femalePercentage: 0, ratioFemaleToMale: null },
            youthEmployment: { youthHires: 0, totalHires: 0, youthPercentage: 0 },
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
            workforceSnapshot: { totalEmployees: 0, cadres: 0, foremen: 0, workers: 0, male: 0, female: 0, youth: 0, averageAge: null },
            mobilityDashboard: { totalEmployees: 0, totalDepartures: 0, resignationRate: 0, dismissalRate: 0, retirementRate: 0, turnoverRate: 0, retentionRate: 0 },
            skillsDashboard: { topSkills: [], topTrainingDomains: [], biggestSkillGaps: [] },
            inclusionDashboard: { disabilityRate: 0, vulnerableRate: 0, femaleLeadershipRate: 0, disabledCount: 0, vulnerableCount: 0 },
        };
    }
}