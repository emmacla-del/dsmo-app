"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const prisma_types_1 = require("../types/prisma.types");
const nodemailer = require("nodemailer");
const audit_service_1 = require("./audit.service");
let NotificationService = class NotificationService {
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
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
    async sendNotification(userId, subject, message, filters) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        if (![prisma_types_1.UserRole.DIVISIONAL, prisma_types_1.UserRole.REGIONAL, prisma_types_1.UserRole.CENTRAL].includes(user.role)) {
            throw new common_1.ForbiddenException('Only DIVISIONAL, REGIONAL, or CENTRAL users can send notifications');
        }
        const where = {};
        if (user.role === prisma_types_1.UserRole.DIVISIONAL) {
            if (!user.department)
                throw new common_1.BadRequestException('User has no department assigned');
            where.department = user.department;
            if (filters.departmentFilter && filters.departmentFilter !== user.department) {
                throw new common_1.ForbiddenException('Cannot send to companies outside your department');
            }
        }
        else if (user.role === prisma_types_1.UserRole.REGIONAL) {
            if (!user.region)
                throw new common_1.BadRequestException('User has no region assigned');
            where.region = user.region;
            if (filters.regionFilter && filters.regionFilter !== user.region) {
                throw new common_1.ForbiddenException('Cannot send to companies outside your region');
            }
        }
        else if (user.role === prisma_types_1.UserRole.CENTRAL) {
            if (filters.regionFilter)
                where.region = filters.regionFilter;
            if (filters.departmentFilter)
                where.department = filters.departmentFilter;
        }
        const companies = await this.prisma.company.findMany({ where });
        if (companies.length === 0) {
            throw new common_1.BadRequestException('No companies found matching the specified filters');
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
        const recipients = [];
        const failures = [];
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
                }
                catch (emailError) {
                    failures.push({
                        companyId: company.id,
                        email: companyUser.email,
                        reason: emailError.message,
                    });
                    await this.prisma.notificationRecipient.update({
                        where: { id: recipient.id },
                        data: { status: 'FAILED' },
                    });
                }
            }
            catch (error) {
                failures.push({
                    companyId: company.id,
                    reason: error.message,
                });
            }
        }
        await this.auditService.log(userId, 'SEND_NOTIFICATION', 'Notification', notification.id, `Sent notification to ${recipients.length} companies. Subject: ${subject}`);
        return {
            notificationId: notification.id,
            totalRecipients: companies.length,
            successfulSends: recipients.length,
            failedSends: failures.length,
            failures: failures.length > 0 ? failures : undefined,
        };
    }
    async sendDeadlineReminders(year, deadlineDate, regionFilter, departmentFilter) {
        const where = {
            declarations: {
                none: {
                    year,
                    status: {
                        in: [
                            prisma_types_1.DeclarationStatus.SUBMITTED,
                            prisma_types_1.DeclarationStatus.DIVISION_APPROVED,
                            prisma_types_1.DeclarationStatus.REGION_APPROVED,
                            prisma_types_1.DeclarationStatus.FINAL_APPROVED,
                        ],
                    },
                },
            },
        };
        if (regionFilter)
            where.region = regionFilter;
        if (departmentFilter)
            where.department = departmentFilter;
        const companiesWithoutDeclaration = await this.prisma.company.findMany({ where });
        const message = `Rappel: La date limite de soumission de votre Déclaration sur la Situation ` +
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
            }
            catch {
                failed++;
            }
        }
        return { sent, failed, total: companiesWithoutDeclaration.length };
    }
    async getNotifications(userId, page = 1, limit = 20) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        if (![prisma_types_1.UserRole.DIVISIONAL, prisma_types_1.UserRole.REGIONAL, prisma_types_1.UserRole.CENTRAL].includes(user.role)) {
            throw new common_1.ForbiddenException('Only DIVISIONAL, REGIONAL, or CENTRAL users can view notifications');
        }
        const where = {};
        if (user.role === prisma_types_1.UserRole.DIVISIONAL) {
            where.regionFilter = user.department;
        }
        else if (user.role === prisma_types_1.UserRole.REGIONAL) {
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
    async getNotificationDetails(notificationId) {
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
    async getNotificationStats(notificationId) {
        const notification = await this.prisma.notification.findUnique({
            where: { id: notificationId },
        });
        if (!notification)
            throw new common_1.NotFoundException('Notification not found');
        const recipients = await this.prisma.notificationRecipient.findMany({
            where: { notificationId },
        });
        const sent = recipients.filter((r) => r.status === 'SENT').length;
        const failed = recipients.filter((r) => r.status === 'FAILED').length;
        const bounced = recipients.filter((r) => r.status === 'BOUNCED').length;
        const opened = recipients.filter((r) => r.status === 'OPENED').length;
        return {
            notificationId,
            subject: notification.subject,
            totalRecipients: notification.recipientCount,
            sent,
            failed,
            bounced,
            opened,
            openRate: opened > 0
                ? ((opened / notification.recipientCount) * 100).toFixed(2) + '%'
                : '0%',
            sentAt: notification.sentAt,
        };
    }
    async markNotificationAsOpened(recipientId) {
        return this.prisma.notificationRecipient.update({
            where: { id: recipientId },
            data: { status: 'OPENED', openedAt: new Date() },
        });
    }
    generateEmailHtml(companyName, message) {
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
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], NotificationService);
//# sourceMappingURL=notification.service.js.map