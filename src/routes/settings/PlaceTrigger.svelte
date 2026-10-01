<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Segmented from '$lib/components/app/Segmented.svelte';
  import NativeSelect from '$lib/components/app/NativeSelect.svelte';
  import Field from '$lib/components/app/Field.svelte';
  import { Switch } from '$lib/components/ui/switch';
  import { Input } from '$lib/components/ui/input';
  import { isNative } from '$lib/native/index.svelte';
  import { PunchClock } from '$lib/native/plugin';
  import type { WifiTrigger } from '$lib/domain/types';

  /** Wi-Fi clock in / out of the place being edited. */
  let { trigger = $bindable(), hasNetworks }: { trigger: WifiTrigger; hasNetworks: boolean } = $props();

  const graceOptions = [0, 2, 5, 10, 15, 30].map((v) => ({
    value: String(v),
    label: v ? m.minutes_short({ minutes: v }) : m.immediately()
  }));

  async function toggle(v: boolean) {
    // The trigger reads Wi-Fi names in the background and posts notifications
    if (v) await PunchClock.requestPermissions({ permissions: ['location', 'notifications'] }).catch(() => {});
    trigger.enabled = v;
  }
</script>

<div class="flex flex-col gap-3 rounded-xl bg-muted/50 p-3">
  <label class="flex items-center gap-3">
    <span class="flex-1">
      <span class="block text-sm font-medium">{m.wifi_enable()}</span>
      <span class="block text-xs text-muted-foreground">
        {!isNative ? m.android_only() : hasNetworks ? m.wifi_trigger_hint() : m.wifi_trigger_needs_network()}
      </span>
    </span>
    <Switch checked={trigger.enabled} disabled={!isNative || !hasNetworks} onCheckedChange={toggle} />
  </label>
  {#if trigger.enabled && isNative && hasNetworks}
    <div class="flex flex-col gap-2">
      <span class="text-sm font-medium">{m.wifi_mode()}</span>
      <Segmented
        bind:value={trigger.mode}
        options={[
          { value: 'ask', label: m.wifi_mode_ask() },
          { value: 'auto', label: m.wifi_mode_auto() }
        ]}
      />
      <span class="text-xs text-muted-foreground">
        {trigger.mode === 'ask' ? m.wifi_mode_ask_hint() : m.wifi_mode_auto_hint()}
      </span>
    </div>
    <label class="flex items-center gap-3">
      <span class="flex-1">
        <span class="block text-sm font-medium">{m.wifi_clock_out()}</span>
        <span class="block text-xs text-muted-foreground">{m.wifi_clock_out_hint()}</span>
      </span>
      <Switch bind:checked={trigger.clockOutOnDisconnect} />
    </label>
    {#if trigger.clockOutOnDisconnect}
      <div class="flex items-center gap-3">
        <span class="flex-1">
          <span class="block text-sm font-medium">{m.wifi_grace()}</span>
          <span class="block text-xs text-muted-foreground">{m.wifi_grace_hint()}</span>
        </span>
        <NativeSelect
          class="w-32"
          value={String(trigger.graceMinutes)}
          options={graceOptions}
          onchange={(v) => (trigger.graceMinutes = Number(v))}
        />
      </div>
      <label class="flex items-center gap-3">
        <span class="flex-1">
          <span class="block text-sm font-medium">{m.wifi_break_window()}</span>
          <span class="block text-xs text-muted-foreground">{m.wifi_break_window_hint()}</span>
        </span>
        <Switch bind:checked={trigger.breakWindow} />
      </label>
      {#if trigger.breakWindow}
        <div class="grid grid-cols-2 gap-3">
          <Field label={m.from()}>
            <Input type="time" bind:value={trigger.breakFrom} required class="h-10" />
          </Field>
          <Field label={m.to()}>
            <Input type="time" bind:value={trigger.breakTo} required class="h-10" />
          </Field>
          <p class="col-span-2 text-xs text-muted-foreground">
            {m.wifi_break_window_detail({ to: trigger.breakTo })}
          </p>
        </div>
      {/if}
    {/if}
  {/if}
</div>
