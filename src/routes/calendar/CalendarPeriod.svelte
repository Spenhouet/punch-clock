<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import SummaryStrip from '$lib/components/app/SummaryStrip.svelte';
  import WeekView from './WeekView.svelte';
  import WeekBoard from './WeekBoard.svelte';
  import MonthView from './MonthView.svelte';
  import YearView from './YearView.svelte';
  import type { Ledger } from '$lib/domain/calc';
  import type { Period, PeriodKind } from '$lib/domain/time';
  import { absenceBg, absenceLabel } from '$lib/labels';
  import { ABSENCE_TYPES } from '$lib/domain/types';
  import { formatNumber } from '$lib/format';
  import { cn } from '$lib/utils';

  /** Everything the calendar shows for one period. Rendered for the neighbors too while swiping. */
  let {
    ledger,
    view,
    period,
    wide,
    selecting,
    selected,
    onday,
    ondrag,
    onlongpress,
    navigate
  }: {
    ledger: Ledger;
    view: PeriodKind;
    period: Period;
    wide: boolean;
    selecting: boolean;
    selected: Set<string>;
    onday: (d: string) => void;
    ondrag: (dates: string[]) => void;
    onlongpress: (d: string) => void;
    navigate: (kind: PeriodKind, d: string) => void;
  } = $props();

  const summary = $derived(ledger.period(period.start, period.end));
  const year = $derived(Number(period.start.slice(0, 4)));
  const vacation = $derived(ledger.vacation(year));
</script>

<div class="flex flex-col gap-3">
  <SummaryStrip {summary} />

  {#if selecting}
    <p class="text-center text-xs text-muted-foreground">
      {view === 'month' ? m.select_hint_month() : m.select_hint()}
    </p>
  {/if}

  {#if view === 'week'}
    {#if wide}
      <WeekBoard days={summary.days} today={ledger.today} {selecting} {selected} {onday} {onlongpress} />
    {:else}
      <WeekView days={summary.days} today={ledger.today} {selecting} {selected} {onday} {onlongpress} />
    {/if}
  {:else if view === 'month'}
    <MonthView {ledger} {period} {selecting} {selected} {onday} {ondrag} {onlongpress} />
  {:else}
    <YearView {ledger} {year} onmonth={(start) => navigate('month', start)} />
    <div class="surface p-4">
      <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {#each ABSENCE_TYPES as t (t)}
          <div class="flex items-center gap-2">
            <span class={cn('size-3 rounded-xs', absenceBg[t])}></span>
            <span class="flex-1">{absenceLabel(t)}</span>
            <span class="font-medium tabular">{formatNumber(summary.absenceDays[t])}</span>
          </div>
        {/each}
        <div class="flex items-center gap-2">
          <span class="size-3 rounded-xs bg-holiday"></span>
          <span class="flex-1">{m.holidays()}</span>
          <span class="font-medium tabular">{summary.holidays}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="size-3 rounded-xs bg-primary"></span>
          <span class="flex-1">{m.days_worked()}</span>
          <span class="font-medium tabular">{summary.daysWorked}</span>
        </div>
      </div>
      <p class="mt-3 border-t pt-3 text-sm text-muted-foreground">
        {m.vacation_left_of({
          left: formatNumber(vacation.left),
          total: formatNumber(vacation.entitlement + vacation.carryOver - vacation.carryOverLost)
        })}
      </p>
    </div>
  {/if}
</div>
