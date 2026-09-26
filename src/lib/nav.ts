import { page } from '$app/state';
import { resolve } from '$app/paths';
import { Timer, CalendarDays, ChartColumn, Settings } from '@lucide/svelte';
import { m } from '$lib/paraglide/messages.js';

export const tabs = [
  { href: '/', label: () => m.tab_today(), icon: Timer },
  { href: '/calendar', label: () => m.tab_calendar(), icon: CalendarDays },
  { href: '/stats', label: () => m.tab_stats(), icon: ChartColumn },
  { href: '/settings', label: () => m.tab_settings(), short: () => m.tab_settings_short(), icon: Settings }
] as const;

export function isActive(href: string) {
  const base = resolve('/').replace(/\/$/, '');
  const path = page.url.pathname.slice(base.length) || '/';
  return href === '/' ? path === '/' : path.startsWith(href);
}
