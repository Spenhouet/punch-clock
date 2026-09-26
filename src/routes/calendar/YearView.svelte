<script lang="ts">
  import type { Ledger } from '$lib/domain/calc';
  import { daysBetween, periodOf } from '$lib/domain/time';
  import { formatDate, formatMinutes } from '$lib/format';
  import { absenceBg } from '$lib/labels';
  import { cn } from '$lib/utils';

  let { ledger, year, onmonth }: { ledger: Ledger; year: number; onmonth: (start: string) => void } = $props();

  const months = $derived(
    Array.from({ length: 12 }, (_, i) => {
      const start = `${year}-${String(i + 1).padStart(2, '0')}-01`;
      const p = periodOf('month', start);
      const lead = (new Date(year, i, 1).getDay() + 6) % 7;
      return { start, days: daysBetween(p.start, p.end), lead };
    })
  );

  function cellClass(date: string) {
    const d = ledger.day(date);
    const a = d.absences[0];
    if (a) return absenceBg[a.type];
    if (d.holiday) return 'bg-holiday';
    if (d.gross > 0) return d.counted && d.delta < -15 ? 'bg-primary/50' : 'bg-primary';
    if (d.counted && d.isWorkday) return 'bg-negative/30';
    return d.isWorkday ? 'bg-muted-foreground/15' : 'bg-transparent';
  }
</script>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
  {#each months as mo (mo.start)}
    <button type="button" class="surface p-3 text-left hover:bg-muted/60" onclick={() => onmonth(mo.start)}>
      <p class="mb-2 text-sm font-semibold capitalize">{formatDate(mo.start, 'LLLL')}</p>
      <div class="grid grid-cols-7 gap-0.75">
        {#each Array(mo.lead) as _, i (i)}<span></span>{/each}
        {#each mo.days as date (date)}
          <span
            class={cn('aspect-square rounded-xs', cellClass(date), date === ledger.today && 'ring-1 ring-foreground')}
            title={`${formatDate(date, 'EEE, d. MMM')}${ledger.day(date).counted && (ledger.day(date).target || ledger.day(date).worked) ? ` · ${formatMinutes(ledger.day(date).delta, { sign: true })}` : ''}`}
          ></span>
        {/each}
      </div>
    </button>
  {/each}
</div>
