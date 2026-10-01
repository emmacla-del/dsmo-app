/**
 * src/questionnaires/douala-deadline.ts
 *
 * Interprets a given date as END OF THAT DAY in Africa/Douala (23:59:59).
 * Africa/Douala is UTC+1 (WAT, West Africa Time) year-round with no DST.
 */
export function computeDoualaEndOfDay(deadline: Date): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Douala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [year, month, day] = formatter.format(deadline).split('-');
  return new Date(`${year}-${month}-${day}T23:59:59+01:00`);
}
