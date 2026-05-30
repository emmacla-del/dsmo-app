import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, CampaignStatus } from '../types/prisma.types';

@Injectable()
export class CampaignService {
    constructor(private prisma: PrismaService) { }

    async createCampaign(data: any) {
        const code = this.generateCampaignCode(data.type);

        return this.prisma.dataCampaign.create({
            data: {
                code,
                name: data.name,
                description: data.description,
                type: data.type,
                startDate: new Date(data.startDate),
                deadline: new Date(data.deadline),
                targetRegions: data.targetRegions || [],
                targetDepartments: data.targetDepartments || [],
                targetEntityTypes: data.targetEntityTypes,
                autoReminders: data.autoReminders ?? true,
                reminderDays: data.reminderDays || [7, 3, 1],
                createdBy: data.createdBy,
            },
        });
    }

    async listCampaigns(status?: string, type?: string, user?: any) {
        const where: any = {};
        if (status) where.status = status;
        if (type) where.type = type;

        if (user?.role === UserRole.REGIONAL && user.region) {
            where.targetRegions = { has: user.region };
        }

        const campaigns = await this.prisma.dataCampaign.findMany({
            where,
            include: {
                _count: { select: { submissions: true } },
                creator: { select: { firstName: true, lastName: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        for (const campaign of campaigns) {
            const progress = await this.getCampaignProgress(campaign.id);
            (campaign as any).progress = progress;
        }

        return campaigns;
    }

    async getCampaign(id: string) {
        const campaign = await this.prisma.dataCampaign.findUnique({
            where: { id },
            include: {
                creator: { select: { firstName: true, lastName: true, email: true } },
                submissions: { take: 20, orderBy: { submittedAt: 'desc' } },
                reminders: { orderBy: { sentAt: 'desc' }, take: 10 },
            },
        });

        if (!campaign) throw new NotFoundException('Campaign not found');
        return campaign;
    }

    async updateCampaign(id: string, data: any) {
        return this.prisma.dataCampaign.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                deadline: data.deadline ? new Date(data.deadline) : undefined,
                targetRegions: data.targetRegions,
                targetDepartments: data.targetDepartments,
                targetEntityTypes: data.targetEntityTypes,
                reminderDays: data.reminderDays,
            },
        });
    }

    async deleteCampaign(id: string) {
        return this.prisma.dataCampaign.delete({ where: { id } });
    }

    async activateCampaign(id: string) {
        const campaign = await this.prisma.dataCampaign.findUnique({ where: { id } });
        if (!campaign) throw new NotFoundException('Campaign not found');

        if (campaign.status !== 'DRAFT' && campaign.status !== 'PAUSED') {
            throw new BadRequestException('Only DRAFT or PAUSED campaigns can be activated');
        }

        await this.initializeCampaignSubmissions(id);

        if (campaign.autoReminders) {
            await this.sendReminders(id, 'CAMPAIGN_ANNOUNCEMENT');
        }

        return this.prisma.dataCampaign.update({
            where: { id },
            data: { status: 'ACTIVE' },
        });
    }

    async pauseCampaign(id: string) {
        return this.prisma.dataCampaign.update({
            where: { id },
            data: { status: 'PAUSED' },
        });
    }

    async closeCampaign(id: string) {
        return this.prisma.dataCampaign.update({
            where: { id },
            data: { status: 'CLOSED', closedAt: new Date() },
        });
    }

    async extendDeadline(id: string, newDeadline: Date) {
        const campaign = await this.prisma.dataCampaign.update({
            where: { id },
            data: { deadline: newDeadline, extendedDeadline: newDeadline, status: 'ACTIVE' },
        });
        await this.sendReminders(id, 'DEADLINE_EXTENDED');
        return campaign;
    }

    async getCampaignProgress(campaignId: string) {
        const submissions = await this.prisma.campaignSubmission.groupBy({
            by: ['status'],
            where: { campaignId },
            _count: true,
        });

        const total = submissions.reduce((acc, s) => acc + s._count, 0);
        const submitted = submissions.find(s => s.status === 'SUBMITTED')?._count || 0;
        const notStarted = submissions.find(s => s.status === 'NOT_STARTED')?._count || 0;
        const inProgress = submissions.find(s => s.status === 'IN_PROGRESS')?._count || 0;

        return {
            total,
            submitted,
            notStarted,
            inProgress,
            completionRate: total > 0 ? ((submitted / total) * 100).toFixed(1) : 0,
            byStatus: submissions.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
            lastUpdated: new Date(),
        };
    }

    async getCampaignSubmissions(campaignId: string, filters: { status?: string; region?: string }) {
        const where: any = { campaignId };
        if (filters.status) where.status = filters.status;

        const submissions = await this.prisma.campaignSubmission.findMany({
            where,
            include: { campaign: { select: { name: true, code: true } } },
            orderBy: { submittedAt: 'desc' },
        });

        const enriched = await Promise.all(
            submissions.map(async (sub) => {
                const company = await this.prisma.company.findFirst({
                    where: { establishmentId: sub.establishmentId },
                    select: { name: true, region: true, department: true },
                });
                return { ...sub, companyName: company?.name, region: company?.region, department: company?.department };
            })
        );

        return enriched;
    }

    async sendReminders(campaignId: string, reminderType: string) {
        const campaign = await this.prisma.dataCampaign.findUnique({ where: { id: campaignId } });
        if (!campaign) throw new NotFoundException('Campaign not found');

        const pendingSubmissions = await this.prisma.campaignSubmission.findMany({
            where: { campaignId, status: { notIn: ['SUBMITTED', 'VALIDATED'] } },
        });

        const companies = await Promise.all(
            pendingSubmissions.map(async (sub) => {
                return this.prisma.company.findFirst({
                    where: { establishmentId: sub.establishmentId },
                    include: { user: true },
                });
            })
        );

        const reminder = await this.prisma.campaignReminder.create({
            data: {
                campaignId,
                reminderType: reminderType as any,
                recipientCount: companies.filter(c => c).length,
                subject: this.getReminderSubject(reminderType, campaign.name),
                message: this.getReminderMessage(reminderType, campaign),
            },
        });

        console.log(`Reminder sent to ${reminder.recipientCount} recipients`);
        return reminder;
    }

    async getActiveCampaignsForCompany(userId: string) {
        const company = await this.prisma.company.findUnique({ where: { userId } });
        if (!company?.establishmentId) return [];

        const now = new Date();
        const campaigns = await this.prisma.dataCampaign.findMany({
            where: {
                status: 'ACTIVE',
                startDate: { lte: now },
                deadline: { gte: now },
                OR: [
                    { targetRegions: { has: company.region } },
                    { targetDepartments: { has: company.department } },
                    { targetEntityTypes: { has: company.entityType! } },
                ],
            },
            include: { submissions: { where: { establishmentId: company.establishmentId }, take: 1 } },
        });

        return campaigns.map(c => ({
            id: c.id,
            code: c.code,
            name: c.name,
            description: c.description,
            deadline: c.deadline,
            status: c.status,
            mySubmission: c.submissions[0]?.status || 'NOT_STARTED',
        }));
    }

    private async initializeCampaignSubmissions(campaignId: string) {
        const campaign = await this.prisma.dataCampaign.findUnique({ where: { id: campaignId } });
        if (!campaign) return;

        const where: any = { establishmentId: { not: null } };
        if (campaign.targetRegions?.length) where.region = { in: campaign.targetRegions };
        if (campaign.targetDepartments?.length) where.department = { in: campaign.targetDepartments };

        const establishments = await this.prisma.company.findMany({ where, select: { establishmentId: true } });

        for (const est of establishments) {
            if (!est.establishmentId) continue;
            await this.prisma.campaignSubmission.upsert({
                where: { campaignId_establishmentId: { campaignId, establishmentId: est.establishmentId } },
                update: {},
                create: { campaignId, establishmentId: est.establishmentId, status: 'NOT_STARTED' },
            });
        }
    }

    private generateCampaignCode(type: string): string {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000);
        return `${type}_${year}_${random}`;
    }

    private getReminderSubject(type: string, campaignName: string): string {
        const subjects = {
            CAMPAIGN_ANNOUNCEMENT: `Nouvelle campagne: ${campaignName}`,
            DEADLINE_APPROACHING: `Rappel: Échéance de la campagne ${campaignName}`,
            FINAL_REMINDER: `Dernier rappel: ${campaignName} se termine bientôt`,
            DEADLINE_EXTENDED: `Prorogation: Nouvelle échéance pour ${campaignName}`,
        };
        return subjects[type] || `Information: ${campaignName}`;
    }

    private getReminderMessage(type: string, campaign: any): string {
        const messages = {
            CAMPAIGN_ANNOUNCEMENT: `La campagne "${campaign.name}" est active. Veuillez soumettre vos données avant le ${campaign.deadline.toLocaleDateString()}.`,
            DEADLINE_APPROACHING: `La campagne "${campaign.name}" se termine le ${campaign.deadline.toLocaleDateString()}. Finalisez votre soumission.`,
            FINAL_REMINDER: `DERNIER RAPPEL: La campagne "${campaign.name}" se termine dans 24 heures.`,
            DEADLINE_EXTENDED: `La date limite de "${campaign.name}" a été prolongée au ${campaign.deadline.toLocaleDateString()}.`,
        };
        return messages[type] || `Veuillez prendre connaissance de la campagne "${campaign.name}".`;
    }
}