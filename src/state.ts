import { DEFAULT_PURCHASE_DATE, STORAGE_KEY, TIERS, VESTING_YEARS } from './config';
import { addYearsIso } from './calc/dates';
import type { SimInputs } from './calc/types';

export function defaultInputs(): SimInputs {
  const vesting = addYearsIso(DEFAULT_PURCHASE_DATE, VESTING_YEARS);
  return {
    salary: 900_000,
    tierId: 5,
    purchaseDate: DEFAULT_PURCHASE_DATE,
    purchasePrice: 300,
    purchaseFx: 38,
    taxDate: vesting,
    taxPrice: 330,
    taxFx: 38,
    taxRate: 20,
    taxMode: 'cash',
    dividendsEnabled: true,
    dividendPerShare: 4,
    dividendFx: 38,
    dividendMode: 'cash',
    saleDate: vesting,
    salePrice: 330,
    saleFx: 38,
  };
}

type Listener = (state: SimInputs, changed: (keyof SimInputs)[]) => void;

export interface Store {
  get(): SimInputs;
  set(patch: Partial<SimInputs>): void;
  reset(): void;
  subscribe(fn: Listener): void;
}

function sanitize(raw: unknown): SimInputs {
  const defaults = defaultInputs();
  if (!raw || typeof raw !== 'object') return defaults;
  const out = { ...defaults } as Record<string, unknown>;
  for (const key of Object.keys(defaults) as (keyof SimInputs)[]) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === typeof defaults[key]) out[key] = value;
  }
  const result = out as unknown as SimInputs;
  if (!TIERS.some((t) => t.id === result.tierId)) result.tierId = defaults.tierId;
  if (result.taxMode !== 'cash' && result.taxMode !== 'sell') result.taxMode = defaults.taxMode;
  if (result.dividendMode !== 'cash' && result.dividendMode !== 'reinvest') result.dividendMode = defaults.dividendMode;
  return result;
}

function load(): SimInputs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : defaultInputs();
  } catch {
    return defaultInputs();
  }
}

export function createStore(): Store {
  let state = load();
  const listeners: Listener[] = [];
  let saveTimer: number | undefined;

  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* storage full or disabled — simulation still works */
      }
    }, 250);
  };

  const emit = (changed: (keyof SimInputs)[]) => listeners.forEach((fn) => fn(state, changed));

  return {
    get: () => state,
    set(patch) {
      const changed = (Object.keys(patch) as (keyof SimInputs)[]).filter((k) => patch[k] !== state[k]);
      if (!changed.length) return;
      state = { ...state, ...patch };
      persist();
      emit(changed);
    },
    reset() {
      state = defaultInputs();
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      emit(Object.keys(state) as (keyof SimInputs)[]);
    },
    subscribe(fn) {
      listeners.push(fn);
    },
  };
}
