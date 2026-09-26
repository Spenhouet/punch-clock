<script lang="ts">
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { Button } from '$lib/components/ui/button';
  import { isoWeek, type Period } from '$lib/domain/time';
  import { formatDate } from '$lib/format';

  let { period, onshift, ontoday }: { period: Period; onshift: (steps: number) => void; ontoday: () => void } =
    $props();

  const title = $derived.by(() => {
    if (period.kind === 'year') return period.start.slice(0, 4);
    if (period.kind === 'month') return formatDate(period.start, 'LLLL yyyy');
    return m.week_number({ week: isoWeek(period.start).week });
  });
  const subtitle = $derived(
    period.kind === 'week' ? `${formatDate(period.start, 'd. MMM')} – ${formatDate(period.end, 'd. MMM yyyy')}` : ''
  );
</script>

<div class="flex items-center gap-1">
  <Button variant="ghost" size="icon" onclick={() => onshift(-1)} aria-label={m.previous()}
    ><ChevronLeft class="size-5" /></Button
  >
  <button
    type="button"
    class="flex flex-1 flex-col items-center rounded-xl py-1 hover:bg-muted"
    onclick={ontoday}
    title={m.today()}
  >
    <span class="font-semibold capitalize">{title}</span>
    {#if subtitle}<span class="text-xs text-muted-foreground">{subtitle}</span>{/if}
  </button>
  <Button variant="ghost" size="icon" onclick={() => onshift(1)} aria-label={m.next()}
    ><ChevronRight class="size-5" /></Button
  >
</div>
