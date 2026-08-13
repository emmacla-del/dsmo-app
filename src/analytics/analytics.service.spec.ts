import { AnalyticsService } from './analytics.service';

// getCompanySummary (DSMO-Declaration-derived "My Situation" summary) was
// removed — see the comment above getCompanyBenchmarks in
// analytics.controller.ts for why. Its former test coverage went with it;
// getCompanyBenchmarks below still reads the same Declaration data and
// keeps its own coverage.

function employee(gender: 'M' | 'F') {
  return { gender, salaryCategory: null };
}

describe('AnalyticsService.getCompanyBenchmarks', () => {
  function peerDeclaration(employeeCount: number, femaleCount: number) {
    const employees = [
      ...Array(femaleCount).fill(employee('F')),
      ...Array(employeeCount - femaleCount).fill(employee('M')),
    ];
    return { employees, company: {} };
  }

  it('reports NO_OWN_DATA — not a false 0th-percentile comparison — when the caller has no approved declaration', async () => {
    const prisma = {
      company: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ mainActivity: 'Tech', enterpriseSize: 'SMALL', region: 'Centre' }),
      },
      declaration: {
        findMany: jest.fn().mockResolvedValueOnce([]), // myDeclarations — empty
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
    expect(prisma.declaration.findMany).toHaveBeenCalledTimes(1);
  });

  it('still reports INSUFFICIENT_DATA (not NO_OWN_DATA) when the caller has data but the peer group is too small', async () => {
    const prisma = {
      company: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ mainActivity: 'Tech', enterpriseSize: 'SMALL', region: 'Centre' }),
      },
      declaration: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ employees: [employee('M')] }]) // myDeclarations
          .mockResolvedValueOnce([peerDeclaration(3, 1), peerDeclaration(4, 2)]), // only 2 peers
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

  it('returns a real percentile comparison once both the caller and ≥5 peers have data', async () => {
    const peers = [
      peerDeclaration(5, 1),
      peerDeclaration(10, 2),
      peerDeclaration(15, 3),
      peerDeclaration(20, 4),
      peerDeclaration(25, 5),
    ];
    const prisma = {
      company: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ mainActivity: 'Tech', enterpriseSize: 'SMALL', region: 'Centre' }),
      },
      declaration: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ employees: Array(12).fill(employee('F')) }]) // myDeclarations
          .mockResolvedValueOnce(peers),
      },
    } as any;
    const service = new AnalyticsService(prisma);

    const result: any = await service.getCompanyBenchmarks('company-1', 2026, 'sector');

    expect(result.available).toBe(true);
    expect(result.peerCount).toBe(5);
    expect(result.metrics.totalEmployees.mine).toBe(12);
    expect(result.metrics.totalEmployees.median).toBe(15);
  });
});
