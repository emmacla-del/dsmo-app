import { computeOnefopFeatures } from './onefop-features.util';

function mockPrisma(submissions: Array<{ status: string; surveyYear: number; submissionDate: Date; rejectionReason?: string | null }>) {
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
      onefopRejectionReason: null,
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

  it('surfaces REJECTED as the display status and reason, without unlocking analytics — the dashboard used to silently show "not submitted" here', async () => {
    const prisma = mockPrisma([
      {
        status: 'REJECTED',
        surveyYear: 2026,
        submissionDate: new Date('2026-04-01'),
        rejectionReason: 'Numéro de téléphone invalide.',
      },
    ]);

    const features = await computeOnefopFeatures(prisma, 'company-1');

    expect(features.onefopSubmissionStatus).toBe('REJECTED');
    expect(features.onefopRejectionReason).toBe('Numéro de téléphone invalide.');
    expect(features.onefopBasicAnalytics).toBe(false);
    expect(features.onefopBenchmarking).toBe(false);
  });

  it('surfaces CORRECTION_REQUESTED the same way as REJECTED', async () => {
    const prisma = mockPrisma([
      {
        status: 'CORRECTION_REQUESTED',
        surveyYear: 2026,
        submissionDate: new Date('2026-04-01'),
        rejectionReason: 'Effectif total incohérent avec la répartition par genre.',
      },
    ]);

    const features = await computeOnefopFeatures(prisma, 'company-1');

    expect(features.onefopSubmissionStatus).toBe('CORRECTION_REQUESTED');
    expect(features.onefopRejectionReason).toBe('Effectif total incohérent avec la répartition par genre.');
  });

  it('never surfaces a rejection reason for a status other than REJECTED/CORRECTION_REQUESTED, even if one is somehow present in the row', async () => {
    const prisma = mockPrisma([
      { status: 'APPROVED', surveyYear: 2026, submissionDate: new Date('2026-04-01'), rejectionReason: 'stale leftover text' },
    ]);

    const features = await computeOnefopFeatures(prisma, 'company-1');
    expect(features.onefopRejectionReason).toBeNull();
  });

  it('shows the most recently created submission for display even when it is not the accepted one — e.g. a fresh DRAFT started after a REJECTED submission', async () => {
    // findMany is already ordered createdAt desc by the real query, so the
    // most-recent row is always index 0 — this mock mirrors that ordering.
    const prisma = mockPrisma([
      { status: 'DRAFT', surveyYear: 2026, submissionDate: new Date('2026-05-01') },
      { status: 'REJECTED', surveyYear: 2026, submissionDate: new Date('2026-04-01'), rejectionReason: 'Champs manquants.' },
    ]);

    const features = await computeOnefopFeatures(prisma, 'company-1');

    // Display reflects the newer DRAFT, not the older REJECTED row...
    expect(features.onefopSubmissionStatus).toBe('DRAFT');
    expect(features.onefopRejectionReason).toBeNull();
    // ...but onefopHasDraft still independently reports true either way.
    expect(features.onefopHasDraft).toBe(true);
  });

  it('scopes the query by companyId', async () => {
    const prisma = mockPrisma([]);
    await computeOnefopFeatures(prisma, 'company-42');

    expect(prisma.onefopSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'company-42' } }),
    );
  });
});
