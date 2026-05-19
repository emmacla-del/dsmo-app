import { PrismaService } from '../prisma/prisma.service';
export declare class AnalyticsService {
    private prisma;
    constructor(prisma: PrismaService);
    getEmploymentByRegion(year: number): Promise<any[]>;
    getEmploymentTrends(startYear: number, endYear: number, region?: string, granularity?: 'year' | 'semester' | 'quarter'): Promise<{
        year: number;
        period: string;
        label: string;
        totalEmployees: number;
    }[]>;
    getSectorDistribution(year: number, region?: string): Promise<{
        sector: string;
        employees: number;
        male: number;
        female: number;
    }[]>;
    getGenderDistribution(year: number, region?: string): Promise<{
        male: {
            count: number;
            percentage: number;
        };
        female: {
            count: number;
            percentage: number;
        };
        other: {
            count: number;
            percentage: number;
        };
        total: number;
    }>;
    getCategoryDistribution(year: number): Promise<{
        categories: {
            '1-3': {
                count: number;
                percentage: number;
            };
            '4-6': {
                count: number;
                percentage: number;
            };
            '7-9': {
                count: number;
                percentage: number;
            };
            '10-12': {
                count: number;
                percentage: number;
            };
            'Non-d\u00E9clar\u00E9': {
                count: number;
                percentage: number;
            };
        };
        total: number;
    }>;
    getRecruitmentForecast(years?: number, forecastYears?: number): Promise<{
        year: number;
        forecastedRecruitment: number;
        confidence: string;
    }[]>;
    getUnemploymentRiskRegions(year: number): Promise<{
        region: any;
        riskScore: number;
        totalEmployees: any;
        recruitments: number;
        riskLevel: string;
    }[]>;
    getSectorLaborShortages(year: number): Promise<{
        sector: any;
        employees: any;
        recruitments: number;
        shortageIndex: number;
    }[]>;
    getCompaniesWithRecruitmentPlans(year: number, limit?: number): Promise<{
        company: any;
        sector: any;
        region: any;
        plannedRecruitments: any;
        hasCamerunisationPlan: any;
    }[]>;
    getDashboardSummary(year: number, region?: string): Promise<{
        year: number;
        region: string;
        totalDeclarations: number;
        totalEmployees: number;
        employmentGrowthRate: number;
        genderDistribution: {
            male: number;
            female: number;
        };
        topSectors: {
            sector: string;
            employees: number;
        }[];
        totalRecruitments: number;
        totalDismissals: number;
        totalRetirements: number;
        totalPromotions: number;
        netChange: number;
    }>;
}
