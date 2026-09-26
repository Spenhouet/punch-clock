import { describe, expect, it } from 'vitest';
import { autoBreakDeduction, Ledger, requiredBreak } from './calc';
import { defaultSettings } from '$lib/db';
import { atTime } from './time';
import type { Absence, Data, Segment, Settings } from './types';

let n = 0;
const id = () => `id${n++}`;

function work(date: string, from: string, to: string | null, kind: Segment['kind'] = 'work'): Segment {
  return { id: id(), date, kind, start: atTime(date, from), end: to ? atTime(date, to) : null, source: 'manual' };
}

function absence(date: string, type: Absence['type'], fraction: 1 | 0.5 = 1): Absence {
  return { id: id(), date, type, fraction };
}

function data(partial: Omit<Partial<Data>, 'settings'> & { settings?: Partial<Settings> } = {}): Data {
  return {
    segments: [],
    absences: [],
    notes: [],
    adjustments: [],
    vacationYears: [],
    schedules: [{ id: 's', validFrom: '1970-01-01', minutesPerWeekday: [480, 480, 480, 480, 480, 0, 0] }],
    ...partial,
    settings: { ...defaultSettings(), trackingStart: '2026-01-01', ...partial.settings }
  };
}

const NOW = atTime('2026-09-25', '18:00'); // Friday

describe('break rules', () => {
  it('requires breaks per ArbZG', () => {
    expect(requiredBreak(360)).toBe(0);
    expect(requiredBreak(361)).toBe(30);
    expect(requiredBreak(541)).toBe(45);
  });
  it('deducts no further than the threshold', () => {
    expect(autoBreakDeduction(370, 0)).toBe(10);
    expect(autoBreakDeduction(480, 0)).toBe(30);
    expect(autoBreakDeduction(480, 20)).toBe(10);
    expect(autoBreakDeduction(560, 30)).toBe(15);
    expect(autoBreakDeduction(480, 30)).toBe(0);
  });
});

describe('day summary', () => {
  it('sums work segments and treats gaps as pause', () => {
    const l = new Ledger(
      data({
        segments: [
          work('2026-09-21', '08:00', '12:00'),
          work('2026-09-21', '12:00', '12:30', 'break'),
          work('2026-09-21', '12:30', '17:00')
        ]
      }),
      NOW
    );
    const d = l.day('2026-09-21');
    expect(d.gross).toBe(510);
    expect(d.pause).toBe(30);
    expect(d.target).toBe(480);
    expect(d.delta).toBe(30);
    expect(d.warnings).toEqual([]);
  });

  it('subtracts an unplaced break from a work entry', () => {
    const seg = { ...work('2026-09-21', '08:00', '16:30'), breakMinutes: 30 };
    const d = new Ledger(data({ segments: [seg] }), NOW).day('2026-09-21');
    expect(d.gross).toBe(480);
    expect(d.pause).toBe(30);
    expect(d.warnings).toEqual([]);
  });

  it('counts a running segment until now', () => {
    const l = new Ledger(data({ segments: [work('2026-09-25', '10:00', null)] }), NOW);
    expect(l.day('2026-09-25').gross).toBe(480);
    expect(l.status).toBe('working');
  });

  it('gives public holidays a zero target', () => {
    const l = new Ledger(data({ settings: { state: 'BY' } }), NOW);
    const d = l.day('2026-10-03');
    expect(d.holiday).toBeTruthy();
    expect(d.target).toBe(0);
  });

  it('credits vacation and half days', () => {
    const l = new Ledger(
      data({ absences: [absence('2026-09-21', 'vacation'), absence('2026-09-22', 'vacation', 0.5)] }),
      NOW
    );
    expect(l.day('2026-09-21').target).toBe(0);
    expect(l.day('2026-09-22').target).toBe(240);
  });

  it('does not credit comp time, so it costs balance', () => {
    const l = new Ledger(data({ absences: [absence('2026-09-21', 'comp_time')] }), NOW);
    expect(l.day('2026-09-21').target).toBe(480);
    expect(l.day('2026-09-21').delta).toBe(-480);
  });

  it('auto-deducts missing breaks when enabled', () => {
    const l = new Ledger(
      data({ settings: { autoBreak: true }, segments: [work('2026-09-21', '08:00', '16:00')] }),
      NOW
    );
    expect(l.day('2026-09-21').worked).toBe(450);
    expect(l.day('2026-09-21').warnings).toContain('auto_break');
  });

  it('warns about short rest and long days', () => {
    const l = new Ledger(
      data({ segments: [work('2026-09-21', '08:00', '19:30'), work('2026-09-22', '05:00', '06:00')] }),
      NOW
    );
    expect(l.day('2026-09-21').warnings).toContain('over_10h');
    expect(l.day('2026-09-21').warnings).toContain('break_short');
    expect(l.day('2026-09-22').warnings).toContain('rest_short');
  });

  it('handles DST days', () => {
    const l = new Ledger(data({ segments: [work('2026-10-25', '01:00', '05:00')] }), atTime('2026-10-26', '12:00'));
    // Clocks go back at 03:00, so 01:00 to 05:00 is five real hours
    expect(l.day('2026-10-25').gross).toBe(300);
  });
});

describe('schedules', () => {
  it('applies the schedule valid on each day', () => {
    const l = new Ledger(
      data({
        schedules: [
          { id: 'a', validFrom: '1970-01-01', minutesPerWeekday: [480, 480, 480, 480, 480, 0, 0] },
          { id: 'b', validFrom: '2026-09-01', minutesPerWeekday: [360, 360, 360, 360, 0, 0, 0] }
        ]
      }),
      NOW
    );
    expect(l.day('2026-08-31').target).toBe(480);
    expect(l.day('2026-09-01').target).toBe(360);
    expect(l.day('2026-09-04').target).toBe(0);
  });
});

describe('balance', () => {
  it('sums deltas from tracking start plus adjustments', () => {
    const l = new Ledger(
      data({
        settings: { trackingStart: '2026-09-21' },
        segments: [work('2026-09-21', '08:00', '17:00'), work('2026-09-22', '08:00', '15:00')],
        absences: [absence('2026-09-23', 'vacation'), absence('2026-09-24', 'sick')],
        adjustments: [{ id: 'x', date: '2026-09-20', minutes: 600, reason: 'start' }]
      }),
      NOW
    );
    // +60, -60, 0, 0, and today (Friday) nothing yet
    expect(l.balanceAt('2026-09-24')).toBe(600);
    expect(l.balanceNow()).toBe(600);
    // Once the day is over, the missing Friday counts
    const later = new Ledger(l.data, atTime('2026-09-26', '09:00'));
    expect(later.balanceAt('2026-09-25')).toBe(120);
  });

  it('counts today only once positive, or as comp time', () => {
    const base = { settings: { trackingStart: '2026-09-25' } };
    const surplus = new Ledger(data({ ...base, segments: [work('2026-09-25', '07:00', '17:00')] }), NOW);
    expect(surplus.balanceNow()).toBe(120);
    const comp = new Ledger(data({ ...base, absences: [absence('2026-09-25', 'comp_time')] }), NOW);
    expect(comp.balanceNow()).toBe(-480);
  });

  it('counts days before tracking start only when something was recorded', () => {
    const l = new Ledger(
      data({
        settings: { trackingStart: '2026-09-24' },
        segments: [work('2026-09-21', '08:00', '20:00')],
        absences: [absence('2026-09-22', 'comp_time')]
      }),
      NOW
    );
    expect(l.day('2026-09-21').counted).toBe(true);
    expect(l.day('2026-09-23').counted).toBe(false);
    // +4:00 on Monday, -8:00 comp time on Tuesday, Wednesday not recorded
    expect(l.balanceAt('2026-09-23')).toBe(-240);
  });
});

describe('period', () => {
  it('summarizes a week', () => {
    const l = new Ledger(
      data({
        settings: { trackingStart: '2026-09-21' },
        segments: [work('2026-09-21', '08:00', '16:00'), work('2026-09-22', '09:00', '17:00')],
        absences: [absence('2026-09-23', 'vacation'), absence('2026-09-27', 'vacation')]
      }),
      atTime('2026-09-22', '20:00')
    );
    const p = l.period('2026-09-21', '2026-09-27');
    expect(p.target).toBe(4 * 480);
    expect(p.targetToDate).toBe(960);
    expect(p.worked).toBe(960);
    expect(p.delta).toBe(0);
    expect(p.daysWorked).toBe(2);
    // The Sunday vacation is not a workday, so it does not count
    expect(p.absenceDays.vacation).toBe(1);
    expect(p.avgStart).toBe(8.5 * 60);
  });
});

describe('vacation', () => {
  it('counts workdays only and carries over', () => {
    const l = new Ledger(
      data({
        settings: { trackingStart: '2025-01-01', defaultVacationDays: 30, state: 'BY' },
        absences: [
          absence('2025-12-22', 'vacation'),
          absence('2025-12-25', 'vacation'), // holiday
          absence('2025-12-27', 'vacation'), // Saturday
          absence('2026-09-21', 'vacation', 0.5),
          absence('2026-12-21', 'vacation')
        ],
        vacationYears: [{ year: 2026, entitlementDays: 28, carryOverDays: null, carryOverExpires: '2026-03-31' }]
      }),
      NOW
    );
    expect(l.vacation(2025).left).toBe(29);
    const v = l.vacation(2026);
    expect(v.carryOver).toBe(29);
    expect(v.carryOverLost).toBe(29);
    expect(v.taken).toBe(0.5);
    expect(v.planned).toBe(1);
    expect(v.left).toBe(28 - 1.5);
  });
});
