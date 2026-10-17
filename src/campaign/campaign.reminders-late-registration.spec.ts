import { CampaignService } from './campaign.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../dsmo/notification.service';

// Reminder recipients are read from CampaignSubmission rows, and those rows
// are created once, when the campaign is activated
// (_initializeCampaignSubmissions). An establishment approved after that has
// no row until it submits (the upsert of 22714da3), so it is never reminded.
//
// The in-memory fake keeps the rows created at activation, so the test plays
// the real sequence: activate, a new establishment is approved, send reminders.
describe('CampaignService - reminders reach establishments registered after activation', () => {
    const campaign = {
        id: 'camp-1',
        name: 'ONEFOP T3 2026',
        purpose: 'COLLECTION',
        status: 'ACTIVE',
        targetRegions: [] as string[],
        targetDepartments: [] as string[],
        targetEntityTypes: [] as string[],
    };

    let establishments: { id: string; companyId: string; isPrincipal: boolean; status: string }[];
    let companies: { id: string; userId: string; name: string; establishmentId: string }[];
    let rows: { campaignId: string; establishmentId: string; companyId: string; status: string }[];
    let sendToCompanies: jest.Mock;
    let service: CampaignService;

    beforeEach(() => {
        establishments = [{ id: 'est-early', companyId: 'co-early', isPrincipal: true, status: 'ACTIVE' }];
        companies = [{ id: 'co-early', userId: 'u-early', name: 'Early', establishmentId: 'est-early' }];
        rows = [];

        const prisma = {
            dataCampaign: { findUnique: jest.fn().mockResolvedValue(campaign) },
            establishment: {
                findMany: jest.fn(async ({ where }: any) =>
                    establishments
                        .filter(e => e.isPrincipal === where.isPrincipal && e.status === where.status)
                        .map(e => ({ id: e.id, companyId: e.companyId }))),
            },
            campaignSubmission: {
                createMany: jest.fn(async ({ data }: any) => {
                    for (const d of data) {
                        if (!rows.some(r => r.campaignId === d.campaignId && r.establishmentId === d.establishmentId)) rows.push(d);
                    }
                    return { count: data.length };
                }),
                findMany: jest.fn(async ({ where }: any) =>
                    rows
                        .filter(r => r.campaignId === where.campaignId && !where.status.notIn.includes(r.status))
                        .map(r => ({ establishmentId: r.establishmentId }))),
            },
            company: {
                findMany: jest.fn(async ({ where }: any) =>
                    companies
                        .filter(c => where.establishmentId.in.includes(c.establishmentId))
                        .map(({ id, userId, name }) => ({ id, userId, name }))),
            },
            campaignReminder: { create: jest.fn(async ({ data }: any) => data) },
        };
        sendToCompanies = jest.fn(async (list: any[]) => ({ sent: list.length, failed: 0 }));
        service = new CampaignService(prisma as unknown as PrismaService, { sendToCompanies } as unknown as NotificationService);
    });

    // Fails today: est-late has no CampaignSubmission row, so it is not a
    // recipient. Switch to `it` once the fix lands.
    it.failing('reminds an establishment approved after the campaign was activated', async () => {
        await (service as any)._initializeCampaignSubmissions(campaign.id);

        establishments.push({ id: 'est-late', companyId: 'co-late', isPrincipal: true, status: 'ACTIVE' });
        companies.push({ id: 'co-late', userId: 'u-late', name: 'Late', establishmentId: 'est-late' });

        await service.sendReminders(campaign.id, 'DEADLINE_APPROACHING');

        const recipients = sendToCompanies.mock.calls[0][0].map((c: any) => c.id).sort();
        expect(recipients).toEqual(['co-early', 'co-late']);
    });

    it('reminds the establishments that existed at activation', async () => {
        await (service as any)._initializeCampaignSubmissions(campaign.id);

        await service.sendReminders(campaign.id, 'DEADLINE_APPROACHING');

        expect(sendToCompanies.mock.calls[0][0].map((c: any) => c.id)).toEqual(['co-early']);
    });
});
