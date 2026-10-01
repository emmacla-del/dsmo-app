import { computeDoualaEndOfDay } from './douala-deadline';

describe('computeDoualaEndOfDay', () => {
  it('interprets a date as 23:59:59 Africa/Douala (+01:00)', () => {
    // 2026-09-30 at midday UTC
    const date = new Date('2026-09-30T12:00:00.000Z');
    const endOfDay = computeDoualaEndOfDay(date);

    // In Africa/Douala (+01:00), end of day 2026-09-30 is 2026-09-30T23:59:59+01:00
    // In UTC, that is 2026-09-30T22:59:59.000Z
    expect(endOfDay.toISOString()).toBe('2026-09-30T22:59:59.000Z');
  });

  it('determines lateness correctly against the Douala end-of-day boundary', () => {
    const deadline = new Date('2026-09-30T00:00:00.000Z');
    const endOfDay = computeDoualaEndOfDay(deadline);

    // On-time submission: 2026-09-30 23:59:58 Douala (+01:00) = 22:59:58Z
    const onTime = new Date('2026-09-30T22:59:58.000Z');
    expect(onTime.getTime() > endOfDay.getTime()).toBe(false);

    // Exact boundary: 2026-09-30 23:59:59 Douala (+01:00) = 22:59:59Z
    const exact = new Date('2026-09-30T22:59:59.000Z');
    expect(exact.getTime() > endOfDay.getTime()).toBe(false);

    // Late submission: 2026-10-01 00:00:00 Douala (+01:00) = 23:00:00Z
    const late = new Date('2026-09-30T23:00:00.000Z');
    expect(late.getTime() > endOfDay.getTime()).toBe(true);
  });
});
