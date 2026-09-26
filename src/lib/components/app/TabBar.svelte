<script lang="ts">
  import { resolve } from '$app/paths';
  import { app } from '$lib/state.svelte';
  import { tabs, isActive } from '$lib/nav';
  import { cn } from '$lib/utils';

  let status = $derived(app.ledger?.status ?? 'out');
</script>

<nav class="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-safe backdrop-blur-lg md:hidden">
  <ul class="mx-auto grid max-w-lg grid-cols-4">
    {#each tabs as tab (tab.href)}
      {@const active = isActive(tab.href)}
      <li>
        <a
          href={resolve(tab.href)}
          class={cn(
            'flex h-16 flex-col items-center justify-center gap-1 text-caption font-medium transition-colors',
            active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
          aria-current={active ? 'page' : undefined}
        >
          <span
            class={cn(
              'relative flex h-8 w-14 items-center justify-center rounded-full transition-colors',
              active && 'bg-primary/12'
            )}
          >
            <tab.icon class="size-5" strokeWidth={active ? 2.4 : 2} />
            {#if tab.href === '/' && status !== 'out'}
              <span
                class={cn(
                  'absolute top-1 right-3 size-2 rounded-full',
                  status === 'working' ? 'bg-positive' : 'bg-break'
                )}
              ></span>
            {/if}
          </span>
          <span class="max-w-full truncate px-1">{'short' in tab ? tab.short() : tab.label()}</span>
        </a>
      </li>
    {/each}
  </ul>
</nav>
