import type { TierComparison } from '../calc/sensitivity';
import { pctSigned, thb, thbCompact, thbSigned } from '../format';
import { alpha, baseOptions, palette, upsertChart, type AnyChart } from './setup';

let chart: AnyChart | null = null;

export function renderTierChart(canvas: HTMLCanvasElement, rows: TierComparison[], selectedId: number) {
  const p = palette();
  const dim = (color: string, i: number, strong = 0.9) => alpha(color, rows[i].eligible ? (rows[i].tier.id === selectedId ? 1 : strong) : 0.22);

  chart = upsertChart(chart, canvas, {
    type: 'bar',
    data: {
      labels: rows.map((r) => `Tier ${r.tier.id}`),
      datasets: [
        {
          label: 'You pay',
          data: rows.map((r) => r.result.ownCashOut),
          backgroundColor: rows.map((_, i) => dim(p.neutral, i, 0.7)),
          borderRadius: 8,
          borderSkipped: false,
          yAxisID: 'y',
          order: 2,
        },
        {
          label: 'Net profit',
          data: rows.map((r) => r.result.netProfit),
          backgroundColor: rows.map((r, i) => dim(r.result.netProfit >= 0 ? p.pos : p.neg, i, 0.75)),
          borderRadius: 8,
          borderSkipped: false,
          yAxisID: 'y',
          order: 2,
        },
        {
          type: 'line',
          label: 'Return on your money',
          data: rows.map((r) => r.result.returnOnOwnMoney * 100),
          borderColor: p.accent,
          backgroundColor: p.accent,
          pointBackgroundColor: rows.map((_, i) => (rows[i].eligible ? p.accent : alpha(p.accent, 0.3))),
          pointRadius: rows.map((r) => (r.tier.id === selectedId ? 7 : 4)),
          borderWidth: 2,
          tension: 0.3,
          yAxisID: 'y1',
          order: 1,
        },
      ],
    },
    options: {
      ...baseOptions(p),
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: (ctx) => (rows[ctx.index]?.eligible ? p.text : p.text2) } },
        y: {
          border: { display: false },
          grid: { color: (ctx) => (ctx.tick.value === 0 ? p.gridStrong : p.grid) },
          ticks: { color: p.text2, callback: (v) => thbCompact(Number(v)) },
        },
        y1: {
          position: 'right',
          border: { display: false },
          grid: { display: false },
          ticks: { color: p.accent, callback: (v) => `${Number(v).toFixed(0)}%` },
        },
      },
      plugins: {
        ...baseOptions(p).plugins,
        legend: { ...baseOptions(p).plugins.legend, display: true, position: 'bottom' },
        tooltip: {
          ...baseOptions(p).plugins.tooltip,
          callbacks: {
            title: (items) => {
              const r = rows[items[0].dataIndex];
              return `Tier ${r.tier.id}${r.eligible ? '' : ' (above your salary cap)'}`;
            },
            label: (ctx) => {
              const r = rows[ctx.dataIndex].result;
              if (ctx.datasetIndex === 0) return `You pay: ${thb(r.ownCashOut)}`;
              if (ctx.datasetIndex === 1) return `Net profit: ${thbSigned(r.netProfit)}`;
              return `Return: ${pctSigned(r.returnOnOwnMoney)}`;
            },
          },
        },
      },
    },
  });
  return chart;
}
