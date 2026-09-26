<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, footer, children }: { title?: string; footer?: string; children: Snippet } = $props();
</script>

<section class="flex flex-col gap-1.5">
  {#if title}<h2 class="px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>{/if}
  <div class="divide-y overflow-hidden rounded-2xl bg-card shadow-xs ring-1 ring-border">
    {@render children()}
  </div>
  {#if footer}<p class="px-3 text-xs text-muted-foreground">{footer}</p>{/if}
</section>
