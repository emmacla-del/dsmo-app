import { formatDoualaDateFr } from './douala-date';
import { translateErrorMessage } from '../i18n/error-messages';

describe('formatDoualaDateFr', () => {
  it('reads a stored instant as its Africa/Douala calendar day', () => {
    // Midnight Douala = 23:00 UTC the day before.
    expect(formatDoualaDateFr(new Date('2026-09-30T23:00:00.000Z'))).toBe('01/10/2026');
    // Midnight UTC keeps its day (01:00 Douala).
    expect(formatDoualaDateFr('2026-10-01T00:00:00.000Z')).toBe('01/10/2026');
    // End-of-day closing in Douala (23:59:59) stays on its day.
    expect(formatDoualaDateFr('2026-12-31T22:59:59.000Z')).toBe('31/12/2026');
  });

  it('keeps the closed-period message translatable, date included', () => {
    const fr = `La période de collecte « T4 2025 » est close depuis le ${formatDoualaDateFr('2025-12-30T23:00:00.000Z')}.`;
    expect(fr).toBe('La période de collecte « T4 2025 » est close depuis le 31/12/2025.');
    expect(translateErrorMessage(fr, 'en')).toBe('The collection period "T4 2025" closed on 31/12/2025.');
  });
});
