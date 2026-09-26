<script lang="ts">
  import { untrack } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { toast } from 'svelte-sonner';
  import { Check } from '@lucide/svelte';
  import Sheet from './Sheet.svelte';
  import Segmented from './Segmented.svelte';
  import Field from './Field.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { ui } from '$lib/ui.svelte';
  import { app } from '$lib/state.svelte';
  import { removeAbsences, setAbsences } from '$lib/db/entries';
  import { ABSENCE_TYPES, type AbsenceType } from '$lib/domain/types';
  import { absenceBg, absenceLabel } from '$lib/labels';
  import { formatDate, formatNumber } from '$lib/format';
  import { cn } from '$lib/utils';

  let type = $state<AbsenceType>('vacation');
  let fraction = $state<'1' | '0.5'>('1');
  let label = $state('');
  let workdaysOnly = $state(true);

  const ledger = $derived(app.ledger!);
  const dates = $derived([...ui.absenceDates].sort());
  const existing = $derived(dates.flatMap((d) => ledger.day(d).absences));
  const targetDates = $derived(dates.length > 1 && workdaysOnly ? dates.filter((d) => ledger.day(d).isWorkday) : dates);
  const vacationDays = $derived(
    type === 'vacation' ? targetDates.filter((d) => ledger.day(d).isWorkday).length * Number(fraction) : 0
  );

  // Initialize once per opening; the ledger changes every second and must not reset the form
  $effect(() => {
    if (!ui.absenceOpen) return;
    const dates = ui.absenceDates;
    const first = untrack(() => dates.map((d) => app.ledger!.day(d).absences[0]).find(Boolean));
    type = first?.type ?? 'vacation';
    fraction = first?.fraction === 0.5 ? '0.5' : '1';
    label = first?.label ?? '';
    workdaysOnly = true;
  });

  const title = $derived(
    dates.length === 1
      ? formatDate(dates[0], 'EEE, d. MMM yyyy')
      : dates.length
        ? `${formatDate(dates[0], 'd. MMM')} – ${formatDate(dates[dates.length - 1], 'd. MMM yyyy')}`
        : ''
  );

  async function save() {
    if (!targetDates.length) return;
    await setAbsences(targetDates, type, fraction === '0.5' ? 0.5 : 1, label.trim());
    ui.absenceOpen = false;
    ui.afterAbsence?.();
    toast.success(m.absence_saved({ count: targetDates.length }));
  }

  async function remove() {
    await removeAbsences(dates);
    ui.absenceOpen = false;
    ui.afterAbsence?.();
    toast(m.absence_removed());
  }
</script>

<Sheet bind:open={ui.absenceOpen} {title}>
  <div class="flex flex-col gap-4">
    {#if dates.length > 1}
      <p class="-mt-1 text-sm text-muted-foreground">{m.days_selected({ count: dates.length })}</p>
    {/if}
    <div class="grid grid-cols-2 gap-2">
      {#each ABSENCE_TYPES as t (t)}
        <button
          type="button"
          class={cn(
            'flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors',
            type === t ? 'border-primary bg-primary/8' : 'hover:bg-muted'
          )}
          onclick={() => (type = t)}
        >
          <span class={cn('size-3 rounded-full', absenceBg[t])}></span>
          <span class="flex-1">{absenceLabel(t)}</span>
          {#if type === t}<Check class="size-4 text-primary" />{/if}
        </button>
      {/each}
    </div>
    <p class="-mt-2 text-xs text-muted-foreground">
      {type === 'comp_time' ? m.comp_time_hint() : m.credit_hint()}
    </p>
    <Segmented
      bind:value={fraction}
      options={[
        { value: '1', label: m.full_day() },
        { value: '0.5', label: m.half_day() }
      ]}
    />
    <Field label={m.label_optional()}>
      <Input bind:value={label} placeholder={m.label_placeholder()} class="h-11" />
    </Field>
    {#if dates.length > 1}
      <label class="flex items-center justify-between gap-3">
        <span class="text-sm">{m.workdays_only()}</span>
        <Switch bind:checked={workdaysOnly} />
      </label>
    {/if}
    {#if type === 'vacation'}
      {@const year = Number((dates[0] ?? ledger.today).slice(0, 4))}
      {@const v = ledger.vacation(year)}
      <div class="rounded-xl bg-muted px-3 py-2 text-sm">
        {m.vacation_uses({
          days: formatNumber(vacationDays),
          left: formatNumber(
            v.left -
              vacationDays +
              existing
                .filter((a) => a.type === 'vacation' && ledger.day(a.date).isWorkday)
                .reduce((s, a) => s + a.fraction, 0)
          )
        })}
      </div>
    {/if}
    <div class="flex gap-2 pt-1">
      {#if existing.length}
        <Button variant="destructive" size="lg" onclick={remove}>{m.remove()}</Button>
      {/if}
      <Button size="lg" class="flex-1" onclick={save} disabled={!targetDates.length}>{m.save()}</Button>
    </div>
  </div>
</Sheet>
