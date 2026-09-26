<script lang="ts">
  import type { Snippet } from 'svelte';

  let { label, hint, children }: { label: string; hint?: string; children: Snippet } = $props();
</script>

<label class="flex flex-col gap-1.5">
  <span class="text-sm font-medium">{label}</span>
  {@render children()}
  {#if hint}<span class="text-xs text-muted-foreground">{hint}</span>{/if}
</label>
