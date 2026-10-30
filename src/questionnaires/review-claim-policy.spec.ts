import { OnefopStatus } from '@prisma/client';
import { claimInactivityMs, getEffectiveClaimState } from './review-claim-policy';

describe('review claim activity policy', () => {
  const now = new Date('2026-10-29T12:00:00.000Z');

  function reader(event: any) {
    return { auditLog: { findFirst: jest.fn(async () => event) } } as any;
  }

  it('uses the configured inactivity window and defaults to twelve hours', () => {
    expect(claimInactivityMs({})).toBe(12 * 60 * 60 * 1000);
    expect(claimInactivityMs({ ONEFOP_REVIEW_CLAIM_INACTIVITY_HOURS: '6' })).toBe(6 * 60 * 60 * 1000);
    expect(claimInactivityMs({ ONEFOP_REVIEW_CLAIM_INACTIVITY_HOURS: '0' })).toBe(12 * 60 * 60 * 1000);
  });

  it('claims only PENDING_REVIEW and CORRECTION_REQUESTED and excludes archived records', async () => {
    for (const status of [OnefopStatus.PENDING_REVIEW, OnefopStatus.CORRECTION_REQUESTED]) {
      const state = await getEffectiveClaimState(reader(null), { id: 'sub-1', status, assigneeId: null }, now);
      expect(state.eligible).toBe(true);
      expect(state.assigneeId).toBeNull();
    }
    for (const status of [OnefopStatus.DRAFT, OnefopStatus.APPROVED, OnefopStatus.REJECTED, OnefopStatus.SUPERSEDED]) {
      const state = await getEffectiveClaimState(reader(null), { id: 'sub-1', status, assigneeId: null }, now);
      expect(state.eligible).toBe(false);
    }
    const archived = await getEffectiveClaimState(reader(null), {
      id: 'sub-1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'agent-1', archivedAt: new Date(),
    }, now);
    expect(archived).toMatchObject({ eligible: false, assigneeId: null });
  });

  it('calculates expiry from the latest persisted claim activity, never updatedAt', async () => {
    const lastActivityAt = new Date(now.getTime() - 11 * 60 * 60 * 1000);
    const findFirst = jest.fn(async (_args: any) => ({
      action: 'DOSSIER_ASSIGNED', userId: 'agent-1', timestamp: lastActivityAt, details: { assigneeId: 'agent-1' },
    }));
    const state = await getEffectiveClaimState(
      { auditLog: { findFirst } } as any,
      { id: 'sub-1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'agent-1', updatedAt: new Date(0) },
      now,
    );
    expect(state).toMatchObject({
      eligible: true,
      assigneeId: 'agent-1',
      expired: false,
      activityTracked: true,
      lastActivityAt,
      expiresAt: new Date(lastActivityAt.getTime() + 12 * 60 * 60 * 1000),
    });
    expect(findFirst.mock.calls[0][0]).toMatchObject({
      where: { resourceType: 'OnefopSubmission', resourceId: 'sub-1' },
      orderBy: { timestamp: 'desc' },
    });
  });

  it('resets inactivity from a saved progress note and treats a twelve-hour claim as expired', async () => {
    const progressAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const active = await getEffectiveClaimState(reader({
      action: 'DOSSIER_REVIEW_PROGRESS_SAVED', userId: 'agent-1', timestamp: progressAt,
      details: { ownerId: 'agent-1', progressType: 'NOTE' },
    }), { id: 'sub-1', status: OnefopStatus.CORRECTION_REQUESTED, assigneeId: 'agent-1' }, now);
    expect(active.lastActivityAt).toEqual(progressAt);
    expect(active.expired).toBe(false);

    const expiredAt = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const expired = await getEffectiveClaimState(reader({
      action: 'DOSSIER_ASSIGNED', userId: 'agent-1', timestamp: expiredAt, details: { assigneeId: 'agent-1' },
    }), { id: 'sub-1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'agent-1' }, now);
    expect(expired).toMatchObject({ eligible: true, assigneeId: null, expired: true, activityTracked: true });
  });

  it('does not expire legacy assignments with no matching activity-ledger event', async () => {
    const state = await getEffectiveClaimState(reader(null), {
      id: 'legacy-sub', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'legacy-agent', updatedAt: new Date(0),
    }, now);
    expect(state).toMatchObject({ assigneeId: 'legacy-agent', expired: false, activityTracked: false, expiresAt: null });
  });
});
