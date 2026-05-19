import { AuthService } from './auth.service';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(req: any): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            firstName: any;
            lastName: any;
            role: any;
            region: any;
            department: any;
            stream: any;
            features: {
                onefopBasicAnalytics: boolean;
                onefopBenchmarking: boolean;
                onefopSubmissionStatus: import(".prisma/client").$Enums.OnefopStatus | null;
                onefopSurveyYear: number | null;
                onefopHasDraft: boolean;
            };
        };
    }>;
    register(body: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        role: string;
        region?: string;
        department?: string;
        matricule?: string;
        poste?: string;
        serviceCode?: string;
    }): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            firstName: any;
            lastName: any;
            role: any;
            region: any;
            department: any;
            stream: any;
            features: {
                onefopBasicAnalytics: boolean;
                onefopBenchmarking: boolean;
                onefopSubmissionStatus: import(".prisma/client").$Enums.OnefopStatus | null;
                onefopSurveyYear: number | null;
                onefopHasDraft: boolean;
            };
        };
    } | {
        message: string;
    }>;
    registerCompany(body: {
        email: string;
        password: string;
        companyName: string;
        parentCompany?: string;
        mainActivity: string;
        secondaryActivity?: string;
        region: string;
        department: string;
        subdivision: string;
        address: string;
        taxNumber: string;
        cnpsNumber?: string;
        socialCapital?: number;
        contactName?: string;
        entityType?: string;
        area?: string;
        sectorId?: string;
        phone?: string;
        phone2?: string;
        poBox?: string;
        legalStatus?: string;
        cooperativeType?: string;
        ctdType?: string;
        yearOfCreation?: string;
        mainMission?: string;
        registrationNumber?: string;
        trainingDomains?: string;
        respondentPhone?: string;
        respondentPhone2?: string;
        respondentFunction?: string;
        respondentFirstName?: string;
        respondentLastName?: string;
        firstName?: string;
        lastName?: string;
        branch?: string;
    }): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            firstName: any;
            lastName: any;
            role: any;
            region: any;
            department: any;
            stream: any;
            features: {
                onefopBasicAnalytics: boolean;
                onefopBenchmarking: boolean;
                onefopSubmissionStatus: import(".prisma/client").$Enums.OnefopStatus | null;
                onefopSurveyYear: number | null;
                onefopHasDraft: boolean;
            };
        };
    }>;
    getPendingMinefopUsers(): Promise<{
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        matricule: string | null;
        serviceCode: string | null;
        createdAt: Date;
    }[]>;
    approveUser(id: string): Promise<{
        id: string;
        email: string;
        passwordHash: string;
        firstName: string | null;
        lastName: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        region: string | null;
        department: string | null;
        subdivision: string | null;
        matricule: string | null;
        poste: string | null;
        serviceCode: string | null;
        positionType: string | null;
        positionTitle: string | null;
        isActive: boolean;
        rejectionReason: string | null;
        rejectedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.UserStatus;
    }>;
    rejectUser(id: string, reason?: string): Promise<{
        id: string;
        email: string;
        passwordHash: string;
        firstName: string | null;
        lastName: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        region: string | null;
        department: string | null;
        subdivision: string | null;
        matricule: string | null;
        poste: string | null;
        serviceCode: string | null;
        positionType: string | null;
        positionTitle: string | null;
        isActive: boolean;
        rejectionReason: string | null;
        rejectedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.UserStatus;
    }>;
}
