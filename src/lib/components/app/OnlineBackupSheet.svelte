<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Sheet from './Sheet.svelte';
  import Field from './Field.svelte';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import type { Backup } from '$lib/db/backup';
  import { sync, type SyncConfig } from '$lib/sync/index.svelte';
  import { gistIdFrom } from '$lib/sync/gist';
  import { syncErrorText } from '$lib/sync/errors';

  let {
    open = $bindable(false),
    mode,
    onenabled,
    onopened
  }: {
    open: boolean;
    /** `enable`: start a new online backup. `restore`: open an existing one. */
    mode: 'enable' | 'restore';
    onenabled?: () => void;
    /** The caller restores the backup, then calls `sync.adopt(config)`. */
    onopened?: (backup: Backup, config: SyncConfig) => void;
  } = $props();

  let token = $state('');
  let passphrase = $state('');
  let repeat = $state('');
  let gistInput = $state('');
  let error = $state('');

  $effect(() => {
    if (!open) return;
    token = '';
    passphrase = '';
    repeat = '';
    gistInput = '';
    error = '';
  });

  async function submit() {
    error = '';
    try {
      if (mode === 'enable') {
        if (passphrase.length < 8) return void (error = m.gist_passphrase_short());
        if (passphrase !== repeat) return void (error = m.gist_passphrase_mismatch());
        await sync.enable(token.trim(), passphrase);
        open = false;
        onenabled?.();
      } else {
        const { backup, config } = await sync.open(token.trim(), passphrase, gistIdFrom(gistInput));
        open = false;
        onopened?.(backup, config);
      }
    } catch (e) {
      error = syncErrorText(e);
    } finally {
      passphrase = '';
      repeat = '';
    }
  }
</script>

<Sheet bind:open title={mode === 'enable' ? m.gist_enable() : m.gist_restore()}>
  <form class="flex flex-col gap-4" onsubmit={(e) => (e.preventDefault(), submit())}>
    <p class="text-sm text-muted-foreground">
      {mode === 'enable' ? m.gist_enable_intro() : m.gist_restore_intro()}
    </p>
    <Field label={m.gist_token()} hint={m.gist_token_hint()}>
      <Input type="password" bind:value={token} required autocomplete="off" class="h-11" />
    </Field>
    <a
      class="-mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
      href="https://github.com/settings/personal-access-tokens/new"
      target="_blank"
      rel="noopener">{m.gist_token_create()}</a
    >
    <Field
      label={m.gist_passphrase()}
      hint={mode === 'enable' ? m.gist_passphrase_hint() : m.gist_passphrase_restore_hint()}
    >
      <Input
        type="password"
        bind:value={passphrase}
        required
        autocomplete={mode === 'enable' ? 'new-password' : 'current-password'}
        class="h-11"
      />
    </Field>
    {#if mode === 'enable'}
      <Field label={m.gist_passphrase_repeat()}>
        <Input type="password" bind:value={repeat} required autocomplete="new-password" class="h-11" />
      </Field>
    {:else}
      <Field label={m.gist_id()} hint={m.gist_id_hint()}>
        <Input bind:value={gistInput} required autocomplete="off" class="h-11" />
      </Field>
    {/if}
    {#if error}<p class="text-sm text-destructive">{error}</p>{/if}
    <Button type="submit" size="lg" disabled={sync.busy}>
      {mode === 'enable' ? m.gist_enable() : m.gist_restore()}
    </Button>
  </form>
</Sheet>
