import type { SimResult } from '../calc/types';
import { daysBetween } from '../calc/dates';
import { date } from '../format';

interface Marker {
  date: Date;
  labels: string[];
}

export function renderTimeline(root: HTMLElement, r: SimResult) {
  const raw: [Date, string][] = [
    [r.purchaseDate, 'Purchase'],
    [r.taxDate, 'Tax'],
    [r.vestingDate, 'Unlocked'],
    [r.saleDate, 'Sale'],
  ];
  const markers: Marker[] = [];
  for (const [d, label] of raw.sort((a, b) => a[0].getTime() - b[0].getTime())) {
    const same = markers.find((m) => m.date.getTime() === d.getTime());
    if (same) same.labels.push(label);
    else markers.push({ date: d, labels: [label] });
  }

  const start = r.purchaseDate;
  const end = markers[markers.length - 1].date;
  const span = Math.max(daysBetween(start, end), 1);
  const pos = (d: Date) => (daysBetween(start, d) / span) * 100;
  const lockEnd = Math.min(pos(r.vestingDate), 100);

  root.innerHTML = `
    <div class="tl-track">
      <div class="tl-lock" style="width:${lockEnd}%"><span>Locked ${Math.round(daysBetween(start, r.vestingDate) / 365.25)} yrs</span></div>
      ${markers
        .map((m, i) => {
          const kind = m.labels.includes('Sale') ? 'sale' : m.labels.includes('Tax') ? 'tax' : m.labels.includes('Purchase') ? 'buy' : 'vest';
          const align = i === 0 ? 'start' : i === markers.length - 1 ? 'end' : 'mid';
          const flip = markers.length > 2 && i % 2 === 1 ? 'below' : 'above';
          return `<div class="tl-marker tl-${kind} tl-${align} tl-${flip}" style="left:${pos(m.date)}%">
              <span class="tl-dot"></span>
              <span class="tl-label"><b>${m.labels.join(' · ')}</b><small>${date(m.date)}</small></span>
            </div>`;
        })
        .join('')}
    </div>`;
}
