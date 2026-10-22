import { describe, expect, it } from 'vitest';
import { simulate } from '../src/calc/simulate';
import { breakEvenSalePrice, compareTiers, sensitivityCurve, withoutBoost } from '../src/calc/sensitivity';
import type { SimInputs } from '../src/calc/types';

const base: SimInputs = {
  salary: 1_200_000,
  tierId: 6,
  purchaseDate: '2026-11-10',
  purchasePrice: 300,
  purchaseFx: 38,
  taxDate: '2029-11-10',
  taxPrice: 350,
  taxFx: 38,
  taxRate: 20,
  taxMode: 'cash',
  dividendsEnabled: false,
  dividendPerShare: 0,
  dividendFx: 38,
  dividendMode: 'cash',
  saleDate: '2029-11-10',
  salePrice: 350,
  saleFx: 38,
};

describe('breakEvenSalePrice', () => {
  it('matches the plan example (€223.33)', () => {
    expect(breakEvenSalePrice(base)).toBeCloseTo(223.33, 2);
  });

  it.each([
    ['sell-to-cover', { taxMode: 'sell' as const }],
    ['reinvested dividends', { dividendsEnabled: true, dividendPerShare: 4, dividendMode: 'reinvest' as const }],
    ['cash dividends', { dividendsEnabled: true, dividendPerShare: 4 }],
  ])('gives zero profit with %s', (_label, patch) => {
    const inputs = { ...base, ...patch };
    const be = breakEvenSalePrice(inputs)!;
    expect(be).toBeGreaterThan(0);
    expect(simulate(inputs, { salePrice: be }).netProfit).toBeCloseTo(0, 3);
  });
});

describe('sensitivityCurve', () => {
  it('covers 50%–200% of purchase price and the break-even', () => {
    const be = breakEvenSalePrice(base);
    const pts = sensitivityCurve(base, be);
    expect(pts[0].salePrice).toBeLessThanOrEqual(150);
    expect(pts[pts.length - 1].salePrice).toBeGreaterThanOrEqual(600);
    for (let i = 1; i < pts.length; i++) expect(pts[i].netProfit).toBeGreaterThan(pts[i - 1].netProfit);
  });
});

describe('compareTiers', () => {
  it('flags tiers above the salary cap', () => {
    const rows = compareTiers({ ...base, salary: 300_000 });
    expect(rows.filter((r) => r.eligible).map((r) => r.tier.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('1:1 tiers give the best return on own money', () => {
    const rows = compareTiers(base);
    const r5 = rows[4].result.returnOnOwnMoney;
    const r8 = rows[7].result.returnOnOwnMoney;
    expect(r5).toBeGreaterThan(r8);
  });
});

describe('withoutBoost', () => {
  it('has no match and no tax', () => {
    const r = withoutBoost(base);
    expect(r.match).toBe(0);
    expect(r.tax).toBe(0);
    expect(r.netProfit).toBeCloseTo(70_000 * (350 / 300) - 70_000, 6);
  });
});
