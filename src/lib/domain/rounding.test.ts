import { describe, expect, it } from 'vitest';
import { roundStamp } from './rounding';
import { atTime, toHHmm } from './time';

const t = (hhmm: string) => atTime('2026-09-21', hhmm) + 20_000;

describe('roundStamp', () => {
  it('keeps the stamp without rounding', () => {
    expect(roundStamp(t('08:07'), 0, 'nearest', 'in')).toBe(t('08:07'));
  });
  it('rounds to the nearest step', () => {
    expect(toHHmm(roundStamp(t('08:07'), 15, 'nearest', 'in'))).toBe('08:00');
    expect(toHHmm(roundStamp(t('08:08'), 15, 'nearest', 'in'))).toBe('08:15');
    expect(toHHmm(roundStamp(t('08:07'), 5, 'nearest', 'out'))).toBe('08:05');
    expect(toHHmm(roundStamp(t('08:07'), 10, 'nearest', 'out'))).toBe('08:10');
  });
  it('rounds in up and out down in employer mode', () => {
    expect(toHHmm(roundStamp(t('08:01'), 15, 'employer', 'in'))).toBe('08:15');
    expect(toHHmm(roundStamp(t('16:59'), 15, 'employer', 'out'))).toBe('16:45');
  });
});
