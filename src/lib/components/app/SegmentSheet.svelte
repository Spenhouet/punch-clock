<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { Trash2 } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import Sheet from './Sheet.svelte';
  import Segmented from './Segmented.svelte';
  import Field from './Field.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { ui } from '$lib/ui.svelte';
  import { deleteSegment, saveSegment } from '$lib/db/entries';
  import { atTime, formatDuration, toDateKey, toHHmm } from '$lib/domain/time';
  import type { Segment, SegmentKind } from '$lib/domain/types';

  let kind = $state<SegmentKind>('work');
  let date = $state('');
  let from = $state('08:00');
  let to = $state('');
  let note = $state('');
  let isRunning = $state(false);
  let error = $state('');

  const existing = $derived(ui.segment?.id ? (ui.segment as Segment) : undefined);

  $effect(() => {
    if (!ui.segmentOpen) return;
    const s = ui.segment ?? {};
    kind = s.kind ?? 'work';
    const start = s.start ?? Date.now();
    date = toDateKey(start);
    from = toHHmm(start);
    isRunning = s.id !== undefined && s.end === null;
    to = s.end ? toHHmm(s.end) : toHHmm(Date.now());
    note = s.note ?? '';
    error = '';
  });

  const range = $derived.by(() => {
    if (!date || !from) return null;
    const start = atTime(date, from);
    if (isRunning) return { start, end: null };
    if (!to) return null;
    let end = atTime(date, to);
    // An end before the start means the entry runs past midnight
    if (end <= start) end += 24 * 3600_000;
    return { start, end };
  });

  async function save() {
    if (!range) {
      error = m.error_times();
      return;
    }
    if (range.end !== null && range.end - range.start > 24 * 3600_000) {
      error = m.error_times();
      return;
    }
    await saveSegment({
      id: existing?.id ?? crypto.randomUUID(),
      kind,
      start: range.start,
      end: range.end,
      note: note.trim() || undefined,
      source: existing?.source ?? 'manual',
      plannedEnd: isRunning ? existing?.plannedEnd : undefined
    });
    ui.segmentOpen = false;
    toast.success(m.saved());
  }

  async function remove() {
    if (!existing) return;
    const copy = $state.snapshot(existing) as Segment;
    await deleteSegment(existing.id);
    ui.segmentOpen = false;
    toast(m.deleted(), { action: { label: m.undo(), onClick: () => saveSegment(copy) } });
  }
</script>

<Sheet bind:open={ui.segmentOpen} title={existing ? m.edit_entry() : m.new_entry()}>
  <form class="flex flex-col gap-4" onsubmit={(e) => (e.preventDefault(), save())}>
    <Segmented
      bind:value={kind}
      options={[
        { value: 'work', label: m.kind_work() },
        { value: 'break', label: m.kind_break() }
      ]}
    />
    <Field label={m.date()}>
      <Input type="date" bind:value={date} required class="h-11" />
    </Field>
    <div class="grid grid-cols-2 gap-3">
      <Field label={m.from()}>
        <Input type="time" bind:value={from} required class="h-11" />
      </Field>
      <Field label={m.to()}>
        {#if isRunning}
          <div class="flex h-11 items-center rounded-lg border px-3 text-sm text-primary">{m.running()}</div>
        {:else}
          <Input type="time" bind:value={to} required class="h-11" />
        {/if}
      </Field>
    </div>
    {#if range && range.end !== null}
      <p class="-mt-2 text-sm text-muted-foreground">
        {m.duration()}:
        <span class="font-medium text-foreground tabular">{formatDuration(range.end - range.start)}</span>
        {#if toDateKey(range.end) !== date}· {m.next_day()}{/if}
      </p>
    {/if}
    {#if existing?.rawStart || existing?.rawEnd}
      <p class="-mt-2 text-xs text-muted-foreground">
        {m.raw_times({
          from: existing.rawStart ? toHHmm(existing.rawStart) : from,
          to: existing.rawEnd ? toHHmm(existing.rawEnd) : to
        })}
      </p>
    {/if}
    <Field label={m.note()}>
      <Textarea bind:value={note} rows={2} placeholder={m.note_placeholder()} />
    </Field>
    {#if error}<p class="text-sm text-destructive">{error}</p>{/if}
    <div class="flex gap-2 pt-1">
      {#if existing}
        <Button variant="destructive" size="lg" onclick={remove} aria-label={m.delete()}>
          <Trash2 />
        </Button>
      {/if}
      <Button type="submit" size="lg" class="flex-1">{m.save()}</Button>
    </div>
  </form>
</Sheet>
