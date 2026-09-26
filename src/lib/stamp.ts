import { toast } from 'svelte-sonner';
import { clockIn, clockOut, endBreak, restoreSegments, snapshotSegments, startBreak } from '$lib/db/clock';
import { m } from '$lib/paraglide/messages.js';
import { toHHmm } from '$lib/domain/time';
import { haptic } from '$lib/native/index.svelte';

type Action = 'in' | 'out' | 'break' | 'resume';

let queue: Promise<void> = Promise.resolve();

/**
 * Run a clock action from the UI with haptics and an undo toast. Actions run
 * one after another, so quick taps are never dropped; repeated taps are
 * harmless because every action checks the current state.
 */
export function stamp(action: Action, breakMinutes?: number): Promise<void> {
  // The stamp time is the tap time, not the time the queued action runs
  const now = Date.now();
  queue = queue.then(() => run(action, now, breakMinutes)).catch((e) => console.error(e));
  return queue;
}

async function run(action: Action, now: number, breakMinutes?: number) {
  const before = await snapshotSegments();
  let message = '';
  if (action === 'in') {
    const s = await clockIn(now);
    if (s) message = m.toast_clocked_in({ time: toHHmm(s.start) });
  } else if (action === 'out') {
    if (await clockOut(now)) message = m.toast_clocked_out({ time: toHHmm(now) });
  } else if (action === 'break') {
    if (await startBreak(now, breakMinutes)) {
      message = breakMinutes ? m.toast_break_timed({ minutes: breakMinutes }) : m.toast_break_started();
    }
  } else if (await endBreak(now)) {
    message = m.toast_break_ended();
  }
  if (message) {
    haptic();
    toast.success(message, {
      duration: 5000,
      action: { label: m.undo(), onClick: () => restoreSegments(before) }
    });
  }
}
