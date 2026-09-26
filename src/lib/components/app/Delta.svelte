<script lang="ts">
  import { formatMinutes } from '$lib/format';
  import { cn } from '$lib/utils';

  let {
    minutes,
    class: className = '',
    muted = false
  }: { minutes: number; class?: string; muted?: boolean } = $props();
</script>

<span
  class={cn(
    'tabular font-medium',
    muted || Math.round(minutes) === 0 ? 'text-muted-foreground' : minutes > 0 ? 'text-positive' : 'text-negative',
    className
  )}>{formatMinutes(minutes, { sign: true })}</span
>
