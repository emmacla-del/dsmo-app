import { AnalyticsService } from './analytics.service';

// getCompanySummary (DSMO-Declaration-derived "My Situation" summary) was
// removed — see the comment above getCompanyBenchmarks in
// analytics.controller.ts for why. Its former test coverage went with it.
//
// getCompanyBenchmarks itself was switched from DSMO Declaration data to
// ONEFOP submission data — see the comment above it in analytics.service.ts
// for why (the onefopBenchmarking gate is ONEFOP-based, but DSMO is a
// separate, optional approval workflow that used to leave gate-cleared
// companies with NO_OWN_DATA despite having real data on file).

function submission(permanentWorkers: number, departures: number) {
    return {
        companyId: 'peer',
        enterpriseDetail: { permanentWorkers },
        cooperativeDetail: null,
        ctdDetail: null,
        ongDetail: null,
        departureData:
            departures > 0
                ? [
                    {
                        cspCategory: 'TOTAL',
                        departureType: 'ENSEMBLE',
                        gender: 'TOTAL',
                        value: departures,
                    },
                ]
                : [],
    };
}

describe('AnalyticsService.getCompanyBenchmarks', () => {
    it('reports NO_OWN_DATA — not a false 0th-percentile comparison — when the caller has no approved ONEFOP submission', async () => {
        const prisma = {
            company: {
                findUnique: jest
                    .fn()
                    .mockResolvedValue({ mainActivity: 'Tech', enterpriseSize: 'SMALL', region: 'Centre' }),
            },
            onefopSubmission: {
                findMany: jest.fn().mockResolvedValueOnce([]), // mySubmissions — empty
            },
        } as any;
        const service = new AnalyticsService(prisma);

        const result = await service.getCompanyBenchmarks('company-1', 2026, 'sector');

        expect(result).toEqual({
            available: false,
            reason: 'NO_OWN_DATA',
            peerCount: 0,
            minRequired: 5,
        });
        // Must not even query for peers once the caller's own data is missing.
        expect(prisma.onefopSubmission.findMany).toHaveBeenCalledTimes(1);
    });

    it('still reports INSUFFICIENT_DATA (not NO_OWN_DATA) when the caller has data but the peer group is too small', async () => {
        const prisma = {
            company: {
                findUnique: jest
                    .fn()
                    .mockResolvedValue({ mainActivity: 'Tech', enterpriseSize: 'SMALL', region: 'Centre' }),
            },
            onefopSubmission: {
                findMany: jest
                    .fn()
                    .mockResolvedValueOnce([submission(10, 1)]) // mySubmissions
                    .mockResolvedValueOnce([
                        { ...submission(8, 0), companyId: 'peer-1' },
                        { ...submission(12, 1), companyId: 'peer-2' },
                    ]), // only 2 distinct peer companies
            },
        } as any;
        const service = new AnalyticsService(prisma);

        const result = await service.getCompanyBenchmarks('company-1', 2026, 'sector');

        expect(result).toEqual({
            available: false,
            reason: 'INSUFFICIENT_DATA',
            peerCount: 2,
            minRequired: 5,
        });
    });

    it('returns a real percentile comparison once both the caller and ≥5 distinct peer companies have data', async () => {
        const peerSubmissions = [
            { ...submission(5, 1), companyId: 'peer-1' },
            { ...submission(10, 1), companyId: 'peer-2' },
            { ...submission(15, 3), companyId: 'peer-3' },
            { ...submission(20, 2), companyId: 'peer-4' },
            { ...submission(25, 5), companyId: 'peer-5' },
        ];
        const prisma = {
            company: {
                findUnique: jest
                    .fn()
                    .mockResolvedValue({ mainActivity: 'Tech', enterpriseSize: 'SMALL', region: 'Centre' }),
            },
            onefopSubmission: {
                findMany: jest
                    .fn()
                    .mockResolvedValueOnce([submission(12, 0)]) // mySubmissions
                    .mockResolvedValueOnce(peerSubmissions),
            },
        } as any;
        const service = new AnalyticsService(prisma);

        const result: any = await service.getCompanyBenchmarks('company-1', 2026, 'sector');

        expect(result.available).toBe(true);
        expect(result.peerCount).toBe(5);
        expect(result.metrics.totalEmployees.mine).toBe(12);
        expect(result.metrics.totalEmployees.median).toBe(15);
        expect(result.metrics.turnoverRate.mine).toBe(0);
    });

    it('sums departures across every approved submission for the year, but takes the workforce snapshot from only the most recent one', async () => {
        // Two quarters for the same company: an older one with a smaller
        // headcount and some departures, and a newer one (createdAt desc,
        // so submissions[0]) with the current headcount. Workforce must come
        // from the newer snapshot only; departures must sum across both.
        const prisma = {
            company: {
                findUnique: jest
                    .fn()
                    .mockResolvedValue({ mainActivity: 'Tech', enterpriseSize: 'SMALL', region: 'Centre' }),
            },
            onefopSubmission: {
                findMany: jest
                    .fn()
                    .mockResolvedValueOnce([
                        submission(20, 1), // newest (index 0) — snapshot source
                        submission(15, 2), // older — contributes only to departures
                    ])
                    .mockResolvedValueOnce([
                        { ...submission(8, 0), companyId: 'peer-1' },
                        { ...submission(9, 0), companyId: 'peer-2' },
                        { ...submission(10, 0), companyId: 'peer-3' },
                        { ...submission(11, 0), companyId: 'peer-4' },
                        { ...submission(12, 0), companyId: 'peer-5' },
                    ]),
            },
        } as any;
        const service = new AnalyticsService(prisma);

        const result: any = await service.getCompanyBenchmarks('company-1', 2026, 'sector');

        expect(result.metrics.totalEmployees.mine).toBe(20); // snapshot from newest only
        expect(result.metrics.turnoverRate.mine).toBe(15); // (1 + 2) / 20 * 100 = 15%
    });
});
