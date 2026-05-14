// src/dto/onefop-analytics-response.dto.ts
export class OnefopAnalyticsResponseDto {
    summary: {
        totalSubmissions: number;
        totalCompanies: number;
        totalEmployees: number;
        averageEmployees: number;
        maleEmployees: number;
        femaleEmployees: number;
    };

    byEntityType: Array<{
        entityType: string;
        count: number;
        percentage: number;
        totalEmployees: number;
    }>;

    byRegion: Array<{
        region: string;
        count: number;
        percentage: number;
    }>;

    recruitmentTrends: Array<{
        period: string;
        permanent: number;
        temporary: number;
        total: number;
    }>;

    topSkills: Array<{
        skill: string;
        demand: number;
        percentage: number;
    }>;

    trainingNeeds: Array<{
        domain: string;
        demand: number;
        percentage: number;
    }>;

    genderDistribution: {
        male: number;
        female: number;
        malePercentage: number;
        femalePercentage: number;
    };
}