<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { m } from '$lib/paraglide/messages.js';

  let {
    open = $bindable(false),
    title,
    message,
    confirmLabel,
    destructive = false,
    onconfirm
  }: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    destructive?: boolean;
    onconfirm: () => void;
  } = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Content showCloseButton={false}>
    <Dialog.Header>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>{message}</Dialog.Description>
    </Dialog.Header>
    <div class="flex justify-end gap-2">
      <Button variant="ghost" onclick={() => (open = false)}>{m.cancel()}</Button>
      <Button
        variant={destructive ? 'destructive' : 'default'}
        onclick={() => {
          open = false;
          onconfirm();
        }}>{confirmLabel}</Button
      >
    </div>
  </Dialog.Content>
</Dialog.Root>
