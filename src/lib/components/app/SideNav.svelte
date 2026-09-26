<script lang="ts">
  import { asset, resolve } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';
  import { Play, Square, Coffee } from '@lucide/svelte';
  import Delta from './Delta.svelte';
  import { app } from '$lib/state.svelte';
  import { tabs, isActive } from '$lib/nav';
  import { stamp } from '$lib/stamp';
  import { formatDuration } from '$lib/format';
  import { cn } from '$lib/utils';

  const ledger = $derived(app.ledger!);
  const status = $derived(ledger.status);
  const running = $derived(ledger.running);
  const workedMs = $derived(
    ledger
      .day(ledger.today)
      .segments.filter((s) => s.kind === 'work')
      .reduce((sum, s) => sum + ((s.end ?? app.now) - s.start), 0)
  );
  const onToday = $derived(isActive('/'));
</script>

<aside class="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-card/60 px-3 py-5 backdrop-blur-lg md:flex">
  <a href={resolve('/')} class="mb-6 flex items-center gap-2.5 px-2">
    <img src={asset('/favicon.svg')} alt="" class="size-8 rounded-lg" />
    <span class="text-lg font-semibold tracking-tight">PunchClock</span>
  </a>

  <nav class="flex flex-col gap-1">
    {#each tabs as tab (tab.href)}
      {@const active = isActive(tab.href)}
      <a
        href={resolve(tab.href)}
        aria-current={active ? 'page' : undefined}
        class={cn(
          'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
          active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <tab.icon class="size-4.5" strokeWidth={active ? 2.4 : 2} />
        {tab.label()}
      </a>
    {/each}
  </nav>

  {#if !onToday}
    <div class="mt-auto surface p-3">
      <div class="flex items-center justify-between">
        <span
          class={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium',
            status === 'working' && 'text-positive',
            status === 'break' && 'text-break',
            status === 'out' && 'text-muted-foreground'
          )}
        >
          <span class={cn('size-1.5 rounded-full bg-current', status !== 'out' && 'animate-pulse')}></span>
          {status === 'working' ? m.status_working() : status === 'break' ? m.status_break() : m.status_out()}
        </span>
        <span class="text-xs text-muted-foreground">{m.balance()} <Delta minutes={ledger.balanceNow()} /></span>
      </div>
      <p class="mt-1 text-2xl font-semibold tracking-tight tabular">
        {status === 'break' && running
          ? formatDuration(app.now - running.start, true)
          : formatDuration(workedMs, status === 'working')}
      </p>
      <div class="mt-2 flex gap-2">
        {#if status === 'out'}
          <button
            type="button"
            onclick={() => stamp('in')}
            class="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/85"
          >
            <Play class="size-3.5 fill-current" />{m.clock_in()}
          </button>
        {:else}
          <button
            type="button"
            onclick={() => stamp(status === 'working' ? 'break' : 'resume')}
            class={cn(
              'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium',
              status === 'working' ? 'bg-secondary hover:bg-muted' : 'bg-break text-break-foreground hover:bg-break/85'
            )}
            title={status === 'working' ? m.start_break() : m.end_break()}
          >
            {#if status === 'working'}<Coffee class="size-4" />{:else}<Play class="size-3.5 fill-current" />{/if}
            {status === 'working' ? m.start_break() : m.end_break()}
          </button>
          <button
            type="button"
            onclick={() => stamp('out')}
            class="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium hover:bg-muted"
            title={m.clock_out()}
          >
            <Square class="size-3 fill-current" />{m.clock_out()}
          </button>
        {/if}
      </div>
    </div>
  {/if}
</aside>
