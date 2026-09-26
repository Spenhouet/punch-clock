import { beforeEach, describe, expect, it } from 'vitest';
import { PunchClockDB, ensureDefaults, saveSettings } from './index';
import { clockIn, clockOut, endBreak, reconcile, startBreak } from './clock';
import { atTime } from '$lib/domain/time';

let database: PunchClockDB;
const at = (hhmm: string) => atTime('2026-09-21', hhmm);

beforeEach(async () => {
  database = new PunchClockDB(`test-${crypto.randomUUID()}`);
  await ensureDefaults(database);
});

describe('clock actions', () => {
  it('runs a full day with a break', async () => {
    await clockIn(at('08:00'), 'button', database);
    await startBreak(at('12:00'), undefined, 'button', database);
    await endBreak(at('12:30'), 'button', database);
    await clockOut(at('17:00'), 'button', database);
    const segs = (await database.segments.toArray()).sort((a, b) => a.start - b.start);
    expect(segs.map((s) => [s.kind, s.end! - s.start])).toEqual([
      ['work', 4 * 3600_000],
      ['break', 30 * 60_000],
      ['work', 4.5 * 3600_000]
    ]);
  });

  it('does not clock in twice', async () => {
    await clockIn(at('08:00'), 'button', database);
    expect(await clockIn(at('09:00'), 'button', database)).toBeUndefined();
    expect(await database.segments.count()).toBe(1);
  });

  it('ends timed breaks by itself', async () => {
    await clockIn(at('08:00'), 'button', database);
    await startBreak(at('12:00'), 30, 'button', database);
    expect(await reconcile(at('12:10'), database)).toBe(false);
    expect(await reconcile(at('13:00'), database)).toBe(true);
    const running = await database.segments.filter((s) => s.end === null).first();
    expect(running?.kind).toBe('work');
    expect(running?.start).toBe(at('12:30'));
  });

  it('rounds stamps and keeps the raw time', async () => {
    await saveSettings({ rounding: 15, roundingMode: 'nearest' }, database);
    const seg = await clockIn(at('08:05'), 'button', database);
    expect(seg?.start).toBe(at('08:00'));
    expect(seg?.rawStart).toBe(at('08:05'));
  });

  it('clocking out during a break ends the break', async () => {
    await clockIn(at('08:00'), 'button', database);
    await startBreak(at('12:00'), undefined, 'button', database);
    await clockOut(at('12:20'), 'button', database);
    expect(await database.segments.filter((s) => s.end === null).count()).toBe(0);
  });
});
