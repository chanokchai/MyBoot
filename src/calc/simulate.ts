import { VESTING_YEARS, getTier } from '../config';
import { addYears, parseDate, yearsBetween } from './dates';
import { dividendSchedule, interpolatePrice } from './dividends';
import type { DividendEvent, SimInputs, SimOverrides, SimResult } from './types';
import { xirr, type CashFlow } from './xirr';

const MIN_PRICE = 1e-9;

function requireDate(iso: string, label: string): Date {
  const d = parseDate(iso);
  if (!d) throw new Error(`Invalid ${label}: ${iso}`);
  return d;
}

/** Runs the Boost simulation. Inputs must already pass `validate()`. */
export function simulate(inputs: SimInputs, overrides: SimOverrides = {}): SimResult {
  const tier = getTier(inputs.tierId);
  const personal = overrides.personal ?? tier.personal;
  const match = overrides.match ?? tier.match;
  const total = personal + match;
  const salePrice = overrides.salePrice ?? inputs.salePrice;
  const taxRate = overrides.taxRate ?? inputs.taxRate;

  const purchaseDate = requireDate(inputs.purchaseDate, 'purchase date');
  const taxDate = requireDate(inputs.taxDate, 'tax date');
  const saleDate = requireDate(inputs.saleDate, 'sale date');
  const vestingDate = addYears(purchaseDate, VESTING_YEARS);

  const priceThb0 = inputs.purchasePrice * inputs.purchaseFx;
  const sharesPersonal = personal / priceThb0;
  const sharesMatch = match / priceThb0;
  const sharesTotal = sharesPersonal + sharesMatch;

  const taxPriceThb = inputs.taxPrice * inputs.taxFx;
  const taxableValueThb = sharesMatch * taxPriceThb;
  const tax = (taxableValueThb * taxRate) / 100;
  const sharesSoldForTax = inputs.taxMode === 'sell' && taxPriceThb > 0 ? tax / taxPriceThb : 0;
  const taxCash = inputs.taxMode === 'cash' ? tax : 0;

  const pricePoints = [
    { date: purchaseDate, price: inputs.purchasePrice },
    { date: taxDate, price: inputs.taxPrice },
    { date: saleDate, price: salePrice },
  ];

  // Walk dividend dates chronologically; the sell-to-cover sale happens on the tax date.
  const dividends: DividendEvent[] = [];
  let shares = sharesTotal;
  let taxApplied = false;
  let reinvestedShares = 0;
  let dividendCashThb = 0;
  const applyTaxIfDue = (date: Date) => {
    if (!taxApplied && taxDate < date) {
      shares -= sharesSoldForTax;
      taxApplied = true;
    }
  };

  if (inputs.dividendsEnabled && inputs.dividendPerShare > 0) {
    for (const { date, fraction } of dividendSchedule(purchaseDate, saleDate)) {
      applyTaxIfDue(date);
      const amountEur = shares * inputs.dividendPerShare * fraction;
      const referencePriceEur = Math.max(interpolatePrice(pricePoints, date), MIN_PRICE);
      let cashThb = 0;
      let reinvested = 0;
      if (inputs.dividendMode === 'cash') {
        cashThb = amountEur * inputs.dividendFx;
        dividendCashThb += cashThb;
      } else {
        reinvested = amountEur / referencePriceEur;
        reinvestedShares += reinvested;
        shares += reinvested;
      }
      dividends.push({ date, fraction, sharesHeld: shares - reinvested, amountEur, cashThb, reinvestedShares: reinvested, referencePriceEur });
    }
  }
  if (!taxApplied) shares -= sharesSoldForTax;

  const finalShares = shares;
  const saleFxPrice = salePrice * inputs.saleFx;
  const saleProceeds = finalShares * saleFxPrice;

  const ownCashOut = personal + taxCash;
  const netProfit = saleProceeds + dividendCashThb - ownCashOut;

  const flows: CashFlow[] = [{ date: purchaseDate, amount: -personal }];
  if (taxCash > 0) flows.push({ date: taxDate, amount: -taxCash });
  for (const d of dividends) if (d.cashThb > 0) flows.push({ date: d.date, amount: d.cashThb });
  flows.push({ date: saleDate, amount: saleProceeds });

  const breakdown = {
    contribution: personal,
    match,
    price: sharesTotal * (salePrice - inputs.purchasePrice) * inputs.purchaseFx,
    fx: sharesTotal * salePrice * (inputs.saleFx - inputs.purchaseFx),
    dividends: dividendCashThb + reinvestedShares * saleFxPrice,
    tax: -(taxCash + sharesSoldForTax * saleFxPrice),
    finalValue: saleProceeds + dividendCashThb - taxCash,
  };

  return {
    personal,
    match,
    total,
    purchaseDate,
    vestingDate,
    taxDate,
    saleDate,
    priceThb0,
    sharesPersonal,
    sharesMatch,
    sharesTotal,
    taxableValueThb,
    tax,
    taxCash,
    sharesSoldForTax,
    dividends,
    dividendCashThb,
    reinvestedShares,
    finalShares,
    saleProceeds,
    ownCashOut,
    netProfit,
    returnOnOwnMoney: ownCashOut > 0 ? netProfit / ownCashOut : 0,
    holdingYears: yearsBetween(purchaseDate, saleDate),
    annualized: personal > 0 ? xirr(flows) : null,
    breakdown,
  };
}
