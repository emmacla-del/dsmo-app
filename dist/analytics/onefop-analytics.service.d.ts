import { PrismaService } from '../prisma/prisma.service';
export declare class OnefopAnalyticsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private safeGet;
    private flatGet;
    private getCspTotal;
    private getCspAgeTotal;
    private fetchApproved;
    getEmploymentByLocation(params: {
        year?: number;
        region?: string;
        department?: string;
        subdivision?: string;
        groupBy: 'region' | 'department' | 'subdivision';
    }): Promise<{
        name: string;
        totalEmployees: number;
        companyCount: number;
        avgEmployeesPerCompany: number;
    }[]>;
    getRecruitmentTrends(params: {
        startYear: number;
        endYear: number;
        region?: string;
        department?: string;
        subdivision?: string;
        granularity: 'year' | 'quarter' | 'month';
    }): Promise<{
        period: string;
        permanentRecruitments: number;
        temporaryRecruitments: number;
        totalRecruitments: number;
    }[]>;
    getHiresByDemographics(params: {
        year?: number;
        region?: string;
        department?: string;
        subdivision?: string;
        csp?: 'cadres' | 'foremen' | 'workers';
        gender?: 'male' | 'female';
        ageGroup?: '15_24' | '25_34' | '35_plus';
    }): Promise<Record<string, any>>;
    getHiresByDiploma(params: {
        year?: number;
        region?: string;
        department?: string;
        subdivision?: string;
        diploma?: string;
        limit?: number;
    }): Promise<{
        diploma: string;
        hires: number;
    }[] | {
        diploma: string;
        hires: number;
    }>;
    getVacanciesBySegment(params: {
        year?: number;
        region?: string;
        department?: string;
        subdivision?: string;
        groupBy: 'companySize' | 'businessSector';
    }): Promise<{
        segment: string;
        totalVacancies: number;
        companyCount: number;
        avgVacanciesPerCompany: number;
    }[]>;
    getSkillDemand(params: {
        year?: number;
        region?: string;
        department?: string;
        subdivision?: string;
        limit?: number;
    }): Promise<{
        skill: string;
        count: number;
    }[]>;
    getTrainingGap(params: {
        year?: number;
        region?: string;
        department?: string;
        subdivision?: string;
    }): Promise<{
        year: number | undefined;
        region: string | undefined;
        skillsInDemand: {
            skill: string;
            demand: number;
            supply: number;
            gap: number;
        }[];
        skillsInSurplus: {
            skill: string;
            demand: number;
            supply: number;
            gap: number;
        }[];
    }>;
    getGenderParity(params: {
        year?: number;
        region?: string;
        department?: string;
        subdivision?: string;
    }): Promise<{
        maleApplicants: number;
        femaleApplicants: number;
        malePercentage: number;
        femalePercentage: number;
        ratioFemaleToMale: number | null;
    }>;
    getYouthEmployment(params: {
        year?: number;
        region?: string;
        department?: string;
        subdivision?: string;
    }): Promise<{
        youthHires: number;
        totalHires: number;
        youthPercentage: number;
    }>;
    getInclusionMetrics(params: {
        year?: number;
        region?: string;
        department?: string;
        subdivision?: string;
        breakdownBy?: 'disability' | 'vulnerability' | 'both';
    }): Promise<Record<string, any>>;
    getDashboardSummary(params: {
        year?: number;
        region?: string;
        department?: string;
        subdivision?: string;
    }): Promise<{
        totalEmployees: number;
        totalCompanies: number;
        recruitmentTrends: {
            period: string;
            permanentRecruitments: number;
            temporaryRecruitments: number;
            totalRecruitments: number;
        }[];
        vacanciesBySector: {
            segment: string;
            totalVacancies: number;
            companyCount: number;
            avgVacanciesPerCompany: number;
        }[];
        topSkillsInDemand: {
            skill: string;
            count: number;
        }[];
        genderParity: {
            maleApplicants: number;
            femaleApplicants: number;
            malePercentage: number;
            femalePercentage: number;
            ratioFemaleToMale: number | null;
        };
        youthEmployment: {
            youthHires: number;
            totalHires: number;
            youthPercentage: number;
        };
        inclusion: Record<string, any>;
        topDiplomasHired: {
            diploma: string;
            hires: number;
        }[];
        year?: number;
        region?: string;
        department?: string;
        subdivision?: string;
    }>;
}
