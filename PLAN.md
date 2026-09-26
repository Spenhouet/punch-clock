# PunchClock implementation plan

Status: implemented. Deviations from the original plan are listed under "Changes during implementation" at the end.

PunchClock is a personal time tracker for one person. It runs offline, installs as a PWA from GitHub Pages and ships as an Android APK. English and German are available from day one.

## Principles

- The home screen answers three questions at a glance: am I clocked in, how long have I worked today, what is my balance.
- Every frequent action takes one tap: clock in, clock out, start and stop a break.
- Rare actions (editing, vacation, export) take at most three taps.
- All data stays on the device. No accounts, no server.
- Past balances never change when settings change. Target hours are versioned by date.
- Business logic lives in pure, unit-tested TypeScript. UI components stay thin.

## Technical foundation

Same stack as [kiosk-survey](https://github.com/Spenhouet/kiosk-survey), upgraded to the latest releases (checked 2026-09-26).

| Area              | Package                                                                       | Version              |
| ----------------- | ----------------------------------------------------------------------------- | -------------------- |
| Framework         | `@sveltejs/kit`, `svelte`                                                     | 2.70, 5.57           |
| Build             | `vite`, `@sveltejs/vite-plugin-svelte`                                        | 8.3, 7.3             |
| Static output     | `@sveltejs/adapter-static`                                                    | 3.0                  |
| Styling           | `tailwindcss`, `@tailwindcss/vite`, `tw-animate-css`                          | 4.3, 4.3, 1.4        |
| Components        | shadcn-svelte (fresh from CLI), `bits-ui`, `tailwind-variants`                | bits-ui 2.19, tv 3.3 |
| Icons             | `@lucide/svelte`                                                              | 1.48                 |
| Theme             | `mode-watcher`                                                                | 1.1                  |
| i18n              | `@inlang/paraglide-js` (locales `en`, `de`)                                   | 2.25                 |
| PWA               | `@vite-pwa/sveltekit`                                                         | 1.1                  |
| Android           | `@capacitor/core`, `cli`, `android`                                           | 8.5                  |
| Storage           | `dexie` (IndexedDB), `dexie-export-import`                                    | 4.4                  |
| Dates             | `date-fns` (with `de` and `enUS` locales)                                     | 4.4                  |
| Holidays          | `feiertagejs` (German holidays by state, offline)                             | 1.5                  |
| PDF               | `jspdf`, `jspdf-autotable`                                                    | 4.2, 5.0             |
| Capacitor plugins | `local-notifications`, `filesystem`, `share`, `app`, `haptics`, `preferences` | 8.x                  |
| Tests             | `vitest`, `@playwright/test`                                                  | 5.0, 1.63            |
| Tooling           | `eslint`, `prettier`, `svelte-check`                                          | 10.11, latest, 4.7   |
| Language          | `typescript`                                                                  | 6.0.3                |

TypeScript stays on 6.x. Version 7.0 is out, but the peer ranges of `@sveltejs/kit` and `svelte-check` end at `^6.0.0`. Upgrade once they widen.

Storybook is dropped. It added setup weight to kiosk-survey without much use for an app this size. Playwright screenshots cover visual checks.

Bun is the package manager and script runner, as in kiosk-survey.

### Changes from kiosk-survey

- IndexedDB via Dexie instead of `svelte-persisted-store`. Years of segments plus indexed queries by date range fit IndexedDB better than one localStorage blob. Call `navigator.storage.persist()` on first launch.
- Routes use real paths (`/week/2026-W39`) instead of query parameters, so the Android back button and browser history work.
- One local Capacitor plugin (`android/app/src/main/java/.../PunchClockPlugin`) for the features no public plugin covers: the Wi-Fi trigger and the live chronometer notification.

## Data model

All times are stored as ISO strings with offset. Dates are `YYYY-MM-DD` in local time.

```ts
// A contiguous span of work or break. Taking a break closes the work segment
// and opens a break segment; ending the break opens a new work segment.
interface Segment {
  id: string;
  date: string; // day the segment counts toward (start date)
  kind: 'work' | 'break';
  start: string;
  end: string | null; // null while running
  rawStart?: string; // unrounded stamp, set when rounding is on
  rawEnd?: string;
  note?: string;
  source: 'manual' | 'button' | 'wifi' | 'notification';
}

// Full or half day that is not regular work.
interface Absence {
  id: string;
  date: string;
  type: 'vacation' | 'comp_time' | 'sick' | 'special_leave' | 'public_holiday_override' | 'other';
  fraction: 1 | 0.5;
  label?: string; // e.g. "Summer trip"
  groupId?: string; // set when created as a range, so the range can be edited as one
}

interface DayNote {
  date: string;
  text: string;
}

// Manual balance changes: initial overtime after migration, paid-out overtime, corrections.
interface BalanceAdjustment {
  id: string;
  date: string;
  minutes: number;
  reason: string;
}

// Versioned so that changing hours never rewrites history.
interface WorkSchedule {
  id: string;
  validFrom: string;
  minutesPerWeekday: [number, number, number, number, number, number, number]; // Mon..Sun
}

interface VacationYear {
  year: number;
  entitlementDays: number;
  carryOverDays: number; // calculated default, can be overridden
  carryOverExpires?: string; // e.g. 2027-03-31
}

interface Settings {
  locale: 'en' | 'de';
  theme: 'system' | 'light' | 'dark';
  state: string; // German state code for holidays, or 'none'
  breakPresets: number[]; // minutes, default [15, 30, 45, 60]
  rounding: 0 | 5 | 10 | 15; // applied on stamp, raw time kept in `rawStart`/`rawEnd`
  roundingMode: 'nearest' | 'employer'; // employer: clock-in rounds up, clock-out rounds down
  autoBreak: boolean; // apply ArbZG minimum breaks when recorded break is too short
  warnings: { maxDay: boolean; restPeriod: boolean };
  reminders: { forgotClockOutAfterMinutes?: number };
  wifi: { ssid?: string; mode: 'ask' | 'auto'; clockOutOnDisconnect: boolean; graceMinutes: number };
}
```

Settings setup is a single "weekly hours" field that spreads evenly across Mon to Fri. An "Advanced" toggle opens per-weekday hours.

### Calculation rules (`src/lib/domain/`)

- `target(date)`: schedule minutes for that weekday, 0 on public holidays, reduced by absences. Vacation, sick and special leave credit the target. Comp time credits nothing, so the day's target stays and the balance drops. That covers "free time by reduction of overtime".
- `worked(date)`: sum of work segments, minus any auto-deducted break shortfall.
- `delta(date) = worked - target`.
- `balance(until) = sum(delta) + sum(adjustments)`, computed from the first recorded day or the first adjustment.
- `vacationLeft(year) = entitlement + carryOver - sum(vacation fractions)`. Carry-over expires on its date.
- Rounding is applied when stamping. The raw timestamp is stored next to it so rounding can be turned off without data loss.
- Segments crossing midnight count toward the start date.

Every rule gets table-driven unit tests, including DST switches, half days, holiday-on-weekend and schedule changes mid-year.

## Screens and navigation

Bottom tab bar with four tabs. The app opens on Today.

1. **Today**
   - Live timer, big primary button (Clock in / Clock out), secondary Break button.
   - While on break, the Break button shows the running break time and quick presets ("Break 30 min" ends the break automatically after 30 min, or books a past break in one tap).
   - Chips: worked today, break today, remaining to target ("2:14 h left", or "Done at 16:40").
   - Balance pill (+12:30 h) in green or red, week progress bar (31:15 / 40:00).
   - Today's segments as a timeline. Tap a segment to edit. Undo snackbar after every stamp.
2. **Calendar**
   - Segmented control: Week / Month / Year. Swipe left and right to change period, tap the title to jump to today or pick a date.
   - Week: one row per day with start, end, break, worked, delta and an absence badge.
   - Month: grid coloured by day type, delta per day, month total.
   - Year: 12 mini months, colour only.
   - Long-press or "Select" to mark several days, then one sheet sets the absence type, half or full day, and a label.
   - Tap a day to open the day sheet: segments, absences and a note, all editable. "Add segment" and "Add absence" live there.
3. **Stats**
   - Period switcher shared with Calendar (week, month, year, custom).
   - Balance over time (line), worked vs. target per week (bars), vacation used and left, sick days, average start and end time.
   - Export button for the current period.
4. **Settings**
   - Work: weekly hours, per-weekday hours, schedule history, German state, rounding, auto break, warnings.
   - Breaks: presets.
   - Balance: initial overtime, adjustments list.
   - Vacation: entitlement per year, carry-over and expiry.
   - Automation (Android only): notifications, Wi-Fi trigger, reminders.
   - Data: export, backup, restore, device transfer.
   - App: language, theme, about.

First launch runs a three-step setup: language, weekly hours, optional starting balance and vacation days left. Everything is skippable.

## Export and device transfer

- **PDF** timesheet per month or year: name, period, one row per day (date, start, end, break, worked, target, delta, remark), totals, previous and new balance, vacation taken and left, signature lines.
- **CSV**, one row per segment and one per absence. Semicolon separator and decimal comma when the locale is German, so Excel opens it cleanly.
- **iCal** (`.ics`) for absences, so vacations can go into a calendar.
- **JSON backup** of the full database with a schema version. Restore replaces all data after a confirmation.
- **Device transfer** is a JSON backup plus the system share sheet on Android (`@capacitor/share`) or a download on web. Import from the file picker.
- Optional automatic weekly backup to the Documents folder on Android (`@capacitor/filesystem`).

## Android features

### Clocked-in notification

- Phase 1: `@capacitor/local-notifications` with `ongoing: true` and action buttons (Break, Clock out) via `registerActionTypes`. Text shows "Clocked in since 08:12". Re-post on app resume because Android 14 lets users swipe ongoing notifications away.
- Phase 2: the local plugin posts the notification with `setUsesChronometer(true)` and `setWhen(clockIn)`, so Android renders a live timer with no background work.
- Button taps from a killed app are written to a native queue and reconciled when the WebView starts.
- Needs `POST_NOTIFICATIONS` (Android 13+).

No foreground service. Tracking only needs the clock-in timestamp, and a foreground service on Android 14 would require the `specialUse` type.

### Wi-Fi trigger

No public plugin detects SSID changes in the background, so this lives in the local plugin:

- "Use current Wi-Fi" in settings reads the SSID (`@capgo/capacitor-wifi` 8.5 would work for this read, but the native plugin can do it too, so skip the dependency).
- `ConnectivityManager.registerNetworkCallback(request, PendingIntent)` targets a `BroadcastReceiver`, which survives process death. Re-register on `BOOT_COMPLETED` and `MY_PACKAGE_REPLACED`. On API 31+, build the callback with `FLAG_INCLUDE_LOCATION_INFO` to read the SSID.
- Permissions: `ACCESS_FINE_LOCATION`, plus `ACCESS_BACKGROUND_LOCATION` ("Allow all the time"). The setup flow explains why and links to the system page.
- Default mode is "ask": a notification with Clock in / Dismiss. "Auto" stamps directly.
- Disconnect waits a grace period (default 5 min) before clocking out, so a short Wi-Fi drop doesn't split the day. The stamp uses the disconnect time, not the time the grace period ends.
- Also accept broadcast intents (`com.spenhouet.punchclock.CLOCK_IN` / `CLOCK_OUT`) so Tasker or Automate users can drive it without location permission.

The web and PWA build hides this section.

### Later

- Home screen widget and Quick Settings tile (native, reads and writes through the same native queue).
- Forgot-to-clock-out reminder via a scheduled local notification.

## Beyond the requested features

Taken from the research and added because they cost little and prevent wrong balances:

- German public holidays by state, counted as target-free.
- Per-weekday hours and versioned schedules for part time and changes.
- Half days for vacation and comp time.
- Sick and special leave as separate types.
- ArbZG hints: minimum break (30 min above 6 h, 45 min above 9 h), over 10 h per day, under 11 h rest between days. Hints only, never blocking.
- Vacation carry-over with expiry date.
- Undo after stamping, and a "Forgot to stamp" entry to back-date a stamp.
- Dark mode, locale-aware number and date formats.

## Repository layout

```
src/
  lib/
    domain/        pure logic: balance, target, rounding, holidays, vacation, arbzg
    db/            Dexie schema, migrations, repositories
    export/        pdf, csv, ics, json backup
    native/        typed wrapper around the local Capacitor plugin, web no-op fallback
    components/    shadcn-svelte ui/ plus app components
    stores/        runes-based state (clock status, selected period)
  routes/
    +layout.svelte          tab bar, theme, locale
    +page.svelte            Today
    calendar/[view]/[key]   week/2026-W39, month/2026-09, year/2026
    stats/
    settings/
messages/          en.json, de.json
android/           Capacitor project with the local plugin
.github/workflows/ deploy.yml (Pages), android-release.yml (APK on tag), ci.yml (lint, check, test)
```

## Milestones

Each milestone ends in a deployable build on Pages.

1. **Scaffold.** Fresh `sv create` with the versions above, Tailwind, shadcn-svelte, Paraglide (en, de), PWA manifest and icons, Capacitor Android, the three workflows, `CLAUDE.md`. Empty tab shell deploys to Pages and builds an APK.
2. **Domain and storage.** Dexie schema, domain functions with full unit tests.
3. **Today.** Clock in/out, breaks, presets, timeline, balance and week progress, undo.
4. **Calendar.** Week, month and year views, swipe navigation, day sheet with editing, multi-select absences, notes.
5. **Settings and setup.** Schedules, state, rounding, break presets, starting balance, vacation, first-launch flow.
6. **Stats and export.** Charts, PDF, CSV, iCal, JSON backup and restore.
7. **Android notification.** Ongoing notification with actions, reconciliation queue.
8. **Wi-Fi trigger.** Local plugin, permission flow, ask and auto modes, Tasker intents.
9. **Polish.** Chronometer notification, reminders, e2e tests for the main flows, README with screenshots and Obtainium instructions.

Widget and Quick Settings tile come after 1.0.

## Open decisions

- **Name.** PunchClock (`com.spenhouet.punchclock`). It's clear in English, and German users know "stempeln".
- **Rounding direction.** The default is nearest. An employer-friendly mode (clock-in rounds up, clock-out rounds down) is available as an option.
- **Charts.** Hand-rolled SVG (a few bars and a line) instead of a chart library, to keep the bundle small. Revisit if stats grow.

## Changes during implementation

- Timestamps are stored as epoch milliseconds instead of ISO strings. Arithmetic is simpler and Dexie indexes them directly.
- Calendar and stats keep the period in query parameters (`/calendar?view=month&d=2026-09-01`) instead of path segments. Every route can be prerendered for GitHub Pages, and the back button still works.
- The clocked-in notification runs in a small foreground service (`specialUse`) instead of `@capacitor/local-notifications`. The service shows a live chronometer, and it keeps the Wi-Fi callback alive so leaving the work Wi-Fi is detected right away. `@capacitor/local-notifications` is still used for the forgot-to-clock-out reminder and the end of timed breaks.
- `dexie-export-import` and `@capacitor/preferences` were not needed. The backup is a plain JSON file with a format version.
- Today counts toward the balance only when positive (or as far as comp time was booked), so the balance doesn't drop every morning.
