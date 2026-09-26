<script lang="ts">
  import { resolve } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';
  import { toast } from 'svelte-sonner';
  import { Trash2, Plus } from '@lucide/svelte';
  import PageHeader from '$lib/components/app/PageHeader.svelte';
  import Group from '$lib/components/app/Group.svelte';
  import Row from '$lib/components/app/Row.svelte';
  import HoursInput from '$lib/components/app/HoursInput.svelte';
  import NativeSelect from '$lib/components/app/NativeSelect.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { app } from '$lib/state.svelte';
  import { saveSettings } from '$lib/db';
  import { deleteSchedule, saveSchedule } from '$lib/db/entries';
  import { scheduleFor } from '$lib/domain/calc';
  import { STATES, STATE_NAMES } from '$lib/domain/holidays';
  import { addDaysKey, periodOf } from '$lib/domain/time';
  import type { WeekMinutes, WorkSchedule } from '$lib/domain/types';
  import { formatDate, formatMinutes } from '$lib/format';

  const ledger = $derived(app.ledger!);
  const settings = $derived(ledger.settings);
  const schedules = $derived([...ledger.data.schedules].sort((a, b) => b.validFrom.localeCompare(a.validFrom)));

  let editingId = $state<string | null>(null);
  const current = $derived(
    (editingId && ledger.data.schedules.find((s) => s.id === editingId)) ||
      scheduleFor(ledger.data.schedules, ledger.today)!
  );
  const weekly = $derived(current.minutesPerWeekday.reduce((a, b) => a + b, 0));
  const weekdays = $derived.by(() => {
    const monday = periodOf('week', ledger.today).start;
    return Array.from({ length: 7 }, (_, i) => formatDate(addDaysKey(monday, i), 'EEEE'));
  });

  function update(s: WorkSchedule, minutes: WeekMinutes) {
    saveSchedule({ ...$state.snapshot(s), minutesPerWeekday: minutes });
  }

  function setWeekly(total: number) {
    const days = current.minutesPerWeekday.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
    const active = days.length ? days : [0, 1, 2, 3, 4];
    const each = Math.floor(total / active.length);
    const rest = total - each * active.length;
    const next = [0, 0, 0, 0, 0, 0, 0] as WeekMinutes;
    active.forEach((d, i) => (next[d] = each + (i < rest ? 1 : 0)));
    update(current, next);
  }

  function setDay(i: number, v: number) {
    const next = [...current.minutesPerWeekday] as WeekMinutes;
    next[i] = Math.max(0, Math.min(24 * 60, v));
    update(current, next);
  }

  let newFrom = $state('');
  async function addChange() {
    if (!newFrom) return;
    const id = crypto.randomUUID();
    await saveSchedule({ id, validFrom: newFrom, minutesPerWeekday: [...current.minutesPerWeekday] as WeekMinutes });
    editingId = id;
    newFrom = '';
    toast.success(m.schedule_added());
  }

  const stateOptions = $derived([
    { value: 'none', label: m.no_holidays() },
    ...STATES.map((s) => ({ value: s, label: STATE_NAMES[s] }))
  ]);
</script>

<PageHeader title={m.working_hours()} back={resolve('/settings')} />

<div class="flex flex-col gap-6 pb-4 md:max-w-2xl">
  <Group
    title={schedules.length > 1
      ? m.schedule_from({
          date: current.validFrom === '1970-01-01' ? m.beginning() : formatDate(current.validFrom, 'P')
        })
      : m.weekly_target()}
    footer={m.weekly_hours_hint()}
  >
    <Row label={m.hours_per_week_label()}>
      <HoursInput minutes={weekly} onchange={setWeekly} class="w-24 font-semibold" />
    </Row>
    {#each weekdays as name, i (i)}
      <Row label={name}>
        <HoursInput minutes={current.minutesPerWeekday[i]} onchange={(v) => setDay(i, v)} />
      </Row>
    {/each}
  </Group>

  <Group title={m.schedule_history()} footer={m.schedule_history_hint()}>
    {#each schedules as s (s.id)}
      <div class="flex min-h-14 items-center gap-2 px-4 py-2">
        <button type="button" class="flex flex-1 flex-col text-left" onclick={() => (editingId = s.id)}>
          <span class="text-body {s.id === current.id ? 'font-semibold text-primary' : ''}">
            {s.validFrom === '1970-01-01' ? m.schedule_initial() : m.since_date({ date: formatDate(s.validFrom, 'P') })}
          </span>
          <span class="text-xs text-muted-foreground tabular"
            >{m.hours_per_week({ hours: formatMinutes(s.minutesPerWeekday.reduce((a, b) => a + b, 0)) })}</span
          >
        </button>
        {#if schedules.length > 1}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={m.delete()}
            onclick={() => {
              deleteSchedule(s.id);
              if (editingId === s.id) editingId = null;
            }}
          >
            <Trash2 />
          </Button>
        {/if}
      </div>
    {/each}
    <form class="flex items-center gap-2 px-4 py-3" onsubmit={(e) => (e.preventDefault(), addChange())}>
      <Input type="date" bind:value={newFrom} class="h-10 flex-1" aria-label={m.valid_from()} />
      <Button type="submit" variant="secondary" disabled={!newFrom}><Plus />{m.add_change()}</Button>
    </form>
  </Group>

  <Group title={m.public_holidays()} footer={m.public_holidays_hint()}>
    <div class="px-4 py-3">
      <NativeSelect value={settings.state} options={stateOptions} onchange={(v) => saveSettings({ state: v })} />
    </div>
  </Group>

  <Group title={m.default_start()} footer={m.default_start_hint()}>
    <div class="px-4 py-3">
      <Input
        type="time"
        value={settings.defaultStart}
        onchange={(e) => {
          const v = (e.target as HTMLInputElement).value;
          if (v) saveSettings({ defaultStart: v });
        }}
        class="h-10"
      />
    </div>
  </Group>

  <Group title={m.tracking_start()} footer={m.tracking_start_hint()}>
    <div class="px-4 py-3">
      <Input
        type="date"
        value={settings.trackingStart}
        onchange={(e) => {
          const v = (e.target as HTMLInputElement).value;
          if (v) saveSettings({ trackingStart: v });
        }}
        class="h-10"
      />
    </div>
  </Group>
</div>
