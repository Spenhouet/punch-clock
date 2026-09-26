<script lang="ts">
  import { resolve } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';
  import { toast } from 'svelte-sonner';
  import { Download, Upload, Trash2, Smartphone } from '@lucide/svelte';
  import PageHeader from '$lib/components/app/PageHeader.svelte';
  import Group from '$lib/components/app/Group.svelte';
  import Row from '$lib/components/app/Row.svelte';
  import Confirm from '$lib/components/app/Confirm.svelte';
  import { Switch } from '$lib/components/ui/switch';
  import { app } from '$lib/state.svelte';
  import { saveSettings, ensureDefaults } from '$lib/db';
  import { createBackup, parseBackup, restoreBackup, wipeAll, type Backup } from '$lib/db/backup';
  import { pickTextFile, saveFile } from '$lib/export/save';
  import { isNative } from '$lib/native/index.svelte';
  import { formatDate } from '$lib/format';

  const ledger = $derived(app.ledger!);
  const counts = $derived({
    segments: ledger.data.segments.length,
    absences: ledger.data.absences.length
  });

  async function exportBackup() {
    const backup = await createBackup();
    await saveFile(`punchclock-backup-${ledger.today}.json`, JSON.stringify(backup, null, 1), 'application/json');
    await saveSettings({ lastBackup: ledger.today });
  }

  let pending = $state<Backup | null>(null);
  let confirmRestore = $state(false);
  async function importBackup() {
    const text = await pickTextFile();
    if (!text) return;
    try {
      pending = parseBackup(text);
      confirmRestore = true;
    } catch (e) {
      const code = (e as Error).message;
      toast.error(code === 'newer_version' ? m.restore_newer() : m.restore_invalid());
    }
  }
  async function doRestore() {
    if (!pending) return;
    await restoreBackup(pending);
    toast.success(m.restore_done({ count: pending.data.segments.length }));
    pending = null;
  }

  let confirmWipe = $state(false);
  async function doWipe() {
    await wipeAll();
    await ensureDefaults();
    location.reload();
  }
</script>

<PageHeader title={m.backup_export()} back={resolve('/settings')} />

<div class="flex flex-col gap-6 pb-4">
  <Group title={m.backup()} footer={m.backup_hint({ segments: counts.segments, absences: counts.absences })}>
    <Row
      icon={Download}
      label={m.backup_create()}
      description={ledger.settings.lastBackup
        ? m.last_backup({ date: formatDate(ledger.settings.lastBackup, 'PP') })
        : m.no_backup_yet()}
      onclick={exportBackup}
    />
    <Row icon={Upload} label={m.backup_restore()} description={m.backup_restore_hint()} onclick={importBackup} />
    {#if isNative}
      <Row label={m.auto_backup()} description={m.auto_backup_hint()}>
        <Switch checked={ledger.settings.autoBackup} onCheckedChange={(v) => saveSettings({ autoBackup: v })} />
      </Row>
    {/if}
  </Group>

  <Group title={m.device_transfer()}>
    <div class="flex gap-3 px-4 py-4">
      <Smartphone class="mt-0.5 size-5 shrink-0 text-primary" />
      <ol class="flex list-decimal flex-col gap-1.5 pl-4 text-sm text-muted-foreground">
        <li>{m.transfer_step1()}</li>
        <li>{m.transfer_step2()}</li>
        <li>{m.transfer_step3()}</li>
      </ol>
    </div>
  </Group>

  <Group title={m.danger_zone()}>
    <Row icon={Trash2} label={m.wipe()} description={m.wipe_hint()} onclick={() => (confirmWipe = true)} />
  </Group>
</div>

<Confirm
  bind:open={confirmRestore}
  title={m.backup_restore()}
  message={m.restore_confirm({
    count: pending?.data.segments.length ?? 0,
    date: pending ? formatDate(new Date(pending.exportedAt), 'PPp') : ''
  })}
  confirmLabel={m.restore()}
  destructive
  onconfirm={doRestore}
/>
<Confirm
  bind:open={confirmWipe}
  title={m.wipe()}
  message={m.wipe_confirm()}
  confirmLabel={m.wipe()}
  destructive
  onconfirm={doWipe}
/>
