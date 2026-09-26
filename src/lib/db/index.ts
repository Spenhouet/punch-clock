import Dexie, { type EntityTable } from 'dexie';
import type {
  Absence,
  BalanceAdjustment,
  Data,
  DayNote,
  Segment,
  Settings,
  VacationYear,
  WorkSchedule
} from '$lib/domain/types';
import { todayKey } from '$lib/domain/time';

export interface KV {
  key: string;
  value: unknown;
}

export class PunchClockDB extends Dexie {
  segments!: EntityTable<Segment, 'id'>;
  absences!: EntityTable<Absence, 'id'>;
  notes!: EntityTable<DayNote, 'date'>;
  adjustments!: EntityTable<BalanceAdjustment, 'id'>;
  schedules!: EntityTable<WorkSchedule, 'id'>;
  vacationYears!: EntityTable<VacationYear, 'year'>;
  kv!: EntityTable<KV, 'key'>;

  constructor(name = 'punchclock') {
    super(name);
    this.version(1).stores({
      segments: 'id, date, start, end',
      absences: 'id, date, type, groupId',
      notes: 'date',
      adjustments: 'id, date',
      schedules: 'id, validFrom',
      vacationYears: 'year',
      kv: 'key'
    });
  }
}

export const db = new PunchClockDB();

export const DEFAULT_WEEK: WorkSchedule['minutesPerWeekday'] = [480, 480, 480, 480, 480, 0, 0];

export function defaultSettings(): Settings {
  return {
    setupDone: false,
    name: '',
    theme: 'system',
    state: 'none',
    trackingStart: todayKey(),
    breakPresets: [15, 30, 45, 60],
    defaultStart: '08:00',
    rounding: 0,
    roundingMode: 'nearest',
    autoBreak: false,
    warnings: true,
    defaultVacationDays: 30,
    notifications: true,
    reminderAfterMinutes: 600,
    autoBackup: false,
    wifi: { enabled: false, ssid: '', mode: 'ask', clockOutOnDisconnect: true, graceMinutes: 5 }
  };
}

export async function loadSettings(database = db): Promise<Settings> {
  const row = await database.kv.get('settings');
  return { ...defaultSettings(), ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>, database = db): Promise<void> {
  await database.transaction('rw', database.kv, async () => {
    const current = await loadSettings(database);
    await database.kv.put({ key: 'settings', value: { ...current, ...patch } });
  });
}

/** Make sure a schedule exists, so every day has a target. */
export async function ensureDefaults(database = db): Promise<void> {
  await database.transaction('rw', database.schedules, database.kv, async () => {
    if ((await database.schedules.count()) === 0) {
      await database.schedules.add({
        id: crypto.randomUUID(),
        validFrom: '1970-01-01',
        minutesPerWeekday: DEFAULT_WEEK
      });
    }
    if (!(await database.kv.get('settings'))) {
      await database.kv.put({ key: 'settings', value: defaultSettings() });
    }
  });
}

export async function loadAll(database = db): Promise<Data> {
  const [settings, segments, absences, notes, adjustments, schedules, vacationYears] = await Promise.all([
    loadSettings(database),
    database.segments.toArray(),
    database.absences.toArray(),
    database.notes.toArray(),
    database.adjustments.toArray(),
    database.schedules.toArray(),
    database.vacationYears.toArray()
  ]);
  return { settings, segments, absences, notes, adjustments, schedules, vacationYears };
}
