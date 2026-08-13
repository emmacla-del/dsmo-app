import { NotFoundException } from '@nestjs/common';
import { BilanService } from './bilan.service';

function baseSubmission(overrides: Partial<any> = {}) {
  return {
    submissionId: 'sub-default',
    formType: 'ENTREPRISE',
    enterpriseDetail: { permanentWorkers: 0, vacancies: 0 },
    cooperativeDetail: null,
    ctdDetail: null,
    ongDetail: null,
    cspGenderAge: [],
    departureData: [],
    vulnerableData: [],
    disabilityData: [],
    firstTimeWorkers: [],
    internshipData: [],
    skillNeeds: [],
    trainingNeeds: [],
    dismissalReasons: [],
    ...overrides,
  };
}

function recruitmentRow(value: number, gender: 'MALE' | 'FEMALE' | 'TOTAL' = 'TOTAL') {
  return {
    tableName: 's22q01',
    cspCategory: 'TOTAL',
    gender,
    ageBand: 'TOTAL',
    value,
  };
}

describe('BilanService.getBilan', () => {
  it('throws NotFoundException when the company has no approved ONEFOP submission for the year', async () => {
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue({ id: 'company-1' }) },
      onefopSubmission: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const service = new BilanService(prisma);

    await expect(service.getBilan('user-1', 2026)).rejects.toThrow(NotFoundException);
  });

  it('uses a single submission as-is (quarterCount = 1) when only one quarter is approved', async () => {
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue({ id: 'company-1' }) },
      onefopSubmission: {
        findMany: jest.fn().mockResolvedValue([
          baseSubmission({
            submissionId: 'sub-q1',
            enterpriseDetail: { permanentWorkers: 50, vacancies: 5 },
            cspGenderAge: [recruitmentRow(3)],
          }),
        ]),
      },
    } as any;
    const service = new BilanService(prisma);

    const result = await service.getBilan('user-1', 2026);

    expect(result.quarterCount).toBe(1);
    expect(result.permanentWorkers).toBe(50);
    expect(result.recruitments.combined.total.total).toBe(3);
  });

  it('sums flow metrics (recruitments) across every approved quarter, but uses only the latest snapshot for stock metrics (permanentWorkers)', async () => {
    // findMany is ordered createdAt desc, so index 0 is "latest" per the
    // service's own contract — this fixture puts the most recently
    // approved quarter (Q3) first, matching that ordering.
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue({ id: 'company-1' }) },
      onefopSubmission: {
        findMany: jest.fn().mockResolvedValue([
          baseSubmission({
            submissionId: 'sub-q3',
            enterpriseDetail: { permanentWorkers: 80, vacancies: 2 }, // latest snapshot
            cspGenderAge: [recruitmentRow(4)],
          }),
          baseSubmission({
            submissionId: 'sub-q2',
            enterpriseDetail: { permanentWorkers: 70, vacancies: 3 },
            cspGenderAge: [recruitmentRow(5)],
          }),
          baseSubmission({
            submissionId: 'sub-q1',
            enterpriseDetail: { permanentWorkers: 60, vacancies: 1 },
            cspGenderAge: [recruitmentRow(6)],
          }),
        ]),
      },
    } as any;
    const service = new BilanService(prisma);

    const result = await service.getBilan('user-1', 2026);

    expect(result.quarterCount).toBe(3);
    // Stock metric: latest quarter's snapshot only, not summed across all three.
    expect(result.permanentWorkers).toBe(80);
    expect(result.vacancies).toBe(2);
    expect(result.submissionId).toBe('sub-q3');
    // Flow metric: summed across all three approved quarters (4 + 5 + 6).
    expect(result.recruitments.combined.total.total).toBe(15);
  });

  it('merges skill needs mentioned in multiple quarters into one row with a combined count, instead of listing duplicates', async () => {
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue({ id: 'company-1' }) },
      onefopSubmission: {
        findMany: jest.fn().mockResolvedValue([
          baseSubmission({
            submissionId: 'sub-q2',
            skillNeeds: [{ skillIndex: 1, skillDescription: 'Comptabilité', totalCount: 2 }],
          }),
          baseSubmission({
            submissionId: 'sub-q1',
            skillNeeds: [{ skillIndex: 1, skillDescription: 'comptabilité', totalCount: 3 }],
          }),
        ]),
      },
    } as any;
    const service = new BilanService(prisma);

    const result = await service.getBilan('user-1', 2026);

    expect(result.skillNeeds).toHaveLength(1);
    expect(result.skillNeeds[0].totalCount).toBe(5);
  });
});
