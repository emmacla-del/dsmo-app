/**
 * The Cameroon calendar date (Africa/Douala, UTC+1, no DST) of a stored
 * instant, as dd/MM/yyyy — what `toLocaleDateString('fr-FR')` printed, but
 * read in Douala instead of the server's own zone. On a UTC server a round
 * deadline stored as midnight Douala (23:00 UTC the day before) printed the
 * day before.
 *
 * Same rule as the export's round dates (resolveReferencePeriod in
 * src/data-management/canonical-schema-adapter.service.ts, dataset v8) and
 * react-web/src/lib/douala-date.ts.
 */
export const DOUALA_TIME_ZONE = 'Africa/Douala';

const DOUALA_FR = new Intl.DateTimeFormat('fr-FR', {
  timeZone: DOUALA_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatDoualaDateFr(value: Date | string): string {
  return DOUALA_FR.format(value instanceof Date ? value : new Date(value));
}
