<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { ModeWatcher } from 'mode-watcher';
  import { Toaster } from '$lib/components/ui/sonner';
  import TabBar from '$lib/components/app/TabBar.svelte';
  import DaySheet from '$lib/components/app/DaySheet.svelte';
  import SegmentSheet from '$lib/components/app/SegmentSheet.svelte';
  import AbsenceSheet from '$lib/components/app/AbsenceSheet.svelte';
  import Setup from '$lib/components/app/Setup.svelte';
  import { app } from '$lib/state.svelte';
  import { initNative } from '$lib/native/index.svelte';
  import { getLocale } from '$lib/paraglide/runtime';

  let { children } = $props();

  onMount(() => {
    document.documentElement.lang = getLocale();
    app.start().then(initNative);
  });
</script>

<ModeWatcher themeColors={{ dark: '#141b1e', light: '#fafcfc' }} />
<Toaster
  position="bottom-center"
  richColors
  closeButton={false}
  offset={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}
  mobileOffset={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}
/>

{#if app.data}
  {#if !app.data.settings.setupDone}
    <Setup />
  {:else}
    <main class="mx-auto min-h-dvh max-w-lg px-4 pb-28">
      {@render children()}
    </main>
    <TabBar />
    <DaySheet />
    <SegmentSheet />
    <AbsenceSheet />
  {/if}
{:else}
  <div class="flex min-h-dvh items-center justify-center">
    <div class="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
  </div>
{/if}
