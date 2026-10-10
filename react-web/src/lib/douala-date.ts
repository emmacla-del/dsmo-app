// src/lib/douala-date.ts
//
// The Cameroon calendar date (Africa/Douala, UTC+1, no DST) of a stored
// instant. Campaign and round dates are stored as timestamps whose day is
// the Douala day: a bound saved as midnight Douala reads 23:00 UTC the day
// before, one saved as midnight UTC reads 01:00 Douala the same day. Read in
// UTC the first shows the previous day; read in the browser's own zone both
// depend on where the viewer is. Formatting in Africa/Douala gives the
// intended day for both, wherever the viewer is.
//
// Same rule as the export (src/data-management/canonical-schema-adapter
// .service.ts resolveReferencePeriod, dataset v8): an Intl formatter with
// timeZone "Africa/Douala".

export const DOUALA_TIME_ZONE = "Africa/Douala";

const PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: DOUALA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "YYYY-MM-DD" of the Douala calendar day; null for a missing or unreadable value. */
export function doualaIsoDate(value: Date | string | null | undefined): string | null {
  const d = toDate(value);
  return d ? PARTS.format(d) : null;
}

/** "dd/MM/yyyy" of the Douala calendar day; null for a missing or unreadable value. */
export function formatDoualaDate(value: Date | string | null | undefined): string | null {
  const iso = doualaIsoDate(value);
  if (!iso) return null;
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
}

/** The Douala calendar year; null for a missing or unreadable value. */
export function doualaYear(value: Date | string | null | undefined): number | null {
  const iso = doualaIsoDate(value);
  return iso ? Number(iso.slice(0, 4)) : null;
}
