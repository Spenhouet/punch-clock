<script lang="ts">
  import { formatMinutes } from '$lib/format';

  interface Point {
    key: string;
    title: string;
    value: number;
  }

  let { points, label }: { points: Point[]; label: string } = $props();

  const W = 320;
  const H = 120;
  const PAD = 6;
  const min = $derived(Math.min(0, ...points.map((p) => p.value)));
  const max = $derived(Math.max(0, ...points.map((p) => p.value)));
  const span = $derived(max - min || 60);
  const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * W : W / 2);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - 2 * PAD);
  const path = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(''));
  const area = $derived(points.length ? `${path}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : '');

  let active = $state<number | null>(null);
  let svg: SVGSVGElement;
  function move(e: PointerEvent) {
    const r = svg.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (points.length - 1));
    active = Math.max(0, Math.min(points.length - 1, i));
  }
  const shown = $derived(active !== null ? points[active] : points.at(-1));
</script>

<div>
  <div class="mb-2 flex h-9 items-end justify-between text-xs text-muted-foreground">
    <span>{shown?.title ?? label}</span>
    {#if shown}
      <span class="tabular text-sm font-semibold {shown.value >= 0 ? 'text-positive' : 'text-negative'}">
        {formatMinutes(shown.value, { sign: true })}
      </span>
    {/if}
  </div>
  <div class="relative">
    <svg
      bind:this={svg}
      viewBox="0 0 {W} {H}"
      preserveAspectRatio="none"
      class="h-[120px] w-full touch-pan-y overflow-visible"
      onpointermove={move}
      onpointerdown={move}
      onpointerleave={() => (active = null)}
      role="img"
      aria-label={label}
    >
      <line
        x1="0"
        x2={W}
        y1={y(0)}
        y2={y(0)}
        stroke="var(--border)"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
      />
      <path d={area} fill="var(--primary)" opacity="0.1" />
      <path
        d={path}
        fill="none"
        stroke="var(--primary)"
        stroke-width="2"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
      {#if active !== null}
        <line
          x1={x(active)}
          x2={x(active)}
          y1="0"
          y2={H}
          stroke="var(--muted-foreground)"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
          opacity="0.5"
        />
      {/if}
    </svg>
    {#if active !== null}
      <span
        class="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary"
        style="left: {(x(active) / W) * 100}%; top: {y(points[active].value)}px"
      ></span>
    {/if}
  </div>
</div>
