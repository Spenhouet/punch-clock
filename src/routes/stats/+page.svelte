<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { m } from '$lib/paraglide/messages.js';
  import StatsPeriod from './StatsPeriod.svelte';
  import PageHeader from '$lib/components/app/PageHeader.svelte';
  import Segmented from '$lib/components/app/Segmented.svelte';
  import PeriodNav from '$lib/components/app/PeriodNav.svelte';
  import Swipeable from '$lib/components/app/Swipeable.svelte';
  import { app } from '$lib/state.svelte';
  import { periodOf, shiftPeriod, type PeriodKind } from '$lib/domain/time';
  import { formatMinutes, formatNumber } from '$lib/format';

  const ledger = $derived(app.ledger!);
  const view = $derived((page.url.searchParams.get('view') as PeriodKind) || 'month');
  const anchor = $derived(page.url.searchParams.get('d') || ledger.today);
  const period = $derived(periodOf(view, anchor));
  const balance = $derived(ledger.balanceNow());

  function navigate(kind: PeriodKind, d: string) {
    const url = new URL(page.url);
    url.searchParams.set('view', kind);
    url.searchParams.set('d', d);
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }
  const shift = (steps: number) => navigate(view, shiftPeriod(period, steps).start);
</script>

<svelte:head><title>{m.tab_stats()} · PunchClock</title></svelte:head>

<PageHeader title={m.tab_stats()} />

<div class="flex flex-col gap-3 md:gap-4">
  <div
    class="flex items-center justify-between rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-lg shadow-primary/20"
  >
    <div>
      <p class="text-sm opacity-80">{m.balance_current()}</p>
      <p class="text-3xl font-semibold tracking-tight tabular">{formatMinutes(balance, { sign: true })}</p>
    </div>
    <div class="text-right">
      <p class="text-sm opacity-80">{m.vacation_left()}</p>
      <p class="text-3xl font-semibold tracking-tight tabular">
        {formatNumber(ledger.vacation(Number(ledger.today.slice(0, 4))).left)}
      </p>
    </div>
  </div>

  <div class="flex flex-col gap-3 md:col-span-2 md:flex-row md:items-center md:gap-6">
    <Segmented
      class="md:w-80"
      value={view}
      options={[
        { value: 'week', label: m.view_week() },
        { value: 'month', label: m.view_month() },
        { value: 'year', label: m.view_year() }
      ]}
      onchange={(v) => navigate(v, anchor)}
    />
    <div class="md:flex-1"><PeriodNav {period} onshift={shift} ontoday={() => navigate(view, ledger.today)} /></div>
  </div>
  <Swipeable key={period.start} group={view} onprev={() => shift(-1)} onnext={() => shift(1)}>
    {#snippet children(offset)}
      <StatsPeriod {ledger} {view} period={offset ? shiftPeriod(period, offset) : period} />
    {/snippet}
  </Swipeable>
</div>
