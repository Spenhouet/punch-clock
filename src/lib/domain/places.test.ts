import { describe, expect, it } from 'vitest';
import { fallbackPlace, placeForSsid, placeName } from './places';
import type { Place, Segment } from './types';

const places: Place[] = [
  { id: 'office', name: 'Office', ssids: ['corp', 'corp-guest'] },
  { id: 'home', name: 'Home', ssids: ['home-net'] },
  { id: 'old', name: 'Old office', ssids: ['old-net'], archived: true }
];
const settings = { places, defaultPlace: 'home' };

const work = (start: number, placeId?: string): Segment => ({
  id: String(start),
  date: '2026-09-21',
  kind: 'work',
  start,
  end: start + 1,
  source: 'button',
  placeId
});

describe('places', () => {
  it('finds the place by Wi-Fi, ignoring archived places', () => {
    expect(placeForSsid(settings, 'corp-guest')).toBe('office');
    expect(placeForSsid(settings, ' home-net ')).toBe('home');
    expect(placeForSsid(settings, 'old-net')).toBeUndefined();
    expect(placeForSsid(settings, null)).toBeUndefined();
  });

  it('continues the place of the previous entry that day, else uses the default', () => {
    expect(fallbackPlace(settings, [work(1, 'office')], '2026-09-21', 5)).toBe('office');
    expect(fallbackPlace(settings, [work(9, 'office')], '2026-09-21', 5)).toBe('home');
    expect(fallbackPlace(settings, [work(1, 'old')], '2026-09-21', 5)).toBe('home');
    expect(fallbackPlace({ places, defaultPlace: '' }, [], '2026-09-21', 5)).toBeUndefined();
    expect(fallbackPlace({ places: [], defaultPlace: 'home' }, [], '2026-09-21', 5)).toBeUndefined();
  });

  it('still names archived places', () => {
    expect(placeName(settings, 'old')).toBe('Old office');
    expect(placeName(settings, 'missing')).toBe('');
  });
});
