// src/campaign/campaign-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from './campaign.service';

@Injectable()
export class CampaignSchedulerService {
    private readonly logger = new Logger(CampaignSchedulerService.name);

    constructor(
        private prisma: PrismaService,
        private campaignService: CampaignService,
    ) { }

    @Cron(CronExpression.EVERY_DAY_AT_6AM)
    async checkCampaignDeadlines() {
        const activeCampaigns = await this.prisma.dataCampaign.findMany({
            where: { status: 'ACTIVE' },
        });

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        for (const campaign of activeCampaigns) {
            const deadline = campaign.extendedDeadline ?? campaign.deadline;
            if (!deadline) continue;

            const daysRemaining = Math.ceil(
                (deadline.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
            );

            try {
                if (daysRemaining < 0) {
                    await this._handleExpiry(campaign.id, startOfToday);
                } else if (campaign.reminderDays.includes(daysRemaining)) {
                    const reminderType = daysRemaining <= 1 ? 'FINAL_REMINDER' : 'DEADLINE_APPROACHING';
                    await this._sendIfNotAlreadySentToday(campaign.id, reminderType, startOfToday);
                }
            } catch (err) {
                this.logger.error(
                    `Deadline check failed for campaign ${campaign.id}: ${(err as Error).message}`,
                );
            }
        }
    }

    private async _sendIfNotAlreadySentToday(
        campaignId: string,
        reminderType: string,
        startOfToday: Date,
    ) {
        const alreadySent = await this.prisma.campaignReminder.findFirst({
            where: { campaignId, reminderType, sentAt: { gte: startOfToday } },
        });
        if (alreadySent) return;

        await this.campaignService.sendReminders(campaignId, reminderType);
    }

    private async _handleExpiry(campaignId: string, startOfToday: Date) {
        const alreadyNotified = await this.prisma.campaignReminder.findFirst({
            where: { campaignId, reminderType: 'CAMPAIGN_EXPIRED', sentAt: { gte: startOfToday } },
        });
        if (!alreadyNotified) {
            await this.campaignService.sendReminders(campaignId, 'CAMPAIGN_EXPIRED');
        }
        await this.campaignService.closeCampaign(campaignId);
    }
}
