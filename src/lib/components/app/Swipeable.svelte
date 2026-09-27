<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { cn } from '$lib/utils';

  /**
   * Period carousel. The content follows the finger while dragging; on release
   * the old period slides out and the new one slides in next to it. Changing
   * `key` any other way (buttons, arrow keys) plays the same slide. Keys must
   * sort chronologically (ISO dates do), which sets the slide direction.
   */
  let {
    key,
    group = '',
    onprev,
    onnext,
    disabled = false,
    class: className = '',
    children
  }: {
    key: string;
    /** Changing the group (e.g. week to month) crossfades instead of sliding. */
    group?: string;
    onprev: () => void;
    onnext: () => void;
    disabled?: boolean;
    class?: string;
    /** Renders a period: 0 is the current one, -1 and 1 the neighbors shown while dragging. */
    children: Snippet<[number]>;
  } = $props();

  let drag = $state(0);
  let dragging = $state(false);
  // Drag offset at release, kept until the key actually changes (navigation is async)
  let releaseFrom = 0;
  // Offset the outgoing view starts its slide from
  let from = 0;
  let dir = 1;
  let lastKey = '';
  let lastGroup = '';

  // Runs before the DOM update, so the transitions below see the new values
  $effect.pre(() => {
    if (lastKey && key !== lastKey) {
      dir = group !== lastGroup ? 0 : key > lastKey ? 1 : -1;
      from = releaseFrom;
      releaseFrom = 0;
      drag = 0;
      dragging = false;
    }
    lastKey = key;
    lastGroup = group;
  });

  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function duration(distance: number, width: number) {
    if (reduced) return 0;
    if (dir === 0) return 180;
    return Math.round(180 + 160 * Math.min(1, Math.abs(distance) / width));
  }

  // Space between two periods while they move side by side; matches the neighbor's translate-x-4
  const GAP = 16;

  function slideOut(node: HTMLElement) {
    const w = (node.offsetWidth || 400) + GAP;
    const start = from;
    const to = -dir * w;
    return {
      duration: duration(to - start, w),
      easing: cubicOut,
      css: (t: number) => `translate: ${to + (start - to) * t}px 0; opacity: ${0.4 + 0.6 * t}`
    };
  }

  function slideIn(node: HTMLElement) {
    const w = (node.offsetWidth || 400) + GAP;
    const start = dir * w + from;
    return {
      duration: duration(start, w),
      easing: cubicOut,
      css: (t: number) => `translate: ${start * (1 - t)}px 0; opacity: ${0.4 + 0.6 * t}`
    };
  }

  // Touch tracking
  let x0 = 0;
  let y0 = 0;
  let t0 = 0;
  let axis: 'x' | 'y' | null = null;
  let width = 400;

  function start(e: TouchEvent) {
    if (disabled || e.touches.length !== 1) return;
    if ((e.target as HTMLElement).closest('[role="dialog"], [data-no-swipe]')) return;
    releaseFrom = 0;
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
    t0 = performance.now();
    axis = null;
    width = (e.currentTarget as HTMLElement).offsetWidth || 400;
  }

  function move(e: TouchEvent) {
    if (disabled || !t0) return;
    const dx = e.touches[0].clientX - x0;
    const dy = e.touches[0].clientY - y0;
    if (!axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (axis !== 'x') return;
    dragging = true;
    drag = dx;
  }

  function end() {
    if (!t0) return;
    const dx = drag;
    const velocity = Math.abs(dx) / Math.max(1, performance.now() - t0);
    t0 = 0;
    if (axis !== 'x') {
      dragging = false;
      drag = 0;
      return;
    }
    if (Math.abs(dx) > Math.min(90, width * 0.25) || (Math.abs(dx) > 30 && velocity > 0.4)) {
      // Keep the view where the finger left it; the slide starts from there
      releaseFrom = dx;
      if (dx < 0) onnext();
      else onprev();
    } else {
      // Not far enough: spring back
      dragging = false;
      drag = 0;
    }
  }

  function key_(e: KeyboardEvent) {
    if (disabled || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
    if (document.querySelector('[role="dialog"][data-state="open"]')) return;
    releaseFrom = 0;
    if (e.key === 'ArrowLeft') onprev();
    else if (e.key === 'ArrowRight') onnext();
  }
</script>

<svelte:window onkeydown={key_} />

<div
  class={cn('grid touch-pan-y overflow-x-clip', className)}
  ontouchstart={start}
  ontouchmove={move}
  ontouchend={end}
  ontouchcancel={end}
  role="region"
>
  {#key key}
    <div
      class={cn('relative stack-item translate-x-(--drag)', !dragging && 'transition-transform duration-200 ease-out')}
      style="--drag: {drag}px"
      in:slideIn
      out:slideOut
    >
      {@render children(0)}
      {#if dragging && drag !== 0}
        <!-- The neighbor rides along next to the current view, so the slide continues seamlessly -->
        <div
          class={cn(
            'pointer-events-none absolute top-0 w-full',
            drag < 0 ? 'left-full translate-x-4' : 'right-full -translate-x-4'
          )}
          aria-hidden="true"
          inert
        >
          {@render children(drag < 0 ? 1 : -1)}
        </div>
      {/if}
    </div>
  {/key}
</div>
