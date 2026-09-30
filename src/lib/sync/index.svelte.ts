import { db } from '$lib/db';
import { createBackup, parseBackup, type Backup } from '$lib/db/backup';
import { app } from '$lib/state.svelte';
import { DEFAULT_ITERATIONS, decrypt, deriveKey, encrypt, parseEncrypted, randomSalt, sha256 } from './crypto';
import { createGist, readGist, updateGist } from './gist';

/**
 * Online backup: an encrypted copy of the backup in a secret GitHub gist, updated after changes,
 * to restore from or to move to a new phone. Kept in its own
 * `kv` row, so it is never part of a backup file (the token must not leave the device).
 */
export interface SyncConfig {
  gistId: string;
  token: string;
  /** Derived AES key, base64. The passphrase itself is not stored. */
  key: string;
  salt: string;
  iterations: number;
  lastPushAt?: string;
  lastHash?: string;
  lastError?: string;
}

export const SYNC_KV_KEY = 'sync';
const DEBOUNCE_MS = 15_000;

class SyncState {
  config = $state<SyncConfig | null>(null);
  busy = $state(false);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private started = false;

  async start() {
    if (this.started) return;
    this.started = true;
    this.config = ((await db.kv.get(SYNC_KV_KEY))?.value as SyncConfig | undefined) ?? null;
    $effect.root(() => {
      $effect(() => {
        // Any data change schedules an upload
        void app.data;
        this.schedule();
      });
    });
    // Leaving the app is the last chance before it may be killed
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  private async save(patch: Partial<SyncConfig> | null) {
    if (patch === null) {
      await db.kv.delete(SYNC_KV_KEY);
      this.config = null;
      return;
    }
    this.config = { ...(this.config as SyncConfig), ...patch };
    await db.kv.put({ key: SYNC_KV_KEY, value: $state.snapshot(this.config) });
  }

  schedule() {
    if (!this.config) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push(), DEBOUNCE_MS);
  }

  flush() {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.push();
  }

  /** Upload the current backup unless it is unchanged since the last upload. */
  async push(force = false): Promise<boolean> {
    const c = this.config;
    if (!c || this.busy) return false;
    this.timer = undefined;
    this.busy = true;
    try {
      const backup = await createBackup();
      // The export time changes every run, so only the data decides whether to upload
      const hash = await sha256(JSON.stringify(backup.data));
      if (!force && hash === c.lastHash && c.gistId) return true;
      const content = JSON.stringify(await encrypt(JSON.stringify(backup), c.key, c.salt, c.iterations));
      let gistId = c.gistId;
      if (gistId) await updateGist(c.token, gistId, content);
      else gistId = await createGist(c.token, content);
      await this.save({ gistId, lastHash: hash, lastPushAt: new Date().toISOString(), lastError: undefined });
      return true;
    } catch (e) {
      console.error('sync failed', e);
      await this.save({ lastError: (e as Error).message || 'failed' });
      return false;
    } finally {
      this.busy = false;
    }
  }

  /** Start backing up to a new secret gist. */
  async enable(token: string, passphrase: string): Promise<void> {
    this.busy = true;
    try {
      const salt = randomSalt();
      const key = await deriveKey(passphrase, salt, DEFAULT_ITERATIONS);
      await this.save({ gistId: '', token, key, salt, iterations: DEFAULT_ITERATIONS });
    } finally {
      this.busy = false;
    }
    if (!(await this.push(true))) {
      const error = this.config?.lastError ?? 'failed';
      // Nothing was created, so don't keep a half set-up connection
      await this.save(null);
      throw new Error(error);
    }
  }

  /**
   * Open an existing online backup, e.g. on a new phone. Nothing is stored yet: only after the
   * backup was restored does `adopt` connect this device, so a cancelled restore can never
   * overwrite the online backup with this device's data.
   */
  async open(token: string, passphrase: string, gistId: string): Promise<{ backup: Backup; config: SyncConfig }> {
    this.busy = true;
    try {
      const file = parseEncrypted(await readGist(gistId, token));
      const key = await deriveKey(passphrase, file.kdf.salt, file.kdf.iterations);
      const backup = parseBackup(await decrypt(file, key));
      return { backup, config: { gistId, token, key, salt: file.kdf.salt, iterations: file.kdf.iterations } };
    } finally {
      this.busy = false;
    }
  }

  /** Keep backing up to the gist that was just restored from. */
  async adopt(config: SyncConfig) {
    this.config = null;
    await this.save(config);
  }

  /** Fetch and decrypt the backup stored in the gist. */
  async fetchBackup(): Promise<Backup> {
    const c = this.config;
    if (!c?.gistId) throw new Error('not_connected');
    return parseBackup(await decrypt(parseEncrypted(await readGist(c.gistId, c.token)), c.key));
  }

  /** Stop syncing on this device. The gist stays on GitHub. */
  async disconnect() {
    clearTimeout(this.timer);
    this.timer = undefined;
    await this.save(null);
  }
}

export const sync = new SyncState();
