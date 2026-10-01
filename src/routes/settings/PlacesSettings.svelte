<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { toast } from 'svelte-sonner';
  import { MapPin, Plus, X, Trash2, ChevronUp, ChevronDown } from '@lucide/svelte';
  import Group from '$lib/components/app/Group.svelte';
  import Row from '$lib/components/app/Row.svelte';
  import Sheet from '$lib/components/app/Sheet.svelte';
  import Field from '$lib/components/app/Field.svelte';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch';
  import { app } from '$lib/state.svelte';
  import { saveSettings } from '$lib/db';
  import { activePlaces, defaultTrigger } from '$lib/domain/places';
  import PlaceTrigger from './PlaceTrigger.svelte';
  import { isNative } from '$lib/native/index.svelte';
  import { PunchClock } from '$lib/native/plugin';
  import type { Place, WifiTrigger } from '$lib/domain/types';

  const settings = $derived(app.ledger!.settings);
  const places = $derived(activePlaces(settings));

  // Editor
  let open = $state(false);
  let editing = $state<Place | null>(null);
  let name = $state('');
  let ssids = $state<string[]>([]);
  let newSsid = $state('');
  let isDefault = $state(false);
  let trigger = $state<WifiTrigger>(defaultTrigger());
  let error = $state('');

  function edit(place: Place | null) {
    editing = place;
    name = place?.name ?? '';
    ssids = [...(place?.ssids ?? [])];
    newSsid = '';
    trigger = { ...defaultTrigger(), ...(place?.trigger ?? {}) };
    // Suggested for the first place, visible in the switch so it's never a hidden choice
    isDefault = place ? settings.defaultPlace === place.id : !places.some((p) => p.id === settings.defaultPlace);
    error = '';
    open = true;
  }

  function addSsid(value: string) {
    const ssid = value.trim();
    if (!ssid || ssids.includes(ssid)) return;
    const other = places.find((p) => p.id !== editing?.id && p.ssids.includes(ssid));
    if (other) {
      toast.error(m.wifi_already_added({ ssid, place: other.name }));
      return;
    }
    ssids = [...ssids, ssid];
    newSsid = '';
  }

  async function useCurrent() {
    const perms = await PunchClock.checkPermissions().catch(() => null);
    if (perms?.location !== 'granted') {
      await PunchClock.requestPermissions({ permissions: ['location'] }).catch(() => {});
    }
    const { ssid } = await PunchClock.getWifiSsid().catch(() => ({ ssid: null }));
    if (ssid) addSsid(ssid);
    else toast.error(m.wifi_none());
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      error = m.place_error_name();
      return;
    }
    // A network typed but not added yet still counts
    if (newSsid.trim()) addSsid(newSsid);
    const place: Place = {
      id: editing?.id ?? crypto.randomUUID(),
      name: trimmed,
      ssids: $state.snapshot(ssids),
      trigger: { ...$state.snapshot(trigger), enabled: trigger.enabled && ssids.length > 0 }
    };
    const list = editing ? settings.places.map((p) => (p.id === place.id ? place : p)) : [...settings.places, place];
    const defaultPlace = isDefault ? place.id : settings.defaultPlace === place.id ? '' : settings.defaultPlace;
    await saveSettings({ places: $state.snapshot(list), defaultPlace });
    open = false;
    toast.success(m.saved());
  }

  async function remove() {
    if (!editing) return;
    const id = editing.id;
    // Entries keep pointing at the place, so keep its name for them and hide it from selection
    const used = app.data!.segments.some((s) => s.placeId === id);
    const list = used
      ? settings.places.map((p) => (p.id === id ? { ...p, ssids: [], trigger: undefined, archived: true } : p))
      : settings.places.filter((p) => p.id !== id);
    await saveSettings({
      places: $state.snapshot(list),
      defaultPlace: settings.defaultPlace === id ? '' : settings.defaultPlace
    });
    open = false;
    toast(m.place_removed());
  }

  /** Swap with the neighboring active place. The order is the order of every place picker. */
  async function move(place: Place, by: -1 | 1) {
    const target = places[places.indexOf(place) + by];
    if (!target) return;
    const list = [...settings.places];
    const a = list.findIndex((p) => p.id === place.id);
    const b = list.findIndex((p) => p.id === target.id);
    [list[a], list[b]] = [list[b], list[a]];
    await saveSettings({ places: $state.snapshot(list) });
  }
</script>

<Group title={m.places()} footer={places.length ? m.places_hint() : m.places_empty()}>
  {#each places as p, i (p.id)}
    <Row
      icon={MapPin}
      label={p.name}
      description={p.ssids.length
        ? p.ssids.join(', ') + (p.trigger?.enabled ? ` · ${m.place_trigger_on()}` : '')
        : m.place_wifis_none()}
      value={settings.defaultPlace === p.id ? m.place_default_badge() : undefined}
      onclick={() => edit(p)}
    >
      {#snippet actions()}
        {#if places.length > 1}
          <Button variant="ghost" size="icon-sm" disabled={i === 0} onclick={() => move(p, -1)} aria-label={m.move_up()}
            ><ChevronUp /></Button
          >
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={i === places.length - 1}
            onclick={() => move(p, 1)}
            aria-label={m.move_down()}><ChevronDown /></Button
          >
        {/if}
      {/snippet}
    </Row>
  {/each}
  <Row icon={Plus} label={m.place_add()} onclick={() => edit(null)} />
</Group>
{#if !isNative && places.length}
  <p class="-mt-4 px-3 text-xs text-muted-foreground">{m.places_web_hint()}</p>
{/if}

<Sheet bind:open title={editing ? m.place_edit() : m.place_new()}>
  <form class="flex flex-col gap-4" onsubmit={(e) => (e.preventDefault(), save())}>
    <Field label={m.place_name()}>
      <Input bind:value={name} placeholder={m.place_name_placeholder()} class="h-11" />
    </Field>
    <div class="flex flex-col gap-1.5">
      <span class="text-sm font-medium">{m.place_wifis()}</span>
      {#if ssids.length}
        <div class="flex flex-wrap gap-2">
          {#each ssids as s (s)}
            <span class="inline-flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-3 text-sm font-medium">
              {s}
              <button
                type="button"
                class="flex size-6 items-center justify-center rounded-full hover:bg-background"
                onclick={() => (ssids = ssids.filter((x) => x !== s))}
                aria-label={m.remove()}
              >
                <X class="size-3.5" />
              </button>
            </span>
          {/each}
        </div>
      {/if}
      <div class="flex gap-2">
        <Input
          bind:value={newSsid}
          placeholder={m.wifi_placeholder()}
          class="h-10 flex-1"
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addSsid(newSsid);
            }
          }}
        />
        <Button variant="secondary" size="icon" onclick={() => addSsid(newSsid)} aria-label={m.add()}>
          <Plus />
        </Button>
        {#if isNative}
          <Button variant="secondary" onclick={useCurrent}>{m.wifi_use_current()}</Button>
        {/if}
      </div>
      <span class="text-xs text-muted-foreground">{m.place_wifis_hint()}</span>
    </div>
    <PlaceTrigger bind:trigger hasNetworks={ssids.length > 0 || newSsid.trim() !== ''} />
    <label class="flex items-center gap-3">
      <span class="flex-1">
        <span class="block text-sm font-medium">{m.place_default()}</span>
        <span class="block text-xs text-muted-foreground">{m.place_default_hint()}</span>
      </span>
      <Switch bind:checked={isDefault} />
    </label>
    {#if error}<p class="text-sm text-destructive">{error}</p>{/if}
    <div class="flex gap-2 pt-1">
      {#if editing}
        <Button variant="destructive" size="lg" onclick={remove} aria-label={m.delete()}>
          <Trash2 />
        </Button>
      {/if}
      <Button type="submit" size="lg" class="flex-1">{m.save()}</Button>
    </div>
  </form>
</Sheet>
