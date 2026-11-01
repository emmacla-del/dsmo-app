import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AnomalyResolutionType, AnomalyStatus } from '@prisma/client';
import { QuestionnairesService } from './questionnaires.service';

/**
 * The coherence re-check of a pending file (CLAUDE.md §21, 2026-11-01): adds
 * the warnings the current rules raise and no row records, closes as
 * RULE_RECHECK the open coherence warnings whose figures now agree, and
 * touches nothing else.
 */
describe('QuestionnairesService — coherence re-check', () => {
  // 5 recruited (4 men, 1 woman) and 5 by diploma: the figures agree.
  const AGREE = {
    s22q01_total_male_total: 4, s22q01_total_female_total: 1, s22q01_total_total_total: 5,
    s22q03_workers_total_male_total: 4, s22q03_workers_total_female_total: 1, s22q03_workers_total_total_total: 5,
  };
  // 4 men recruited, 2 men by diploma: S22Q03 fires for men and total.
  const DISAGREE = {
    s22q01_total_male_total: 4, s22q01_total_total_total: 4,
    s22q03_workers_total_male_total: 2, s22q03_workers_total_total_total: 2,
  };

  const row = (over: Record<string, unknown>) => ({ id: 'a', ruleCode: 'S22Q03_DIPLOMA_MISMATCH', ruleFamily: 'COHERENCE', status: AnomalyStatus.OPEN, resolutionType: null, ...over });

  function setup(submission: Record<string, unknown>) {
    const tx = {
      onefopSubmission: {
        findUnique: jest.fn().mockResolvedValue({ id: 'sub-1', status: 'PENDING_REVIEW', formType: 'ENTREPRISE', revision: 7, archivedAt: null, anomalies: [], ...submission }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      onefopAnomaly: { createMany: jest.fn(), updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      onefopSubmission: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sub-1', status: submission.status ?? 'PENDING_REVIEW', revision: 7, archivedAt: null }),
        findMany: jest.fn().mockResolvedValue([{ id: 'sub-1' }]),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const service = new QuestionnairesService(prisma as any);
    return { service, tx, prisma };
  }
  const admin = { role: 'ADMIN_ONEFOP' } as any;

  it('closes a stored warning whose figures now agree, as RULE_RECHECK, and moves the revision', async () => {
    const { service, tx } = setup({ rawData: AGREE, anomalies: [row({ id: 'stale-m' }), row({ id: 'stale-t' })] });
    await expect(service.recheckCoherence('sub-1', 'user-1', admin)).resolves.toEqual({ added: 0, closed: 2 });
    expect(tx.onefopAnomaly.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ['stale-m', 'stale-t'] }, status: AnomalyStatus.OPEN }),
      data: expect.objectContaining({ status: AnomalyStatus.RESOLVED, resolutionType: AnomalyResolutionType.RULE_RECHECK, resolvedById: null }),
    }));
    expect(tx.onefopSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'sub-1', revision: 7, status: 'PENDING_REVIEW' }),
      data: expect.objectContaining({ revision: { increment: 1 }, flags: [] }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'COHERENCE_RECHECKED', userId: 'user-1' }),
    }));
    expect(tx.onefopAnomaly.createMany).not.toHaveBeenCalled();
  });

  it('records a gap no row reports, as an open, non-blocking warning', async () => {
    const { service, tx } = setup({ rawData: DISAGREE });
    const result = await service.recheckCoherence('sub-1', 'user-1', admin);
    expect(result.added).toBe(2);
    const data = tx.onefopAnomaly.createMany.mock.calls[0][0].data;
    expect(data.every((a: any) => a.ruleCode === 'S22Q03_DIPLOMA_MISMATCH' && a.isBlocking === false && a.status === AnomalyStatus.OPEN)).toBe(true);
  });

  it('never re-adds a rule a reviewer has explained, and changes nothing when nothing is due', async () => {
    const explained = row({ status: AnomalyStatus.RESOLVED, resolutionType: AnomalyResolutionType.REVIEWER_EXPLANATION });
    const { service, tx } = setup({ rawData: DISAGREE, anomalies: [explained] });
    await expect(service.recheckCoherence('sub-1', 'user-1', admin)).resolves.toEqual({ added: 0, closed: 0 });
    expect(tx.onefopSubmission.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('adds a gap again after an earlier re-check closed its rule', async () => {
    const closed = row({ status: AnomalyStatus.RESOLVED, resolutionType: AnomalyResolutionType.RULE_RECHECK });
    const { service } = setup({ rawData: DISAGREE, anomalies: [closed] });
    await expect(service.recheckCoherence('sub-1', 'user-1', admin)).resolves.toEqual({ added: 2, closed: 0 });
  });

  it('never touches a blocking or completeness anomaly', async () => {
    const blocking = row({ id: 'b', ruleCode: 'MANDATORY_FIELD_MISSING', ruleFamily: 'COMPLETENESS' });
    const { service, tx } = setup({ rawData: AGREE, anomalies: [blocking] });
    await expect(service.recheckCoherence('sub-1', 'user-1', admin)).resolves.toEqual({ added: 0, closed: 0 });
    expect(tx.onefopAnomaly.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a file that is not awaiting review', async () => {
    const { service } = setup({ status: 'APPROVED', rawData: AGREE });
    await expect(service.recheckCoherence('sub-1', 'user-1', admin)).rejects.toThrow(BadRequestException);
  });

  it('refuses when the file changed under it, and writes nothing else', async () => {
    const { service, tx } = setup({ rawData: AGREE, anomalies: [row({ id: 'stale' })] });
    tx.onefopSubmission.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.recheckCoherence('sub-1', 'user-1', admin)).rejects.toThrow(ConflictException);
    expect(tx.onefopAnomaly.updateMany).not.toHaveBeenCalled();
  });

  it('re-checks every pending file for a national admin only', async () => {
    const { service } = setup({ rawData: AGREE, anomalies: [row({ id: 'stale' })] });
    await expect(service.recheckPendingCoherence('user-1', { role: 'REGIONAL_ADMIN', region: 'Littoral' } as any))
      .rejects.toThrow(ForbiddenException);
    await expect(service.recheckPendingCoherence('user-1', admin))
      .resolves.toEqual({ files: 1, changed: 1, added: 0, closed: 1, failed: 0 });
  });
});
