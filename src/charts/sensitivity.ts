import type { SensitivityPoint } from '../calc/sensitivity';
import { eur, thbCompact, thbSigned } from '../format';
import { alpha, baseOptions, palette, upsertChart, type AnyChart } from './setup';

let chart: AnyChart | null = null;

interface Marker {
  x: number;
  label: string;
  kind: 'breakeven' | 'current' | 'purchase';
}
// Read by the marker plugin, which is registered once at chart creation.
let currentMarkers: Marker[] = [];

export function renderSensitivity(
  canvas: HTMLCanvasElement,
  points: SensitivityPoint[],
  breakEven: number | null,
  current: { salePrice: number; netProfit: number },
  purchasePrice: number,
) {
  const p = palette();
  currentMarkers = [
    { x: purchasePrice, label: `Bought ${eur(purchasePrice)}`, kind: 'purchase' },
    ...(breakEven !== null && breakEven > 0 ? [{ x: breakEven, label: `Break-even ${eur(breakEven)}`, kind: 'breakeven' as const }] : []),
    { x: current.salePrice, label: `Your sale ${eur(current.salePrice)}`, kind: 'current' },
  ];

  chart = upsertChart(chart, canvas, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Net profit',
          data: points.map((pt) => ({ x: pt.salePrice, y: pt.netProfit })),
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.25,
          fill: { target: 'origin', above: alpha(p.pos, 0.16), below: alpha(p.neg, 0.16) },
          segment: {
            borderColor: (ctx) => ((ctx.p0.parsed.y ?? 0) + (ctx.p1.parsed.y ?? 0) >= 0 ? p.pos : p.neg),
          },
          borderColor: p.pos,
        },
        {
          label: 'Your sale',
          data: [{ x: current.salePrice, y: current.netProfit }],
          pointRadius: 7,
          pointHoverRadius: 8,
          pointBackgroundColor: p.accent,
          pointBorderColor: p.surface,
          pointBorderWidth: 3,
          showLine: false,
        },
      ],
    },
    options: {
      ...baseOptions(p),
      interaction: { mode: 'nearest', intersect: false, axis: 'x' },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Sale price (EUR per share)', color: p.text2 },
          grid: { color: p.grid },
          border: { display: false },
          ticks: { color: p.text2, callback: (v) => `€${Number(v).toFixed(0)}` },
        },
        y: {
          title: { display: true, text: 'Net profit (THB)', color: p.text2 },
          border: { display: false },
          grid: { color: (ctx) => (ctx.tick.value === 0 ? p.gridStrong : p.grid), lineWidth: (ctx) => (ctx.tick.value === 0 ? 2 : 1) },
          ticks: { color: p.text2, callback: (v) => thbCompact(Number(v)) },
        },
      },
      plugins: {
        ...baseOptions(p).plugins,
        tooltip: {
          ...baseOptions(p).plugins.tooltip,
          callbacks: {
            title: (items) => `Sell at ${eur(items[0].parsed.x ?? 0)}`,
            label: (ctx) => `${ctx.datasetIndex === 1 ? 'Your sale' : 'Net profit'}: ${thbSigned(ctx.parsed.y ?? 0)}`,
          },
        },
      },
    },
    plugins: [
      {
        id: 'priceMarkers',
        afterDatasetsDraw(c) {
          const { ctx, chartArea, scales } = c;
          const pal = palette();
          ctx.save();
          ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", system-ui, sans-serif';
          const placed: { x: number; w: number; row: number }[] = [];
          for (const m of currentMarkers) {
            const x = scales.x.getPixelForValue(m.x);
            if (x < chartArea.left || x > chartArea.right) continue;
            const color = m.kind === 'breakeven' ? pal.orange : m.kind === 'current' ? pal.accent : pal.text2;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash(m.kind === 'current' ? [] : [5, 4]);
            ctx.beginPath();
            ctx.moveTo(x, chartArea.top + 18);
            ctx.lineTo(x, chartArea.bottom);
            ctx.stroke();

            // Avoid overlapping labels by stacking them.
            const w = ctx.measureText(m.label).width + 14;
            let row = 0;
            while (placed.some((pl) => pl.row === row && Math.abs(pl.x - x) < (pl.w + w) / 2 + 4)) row++;
            placed.push({ x, w, row });
            const lx = Math.min(Math.max(x - w / 2, chartArea.left), chartArea.right - w);
            const ly = chartArea.top + row * 22;
            ctx.setLineDash([]);
            ctx.fillStyle = alpha(color.startsWith('#') ? color : '#888888', 0.14);
            ctx.beginPath();
            ctx.roundRect(lx, ly, w, 18, 9);
            ctx.fill();
            ctx.fillStyle = color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(m.label, lx + 7, ly + 9.5);
          }
          ctx.restore();
        },
      },
    ],
  });
  return chart;
}
