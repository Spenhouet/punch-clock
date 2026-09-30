import type { Ledger } from '$lib/domain/calc';
import { daysBetween, toDecimalHours, toHHmm } from '$lib/domain/time';
import { absenceLabel } from '$lib/labels';
import { placeName } from '$lib/domain/places';
import { m } from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime';
import { formatDate } from '$lib/format';

interface CsvStyle {
  sep: string;
  decimal: string;
}

function style(): CsvStyle {
  return getLocale() === 'de' ? { sep: ';', decimal: ',' } : { sep: ',', decimal: '.' };
}

function cell(value: string | number, s: CsvStyle): string {
  const text = typeof value === 'number' ? String(value).replace('.', s.decimal) : value;
  return text.includes(s.sep) || /["\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: (string | number)[][]): string {
  const s = style();
  // BOM so Excel opens UTF-8 correctly
  return '﻿' + rows.map((r) => r.map((v) => cell(v, s)).join(s.sep)).join('\r\n') + '\r\n';
}

/** One row per day, like a paper timesheet. Hours as decimals for spreadsheets. */
export function daysCsv(ledger: Ledger, start: string, end: string): string {
  const rows: (string | number)[][] = [
    [
      m.date(),
      m.weekday(),
      m.from(),
      m.to(),
      m.pause_hours(),
      m.worked_hours(),
      m.target_hours(),
      m.difference_hours(),
      m.absence(),
      m.holiday(),
      m.place(),
      m.note()
    ]
  ];
  for (const date of daysBetween(start, end)) {
    const d = ledger.day(date);
    rows.push([
      date,
      formatDate(date, 'EEEE'),
      d.first !== undefined ? toHHmm(d.first) : '',
      d.last !== undefined && !d.running ? toHHmm(d.last) : '',
      toDecimalHours(d.pause),
      toDecimalHours(d.worked),
      toDecimalHours(d.target),
      d.counted ? toDecimalHours(d.delta) : '',
      d.absences
        .map((a) => `${absenceLabel(a.type)}${a.fraction === 0.5 ? ' ½' : ''}${a.label ? ` (${a.label})` : ''}`)
        .join(', '),
      d.holiday ?? '',
      [...new Set(d.segments.filter((s) => s.kind === 'work').map((s) => placeName(ledger.settings, s.placeId)))]
        .filter(Boolean)
        .join(', '),
      d.note ?? ''
    ]);
  }
  return toCsv(rows);
}

/** One row per recorded segment. */
export function entriesCsv(ledger: Ledger, start: string, end: string): string {
  const rows: (string | number)[][] = [
    [m.date(), m.type(), m.from(), m.to(), m.duration_hours(), m.place(), m.note(), m.source()]
  ];
  const segs = ledger.data.segments.filter((s) => s.date >= start && s.date <= end).sort((a, b) => a.start - b.start);
  for (const s of segs) {
    const endTs = s.end ?? ledger.now;
    rows.push([
      s.date,
      s.kind === 'work' ? m.kind_work() : m.kind_break(),
      toHHmm(s.start),
      s.end ? toHHmm(s.end) : '',
      toDecimalHours((endTs - s.start) / 60_000 - (s.breakMinutes ?? 0)),
      placeName(ledger.settings, s.placeId),
      s.note ?? '',
      s.source
    ]);
  }
  return toCsv(rows);
}
