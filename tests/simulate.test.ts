import { describe, expect, it } from 'vitest';
import { TIERS } from '../src/config';
import { simulate } from '../src/calc/simulate';
import type { SimInputs } from '../src/calc/types';
import { isTierEligible, minSalaryForTier, validate } from '../src/calc/validate';

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

const sumBreakdown = (r: ReturnType<typeof simulate>) =>
  r.breakdown.contribution + r.breakdown.match + r.breakdown.price + r.breakdown.fx + r.breakdown.dividends + r.breakdown.tax;

describe('simulate — worked example from PLAN.md', () => {
  const r = simulate(base);

  it('buys the right number of shares', () => {
    expect(r.total).toBe(105_000);
    expect(r.sharesTotal).toBeCloseTo(9.2105, 4);
    expect(r.sharesMatch).toBeCloseTo(3.0702, 4);
  });

  it('taxes the matching shares at the tax-date value', () => {
    expect(r.taxableValueThb).toBeCloseTo(40_833.33, 2);
    expect(r.tax).toBeCloseTo(8_166.67, 2);
    expect(r.taxCash).toBeCloseTo(8_166.67, 2);
    expect(r.sharesSoldForTax).toBe(0);
  });

  it('computes proceeds, profit and return', () => {
    expect(r.saleProceeds).toBeCloseTo(122_500, 6);
    expect(r.ownCashOut).toBeCloseTo(78_166.67, 2);
    expect(r.netProfit).toBeCloseTo(44_333.33, 2);
    expect(r.returnOnOwnMoney).toBeCloseTo(0.5672, 4);
    expect(r.holdingYears).toBeCloseTo(3, 2);
  });

  it('breakdown adds up to the final value', () => {
    expect(sumBreakdown(r)).toBeCloseTo(r.breakdown.finalValue, 6);
    expect(r.breakdown.finalValue - r.personal).toBeCloseTo(r.netProfit, 6);
  });
});

describe('simulate — tax modes', () => {
  it('sell-to-cover sells shares worth the tax and costs no cash', () => {
    const r = simulate({ ...base, taxMode: 'sell' });
    expect(r.taxCash).toBe(0);
    expect(r.sharesSoldForTax * 350 * 38).toBeCloseTo(r.tax, 6);
    expect(r.finalShares).toBeCloseTo(r.sharesTotal - r.sharesSoldForTax, 9);
    expect(r.ownCashOut).toBe(70_000);
    // Same prices at tax and sale → same profit as paying cash.
    expect(r.netProfit).toBeCloseTo(simulate(base).netProfit, 6);
    expect(sumBreakdown(r)).toBeCloseTo(r.breakdown.finalValue, 6);
  });

  it('tax still applies when holding past the tax date', () => {
    const r = simulate({ ...base, saleDate: '2032-01-01', salePrice: 400 });
    expect(r.tax).toBeCloseTo(8_166.67, 2);
  });

  it('zero tax rate means no tax', () => {
    const r = simulate({ ...base, taxRate: 0 });
    expect(r.tax).toBe(0);
    expect(r.netProfit).toBeCloseTo(122_500 - 70_000, 6);
  });
});

describe('simulate — all tiers', () => {
  it.each(TIERS.map((t) => [t.id, t]))('tier %i invests personal + match', (_id, tier) => {
    const r = simulate({ ...base, tierId: tier.id });
    expect(r.total).toBe(tier.personal + tier.match);
    expect(r.sharesTotal * 300 * 38).toBeCloseTo(r.total, 6);
    expect(sumBreakdown(r)).toBeCloseTo(r.breakdown.finalValue, 6);
  });
});

describe('simulate — exchange rate effect', () => {
  it('splits price and FX effects', () => {
    const r = simulate({ ...base, saleFx: 40 });
    expect(r.breakdown.price).toBeCloseTo(r.sharesTotal * 50 * 38, 6);
    expect(r.breakdown.fx).toBeCloseTo(r.sharesTotal * 350 * 2, 6);
    expect(sumBreakdown(r)).toBeCloseTo(r.breakdown.finalValue, 6);
  });
});

describe('simulate — dividends', () => {
  const div: SimInputs = { ...base, dividendsEnabled: true, dividendPerShare: 4, dividendFx: 38 };

  it('pays three annual cash dividends over 3 years', () => {
    const r = simulate(div);
    expect(r.dividends).toHaveLength(3);
    expect(r.dividendCashThb).toBeCloseTo(r.sharesTotal * 4 * 38 * 3, 6);
    expect(r.netProfit).toBeCloseTo(simulate(base).netProfit + r.dividendCashThb, 6);
    expect(sumBreakdown(r)).toBeCloseTo(r.breakdown.finalValue, 6);
  });

  it('pro-rates a partial year at sale', () => {
    const r = simulate({ ...div, saleDate: '2030-05-11' });
    expect(r.dividends).toHaveLength(4);
    expect(r.dividends[3].fraction).toBeCloseTo(0.5, 1);
  });

  it('reinvests dividends into extra shares', () => {
    const r = simulate({ ...div, dividendMode: 'reinvest' });
    expect(r.dividendCashThb).toBe(0);
    expect(r.reinvestedShares).toBeGreaterThan(0);
    expect(r.finalShares).toBeCloseTo(r.sharesTotal + r.reinvestedShares, 9);
    expect(sumBreakdown(r)).toBeCloseTo(r.breakdown.finalValue, 6);
  });

  it('sell-to-cover reduces shares for dividends after the tax date', () => {
    const r = simulate({ ...div, taxMode: 'sell', taxDate: '2027-06-01', saleDate: '2029-11-10' });
    expect(r.dividends[0].sharesHeld).toBeCloseTo(r.sharesTotal - r.sharesSoldForTax, 9);
    expect(sumBreakdown(r)).toBeCloseTo(r.breakdown.finalValue, 6);
  });
});

describe('validate', () => {
  it('accepts the base inputs', () => {
    expect(validate(base)).toEqual([]);
  });

  it('blocks a sale before vesting', () => {
    const issues = validate({ ...base, saleDate: '2029-11-09' });
    expect(issues.map((i) => i.field)).toContain('saleDate');
  });

  it('enforces the 25% salary cap', () => {
    expect(minSalaryForTier(TIERS[7])).toBe(1_120_000);
    expect(isTierEligible(1_120_000, TIERS[7])).toBe(true);
    expect(isTierEligible(1_119_999, TIERS[7])).toBe(false);
    const issues = validate({ ...base, salary: 200_000, tierId: 6 });
    expect(issues.map((i) => i.field)).toContain('tierId');
  });

  it('requires a whole tax rate 0–99', () => {
    expect(validate({ ...base, taxRate: 100 }).map((i) => i.field)).toContain('taxRate');
    expect(validate({ ...base, taxRate: 12.5 }).map((i) => i.field)).toContain('taxRate');
  });

  it('keeps the tax date between purchase and sale', () => {
    expect(validate({ ...base, taxDate: '2026-01-01' }).map((i) => i.field)).toContain('taxDate');
    expect(validate({ ...base, taxDate: '2030-01-01' }).map((i) => i.field)).toContain('taxDate');
  });
});
