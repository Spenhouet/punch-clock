<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ChevronLeft } from '@lucide/svelte';

  let { title, back, actions }: { title: string; back?: string; actions?: Snippet } = $props();
</script>

<header
  class="sticky top-0 z-30 -mx-4 mb-2 box-content flex h-14 items-center gap-1 bg-background/90 px-4 pt-safe backdrop-blur-lg md:-mx-8 md:mb-4 md:h-20 md:px-8"
>
  {#if back}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a href={back} class="-ml-2 flex size-10 items-center justify-center rounded-full hover:bg-muted" aria-label="Back">
      <ChevronLeft class="size-6" />
    </a>
  {/if}
  <h1 class="flex-1 truncate text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
  {@render actions?.()}
</header>
