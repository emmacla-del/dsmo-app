const STORED_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The registration wire format (DD/MM/YYYY) to an <input type="date"> value. */
export function dateForCalendar(value: string | undefined): string {
  const match = STORED_DATE.exec(value ?? "");
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

/** An <input type="date"> value (YYYY-MM-DD) to the registration wire format. */
export function dateFromCalendar(value: string): string {
  const match = CALENDAR_DATE.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}
