<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Delta from './Delta.svelte';
  import type { PeriodSummary } from '$lib/domain/calc';
  import { formatMinutes } from '$lib/format';

  let { summary }: { summary: PeriodSummary } = $props();
</script>

<div class="grid grid-cols-3 divide-x rounded-2xl bg-card py-2.5 text-center shadow-xs ring-1 ring-border">
  <div>
    <p class="text-xs text-muted-foreground">{m.worked()}</p>
    <p class="tabular font-semibold">{formatMinutes(summary.worked)}</p>
  </div>
  <div>
    <p class="text-xs text-muted-foreground">{m.target()}</p>
    <p class="tabular font-semibold">{formatMinutes(summary.target)}</p>
  </div>
  <div>
    <p class="text-xs text-muted-foreground">{m.difference()}</p>
    <p class="font-semibold"><Delta minutes={summary.delta} /></p>
  </div>
</div>
