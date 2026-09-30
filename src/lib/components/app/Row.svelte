<script lang="ts">
  import type { Snippet, Component } from 'svelte';
  import { ChevronRight } from '@lucide/svelte';
  import { cn } from '$lib/utils';

  let {
    label,
    description,
    value,
    href,
    icon: Icon,
    onclick,
    children,
    actions
  }: {
    label: string;
    description?: string;
    value?: string;
    href?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon?: Component<any>;
    onclick?: () => void;
    children?: Snippet;
    /** Buttons next to a linked or clickable row, outside its tap area. */
    actions?: Snippet;
  } = $props();
</script>

{#snippet content()}
  {#if Icon}
    <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      ><Icon class="size-4" /></span
    >
  {/if}
  <span class="min-w-0 flex-1">
    <span class="block text-body">{label}</span>
    {#if description}<span class="block text-xs text-muted-foreground">{description}</span>{/if}
  </span>
  {#if value}<span class="truncate text-sm text-muted-foreground tabular">{value}</span>{/if}
  {@render children?.()}
  {#if (href || onclick) && !actions}<ChevronRight class="size-4 shrink-0 text-muted-foreground" />{/if}
{/snippet}

{#snippet row(extra: string)}
  {#if href}
    <!-- eslint-disable svelte/no-navigation-without-resolve -->
    <a
      {href}
      class={cn(
        'flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60 active:bg-muted',
        extra
      )}
    >
      {@render content()}
    </a>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
  {:else if onclick}
    <button
      type="button"
      {onclick}
      class="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60 active:bg-muted {extra}"
    >
      {@render content()}
    </button>
  {:else}
    <!-- A label, so tapping anywhere in the row toggles its switch or focuses its field -->
    <label class="flex min-h-14 items-center gap-3 px-4 py-2.5 {extra}">
      {@render content()}
    </label>
  {/if}
{/snippet}

{#if actions}
  <div class="flex items-center">
    {@render row('min-w-0 flex-1')}
    <div class="flex shrink-0 items-center gap-1 pr-2">{@render actions()}</div>
  </div>
{:else}
  {@render row('')}
{/if}
