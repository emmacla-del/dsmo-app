import { OnefopAnalyticsService } from './onefop-analytics.service';
export declare class OnefopAnalyticsController {
    private readonly analytics;
    constructor(analytics: OnefopAnalyticsService);
    getEmployment(q: any): Promise<{
        name: string;
        totalEmployees: number;
        companyCount: number;
        avgEmployeesPerCompany: number;
    }[]>;
    getRecruitmentTrends(q: any): Promise<{
        period: string;
        permanentRecruitments: number;
        temporaryRecruitments: number;
        totalRecruitments: number;
    }[]>;
    getHires(q: any): Promise<Record<string, any>>;
    getHiresByDiploma(q: any): Promise<{
        diploma: string;
        hires: number;
    }[] | {
        diploma: string;
        hires: number;
    }>;
    getVacancies(q: any): Promise<{
        segment: string;
        totalVacancies: number;
        companyCount: number;
        avgVacanciesPerCompany: number;
    }[]>;
    getSkills(q: any): Promise<{
        skill: string;
        count: number;
    }[]>;
    getTrainingGap(q: any): Promise<{
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
    getGenderParity(q: any): Promise<{
        maleApplicants: number;
        femaleApplicants: number;
        malePercentage: number;
        femalePercentage: number;
        ratioFemaleToMale: number | null;
    }>;
    getYouthEmployment(q: any): Promise<{
        youthHires: number;
        totalHires: number;
        youthPercentage: number;
    }>;
    getInclusion(q: any): Promise<Record<string, any>>;
    getDashboard(q: any): Promise<{
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
