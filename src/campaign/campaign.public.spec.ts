import { CampaignService } from './campaign.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../dsmo/notification.service';

// listOpenCampaignsForPublic() answers an unauthenticated route, so two things
// matter beyond "does it work": what it refuses to return, and that it cannot
// advertise a collection that has already stopped accepting submissions.

describe('CampaignService - the public campaign feed', () => {
    let service: CampaignService;
    let findMany: jest.Mock;

    const DAY = 24 * 60 * 60 * 1000;

    beforeEach(() => {
        findMany = jest.fn();
        const prisma = { dataCampaign: { findMany } };
        service = new CampaignService(
            prisma as unknown as PrismaService,
            {} as NotificationService,
        );
    });

    it('asks only for ACTIVE campaigns, and only for publishable columns', async () => {
        findMany.mockResolvedValue([]);

        await service.listOpenCampaignsForPublic();

        const [args] = findMany.mock.calls[0];
        expect(args.where).toEqual({ status: 'ACTIVE' });
        // The guarantee the controller's comment makes: no id, no code, no
        // name or description, and nothing about who is being targeted.
        expect(Object.keys(args.select).sort()).toEqual(
            ['collectionType', 'deadline', 'extendedDeadline', 'referenceYear'].sort(),
        );
    });

    it('returns an open campaign with its effective closing date', async () => {
        const deadline = new Date(Date.now() + 30 * DAY);
        findMany.mockResolvedValue([
            { collectionType: 'DSMO', referenceYear: 2025, deadline, extendedDeadline: null },
        ]);

        expect(await service.listOpenCampaignsForPublic()).toEqual([
            { collectionType: 'DSMO', referenceYear: 2025, closesOn: deadline },
        ]);
    });

    it('prefers an extension over the original deadline', async () => {
        const deadline = new Date(Date.now() - 2 * DAY);
        const extendedDeadline = new Date(Date.now() + 10 * DAY);
        findMany.mockResolvedValue([
            { collectionType: 'ONEFOP', referenceYear: 2026, deadline, extendedDeadline },
        ]);

        // Past its first deadline, but extended: still open, and the date the
        // portal shows is the one that now applies.
        expect(await service.listOpenCampaignsForPublic()).toEqual([
            { collectionType: 'ONEFOP', referenceYear: 2026, closesOn: extendedDeadline },
        ]);
    });

    it('drops a campaign whose effective deadline has passed', async () => {
        findMany.mockResolvedValue([
            {
                collectionType: 'DSMO',
                referenceYear: 2024,
                deadline: new Date(Date.now() - 10 * DAY),
                extendedDeadline: null,
            },
            {
                collectionType: 'ONEFOP',
                referenceYear: 2024,
                deadline: new Date(Date.now() - 30 * DAY),
                extendedDeadline: new Date(Date.now() - DAY),
            },
        ]);

        // Still ACTIVE in the database — the scheduler closes them later — but
        // neither may tell the public it is open.
        expect(await service.listOpenCampaignsForPublic()).toEqual([]);
    });

    it('keeps a campaign that has no deadline at all', async () => {
        findMany.mockResolvedValue([
            { collectionType: 'ONEFOP', referenceYear: 2026, deadline: null, extendedDeadline: null },
        ]);

        // Open-ended: the portal says the collection is open and names no date.
        expect(await service.listOpenCampaignsForPublic()).toEqual([
            { collectionType: 'ONEFOP', referenceYear: 2026, closesOn: null },
        ]);
    });
});
