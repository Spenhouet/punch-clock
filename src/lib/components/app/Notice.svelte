<script lang="ts" module>
  import { tv, type VariantProps } from 'tailwind-variants';

  export const notice = tv({
    base: 'flex items-center gap-2 rounded-xl px-3 py-2 text-sm',
    variants: {
      tone: {
        neutral: 'bg-muted',
        holiday: 'bg-holiday/15',
        warning: 'bg-break/12'
      }
    },
    defaultVariants: { tone: 'neutral' }
  });

  export type NoticeVariants = VariantProps<typeof notice>;
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { TriangleAlert } from '@lucide/svelte';
  import { cn } from '$lib/utils';

  /** One-line status row: holiday, absence or working time hint. `dot` takes a bg-* token class. */
  let { tone, dot, children }: NoticeVariants & { dot?: string; children: Snippet } = $props();
</script>

<div class={notice({ tone })}>
  {#if tone === 'warning'}
    <TriangleAlert class="size-4 shrink-0 text-break" />
  {:else if dot}
    <span class={cn('size-2 shrink-0 rounded-full', dot)}></span>
  {/if}
  <span class="min-w-0 flex-1">{@render children()}</span>
</div>
