<script lang="ts">
  import { longpress } from '$lib/actions/longpress';
  import type { Ledger } from '$lib/domain/calc';
  import { addDaysKey, daysBetween, periodOf, type Period } from '$lib/domain/time';
  import { formatDate, formatMinutes, toHHmm } from '$lib/format';
  import { absenceBg } from '$lib/labels';
  import { cn } from '$lib/utils';

  let {
    ledger,
    period,
    selecting,
    selected,
    onday,
    ondrag,
    onlongpress
  }: {
    ledger: Ledger;
    period: Period;
    selecting: boolean;
    selected: Set<string>;
    onday: (d: string) => void;
    ondrag: (dates: string[]) => void;
    onlongpress?: (d: string) => void;
  } = $props();

  const cells = $derived.by(() => {
    const start = periodOf('week', period.start).start;
    const end = periodOf('week', period.end).end;
    return daysBetween(start, end);
  });
  const weekdays = $derived(daysBetween(cells[0], addDaysKey(cells[0], 6)));

  // Drag across days to select a range
  let anchor: string | null = null;
  let dragged = false;
  function dateAt(e: PointerEvent): string | null {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-date]') as HTMLElement | null;
    return el?.dataset.date ?? null;
  }
  function down(e: PointerEvent) {
    if (!selecting) return;
    anchor = dateAt(e);
    dragged = false;
  }
  function move(e: PointerEvent) {
    if (!selecting || !anchor) return;
    const d = dateAt(e);
    if (!d || d === anchor) return;
    dragged = true;
    ondrag(d < anchor ? daysBetween(d, anchor) : daysBetween(anchor, d));
  }
  function up() {
    anchor = null;
  }
  function click(d: string) {
    if (dragged) {
      dragged = false;
      return;
    }
    onday(d);
  }
</script>

<div class="surface p-2">
  <div class="grid grid-cols-7 pb-1 text-center text-caption font-medium text-muted-foreground uppercase">
    {#each weekdays as w (w)}<span>{formatDate(w, 'EEEEEE')}</span>{/each}
  </div>
  <div
    class={cn('grid grid-cols-7 gap-1', selecting && 'touch-none select-none')}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    role="grid"
    tabindex="-1"
  >
    {#each cells as date (date)}
      {@const d = ledger.day(date)}
      {@const inMonth = date >= period.start && date <= period.end}
      {@const isSel = selected.has(date)}
      {@const a = d.absences[0]}
      <button
        type="button"
        data-date={date}
        onclick={() => click(date)}
        use:longpress={selecting ? undefined : () => onlongpress?.(date)}
        class={cn(
          'relative flex aspect-4/5 flex-col items-center justify-start overflow-hidden rounded-xl pt-1.5 text-sm transition-colors hover:bg-muted md:aspect-auto md:h-24 md:items-start md:px-2',
          !inMonth && 'opacity-35',
          date === ledger.today && 'ring-2 ring-primary/60',
          isSel && 'bg-primary/15 ring-2 ring-primary'
        )}
      >
        {#if a}
          <span
            class={cn('absolute inset-x-0 bottom-0 h-(--fill) opacity-25', absenceBg[a.type])}
            style="--fill: {a.fraction * 100}%"
          ></span>
        {/if}
        <span
          class={cn(
            'relative flex size-6 items-center justify-center rounded-full text-sm font-medium',
            !d.isWorkday && !d.holiday && 'text-muted-foreground',
            d.holiday && 'bg-holiday/25'
          )}
        >
          {formatDate(date, 'd')}
        </span>
        {#if a}
          <span class={cn('relative mt-0.5 size-1.5 rounded-full', absenceBg[a.type])}></span>
        {/if}
        {#if d.first !== undefined}
          <span class="relative mt-1 hidden text-xs text-muted-foreground tabular md:block">
            {toHHmm(d.first)}–{d.running ? '…' : toHHmm(d.last!)}
          </span>
        {/if}
        {#if d.gross > 0 || (d.counted && d.target > 0)}
          <span
            class={cn(
              'relative mt-auto mb-1 text-2xs leading-none font-medium tabular',
              !d.counted || Math.round(d.delta) === 0
                ? 'text-muted-foreground'
                : d.delta > 0
                  ? 'text-positive'
                  : 'text-negative'
            )}
          >
            {d.counted ? formatMinutes(d.delta, { sign: true }) : formatMinutes(d.worked)}
          </span>
        {/if}
      </button>
    {/each}
  </div>
</div>
