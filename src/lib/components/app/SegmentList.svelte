<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { Coffee, Briefcase, MessageSquareText, Wifi, Bell } from '@lucide/svelte';
  import type { Segment } from '$lib/domain/types';
  import { formatDuration, toHHmm } from '$lib/format';
  import { app } from '$lib/state.svelte';
  import { ui } from '$lib/ui.svelte';
  import { cn } from '$lib/utils';

  let { segments }: { segments: Segment[] } = $props();
</script>

<ul class="flex flex-col">
  {#each segments as s (s.id)}
    {@const end = s.end ?? app.now}
    <li>
      <button
        type="button"
        onclick={() => ui.editSegment(s)}
        class="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-muted active:bg-muted"
      >
        <span
          class={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full',
            s.kind === 'work' ? 'bg-primary/12 text-primary' : 'bg-break/15 text-break'
          )}
        >
          {#if s.kind === 'work'}<Briefcase class="size-4" />{:else}<Coffee class="size-4" />{/if}
        </span>
        <span class="min-w-0 flex-1">
          <span class="tabular block font-medium">
            {toHHmm(s.start)} – {s.end === null ? m.now() : toHHmm(s.end)}
          </span>
          <span class="flex items-center gap-1 truncate text-xs text-muted-foreground">
            {s.kind === 'work' ? m.kind_work() : m.kind_break()}
            {#if s.source === 'wifi'}<Wifi class="size-3" />{/if}
            {#if s.source === 'notification'}<Bell class="size-3" />{/if}
            {#if s.note}<MessageSquareText class="size-3" /> <span class="truncate">{s.note}</span>{/if}
          </span>
        </span>
        <span class={cn('tabular text-sm', s.end === null && 'font-semibold text-primary')}>
          {formatDuration(end - s.start)}
        </span>
      </button>
    </li>
  {/each}
</ul>
