import { addYears, daysBetween, yearsBetween } from './dates';

export interface DividendDate {
  date: Date;
  fraction: number;
}

/**
 * Dividends are modelled as paid once a year on each purchase anniversary up to the sale date,
 * plus a pro-rated stub for the remaining part of a year, paid on the sale date.
 */
export function dividendSchedule(purchase: Date, sale: Date): DividendDate[] {
  const out: DividendDate[] = [];
  let last = purchase;
  for (let k = 1; ; k++) {
    const anniversary = addYears(purchase, k);
    if (anniversary > sale) break;
    out.push({ date: anniversary, fraction: 1 });
    last = anniversary;
  }
  const stub = yearsBetween(last, sale);
  if (stub > 1e-6) out.push({ date: sale, fraction: stub });
  return out;
}

export interface PricePoint {
  date: Date;
  price: number;
}

/** Piecewise-linear interpolation through known price points (purchase, tax date, sale). */
export function interpolatePrice(points: PricePoint[], date: Date): number {
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  if (date <= sorted[0].date) return sorted[0].price;
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (date <= b.date) {
      const span = daysBetween(a.date, b.date);
      const w = span === 0 ? 1 : daysBetween(a.date, date) / span;
      return a.price + w * (b.price - a.price);
    }
  }
  return sorted[sorted.length - 1].price;
}
