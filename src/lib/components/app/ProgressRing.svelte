<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    value,
    size = 240,
    stroke = 12,
    color = 'var(--primary)',
    children
  }: { value: number; size?: number; stroke?: number; color?: string; children?: Snippet } = $props();

  const r = $derived((size - stroke) / 2);
  const c = $derived(2 * Math.PI * r);
  const clamped = $derived(Math.max(0, Math.min(1, value)));
  const overflow = $derived(Math.max(0, Math.min(1, value - 1)));
</script>

<div class="relative size-(--ring-size)" style="--ring-size: {size}px">
  <svg width={size} height={size} class="-rotate-90">
    <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke="var(--muted)" stroke-width={stroke} />
    <circle
      cx={size / 2}
      cy={size / 2}
      {r}
      fill="none"
      stroke={color}
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-dasharray={c}
      stroke-dashoffset={c * (1 - clamped)}
      class="transition-all duration-700"
    />
    {#if overflow > 0}
      <circle
        cx={size / 2}
        cy={size / 2}
        {r}
        fill="none"
        stroke="var(--positive)"
        stroke-width={stroke}
        stroke-linecap="round"
        stroke-dasharray={c}
        stroke-dashoffset={c * (1 - overflow)}
        class="transition-all duration-700"
      />
    {/if}
  </svg>
  <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
    {@render children?.()}
  </div>
</div>
