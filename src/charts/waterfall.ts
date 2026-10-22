import type { SimResult } from '../calc/types';
import { thb, thbCompact, thbSigned } from '../format';
import { alpha, baseOptions, palette, upsertChart, type AnyChart } from './setup';

let chart: AnyChart | null = null;
type Step = { label: string; delta: number; kind: 'base' | 'step' | 'total'; color?: string };
// Read by the label plugin, which is registered once at chart creation.
let currentSteps: Step[] = [];

export function renderWaterfall(canvas: HTMLCanvasElement, r: SimResult, showDividends: boolean) {
  const p = palette();
  const b = r.breakdown;
  const steps: Step[] = [
    { label: 'You put in', delta: b.contribution, kind: 'base', color: p.accent },
    { label: 'Company match', delta: b.match, kind: 'step', color: p.purple },
    { label: 'Share price', delta: b.price, kind: 'step' },
    { label: 'Exchange rate', delta: b.fx, kind: 'step' },
  ];
  if (showDividends) steps.push({ label: 'Dividends', delta: b.dividends, kind: 'step' });
  steps.push({ label: 'Tax', delta: b.tax, kind: 'step' });
  steps.push({ label: 'You take home', delta: b.finalValue, kind: 'total' });

  let running = 0;
  const bars = steps.map((s) => {
    let range: [number, number];
    if (s.kind === 'base' || s.kind === 'total') {
      range = [0, s.delta];
      running = s.delta;
    } else {
      range = [running, running + s.delta];
      running += s.delta;
    }
    const color = s.color ?? (s.kind === 'total' ? (b.finalValue >= b.contribution ? p.pos : p.neg) : s.delta >= 0 ? p.pos : p.neg);
    return { range, color, step: s };
  });

  const profit = b.finalValue - b.contribution;
  currentSteps = steps;

  chart = upsertChart(chart, canvas, {
    type: 'bar',
    data: {
      labels: steps.map((s) => s.label),
      datasets: [
        {
          data: bars.map((x) => x.range),
          backgroundColor: bars.map((x) => alpha(x.color, x.step.kind === 'step' ? 0.85 : 1)),
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 64,
        },
      ],
    },
    options: {
      ...baseOptions(p),
      scales: {
        x: { grid: { display: false }, ticks: { color: p.text2 }, border: { display: false } },
        y: {
          beginAtZero: true,
          grace: '10%',
          grid: { color: p.grid },
          border: { display: false },
          ticks: { color: p.text2, callback: (v) => thbCompact(Number(v)) },
        },
      },
      plugins: {
        ...baseOptions(p).plugins,
        tooltip: {
          ...baseOptions(p).plugins.tooltip,
          callbacks: {
            label: (ctx) => {
              const s = bars[ctx.dataIndex].step;
              if (s.kind === 'base') return `Your contribution: ${thb(s.delta)}`;
              if (s.kind === 'total') return [`Final value: ${thb(s.delta)}`, `Net ${profit >= 0 ? 'profit' : 'loss'}: ${thbSigned(profit)}`];
              return `${s.label}: ${thbSigned(s.delta)}`;
            },
          },
        },
      },
    },
    plugins: [
      {
        id: 'barValueLabels',
        afterDatasetsDraw(c) {
          const { ctx } = c;
          const meta = c.getDatasetMeta(0);
          const pal = palette();
          ctx.save();
          ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", system-ui, sans-serif';
          ctx.textAlign = 'center';
          meta.data.forEach((el, i) => {
            const s = currentSteps[i];
            if (!s) return;
            const text = s.kind === 'step' ? thbSigned(s.delta) : thb(s.delta);
            const { x, y, base } = el.getProps(['x', 'y', 'base'], true) as { x: number; y: number; base: number };
            const top = Math.min(y, base);
            ctx.fillStyle = s.kind === 'step' ? (s.delta >= 0 ? pal.pos : pal.neg) : pal.text;
            ctx.fillText(text, x, top - 6);
          });
          ctx.restore();
        },
      },
    ],
  });
  return chart;
}
