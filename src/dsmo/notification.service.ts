import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, DeclarationStatus } from '../types/prisma.types';
import * as nodemailer from 'nodemailer';
import { AuditService } from './audit.service';

@Injectable()
export class NotificationService {
    private transporter: any;

    constructor(
        private prisma: PrismaService,
        private auditService: AuditService,
    ) {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'localhost',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            } : undefined,
        });
    }

    /**
     * Send notifications to companies based on filters.
     * Only DIVISIONAL, REGIONAL, or CENTRAL users can send notifications.
     */
    async sendNotification(
        userId: string,
        subject: string,
        message: string,
        filters: {
            regionFilter?: string;
            departmentFilter?: string;
            submissionStatus?: DeclarationStatus;
        },
    ) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        if (!([UserRole.DIVISIONAL, UserRole.REGIONAL, UserRole.CENTRAL] as UserRole[]).includes(user.role)) {
            throw new ForbiddenException('Only DIVISIONAL, REGIONAL, or CENTRAL users can send notifications');
        }

        const where: any = {};

        if (user.role === UserRole.DIVISIONAL) {
            if (!user.department) throw new BadRequestException('User has no department assigned');
            where.department = user.department;
            if (filters.departmentFilter && filters.departmentFilter !== user.department) {
                throw new ForbiddenException('Cannot send to companies outside your department');
            }
        } else if (user.role === UserRole.REGIONAL) {
            if (!user.region) throw new BadRequestException('User has no region assigned');
            where.region = user.region;
            if (filters.regionFilter && filters.regionFilter !== user.region) {
                throw new ForbiddenException('Cannot send to companies outside your region');
            }
        } else if (user.role === UserRole.CENTRAL) {
            if (filters.regionFilter) where.region = filters.regionFilter;
            if (filters.departmentFilter) where.department = filters.departmentFilter;
        }

        const companies = await this.prisma.company.findMany({ where });

        if (companies.length === 0) {
            throw new BadRequestException('No companies found matching the specified filters');
        }

        const notification = await this.prisma.notification.create({
            data: {
                sentBy: userId,
                subject,
                message,
                regionFilter: filters.regionFilter,
                departmentFilter: filters.departmentFilter,
                submissionStatus: filters.submissionStatus,
                recipientCount: companies.length,
            },
        });

        const recipients: any[] = [];
        const failures: any[] = [];

        for (const company of companies) {
            try {
                const companyUser = await this.prisma.user.findUnique({
                    where: { id: company.userId },
                });

                if (!companyUser || !companyUser.email) {
                    failures.push({ companyId: company.id, reason: 'No user email found' });
                    continue;
                }

                const recipient = await this.prisma.notificationRecipient.create({
                    data: {
                        notificationId: notification.id,
                        companyId: company.id,
                        email: companyUser.email,
                    },
                });

                const emailHtml = this.generateEmailHtml(company.name, message);
                const emailText = `${company.name},\n\n${message}\n\nPlatforme DSMO\nMinistère de l'Emploi et de la Formation Professionnelle`;

                try {
                    await this.transporter.sendMail({
                        from: process.env.SMTP_FROM || 'dsmo@ministry.cm',
                        to: companyUser.email,
                        subject,
                        text: emailText,
                        html: emailHtml,
                    });

                    recipients.push({
                        notificationId: notification.id,
                        companyId: company.id,
                        email: companyUser.email,
                        status: 'SENT',
                    });

                    await this.prisma.notificationRecipient.update({
                        where: { id: recipient.id },
                        data: { status: 'SENT' },
                    });
                } catch (emailError) {
                    // ✅ FIX: cast emailError as Error to access .message safely
                    failures.push({
                        companyId: company.id,
                        email: companyUser.email,
                        reason: (emailError as Error).message,
                    });

                    await this.prisma.notificationRecipient.update({
                        where: { id: recipient.id },
                        data: { status: 'FAILED' },
                    });
                }
            } catch (error) {
                // ✅ FIX: cast error as Error to access .message safely
                failures.push({
                    companyId: company.id,
                    reason: (error as Error).message,
                });
            }
        }

        await this.auditService.log(
            userId,
            'SEND_NOTIFICATION',
            'Notification',
            notification.id,
            `Sent notification to ${recipients.length} companies. Subject: ${subject}`,
        );

        return {
            notificationId: notification.id,
            totalRecipients: companies.length,
            successfulSends: recipients.length,
            failedSends: failures.length,
            failures: failures.length > 0 ? failures : undefined,
        };
    }

    /**
     * Send deadline reminder emails (automated or manual).
     */
    async sendDeadlineReminders(
        year: number,
        deadlineDate: Date,
        regionFilter?: string,
        departmentFilter?: string,
    ) {
        const where: any = {
            declarations: {
                none: {
                    year,
                    status: {
                        in: [
                            DeclarationStatus.SUBMITTED,
                            DeclarationStatus.DIVISION_APPROVED,
                            DeclarationStatus.REGION_APPROVED,
                            DeclarationStatus.FINAL_APPROVED,
                        ],
                    },
                },
            },
        };

        if (regionFilter) where.region = regionFilter;
        if (departmentFilter) where.department = departmentFilter;

        const companiesWithoutDeclaration = await this.prisma.company.findMany({ where });

        const message =
            `Rappel: La date limite de soumission de votre Déclaration sur la Situation ` +
            `de la Main d'Œuvre (DSM-O) pour l'année ${year} est le ` +
            `${deadlineDate.toLocaleDateString('fr-FR')}.\n\n` +
            `Veuillez soumettre votre déclaration avant cette date via la plateforme DSMO.`;

        let sent = 0;
        let failed = 0;

        for (const company of companiesWithoutDeclaration) {
            try {
                const user = await this.prisma.user.findUnique({
                    where: { id: company.userId },
                });

                if (user && user.email) {
                    const emailHtml = this.generateEmailHtml(company.name, message);
                    await this.transporter.sendMail({
                        from: process.env.SMTP_FROM || 'dsmo@ministry.cm',
                        to: user.email,
                        subject: `[DSMO] Rappel: Échéance de soumission ${year}`,
                        text: message,
                        html: emailHtml,
                    });
                    sent++;
                }
            } catch {
                failed++;
            }
        }

        return { sent, failed, total: companiesWithoutDeclaration.length };
    }

    /**
     * Get all sent notifications with pagination.
     */
    async getNotifications(userId: string, page = 1, limit = 20) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        if (!([UserRole.DIVISIONAL, UserRole.REGIONAL, UserRole.CENTRAL] as UserRole[]).includes(user.role)) {
            throw new ForbiddenException('Only DIVISIONAL, REGIONAL, or CENTRAL users can view notifications');
        }

        const where: any = {};
        if (user.role === UserRole.DIVISIONAL) {
            where.regionFilter = user.department;
        } else if (user.role === UserRole.REGIONAL) {
            where.regionFilter = user.region;
        }

        return this.prisma.notification.findMany({
            where,
            include: {
                senderUser: { select: { id: true, email: true, firstName: true, lastName: true } },
                recipients: { take: 10 },
            },
            orderBy: { sentAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        });
    }

    /**
     * Get notification details with all recipients.
     */
    async getNotificationDetails(notificationId: string) {
        return this.prisma.notification.findUnique({
            where: { id: notificationId },
            include: {
                senderUser: { select: { id: true, email: true, firstName: true, lastName: true } },
                recipients: {
                    include: { company: { select: { id: true, name: true } } },
                },
            },
        });
    }

    /**
     * Get statistics on notification engagement.
     */
    async getNotificationStats(notificationId: string) {
        const notification = await this.prisma.notification.findUnique({
            where: { id: notificationId },
        });
        if (!notification) throw new NotFoundException('Notification not found');

        const recipients = await this.prisma.notificationRecipient.findMany({
            where: { notificationId },
        });

        const sent = recipients.filter((r: any) => r.status === 'SENT').length;
        const failed = recipients.filter((r: any) => r.status === 'FAILED').length;
        const bounced = recipients.filter((r: any) => r.status === 'BOUNCED').length;
        const opened = recipients.filter((r: any) => r.status === 'OPENED').length;

        return {
            notificationId,
            subject: notification.subject,
            totalRecipients: notification.recipientCount,
            sent,
            failed,
            bounced,
            opened,
            openRate:
                opened > 0
                    ? ((opened / notification.recipientCount) * 100).toFixed(2) + '%'
                    : '0%',
            sentAt: notification.sentAt,
        };
    }

    /**
     * Mark notification as opened (called from email tracking).
     */
    async markNotificationAsOpened(recipientId: string) {
        return this.prisma.notificationRecipient.update({
            where: { id: recipientId },
            data: { status: 'OPENED', openedAt: new Date() },
        });
    }

    /**
     * Generate HTML email template.
     */
    private generateEmailHtml(companyName: string, message: string): string {
        return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .header { background-color: #1a5d3a; color: white; padding: 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 20px; line-height: 1.6; }
            .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; margin-top: 20px; }
            .button { display: inline-block; background-color: #1a5d3a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DSM-O CAMEROUN</h1>
            <p>Plateforme Nationale de la Déclaration sur la Situation de la Main d'Œuvre</p>
          </div>
          <div class="content">
            <p>Madame, Monsieur,</p>
            <p><strong>${companyName}</strong>,</p>
            <p>${message.replace(/\n/g, '</p><p>')}</p>
            <a href="${process.env.APP_URL || 'https://dsmo.ministry.cm'}/login" class="button">
              Accéder à la plateforme DSMO
            </a>
            <p>Si vous avez des questions, n'hésitez pas à contacter l'équipe DSMO.</p>
          </div>
          <div class="footer">
            <p>Ministère de l'Emploi et de la Formation Professionnelle | Cameroun</p>
            <p>© ${new Date().getFullYear()} - Tous droits réservés</p>
          </div>
        </body>
      </html>
    `;
    }
}