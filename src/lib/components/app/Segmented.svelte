<script lang="ts" generics="T extends string | number">
  import { cn } from '$lib/utils';

  let {
    value = $bindable(),
    options,
    class: className = '',
    onchange
  }: {
    value: T;
    options: { value: T; label: string }[];
    class?: string;
    onchange?: (value: T) => void;
  } = $props();
</script>

<div class={cn('flex rounded-xl bg-muted p-1', className)} role="radiogroup">
  {#each options as o (o.value)}
    <button
      type="button"
      role="radio"
      aria-checked={value === o.value}
      class={cn(
        'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all',
        value === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
      onclick={() => {
        value = o.value;
        onchange?.(o.value);
      }}
    >
      {o.label}
    </button>
  {/each}
</div>
