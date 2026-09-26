<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { X } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  let {
    open = $bindable(false),
    title,
    header,
    footer,
    children
  }: { open: boolean; title: string; header?: Snippet; footer?: Snippet; children: Snippet } = $props();
</script>

<DialogPrimitive.Root bind:open>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
    />
    <DialogPrimitive.Content
      class="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-popover text-popover-foreground shadow-2xl outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:data-[state=closed]:slide-out-to-bottom-8 sm:data-[state=open]:slide-in-from-bottom-8"
      style="padding-bottom: env(safe-area-inset-bottom)"
    >
      <div class="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted sm:hidden"></div>
      <div class="flex items-center gap-2 px-5 pt-3 pb-2">
        <DialogPrimitive.Title class="flex-1 truncate text-lg font-semibold">{title}</DialogPrimitive.Title>
        {@render header?.()}
        <DialogPrimitive.Close
          class="-mr-2 flex size-9 items-center justify-center rounded-full hover:bg-muted"
          aria-label="Close"
        >
          <X class="size-5" />
        </DialogPrimitive.Close>
      </div>
      <div class="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
        {@render children()}
      </div>
      {#if footer}
        <div class="flex gap-2 border-t px-5 py-3">
          {@render footer()}
        </div>
      {/if}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
