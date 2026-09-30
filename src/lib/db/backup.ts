import type { Data } from '$lib/domain/types';
import { db, defaultSettings, loadAll } from './index';

export const BACKUP_FORMAT = 'punchclock-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: Data;
}

export async function createBackup(database = db): Promise<Backup> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: await loadAll(database)
  };
}

export function parseBackup(text: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('invalid_json');
  }
  const b = parsed as Partial<Backup>;
  if (b?.format !== BACKUP_FORMAT || typeof b.version !== 'number' || !b.data) throw new Error('invalid_format');
  if (b.version > BACKUP_VERSION) throw new Error('newer_version');
  const d = b.data as Partial<Data>;
  for (const key of ['segments', 'absences', 'notes', 'adjustments', 'schedules', 'vacationYears'] as const) {
    if (!Array.isArray(d[key])) throw new Error('invalid_format');
  }
  return b as Backup;
}

/** Replace all data with the backup content. */
export async function restoreBackup(backup: Backup, database = db) {
  const d = backup.data;
  await database.transaction(
    'rw',
    [
      database.segments,
      database.absences,
      database.notes,
      database.adjustments,
      database.schedules,
      database.vacationYears,
      database.kv
    ],
    async () => {
      // Sync credentials belong to this device and are never part of a backup
      const sync = await database.kv.get('sync');
      await Promise.all(database.tables.map((t) => t.clear()));
      if (sync) await database.kv.put(sync);
      await database.segments.bulkAdd(d.segments);
      await database.absences.bulkAdd(d.absences);
      await database.notes.bulkAdd(d.notes);
      await database.adjustments.bulkAdd(d.adjustments);
      await database.schedules.bulkAdd(d.schedules);
      await database.vacationYears.bulkAdd(d.vacationYears);
      await database.kv.put({ key: 'settings', value: { ...defaultSettings(), ...d.settings, setupDone: true } });
    }
  );
}

export async function wipeAll(database = db) {
  await database.transaction('rw', database.tables, async () => {
    await Promise.all(database.tables.map((t) => t.clear()));
  });
}
