<script lang="ts">
  import { formatMinutes } from '$lib/format';
  import { cn } from '$lib/utils';

  interface Bar {
    key: string;
    label: string;
    title: string;
    value: number;
    target: number;
  }

  let { bars, targetLabel, valueLabel }: { bars: Bar[]; targetLabel: string; valueLabel: string } = $props();

  const H = 140;
  const max = $derived(Math.max(60, ...bars.map((b) => Math.max(b.value, b.target))) * 1.1);
  let active = $state<number | null>(null);
  const shown = $derived(active !== null ? bars[active] : null);
  const labelEvery = $derived(bars.length > 16 ? 5 : 1);
</script>

<div>
  <div class="mb-2 flex h-9 items-end justify-between text-xs text-muted-foreground">
    {#if shown}
      <span class="font-medium text-foreground">{shown.title}</span>
      <span class="tabular">
        {valueLabel} <span class="font-semibold text-foreground">{formatMinutes(shown.value)}</span>
        · {targetLabel}
        {formatMinutes(shown.target)}
      </span>
    {:else}
      <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-primary"></span>{valueLabel}</span>
      <span class="flex items-center gap-1.5"><span class="h-0.5 w-3 bg-foreground/60"></span>{targetLabel}</span>
    {/if}
  </div>
  <div class="relative flex h-35 items-end gap-0.5" role="img" aria-label={valueLabel}>
    <div class="pointer-events-none absolute inset-x-0 bottom-1/2 border-t border-dashed border-border"></div>
    {#each bars as b, i (b.key)}
      {@const h = (b.value / max) * H}
      {@const th = (b.target / max) * H}
      <button
        type="button"
        class="group relative flex h-full flex-1 items-end justify-center"
        onpointerenter={() => (active = i)}
        onpointerleave={() => (active = null)}
        onfocus={() => (active = i)}
        onblur={() => (active = null)}
        aria-label={`${b.title}: ${formatMinutes(b.value)}`}
      >
        <span
          class={cn(
            'h-(--bar) w-full max-w-7 rounded-t-xs transition-colors',
            b.value >= b.target ? 'bg-primary' : 'bg-primary/55',
            active === i && 'bg-primary brightness-110'
          )}
          style="--bar: {Math.max(b.value > 0 ? 2 : 0, h)}px"
        ></span>
        {#if b.target > 0}
          <span
            class="pointer-events-none absolute bottom-(--target) w-full max-w-7 border-t-2 border-foreground/60"
            style="--target: {th}px"
          ></span>
        {/if}
      </button>
    {/each}
  </div>
  <div class="mt-1 flex gap-0.5 text-center text-2xs text-muted-foreground">
    {#each bars as b, i (b.key)}
      <span class="w-0 flex-1 overflow-visible whitespace-nowrap">{i % labelEvery === 0 ? b.label : ''}</span>
    {/each}
  </div>
</div>
