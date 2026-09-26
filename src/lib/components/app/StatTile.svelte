<script lang="ts" module>
  import { tv, type VariantProps } from 'tailwind-variants';

  export const statTile = tv({
    base: 'flex flex-col gap-0.5 p-3',
    variants: {
      tone: {
        surface: 'surface',
        muted: 'rounded-xl bg-muted',
        primary: 'rounded-2xl bg-primary text-primary-foreground shadow-xs'
      },
      align: { start: 'text-left', center: 'items-center text-center' }
    },
    defaultVariants: { tone: 'surface', align: 'start' }
  });

  export type StatTileVariants = VariantProps<typeof statTile>;
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  /** Label over a big number. The one way to show a single figure. */
  let {
    label,
    value,
    tone,
    align,
    class: className = '',
    children
  }: StatTileVariants & { label: string; value?: string; class?: string; children?: Snippet } = $props();
</script>

<div class={cn(statTile({ tone, align }), className)}>
  <span class={cn('text-xs', tone === 'primary' ? 'opacity-80' : 'text-muted-foreground')}>{label}</span>
  <span class="text-lg font-semibold tabular">
    {#if children}{@render children()}{:else}{value}{/if}
  </span>
</div>
