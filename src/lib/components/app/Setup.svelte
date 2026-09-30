<script lang="ts">
  import { asset } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale, setLocale } from '$lib/paraglide/runtime';
  import { toast } from 'svelte-sonner';
  import { ArrowRight, ArrowLeft, Upload, CloudDownload } from '@lucide/svelte';
  import Segmented from './Segmented.svelte';
  import HoursInput from './HoursInput.svelte';
  import NativeSelect from './NativeSelect.svelte';
  import Field from './Field.svelte';
  import OnlineBackupSheet from './OnlineBackupSheet.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { db, saveSettings } from '$lib/db';
  import { saveAdjustment, saveSchedule, saveVacationYear } from '$lib/db/entries';
  import { parseBackup, restoreBackup, type Backup } from '$lib/db/backup';
  import { sync, type SyncConfig } from '$lib/sync/index.svelte';
  import { pickTextFile } from '$lib/export/save';
  import { STATES, STATE_NAMES } from '$lib/domain/holidays';
  import { addDaysKey, periodOf, todayKey } from '$lib/domain/time';
  import type { WeekMinutes } from '$lib/domain/types';
  import { formatDate, formatMinutes } from '$lib/format';
  import { cn } from '$lib/utils';

  let step = $state(0);
  let name = $state('');
  let weekly = $state(40 * 60);
  let workdays = $state([true, true, true, true, true, false, false]);
  let region = $state('none');
  let balance = $state(0);
  let entitlement = $state(30);
  let left = $state(30);
  let leftTouched = false;

  const monday = periodOf('week', todayKey()).start;
  const dayNames = Array.from({ length: 7 }, (_, i) => formatDate(addDaysKey(monday, i), 'EEEEEE'));
  const count = $derived(workdays.filter(Boolean).length);

  $effect(() => {
    if (!leftTouched) left = entitlement;
  });

  async function finish() {
    const today = todayKey();
    const per = count ? Math.floor(weekly / count) : 0;
    let rest = weekly - per * count;
    const minutes = workdays.map((on) => (on ? per + (rest-- > 0 ? 1 : 0) : 0)) as WeekMinutes;
    await db.schedules.clear();
    await saveSchedule({ validFrom: '1970-01-01', minutesPerWeekday: minutes });
    if (balance) await saveAdjustment({ date: addDaysKey(today, -1), minutes: balance, reason: m.reason_initial() });
    const year = Number(today.slice(0, 4));
    await saveVacationYear({
      year,
      entitlementDays: entitlement,
      carryOverDays: left !== entitlement ? left - entitlement : 0
    });
    await saveSettings({
      setupDone: true,
      name: name.trim(),
      state: region,
      trackingStart: today,
      defaultVacationDays: entitlement
    });
  }

  async function skip() {
    await saveSettings({ setupDone: true, trackingStart: todayKey() });
  }

  async function restore() {
    const text = await pickTextFile();
    if (!text) return;
    try {
      const backup = parseBackup(text);
      await restoreBackup(backup);
      toast.success(m.restore_done({ count: backup.data.segments.length }));
    } catch {
      toast.error(m.restore_invalid());
    }
  }

  // A new phone: nothing to lose here, so the online backup is restored without asking again
  let onlineOpen = $state(false);
  async function restoreOnline(backup: Backup, config: SyncConfig) {
    await restoreBackup(backup);
    await sync.adopt(config);
    toast.success(m.restore_done({ count: backup.data.segments.length }));
  }

  const stateOptions = $derived([
    { value: 'none', label: m.no_holidays() },
    ...STATES.map((s) => ({ value: s, label: STATE_NAMES[s] }))
  ]);
</script>

<div class="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-safe-10 pb-8">
  <div class="mb-8 flex items-center gap-3">
    <img src={asset('/favicon.svg')} alt="" class="size-11 rounded-xl" />
    <div class="flex flex-1 gap-1.5">
      {#each [0, 1, 2] as i (i)}
        <span class={cn('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-primary' : 'bg-muted')}></span>
      {/each}
    </div>
  </div>

  <div class="flex flex-1 flex-col gap-6">
    {#if step === 0}
      <div>
        <h1 class="text-3xl font-semibold tracking-tight">{m.setup_welcome()}</h1>
        <p class="mt-2 text-muted-foreground">{m.setup_welcome_body()}</p>
      </div>
      <Field label={m.language()}>
        <Segmented
          value={getLocale()}
          options={[
            { value: 'en', label: 'English' },
            { value: 'de', label: 'Deutsch' }
          ]}
          onchange={(v) => setLocale(v as 'en' | 'de')}
        />
      </Field>
      <Field label={m.your_name()} hint={m.your_name_hint()}>
        <Input bind:value={name} class="h-11" autocomplete="name" />
      </Field>
      <div class="mt-auto flex flex-col items-start gap-3">
        <button
          type="button"
          class="inline-flex items-center gap-2 text-sm font-medium text-primary"
          onclick={() => (onlineOpen = true)}
        >
          <CloudDownload class="size-4" />{m.gist_restore()}
        </button>
        <button type="button" class="inline-flex items-center gap-2 text-sm font-medium text-primary" onclick={restore}>
          <Upload class="size-4" />{m.setup_restore()}
        </button>
      </div>
    {:else if step === 1}
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{m.setup_hours_title()}</h1>
        <p class="mt-2 text-muted-foreground">{m.setup_hours_body()}</p>
      </div>
      <Field label={m.hours_per_week_label()}>
        <HoursInput bind:minutes={weekly} class="h-12 w-32 text-xl font-semibold" />
      </Field>
      <Field label={m.workdays()} hint={count ? m.per_day({ hours: formatMinutes(weekly / count) }) : ''}>
        <div class="flex gap-1.5">
          {#each dayNames as d, i (i)}
            <button
              type="button"
              class={cn(
                'flex h-11 flex-1 items-center justify-center rounded-xl text-sm font-medium transition-colors',
                workdays[i] ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}
              onclick={() => (workdays[i] = !workdays[i])}
              aria-pressed={workdays[i]}>{d}</button
            >
          {/each}
        </div>
      </Field>
      <Field label={m.public_holidays()} hint={m.public_holidays_hint()}>
        <NativeSelect bind:value={region} options={stateOptions} />
      </Field>
    {:else}
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{m.setup_start_title()}</h1>
        <p class="mt-2 text-muted-foreground">{m.setup_start_body()}</p>
      </div>
      <Field label={m.setup_balance()} hint={m.setup_balance_hint()}>
        <HoursInput bind:minutes={balance} allowNegative class="h-12 w-32 text-xl font-semibold" />
      </Field>
      <div class="grid grid-cols-2 gap-3">
        <Field label={m.days_per_year()}>
          <Input type="number" inputmode="decimal" min="0" step="0.5" bind:value={entitlement} class="h-11" />
        </Field>
        <Field label={m.setup_vacation_left()}>
          <Input
            type="number"
            inputmode="decimal"
            min="0"
            step="0.5"
            bind:value={left}
            oninput={() => (leftTouched = true)}
            class="h-11"
          />
        </Field>
      </div>
    {/if}
  </div>

  <div class="mt-8 flex items-center gap-3">
    {#if step > 0}
      <Button variant="ghost" size="lg" onclick={() => step--}><ArrowLeft />{m.back()}</Button>
    {:else}
      <Button variant="ghost" size="lg" onclick={skip}>{m.skip()}</Button>
    {/if}
    <Button size="lg" class="flex-1" onclick={() => (step < 2 ? step++ : finish())}>
      {step < 2 ? m.next() : m.setup_finish()}
      <ArrowRight />
    </Button>
  </div>
</div>

<OnlineBackupSheet bind:open={onlineOpen} mode="restore" onopened={restoreOnline} />
