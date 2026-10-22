import { TIERS, type Tier } from '../config';
import { simulate } from './simulate';
import type { SimInputs, SimResult } from './types';
import { isTierEligible } from './validate';

/**
 * Sale price (EUR) at which net profit is zero, found by bisection (profit rises with sale price).
 * Returns 0 when you are already in profit even at a zero sale price.
 */
export function breakEvenSalePrice(inputs: SimInputs): number | null {
  const profitAt = (salePrice: number) => simulate(inputs, { salePrice }).netProfit;
  let lo = 1e-6;
  if (profitAt(lo) >= 0) return 0;
  let hi = Math.max(inputs.purchasePrice, 1);
  for (let i = 0; i < 60 && profitAt(hi) < 0; i++) hi *= 2;
  if (profitAt(hi) < 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (profitAt(mid) < 0) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-9) break;
  }
  return (lo + hi) / 2;
}

export interface SensitivityPoint {
  salePrice: number;
  netProfit: number;
}

export function sensitivityCurve(inputs: SimInputs, breakEven: number | null, steps = 80): SensitivityPoint[] {
  const p0 = inputs.purchasePrice;
  const candidatesLow = [0.5 * p0, 0.85 * inputs.salePrice];
  const candidatesHigh = [2 * p0, 1.15 * inputs.salePrice];
  if (breakEven !== null && breakEven > 0) {
    candidatesLow.push(0.85 * breakEven);
    candidatesHigh.push(1.15 * breakEven);
  }
  const min = Math.max(0, Math.min(...candidatesLow));
  const max = Math.max(...candidatesHigh);
  const points: SensitivityPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const salePrice = min + ((max - min) * i) / steps;
    points.push({ salePrice, netProfit: simulate(inputs, { salePrice }).netProfit });
  }
  return points;
}

export interface TierComparison {
  tier: Tier;
  eligible: boolean;
  result: SimResult;
}

export function compareTiers(inputs: SimInputs): TierComparison[] {
  return TIERS.map((tier) => ({
    tier,
    eligible: isTierEligible(inputs.salary, tier),
    result: simulate(inputs, { personal: tier.personal, match: tier.match }),
  }));
}

/** Same personal money, same market, but no company match (and so no tax on a match). */
export function withoutBoost(inputs: SimInputs): SimResult {
  return simulate(inputs, { match: 0, taxRate: 0 });
}
