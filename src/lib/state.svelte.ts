import { liveQuery } from 'dexie';
import { Ledger } from '$lib/domain/calc';
import type { Data } from '$lib/domain/types';
import { db, ensureDefaults, loadAll } from '$lib/db';
import { reconcile } from '$lib/db/clock';
import { getLocale } from '$lib/paraglide/runtime';

/**
 * App-wide reactive state: all data from IndexedDB plus a ticking clock.
 * Data is small (a few thousand rows after years), so it lives in memory.
 */
class AppState {
  data = $state<Data | null>(null);
  now = $state(Date.now());
  ready = $derived(this.data !== null);
  ledger = $derived(this.data ? new Ledger(this.data, this.now, getLocale() === 'de' ? 'de' : 'en') : null);

  private started = false;

  async start() {
    if (this.started) return;
    this.started = true;
    await ensureDefaults();
    navigator.storage?.persist?.().catch(() => {});
    liveQuery(() => loadAll(db)).subscribe({
      next: (data) => (this.data = data),
      error: (e) => console.error(e)
    });
    const tick = () => {
      this.now = Date.now();
      const r = this.ledger?.running;
      if (r?.plannedEnd && r.plannedEnd <= this.now) reconcile(this.now);
    };
    setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
  }
}

export const app = new AppState();
