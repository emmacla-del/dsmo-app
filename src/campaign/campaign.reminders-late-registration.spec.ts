import { CampaignService } from './campaign.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../dsmo/notification.service';

// Reminder recipients are read from CampaignSubmission rows, which activation
// creates only for the establishments targeted at that moment
// (_initializeCampaignSubmissions). An establishment approved after that used
// to have no row until it submitted (the upsert of 22714da3), so it was never
// reminded. sendReminders now re-syncs the rows first.
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
    let rows: { campaignId: string; establishmentId: string; companyId: string; status: string; submittedAt?: Date | null }[];
    let files: { campaignId: string; establishmentId: string; status: string; createdAt: Date }[];
    let sendToCompanies: jest.Mock;
    let service: CampaignService;
    let prisma: any;

    beforeEach(() => {
        establishments = [{ id: 'est-early', companyId: 'co-early', isPrincipal: true, status: 'ACTIVE' }];
        companies = [{ id: 'co-early', userId: 'u-early', name: 'Early', establishmentId: 'est-early' }];
        rows = [];
        files = [];

        prisma = {
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
                        .filter(r => r.campaignId === where.campaignId && !where.status?.notIn.includes(r.status))
                        .map(r => ({ establishmentId: r.establishmentId }))),
            },
            onefopSubmission: {
                findMany: jest.fn(async ({ where }: any) =>
                    files.filter(f =>
                        f.campaignId === where.campaignId
                        && where.establishmentId.in.includes(f.establishmentId)
                        && f.status !== where.status.not)),
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

    it('reminds an establishment approved after the campaign was activated', async () => {
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

    it('keeps the existing rows when a late establishment has already submitted', async () => {
        await (service as any)._initializeCampaignSubmissions(campaign.id);
        establishments.push({ id: 'est-late', companyId: 'co-late', isPrincipal: true, status: 'ACTIVE' });
        companies.push({ id: 'co-late', userId: 'u-late', name: 'Late', establishmentId: 'est-late' });
        rows.push({ campaignId: campaign.id, establishmentId: 'est-late', companyId: 'co-late', status: 'SUBMITTED' });

        await service.sendReminders(campaign.id, 'DEADLINE_APPROACHING');

        expect(rows.filter(r => r.establishmentId === 'est-late')).toHaveLength(1);
        expect(sendToCompanies.mock.calls[0][0].map((c: any) => c.id)).toEqual(['co-early']);
    });

    it('still sends to the existing rows when the sync fails', async () => {
        await (service as any)._initializeCampaignSubmissions(campaign.id);
        prisma.establishment.findMany.mockRejectedValueOnce(new Error('pool exhausted'));

        await service.sendReminders(campaign.id, 'DEADLINE_APPROACHING');

        expect(sendToCompanies.mock.calls[0][0].map((c: any) => c.id)).toEqual(['co-early']);
    });

    it('does not remind a late establishment that filed before it had a row', async () => {
        await (service as any)._initializeCampaignSubmissions(campaign.id);
        establishments.push({ id: 'est-late', companyId: 'co-late', isPrincipal: true, status: 'ACTIVE' });
        companies.push({ id: 'co-late', userId: 'u-late', name: 'Late', establishmentId: 'est-late' });
        const filed = new Date('2026-10-10T09:00:00Z');
        files.push(
            { campaignId: campaign.id, establishmentId: 'est-late', status: 'SUPERSEDED', createdAt: new Date('2026-10-01') },
            { campaignId: campaign.id, establishmentId: 'est-late', status: 'PENDING_REVIEW', createdAt: filed },
        );

        await service.sendReminders(campaign.id, 'DEADLINE_APPROACHING');

        expect(rows.find(r => r.establishmentId === 'est-late')).toMatchObject({ status: 'SUBMITTED', submittedAt: filed });
        expect(sendToCompanies.mock.calls[0][0].map((c: any) => c.id)).toEqual(['co-early']);
    });

    it('seeds an approved file as VALIDATED and a draft as IN_PROGRESS', async () => {
        establishments.push(
            { id: 'est-ok', companyId: 'co-ok', isPrincipal: true, status: 'ACTIVE' },
            { id: 'est-draft', companyId: 'co-draft', isPrincipal: true, status: 'ACTIVE' },
        );
        files.push(
            { campaignId: campaign.id, establishmentId: 'est-ok', status: 'APPROVED', createdAt: new Date() },
            { campaignId: campaign.id, establishmentId: 'est-draft', status: 'DRAFT', createdAt: new Date() },
        );

        await service.syncCampaignSubmissions(campaign.id);

        expect(Object.fromEntries(rows.map(r => [r.establishmentId, r.status]))).toEqual({
            'est-early': 'NOT_STARTED',
            'est-ok': 'VALIDATED',
            'est-draft': 'IN_PROGRESS',
        });
    });
});
