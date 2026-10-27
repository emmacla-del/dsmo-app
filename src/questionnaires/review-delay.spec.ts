import { REVIEW_DELAY_THRESHOLD_DAYS, reviewOverdueBefore } from './review-delay';

describe('reviewOverdueBefore', () => {
  it('uses the same seven-day threshold as the pilotage review-delay queue', () => {
    const now = new Date('2026-10-27T12:00:00.000Z');
    expect(REVIEW_DELAY_THRESHOLD_DAYS).toBe(7);
    expect(reviewOverdueBefore(now).toISOString()).toBe('2026-10-20T12:00:00.000Z');
  });

  it('does not mutate the instant it is given', () => {
    const now = new Date('2026-10-27T12:00:00.000Z');
    reviewOverdueBefore(now);
    expect(now.toISOString()).toBe('2026-10-27T12:00:00.000Z');
  });
});
