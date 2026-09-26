<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { m } from '$lib/paraglide/messages.js';
  import { FileText, Sheet as SheetIcon, CalendarPlus, Table } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import PageHeader from '$lib/components/app/PageHeader.svelte';
  import Segmented from '$lib/components/app/Segmented.svelte';
  import PeriodNav from '$lib/components/app/PeriodNav.svelte';
  import SummaryStrip from '$lib/components/app/SummaryStrip.svelte';
  import BarChart from '$lib/components/app/BarChart.svelte';
  import LineChart from '$lib/components/app/LineChart.svelte';
  import Delta from '$lib/components/app/Delta.svelte';
  import { app } from '$lib/state.svelte';
  import { swipe } from '$lib/actions/swipe';
  import { daysBetween, isoWeek, periodOf, shiftPeriod, type PeriodKind } from '$lib/domain/time';
  import { formatClock, formatDate, formatMinutes, formatNumber } from '$lib/format';
  import { absenceBg, absenceLabel } from '$lib/labels';
  import { ABSENCE_TYPES } from '$lib/domain/types';
  import { cn } from '$lib/utils';

  const ledger = $derived(app.ledger!);
  const view = $derived((page.url.searchParams.get('view') as PeriodKind) || 'month');
  const anchor = $derived(page.url.searchParams.get('d') || ledger.today);
  const period = $derived(periodOf(view, anchor));
  const summary = $derived(ledger.period(period.start, period.end));
  const year = $derived(Number(period.start.slice(0, 4)));
  const vacation = $derived(ledger.vacation(year));
  const balance = $derived(ledger.balanceNow());

  function navigate(kind: PeriodKind, d: string) {
    const url = new URL(page.url);
    url.searchParams.set('view', kind);
    url.searchParams.set('d', d);
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }
  const shift = (steps: number) => navigate(view, shiftPeriod(period, steps).start);

  const bars = $derived.by(() => {
    if (view === 'year') {
      return Array.from({ length: 12 }, (_, i) => {
        const p = periodOf('month', `${year}-${String(i + 1).padStart(2, '0')}-01`);
        const s = ledger.period(p.start, p.end);
        return {
          key: p.start,
          label: formatDate(p.start, 'LLLLL'),
          title: formatDate(p.start, 'LLLL yyyy'),
          value: s.worked,
          target: s.target
        };
      });
    }
    return summary.days.map((d) => ({
      key: d.date,
      label: view === 'week' ? formatDate(d.date, 'EEEEEE') : formatDate(d.date, 'd'),
      title: formatDate(d.date, 'EEEE, d. MMM'),
      value: d.worked,
      target: d.target
    }));
  });

  const balancePoints = $derived.by(() => {
    const end = period.end < ledger.today ? period.end : ledger.today;
    if (end < period.start) return [];
    const days = daysBetween(period.start, end);
    const step = days.length > 120 ? 7 : 1;
    const picked = days.filter((_, i) => i % step === 0 || i === days.length - 1);
    return picked.map((d) => ({ key: d, title: formatDate(d, 'EEE, d. MMM yyyy'), value: ledger.balanceAt(d) }));
  });

  let exporting = $state(false);
  const fileBase = $derived(
    view === 'year'
      ? `punchclock-${year}`
      : view === 'month'
        ? `punchclock-${period.start.slice(0, 7)}`
        : `punchclock-${year}-W${String(isoWeek(period.start).week).padStart(2, '0')}`
  );

  async function run(kind: 'pdf' | 'csv' | 'entries' | 'ics') {
    if (exporting) return;
    exporting = true;
    try {
      const { saveFile } = await import('$lib/export/save');
      if (kind === 'pdf') {
        const { timesheetPdf } = await import('$lib/export/pdf');
        await saveFile(`${fileBase}.pdf`, timesheetPdf(ledger, view, period.start, period.end), 'application/pdf');
      } else if (kind === 'csv') {
        const { daysCsv } = await import('$lib/export/csv');
        await saveFile(`${fileBase}.csv`, daysCsv(ledger, period.start, period.end), 'text/csv');
      } else if (kind === 'entries') {
        const { entriesCsv } = await import('$lib/export/csv');
        await saveFile(`${fileBase}-entries.csv`, entriesCsv(ledger, period.start, period.end), 'text/csv');
      } else {
        const { absencesIcs } = await import('$lib/export/ics');
        const list = ledger.data.absences.filter((a) => a.date >= period.start && a.date <= period.end);
        await saveFile(`${fileBase}-absences.ics`, absencesIcs(list), 'text/calendar');
      }
    } catch (e) {
      if (!String(e).includes('cancel')) toast.error(m.export_failed());
      console.error(e);
    } finally {
      exporting = false;
    }
  }

  const vacTotal = $derived(vacation.entitlement + vacation.carryOver - vacation.carryOverLost);
</script>

<svelte:head><title>{m.tab_stats()} · PunchClock</title></svelte:head>

<PageHeader title={m.tab_stats()} />

<div class="flex flex-col gap-3" use:swipe={{ onLeft: () => shift(1), onRight: () => shift(-1) }}>
  <div
    class="flex items-center justify-between rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-lg shadow-primary/20"
  >
    <div>
      <p class="text-sm opacity-80">{m.balance_current()}</p>
      <p class="tabular text-3xl font-semibold tracking-tight">{formatMinutes(balance, { sign: true })}</p>
    </div>
    <div class="text-right">
      <p class="text-sm opacity-80">{m.vacation_left()}</p>
      <p class="tabular text-3xl font-semibold tracking-tight">
        {formatNumber(ledger.vacation(Number(ledger.today.slice(0, 4))).left)}
      </p>
    </div>
  </div>

  <Segmented
    value={view}
    options={[
      { value: 'week', label: m.view_week() },
      { value: 'month', label: m.view_month() },
      { value: 'year', label: m.view_year() }
    ]}
    onchange={(v) => navigate(v, anchor)}
  />
  <PeriodNav {period} onshift={shift} ontoday={() => navigate(view, ledger.today)} />
  <SummaryStrip {summary} />

  <section class="rounded-2xl bg-card p-4 shadow-xs ring-1 ring-border">
    <h2 class="text-sm font-medium">{m.worked_vs_target()}</h2>
    <BarChart {bars} valueLabel={m.worked()} targetLabel={m.target()} />
  </section>

  {#if balancePoints.length > 1}
    <section class="rounded-2xl bg-card p-4 shadow-xs ring-1 ring-border">
      <h2 class="text-sm font-medium">{m.balance_over_time()}</h2>
      <LineChart points={balancePoints} label={m.balance()} />
      <div class="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{m.balance_before()}: <Delta minutes={summary.balanceBefore} /></span>
        <span>{m.balance_after()}: <Delta minutes={summary.balanceAfter} /></span>
      </div>
    </section>
  {/if}

  <section class="grid grid-cols-2 gap-2">
    {#each [{ label: m.days_worked(), value: String(summary.daysWorked) }, { label: m.avg_per_day(), value: summary.avgWorked !== undefined ? formatMinutes(summary.avgWorked) : '–' }, { label: m.avg_start(), value: summary.avgStart !== undefined ? formatClock(summary.avgStart) : '–' }, { label: m.avg_end(), value: summary.avgEnd !== undefined ? formatClock(summary.avgEnd) : '–' }, { label: m.pause_total(), value: formatMinutes(summary.pause) }, { label: m.holidays(), value: String(summary.holidays) }] as tile (tile.label)}
      <div class="rounded-2xl bg-card p-3 shadow-xs ring-1 ring-border">
        <p class="text-xs text-muted-foreground">{tile.label}</p>
        <p class="tabular text-lg font-semibold">{tile.value}</p>
      </div>
    {/each}
  </section>

  <section class="rounded-2xl bg-card p-4 shadow-xs ring-1 ring-border">
    <div class="flex items-baseline justify-between">
      <h2 class="text-sm font-medium">{m.vacation_year({ year })}</h2>
      <span class="tabular text-sm text-muted-foreground"
        >{m.vacation_left_of({ left: formatNumber(vacation.left), total: formatNumber(vacTotal) })}</span
      >
    </div>
    <div class="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
      <div class="h-full bg-vacation" style="width: {vacTotal ? (vacation.taken / vacTotal) * 100 : 0}%"></div>
      <div
        class="h-full border-l-2 border-card bg-vacation/40"
        style="width: {vacTotal ? (vacation.planned / vacTotal) * 100 : 0}%"
      ></div>
    </div>
    <div class="mt-3 grid grid-cols-2 gap-y-1 text-sm">
      <span class="text-muted-foreground">{m.entitlement()}</span><span class="tabular text-right"
        >{formatNumber(vacation.entitlement)}</span
      >
      <span class="text-muted-foreground">{m.carry_over()}</span><span class="tabular text-right"
        >{formatNumber(vacation.carryOver)}</span
      >
      {#if vacation.carryOverLost}
        <span class="text-muted-foreground">{m.carry_over_lost()}</span><span class="tabular text-right text-negative"
          >−{formatNumber(vacation.carryOverLost)}</span
        >
      {/if}
      <span class="flex items-center gap-1.5 text-muted-foreground"
        ><span class="size-2 rounded-full bg-vacation"></span>{m.taken()}</span
      ><span class="tabular text-right">{formatNumber(vacation.taken)}</span>
      <span class="flex items-center gap-1.5 text-muted-foreground"
        ><span class="size-2 rounded-full bg-vacation/40"></span>{m.planned()}</span
      ><span class="tabular text-right">{formatNumber(vacation.planned)}</span>
    </div>
  </section>

  <section class="rounded-2xl bg-card p-4 shadow-xs ring-1 ring-border">
    <h2 class="mb-2 text-sm font-medium">{m.absences_in_period()}</h2>
    <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
      {#each ABSENCE_TYPES as t (t)}
        <div class="flex items-center gap-2">
          <span class={cn('size-2.5 rounded-full', absenceBg[t])}></span>
          <span class="flex-1 text-muted-foreground">{absenceLabel(t)}</span>
          <span class="tabular font-medium">{formatNumber(summary.absenceDays[t])}</span>
        </div>
      {/each}
    </div>
  </section>

  <section class="rounded-2xl bg-card p-4 shadow-xs ring-1 ring-border">
    <h2 class="text-sm font-medium">{m.export()}</h2>
    <p class="mb-3 text-xs text-muted-foreground">{m.export_hint()}</p>
    <div class="grid grid-cols-2 gap-2">
      <button
        type="button"
        disabled={exporting}
        onclick={() => run('pdf')}
        class="flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        <FileText class="size-4 text-primary" />{m.export_pdf()}
      </button>
      <button
        type="button"
        disabled={exporting}
        onclick={() => run('csv')}
        class="flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        <SheetIcon class="size-4 text-primary" />{m.export_csv_days()}
      </button>
      <button
        type="button"
        disabled={exporting}
        onclick={() => run('entries')}
        class="flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        <Table class="size-4 text-primary" />{m.export_csv_entries()}
      </button>
      <button
        type="button"
        disabled={exporting}
        onclick={() => run('ics')}
        class="flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        <CalendarPlus class="size-4 text-primary" />{m.export_ics()}
      </button>
    </div>
  </section>
</div>
