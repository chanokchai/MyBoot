import { DAYS_PER_YEAR, daysBetween } from './dates';

export interface CashFlow {
  date: Date;
  amount: number;
}

function npv(rate: number, flows: CashFlow[], t0: Date): number {
  return flows.reduce((sum, f) => sum + f.amount / Math.pow(1 + rate, daysBetween(t0, f.date) / DAYS_PER_YEAR), 0);
}

function dNpv(rate: number, flows: CashFlow[], t0: Date): number {
  return flows.reduce((sum, f) => {
    const t = daysBetween(t0, f.date) / DAYS_PER_YEAR;
    return sum - (t * f.amount) / Math.pow(1 + rate, t + 1);
  }, 0);
}

/**
 * Annualized internal rate of return for irregularly dated cash flows (Excel XIRR semantics).
 * Returns null when it can't be solved (e.g. all flows share one sign).
 */
export function xirr(flows: CashFlow[], guess = 0.1): number | null {
  const nonZero = flows.filter((f) => f.amount !== 0);
  if (!nonZero.some((f) => f.amount > 0) || !nonZero.some((f) => f.amount < 0)) return null;
  const t0 = nonZero.reduce((min, f) => (f.date < min ? f.date : min), nonZero[0].date);

  let rate = guess;
  for (let i = 0; i < 100; i++) {
    const value = npv(rate, nonZero, t0);
    const deriv = dNpv(rate, nonZero, t0);
    if (!Number.isFinite(value) || !Number.isFinite(deriv) || deriv === 0) break;
    const next = rate - value / deriv;
    if (!Number.isFinite(next) || next <= -1) break;
    if (Math.abs(next - rate) < 1e-10) return next;
    rate = next;
  }

  // Bisection fallback over a wide bracket.
  let lo = -0.999999;
  let hi = 100;
  let fLo = npv(lo, nonZero, t0);
  const fHi = npv(hi, nonZero, t0);
  if (Number.isNaN(fLo) || Number.isNaN(fHi) || Math.sign(fLo) === Math.sign(fHi)) return null;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, nonZero, t0);
    if (Math.abs(fMid) < 1e-9 || hi - lo < 1e-12) return mid;
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}
