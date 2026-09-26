import type { Action } from 'svelte/action';

/**
 * Call `handler` when the element is held for 500 ms without moving, and
 * swallow the click that follows so the tap action doesn't run as well.
 */
export const longpress: Action<HTMLElement, (() => void) | undefined> = (node, handler) => {
  let cb = handler;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let x0 = 0;
  let y0 = 0;
  let fired = false;

  function cancel() {
    clearTimeout(timer);
    timer = undefined;
  }
  function down(e: PointerEvent) {
    if (!cb || e.button !== 0) return;
    fired = false;
    x0 = e.clientX;
    y0 = e.clientY;
    cancel();
    timer = setTimeout(() => {
      fired = true;
      navigator.vibrate?.(15);
      cb?.();
    }, 500);
  }
  function move(e: PointerEvent) {
    if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel();
  }
  function click(e: MouseEvent) {
    if (!fired) return;
    fired = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  function contextmenu(e: Event) {
    // Android shows a context menu on long press in the WebView
    if (cb) e.preventDefault();
  }
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('pointerleave', cancel);
  node.addEventListener('click', click, true);
  node.addEventListener('contextmenu', contextmenu);
  return {
    update(h) {
      cb = h;
    },
    destroy() {
      cancel();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', cancel);
      node.removeEventListener('pointercancel', cancel);
      node.removeEventListener('pointerleave', cancel);
      node.removeEventListener('click', click, true);
      node.removeEventListener('contextmenu', contextmenu);
    }
  };
};
