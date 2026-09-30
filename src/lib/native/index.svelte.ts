import { Capacitor } from '@capacitor/core';
import { app } from '$lib/state.svelte';
import { clockIn, clockOut, endBreak, startBreak } from '$lib/db/clock';
import { saveSettings } from '$lib/db';
import { setSegmentPlace } from '$lib/db/entries';
import { activePlaces, placeForSsid } from '$lib/domain/places';
import type { Segment } from '$lib/domain/types';
import { PunchClock, type NativeEvent } from './plugin';

export const isNative = Capacitor.isNativePlatform();

export function haptic() {
  if (isNative) {
    import('@capacitor/haptics')
      .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
      .catch(() => {});
  } else {
    navigator.vibrate?.(12);
  }
}

let draining = false;

/** Apply stamps recorded by the notification buttons or the Wi-Fi trigger. */
export async function drainNativeEvents() {
  if (!isNative || draining) return;
  draining = true;
  try {
    const { events } = await PunchClock.drainEvents();
    for (const e of [...events].sort((a, b) => a.at - b.at)) await applyEvent(e);
  } catch (e) {
    console.error('drain failed', e);
  } finally {
    draining = false;
  }
}

async function applyEvent(e: NativeEvent) {
  const source = e.source;
  if (e.action === 'in') await detectPlace(await clockIn(e.at, source), e.ssid ?? null);
  else if (e.action === 'out') await clockOut(e.at, source);
  else if (e.action === 'break') await startBreak(e.at, undefined, source);
  else if (e.action === 'resume') await detectPlace(await endBreak(e.at, source), e.ssid ?? null);
}

/**
 * Set the place of a new work entry from the Wi-Fi the phone is on. Without a given SSID it
 * asks the system (Android only). Keeps the fallback place when no configured network matches.
 */
export async function detectPlace(seg: Segment | undefined, ssid?: string | null) {
  const settings = app.data?.settings;
  if (!seg || seg.kind !== 'work' || !settings) return;
  if (!activePlaces(settings).some((p) => p.ssids.length)) return;
  if (ssid === undefined) {
    if (!isNative) return;
    ssid = (await PunchClock.getWifiSsid().catch(() => ({ ssid: null }))).ssid;
  }
  const placeId = placeForSsid(settings, ssid);
  if (placeId && placeId !== seg.placeId) await setSegmentPlace(seg.id, placeId);
}

let lastSync = '';
let lastState = '';

/** Push the current clock state to the native notification and widget when it changes. */
function syncNotification() {
  const ledger = app.ledger;
  if (!ledger) return;
  const r = ledger.running;
  const status = ledger.status;
  const state = `${status}|${r?.id}|${r?.start}|${r?.plannedEnd}|${ledger.settings.notifications}|${ledger.today}`;
  // Rounded to minutes, so the widget refreshes at most once a minute for the balance
  const balanceMinutes = Math.round(ledger.balanceNow());
  const key = `${state}|${balanceMinutes}`;
  if (key === lastSync) return;
  lastSync = key;
  const today = ledger.day(ledger.today);
  const workedMs = today.segments
    .filter((s) => s.kind === 'work')
    .reduce((sum, s) => sum + ((s.end ?? Date.now()) - s.start), 0);
  PunchClock.sync({
    status,
    since: r?.start ?? 0,
    workedMs,
    plannedEnd: r?.plannedEnd,
    notifications: ledger.settings.notifications,
    balanceMinutes
  }).catch((e) => console.error('sync failed', e));
  if (state === lastState) return;
  lastState = state;
  scheduleReminders();
}

const REMINDER_ID = 4101;
const BREAK_END_ID = 4102;

async function scheduleReminders() {
  const ledger = app.ledger;
  if (!ledger) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }, { id: BREAK_END_ID }] }).catch(() => {});
  if (!ledger.settings.notifications) return;
  const { m } = await import('$lib/paraglide/messages.js');
  const r = ledger.running;
  const list = [];
  if (r?.kind === 'break' && r.plannedEnd && r.plannedEnd > Date.now()) {
    list.push({
      id: BREAK_END_ID,
      title: m.notif_break_over_title(),
      body: m.notif_break_over_body(),
      schedule: { at: new Date(r.plannedEnd), allowWhileIdle: true },
      // Inexact on purpose: exact alarms need a special permission and the plugin
      // would send the user to system settings on every clock-in to ask for it
      isExactNotification: false
    });
  }
  if (r && ledger.settings.reminderAfterMinutes > 0) {
    const first = ledger.day(r.date).first ?? r.start;
    const at = first + ledger.settings.reminderAfterMinutes * 60_000;
    if (at > Date.now()) {
      list.push({
        id: REMINDER_ID,
        title: m.notif_reminder_title(),
        body: m.notif_reminder_body({ hours: Math.round(ledger.settings.reminderAfterMinutes / 6) / 10 }),
        schedule: { at: new Date(at), allowWhileIdle: true },
        isExactNotification: false
      });
    }
  }
  if (list.length) await LocalNotifications.schedule({ notifications: list }).catch((e) => console.error(e));
}

/** Write a backup file to Documents once a week when enabled. */
async function autoBackup() {
  const ledger = app.ledger;
  if (!ledger?.settings.autoBackup) return;
  const last = ledger.settings.lastBackup;
  if (last && Date.parse(ledger.today) - Date.parse(last) < 7 * 86_400_000) return;
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { createBackup } = await import('$lib/db/backup');
    const backup = await createBackup();
    await Filesystem.writeFile({
      path: `PunchClock/punchclock-backup-${ledger.today}.json`,
      data: JSON.stringify(backup),
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true
    });
    await saveSettings({ lastBackup: ledger.today });
  } catch (e) {
    console.error('auto backup failed', e);
  }
}

export async function configureWifi() {
  if (!isNative || !app.data) return;
  const w = app.data.settings.wifi;
  const minutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  await PunchClock.configureWifi({
    enabled: w.enabled && !!w.ssid,
    ssid: w.ssid,
    mode: w.mode,
    clockOutOnDisconnect: w.clockOutOnDisconnect,
    graceMinutes: w.graceMinutes,
    breakWindow: w.breakWindow,
    breakFromMinutes: minutes(w.breakFrom),
    breakToMinutes: minutes(w.breakTo)
  }).catch((e) => console.error(e));
}

let started = false;

export async function initNative() {
  if (!isNative || started) return;
  started = true;
  const { App } = await import('@capacitor/app');
  await drainNativeEvents();
  App.addListener('resume', () => drainNativeEvents());
  PunchClock.addListener('events', () => drainNativeEvents());

  const { LocalNotifications } = await import('@capacitor/local-notifications');
  LocalNotifications.addListener('localNotificationActionPerformed', () => {});

  // Android back button: close sheets first, then go back, then leave the app
  App.addListener('backButton', ({ canGoBack }) => {
    const open = document.querySelector('[role="dialog"][data-state="open"]');
    if (open) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }
    if (canGoBack && location.pathname.replace(/\/$/, '') !== '') history.back();
    else App.exitApp();
  });

  $effect.root(() => {
    $effect(() => {
      // Track the pieces of state the notification depends on
      void app.ledger?.status;
      void app.ledger?.running?.id;
      void app.ledger?.running?.plannedEnd;
      void app.data?.settings.notifications;
      void app.ledger?.today;
      syncNotification();
    });
  });
  await configureWifi();
  autoBackup();
}
