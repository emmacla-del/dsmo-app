import { PrismaService } from '../prisma/prisma.service';
export declare class AuditService {
    private prisma;
    constructor(prisma: PrismaService);
    log(userId: string, action: string, resourceType: string, resourceId: string, details?: string, previousValue?: any, newValue?: any): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        declarationId: string | null;
        action: string;
        resourceType: string;
        resourceId: string;
        details: string | null;
        previousValue: string | null;
        newValue: string | null;
        timestamp: Date;
    }>;
    getDeclarationAuditTrail(declarationId: string): Promise<({
        user: {
            id: string;
            email: string;
            firstName: string | null;
            lastName: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        declarationId: string | null;
        action: string;
        resourceType: string;
        resourceId: string;
        details: string | null;
        previousValue: string | null;
        newValue: string | null;
        timestamp: Date;
    })[]>;
    getUserAuditLogs(userId: string, limit?: number): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        declarationId: string | null;
        action: string;
        resourceType: string;
        resourceId: string;
        details: string | null;
        previousValue: string | null;
        newValue: string | null;
        timestamp: Date;
    }[]>;
    getAuditLogsByAction(action: string, limit?: number): Promise<({
        user: {
            id: string;
            email: string;
        };
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        declarationId: string | null;
        action: string;
        resourceType: string;
        resourceId: string;
        details: string | null;
        previousValue: string | null;
        newValue: string | null;
        timestamp: Date;
    })[]>;
}
