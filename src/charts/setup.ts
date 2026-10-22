import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type ChartType,
  type DefaultDataPoint,
} from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, Filler, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip);

export interface Palette {
  text: string;
  text2: string;
  grid: string;
  gridStrong: string;
  pos: string;
  neg: string;
  accent: string;
  purple: string;
  orange: string;
  neutral: string;
  surface: string;
}

export function palette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    text: v('--text'),
    text2: v('--text-2'),
    grid: v('--chart-grid'),
    gridStrong: v('--chart-grid-strong'),
    pos: v('--pos'),
    neg: v('--neg'),
    accent: v('--accent'),
    purple: v('--purple'),
    orange: v('--orange'),
    neutral: v('--chart-neutral'),
    surface: v('--surface-solid'),
  };
}

/** Hex (#rrggbb) to rgba with alpha. */
export function alpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})`;
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function baseOptions(p: Palette) {
  Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", system-ui, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = p.text2;
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: reducedMotion.matches ? (false as const) : { duration: 450 },
    plugins: {
      legend: { display: false, labels: { color: p.text2, usePointStyle: true, pointStyle: 'circle' as const, boxWidth: 8, boxHeight: 8, padding: 16 } },
      tooltip: {
        backgroundColor: p.surface,
        titleColor: p.text,
        bodyColor: p.text,
        borderColor: p.grid,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        boxPadding: 4,
        usePointStyle: true,
        titleFont: { weight: 600 as const },
      },
    },
  };
}

/** Creates the chart on first call, otherwise swaps data/options and updates in place. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyChart = Chart<any, any, any>;

export function upsertChart<TType extends ChartType, TData = DefaultDataPoint<TType>>(
  existing: AnyChart | null,
  canvas: HTMLCanvasElement,
  config: ChartConfiguration<TType, TData>,
): AnyChart {
  if (!existing) return new Chart(canvas, config);
  existing.data = config.data;
  existing.options = config.options ?? {};
  existing.update();
  return existing;
}

export { Chart };
