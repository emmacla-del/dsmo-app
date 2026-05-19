import { PrismaService } from '../prisma/prisma.service';
export interface CspGenderCount {
    male: number;
    female: number;
    total: number;
}
export interface CspBreakdown {
    executives: CspGenderCount;
    foremen: CspGenderCount;
    workers: CspGenderCount;
    total: CspGenderCount;
}
export interface VulnerableGroup {
    permanent: number;
    temporary: number;
    total: number;
}
export interface BilanRhResponse {
    year: number;
    submissionId: string;
    entityType: string;
    permanentWorkers: number;
    vacancies: number;
    vacancyRate: number;
    recruitments: {
        permanent: CspBreakdown;
        temporary: CspBreakdown;
        combined: CspBreakdown;
    };
    departures: {
        dismissals: CspGenderCount;
        resignations: CspGenderCount;
        retirements: CspGenderCount;
        others: CspGenderCount;
        total: CspGenderCount;
    };
    turnoverRate: number;
    vulnerableWorkers: {
        internalDisplaced: VulnerableGroup;
        refugees: VulnerableGroup;
        orphans: VulnerableGroup;
        total: number;
    };
    disabledRecruitments: {
        permanent: number;
        temporary: number;
        total: number;
    };
    firstTimeWorkers: {
        permanent: number;
        temporary: number;
        total: number;
    };
    internships: {
        holiday: number;
        academic: number;
        professional: number;
        preWork: number;
        total: number;
    };
    skillNeeds: Array<{
        index: number;
        description: string;
        totalCount: number;
    }>;
    trainingNeeds: Array<{
        index: number;
        domain: string;
        totalCount: number;
    }>;
    dismissalReasons: Array<{
        index: number;
        text: string;
        male: number;
        female: number;
        total: number;
    }>;
}
export declare class BilanService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getBilan(userId: string, year: number): Promise<BilanRhResponse>;
}
