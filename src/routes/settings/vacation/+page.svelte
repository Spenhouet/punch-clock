<script lang="ts">
  import { resolve } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';
  import PageHeader from '$lib/components/app/PageHeader.svelte';
  import Group from '$lib/components/app/Group.svelte';
  import Row from '$lib/components/app/Row.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { app } from '$lib/state.svelte';
  import { saveSettings } from '$lib/db';
  import { saveVacationYear } from '$lib/db/entries';
  import { formatDate, formatNumber } from '$lib/format';
  import { absenceBg } from '$lib/labels';
  import { ui } from '$lib/ui.svelte';
  import type { VacationYear } from '$lib/domain/types';

  const ledger = $derived(app.ledger!);
  let year = $state(new Date().getFullYear());
  const config = $derived(ledger.vacationYear(year));
  const summary = $derived(ledger.vacation(year));
  const list = $derived(
    ledger.data.absences
      .filter((a) => a.type === 'vacation' && a.date.startsWith(`${year}-`))
      .sort((a, b) => a.date.localeCompare(b.date))
  );

  function save(patch: Partial<VacationYear>) {
    saveVacationYear({ ...$state.snapshot(config), ...patch, year });
  }

  function num(e: Event): number | null {
    const v = Number((e.target as HTMLInputElement).value.replace(',', '.'));
    return Number.isFinite(v) ? Math.round(v * 2) / 2 : null;
  }
</script>

<PageHeader title={m.vacation()} back={resolve('/settings')} />

<div class="flex flex-col gap-6 pb-4">
  <div class="flex items-center gap-1">
    <Button variant="ghost" size="icon" onclick={() => year--} aria-label={m.previous()}
      ><ChevronLeft class="size-5" /></Button
    >
    <span class="flex-1 text-center text-lg font-semibold">{year}</span>
    <Button variant="ghost" size="icon" onclick={() => year++} aria-label={m.next()}
      ><ChevronRight class="size-5" /></Button
    >
  </div>

  <div class="grid grid-cols-3 gap-2 text-center">
    <div class="rounded-2xl bg-card p-3 shadow-xs ring-1 ring-border">
      <p class="text-xs text-muted-foreground">{m.taken()}</p>
      <p class="tabular text-xl font-semibold">{formatNumber(summary.taken)}</p>
    </div>
    <div class="rounded-2xl bg-card p-3 shadow-xs ring-1 ring-border">
      <p class="text-xs text-muted-foreground">{m.planned()}</p>
      <p class="tabular text-xl font-semibold">{formatNumber(summary.planned)}</p>
    </div>
    <div class="rounded-2xl bg-primary p-3 text-primary-foreground shadow-xs">
      <p class="text-xs opacity-80">{m.left()}</p>
      <p class="tabular text-xl font-semibold">{formatNumber(summary.left)}</p>
    </div>
  </div>

  <Group title={m.vacation_settings_year({ year })}>
    <Row label={m.entitlement()} description={m.entitlement_hint()}>
      <Input
        type="number"
        inputmode="decimal"
        step="0.5"
        min="0"
        value={config.entitlementDays}
        onchange={(e) => {
          const v = num(e);
          if (v !== null) save({ entitlementDays: v });
        }}
        class="h-10 w-20 text-center"
      />
    </Row>
    <Row label={m.carry_over_auto()} description={m.carry_over_auto_hint()}>
      <Switch
        checked={config.carryOverDays === null}
        onCheckedChange={(auto) => save({ carryOverDays: auto ? null : summary.carryOver })}
      />
    </Row>
    {#if config.carryOverDays !== null}
      <Row label={m.carry_over()} description={m.carry_over_manual_hint()}>
        <Input
          type="number"
          inputmode="decimal"
          step="0.5"
          value={config.carryOverDays}
          onchange={(e) => {
            const v = num(e);
            if (v !== null) save({ carryOverDays: v });
          }}
          class="h-10 w-20 text-center"
        />
      </Row>
    {:else}
      <Row label={m.carry_over()} value={formatNumber(summary.carryOver)} />
    {/if}
    <Row
      label={m.carry_over_expires()}
      description={summary.carryOverLost
        ? m.carry_over_lost_days({ days: formatNumber(summary.carryOverLost) })
        : m.carry_over_expires_hint()}
    >
      <Input
        type="date"
        value={config.carryOverExpires ?? ''}
        onchange={(e) => save({ carryOverExpires: (e.target as HTMLInputElement).value || undefined })}
        class="h-10 w-40"
      />
    </Row>
  </Group>

  <Group title={m.default_entitlement()} footer={m.default_entitlement_hint()}>
    <Row label={m.days_per_year()}>
      <Input
        type="number"
        inputmode="decimal"
        min="0"
        step="0.5"
        value={ledger.settings.defaultVacationDays}
        onchange={(e) => {
          const v = num(e);
          if (v !== null) saveSettings({ defaultVacationDays: v });
        }}
        class="h-10 w-20 text-center"
      />
    </Row>
  </Group>

  <Group title={m.booked_vacation()} footer={list.length ? undefined : m.booked_vacation_empty()}>
    {#each list as a (a.id)}
      {@const d = ledger.day(a.date)}
      <button
        type="button"
        class="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted/60"
        onclick={() => ui.openDay(a.date)}
      >
        <span class="size-2.5 rounded-full {absenceBg[a.type]}"></span>
        <span class="flex-1 text-[15px]">{formatDate(a.date, 'EEE, d. MMM')}{a.label ? ` · ${a.label}` : ''}</span>
        <span class="tabular text-sm text-muted-foreground">
          {d.isWorkday ? formatNumber(a.fraction) : m.not_counted()}
        </span>
      </button>
    {/each}
  </Group>
</div>
