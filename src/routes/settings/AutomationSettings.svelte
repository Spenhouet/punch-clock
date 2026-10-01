<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { Bell, BatteryCharging, MapPin, Smartphone, Check, Workflow, LayoutGrid } from '@lucide/svelte';
  import Group from '$lib/components/app/Group.svelte';
  import Row from '$lib/components/app/Row.svelte';
  import NativeSelect from '$lib/components/app/NativeSelect.svelte';
  import { Switch } from '$lib/components/ui/switch';
  import { Button } from '$lib/components/ui/button';
  import { app } from '$lib/state.svelte';
  import { saveSettings } from '$lib/db';
  import { isNative } from '$lib/native/index.svelte';
  import { PunchClock, type NativePermissions } from '$lib/native/plugin';
  import { activePlaces, triggerPlaces } from '$lib/domain/places';

  const settings = $derived(app.ledger!.settings);
  // Reading the Wi-Fi name needs location access, for the trigger and for places alike
  const placesUseWifi = $derived(activePlaces(settings).some((p) => p.ssids.length));
  // Clocking in and out in the background also needs background location and no battery limits
  const usesTrigger = $derived(triggerPlaces(settings).length > 0);
  let perms = $state<NativePermissions | null>(null);
  let batteryOk = $state(false);
  let canPin = $state(false);

  async function refresh() {
    if (!isNative) return;
    perms = await PunchClock.checkPermissions().catch(() => null);
    batteryOk = (await PunchClock.isIgnoringBatteryOptimizations().catch(() => ({ value: false }))).value;
    canPin = (await PunchClock.canPinWidget().catch(() => ({ value: false }))).value;
  }
  $effect(() => {
    refresh();
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });

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

  const reminderOptions = $derived([
    { value: '0', label: m.off() },
    ...[480, 540, 600, 660, 720].map((v) => ({ value: String(v), label: m.after_hours({ hours: v / 60 }) }))
  ]);
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

{#if isNative && placesUseWifi && perms}
  <Group title={m.permissions()} footer={m.permissions_hint()}>
    <Row icon={MapPin} label={m.perm_location()} description={m.perm_location_hint()}>
      {#if perms.location === 'granted'}<Check class="size-5 text-positive" />{:else}<Button
          size="sm"
          onclick={grantLocation}>{m.grant()}</Button
        >{/if}
    </Row>
    {#if usesTrigger}
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
