<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { toast } from 'svelte-sonner';
  import { Wifi, Bell, BatteryCharging, MapPin, Smartphone, Check, Workflow, LayoutGrid } from '@lucide/svelte';
  import Group from '$lib/components/app/Group.svelte';
  import Row from '$lib/components/app/Row.svelte';
  import Segmented from '$lib/components/app/Segmented.svelte';
  import NativeSelect from '$lib/components/app/NativeSelect.svelte';
  import Field from '$lib/components/app/Field.svelte';
  import { Switch } from '$lib/components/ui/switch';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { app } from '$lib/state.svelte';
  import { saveSettings } from '$lib/db';
  import { configureWifi, isNative } from '$lib/native/index.svelte';
  import { PunchClock, type NativePermissions } from '$lib/native/plugin';
  import type { Settings } from '$lib/domain/types';
  import { activePlaces } from '$lib/domain/places';

  const settings = $derived(app.ledger!.settings);
  // Reading the Wi-Fi name needs location access, for the trigger and for places alike
  const placesUseWifi = $derived(activePlaces(settings).some((p) => p.ssids.length));
  let perms = $state<NativePermissions | null>(null);
  let batteryOk = $state(false);
  let ssid = $state('');
  let canPin = $state(false);

  async function refresh() {
    if (!isNative) return;
    perms = await PunchClock.checkPermissions().catch(() => null);
    batteryOk = (await PunchClock.isIgnoringBatteryOptimizations().catch(() => ({ value: false }))).value;
    canPin = (await PunchClock.canPinWidget().catch(() => ({ value: false }))).value;
  }
  $effect(() => {
    refresh();
    ssid = app.data!.settings.wifi.ssid;
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });

  async function saveWifi(patch: Partial<Settings['wifi']>) {
    await saveSettings({ wifi: { ...settings.wifi, ...patch } });
    await configureWifi();
  }

  async function setNotifications(v: boolean) {
    if (v && isNative) await PunchClock.requestPermissions({ permissions: ['notifications'] }).catch(() => {});
    await saveSettings({ notifications: v });
    refresh();
  }

  async function grantLocation() {
    perms = await PunchClock.requestPermissions({ permissions: ['location'] });
  }
  async function grantBackground() {
    perms = await PunchClock.requestPermissions({ permissions: ['backgroundLocation'] });
    if (perms.backgroundLocation !== 'granted') PunchClock.openAppSettings();
  }

  async function useCurrent() {
    if (perms?.location !== 'granted') await grantLocation();
    const { ssid: current } = await PunchClock.getWifiSsid().catch(() => ({ ssid: null }));
    if (current) {
      ssid = current;
      await saveWifi({ ssid: current });
      toast.success(m.wifi_saved({ ssid: current }));
    } else {
      toast.error(m.wifi_none());
    }
  }

  async function toggleWifi(v: boolean) {
    if (v) {
      await PunchClock.requestPermissions({ permissions: ['location', 'notifications'] }).catch(() => {});
      await refresh();
    }
    await saveWifi({ enabled: v });
  }

  const reminderOptions = $derived([
    { value: '0', label: m.off() },
    ...[480, 540, 600, 660, 720].map((v) => ({ value: String(v), label: m.after_hours({ hours: v / 60 }) }))
  ]);
  const graceOptions = [0, 2, 5, 10, 15, 30].map((v) => ({
    value: String(v),
    label: v ? m.minutes_short({ minutes: v }) : m.immediately()
  }));
</script>

{#if !isNative}
  <div class="flex gap-3 rounded-2xl bg-primary/10 p-4 text-sm">
    <Smartphone class="size-5 shrink-0 text-primary" />
    <div>
      <p class="font-medium">{m.android_only_title()}</p>
      <p class="mt-1 text-muted-foreground">{m.android_only_body()}</p>
      <a
        class="mt-2 inline-block font-medium text-primary underline-offset-4 hover:underline"
        href="https://github.com/Spenhouet/punch-clock/releases/latest"
        target="_blank"
        rel="noopener">{m.download_apk()}</a
      >
    </div>
  </div>
{/if}

<Group title={m.notifications()} footer={m.notifications_hint()}>
  <Row
    icon={Bell}
    label={m.notification_ongoing()}
    description={perms && perms.notifications !== 'granted' && settings.notifications
      ? m.permission_missing()
      : undefined}
  >
    <Switch checked={settings.notifications} disabled={!isNative} onCheckedChange={setNotifications} />
  </Row>
  <div class="flex items-center gap-3 px-4 py-3">
    <span class="flex-1 text-body">{m.reminder()}</span>
    <NativeSelect
      class="w-40"
      value={String(settings.reminderAfterMinutes)}
      options={reminderOptions}
      onchange={(v) => saveSettings({ reminderAfterMinutes: Number(v) })}
    />
  </div>
</Group>

{#if isNative && canPin}
  <Group title={m.widget()} footer={m.widget_hint()}>
    <Row icon={LayoutGrid} label={m.widget_add()} onclick={() => PunchClock.pinWidget().catch(() => {})} />
  </Group>
{/if}

<Group title={m.wifi_trigger()} footer={m.wifi_trigger_hint()}>
  <Row icon={Wifi} label={m.wifi_enable()}>
    <Switch checked={settings.wifi.enabled} disabled={!isNative} onCheckedChange={toggleWifi} />
  </Row>
  {#if settings.wifi.enabled}
    <div class="flex flex-col gap-2 px-4 py-3">
      <label for="ssid" class="text-body">{m.wifi_network()}</label>
      <div class="flex gap-2">
        <Input
          id="ssid"
          bind:value={ssid}
          onblur={() => ssid.trim() !== settings.wifi.ssid && saveWifi({ ssid: ssid.trim() })}
          placeholder={m.wifi_placeholder()}
          class="h-10 flex-1"
        />
        <Button variant="secondary" onclick={useCurrent}>{m.wifi_use_current()}</Button>
      </div>
    </div>
    <div class="flex flex-col gap-2 px-4 py-3">
      <span class="text-body">{m.wifi_mode()}</span>
      <Segmented
        value={settings.wifi.mode}
        options={[
          { value: 'ask', label: m.wifi_mode_ask() },
          { value: 'auto', label: m.wifi_mode_auto() }
        ]}
        onchange={(v) => saveWifi({ mode: v as 'ask' | 'auto' })}
      />
      <p class="text-xs text-muted-foreground">
        {settings.wifi.mode === 'ask' ? m.wifi_mode_ask_hint() : m.wifi_mode_auto_hint()}
      </p>
    </div>
    <Row label={m.wifi_clock_out()} description={m.wifi_clock_out_hint()}>
      <Switch
        checked={settings.wifi.clockOutOnDisconnect}
        onCheckedChange={(v) => saveWifi({ clockOutOnDisconnect: v })}
      />
    </Row>
    {#if settings.wifi.clockOutOnDisconnect}
      <div class="flex items-center gap-3 px-4 py-3">
        <span class="flex-1">
          <span class="block text-body">{m.wifi_grace()}</span>
          <span class="block text-xs text-muted-foreground">{m.wifi_grace_hint()}</span>
        </span>
        <NativeSelect
          class="w-32"
          value={String(settings.wifi.graceMinutes)}
          options={graceOptions}
          onchange={(v) => saveWifi({ graceMinutes: Number(v) })}
        />
      </div>
      <Row label={m.wifi_break_window()} description={m.wifi_break_window_hint()}>
        <Switch checked={settings.wifi.breakWindow} onCheckedChange={(v) => saveWifi({ breakWindow: v })} />
      </Row>
      {#if settings.wifi.breakWindow}
        <div class="grid grid-cols-2 gap-3 px-4 py-3">
          <Field label={m.from()}>
            <Input
              type="time"
              value={settings.wifi.breakFrom}
              onchange={(e) => {
                const v = (e.target as HTMLInputElement).value;
                if (v) saveWifi({ breakFrom: v });
              }}
              class="h-10"
            />
          </Field>
          <Field label={m.to()}>
            <Input
              type="time"
              value={settings.wifi.breakTo}
              onchange={(e) => {
                const v = (e.target as HTMLInputElement).value;
                if (v) saveWifi({ breakTo: v });
              }}
              class="h-10"
            />
          </Field>
          <p class="col-span-2 text-xs text-muted-foreground">
            {m.wifi_break_window_detail({ to: settings.wifi.breakTo })}
          </p>
        </div>
      {/if}
    {/if}
  {/if}
</Group>

{#if isNative && (settings.wifi.enabled || placesUseWifi) && perms}
  <Group title={m.permissions()} footer={m.permissions_hint()}>
    <Row icon={MapPin} label={m.perm_location()} description={m.perm_location_hint()}>
      {#if perms.location === 'granted'}<Check class="size-5 text-positive" />{:else}<Button
          size="sm"
          onclick={grantLocation}>{m.grant()}</Button
        >{/if}
    </Row>
    {#if settings.wifi.enabled}
      <Row icon={MapPin} label={m.perm_background()} description={m.perm_background_hint()}>
        {#if perms.backgroundLocation === 'granted'}<Check class="size-5 text-positive" />{:else}<Button
            size="sm"
            onclick={grantBackground}>{m.grant()}</Button
          >{/if}
      </Row>
      <Row icon={BatteryCharging} label={m.perm_battery()} description={m.perm_battery_hint()}>
        {#if batteryOk}<Check class="size-5 text-positive" />{:else}<Button
            size="sm"
            onclick={() => PunchClock.requestIgnoreBatteryOptimizations().then(refresh)}>{m.grant()}</Button
          >{/if}
      </Row>
    {/if}
  </Group>
{/if}

<Group title={m.automation_apps()}>
  <div class="flex gap-3 px-4 py-3 text-sm">
    <Workflow class="mt-0.5 size-5 shrink-0 text-primary" />
    <div class="min-w-0 text-muted-foreground">
      <p>{m.automation_apps_hint()}</p>
      <ul class="mt-2 flex flex-col gap-1 font-mono text-xs break-all text-foreground">
        <li>com.spenhouet.punchclock.CLOCK_IN</li>
        <li>com.spenhouet.punchclock.CLOCK_OUT</li>
        <li>com.spenhouet.punchclock.BREAK</li>
        <li>com.spenhouet.punchclock.RESUME</li>
      </ul>
      <p class="mt-2">{m.automation_apps_package()}</p>
    </div>
  </div>
</Group>
