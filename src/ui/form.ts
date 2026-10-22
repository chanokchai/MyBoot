import { SALARY_CAP_PCT, TIERS, VESTING_YEARS } from '../config';
import { addYearsIso } from '../calc/dates';
import type { SimInputs } from '../calc/types';
import { isTierEligible, maxPersonalContribution, minSalaryForTier, type ValidationIssue } from '../calc/validate';
import { num, thb } from '../format';
import type { Store } from '../state';

type Field = keyof SimInputs;

const $ = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

function matchLabel(personal: number, match: number): string {
  const ratio = Math.round((match / personal) * 100);
  return `${ratio}% match`;
}

export function createForm(store: Store) {
  const form = $<HTMLFormElement>('#sim-form')!;
  const tierGrid = $<HTMLDivElement>('#tier-grid')!;

  tierGrid.innerHTML = TIERS.map(
    (t) => `
    <button type="button" role="radio" class="tier" data-tier="${t.id}">
      <span class="tier-top"><span class="tier-name">Tier ${t.id}</span><span class="badge">${matchLabel(t.personal, t.match)}</span></span>
      <span class="tier-line"><span>You</span><b>${num(t.personal)}</b></span>
      <span class="tier-line"><span>Company</span><b>+${num(t.match)}</b></span>
      <span class="tier-total"><span>Total</span><b>฿${num(t.personal + t.match)}</b></span>
      <span class="tier-lock"></span>
    </button>`,
  ).join('');

  const readField = (el: HTMLInputElement): unknown => {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'number' || el.type === 'range') return el.value === '' ? NaN : Number(el.value);
    return el.value;
  };

  // Inputs → store
  form.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    const field = el.dataset.field as Field | undefined;
    if (!field) return;
    let value = readField(el);
    if (field === 'taxRate' && typeof value === 'number' && !Number.isNaN(value)) {
      // Keep to 2 digits as the user types.
      if (el.value.length > 2) el.value = el.value.slice(0, 2);
      value = Number(el.value);
      $$<HTMLInputElement>('[data-field="taxRate"]', form).forEach((other) => other !== el && (other.value = el.value));
    }
    if (field === 'purchaseDate') onPurchaseDateChange(value as string);
    else store.set({ [field]: value } as Partial<SimInputs>);
  });

  // When the purchase date moves, keep tax/sale dates that were pinned to vesting pinned to the new vesting date.
  const onPurchaseDateChange = (purchaseDate: string) => {
    const s = store.get();
    const oldVesting = addYearsIso(s.purchaseDate, VESTING_YEARS);
    const newVesting = addYearsIso(purchaseDate, VESTING_YEARS);
    const patch: Partial<SimInputs> = { purchaseDate };
    if (newVesting) {
      if (s.taxDate === oldVesting) patch.taxDate = newVesting;
      if (s.saleDate === oldVesting) patch.saleDate = newVesting;
    }
    store.set(patch);
    writeValues(['taxDate', 'saleDate']);
  };

  $$<HTMLDivElement>('.segmented[data-field]', form).forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-value]');
      if (!btn) return;
      store.set({ [seg.dataset.field as Field]: btn.dataset.value } as Partial<SimInputs>);
    });
  });

  tierGrid.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-tier]');
    if (!btn || btn.getAttribute('aria-disabled') === 'true') return;
    store.set({ tierId: Number(btn.dataset.tier) });
  });

  // Arrow-key navigation for radio groups.
  form.addEventListener('keydown', (e) => {
    const group = (e.target as HTMLElement).closest<HTMLElement>('[role="radiogroup"]');
    if (!group || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const radios = $$<HTMLButtonElement>('[role="radio"]:not([aria-disabled="true"])', group);
    const idx = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (idx < 0) return;
    e.preventDefault();
    const next = radios[(idx + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + radios.length) % radios.length];
    next.focus();
    next.click();
  });

  $$<HTMLButtonElement>('[data-set-vesting]', form).forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.setVesting as 'taxDate' | 'saleDate';
      const vesting = addYearsIso(store.get().purchaseDate, VESTING_YEARS);
      if (!vesting) return;
      store.set({ [field]: vesting });
      writeValues([field]);
    });
  });

  form.addEventListener('submit', (e) => e.preventDefault());

  /** Store → inputs. Only call for programmatic changes so typing isn't interrupted. */
  function writeValues(fields?: Field[]) {
    const s = store.get();
    $$<HTMLInputElement>('input[data-field]', form).forEach((el) => {
      const field = el.dataset.field as Field;
      if (fields && !fields.includes(field)) return;
      const value = s[field];
      if (el.type === 'checkbox') el.checked = Boolean(value);
      else el.value = typeof value === 'number' && Number.isNaN(value) ? '' : String(value);
    });
  }

  /** Reflects derived UI state: selections, disabled tiers, hints, errors. */
  function sync(issues: ValidationIssue[]) {
    const s = store.get();

    $$<HTMLDivElement>('.segmented[data-field]', form).forEach((seg) => {
      const value = s[seg.dataset.field as Field];
      $$<HTMLButtonElement>('button[data-value]', seg).forEach((btn) => {
        const active = btn.dataset.value === value;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-checked', String(active));
        btn.tabIndex = active ? 0 : -1;
      });
    });

    const cap = maxPersonalContribution(s.salary);
    $<HTMLSpanElement>('#salary-hint')!.textContent =
      cap > 0 ? `You can put in up to ${thb(cap)} a year (${SALARY_CAP_PCT}% of salary).` : `Contributions are capped at ${SALARY_CAP_PCT}% of salary.`;

    $$<HTMLButtonElement>('button[data-tier]', tierGrid).forEach((btn) => {
      const tier = TIERS.find((t) => t.id === Number(btn.dataset.tier))!;
      const eligible = isTierEligible(s.salary, tier);
      const active = tier.id === s.tierId;
      btn.classList.toggle('is-active', active);
      btn.classList.toggle('is-disabled', !eligible);
      btn.setAttribute('aria-checked', String(active));
      btn.setAttribute('aria-disabled', String(!eligible));
      btn.tabIndex = active ? 0 : -1;
      const lock = btn.querySelector('.tier-lock')!;
      lock.textContent = eligible ? '' : `Needs salary ≥ ${thb(Math.ceil(minSalaryForTier(tier)))}`;
      btn.title = eligible ? '' : lock.textContent;
    });

    $<HTMLDivElement>('#dividend-fields')!.classList.toggle('is-collapsed', !s.dividendsEnabled);
    $$<HTMLInputElement>('#dividend-fields input').forEach((el) => (el.disabled = !s.dividendsEnabled));

    const vesting = addYearsIso(s.purchaseDate, VESTING_YEARS);
    $<HTMLSpanElement>('#vesting-hint')!.textContent = vesting
      ? `Shares are locked for ${VESTING_YEARS} years. You can sell from ${vesting}.`
      : '';
    $<HTMLInputElement>('input[data-field="saleDate"]')!.min = vesting;

    const byField = new Map<Field, string>();
    issues.forEach((i) => !byField.has(i.field) && byField.set(i.field, i.message));
    $$<HTMLSpanElement>('[data-error-for]', form).forEach((el) => {
      const field = el.dataset.errorFor as Field;
      el.textContent = byField.get(field) ?? '';
      el.closest('.field')?.classList.toggle('is-invalid', byField.has(field));
    });
  }

  writeValues();
  return { writeValues, sync };
}
