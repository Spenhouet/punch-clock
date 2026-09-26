<script lang="ts">
  import { resolve } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale, setLocale } from '$lib/paraglide/runtime';
  import { setMode, userPrefersMode } from 'mode-watcher';
  import { Briefcase, PiggyBank, TreePalm, Wifi, Database, ExternalLink, X, Plus } from '@lucide/svelte';
  import PageHeader from '$lib/components/app/PageHeader.svelte';
  import Group from '$lib/components/app/Group.svelte';
  import Row from '$lib/components/app/Row.svelte';
  import Segmented from '$lib/components/app/Segmented.svelte';
  import { Switch } from '$lib/components/ui/switch';
  import { Input } from '$lib/components/ui/input';
  import { app } from '$lib/state.svelte';
  import { saveSettings } from '$lib/db';
  import { scheduleFor } from '$lib/domain/calc';
  import { formatMinutes, formatNumber } from '$lib/format';
  import { isNative } from '$lib/native/index.svelte';
  import { STATE_NAMES } from '$lib/domain/holidays';
  import type { Rounding, RoundingMode } from '$lib/domain/types';

  const ledger = $derived(app.ledger!);
  const settings = $derived(ledger.settings);
  const schedule = $derived(scheduleFor(ledger.data.schedules, ledger.today));
  const weekly = $derived(schedule?.minutesPerWeekday.reduce((a, b) => a + b, 0) ?? 0);
  const vacation = $derived(ledger.vacation(Number(ledger.today.slice(0, 4))));

  let newPreset = $state('');
  function addPreset() {
    const v = Math.round(Number(newPreset));
    if (v > 0 && v <= 240 && !settings.breakPresets.includes(v)) {
      saveSettings({ breakPresets: [...settings.breakPresets, v].sort((a, b) => a - b) });
    }
    newPreset = '';
  }
  function removePreset(v: number) {
    saveSettings({ breakPresets: settings.breakPresets.filter((p) => p !== v) });
  }

  let name = $derived(settings.name);

  const version = __APP_VERSION__;
</script>

<svelte:head><title>{m.tab_settings()} · PunchClock</title></svelte:head>

<PageHeader title={m.tab_settings()} />

<div class="flex flex-col gap-6 pb-4 md:max-w-2xl">
  <Group title={m.settings_work()}>
    <Row
      icon={Briefcase}
      label={m.working_hours()}
      description={settings.state !== 'none'
        ? `${m.public_holidays()}: ${STATE_NAMES[settings.state] ?? settings.state}`
        : m.no_holidays()}
      value={m.hours_per_week({ hours: formatMinutes(weekly) })}
      href={resolve('/settings/work')}
    />
    <Row
      icon={PiggyBank}
      label={m.overtime_balance()}
      value={formatMinutes(ledger.balanceNow(), { sign: true })}
      href={resolve('/settings/balance')}
    />
    <Row
      icon={TreePalm}
      label={m.vacation()}
      value={m.days_left({ days: formatNumber(vacation.left) })}
      href={resolve('/settings/vacation')}
    />
  </Group>

  <Group title={m.settings_breaks()} footer={m.presets_hint()}>
    <div class="flex flex-wrap items-center gap-2 px-4 py-3">
      {#each settings.breakPresets as p (p)}
        <span class="inline-flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-3 text-sm font-medium tabular">
          {m.minutes_short({ minutes: p })}
          <button
            type="button"
            class="flex size-6 items-center justify-center rounded-full hover:bg-background"
            onclick={() => removePreset(p)}
            aria-label={m.remove()}
          >
            <X class="size-3.5" />
          </button>
        </span>
      {/each}
      <form class="inline-flex items-center gap-1" onsubmit={(e) => (e.preventDefault(), addPreset())}>
        <Input
          type="number"
          inputmode="numeric"
          min="1"
          max="240"
          bind:value={newPreset}
          placeholder={m.minutes_placeholder()}
          class="h-8 w-20"
        />
        <button
          type="submit"
          class="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-label={m.add()}><Plus class="size-4" /></button
        >
      </form>
    </div>
    <Row label={m.auto_break()} description={m.auto_break_hint()}>
      <Switch checked={settings.autoBreak} onCheckedChange={(v) => saveSettings({ autoBreak: v })} />
    </Row>
    <Row label={m.warnings()} description={m.warnings_hint()}>
      <Switch checked={settings.warnings} onCheckedChange={(v) => saveSettings({ warnings: v })} />
    </Row>
  </Group>

  <Group
    title={m.rounding()}
    footer={settings.rounding
      ? settings.roundingMode === 'employer'
        ? m.rounding_employer_hint()
        : m.rounding_nearest_hint()
      : m.rounding_off_hint()}
  >
    <div class="flex flex-col gap-2 px-4 py-3">
      <Segmented
        value={String(settings.rounding)}
        options={[
          { value: '0', label: m.off() },
          { value: '5', label: m.minutes_short({ minutes: 5 }) },
          { value: '10', label: m.minutes_short({ minutes: 10 }) },
          { value: '15', label: m.minutes_short({ minutes: 15 }) }
        ]}
        onchange={(v) => saveSettings({ rounding: Number(v) as Rounding })}
      />
      {#if settings.rounding}
        <Segmented
          value={settings.roundingMode}
          options={[
            { value: 'nearest', label: m.rounding_nearest() },
            { value: 'employer', label: m.rounding_employer() }
          ]}
          onchange={(v) => saveSettings({ roundingMode: v as RoundingMode })}
        />
      {/if}
    </div>
  </Group>

  <Group title={m.settings_automation()}>
    <Row
      icon={Wifi}
      label={m.notifications_and_wifi()}
      description={isNative
        ? settings.wifi.enabled && settings.wifi.ssid
          ? settings.wifi.ssid
          : m.wifi_off()
        : m.android_only()}
      href={resolve('/settings/automation')}
    />
  </Group>

  <Group title={m.settings_data()}>
    <Row
      icon={Database}
      label={m.backup_export()}
      description={m.backup_export_hint()}
      href={resolve('/settings/data')}
    />
  </Group>

  <Group title={m.settings_app()}>
    <div class="flex flex-col gap-3 px-4 py-3">
      <span class="text-body">{m.language()}</span>
      <Segmented
        value={getLocale()}
        options={[
          { value: 'en', label: 'English' },
          { value: 'de', label: 'Deutsch' }
        ]}
        onchange={(v) => setLocale(v as 'en' | 'de')}
      />
    </div>
    <div class="flex flex-col gap-3 px-4 py-3">
      <span class="text-body">{m.theme()}</span>
      <Segmented
        value={userPrefersMode.current}
        options={[
          { value: 'system', label: m.theme_system() },
          { value: 'light', label: m.theme_light() },
          { value: 'dark', label: m.theme_dark() }
        ]}
        onchange={(v) => setMode(v)}
      />
    </div>
    <div class="flex flex-col gap-2 px-4 py-3">
      <label for="name" class="text-body">{m.your_name()}</label>
      <Input
        id="name"
        bind:value={name}
        onblur={() => name !== settings.name && saveSettings({ name: name.trim() })}
        placeholder={m.your_name_hint()}
        class="h-10"
      />
    </div>
  </Group>

  <div class="flex flex-col items-center gap-1 text-xs text-muted-foreground">
    <a
      href="https://github.com/Spenhouet/punch-clock"
      target="_blank"
      rel="noopener"
      class="inline-flex items-center gap-1 hover:text-foreground"
    >
      <ExternalLink class="size-3.5" />PunchClock {version}
    </a>
    <span>{m.data_local_hint()}</span>
  </div>
</div>
