import { format as fmt } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { getLocale } from '$lib/paraglide/runtime';
import { fromDateKey } from '$lib/domain/time';
import type { DateKey, Timestamp } from '$lib/domain/types';

export { formatMinutes, formatDuration, toHHmm } from '$lib/domain/time';

export function dateLocale() {
  return getLocale() === 'de' ? de : enUS;
}

/** Patterns are written German style; English gets month-first order. */
function localizePattern(pattern: string): string {
  if (getLocale() === 'de') return pattern;
  return pattern
    .replace('d. MMMM yyyy', 'MMMM d, yyyy')
    .replace('d. MMM yyyy', 'MMM d, yyyy')
    .replace('d. MMMM', 'MMMM d')
    .replace('d. MMM', 'MMM d')
    .replace('dd.MM.', 'MM/dd');
}

export function formatDate(value: DateKey | Date | Timestamp, pattern: string): string {
  const d = typeof value === 'string' ? fromDateKey(value) : value;
  return fmt(d, localizePattern(pattern), { locale: dateLocale() });
}

/** Localized number with up to 2 decimals, e.g. `1,5` in German. */
export function formatNumber(n: number, digits = 1): string {
  return new Intl.NumberFormat(getLocale(), { maximumFractionDigits: digits }).format(n);
}

/** `HH:mm` from minutes since midnight. */
export function formatClock(minutes: number): string {
  const m = Math.round(minutes);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
