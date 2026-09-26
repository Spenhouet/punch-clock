import type { Action } from 'svelte/action';

interface SwipeOptions {
  onLeft?: () => void;
  onRight?: () => void;
  threshold?: number;
}

/** Horizontal swipe detection that leaves vertical scrolling alone. */
export const swipe: Action<HTMLElement, SwipeOptions> = (node, options) => {
  let opts = options;
  let x0 = 0;
  let y0 = 0;
  let t0 = 0;
  let tracking = false;

  function down(e: PointerEvent) {
    if (e.pointerType === 'mouse') return;
    x0 = e.clientX;
    y0 = e.clientY;
    t0 = Date.now();
    tracking = true;
  }
  function up(e: PointerEvent) {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    const threshold = opts.threshold ?? 60;
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - t0 > 800) return;
    if (dx < 0) opts.onLeft?.();
    else opts.onRight?.();
  }
  function cancel() {
    tracking = false;
  }
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', cancel);
  return {
    update(o) {
      opts = o;
    },
    destroy() {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', cancel);
    }
  };
};
