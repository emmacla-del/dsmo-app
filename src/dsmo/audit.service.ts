import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
    constructor(private prisma: PrismaService) { }

    /**
     * Log an audit event
     */
    async log(userId: string, action: string, resourceType: string, resourceId: string, details?: string, previousValue?: any, newValue?: any) {
        return this.prisma.auditLog.create({
            data: {
                userId,
                action,
                resourceType,
                resourceId,
                details,
                previousValue: previousValue ? JSON.stringify(previousValue) : undefined,
                newValue: newValue ? JSON.stringify(newValue) : undefined,
            },
        });
    }

    /**
     * Get audit trail for a declaration
     */
    async getDeclarationAuditTrail(declarationId: string) {
        return this.prisma.auditLog.findMany({
            where: { declarationId },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
            orderBy: { timestamp: 'desc' },
        });
    }

    /**
     * Get audit logs for a user
     */
    async getUserAuditLogs(userId: string, limit: number = 100) {
        return this.prisma.auditLog.findMany({
            where: { userId },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }

    /**
     * Get audit logs by action type
     */
    async getAuditLogsByAction(action: string, limit: number = 100) {
        return this.prisma.auditLog.findMany({
            where: { action },
            orderBy: { timestamp: 'desc' },
            take: limit,
            include: { user: { select: { id: true, email: true } } },
        });
    }
}
