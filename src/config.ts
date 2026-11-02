export interface Tier {
  id: number;
  personalEur: number;
  matchEur: number;
}

/** Boost contribution tiers in EUR (subscription notice, Nov 2026). */
export const TIERS: readonly Tier[] = [
  { id: 1, personalEur: 100, matchEur: 100 },
  { id: 2, personalEur: 200, matchEur: 200 },
  { id: 3, personalEur: 400, matchEur: 400 },
  { id: 4, personalEur: 600, matchEur: 600 },
  { id: 5, personalEur: 800, matchEur: 800 },
  { id: 6, personalEur: 2_000, matchEur: 1_000 },
  { id: 7, personalEur: 4_000, matchEur: 2_000 },
  { id: 8, personalEur: 8_000, matchEur: 2_800 },
];

/** Tier amounts in THB at the given EUR/THB rate (use the purchase-date rate). */
export function tierThb(tier: Tier, fx: number): { personal: number; match: number } {
  return { personal: tier.personalEur * fx, match: tier.matchEur * fx };
}

/** Personal contribution may not exceed this % of yearly salary. */
export const SALARY_CAP_PCT = 25;

/** Shares are locked for this many years after purchase. */
export const VESTING_YEARS = 3;

export const DEFAULT_PURCHASE_DATE = '2026-11-10';

export const STORAGE_KEY = 'boost-sim:v1';
export const THEME_STORAGE_KEY = 'boost-sim:theme';

export function getTier(id: number): Tier {
  const tier = TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`Unknown tier ${id}`);
  return tier;
}
