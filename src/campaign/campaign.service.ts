// src/campaign/campaign.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../types/prisma.types';

// Transaction client type provided by Prisma — doesn't include NestJS lifecycle methods.
type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class CampaignService {
    private readonly logger = new Logger(CampaignService.name);

    constructor(private prisma: PrismaService) { }

    async createCampaign(data: any) {
        const code = await this.generateCampaignCode(data.type, new Date(data.startDate));

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

        // FIX N+1: fetch all campaign progress in a single grouped query
        // instead of one DB roundtrip per campaign.
        const campaignIds = campaigns.map(c => c.id);
        const allSubmissions = await this.prisma.campaignSubmission.groupBy({
            by: ['campaignId', 'status'],
            where: { campaignId: { in: campaignIds } },
            _count: true,
        });

        // Build a lookup map keyed by campaignId
        const progressMap = new Map<string, ReturnType<typeof this._buildProgress>>();
        for (const id of campaignIds) {
            const rows = allSubmissions.filter(s => s.campaignId === id);
            progressMap.set(id, this._buildProgress(rows));
        }

        return campaigns.map(c => ({
            ...c,
            progress: progressMap.get(c.id) ?? this._buildProgress([]),
        }));
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

        // FIX: wrap in a transaction so a crash mid-way doesn't leave
        // submissions initialized but status still DRAFT.
        await this.prisma.$transaction(async (tx) => {
            await this._initializeCampaignSubmissions(id, tx);

            await tx.dataCampaign.update({
                where: { id },
                data: { status: 'ACTIVE' },
            });
        });

        if (campaign.autoReminders) {
            await this.sendReminders(id, 'CAMPAIGN_ANNOUNCEMENT');
        }

        return this.prisma.dataCampaign.findUnique({ where: { id } });
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
        return this._buildProgress(submissions);
    }

    async getCampaignSubmissions(campaignId: string, filters: { status?: string; region?: string }) {
        const where: any = { campaignId };
        if (filters.status) where.status = filters.status;

        const submissions = await this.prisma.campaignSubmission.findMany({
            where,
            include: { campaign: { select: { name: true, code: true } } },
            orderBy: { submittedAt: 'desc' },
        });

        // FIX N+1: collect all establishmentIds then fetch companies in one query.
        const establishmentIds = submissions
            .map(s => s.establishmentId)
            .filter((id): id is string => id != null);

        const companies = await this.prisma.company.findMany({
            where: { establishmentId: { in: establishmentIds } },
            select: { establishmentId: true, name: true, region: true, department: true },
        });

        const companyMap = new Map(companies.map(c => [c.establishmentId, c]));

        return submissions.map(sub => {
            const company = sub.establishmentId
                ? companyMap.get(sub.establishmentId)
                : undefined;
            return {
                ...sub,
                companyName: company?.name ?? null,
                region: company?.region ?? null,
                department: company?.department ?? null,
            };
        });
    }

    async sendReminders(campaignId: string, reminderType: string) {
        const campaign = await this.prisma.dataCampaign.findUnique({ where: { id: campaignId } });
        if (!campaign) throw new NotFoundException('Campaign not found');

        // FIX N+1: fetch pending submissions, then all their companies in one query.
        const pendingSubmissions = await this.prisma.campaignSubmission.findMany({
            where: { campaignId, status: { notIn: ['SUBMITTED', 'VALIDATED'] } },
            select: { establishmentId: true },
        });

        const establishmentIds = pendingSubmissions
            .map(s => s.establishmentId)
            .filter((id): id is string => id != null);

        const recipientCount = await this.prisma.company.count({
            where: { establishmentId: { in: establishmentIds } },
        });

        const reminder = await this.prisma.campaignReminder.create({
            data: {
                campaignId,
                reminderType,
                recipientCount,
                subject: this.getReminderSubject(reminderType, campaign.name),
                message: this.getReminderMessage(reminderType, campaign),
            },
        });

        this.logger.log(`Reminder [${reminderType}] sent to ${recipientCount} recipients for campaign ${campaignId}`);
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
            include: {
                submissions: {
                    where: { establishmentId: company.establishmentId },
                    take: 1,
                },
            },
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

    // ═══════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════

    /**
     * Shared progress builder — used by both getCampaignProgress()
     * and the batched listCampaigns() aggregation to avoid duplication.
     */
    private _buildProgress(rows: { status: string; _count: number }[]) {
        const total = rows.reduce((acc, s) => acc + s._count, 0);
        const submitted = rows.find(s => s.status === 'SUBMITTED')?._count ?? 0;
        const notStarted = rows.find(s => s.status === 'NOT_STARTED')?._count ?? 0;
        const inProgress = rows.find(s => s.status === 'IN_PROGRESS')?._count ?? 0;

        return {
            total,
            submitted,
            notStarted,
            inProgress,
            completionRate: total > 0 ? ((submitted / total) * 100).toFixed(1) : '0.0',
            byStatus: rows.reduce<Record<string, number>>(
                (acc, s) => ({ ...acc, [s.status]: s._count }),
                {},
            ),
            lastUpdated: new Date(),
        };
    }

    /**
     * Initializes campaign submissions for all matching establishments.
     * Accepts an optional Prisma transaction client so it can run inside
     * the activateCampaign() transaction safely.
     */
    private async _initializeCampaignSubmissions(
        campaignId: string,
        tx?: PrismaTx,
    ) {
        const db = tx ?? this.prisma;
        const campaign = await db.dataCampaign.findUnique({ where: { id: campaignId } });
        if (!campaign) return;

        const where: any = { establishmentId: { not: null } };
        if (campaign.targetRegions?.length) where.region = { in: campaign.targetRegions };
        if (campaign.targetDepartments?.length) where.department = { in: campaign.targetDepartments };

        const establishments = await db.company.findMany({
            where,
            select: { id: true, establishmentId: true },
        });

        // Batch upserts — still one per establishment but now inside a
        // transaction so the whole operation is atomic.
        for (const est of establishments) {
            if (!est.establishmentId) continue;

            await db.campaignSubmission.upsert({
                where: {
                    campaignId_establishmentId: {
                        campaignId,
                        establishmentId: est.establishmentId,
                    },
                },
                update: {},
                create: {
                    campaignId,
                    companyId: est.id,
                    establishmentId: est.establishmentId,
                    status: 'NOT_STARTED',
                },
            });
        }
    }

    /**
     * FIX: replaces Math.random() with a DB count to derive a collision-free
     * sequence number. Two campaigns of the same type created in the same
     * quarter/year will get consecutive suffixes (001, 002, …) instead of
     * random ones that can collide.
     *
     * e.g. QUARTERLY_2024_T3_001, QUARTERLY_2024_T3_002
     */
    private async generateCampaignCode(type: string, startDate?: Date): Promise<string> {
        const d = startDate ?? new Date();
        const year = d.getFullYear();
        const quarter = Math.ceil((d.getMonth() + 1) / 3);

        const suffix =
            type === 'QUARTERLY' ? `T${quarter}` :
                type === 'SEMESTER' ? `S${quarter <= 2 ? 1 : 2}` :
                    type === 'ANNUAL' ? 'AN' :
                        `T${quarter}`;

        const prefix = `${type}_${year}_${suffix}`;

        // Count existing codes that start with this prefix to derive the next seq
        const existing = await this.prisma.dataCampaign.count({
            where: { code: { startsWith: prefix } },
        });

        const seq = (existing + 1).toString().padStart(3, '0');
        return `${prefix}_${seq}`;
    }

    private getReminderSubject(type: string, campaignName: string): string {
        const subjects: Record<string, string> = {
            CAMPAIGN_ANNOUNCEMENT: `Nouvelle campagne: ${campaignName}`,
            DEADLINE_APPROACHING: `Rappel: Échéance de la campagne ${campaignName}`,
            FINAL_REMINDER: `Dernier rappel: ${campaignName} se termine bientôt`,
            DEADLINE_EXTENDED: `Prorogation: Nouvelle échéance pour ${campaignName}`,
        };
        return subjects[type] ?? `Information: ${campaignName}`;
    }

    private getReminderMessage(type: string, campaign: any): string {
        const messages: Record<string, string> = {
            CAMPAIGN_ANNOUNCEMENT: `La campagne "${campaign.name}" est active. Veuillez soumettre vos données avant le ${campaign.deadline?.toLocaleDateString('fr-FR')}.`,
            DEADLINE_APPROACHING: `La campagne "${campaign.name}" se termine le ${campaign.deadline?.toLocaleDateString('fr-FR')}. Finalisez votre soumission.`,
            FINAL_REMINDER: `DERNIER RAPPEL: La campagne "${campaign.name}" se termine dans 24 heures.`,
            DEADLINE_EXTENDED: `La date limite de "${campaign.name}" a été prolongée au ${campaign.deadline?.toLocaleDateString('fr-FR')}.`,
        };
        return messages[type] ?? `Veuillez prendre connaissance de la campagne "${campaign.name}".`;
    }
}