import { NotFoundException } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../dsmo/notification.service';

/**
 * GET /campaigns/:id, /:id/progress and /:id/submissions scoping (gap report
 * Family 4). Campaign visibility follows the listCampaigns REGIONAL rule but
 * fails closed; submission rows are limited to the caller's companies.
 */
describe('CampaignService campaign detail territory scope', () => {
    const LITTORAL_ONLY = { OR: [{ targetRegions: { isEmpty: true } }, { targetRegions: { has: 'Littoral' } }] };

    let prisma: any;
    let service: CampaignService;

    // Campaigns as stored: one for all regions, one for Centre only.
    const campaigns: Record<string, any> = {
        'c-all': { id: 'c-all', code: 'C1', purpose: 'COLLECTION', status: 'ACTIVE', targetRegions: [] },
        'c-centre': { id: 'c-centre', code: 'C2', purpose: 'COLLECTION', status: 'ACTIVE', targetRegions: ['Centre'] },
    };

    /** Evaluates the id + visibility where the service builds. */
    function findCampaign({ where }: any) {
        const c = campaigns[where.id];
        if (!c) return null;
        if (where.OR) {
            const region = where.OR[1].targetRegions.has;
            if (!(c.targetRegions.length === 0 || c.targetRegions.includes(region))) return null;
        }
        return { ...c, submissions: [], reminders: [] };
    }

    const regional = (region: string | null) => ({ id: 'u1', role: 'REGIONAL_ADMIN', region });
    const national = (role: string) => ({ id: 'u1', role });

    beforeEach(() => {
        prisma = {
            dataCampaign: {
                findUnique: jest.fn(async (args: any) => findCampaign(args)),
                findFirst: jest.fn(async (args: any) => findCampaign(args)),
            },
            campaignSubmission: {
                findMany: jest.fn(async () => []),
                groupBy: jest.fn(async () => []),
            },
            company: { findMany: jest.fn(async () => []) },
        };
        service = new CampaignService(prisma as unknown as PrismaService, {} as NotificationService);
    });

    describe('GET /campaigns/:id', () => {
        it('REGIONAL reads an all-regions campaign; embedded submissions are filtered to its region', async () => {
            await expect(service.getCampaign('c-all', regional('Littoral'))).resolves.toMatchObject({ id: 'c-all' });
            const args = prisma.dataCampaign.findUnique.mock.calls[0][0];
            expect(args.where).toEqual({ id: 'c-all', ...LITTORAL_ONLY });
            expect(args.include.submissions.where).toEqual({
                company: { region: { equals: 'Littoral', mode: 'insensitive' } },
            });
        });

        it('REGIONAL reading a campaign that targets other regions only gets 404', async () => {
            await expect(service.getCampaign('c-centre', regional('Littoral'))).rejects.toBeInstanceOf(NotFoundException);
        });

        it.each([null, '  '])('REGIONAL with region %p gets 404 without a query', async (region) => {
            await expect(service.getCampaign('c-all', regional(region))).rejects.toBeInstanceOf(NotFoundException);
            expect(prisma.dataCampaign.findUnique).not.toHaveBeenCalled();
        });

        it('a role outside the list rule (DIVISIONAL_ADMIN) gets 404', async () => {
            await expect(
                service.getCampaign('c-all', { id: 'u1', role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' }),
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it.each(['SUPER_ADMIN', 'ADMIN_ONEFOP'])('%s reads any campaign with unfiltered submissions', async (role) => {
            await expect(service.getCampaign('c-centre', national(role))).resolves.toMatchObject({ id: 'c-centre' });
            const args = prisma.dataCampaign.findUnique.mock.calls[0][0];
            expect(args.where).toEqual({ id: 'c-centre' });
            expect(args.include.submissions.where).toBeUndefined();
        });
    });

    describe('GET /campaigns/:id/submissions', () => {
        it('REGIONAL receives only rows whose company is in its region', async () => {
            await service.getCampaignSubmissions('c-all', {}, regional('Littoral'));
            expect(prisma.campaignSubmission.findMany.mock.calls[0][0].where).toEqual({
                campaignId: 'c-all',
                company: { region: { equals: 'Littoral', mode: 'insensitive' } },
            });
        });

        it('REGIONAL on a campaign outside its region gets 404 and no rows are read', async () => {
            await expect(service.getCampaignSubmissions('c-centre', {}, regional('Littoral')))
                .rejects.toBeInstanceOf(NotFoundException);
            expect(prisma.campaignSubmission.findMany).not.toHaveBeenCalled();
        });

        it('REGIONAL without a region gets 404 and no rows are read', async () => {
            await expect(service.getCampaignSubmissions('c-all', {}, regional(null)))
                .rejects.toBeInstanceOf(NotFoundException);
            expect(prisma.campaignSubmission.findMany).not.toHaveBeenCalled();
        });

        it.each(['SUPER_ADMIN', 'ADMIN_ONEFOP'])('%s receives every row, including null-company rows', async (role) => {
            await service.getCampaignSubmissions('c-centre', { status: 'PENDING' }, national(role));
            expect(prisma.campaignSubmission.findMany.mock.calls[0][0].where).toEqual({
                campaignId: 'c-centre',
                status: 'PENDING',
            });
        });
    });

    describe('GET /campaigns/:id/progress', () => {
        it('REGIONAL gets national counts for a visible campaign', async () => {
            await service.getCampaignProgress('c-all', regional('Littoral'));
            expect(prisma.campaignSubmission.groupBy.mock.calls[0][0].where).toEqual({ campaignId: 'c-all' });
        });

        it('REGIONAL gets 404 for a campaign outside its region', async () => {
            await expect(service.getCampaignProgress('c-centre', regional('Littoral')))
                .rejects.toBeInstanceOf(NotFoundException);
            expect(prisma.campaignSubmission.groupBy).not.toHaveBeenCalled();
        });

        it('a national role on an unknown campaign id gets 404', async () => {
            await expect(service.getCampaignProgress('c-missing', national('SUPER_ADMIN')))
                .rejects.toBeInstanceOf(NotFoundException);
        });
    });
});
