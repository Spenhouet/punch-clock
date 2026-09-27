<script lang="ts">
  import { formatMinutes } from '$lib/format';
  import { deviationLevel, deviationText, type DeviationScale } from '$lib/deviation';
  import { cn } from '$lib/utils';

  /**
   * Signed difference to target. Colored by distance from target (see
   * deviation.ts); `neutral` for amounts that aren't over/under work, like corrections.
   */
  let {
    minutes,
    scale = 'day',
    class: className = '',
    muted = false,
    neutral = false
  }: { minutes: number; scale?: DeviationScale; class?: string; muted?: boolean; neutral?: boolean } = $props();
</script>

<span
  class={cn(
    'font-medium tabular',
    muted ? 'text-muted-foreground' : neutral ? 'text-foreground' : deviationText[deviationLevel(minutes, scale)],
    className
  )}>{formatMinutes(minutes, { sign: true })}</span
>
