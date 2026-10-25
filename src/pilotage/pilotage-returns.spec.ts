import { OnefopStatus } from '@prisma/client';
import {
  addMetrics,
  buildMetrics,
  emptyMetrics,
  EntityTypeTally,
  isApprovedStatus,
  isReceivedStatus,
} from './pilotage-returns';

describe('pilotage-returns helpers', () => {
  describe('status checkers', () => {
    it('isReceivedStatus accepts PENDING_REVIEW, APPROVED, CORRECTION_REQUESTED', () => {
      expect(isReceivedStatus(OnefopStatus.PENDING_REVIEW)).toBe(true);
      expect(isReceivedStatus(OnefopStatus.APPROVED)).toBe(true);
      expect(isReceivedStatus(OnefopStatus.CORRECTION_REQUESTED)).toBe(true);
    });

    it('isReceivedStatus rejects DRAFT and REJECTED', () => {
      expect(isReceivedStatus(OnefopStatus.DRAFT)).toBe(false);
      expect(isReceivedStatus(OnefopStatus.REJECTED)).toBe(false);
    });

    it('isApprovedStatus accepts only APPROVED', () => {
      expect(isApprovedStatus(OnefopStatus.APPROVED)).toBe(true);
      expect(isApprovedStatus(OnefopStatus.PENDING_REVIEW)).toBe(false);
      expect(isApprovedStatus(OnefopStatus.CORRECTION_REQUESTED)).toBe(false);
      expect(isApprovedStatus(OnefopStatus.REJECTED)).toBe(false);
      expect(isApprovedStatus(OnefopStatus.DRAFT)).toBe(false);
    });
  });

  describe('buildMetrics', () => {
    it('computes metrics with gap, quotaRate, onTimeRate, and responseRate', () => {
      const metrics = buildMetrics(100, { received: 80, approved: 70, onTime: 60, late: 20 }, 200);
      expect(metrics).toEqual({
        quota: 100,
        received: 80,
        approved: 70,
        pendingReview: 0,
        correctionRequested: 0,
        onTime: 60,
        late: 20,
        gap: 20,
        quotaRate: 0.8,
        onTimeRate: 0.6,
        registeredStock: 200,
        responseRate: 0.4,
      });
    });

    it('handles gap when received exceeds quota', () => {
      const metrics = buildMetrics(50, { received: 60, approved: 50, onTime: 50, late: 10 }, 100);
      expect(metrics.gap).toBe(0);
      expect(metrics.quotaRate).toBe(1.2);
    });

    it('handles null quota and zero stock gracefully', () => {
      const metrics = buildMetrics(null, { received: 5, approved: 2, onTime: 4, late: 1 }, 0);
      expect(metrics.quota).toBeNull();
      expect(metrics.gap).toBeNull();
      expect(metrics.quotaRate).toBeNull();
      expect(metrics.onTimeRate).toBeNull();
      expect(metrics.registeredStock).toBe(0);
      expect(metrics.responseRate).toBeNull();
    });
  });

  describe('addMetrics', () => {
    it('sums metrics correctly across territories', () => {
      const a = buildMetrics(50, { received: 30, approved: 20, onTime: 25, late: 5 }, 100);
      const b = buildMetrics(50, { received: 40, approved: 35, onTime: 30, late: 10 }, 100);
      const combined = addMetrics(a, b);
      expect(combined).toEqual({
        quota: 100,
        received: 70,
        approved: 55,
        pendingReview: 0,
        correctionRequested: 0,
        onTime: 55,
        late: 15,
        gap: 30,
        quotaRate: 0.7,
        onTimeRate: 0.55,
        registeredStock: 200,
        responseRate: 0.35,
      });
    });

    it('adds when one side has null quota', () => {
      const a = buildMetrics(50, { received: 30, approved: 20, onTime: 25, late: 5 }, 100);
      const b = buildMetrics(null, { received: 10, approved: 5, onTime: 10, late: 0 }, 50);
      const combined = addMetrics(a, b);
      expect(combined.quota).toBe(50);
      expect(combined.received).toBe(40);
      expect(combined.registeredStock).toBe(150);
    });
  });

  describe('emptyMetrics', () => {
    it('returns initialized zeroed object', () => {
      expect(emptyMetrics()).toEqual({
        quota: null,
        received: 0,
        approved: 0,
        pendingReview: 0,
        correctionRequested: 0,
        onTime: 0,
        late: 0,
        gap: null,
        quotaRate: null,
        onTimeRate: null,
        registeredStock: 0,
        responseRate: null,
      });
    });
  });

  describe('EntityTypeTally', () => {
    it('sums only the buckets asked for', () => {
      const tally = new EntityTypeTally();
      tally.addStock('d:r1:d1', 'ENTREPRISE');
      tally.addStock('d:r2:d2', 'ENTREPRISE');
      tally.addReturn('d:r1:d1', 'ENTREPRISE', OnefopStatus.APPROVED, false);
      const entreprise = tally.rows(['d:r1:d1'], true).find((row) => row.entityType === 'ENTREPRISE');
      expect(entreprise).toEqual({
        entityType: 'ENTREPRISE', received: 1, approved: 1, pendingReview: 0, correctionRequested: 0,
        onTime: 1, late: 0, registeredStock: 1, responseRate: 1,
      });
    });

    it('lists a type outside the known order after it, only when it holds something', () => {
      const tally = new EntityTypeTally();
      tally.addStock('central', 'VOCATIONAL_TRAINING_CENTER');
      const rows = tally.rows(['central'], true);
      expect(rows).toHaveLength(8);
      expect(rows[7]).toMatchObject({ entityType: 'VOCATIONAL_TRAINING_CENTER', registeredStock: 1, responseRate: 0 });
      expect(new EntityTypeTally().rows([], true)).toHaveLength(7);
    });

    it('drops ADMINISTRATION outside national scope', () => {
      const rows = new EntityTypeTally().rows([], false);
      expect(rows.map((row) => row.entityType)).not.toContain('ADMINISTRATION');
      expect(rows).toHaveLength(6);
    });
  });
});
