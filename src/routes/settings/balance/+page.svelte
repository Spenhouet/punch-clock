<script lang="ts">
  import { untrack } from 'svelte';
  import { resolve } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';
  import { toast } from 'svelte-sonner';
  import { Trash2 } from '@lucide/svelte';
  import PageHeader from '$lib/components/app/PageHeader.svelte';
  import Group from '$lib/components/app/Group.svelte';
  import HoursInput from '$lib/components/app/HoursInput.svelte';
  import Delta from '$lib/components/app/Delta.svelte';
  import Field from '$lib/components/app/Field.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { app } from '$lib/state.svelte';
  import { deleteAdjustment, saveAdjustment } from '$lib/db/entries';
  import { formatDate } from '$lib/format';

  const ledger = $derived(app.ledger!);
  const balance = $derived(ledger.balanceNow());
  const adjustments = $derived([...ledger.data.adjustments].sort((a, b) => b.date.localeCompare(a.date)));

  // Start from the current balance once; the live balance must not overwrite what the user types
  let desired = $state(untrack(() => Math.round(balance)));

  async function setBalance() {
    const diff = Math.round(desired - balance);
    if (!diff) return;
    await saveAdjustment({ date: ledger.today, minutes: diff, reason: m.reason_balance_set() });
    toast.success(m.saved());
  }

  let date = $state('');
  let minutes = $state(0);
  let reason = $state('');
  let sign = $state<1 | -1>(-1);
  $effect(() => {
    if (!date) date = app.ledger!.today;
  });

  async function add() {
    if (!minutes) return;
    await saveAdjustment({ date, minutes: sign * Math.abs(minutes), reason: reason.trim() || m.reason_correction() });
    minutes = 0;
    reason = '';
    toast.success(m.saved());
  }
</script>

<PageHeader title={m.overtime_balance()} back={resolve('/settings')} />

<div class="flex flex-col gap-6 pb-4 md:max-w-2xl">
  <div class="surface p-5 text-center">
    <p class="text-sm text-muted-foreground">{m.balance_current()}</p>
    <p class="text-4xl font-semibold tracking-tight"><Delta minutes={balance} scale="balance" /></p>
  </div>

  <Group title={m.set_balance()} footer={m.set_balance_hint()}>
    <form class="flex items-center gap-3 px-4 py-3" onsubmit={(e) => (e.preventDefault(), setBalance())}>
      <span class="flex-1 text-body">{m.new_balance()}</span>
      <HoursInput bind:minutes={desired} allowNegative class="w-24" />
      <Button type="submit" disabled={Math.round(desired) === Math.round(balance)}>{m.apply()}</Button>
    </form>
  </Group>

  <Group title={m.add_adjustment()} footer={m.add_adjustment_hint()}>
    <form class="flex flex-col gap-3 px-4 py-3" onsubmit={(e) => (e.preventDefault(), add())}>
      <div class="grid grid-cols-2 gap-3">
        <Field label={m.date()}><Input type="date" bind:value={date} class="h-10" /></Field>
        <Field label={m.hours()}>
          <div class="flex gap-1">
            <Button
              variant="secondary"
              size="icon"
              onclick={() => (sign = sign === 1 ? -1 : 1)}
              aria-label={m.toggle_sign()}>{sign === 1 ? '+' : '−'}</Button
            >
            <HoursInput bind:minutes class="flex-1" />
          </div>
        </Field>
      </div>
      <Field label={m.reason()}><Input bind:value={reason} placeholder={m.reason_placeholder()} class="h-10" /></Field>
      <Button type="submit" disabled={!minutes}>{m.add()}</Button>
    </form>
  </Group>

  {#if adjustments.length}
    <Group title={m.adjustments()}>
      {#each adjustments as a (a.id)}
        <div class="flex min-h-14 items-center gap-3 px-4 py-2">
          <div class="min-w-0 flex-1">
            <p class="truncate text-body">{a.reason}</p>
            <p class="text-xs text-muted-foreground">{formatDate(a.date, 'PP')}</p>
          </div>
          <Delta minutes={a.minutes} neutral />
          <Button variant="ghost" size="icon-sm" onclick={() => deleteAdjustment(a.id)} aria-label={m.delete()}
            ><Trash2 /></Button
          >
        </div>
      {/each}
    </Group>
  {/if}
</div>
