<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { MediaQuery, SvelteSet } from 'svelte/reactivity';
  import { m } from '$lib/paraglide/messages.js';
  import { CalendarOff, CalendarCheck, X, ListChecks, Target } from '@lucide/svelte';
  import PageHeader from '$lib/components/app/PageHeader.svelte';
  import Segmented from '$lib/components/app/Segmented.svelte';
  import PeriodNav from '$lib/components/app/PeriodNav.svelte';
  import { Button } from '$lib/components/ui/button';
  import CalendarPeriod from './CalendarPeriod.svelte';
  import { app } from '$lib/state.svelte';
  import { fillWithTarget } from '$lib/db/entries';
  import { toast } from 'svelte-sonner';
  import { ui } from '$lib/ui.svelte';
  import Swipeable from '$lib/components/app/Swipeable.svelte';
  import { periodOf, shiftPeriod, type PeriodKind } from '$lib/domain/time';

  const ledger = $derived(app.ledger!);
  const view = $derived((page.url.searchParams.get('view') as PeriodKind) || 'week');
  const anchor = $derived(page.url.searchParams.get('d') || ledger.today);
  const period = $derived(periodOf(view, anchor));

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
</script>

<svelte:head><title>{m.tab_calendar()} · PunchClock</title></svelte:head>

<PageHeader title={m.tab_calendar()}>
  {#snippet actions()}
    {#if view !== 'year'}
      <Button
        variant={selecting ? 'secondary' : 'ghost'}
        size="sm"
        aria-label={selecting ? m.cancel() : m.select()}
        onclick={() => (selecting ? stopSelecting() : (selecting = true))}
      >
        {#if selecting}<X /><span class="hidden @xs:inline">{m.cancel()}</span>{:else}<ListChecks /><span
            class="hidden @xs:inline">{m.select()}</span
          >{/if}
      </Button>
    {/if}
    {#if anchor !== ledger.today || period.start > ledger.today || period.end < ledger.today}
      <Button variant="ghost" size="sm" aria-label={m.today()} onclick={() => navigate(view, ledger.today)}>
        <CalendarCheck /><span class="hidden @xs:inline">{m.today()}</span>
      </Button>
    {/if}
  {/snippet}
</PageHeader>

<div class="flex flex-col gap-3">
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
  <Swipeable key={period.start} group={view} onprev={() => shift(-1)} onnext={() => shift(1)} disabled={selecting}>
    {#snippet children(offset)}
      <CalendarPeriod
        {ledger}
        {view}
        period={offset ? shiftPeriod(period, offset) : period}
        wide={wide.current}
        {selecting}
        {selected}
        {onday}
        {ondrag}
        {onlongpress}
        {navigate}
      />
    {/snippet}
  </Swipeable>
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
