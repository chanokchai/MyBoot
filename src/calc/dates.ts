const MS_PER_DAY = 86_400_000;
export const DAYS_PER_YEAR = 365.25;

/** Parses an ISO `YYYY-MM-DD` date as UTC midnight. Returns null when invalid. */
export function parseDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Adds whole years; Feb 29 rolls back to Feb 28 in non-leap years. */
export function addYears(date: Date, years: number): Date {
  const y = date.getUTCFullYear() + years;
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, lastDay)));
}

export function addYearsIso(iso: string, years: number): string {
  const date = parseDate(iso);
  return date ? toIso(addYears(date, years)) : '';
}

export function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MS_PER_DAY;
}

export function yearsBetween(a: Date, b: Date): number {
  return daysBetween(a, b) / DAYS_PER_YEAR;
}
