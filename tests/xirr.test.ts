import { describe, expect, it } from 'vitest';
import { parseDate } from '../src/calc/dates';
import { xirr } from '../src/calc/xirr';

const d = (iso: string) => parseDate(iso)!;

describe('xirr', () => {
  it('returns 10% for a one-year 10% gain', () => {
    const r = xirr([
      { date: d('2026-01-01'), amount: -1000 },
      { date: d('2027-01-01'), amount: 1100 },
    ]);
    expect(r).toBeCloseTo(0.1, 2);
  });

  it('matches the Excel XIRR reference example', () => {
    // Microsoft docs example → 0.373362535
    const r = xirr([
      { date: d('2008-01-01'), amount: -10000 },
      { date: d('2008-03-01'), amount: 2750 },
      { date: d('2008-10-30'), amount: 4250 },
      { date: d('2009-02-15'), amount: 3250 },
      { date: d('2009-04-01'), amount: 2750 },
    ]);
    expect(r).toBeCloseTo(0.3734, 2);
  });

  it('handles losses', () => {
    const r = xirr([
      { date: d('2026-01-01'), amount: -1000 },
      { date: d('2029-01-01'), amount: 500 },
    ]);
    expect(r).toBeCloseTo(Math.pow(0.5, 1 / 3) - 1, 2);
  });

  it('returns null when no sign change', () => {
    expect(xirr([{ date: d('2026-01-01'), amount: 100 }])).toBeNull();
  });
});
