import { toDateKey } from '$lib/domain/time';
import type {
  Absence,
  AbsenceType,
  BalanceAdjustment,
  DateKey,
  Segment,
  VacationYear,
  WorkSchedule
} from '$lib/domain/types';
import { db } from './index';

export async function saveSegment(segment: Omit<Segment, 'date'> & { date?: DateKey }, database = db) {
  const seg: Segment = { ...segment, date: toDateKey(segment.start) };
  await database.segments.put(seg);
  return seg;
}

export async function deleteSegment(id: string, database = db) {
  await database.segments.delete(id);
}

/** Book the same absence on several days. Replaces existing absences on those days. */
export async function setAbsences(
  dates: DateKey[],
  type: AbsenceType,
  fraction: 1 | 0.5,
  label?: string,
  database = db
) {
  const groupId = dates.length > 1 ? crypto.randomUUID() : undefined;
  await database.transaction('rw', database.absences, async () => {
    await database.absences.where('date').anyOf(dates).delete();
    await database.absences.bulkAdd(
      dates.map((date) => ({ id: crypto.randomUUID(), date, type, fraction, label: label || undefined, groupId }))
    );
  });
}

export async function updateAbsence(absence: Absence, database = db) {
  await database.absences.put(absence);
}

export async function removeAbsences(dates: DateKey[], database = db) {
  await database.absences.where('date').anyOf(dates).delete();
}

export async function deleteAbsence(id: string, database = db) {
  await database.absences.delete(id);
}

export async function setNote(date: DateKey, text: string, database = db) {
  if (text.trim()) await database.notes.put({ date, text: text.trim() });
  else await database.notes.delete(date);
}

export async function saveAdjustment(adj: Omit<BalanceAdjustment, 'id'> & { id?: string }, database = db) {
  await database.adjustments.put({ ...adj, id: adj.id ?? crypto.randomUUID() });
}

export async function deleteAdjustment(id: string, database = db) {
  await database.adjustments.delete(id);
}

export async function saveSchedule(schedule: Omit<WorkSchedule, 'id'> & { id?: string }, database = db) {
  await database.transaction('rw', database.schedules, async () => {
    // One schedule per start date
    const same = await database.schedules.where('validFrom').equals(schedule.validFrom).toArray();
    for (const s of same) if (s.id !== schedule.id) await database.schedules.delete(s.id);
    await database.schedules.put({ ...schedule, id: schedule.id ?? crypto.randomUUID() });
  });
}

export async function deleteSchedule(id: string, database = db) {
  await database.transaction('rw', database.schedules, async () => {
    if ((await database.schedules.count()) > 1) await database.schedules.delete(id);
  });
}

export async function saveVacationYear(v: VacationYear, database = db) {
  await database.vacationYears.put(v);
}
