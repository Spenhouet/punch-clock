import type { Action } from 'svelte/action';

interface SwipeOptions {
  onLeft?: () => void;
  onRight?: () => void;
  threshold?: number;
}

/**
 * Horizontal swipe to change periods, plus the arrow keys on desktop. Uses
 * touch events: pointer events get cancelled as soon as the browser starts
 * handling a pan, which swallowed most swipes on Android.
 */
export const swipe: Action<HTMLElement, SwipeOptions> = (node, options) => {
  let opts = options;
  let x0 = 0;
  let y0 = 0;
  let t0 = 0;
  let tracking = false;

  function start(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    // Leave gestures inside sheets and horizontally scrollable areas alone
    if ((e.target as HTMLElement).closest('[role="dialog"], [data-no-swipe]')) return;
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
    t0 = Date.now();
    tracking = true;
  }
  function end(e: TouchEvent) {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    const threshold = opts.threshold ?? 50;
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.2 || Date.now() - t0 > 1000) return;
    if (dx < 0) opts.onLeft?.();
    else opts.onRight?.();
  }
  function key(e: KeyboardEvent) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
    if (e.key === 'ArrowLeft') opts.onRight?.();
    else if (e.key === 'ArrowRight') opts.onLeft?.();
  }
  node.addEventListener('touchstart', start, { passive: true });
  node.addEventListener('touchend', end, { passive: true });
  window.addEventListener('keydown', key);
  return {
    update(o) {
      opts = o;
    },
    destroy() {
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchend', end);
      window.removeEventListener('keydown', key);
    }
  };
};
