import { roundStamp } from '$lib/domain/rounding';
import { toDateKey } from '$lib/domain/time';
import type { Segment, SegmentSource, Timestamp } from '$lib/domain/types';
import { db, loadSettings, type PunchClockDB } from './index';

async function runningSegment(database: PunchClockDB): Promise<Segment | undefined> {
  return database.segments.filter((s) => s.end === null).first();
}

function newSegment(
  kind: Segment['kind'],
  start: Timestamp,
  source: SegmentSource,
  extra: Partial<Segment> = {}
): Segment {
  return { id: crypto.randomUUID(), date: toDateKey(start), kind, start, end: null, source, ...extra };
}

/**
 * Close a timed break whose planned end has passed and continue working from
 * that point. Returns true if anything changed.
 */
export async function reconcile(now: Timestamp = Date.now(), database = db): Promise<boolean> {
  return database.transaction('rw', database.segments, async () => {
    const r = await runningSegment(database);
    if (!r || r.kind !== 'break' || !r.plannedEnd || r.plannedEnd > now) return false;
    await database.segments.update(r.id, { end: r.plannedEnd, plannedEnd: undefined });
    await database.segments.add(newSegment('work', r.plannedEnd, r.source));
    return true;
  });
}

export async function clockIn(now: Timestamp = Date.now(), source: SegmentSource = 'button', database = db) {
  const settings = await loadSettings(database);
  return database.transaction('rw', database.segments, async () => {
    if (await runningSegment(database)) return undefined;
    const start = roundStamp(now, settings.rounding, settings.roundingMode, 'in');
    const seg = newSegment('work', start, source, start !== now ? { rawStart: now } : {});
    await database.segments.add(seg);
    return seg;
  });
}

export async function clockOut(now: Timestamp = Date.now(), _source: SegmentSource = 'button', database = db) {
  await reconcile(now, database);
  const settings = await loadSettings(database);
  return database.transaction('rw', database.segments, async () => {
    const r = await runningSegment(database);
    if (!r) return undefined;
    if (r.kind === 'break') {
      // A break ends where it ends; rounding only applies to real clock-out stamps
      await database.segments.update(r.id, { end: Math.max(now, r.start), plannedEnd: undefined });
      return r;
    }
    let end = roundStamp(now, settings.rounding, settings.roundingMode, 'out');
    if (end < r.start) end = r.start;
    await database.segments.update(r.id, { end, ...(end !== now ? { rawEnd: now } : {}) });
    return r;
  });
}

export async function startBreak(
  now: Timestamp = Date.now(),
  minutes?: number,
  source: SegmentSource = 'button',
  database = db
) {
  return database.transaction('rw', database.segments, async () => {
    const r = await runningSegment(database);
    if (!r || r.kind !== 'work') return undefined;
    const at = Math.max(now, r.start);
    await database.segments.update(r.id, { end: at });
    const seg = newSegment('break', at, source, minutes ? { plannedEnd: at + minutes * 60_000 } : {});
    await database.segments.add(seg);
    return seg;
  });
}

export async function endBreak(now: Timestamp = Date.now(), source: SegmentSource = 'button', database = db) {
  return database.transaction('rw', database.segments, async () => {
    const r = await runningSegment(database);
    if (!r || r.kind !== 'break') return undefined;
    const at = Math.max(now, r.start);
    await database.segments.update(r.id, { end: at, plannedEnd: undefined });
    const seg = newSegment('work', at, source);
    await database.segments.add(seg);
    return seg;
  });
}

/** Snapshot of all segments, used to undo the last stamp. */
export async function snapshotSegments(database = db): Promise<Segment[]> {
  return database.segments.toArray();
}

export async function restoreSegments(snapshot: Segment[], database = db) {
  await database.transaction('rw', database.segments, async () => {
    await database.segments.clear();
    await database.segments.bulkAdd(snapshot);
  });
}
