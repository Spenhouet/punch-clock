/**
 * How far a difference is from target. Green means on target; both directions
 * turn amber and then red, because working far too much is as much a problem
 * as working far too little. Bands are in minutes and grow with the period.
 */
export type DeviationScale = 'day' | 'week' | 'month' | 'year' | 'balance';
export type DeviationLevel = 'ok' | 'warn' | 'bad';

export const DEVIATION_BANDS: Record<DeviationScale, [ok: number, warn: number]> = {
  day: [30, 90],
  week: [90, 240],
  month: [180, 600],
  year: [600, 2400],
  balance: [600, 2400]
};

export function deviationLevel(minutes: number, scale: DeviationScale = 'day'): DeviationLevel {
  const [ok, warn] = DEVIATION_BANDS[scale];
  const abs = Math.abs(Math.round(minutes));
  return abs <= ok ? 'ok' : abs <= warn ? 'warn' : 'bad';
}

export const deviationText: Record<DeviationLevel, string> = {
  ok: 'text-positive',
  warn: 'text-warning',
  bad: 'text-negative'
};

/** Scale for a period summary by its length in days. */
export function scaleForDays(days: number): DeviationScale {
  return days <= 7 ? 'week' : days <= 31 ? 'month' : 'year';
}
