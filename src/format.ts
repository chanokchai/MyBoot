const thbFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const eurFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sharesFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const MINUS = '\u2212';

export function thb(n: number): string {
  const v = Math.round(n);
  return `${v < 0 ? MINUS : ''}฿${thbFmt.format(Math.abs(v))}`;
}

export function thbSigned(n: number): string {
  const v = Math.round(n);
  if (v === 0) return '฿0';
  return `${v > 0 ? '+' : MINUS}฿${thbFmt.format(Math.abs(v))}`;
}

export function thbCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? MINUS : '';
  if (abs >= 1_000_000) return `${sign}฿${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}฿${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return `${sign}฿${abs.toFixed(0)}`;
}

export function eur(n: number): string {
  return `${n < 0 ? MINUS : ''}€${eurFmt.format(Math.abs(n))}`;
}

export function pct(ratio: number, digits = 1): string {
  const v = ratio * 100;
  return `${v < 0 ? MINUS : ''}${Math.abs(v).toFixed(digits)}%`;
}

export function pctSigned(ratio: number, digits = 1): string {
  const v = ratio * 100;
  if (Math.abs(v) < 0.05) return `0.0%`;
  return `${v > 0 ? '+' : MINUS}${Math.abs(v).toFixed(digits)}%`;
}

export function shares(n: number): string {
  return sharesFmt.format(n);
}

export function num(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function date(d: Date): string {
  return dateFmt.format(d);
}

export function years(n: number): string {
  return `${n.toFixed(1)} yr${Math.abs(n - 1) < 0.05 ? '' : 's'}`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
