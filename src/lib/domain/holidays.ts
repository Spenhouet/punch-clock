import { getHolidays } from 'feiertagejs';
import type { DateKey } from './types';

export const STATES = [
  'BW',
  'BY',
  'BE',
  'BB',
  'HB',
  'HH',
  'HE',
  'MV',
  'NI',
  'NW',
  'RP',
  'SL',
  'SN',
  'ST',
  'SH',
  'TH',
  'AUGSBURG',
  'BUND'
] as const;

export const STATE_NAMES: Record<string, string> = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
  AUGSBURG: 'Augsburg',
  BUND: 'Bundesweit'
};

const cache = new Map<string, Map<DateKey, string>>();

type Lang = 'de' | 'en';

/** Public holidays of a year as `date → localized name`. */
export function holidaysOf(year: number, state: string, lang: Lang = 'de'): Map<DateKey, string> {
  if (!state || state === 'none') return new Map();
  const key = `${year}:${state}:${lang}`;
  let map = cache.get(key);
  if (!map) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = getHolidays(year, state as any);
    map = new Map(list.map((h) => [h.dateString as DateKey, h.translate(lang) ?? h.name]));
    cache.set(key, map);
  }
  return map;
}

export function holidayName(date: DateKey, state: string, lang: Lang = 'de'): string | undefined {
  return holidaysOf(Number(date.slice(0, 4)), state, lang).get(date);
}
