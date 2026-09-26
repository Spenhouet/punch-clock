<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { MediaQuery, SvelteSet } from 'svelte/reactivity';
  import { m } from '$lib/paraglide/messages.js';
  import { CalendarOff, CalendarCheck, X, ListChecks, Target } from '@lucide/svelte';
  import PageHeader from '$lib/components/app/PageHeader.svelte';
  import Segmented from '$lib/components/app/Segmented.svelte';
  import PeriodNav from '$lib/components/app/PeriodNav.svelte';
  import SummaryStrip from '$lib/components/app/SummaryStrip.svelte';
  import { Button } from '$lib/components/ui/button';
  import WeekView from './WeekView.svelte';
  import WeekBoard from './WeekBoard.svelte';
  import MonthView from './MonthView.svelte';
  import YearView from './YearView.svelte';
  import { app } from '$lib/state.svelte';
  import { fillWithTarget } from '$lib/db/entries';
  import { toast } from 'svelte-sonner';
  import { ui } from '$lib/ui.svelte';
  import { swipe } from '$lib/actions/swipe';
  import { periodOf, shiftPeriod, type PeriodKind } from '$lib/domain/time';
  import { absenceBg, absenceLabel } from '$lib/labels';
  import { ABSENCE_TYPES } from '$lib/domain/types';
  import { formatNumber } from '$lib/format';
  import { cn } from '$lib/utils';

  const ledger = $derived(app.ledger!);
  const view = $derived((page.url.searchParams.get('view') as PeriodKind) || 'week');
  const anchor = $derived(page.url.searchParams.get('d') || ledger.today);
  const period = $derived(periodOf(view, anchor));
  const summary = $derived(ledger.period(period.start, period.end));

  let selecting = $state(false);
  const selected = new SvelteSet<string>();
  const wide = new MediaQuery('min-width: 1024px');

  function navigate(kind: PeriodKind, d: string) {
    const url = new URL(page.url);
    url.searchParams.set('view', kind);
    url.searchParams.set('d', d);
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  function shift(steps: number) {
    navigate(view, shiftPeriod(period, steps).start);
  }

  function onday(date: string) {
    if (selecting) {
      if (selected.has(date)) selected.delete(date);
      else selected.add(date);
    } else {
      ui.openDay(date);
    }
  }

  /** Long press on a day starts selection mode with that day selected. */
  function onlongpress(date: string) {
    selecting = true;
    selected.clear();
    selected.add(date);
  }

  function ondrag(dates: string[]) {
    selected.clear();
    for (const d of dates) selected.add(d);
  }

  function stopSelecting() {
    selecting = false;
    selected.clear();
  }

  function markAbsence() {
    ui.editAbsences([...selected], stopSelecting);
  }

  async function fillTarget() {
    const n = await fillWithTarget([...selected], ledger);
    stopSelecting();
    toast.success(m.target_filled({ count: n }));
  }

  const fillable = $derived(
    [...selected].filter((d) => {
      const day = ledger.day(d);
      return !day.segments.length && day.target > 0 && d <= ledger.today;
    }).length
  );

  const year = $derived(Number(period.start.slice(0, 4)));
  const vacation = $derived(ledger.vacation(year));
</script>

<svelte:head><title>{m.tab_calendar()} · PunchClock</title></svelte:head>

<PageHeader title={m.tab_calendar()}>
  {#snippet actions()}
    {#if view !== 'year'}
      <Button
        variant={selecting ? 'secondary' : 'ghost'}
        size="sm"
        onclick={() => (selecting ? stopSelecting() : (selecting = true))}
      >
        {#if selecting}<X />{m.cancel()}{:else}<ListChecks />{m.select()}{/if}
      </Button>
    {/if}
    {#if anchor !== ledger.today || period.start > ledger.today || period.end < ledger.today}
      <Button variant="ghost" size="sm" onclick={() => navigate(view, ledger.today)}>
        <CalendarCheck />{m.today()}
      </Button>
    {/if}
  {/snippet}
</PageHeader>

<div class="flex flex-col gap-3" use:swipe={{ onLeft: () => shift(1), onRight: () => shift(-1) }}>
  <div class="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
    <Segmented
      class="md:w-80"
      value={view}
      options={[
        { value: 'week', label: m.view_week() },
        { value: 'month', label: m.view_month() },
        { value: 'year', label: m.view_year() }
      ]}
      onchange={(v) => {
        stopSelecting();
        navigate(v, anchor);
      }}
    />
    <div class="md:flex-1"><PeriodNav {period} onshift={shift} ontoday={() => navigate(view, ledger.today)} /></div>
  </div>
  <SummaryStrip {summary} />

  {#if selecting}
    <p class="text-center text-xs text-muted-foreground">
      {view === 'month' ? m.select_hint_month() : m.select_hint()}
    </p>
  {/if}

  {#if view === 'week'}
    {#if wide.current}
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

{#if selecting && selected.size}
  <div class="fixed inset-x-0 bottom-20 z-40 mb-safe flex justify-center gap-2 px-4 md:bottom-8 md:pl-60">
    {#if fillable}
      <Button size="fab" variant="secondary" onclick={fillTarget}>
        <Target />{m.fill_target({ count: fillable })}
      </Button>
    {/if}
    <Button size="fab" onclick={markAbsence}>
      <CalendarOff />{m.mark_days({ count: selected.size })}
    </Button>
  </div>
{/if}
