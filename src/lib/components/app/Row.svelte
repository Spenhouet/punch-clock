<script lang="ts">
  import type { Snippet, Component } from 'svelte';
  import { ChevronRight } from '@lucide/svelte';

  let {
    label,
    description,
    value,
    href,
    icon: Icon,
    onclick,
    children
  }: {
    label: string;
    description?: string;
    value?: string;
    href?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon?: Component<any>;
    onclick?: () => void;
    children?: Snippet;
  } = $props();
</script>

{#snippet content()}
  {#if Icon}
    <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      ><Icon class="size-4" /></span
    >
  {/if}
  <span class="min-w-0 flex-1">
    <span class="block text-[15px]">{label}</span>
    {#if description}<span class="block text-xs text-muted-foreground">{description}</span>{/if}
  </span>
  {#if value}<span class="tabular truncate text-sm text-muted-foreground">{value}</span>{/if}
  {@render children?.()}
  {#if href || onclick}<ChevronRight class="size-4 shrink-0 text-muted-foreground" />{/if}
{/snippet}

{#if href}
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
  <a {href} class="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60 active:bg-muted">
    {@render content()}
  </a>
{:else if onclick}
  <button
    type="button"
    {onclick}
    class="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60 active:bg-muted"
  >
    {@render content()}
  </button>
{:else}
  <div class="flex min-h-14 items-center gap-3 px-4 py-2.5">
    {@render content()}
  </div>
{/if}
