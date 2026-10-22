import './styles/tokens.css';
import './styles/glass.css';
import './styles/layout.css';
import './styles/print.css';

import { simulate } from './calc/simulate';
import { breakEvenSalePrice, compareTiers, sensitivityCurve, withoutBoost } from './calc/sensitivity';
import { validate } from './calc/validate';
import { renderSensitivity } from './charts/sensitivity';
import { Chart } from './charts/setup';
import { renderTierChart } from './charts/tiers';
import { renderWaterfall } from './charts/waterfall';
import { escapeHtml } from './format';
import { createStore } from './state';
import { createForm } from './ui/form';
import { renderKpis, renderPnl, renderPrintInputs, renderTierTable } from './ui/summary';
import { createTheme } from './ui/theme';
import { renderTimeline } from './ui/timeline';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const store = createStore();
const form = createForm(store);

const alertEl = $('#alert');
const resultsBody = $('#results-body');

function render() {
  const inputs = store.get();
  const issues = validate(inputs);
  form.sync(issues);

  if (issues.length) {
    alertEl.hidden = false;
    alertEl.innerHTML = `<strong>Fix ${issues.length === 1 ? 'this' : 'these'} to see your results</strong><ul>${issues
      .map((i) => `<li>${escapeHtml(i.message)}</li>`)
      .join('')}</ul>`;
    resultsBody.classList.add('is-stale');
    resultsBody.setAttribute('aria-hidden', 'true');
    return;
  }
  alertEl.hidden = true;
  resultsBody.classList.remove('is-stale');
  resultsBody.removeAttribute('aria-hidden');

  const result = simulate(inputs);
  const breakEven = breakEvenSalePrice(inputs);
  const curve = sensitivityCurve(inputs, breakEven);
  const tiers = compareTiers(inputs);
  const benchmark = withoutBoost(inputs);

  renderKpis($('#kpis'), { result, inputs, breakEven, benchmark });
  renderTimeline($('#timeline'), result);
  renderWaterfall($<HTMLCanvasElement>('#chart-waterfall'), result, inputs.dividendsEnabled && inputs.dividendPerShare > 0);
  renderSensitivity($<HTMLCanvasElement>('#chart-sensitivity'), curve, breakEven, { salePrice: inputs.salePrice, netProfit: result.netProfit }, inputs.purchasePrice);
  renderPnl($('#pnl'), result, inputs);
  renderTierChart($<HTMLCanvasElement>('#chart-tiers'), tiers, inputs.tierId);
  renderTierTable($('#tier-table'), tiers, inputs.tierId, (id) => {
    store.set({ tierId: id });
    document.querySelector<HTMLButtonElement>(`#tier-grid [data-tier="${id}"]`)?.focus({ preventScroll: true });
  });
  renderPrintInputs($('#print-inputs'), inputs);
}

let frame = 0;
const scheduleRender = () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(render);
};

store.subscribe(scheduleRender);
const theme = createTheme(() => scheduleRender());

$('#btn-reset').addEventListener('click', () => {
  if (!confirm('Reset all inputs to the defaults?')) return;
  store.reset();
  form.writeValues();
});

// Print in light colours with charts sized for paper.
let printTheme: ReturnType<typeof theme.get> | null = null;
window.addEventListener('beforeprint', () => {
  printTheme = theme.get();
  if (printTheme === 'dark') theme.force('light');
  render();
  Object.values(Chart.instances).forEach((c) => c.resize());
});
window.addEventListener('afterprint', () => {
  if (printTheme === 'dark') theme.force(null);
  printTheme = null;
  Object.values(Chart.instances).forEach((c) => c.resize());
});
$('#btn-print').addEventListener('click', () => window.print());

render();
