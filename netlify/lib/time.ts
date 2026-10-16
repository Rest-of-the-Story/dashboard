/**
 * Calendar months in the store's timezone, not UTC's: a visit late on the
 * 31st belongs to that month, not the next.
 *
 * Env: CLIENT_TIMEZONE (default America/Denver)
 */
export const clientTimeZone = () => process.env.CLIENT_TIMEZONE || 'America/Denver';

/** Today's date (YYYY-MM-DD) where the store is. */
export function localToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: clientTimeZone() }).format(now);
}

/** First and last day of a YYYY-MM month, as YYYY-MM-DD. */
export function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(new Date(Date.UTC(y, m - 1, 1))), end: iso(new Date(Date.UTC(y, m, 0))) };
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

/** The month before the current one, where the store is. */
export const lastCompleteMonth = (now = new Date()) => shiftMonth(localToday(now).slice(0, 7), -1);

/** "2026-09" as "September" (or "September 2026"). */
export const monthLabel = (month: string, withYear = false) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
