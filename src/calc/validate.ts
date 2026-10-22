import { SALARY_CAP_PCT, TIERS, VESTING_YEARS, type Tier } from '../config';
import { addYears, parseDate, toIso } from './dates';
import type { SimInputs } from './types';

export type FieldKey = keyof SimInputs;

export interface ValidationIssue {
  field: FieldKey;
  message: string;
}

export function maxPersonalContribution(salary: number): number {
  return Number.isFinite(salary) && salary > 0 ? (salary * SALARY_CAP_PCT) / 100 : 0;
}

export function isTierEligible(salary: number, tier: Tier): boolean {
  return tier.personal <= maxPersonalContribution(salary) + 1e-9;
}

/** Minimum yearly salary needed to pick a tier. */
export function minSalaryForTier(tier: Tier): number {
  return (tier.personal * 100) / SALARY_CAP_PCT;
}

const positive = (v: number) => Number.isFinite(v) && v > 0;

export function validate(inputs: SimInputs): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (field: FieldKey, message: string) => issues.push({ field, message });

  if (!positive(inputs.salary)) add('salary', 'Enter your yearly salary.');

  const tier = TIERS.find((t) => t.id === inputs.tierId);
  if (!tier) add('tierId', 'Choose a contribution tier.');
  else if (positive(inputs.salary) && !isTierEligible(inputs.salary, tier)) {
    add('tierId', `Tier ${tier.id} needs a yearly salary of at least ${Math.ceil(minSalaryForTier(tier)).toLocaleString('en-US')} THB (${SALARY_CAP_PCT}% cap).`);
  }

  for (const [field, label] of [
    ['purchasePrice', 'Purchase price'],
    ['purchaseFx', 'Purchase EUR/THB rate'],
    ['taxPrice', 'Tax-date price'],
    ['taxFx', 'Tax-date EUR/THB rate'],
    ['salePrice', 'Sale price'],
    ['saleFx', 'Sale EUR/THB rate'],
  ] as const) {
    if (!positive(inputs[field])) add(field, `${label} must be greater than 0.`);
  }

  if (!Number.isInteger(inputs.taxRate) || inputs.taxRate < 0 || inputs.taxRate > 99) {
    add('taxRate', 'Tax rate must be a whole number from 0 to 99.');
  }

  if (inputs.dividendsEnabled) {
    if (!Number.isFinite(inputs.dividendPerShare) || inputs.dividendPerShare < 0) add('dividendPerShare', 'Dividend must be 0 or more.');
    if (!positive(inputs.dividendFx)) add('dividendFx', 'Dividend EUR/THB rate must be greater than 0.');
  }

  const purchase = parseDate(inputs.purchaseDate);
  const taxDate = parseDate(inputs.taxDate);
  const sale = parseDate(inputs.saleDate);
  if (!purchase) add('purchaseDate', 'Enter a valid purchase date.');
  if (!taxDate) add('taxDate', 'Enter a valid tax date.');
  if (!sale) add('saleDate', 'Enter a valid sale date.');

  if (purchase && sale) {
    const vesting = addYears(purchase, VESTING_YEARS);
    if (sale < vesting) {
      add('saleDate', `Shares are locked for ${VESTING_YEARS} years. The earliest sale date is ${toIso(vesting)}.`);
    }
  }
  if (purchase && taxDate && taxDate < purchase) add('taxDate', 'Tax date can’t be before the purchase date.');
  if (taxDate && sale && taxDate > sale) add('taxDate', 'Tax date can’t be after the sale date.');

  return issues;
}
