import { describe, expect, it } from 'vitest';
import { fallbackPlace, placeForSsid, placeName, triggerPlaces } from './places';
import { migrateSettings } from '$lib/db';
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

describe('migration of the single work Wi-Fi', () => {
  const legacy = {
    enabled: true,
    ssid: 'corp',
    mode: 'auto' as const,
    clockOutOnDisconnect: true,
    graceMinutes: 10,
    breakWindow: true,
    breakFrom: '12:00',
    breakTo: '13:00'
  };

  it('moves it onto the place that lists the network', () => {
    const out = migrateSettings({ wifi: legacy, places: [{ id: 'office', name: 'Office', ssids: ['corp'] }] });
    expect(out).not.toHaveProperty('wifi');
    expect(out.places).toEqual([
      {
        id: 'office',
        name: 'Office',
        ssids: ['corp'],
        trigger: {
          enabled: true,
          mode: 'auto',
          clockOutOnDisconnect: true,
          graceMinutes: 10,
          breakWindow: true,
          breakFrom: '12:00',
          breakTo: '13:00'
        }
      }
    ]);
  });

  it('creates a stable place when no place lists it', () => {
    const a = migrateSettings({ wifi: legacy });
    const b = migrateSettings({ wifi: legacy });
    expect(a.places).toEqual(b.places);
    expect(a.places?.[0]).toMatchObject({ id: 'wifi-corp', name: 'corp', ssids: ['corp'] });
    expect(triggerPlaces({ places: a.places! }).map((p) => p.id)).toEqual(['wifi-corp']);
  });

  it('drops an empty Wi-Fi setting', () => {
    expect(migrateSettings({ wifi: { ...legacy, ssid: '' }, places: [] })).toEqual({ places: [] });
  });
});
