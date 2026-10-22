import type { SimInputs, SimResult } from '../calc/types';
import type { TierComparison } from '../calc/sensitivity';
import { date, eur, escapeHtml, num, pct, pctSigned, shares, thb, thbSigned, years } from '../format';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const lastValues = new WeakMap<Element, number>();

/** Count-up animation for headline numbers. */
function animateNumber(el: HTMLElement, to: number, fmt: (n: number) => string) {
  const from = lastValues.get(el) ?? to;
  lastValues.set(el, to);
  if (reducedMotion.matches || from === to || !Number.isFinite(from)) {
    el.textContent = fmt(to);
    return;
  }
  const start = performance.now();
  const duration = 450;
  const step = (now: number) => {
    if (lastValues.get(el) !== to) return;
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const tone = (n: number) => (n > 0.5 ? 'pos' : n < -0.5 ? 'neg' : '');

interface KpiData {
  result: SimResult;
  inputs: SimInputs;
  breakEven: number | null;
  benchmark: SimResult;
}

export function renderKpis(root: HTMLElement, { result: r, inputs, breakEven, benchmark }: KpiData) {
  if (!root.dataset.ready) {
    root.innerHTML = `
      <div class="kpi kpi-hero glass" data-k="profit">
        <span class="kpi-label">Net profit if you sell</span>
        <span class="kpi-value" data-v></span>
        <span class="kpi-sub" data-s></span>
      </div>
      <div class="kpi glass" data-k="roi"><span class="kpi-label">Return on your money</span><span class="kpi-value" data-v></span><span class="kpi-sub" data-s></span></div>
      <div class="kpi glass" data-k="xirr"><span class="kpi-label">Yearly return (annualized)</span><span class="kpi-value" data-v></span><span class="kpi-sub" data-s></span></div>
      <div class="kpi glass" data-k="be"><span class="kpi-label">Break-even sale price</span><span class="kpi-value" data-v></span><span class="kpi-sub" data-s></span></div>
      <div class="kpi glass" data-k="shares"><span class="kpi-label">Shares when you sell</span><span class="kpi-value" data-v></span><span class="kpi-sub" data-s></span></div>
      <div class="kpi glass" data-k="boost"><span class="kpi-label">Extra from company match</span><span class="kpi-value" data-v></span><span class="kpi-sub" data-s></span></div>`;
    root.dataset.ready = '1';
  }
  const set = (key: string, value: number, fmt: (n: number) => string, sub: string, cls = '') => {
    const card = root.querySelector<HTMLElement>(`[data-k="${key}"]`)!;
    const v = card.querySelector<HTMLElement>('[data-v]')!;
    v.className = `kpi-value ${cls}`;
    animateNumber(v, value, fmt);
    card.querySelector<HTMLElement>('[data-s]')!.innerHTML = sub;
  };

  set(
    'profit',
    r.netProfit,
    thbSigned,
    `Selling on <b>${date(r.saleDate)}</b> at <b>${eur(inputs.salePrice)}</b>. You put in <b>${thb(r.ownCashOut)}</b> and get back <b>${thb(r.saleProceeds + r.dividendCashThb)}</b>.`,
    tone(r.netProfit),
  );
  set('roi', r.returnOnOwnMoney, (n) => pctSigned(n), `On the ${thb(r.ownCashOut)} you paid${r.taxCash > 0 ? ' (incl. tax)' : ''}`, tone(r.returnOnOwnMoney * 1000));
  if (r.annualized === null) set('xirr', 0, () => '—', `Over ${years(r.holdingYears)}`);
  else set('xirr', r.annualized, (n) => pctSigned(n), `Per year over ${years(r.holdingYears)}`, tone(r.annualized * 1000));

  if (breakEven === null) set('be', 0, () => '—', 'Can’t reach break-even');
  else {
    const vsPurchase = breakEven / inputs.purchasePrice - 1;
    set('be', breakEven, eur, `${pctSigned(vsPurchase)} vs purchase price ${eur(inputs.purchasePrice)}. Below this you lose money.`);
  }
  set(
    'shares',
    r.finalShares,
    shares,
    `Worth ${thb(r.saleProceeds)}${r.sharesSoldForTax > 0 ? ` · ${shares(r.sharesSoldForTax)} sold for tax` : ''}${r.reinvestedShares > 0 ? ` · +${shares(r.reinvestedShares)} from dividends` : ''}`,
  );
  const advantage = r.netProfit - benchmark.netProfit;
  set('boost', advantage, thbSigned, `Compared with buying the same shares on your own: <b>${thbSigned(benchmark.netProfit)}</b>`, tone(advantage));
}

type Row = [label: string, detail: string, value: string, cls?: string] | { section: string };

export function renderPnl(root: HTMLElement, r: SimResult, inputs: SimInputs) {
  const divPayments = r.dividends.length;
  const rows: Row[] = [
    { section: 'Purchase' },
    ['Your contribution', `Tier ${inputs.tierId}`, thb(r.personal)],
    ['Company match', `${pct(r.match / r.personal, 0)} of your contribution`, thbSigned(r.match), 'pos'],
    ['Total invested', `${eur(inputs.purchasePrice)} × ${num(inputs.purchaseFx, 2)} = ${thb(r.priceThb0)} per share`, thb(r.total)],
    ['Shares bought', `${shares(r.sharesPersonal)} yours + ${shares(r.sharesMatch)} matched`, shares(r.sharesTotal)],
    { section: `Tax on matched shares · ${date(r.taxDate)}` },
    ['Taxable value', `${shares(r.sharesMatch)} × ${eur(inputs.taxPrice)} × ${num(inputs.taxFx, 2)}`, thb(r.taxableValueThb)],
    ['Tax due', `${inputs.taxRate}% of taxable value`, thb(r.tax)],
    inputs.taxMode === 'cash'
      ? ['Paid by', 'Cash from your pocket', thbSigned(-r.taxCash), r.taxCash > 0 ? 'neg' : '']
      : ['Paid by', `Selling shares at ${eur(inputs.taxPrice)}`, `${MINUS}${shares(r.sharesSoldForTax)} sh`, r.sharesSoldForTax > 0 ? 'neg' : ''],
  ];
  if (inputs.dividendsEnabled && divPayments > 0) {
    rows.push({ section: 'Dividends' });
    if (inputs.dividendMode === 'cash') {
      rows.push(['Cash dividends', `${divPayments} payment${divPayments > 1 ? 's' : ''} at ${eur(inputs.dividendPerShare)}/share/yr × ${num(inputs.dividendFx, 2)}`, thbSigned(r.dividendCashThb), 'pos']);
    } else {
      rows.push(['Reinvested dividends', `${divPayments} payment${divPayments > 1 ? 's' : ''} at ${eur(inputs.dividendPerShare)}/share/yr`, `+${shares(r.reinvestedShares)} sh`, 'pos']);
    }
  }
  rows.push(
    { section: `Sale · ${date(r.saleDate)}` },
    ['Shares sold', `${shares(r.finalShares)} × ${eur(inputs.salePrice)} × ${num(inputs.saleFx, 2)}`, thb(r.saleProceeds)],
    { section: 'Result' },
    ['Money you paid', `Contribution${r.taxCash > 0 ? ' + tax in cash' : ''}`, thb(r.ownCashOut)],
    ['Money you got back', `Sale${r.dividendCashThb > 0 ? ' + cash dividends' : ''}`, thb(r.saleProceeds + r.dividendCashThb)],
  );

  const body = rows
    .map((row) =>
      'section' in row
        ? `<tr class="section"><th colspan="3">${escapeHtml(row.section)}</th></tr>`
        : `<tr><td>${escapeHtml(row[0])}</td><td class="muted">${escapeHtml(row[1])}</td><td class="num ${row[3] ?? ''}">${row[2]}</td></tr>`,
    )
    .join('');

  root.innerHTML = `
    <table class="table pnl">
      <tbody>${body}</tbody>
      <tfoot>
        <tr class="total ${tone(r.netProfit)}">
          <td>Net ${r.netProfit >= 0 ? 'profit' : 'loss'}</td>
          <td class="muted">${pctSigned(r.returnOnOwnMoney)} on your money${r.annualized !== null ? ` · ${pctSigned(r.annualized)} a year` : ''}</td>
          <td class="num">${thbSigned(r.netProfit)}</td>
        </tr>
      </tfoot>
    </table>`;
}

const MINUS = '\u2212';

export function renderTierTable(root: HTMLElement, rows: TierComparison[], selectedId: number, onPick: (id: number) => void) {
  const eligible = rows.filter((r) => r.eligible);
  const bestReturn = Math.max(...eligible.map((r) => r.result.returnOnOwnMoney));
  const isBest = (r: TierComparison) => r.eligible && r.result.returnOnOwnMoney >= bestReturn - 1e-9;
  const most = eligible.reduce<TierComparison | null>((b, r) => (!b || r.result.netProfit > b.result.netProfit ? r : b), null);

  root.innerHTML = `
    <table class="table tiers">
      <thead>
        <tr>
          <th>Tier</th><th class="num">You pay</th><th class="num">Company</th><th class="num">Tax</th>
          <th class="num">Net profit</th><th class="num">Return</th><th class="num">Per year</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            const { tier, eligible, result: r } = row;
            const tags = [
              tier.id === selectedId ? '<span class="tag tag-accent">Selected</span>' : '',
              isBest(row) ? '<span class="tag tag-pos">Best return</span>' : '',
              most && tier.id === most.tier.id && !isBest(row) ? '<span class="tag">Most profit</span>' : '',
              !eligible ? '<span class="tag tag-muted">Above salary cap</span>' : '',
            ].join('');
            return `
            <tr class="${tier.id === selectedId ? 'is-selected' : ''} ${eligible ? 'is-pickable' : 'is-disabled'}" data-tier="${tier.id}" ${eligible ? 'tabindex="0"' : ''}>
              <td><b>Tier ${tier.id}</b> ${tags}</td>
              <td class="num">${thb(r.ownCashOut)}</td>
              <td class="num pos">${thbSigned(r.match)}</td>
              <td class="num">${thb(r.tax)}</td>
              <td class="num ${tone(r.netProfit)}">${thbSigned(r.netProfit)}</td>
              <td class="num ${tone(r.returnOnOwnMoney * 1000)}">${pctSigned(r.returnOnOwnMoney)}</td>
              <td class="num">${r.annualized === null ? '—' : pctSigned(r.annualized)}</td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;

  root.querySelectorAll<HTMLTableRowElement>('tr.is-pickable').forEach((tr) => {
    const pick = () => onPick(Number(tr.dataset.tier));
    tr.addEventListener('click', pick);
    tr.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick()));
  });
}

export function renderPrintInputs(root: HTMLElement, s: SimInputs) {
  const items: [string, string][] = [
    ['Yearly salary', thb(s.salary)],
    ['Tier', `Tier ${s.tierId}`],
    ['Purchase', `${s.purchaseDate} · ${eur(s.purchasePrice)} · ${num(s.purchaseFx, 2)} ฿/€`],
    ['Tax', `${s.taxDate} · ${eur(s.taxPrice)} · ${num(s.taxFx, 2)} ฿/€ · ${s.taxRate}% · ${s.taxMode === 'cash' ? 'paid in cash' : 'sell to cover'}`],
    ['Dividends', s.dividendsEnabled ? `${eur(s.dividendPerShare)}/share/yr · ${num(s.dividendFx, 2)} ฿/€ · ${s.dividendMode === 'cash' ? 'cash' : 'reinvested'}` : 'Not included'],
    ['Sale', `${s.saleDate} · ${eur(s.salePrice)} · ${num(s.saleFx, 2)} ฿/€`],
  ];
  root.innerHTML = `
    <h3>Simulation inputs</h3>
    <p class="muted">Generated ${new Date().toLocaleString('en-GB')}</p>
    <dl class="print-grid">${items.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>`;
}
