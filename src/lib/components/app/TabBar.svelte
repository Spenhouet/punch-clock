<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';
  import { Timer, CalendarDays, ChartColumn, Settings } from '@lucide/svelte';
  import { app } from '$lib/state.svelte';
  import { cn } from '$lib/utils';

  const tabs = [
    { href: '/', label: () => m.tab_today(), icon: Timer },
    { href: '/calendar', label: () => m.tab_calendar(), icon: CalendarDays },
    { href: '/stats', label: () => m.tab_stats(), icon: ChartColumn },
    { href: '/settings', label: () => m.tab_settings(), icon: Settings }
  ] as const;

  const base = resolve('/').replace(/\/$/, '');
  function isActive(href: string) {
    const path = page.url.pathname.slice(base.length) || '/';
    return href === '/' ? path === '/' : path.startsWith(href);
  }
  let status = $derived(app.ledger?.status ?? 'out');
</script>

<nav
  class="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur-lg"
  style="padding-bottom: env(safe-area-inset-bottom)"
>
  <ul class="mx-auto grid max-w-lg grid-cols-4">
    {#each tabs as tab (tab.href)}
      {@const active = isActive(tab.href)}
      <li>
        <a
          href={resolve(tab.href)}
          class={cn(
            'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
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
          {tab.label()}
        </a>
      </li>
    {/each}
  </ul>
</nav>
