<script lang="ts">
  import { resolve } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';
  import { Play, Square, Coffee, Plus, ChevronRight, TriangleAlert, NotebookPen, Timer } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import ProgressRing from '$lib/components/app/ProgressRing.svelte';
  import SegmentList from '$lib/components/app/SegmentList.svelte';
  import Delta from '$lib/components/app/Delta.svelte';
  import { app } from '$lib/state.svelte';
  import { ui } from '$lib/ui.svelte';
  import { stamp } from '$lib/stamp';
  import { formatDate, formatDuration, formatMinutes, toHHmm } from '$lib/format';
  import { absenceBg, absenceLabel, warningLabel } from '$lib/labels';
  import { isoWeek, MINUTE, periodOf } from '$lib/domain/time';
  import { cn } from '$lib/utils';

  const ledger = $derived(app.ledger!);
  const today = $derived(ledger.day(ledger.today));
  const status = $derived(ledger.status);
  const running = $derived(ledger.running);
  const settings = $derived(ledger.settings);
  const week = $derived.by(() => {
    const p = periodOf('week', ledger.today);
    return ledger.period(p.start, p.end);
  });
  const balance = $derived(ledger.balanceNow());

  const workedMs = $derived(
    today.segments.filter((s) => s.kind === 'work').reduce((sum, s) => sum + ((s.end ?? app.now) - s.start), 0)
  );
  const breakMs = $derived(running?.kind === 'break' ? app.now - running.start : 0);
  const remaining = $derived(today.target - today.worked);
  const progress = $derived(today.target > 0 ? today.worked / today.target : today.worked > 0 ? 1 : 0);
  const doneAt = $derived(status === 'working' && remaining > 0 ? app.now + remaining * MINUTE : undefined);
  const breakLeft = $derived(running?.plannedEnd ? running.plannedEnd - app.now : undefined);

  function act(action: 'in' | 'out' | 'break' | 'resume', minutes?: number) {
    stamp(action, minutes);
  }

  function addEntry() {
    const end = Date.now();
    ui.editSegment({ kind: 'work', start: end - 60 * MINUTE, end, source: 'manual' });
  }
</script>

<svelte:head><title>PunchClock</title></svelte:head>

<header class="flex items-end justify-between pt-6 pb-2" style="padding-top: calc(env(safe-area-inset-top) + 1.5rem)">
  <div>
    <p class="text-sm text-muted-foreground">{formatDate(ledger.today, 'EEEE, d. MMMM')}</p>
    <h1 class="text-2xl font-semibold tracking-tight">{m.tab_today()}</h1>
  </div>
  <a
    href={resolve('/stats')}
    class="flex flex-col items-end rounded-xl px-3 py-1.5 transition-colors hover:bg-muted"
    aria-label={m.balance()}
  >
    <span class="text-xs text-muted-foreground">{m.balance()}</span>
    <Delta minutes={balance} class="text-lg font-semibold" />
  </a>
</header>

<section class="flex flex-col items-center gap-6 pt-4 pb-6">
  <ProgressRing value={progress} size={248} stroke={14} color={status === 'break' ? 'var(--break)' : 'var(--primary)'}>
    <span
      class={cn(
        'mb-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        status === 'working' && 'bg-positive/15 text-positive',
        status === 'break' && 'bg-break/20 text-break',
        status === 'out' && 'bg-muted text-muted-foreground'
      )}
      data-testid="status"
    >
      {#if status !== 'out'}<span class="size-1.5 animate-pulse rounded-full bg-current"></span>{/if}
      {status === 'working' ? m.status_working() : status === 'break' ? m.status_break() : m.status_out()}
    </span>
    {#if status === 'break'}
      <span class="tabular text-[2.75rem] leading-none font-semibold tracking-tight"
        >{formatDuration(breakMs, true)}</span
      >
      <span class="mt-2 text-sm text-muted-foreground">
        {#if breakLeft !== undefined}
          {m.break_ends_at({ time: toHHmm(running!.plannedEnd!) })}
        {:else}
          {m.break_since({ time: toHHmm(running!.start) })}
        {/if}
      </span>
    {:else}
      <span class="tabular text-[2.75rem] leading-none font-semibold tracking-tight" data-testid="timer"
        >{formatDuration(workedMs, status === 'working')}</span
      >
      <span class="mt-2 text-sm text-muted-foreground">
        {#if today.target > 0}
          {m.of_target({ target: formatMinutes(today.target) })}
        {:else}
          {m.no_target_today()}
        {/if}
      </span>
    {/if}
  </ProgressRing>

  <div class="flex w-full max-w-sm gap-3">
    {#if status === 'out'}
      <Button size="lg" class="h-16 flex-1 rounded-2xl text-lg shadow-lg shadow-primary/20" onclick={() => act('in')}>
        <Play class="size-5 fill-current" />
        {m.clock_in()}
      </Button>
    {:else}
      {#if status === 'working'}
        <Button size="lg" variant="secondary" class="h-16 flex-1 rounded-2xl text-lg" onclick={() => act('break')}>
          <Coffee class="size-5" />
          {m.start_break()}
        </Button>
      {:else}
        <Button
          size="lg"
          class="h-16 flex-1 rounded-2xl bg-break text-lg text-black hover:bg-break/85"
          onclick={() => act('resume')}
        >
          <Play class="size-5 fill-current" />
          {m.end_break()}
        </Button>
      {/if}
      <Button size="lg" variant="outline" class="h-16 flex-1 rounded-2xl text-lg" onclick={() => act('out')}>
        <Square class="size-4 fill-current" />
        {m.clock_out()}
      </Button>
    {/if}
  </div>

  {#if status === 'working' && settings.breakPresets.length}
    <div class="-mt-2 flex w-full max-w-sm flex-col items-center gap-2">
      <span class="text-xs text-muted-foreground">{m.quick_break()}</span>
      <div class="flex w-full justify-center gap-2">
        {#each settings.breakPresets as minutes (minutes)}
          <button
            type="button"
            class="tabular flex-1 rounded-full border px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted active:bg-muted"
            onclick={() => act('break', minutes)}
          >
            {m.minutes_short({ minutes })}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</section>

<section class="grid grid-cols-3 gap-2">
  <div class="rounded-2xl bg-card p-3 shadow-xs ring-1 ring-border">
    <p class="text-xs text-muted-foreground">{m.worked()}</p>
    <p class="tabular text-lg font-semibold">{formatMinutes(today.worked)}</p>
  </div>
  <div class="rounded-2xl bg-card p-3 shadow-xs ring-1 ring-border">
    <p class="text-xs text-muted-foreground">{m.pause()}</p>
    <p class="tabular text-lg font-semibold">{formatMinutes(today.pause)}</p>
  </div>
  <div class="rounded-2xl bg-card p-3 shadow-xs ring-1 ring-border">
    {#if remaining > 0}
      <p class="text-xs text-muted-foreground">{doneAt ? m.done_at() : m.remaining()}</p>
      <p class="tabular text-lg font-semibold">{doneAt ? toHHmm(doneAt) : formatMinutes(remaining)}</p>
    {:else}
      <p class="text-xs text-muted-foreground">{m.overtime_today()}</p>
      <p class="text-lg font-semibold"><Delta minutes={-remaining} /></p>
    {/if}
  </div>
</section>

{#if today.absences.length || today.holiday || today.warnings.length}
  <section class="mt-3 flex flex-col gap-2">
    {#if today.holiday}
      <div class="flex items-center gap-2 rounded-xl bg-holiday/15 px-3 py-2 text-sm">
        <span class="size-2 rounded-full bg-holiday"></span>{today.holiday}
      </div>
    {/if}
    {#each today.absences as a (a.id)}
      <div class="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
        <span class={cn('size-2 rounded-full', absenceBg[a.type])}></span>
        {absenceLabel(a.type)}{a.fraction === 0.5 ? ` (${m.half_day()})` : ''}{a.label ? ` · ${a.label}` : ''}
      </div>
    {/each}
    {#each today.warnings as w (w)}
      <div class="flex items-center gap-2 rounded-xl bg-break/12 px-3 py-2 text-sm">
        <TriangleAlert class="size-4 shrink-0 text-break" />{warningLabel(w)}
      </div>
    {/each}
  </section>
{/if}

<a
  href={resolve('/calendar')}
  class="mt-3 block rounded-2xl bg-card p-4 shadow-xs ring-1 ring-border transition-colors hover:bg-muted/50"
>
  <div class="flex items-center justify-between">
    <span class="text-sm font-medium">{m.week_number({ week: isoWeek(ledger.today).week })}</span>
    <span class="flex items-center gap-1 text-sm">
      <span class="tabular">{formatMinutes(week.worked)} / {formatMinutes(week.target)}</span>
      <ChevronRight class="size-4 text-muted-foreground" />
    </span>
  </div>
  <div class="mt-3 flex gap-1">
    {#each week.days as d (d.date)}
      {@const pct = d.target > 0 ? Math.min(1, d.worked / d.target) : d.worked > 0 ? 1 : 0}
      <div class="flex flex-1 flex-col items-center gap-1">
        <div
          class={cn(
            'relative h-10 w-full overflow-hidden rounded-md bg-muted',
            d.date === ledger.today && 'ring-2 ring-primary/40'
          )}
        >
          {#if d.absences.length}
            <div
              class={cn('absolute inset-x-0 bottom-0 opacity-60', absenceBg[d.absences[0].type])}
              style="height: {d.absences[0].fraction * 100}%"
            ></div>
          {/if}
          <div class="absolute inset-x-0 bottom-0 bg-primary" style="height: {pct * 100}%"></div>
        </div>
        <span
          class={cn('text-[10px] text-muted-foreground', d.date === ledger.today && 'font-semibold text-foreground')}
        >
          {formatDate(d.date, 'EEEEEE')}
        </span>
      </div>
    {/each}
  </div>
</a>

<section class="mt-3 rounded-2xl bg-card p-2 shadow-xs ring-1 ring-border">
  <div class="flex items-center justify-between px-2 pt-1 pb-1">
    <h2 class="text-sm font-medium">{m.entries()}</h2>
    <div class="flex gap-1">
      <Button variant="ghost" size="sm" onclick={() => ui.openDay(ledger.today)}>
        <NotebookPen />{m.day_details()}
      </Button>
      <Button variant="ghost" size="sm" onclick={addEntry}>
        <Plus />{m.add()}
      </Button>
    </div>
  </div>
  {#if today.segments.length}
    <SegmentList segments={today.segments} />
  {:else}
    <div class="flex flex-col items-center gap-1 px-4 py-6 text-center text-sm text-muted-foreground">
      <Timer class="size-6 opacity-50" />
      {m.no_entries_today()}
    </div>
  {/if}
  {#if today.note}
    <button
      type="button"
      class="mx-2 mb-2 block w-[calc(100%-1rem)] rounded-xl bg-muted px-3 py-2 text-left text-sm"
      onclick={() => ui.openDay(ledger.today)}
    >
      {today.note}
    </button>
  {/if}
</section>
