<script lang="ts">
  import type { Ledger } from '$lib/domain/calc';
  import { daysBetween, periodOf } from '$lib/domain/time';
  import { formatDate, formatMinutes } from '$lib/format';
  import { absenceBg } from '$lib/labels';
  import { cn } from '$lib/utils';
  import { m } from '$lib/paraglide/messages.js';
  import Segmented from '$lib/components/app/Segmented.svelte';

  let { ledger, year, onmonth }: { ledger: Ledger; year: number; onmonth: (start: string) => void } = $props();

  const MODE_KEY = 'punchclock.yearMode';
  let mode = $state<'diff' | 'types'>(
    typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY) === 'types' ? 'types' : 'diff'
  );
  $effect(() => localStorage.setItem(MODE_KEY, mode));

  /**
   * Distance from target, whichever direction: green on target, amber a bit
   * off, red far off. Six steps by absolute difference in minutes.
   */
  const SCALE = ['bg-positive', 'bg-positive/55', 'bg-warning/60', 'bg-warning', 'bg-negative/65', 'bg-negative'];
  const LIMITS = [15, 30, 60, 90, 120];

  function diffClass(date: string) {
    const d = ledger.day(date);
    if (!d.counted || (!d.target && !d.gross)) return d.isWorkday ? 'bg-muted-foreground/10' : 'bg-transparent';
    const abs = Math.abs(d.delta);
    const step = LIMITS.findIndex((limit) => abs < limit);
    return SCALE[step === -1 ? SCALE.length - 1 : step];
  }

  const months = $derived(
    Array.from({ length: 12 }, (_, i) => {
      const start = `${year}-${String(i + 1).padStart(2, '0')}-01`;
      const p = periodOf('month', start);
      const lead = (new Date(year, i, 1).getDay() + 6) % 7;
      return { start, days: daysBetween(p.start, p.end), lead };
    })
  );

  function typeClass(date: string) {
    const d = ledger.day(date);
    const a = d.absences[0];
    if (a) return absenceBg[a.type];
    if (d.holiday) return 'bg-holiday';
    if (d.gross > 0) return d.counted && d.delta < -15 ? 'bg-primary/50' : 'bg-primary';
    if (d.counted && d.isWorkday) return 'bg-negative/30';
    return d.isWorkday ? 'bg-muted-foreground/15' : 'bg-transparent';
  }
</script>

<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
  <Segmented
    class="sm:w-72"
    bind:value={mode}
    options={[
      { value: 'diff', label: m.year_mode_diff() },
      { value: 'types', label: m.year_mode_types() }
    ]}
  />
  {#if mode === 'diff'}
    <div class="flex items-center justify-center gap-1 text-xs text-muted-foreground" aria-label={m.year_mode_diff()}>
      <span class="mr-1">{m.legend_on_target()}</span>
      {#each SCALE as c (c)}<span class={cn('size-3 rounded-xs', c)}></span>{/each}
      <span class="ml-1 tabular">{m.legend_far_off()}</span>
    </div>
  {/if}
</div>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
  {#each months as mo (mo.start)}
    <button
      type="button"
      class="flex flex-col surface p-3 text-left hover:bg-muted/60"
      onclick={() => onmonth(mo.start)}
    >
      <p class="mb-2 text-sm font-semibold capitalize">{formatDate(mo.start, 'LLLL')}</p>
      <div class="grid grid-cols-7 gap-0.75">
        {#each Array(mo.lead) as _, i (i)}<span></span>{/each}
        {#each mo.days as date (date)}
          <span
            class={cn(
              'aspect-square rounded-xs',
              mode === 'diff' ? diffClass(date) : typeClass(date),
              date === ledger.today && 'ring-1 ring-foreground'
            )}
            title={`${formatDate(date, 'EEE, d. MMM')}${ledger.day(date).counted && (ledger.day(date).target || ledger.day(date).worked) ? ` · ${formatMinutes(ledger.day(date).delta, { sign: true })}` : ''}`}
          ></span>
        {/each}
      </div>
    </button>
  {/each}
</div>
