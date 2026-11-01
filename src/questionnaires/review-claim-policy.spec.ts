import { OnefopStatus } from '@prisma/client';
import {
  claimActivityCutoff,
  claimInactivityMs,
  getEffectiveClaimState,
  getEffectiveClaimStatesBatch,
} from './review-claim-policy';

describe('review claim activity policy', () => {
  const now = new Date('2026-10-29T12:00:00.000Z');

  it('uses the configured inactivity window and defaults to twelve hours', () => {
    expect(claimInactivityMs({})).toBe(12 * 60 * 60 * 1000);
    expect(claimInactivityMs({ ONEFOP_REVIEW_CLAIM_INACTIVITY_HOURS: '6' })).toBe(6 * 60 * 60 * 1000);
    expect(claimInactivityMs({ ONEFOP_REVIEW_CLAIM_INACTIVITY_HOURS: '0' })).toBe(12 * 60 * 60 * 1000);
    expect(claimActivityCutoff(now)).toEqual(new Date('2026-10-29T00:00:00.000Z'));
  });

  it('claims only PENDING_REVIEW and CORRECTION_REQUESTED and excludes archived records', () => {
    for (const status of [OnefopStatus.PENDING_REVIEW, OnefopStatus.CORRECTION_REQUESTED]) {
      const state = getEffectiveClaimState({ id: 'sub-1', status, assigneeId: null }, now);
      expect(state).toMatchObject({ eligible: true, assigneeId: null });
    }
    for (const status of [OnefopStatus.DRAFT, OnefopStatus.APPROVED, OnefopStatus.REJECTED, OnefopStatus.SUPERSEDED]) {
      const state = getEffectiveClaimState({ id: 'sub-1', status, assigneeId: 'agent-1' }, now);
      expect(state).toMatchObject({ eligible: false, assigneeId: null, expired: false });
    }
    const archived = getEffectiveClaimState({
      id: 'sub-1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'agent-1', archivedAt: new Date(),
    }, now);
    expect(archived).toMatchObject({ eligible: false, assigneeId: null });
  });

  it('expires exactly at the configured activity boundary, independent of updatedAt', () => {
    const activityAt = new Date(now.getTime() - 11 * 60 * 60 * 1000);
    const active = getEffectiveClaimState({
      id: 'sub-1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'agent-1', claimActivityAt: activityAt,
    }, now);
    expect(active).toMatchObject({
      eligible: true,
      assigneeId: 'agent-1',
      expired: false,
      activityTracked: true,
      lastActivityAt: activityAt,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    });

    const expiredAt = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const expired = getEffectiveClaimState({
      id: 'sub-1', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'agent-1', claimActivityAt: expiredAt,
    }, now);
    expect(expired).toMatchObject({ eligible: true, assigneeId: null, expired: true, activityTracked: true });
  });

  it('keeps legacy claims with unknown or mismatched event history active and untracked when backfill leaves NULL', () => {
    const state = getEffectiveClaimState({
      id: 'legacy-sub', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'legacy-agent', claimActivityAt: null,
    }, now);
    expect(state).toMatchObject({
      assigneeId: 'legacy-agent', expired: false, activityTracked: false, lastActivityAt: null, expiresAt: null,
    });
  });

  it('batch-projects active, expired, legacy, unassigned and non-claimable states without reading the audit table', () => {
    const activeAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const expiredAt = new Date(now.getTime() - 14 * 60 * 60 * 1000);
    const states = getEffectiveClaimStatesBatch([
      { id: 'sub-active', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'agent-1', claimActivityAt: activeAt },
      { id: 'sub-expired', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'agent-2', claimActivityAt: expiredAt },
      { id: 'sub-legacy', status: OnefopStatus.PENDING_REVIEW, assigneeId: 'agent-legacy', claimActivityAt: null },
      { id: 'sub-unassigned', status: OnefopStatus.PENDING_REVIEW, assigneeId: null, claimActivityAt: null },
      { id: 'sub-approved', status: OnefopStatus.APPROVED, assigneeId: 'agent-3', claimActivityAt: activeAt },
    ], now);

    expect(states.get('sub-active')).toMatchObject({
      eligible: true, assigneeId: 'agent-1', expired: false, activityTracked: true, lastActivityAt: activeAt,
    });
    expect(states.get('sub-expired')).toMatchObject({
      eligible: true, assigneeId: null, expired: true, activityTracked: true, lastActivityAt: expiredAt,
    });
    expect(states.get('sub-legacy')).toMatchObject({
      eligible: true, assigneeId: 'agent-legacy', expired: false, activityTracked: false,
    });
    expect(states.get('sub-unassigned')).toMatchObject({
      eligible: true, assigneeId: null, expired: false, activityTracked: false,
    });
    expect(states.get('sub-approved')).toMatchObject({
      eligible: false, assigneeId: null, expired: false, activityTracked: false,
    });
  });
});
