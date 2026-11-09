import { ConflictException } from '@nestjs/common';
import { AuthService, REGISTRATION_CLAIM_LAPSED, REGISTRATION_NOT_CLAIMED } from '../auth/auth.service';
import { registrationClaimState } from '../auth/registration-claim-policy';
import { QuestionnairesService } from '../questionnaires/questionnaires.service';
import { getEffectiveClaimState } from '../questionnaires/review-claim-policy';
import { ClaimExpiryScheduler } from './claim-expiry.scheduler';

// Claim deadlines (owner, CLAUDE.md §21, 2026-11-09): 2 hours for a
// registration, 12 hours for a submission, fixed from the claim, round the
// clock. A lapsed claim is released and the miss recorded against its holder.

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-11-09T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

function prismaMock() {
  const prisma: any = {
    user: { findMany: jest.fn(async () => []), updateMany: jest.fn(async () => ({ count: 1 })) },
    onefopSubmission: { findMany: jest.fn(async () => []), updateMany: jest.fn(async () => ({ count: 1 })) },
    auditLog: { create: jest.fn(async () => ({})) },
  };
  prisma.$transaction = jest.fn(async (fn: (tx: any) => unknown) => fn(prisma));
  return prisma;
}

describe('registration claim deadline', () => {
  it('holds for 2 hours from the claim, then the file is free', () => {
    const held = { status: 'PENDING_APPROVAL', assigneeId: 'officer-1' };
    expect(registrationClaimState({ ...held, registrationClaimedAt: ago(2 * HOUR - 1) }, NOW)).toEqual({
      assigneeId: 'officer-1',
      expired: false,
      expiresAt: new Date(NOW.getTime() + 1),
    });
    expect(registrationClaimState({ ...held, registrationClaimedAt: ago(2 * HOUR) }, NOW)).toMatchObject({
      assigneeId: null,
      expired: true,
    });
  });

  it('runs no clock on a file waiting for the declarant, a free file, or a file decided', () => {
    const old = ago(30 * HOUR);
    expect(registrationClaimState({ status: 'COMPLEMENTS_REQUESTED', assigneeId: 'o', registrationClaimedAt: old }, NOW).expired).toBe(false);
    expect(registrationClaimState({ status: 'ACTIVE', assigneeId: 'o', registrationClaimedAt: old }, NOW).assigneeId).toBe('o');
    expect(registrationClaimState({ status: 'PENDING_APPROVAL', assigneeId: null, registrationClaimedAt: old }, NOW)).toEqual({
      assigneeId: null,
      expired: false,
      expiresAt: null,
    });
  });

  it('refuses a decision by the holder whose claim lapsed, and treats a colleague\'s lapsed claim as free', () => {
    const auth = new AuthService(prismaMock(), {} as any, {} as any, {} as any, {} as any) as any;
    const company = { updatedAt: new Date() };
    // The guard reads the clock itself, so these times are relative to now.
    const before = (ms: number) => new Date(Date.now() - ms);
    const lapsed = { status: 'PENDING_APPROVAL', assigneeId: 'officer-1', registrationClaimedAt: before(3 * HOUR) };
    expect(() => auth.assertRegistrationDecidable(lapsed, company, 'officer-1')).toThrow(new ConflictException(REGISTRATION_CLAIM_LAPSED));
    expect(() => auth.assertRegistrationDecidable(lapsed, company, 'officer-2')).toThrow(new ConflictException(REGISTRATION_NOT_CLAIMED));
    const live = { ...lapsed, registrationClaimedAt: before(HOUR) };
    expect(() => auth.assertRegistrationDecidable(live, company, 'officer-1')).not.toThrow();
  });

  it('the sweep releases each lapsed claim once and records the miss against its holder', async () => {
    const prisma = prismaMock();
    const claimedAt = ago(5 * HOUR);
    prisma.user.findMany.mockResolvedValue([
      { id: 'reg-1', status: 'PENDING_APPROVAL', assigneeId: 'officer-1', registrationClaimedAt: claimedAt },
      { id: 'reg-2', status: 'PENDING_APPROVAL', assigneeId: 'officer-2', registrationClaimedAt: claimedAt },
    ]);
    // reg-2 was claimed again or decided in between: its conditional release misses.
    prisma.user.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const auth = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);

    await expect(auth.expireRegistrationClaims(NOW)).resolves.toBe(1);

    const query = prisma.user.findMany.mock.calls[0][0];
    expect(query.where).toMatchObject({ role: 'COMPANY', status: 'PENDING_APPROVAL', assigneeId: { not: null } });
    expect(query.where.registrationClaimedAt.lte).toEqual(ago(2 * HOUR));
    expect(prisma.user.updateMany.mock.calls[0][0]).toEqual({
      where: { id: 'reg-1', status: 'PENDING_APPROVAL', assigneeId: 'officer-1', registrationClaimedAt: claimedAt },
      data: { assigneeId: null, registrationClaimedAt: null },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      userId: 'officer-1',
      action: 'REGISTRATION_CLAIM_EXPIRED',
      resourceType: 'User',
      resourceId: 'reg-1',
      details: { previousAssigneeId: 'officer-1', reason: 'DEADLINE' },
    });
  });
});

describe('submission claim deadline', () => {
  it('is 12 hours from the claim', () => {
    const base = { id: 's', status: 'PENDING_REVIEW', assigneeId: 'officer-1', archivedAt: null };
    expect(getEffectiveClaimState({ ...base, claimActivityAt: ago(12 * HOUR - 1) }, NOW).expired).toBe(false);
    expect(getEffectiveClaimState({ ...base, claimActivityAt: ago(12 * HOUR) }, NOW).expired).toBe(true);
  });

  it('the sweep releases lapsed claims at their revision and records each miss', async () => {
    const prisma = prismaMock();
    const claimedAt = ago(13 * HOUR);
    prisma.onefopSubmission.findMany.mockResolvedValue([
      { id: 'sub-1', status: 'PENDING_REVIEW', assigneeId: 'officer-1', claimActivityAt: claimedAt, revision: 4 },
    ]);
    const service = new QuestionnairesService(prisma);

    await expect(service.expireReviewClaims(NOW)).resolves.toBe(1);

    expect(prisma.onefopSubmission.findMany.mock.calls[0][0].where.claimActivityAt.lte).toEqual(ago(12 * HOUR));
    expect(prisma.onefopSubmission.updateMany.mock.calls[0][0]).toEqual({
      where: { id: 'sub-1', status: 'PENDING_REVIEW', assigneeId: 'officer-1', claimActivityAt: claimedAt, revision: 4, archivedAt: null },
      data: { assigneeId: null, claimActivityAt: null, revision: { increment: 1 }, updatedAt: NOW },
    });
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      userId: 'officer-1',
      action: 'DOSSIER_CLAIM_EXPIRED',
      resourceId: 'sub-1',
      details: { previousAssigneeId: 'officer-1', reason: 'DEADLINE' },
    });
  });
});

describe('ClaimExpiryScheduler', () => {
  it('runs both sweeps one after the other, and one failing does not stop the other', async () => {
    const order: string[] = [];
    const auth = { expireRegistrationClaims: jest.fn(async () => { order.push('registrations'); throw new Error('pool'); }) };
    const questionnaires = { expireReviewClaims: jest.fn(async () => { order.push('submissions'); return 2; }) };
    const scheduler = new ClaimExpiryScheduler(auth as any, questionnaires as any);

    await expect(scheduler.sweep(NOW)).resolves.toEqual({ registrations: 0, submissions: 2 });
    expect(order).toEqual(['registrations', 'submissions']);
  });
});
