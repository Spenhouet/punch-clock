import { describe, expect, it } from 'vitest';
import { deviationLevel } from './deviation';

describe('deviationLevel', () => {
  it('is ok near target in both directions', () => {
    expect(deviationLevel(0)).toBe('ok');
    expect(deviationLevel(30)).toBe('ok');
    expect(deviationLevel(-30)).toBe('ok');
  });
  it('warns, then flags large differences either way', () => {
    expect(deviationLevel(45)).toBe('warn');
    expect(deviationLevel(-45)).toBe('warn');
    expect(deviationLevel(120)).toBe('bad');
    expect(deviationLevel(-120)).toBe('bad');
  });
  it('uses wider bands for longer periods', () => {
    expect(deviationLevel(120, 'week')).toBe('warn');
    expect(deviationLevel(120, 'month')).toBe('ok');
    expect(deviationLevel(30 * 60, 'balance')).toBe('warn');
  });
});
