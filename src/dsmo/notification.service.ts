import { Injectable, BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, DeclarationStatus } from '../types/prisma.types';
import * as nodemailer from 'nodemailer';
import { AuditService } from './audit.service';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);
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
            // Without these, a stalled/unreachable SMTP server can hang for
            // nodemailer's defaults (connectionTimeout 2min, socketTimeout 10min),
            // blocking any request path that awaits an email send.
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 10_000,
        });

        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
            this.logger.warn(
                'SMTP is not fully configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing). ' +
                'Outgoing emails — including password reset and declaration notifications — will fail until these env vars are set.',
            );
        }
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

        const NATIONAL_ROLES = [UserRole.CENTRAL, UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP] as UserRole[];

        if (!([UserRole.DIVISIONAL, UserRole.REGIONAL] as UserRole[]).includes(user.role) && !NATIONAL_ROLES.includes(user.role)) {
            throw new ForbiddenException('Only DIVISIONAL, REGIONAL, CENTRAL, or SUPER_ADMIN users can send notifications');
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
        } else if (NATIONAL_ROLES.includes(user.role)) {
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
        let skippedByPreference = 0;

        for (const company of companies) {
            try {
                const companyUser = await this.prisma.user.findUnique({
                    where: { id: company.userId },
                });

                if (!companyUser || !companyUser.email) {
                    failures.push({ companyId: company.id, reason: 'No user email found' });
                    continue;
                }

                // Recipient opted out of email notifications — no record is
                // created since there's nothing to mark SENT/FAILED for.
                if (!companyUser.emailNotificationsEnabled) {
                    skippedByPreference++;
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
            skippedByPreference,
            failures: failures.length > 0 ? failures : undefined,
        };
    }

    /**
     * Email a pre-resolved list of companies directly (no permission/audit
     * checks — callers like CampaignService have already authorized the
     * action via their own route guards). Looks up each company's user
     * email and reuses the same SMTP transporter/template as sendNotification.
     */
    async sendToCompanies(
        companies: { id: string; userId: string | null; name: string }[],
        subject: string,
        message: string,
    ): Promise<{ sent: number; failed: number; skippedByPreference: number }> {
        // FIX N+1: one query for every recipient's email instead of one
        // findUnique per company.
        const userIds = companies
            .map((c) => c.userId)
            .filter((id): id is string => id != null);
        const users = await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, emailNotificationsEnabled: true },
        });
        const userById = new Map(users.map((u) => [u.id, u]));

        let sent = 0;
        let failed = 0;
        let skippedByPreference = 0;

        // Opted-out recipients are filtered out before the batches below so
        // they don't count against sent/failed.
        const eligible = companies.filter((company) => {
            const user = company.userId ? userById.get(company.userId) : undefined;
            if (user && !user.emailNotificationsEnabled) {
                skippedByPreference++;
                return false;
            }
            return true;
        });

        // Send in small concurrent batches instead of strictly one-at-a-time
        // — with SMTP slow or unreachable, sequential sends meant N stacked
        // connection timeouts.
        const CONCURRENCY = 10;
        for (let i = 0; i < eligible.length; i += CONCURRENCY) {
            const batch = eligible.slice(i, i + CONCURRENCY);
            const results = await Promise.allSettled(
                batch.map(async (company) => {
                    const email = company.userId ? userById.get(company.userId)?.email : undefined;
                    if (!email) throw new Error('No user email found');

                    return this.transporter.sendMail({
                        from: process.env.SMTP_FROM || 'dsmo@ministry.cm',
                        to: email,
                        subject,
                        text: `${company.name},\n\n${message}`,
                        html: this.generateEmailHtml(company.name, message),
                    });
                }),
            );

            results.forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                    sent++;
                } else {
                    failed++;
                    this.logger.warn(
                        `Failed to email company ${batch[idx].id}: ${(result.reason as Error).message}`,
                    );
                }
            });
        }

        return { sent, failed, skippedByPreference };
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

        const NATIONAL_ROLES = [UserRole.CENTRAL, UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_DSMO, UserRole.SUPER_ADMIN_ONEFOP] as UserRole[];

        if (!([UserRole.DIVISIONAL, UserRole.REGIONAL] as UserRole[]).includes(user.role) && !NATIONAL_ROLES.includes(user.role)) {
            throw new ForbiddenException('Only DIVISIONAL, REGIONAL, CENTRAL, or SUPER_ADMIN users can view notifications');
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
     * Send a 2FA login verification code. Blocking (not fire-and-forget) —
     * unlike password reset, the caller already proved their password is
     * correct, so there's no account-enumeration concern, and the login
     * flow can't proceed without this email actually arriving.
     */
    async sendTwoFactorCodeEmail(to: string, code: string) {
        const html = this.generateTwoFactorCodeHtml(code);
        const text =
            `Votre code de vérification DSMO est : ${code}\n\n` +
            `Ce code est valable 10 minutes. Si vous n'êtes pas à l'origine de cette tentative de connexion, ignorez cet e-mail.`;

        await this.transporter.sendMail({
            from: process.env.SMTP_FROM || 'dsmo@ministry.cm',
            to,
            subject: '[DSMO] Votre code de vérification',
            text,
            html,
        });
    }

    /**
     * Send a personal weekly activity summary (see WeeklyDigestService).
     */
    async sendWeeklyDigestEmail(
        to: string,
        summary: { newThisWeek: number; pending: number; approved?: number },
    ) {
        const html = this.generateWeeklyDigestHtml(summary);
        const lines = [
            `Nouvelles déclarations cette semaine : ${summary.newThisWeek}`,
            `En attente de traitement : ${summary.pending}`,
        ];
        if (summary.approved !== undefined) {
            lines.push(`Approuvées : ${summary.approved}`);
        }
        const text = `Votre récapitulatif hebdomadaire DSMO :\n\n${lines.join('\n')}`;

        await this.transporter.sendMail({
            from: process.env.SMTP_FROM || 'dsmo@ministry.cm',
            to,
            subject: '[DSMO] Votre récapitulatif hebdomadaire',
            text,
            html,
        });
    }

    /**
     * Send a password reset email with a tokenized link.
     */
    async sendPasswordResetEmail(to: string, resetLink: string) {
        const html = this.generatePasswordResetHtml(resetLink);
        const text =
            `Vous avez demandé la réinitialisation de votre mot de passe DSMO.\n\n` +
            `Cliquez sur le lien suivant pour choisir un nouveau mot de passe (valable 1 heure) :\n${resetLink}\n\n` +
            `Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`;

        await this.transporter.sendMail({
            from: process.env.SMTP_FROM || 'dsmo@ministry.cm',
            to,
            subject: '[DSMO] Réinitialisation de votre mot de passe',
            text,
            html,
        });
    }

    /**
     * Send a welcome email asking the user to confirm their address.
     */
    async sendEmailVerificationEmail(to: string, verifyLink: string) {
        const html = this.generateEmailVerificationHtml(verifyLink);
        const text =
            `Bienvenue sur la plateforme DSMO.\n\n` +
            `Confirmez votre adresse e-mail en cliquant sur le lien suivant (valable 24 heures) :\n${verifyLink}\n\n` +
            `Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.`;

        await this.transporter.sendMail({
            from: process.env.SMTP_FROM || 'dsmo@ministry.cm',
            to,
            subject: '[DSMO] Confirmez votre adresse e-mail',
            text,
            html,
        });
    }

    /**
     * Generate HTML email template for a 2FA verification code.
     */
    private generateTwoFactorCodeHtml(code: string): string {
        return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .header { background-color: #1a5d3a; color: white; padding: 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 20px; line-height: 1.6; text-align: center; }
            .code { display: inline-block; background-color: #f5f5f5; border: 2px dashed #1a5d3a; border-radius: 8px; padding: 14px 28px; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1a5d3a; margin: 15px 0; }
            .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DSM-O CAMEROUN</h1>
            <p>Plateforme Nationale de la Déclaration sur la Situation de la Main d'Œuvre</p>
          </div>
          <div class="content">
            <p>Voici votre code de vérification pour terminer la connexion :</p>
            <div class="code">${code}</div>
            <p>Ce code est valable 10 minutes. Si vous n'êtes pas à l'origine de cette tentative de connexion, ignorez cet e-mail.</p>
          </div>
          <div class="footer">
            <p>Ministère de l'Emploi et de la Formation Professionnelle | Cameroun</p>
            <p>© ${new Date().getFullYear()} - Tous droits réservés</p>
          </div>
        </body>
      </html>
    `;
    }

    /**
     * Generate HTML email template for the weekly activity digest.
     */
    private generateWeeklyDigestHtml(
        summary: { newThisWeek: number; pending: number; approved?: number },
    ): string {
        const approvedRow =
            summary.approved !== undefined
                ? `<tr><td style="padding:8px 0;">Approuvées</td><td style="padding:8px 0; text-align:right; font-weight:bold;">${summary.approved}</td></tr>`
                : '';
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
            table { width: 100%; border-collapse: collapse; }
            td { border-bottom: 1px solid #eee; }
            .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DSM-O CAMEROUN</h1>
            <p>Votre récapitulatif hebdomadaire</p>
          </div>
          <div class="content">
            <table>
              <tr><td style="padding:8px 0;">Nouvelles déclarations cette semaine</td><td style="padding:8px 0; text-align:right; font-weight:bold;">${summary.newThisWeek}</td></tr>
              <tr><td style="padding:8px 0;">En attente de traitement</td><td style="padding:8px 0; text-align:right; font-weight:bold;">${summary.pending}</td></tr>
              ${approvedRow}
            </table>
            <p>Connectez-vous à la plateforme DSMO pour plus de détails.</p>
          </div>
          <div class="footer">
            <p>Ministère de l'Emploi et de la Formation Professionnelle | Cameroun</p>
            <p>© ${new Date().getFullYear()} - Tous droits réservés</p>
          </div>
        </body>
      </html>
    `;
    }

    /**
     * Generate HTML email template for email verification.
     */
    private generateEmailVerificationHtml(verifyLink: string): string {
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
            <p>Bienvenue sur la plateforme DSMO. Veuillez confirmer votre adresse e-mail pour finaliser votre inscription.</p>
            <a href="${verifyLink}" class="button">Confirmer mon adresse e-mail</a>
            <p>Ce lien est valable 24 heures. Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet e-mail.</p>
          </div>
          <div class="footer">
            <p>Ministère de l'Emploi et de la Formation Professionnelle | Cameroun</p>
            <p>© ${new Date().getFullYear()} - Tous droits réservés</p>
          </div>
        </body>
      </html>
    `;
    }

    /**
     * Generate HTML email template for password reset.
     */
    private generatePasswordResetHtml(resetLink: string): string {
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
            <p>Vous avez demandé la réinitialisation de votre mot de passe sur la plateforme DSMO.</p>
            <a href="${resetLink}" class="button">Réinitialiser mon mot de passe</a>
            <p>Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.</p>
          </div>
          <div class="footer">
            <p>Ministère de l'Emploi et de la Formation Professionnelle | Cameroun</p>
            <p>© ${new Date().getFullYear()} - Tous droits réservés</p>
          </div>
        </body>
      </html>
    `;
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