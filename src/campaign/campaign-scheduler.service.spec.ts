import { CampaignSchedulerService } from './campaign-scheduler.service';
import { CampaignService } from './campaign.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CampaignSchedulerService.checkCampaignDeadlines', () => {
    it('re-syncs the submission rows of every active campaign, reminder day or not', async () => {
        const inTenDays = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
        const prisma = {
            dataCampaign: {
                findMany: jest.fn().mockResolvedValue([
                    { id: 'c-1', deadline: inTenDays, extendedDeadline: null, reminderDays: [] },
                    { id: 'c-2', deadline: null, extendedDeadline: null, reminderDays: [] },
                ]),
            },
        };
        const campaignService = {
            syncCampaignSubmissions: jest.fn().mockResolvedValue(undefined),
            sendReminders: jest.fn(),
            expireCampaign: jest.fn(),
        };
        const scheduler = new CampaignSchedulerService(
            prisma as unknown as PrismaService,
            campaignService as unknown as CampaignService,
        );

        await scheduler.checkCampaignDeadlines();

        // c-2 has no deadline: no reminder, but its rows are still synced.
        expect(campaignService.syncCampaignSubmissions.mock.calls).toEqual([['c-1'], ['c-2']]);
        expect(campaignService.sendReminders).not.toHaveBeenCalled();
    });
});
