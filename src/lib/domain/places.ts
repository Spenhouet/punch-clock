import type { Place, Segment, Settings, Timestamp, WifiTrigger } from './types';

/** Places that can be picked for new entries. */
export function activePlaces(settings: Pick<Settings, 'places'>): Place[] {
  return settings.places.filter((p) => !p.archived);
}

export function placeName(settings: Pick<Settings, 'places'>, id: string | undefined): string {
  if (!id) return '';
  return settings.places.find((p) => p.id === id)?.name ?? '';
}

/** The active place that lists this Wi-Fi network. */
export function placeForSsid(settings: Pick<Settings, 'places'>, ssid: string | null | undefined): string | undefined {
  const s = ssid?.trim();
  if (!s) return undefined;
  return activePlaces(settings).find((p) => p.ssids.includes(s))?.id;
}

/**
 * Place for a work entry starting at `start` when no Wi-Fi decides it: the place of the
 * previous work entry that day (back from a break), else the default place.
 */
export function fallbackPlace(
  settings: Pick<Settings, 'places' | 'defaultPlace'>,
  segments: Segment[],
  date: string,
  start: Timestamp
): string | undefined {
  const active = activePlaces(settings);
  if (!active.length) return undefined;
  const previous = segments
    .filter((s) => s.kind === 'work' && s.date === date && s.start < start && s.placeId)
    .sort((a, b) => b.start - a.start)[0];
  if (previous?.placeId && active.some((p) => p.id === previous.placeId)) return previous.placeId;
  return active.some((p) => p.id === settings.defaultPlace) ? settings.defaultPlace : undefined;
}

export function defaultTrigger(): WifiTrigger {
  return {
    enabled: false,
    mode: 'ask',
    clockOutOnDisconnect: true,
    graceMinutes: 5,
    breakWindow: false,
    breakFrom: '12:00',
    breakTo: '13:30'
  };
}

/** Places whose Wi-Fi clocks in and out. */
export function triggerPlaces(settings: Pick<Settings, 'places'>): (Place & { trigger: WifiTrigger })[] {
  return activePlaces(settings).filter(
    (p): p is Place & { trigger: WifiTrigger } => !!p.trigger?.enabled && p.ssids.length > 0
  );
}
