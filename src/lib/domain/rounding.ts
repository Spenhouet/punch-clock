import { MINUTE } from './time';
import type { Rounding, RoundingMode, Timestamp } from './types';

/**
 * Round a stamp to the configured step. `employer` mode rounds clock-in up and
 * clock-out down, so rounding never adds working time.
 */
export function roundStamp(ts: Timestamp, step: Rounding, mode: RoundingMode, direction: 'in' | 'out'): Timestamp {
  if (!step) return ts;
  const size = step * MINUTE;
  // Round relative to local wall time so steps line up with :00, :15, …
  const offset = new Date(ts).getTimezoneOffset() * MINUTE;
  const local = ts - offset;
  let rounded: number;
  if (mode === 'nearest') rounded = Math.round(local / size) * size;
  else if (direction === 'in') rounded = Math.ceil(local / size) * size;
  else rounded = Math.floor(local / size) * size;
  return rounded + offset;
}
