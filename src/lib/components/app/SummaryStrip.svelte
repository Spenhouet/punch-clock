<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Delta from './Delta.svelte';
  import { scaleForDays } from '$lib/deviation';
  import type { PeriodSummary } from '$lib/domain/calc';
  import { formatMinutes } from '$lib/format';

  let { summary }: { summary: PeriodSummary } = $props();
</script>

<div class="grid grid-cols-3 divide-x surface py-2.5 text-center">
  <div>
    <p class="text-xs text-muted-foreground">{m.worked()}</p>
    <p class="font-semibold tabular">{formatMinutes(summary.worked)}</p>
  </div>
  <div>
    <p class="text-xs text-muted-foreground">{m.target()}</p>
    <p class="font-semibold tabular">{formatMinutes(summary.target)}</p>
  </div>
  <div>
    <p class="text-xs text-muted-foreground">{m.difference()}</p>
    <p class="font-semibold"><Delta minutes={summary.delta} scale={scaleForDays(summary.days.length)} /></p>
  </div>
</div>
