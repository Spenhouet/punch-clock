<script lang="ts">
  import { cn } from '$lib/utils';

  /** Edit minutes as decimal hours (`7.5`) or `h:mm` (`7:30`). */
  let {
    minutes = $bindable(),
    class: className = '',
    allowNegative = false,
    onchange
  }: { minutes: number; class?: string; allowNegative?: boolean; onchange?: (minutes: number) => void } = $props();

  function show(v: number) {
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(Math.round(v));
    return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
  }

  let text = $state('');
  let focused = false;
  $effect(() => {
    const v = minutes;
    if (!focused) text = show(v);
  });

  function parse(raw: string): number | null {
    const t = raw.trim().replace(',', '.').replace('−', '-');
    const neg = t.startsWith('-');
    const body = neg || t.startsWith('+') ? t.slice(1) : t;
    let v: number;
    if (body.includes(':')) {
      const [h, mm] = body.split(':');
      if (!/^\d*$/.test(h) || !/^\d{1,2}$/.test(mm)) return null;
      v = Number(h || 0) * 60 + Number(mm);
    } else {
      if (!/^\d*\.?\d*$/.test(body) || body === '' || body === '.') return null;
      v = Math.round(Number(body) * 60);
    }
    if (neg && !allowNegative) return null;
    return neg ? -v : v;
  }

  function commit() {
    focused = false;
    const v = parse(text);
    if (v === null) {
      text = show(minutes);
      return;
    }
    minutes = v;
    text = show(v);
    onchange?.(v);
  }
</script>

<input
  type="text"
  inputmode={allowNegative ? 'text' : 'decimal'}
  bind:value={text}
  onfocus={(e) => {
    focused = true;
    (e.target as HTMLInputElement).select();
  }}
  onblur={commit}
  onkeydown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
  class={cn(
    'h-10 w-20 rounded-lg border border-input bg-transparent px-2 text-center text-base tabular outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30',
    className
  )}
/>
