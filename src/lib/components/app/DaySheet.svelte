<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { ChevronLeft, ChevronRight, Plus, CalendarOff, TriangleAlert } from '@lucide/svelte';
  import Sheet from './Sheet.svelte';
  import SegmentList from './SegmentList.svelte';
  import Delta from './Delta.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';
  import { ui } from '$lib/ui.svelte';
  import { app } from '$lib/state.svelte';
  import { setNote } from '$lib/db/entries';
  import { addDaysKey, atTime, HOUR } from '$lib/domain/time';
  import { formatDate, formatMinutes } from '$lib/format';
  import { absenceBg, absenceLabel, warningLabel } from '$lib/labels';
  import { cn } from '$lib/utils';

  const day = $derived(ui.day && app.ledger ? app.ledger.day(ui.day) : null);
  let note = $state('');
  let noteFor = '';

  $effect(() => {
    if (ui.dayOpen && ui.day !== noteFor) {
      noteFor = ui.day;
      note = app.ledger?.day(ui.day).note ?? '';
    }
    if (!ui.dayOpen) noteFor = '';
  });

  function saveNote() {
    if (noteFor && note.trim() !== (app.ledger?.day(noteFor).note ?? '')) setNote(noteFor, note);
  }

  function go(delta: number) {
    saveNote();
    ui.day = addDaysKey(ui.day, delta);
  }

  function addEntry() {
    if (!day) return;
    const last = day.segments.at(-1);
    const start = last?.end ?? atTime(day.date, '08:00');
    ui.editSegment({ kind: 'work', start, end: start + HOUR, source: 'manual' });
  }

  $effect(() => {
    if (!ui.dayOpen) saveNote();
  });
</script>

<Sheet bind:open={ui.dayOpen} title={day ? formatDate(day.date, 'EEEE, d. MMM yyyy') : ''}>
  {#snippet header()}
    <Button variant="ghost" size="icon-sm" onclick={() => go(-1)} aria-label={m.previous()}><ChevronLeft /></Button>
    <Button variant="ghost" size="icon-sm" onclick={() => go(1)} aria-label={m.next()}><ChevronRight /></Button>
  {/snippet}
  {#if day}
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-xl bg-muted px-2 py-2">
          <p class="text-xs text-muted-foreground">{m.worked()}</p>
          <p class="tabular font-semibold">{formatMinutes(day.worked)}</p>
        </div>
        <div class="rounded-xl bg-muted px-2 py-2">
          <p class="text-xs text-muted-foreground">{m.target()}</p>
          <p class="tabular font-semibold">{formatMinutes(day.target)}</p>
        </div>
        <div class="rounded-xl bg-muted px-2 py-2">
          <p class="text-xs text-muted-foreground">{m.difference()}</p>
          <p class="font-semibold"><Delta minutes={day.delta} muted={!day.counted} /></p>
        </div>
      </div>
      {#if day.pause || day.autoDeducted}
        <p class="-mt-2 text-center text-xs text-muted-foreground">
          {m.pause()}: {formatMinutes(day.pause)}{#if day.autoDeducted}
            · {m.auto_deducted({ minutes: day.autoDeducted })}{/if}
        </p>
      {/if}

      {#if day.holiday}
        <div class="flex items-center gap-2 rounded-xl bg-holiday/15 px-3 py-2 text-sm">
          <span class="size-2 rounded-full bg-holiday"></span>{day.holiday}
        </div>
      {/if}
      {#each day.warnings as w (w)}
        <div class="flex items-center gap-2 rounded-xl bg-break/12 px-3 py-2 text-sm">
          <TriangleAlert class="size-4 shrink-0 text-break" />{warningLabel(w)}
        </div>
      {/each}

      <section>
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium">{m.entries()}</h3>
          <Button variant="ghost" size="sm" onclick={addEntry}><Plus />{m.add()}</Button>
        </div>
        {#if day.segments.length}
          <div class="-mx-2"><SegmentList segments={day.segments} /></div>
        {:else}
          <p class="py-2 text-sm text-muted-foreground">{m.no_entries()}</p>
        {/if}
      </section>

      <section>
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium">{m.absence()}</h3>
          <Button variant="ghost" size="sm" onclick={() => ui.editAbsences([day.date])}>
            {#if day.absences.length}{m.edit()}{:else}<CalendarOff />{m.mark_absence()}{/if}
          </Button>
        </div>
        {#each day.absences as a (a.id)}
          <button
            type="button"
            class="mt-1 flex w-full items-center gap-2 rounded-xl bg-muted px-3 py-2.5 text-left text-sm"
            onclick={() => ui.editAbsences([day.date])}
          >
            <span class={cn('size-2.5 rounded-full', absenceBg[a.type])}></span>
            <span class="flex-1">
              {absenceLabel(a.type)}{a.fraction === 0.5 ? ` · ${m.half_day()}` : ''}
              {#if a.label}<span class="text-muted-foreground"> · {a.label}</span>{/if}
            </span>
          </button>
        {:else}
          <p class="text-sm text-muted-foreground">{m.no_absence()}</p>
        {/each}
      </section>

      <section class="flex flex-col gap-1.5">
        <h3 class="text-sm font-medium">{m.note()}</h3>
        <Textarea bind:value={note} onblur={saveNote} rows={3} placeholder={m.day_note_placeholder()} />
      </section>
    </div>
  {/if}
</Sheet>
