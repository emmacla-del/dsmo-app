import { computeOnefopFeatures } from './onefop-features.util';

function mockPrisma(submissions: Array<{ status: string; surveyYear: number; submissionDate: Date }>) {
  return {
    onefopSubmission: {
      findMany: jest.fn().mockResolvedValue(submissions),
    },
  } as any;
}

describe('computeOnefopFeatures', () => {
  it('returns everything false when the company has no submissions at all', async () => {
    const prisma = mockPrisma([]);
    const features = await computeOnefopFeatures(prisma, 'company-1');

    expect(features).toEqual({
      onefopBasicAnalytics: false,
      onefopBenchmarking: false,
      onefopSubmissionStatus: null,
      onefopSurveyYear: null,
      onefopSubmissionDate: null,
      onefopHasDraft: false,
    });
  });

  it('unlocks BOTH onefopBasicAnalytics and onefopBenchmarking on mere submission (PENDING_REVIEW) — companies get benchmarking value without waiting for a review cycle', async () => {
    const submissionDate = new Date('2026-04-01');
    const prisma = mockPrisma([
      { status: 'PENDING_REVIEW', surveyYear: 2026, submissionDate },
    ]);

    const features = await computeOnefopFeatures(prisma, 'company-1');

    expect(features.onefopBasicAnalytics).toBe(true);
    expect(features.onefopBenchmarking).toBe(true);
    expect(features.onefopSubmissionStatus).toBe('PENDING_REVIEW');
    expect(features.onefopSurveyYear).toBe(2026);
  });

  it('unlocks both flags once a submission is APPROVED', async () => {
    const prisma = mockPrisma([
      { status: 'APPROVED', surveyYear: 2026, submissionDate: new Date('2026-04-01') },
    ]);

    const features = await computeOnefopFeatures(prisma, 'company-1');

    expect(features.onefopBasicAnalytics).toBe(true);
    expect(features.onefopBenchmarking).toBe(true);
  });

  it('reports onefopHasDraft without unlocking either analytics flag', async () => {
    const prisma = mockPrisma([
      { status: 'DRAFT', surveyYear: 2026, submissionDate: new Date('2026-04-01') },
    ]);

    const features = await computeOnefopFeatures(prisma, 'company-1');

    expect(features.onefopHasDraft).toBe(true);
    expect(features.onefopBasicAnalytics).toBe(false);
    expect(features.onefopBenchmarking).toBe(false);
  });

  it('scopes the query by companyId', async () => {
    const prisma = mockPrisma([]);
    await computeOnefopFeatures(prisma, 'company-42');

    expect(prisma.onefopSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'company-42' } }),
    );
  });
});
