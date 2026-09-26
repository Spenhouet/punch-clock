import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear
} from 'date-fns';
import type { DateKey, Timestamp } from './types';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

export function toDateKey(value: Date | Timestamp): DateKey {
  return format(value, 'yyyy-MM-dd');
}

export function fromDateKey(key: DateKey): Date {
  return parseISO(key);
}

export function todayKey(now: Timestamp = Date.now()): DateKey {
  return toDateKey(now);
}

export function addDaysKey(key: DateKey, days: number): DateKey {
  return toDateKey(addDays(fromDateKey(key), days));
}

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(key: DateKey): number {
  return (fromDateKey(key).getDay() + 6) % 7;
}

export function daysBetween(from: DateKey, to: DateKey): DateKey[] {
  if (to < from) return [];
  return eachDayOfInterval({ start: fromDateKey(from), end: fromDateKey(to) }).map(toDateKey);
}

export type PeriodKind = 'week' | 'month' | 'year';

export interface Period {
  kind: PeriodKind;
  start: DateKey;
  end: DateKey;
}

export function periodOf(kind: PeriodKind, anchor: DateKey): Period {
  const d = fromDateKey(anchor);
  const [s, e] =
    kind === 'week'
      ? [startOfWeek(d, { weekStartsOn: 1 }), endOfWeek(d, { weekStartsOn: 1 })]
      : kind === 'month'
        ? [startOfMonth(d), endOfMonth(d)]
        : [startOfYear(d), endOfYear(d)];
  return { kind, start: toDateKey(s), end: toDateKey(e) };
}

export function shiftPeriod(period: Period, steps: number): Period {
  const d = fromDateKey(period.start);
  if (period.kind === 'week') return periodOf('week', toDateKey(addDays(d, 7 * steps)));
  if (period.kind === 'month') return periodOf('month', toDateKey(new Date(d.getFullYear(), d.getMonth() + steps, 1)));
  return periodOf('year', toDateKey(new Date(d.getFullYear() + steps, 0, 1)));
}

export function isoWeek(key: DateKey): { week: number; year: number } {
  const d = fromDateKey(key);
  return { week: getISOWeek(d), year: getISOWeekYear(d) };
}

/** Combine a day and `HH:mm` into a timestamp in local time. */
export function atTime(key: DateKey, hhmm: string): Timestamp {
  const [h, m] = hhmm.split(':').map(Number);
  const d = fromDateKey(key);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export function toHHmm(ts: Timestamp): string {
  return format(ts, 'HH:mm');
}

/** `+1:05`, `-0:30`, `7:45`. */
export function formatMinutes(minutes: number, opts: { sign?: boolean } = {}): string {
  const rounded = Math.round(minutes);
  const abs = Math.abs(rounded);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = rounded < 0 ? '−' : opts.sign ? '+' : '';
  return `${sign}${h}:${String(m).padStart(2, '0')}`;
}

/** Decimal hours for CSV, e.g. `7.75`. */
export function toDecimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function formatDuration(ms: number, withSeconds = false): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const base = `${h}:${String(m).padStart(2, '0')}`;
  return withSeconds ? `${base}:${String(s).padStart(2, '0')}` : base;
}
