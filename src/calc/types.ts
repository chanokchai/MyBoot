export type TaxMode = 'cash' | 'sell';
export type DividendMode = 'cash' | 'reinvest';

export interface SimInputs {
  /** Yearly salary in THB. */
  salary: number;
  tierId: number;

  purchaseDate: string;
  /** EUR per share. */
  purchasePrice: number;
  /** THB per 1 EUR. */
  purchaseFx: number;

  taxDate: string;
  taxPrice: number;
  taxFx: number;
  /** Whole percent, 0–99. */
  taxRate: number;
  taxMode: TaxMode;

  dividendsEnabled: boolean;
  /** Dividend per share per year in EUR. */
  dividendPerShare: number;
  dividendFx: number;
  dividendMode: DividendMode;

  saleDate: string;
  salePrice: number;
  saleFx: number;
}

export interface DividendEvent {
  date: Date;
  /** Share of a full year's dividend (1 for anniversaries, <1 for the pro-rated final stub). */
  fraction: number;
  sharesHeld: number;
  amountEur: number;
  cashThb: number;
  reinvestedShares: number;
  referencePriceEur: number;
}

export interface Breakdown {
  contribution: number;
  match: number;
  /** Share price movement at constant purchase FX. */
  price: number;
  /** EUR/THB movement on the original shares. */
  fx: number;
  /** Cash dividends plus sale value of reinvested shares. */
  dividends: number;
  /** Negative: cash tax paid plus sale value of shares sold to cover tax. */
  tax: number;
  /** Net value to you = contribution + all effects above. */
  finalValue: number;
}

export interface SimResult {
  personal: number;
  match: number;
  total: number;

  purchaseDate: Date;
  vestingDate: Date;
  taxDate: Date;
  saleDate: Date;

  priceThb0: number;
  sharesPersonal: number;
  sharesMatch: number;
  sharesTotal: number;

  taxableValueThb: number;
  tax: number;
  taxCash: number;
  sharesSoldForTax: number;

  dividends: DividendEvent[];
  dividendCashThb: number;
  reinvestedShares: number;

  finalShares: number;
  saleProceeds: number;

  ownCashOut: number;
  netProfit: number;
  returnOnOwnMoney: number;
  holdingYears: number;
  annualized: number | null;

  breakdown: Breakdown;
}

export interface SimOverrides {
  personal?: number;
  match?: number;
  salePrice?: number;
  taxRate?: number;
}
