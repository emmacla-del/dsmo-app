import { PrismaService } from '../prisma/prisma.service';
import { DeclarationStatus } from '../types/prisma.types';
import { AuditService } from './audit.service';
export declare class NotificationService {
    private prisma;
    private auditService;
    private transporter;
    constructor(prisma: PrismaService, auditService: AuditService);
    sendNotification(userId: string, subject: string, message: string, filters: {
        regionFilter?: string;
        departmentFilter?: string;
        submissionStatus?: DeclarationStatus;
    }): Promise<{
        notificationId: string;
        totalRecipients: number;
        successfulSends: number;
        failedSends: number;
        failures: any[] | undefined;
    }>;
    sendDeadlineReminders(year: number, deadlineDate: Date, regionFilter?: string, departmentFilter?: string): Promise<{
        sent: number;
        failed: number;
        total: number;
    }>;
    getNotifications(userId: string, page?: number, limit?: number): Promise<({
        senderUser: {
            id: string;
            email: string;
            firstName: string | null;
            lastName: string | null;
        };
        recipients: {
            id: string;
            email: string;
            createdAt: Date;
            status: import(".prisma/client").$Enums.NotificationStatus;
            companyId: string;
            sentAt: Date;
            notificationId: string;
            openedAt: Date | null;
            clickedAt: Date | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        message: string;
        regionFilter: string | null;
        departmentFilter: string | null;
        submissionStatus: import(".prisma/client").$Enums.DeclarationStatus | null;
        subject: string;
        recipientCount: number;
        sentAt: Date;
        sentBy: string;
    })[]>;
    getNotificationDetails(notificationId: string): Promise<({
        senderUser: {
            id: string;
            email: string;
            firstName: string | null;
            lastName: string | null;
        };
        recipients: ({
            company: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            email: string;
            createdAt: Date;
            status: import(".prisma/client").$Enums.NotificationStatus;
            companyId: string;
            sentAt: Date;
            notificationId: string;
            openedAt: Date | null;
            clickedAt: Date | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        message: string;
        regionFilter: string | null;
        departmentFilter: string | null;
        submissionStatus: import(".prisma/client").$Enums.DeclarationStatus | null;
        subject: string;
        recipientCount: number;
        sentAt: Date;
        sentBy: string;
    }) | null>;
    getNotificationStats(notificationId: string): Promise<{
        notificationId: string;
        subject: string;
        totalRecipients: number;
        sent: number;
        failed: number;
        bounced: number;
        opened: number;
        openRate: string;
        sentAt: Date;
    }>;
    markNotificationAsOpened(recipientId: string): Promise<{
        id: string;
        email: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.NotificationStatus;
        companyId: string;
        sentAt: Date;
        notificationId: string;
        openedAt: Date | null;
        clickedAt: Date | null;
    }>;
    private generateEmailHtml;
}
