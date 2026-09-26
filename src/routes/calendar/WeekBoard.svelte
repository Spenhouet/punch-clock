<script lang="ts">
  import { longpress } from '$lib/actions/longpress';
  import { m } from '$lib/paraglide/messages.js';
  import { Check, MessageSquareText, TriangleAlert } from '@lucide/svelte';
  import Delta from '$lib/components/app/Delta.svelte';
  import type { DaySummary } from '$lib/domain/calc';
  import { minutesOfDay } from '$lib/domain/calc';
  import { formatDate, formatMinutes, toHHmm } from '$lib/format';
  import { absenceBg, absenceLabel } from '$lib/labels';
  import { app } from '$lib/state.svelte';
  import { cn } from '$lib/utils';

  /** Desktop week: one column per day with entries on a shared time axis. */
  let {
    days,
    today,
    selecting,
    selected,
    onday,
    onlongpress
  }: {
    days: DaySummary[];
    today: string;
    selecting: boolean;
    selected: Set<string>;
    onday: (d: string) => void;
    onlongpress?: (d: string) => void;
  } = $props();

  const range = $derived.by(() => {
    let from = 7 * 60;
    let to = 18 * 60;
    for (const d of days) {
      for (const s of d.segments) {
        from = Math.min(from, minutesOfDay(s.start));
        const end = s.end ?? app.now;
        // Entries running past midnight end at the bottom of the board
        to = Math.max(to, new Date(end).getDate() !== new Date(s.start).getDate() ? 24 * 60 : minutesOfDay(end));
      }
    }
    return { from: Math.floor(from / 60) * 60, to: Math.min(24 * 60, Math.ceil(to / 60) * 60) };
  });
  const hours = $derived(Array.from({ length: (range.to - range.from) / 60 + 1 }, (_, i) => range.from / 60 + i));
  const pct = (minutes: number) => ((minutes - range.from) / (range.to - range.from)) * 100;
</script>

<div class="surface p-3">
  <div class="grid grid-cols-week gap-x-2">
    <span></span>
    {#each days as d (d.date)}
      {@const isSel = selected.has(d.date)}
      <button
        type="button"
        data-date={d.date}
        onclick={() => onday(d.date)}
        use:longpress={selecting ? undefined : () => onlongpress?.(d.date)}
        class={cn(
          'flex flex-col items-center rounded-xl py-2 transition-colors hover:bg-muted',
          isSel && 'bg-primary/15 ring-2 ring-primary'
        )}
      >
        <span class="text-xs text-muted-foreground uppercase">{formatDate(d.date, 'EEE')}</span>
        <span
          class={cn(
            'flex size-8 items-center justify-center rounded-full text-lg font-semibold',
            d.date === today && 'bg-primary text-primary-foreground',
            !d.isWorkday && d.date !== today && 'text-muted-foreground'
          )}
        >
          {#if selecting && isSel}<Check class="size-4" strokeWidth={3} />{:else}{formatDate(d.date, 'd')}{/if}
        </span>
      </button>
    {/each}

    <div class="relative h-128">
      {#each hours as h (h)}
        <span
          class="absolute top-(--top) right-0 -translate-y-1/2 text-xs text-muted-foreground tabular"
          style="--top: {pct(h * 60)}%">{String(h).padStart(2, '0')}:00</span
        >
      {/each}
    </div>
    {#each days as d (d.date)}
      <button
        type="button"
        onclick={() => onday(d.date)}
        use:longpress={selecting ? undefined : () => onlongpress?.(d.date)}
        class={cn(
          'relative h-128 overflow-hidden rounded-xl text-left transition-colors hover:bg-muted/60',
          d.isWorkday ? 'bg-muted/40' : 'bg-transparent',
          selected.has(d.date) && 'bg-primary/10'
        )}
        aria-label={formatDate(d.date, 'EEEE, d. MMMM')}
      >
        {#each hours as h (h)}
          <span
            class="absolute inset-x-0 top-(--top) border-t border-dashed border-border"
            style="--top: {pct(h * 60)}%"
          ></span>
        {/each}
        {#if d.absences.length || d.holiday}
          <span class="absolute inset-x-1 top-1 flex flex-col gap-1">
            {#if d.holiday}
              <span class="truncate rounded-md bg-holiday/25 px-1.5 py-0.5 text-xs font-medium">{d.holiday}</span>
            {/if}
            {#each d.absences as a (a.id)}
              <span
                class={cn('truncate rounded-md px-1.5 py-0.5 text-xs font-medium text-background', absenceBg[a.type])}
              >
                {absenceLabel(a.type)}{a.fraction === 0.5 ? ' ½' : ''}{a.label ? ` · ${a.label}` : ''}
              </span>
            {/each}
          </span>
        {/if}
        {#each d.segments as s (s.id)}
          {@const start = minutesOfDay(s.start)}
          {@const endTs = s.end ?? app.now}
          {@const end = new Date(endTs).getDate() !== new Date(s.start).getDate() ? 24 * 60 : minutesOfDay(endTs)}
          <span
            class={cn(
              'absolute inset-x-1 top-(--top) h-(--height) overflow-hidden rounded-md px-1.5 text-xs leading-tight',
              s.kind === 'work' ? 'bg-primary text-primary-foreground' : 'bg-break/80 text-break-foreground',
              s.end === null && 'opacity-75'
            )}
            style="--top: {pct(start)}%; --height: {Math.max(0.8, pct(end) - pct(start))}%"
          >
            {#if end - start >= 45}
              <span class="block pt-0.5 font-medium tabular">{toHHmm(s.start)}</span>
              {#if s.note}<span class="block truncate opacity-80">{s.note}</span>{/if}
            {/if}
          </span>
        {/each}
      </button>
    {/each}

    <span></span>
    {#each days as d (d.date)}
      <div class="flex flex-col items-center gap-0.5 pt-2 text-center">
        {#if d.gross > 0 || (d.date <= today && d.target > 0)}
          <span class="text-sm font-semibold tabular">{formatMinutes(d.worked)}</span>
          {#if d.counted}<Delta minutes={d.delta} class="text-xs" />{/if}
        {:else if d.target > 0}
          <span class="text-sm text-muted-foreground tabular">{formatMinutes(d.target)}</span>
        {:else}
          <span class="text-xs text-muted-foreground">{m.day_off()}</span>
        {/if}
        <span class="flex h-4 items-center gap-1 text-muted-foreground">
          {#if d.note}<MessageSquareText class="size-3" />{/if}
          {#if d.warnings.length}<TriangleAlert class="size-3 text-break" />{/if}
        </span>
      </div>
    {/each}
  </div>
</div>
