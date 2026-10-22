export interface Tier {
  id: number;
  personal: number;
  match: number;
}

/** Boost contribution tiers in THB (subscription notice, Nov 2026). */
export const TIERS: readonly Tier[] = [
  { id: 1, personal: 3_500, match: 3_500 },
  { id: 2, personal: 7_000, match: 7_000 },
  { id: 3, personal: 14_000, match: 14_000 },
  { id: 4, personal: 21_000, match: 21_000 },
  { id: 5, personal: 28_000, match: 28_000 },
  { id: 6, personal: 70_000, match: 35_000 },
  { id: 7, personal: 140_000, match: 70_000 },
  { id: 8, personal: 280_000, match: 98_000 },
];

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
