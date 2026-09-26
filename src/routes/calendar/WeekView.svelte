<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { Check, MessageSquareText, TriangleAlert } from '@lucide/svelte';
  import Delta from '$lib/components/app/Delta.svelte';
  import type { DaySummary } from '$lib/domain/calc';
  import { formatDate, formatMinutes, toHHmm } from '$lib/format';
  import { absenceBg, absenceLabel } from '$lib/labels';
  import { cn } from '$lib/utils';

  let {
    days,
    today,
    selecting,
    selected,
    onday
  }: { days: DaySummary[]; today: string; selecting: boolean; selected: Set<string>; onday: (d: string) => void } =
    $props();
</script>

<ul class="flex flex-col gap-1.5">
  {#each days as d (d.date)}
    {@const isSel = selected.has(d.date)}
    {@const weekend = !d.isWorkday && !d.holiday && !d.gross}
    <li>
      <button
        type="button"
        onclick={() => onday(d.date)}
        data-date={d.date}
        class={cn(
          'flex w-full items-center gap-3 rounded-2xl bg-card px-3 py-3 text-left shadow-xs ring-1 ring-border transition-colors hover:bg-muted/60',
          d.date === today && 'ring-2 ring-primary/50',
          isSel && 'bg-primary/10 ring-2 ring-primary',
          weekend && 'bg-transparent shadow-none'
        )}
      >
        <span class="flex w-10 shrink-0 flex-col items-center">
          {#if selecting}
            <span
              class={cn(
                'flex size-6 items-center justify-center rounded-full border-2',
                isSel ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
              )}
            >
              {#if isSel}<Check class="size-3.5" strokeWidth={3} />{/if}
            </span>
          {:else}
            <span class="text-xs text-muted-foreground uppercase">{formatDate(d.date, 'EEE')}</span>
            <span class={cn('text-lg leading-tight font-semibold', d.date === today && 'text-primary')}
              >{formatDate(d.date, 'd')}</span
            >
          {/if}
        </span>
        <span class="min-w-0 flex-1">
          {#if d.first !== undefined}
            <span class="tabular block text-sm font-medium">
              {toHHmm(d.first)} – {d.running ? m.now() : toHHmm(d.last!)}
            </span>
          {/if}
          <span class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {#if d.holiday}
              <span class="inline-flex items-center gap-1"
                ><span class="size-2 rounded-full bg-holiday"></span>{d.holiday}</span
              >
            {/if}
            {#each d.absences as a (a.id)}
              <span class="inline-flex items-center gap-1">
                <span class={cn('size-2 rounded-full', absenceBg[a.type])}></span>{absenceLabel(a.type)}{a.fraction ===
                0.5
                  ? ' ½'
                  : ''}{a.label ? ` · ${a.label}` : ''}
              </span>
            {/each}
            {#if d.pause}<span>{m.pause()} {formatMinutes(d.pause)}</span>{/if}
            {#if d.note}<MessageSquareText class="size-3" />{/if}
            {#if d.warnings.length}<TriangleAlert class="size-3 text-break" />{/if}
            {#if d.first === undefined && !d.holiday && !d.absences.length}
              <span>{d.isWorkday ? (d.date <= today ? m.no_entries() : '') : m.day_off()}</span>
            {/if}
          </span>
        </span>
        <span class="flex flex-col items-end">
          {#if d.gross > 0 || (d.date <= today && d.target > 0)}
            <span class="tabular text-sm font-semibold">{formatMinutes(d.worked)}</span>
          {:else if d.target > 0}
            <span class="tabular text-sm text-muted-foreground">{formatMinutes(d.target)}</span>
          {/if}
          {#if d.counted && (d.target || d.worked)}<Delta minutes={d.delta} class="text-xs" />{/if}
        </span>
      </button>
    </li>
  {/each}
</ul>
