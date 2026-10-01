# Changelog

Each release on GitHub uses the matching section below as its release notes. Add changes under "Unreleased" as you make them; the release workflow fails if the tagged version has no section.

## [Unreleased]

## [0.6.0] - 2026-10-01

### Features

- The Wi-Fi trigger now belongs to places of work. Turn on "Clock in and out on this Wi-Fi" in a place's editor, with its own mode, clock-out, grace time and usual break time, so several places (office, second office, home office) can each clock you in and out. Notifications name the place. An existing work Wi-Fi setting moves to the place that lists the network, or to a new place named after it.

## [0.5.0] - 2026-09-30

### Features

- Places of work. Add places like the office or home office in Settings and assign Wi-Fi networks to them. When work starts on one of those networks, the entry gets that place. After a break the place of the entry before stays, otherwise the place marked as default applies. Change the place in one tap on Today while clocked in, or on any entry. Places can be reordered, and removing a place keeps its name on older entries. Both CSV exports have a new Place column.
- Online backup. Under Backup & transfer, turn it on with a GitHub token and a passphrase. PunchClock then backs up after every change to a secret gist in your GitHub account, encrypted on the device with your passphrase (AES-256-GCM), so nobody can read it without the passphrase. To move to a new phone or recover a lost one, tap Restore online backup during setup and enter the token, passphrase and backup ID. The token stays on the device and is never part of a backup.
- Notifications, widget, Wi-Fi trigger and automation apps are now sections on the Settings page instead of a separate screen.

### Fixes

- The entries CSV now subtracts a break recorded inside an entry from its duration, like the day totals do.

## [0.4.0] - 2026-09-29

### Features

- Usual break time for the Wi-Fi trigger. Leaving the work Wi-Fi within this window starts a break (backdated to when the Wi-Fi was lost) instead of clocking out, and coming back ends the break. If you're not back by the end of the window, you're clocked out at the time you left. In "Ask me" mode you get notifications with Break / Clock out and Resume buttons instead.

### Fixes

- Clocking out right where a break began no longer leaves an empty break entry.

## [0.3.1] - 2026-09-27

### Fixes

- The left and right borders of the days in the week view were cut off.
- Day numbers and times in the month view were cut off on narrow phones and with larger system text. Month cells now grow with their content.
- With large text, the calendar header buttons show only their icons so the page title still fits.
- Some small labels (tab bar, month cells) rendered at full text size, which cut off the tab labels. They now use their intended smaller size.

## [0.3.0] - 2026-09-27

### Features

- Android home screen widget: status, a live timer, your balance and Clock in / Break / Clock out buttons. It resizes from a compact 2x1 (status, timer and a play/stop button) to the full 4x1 layout, and follows light and dark mode.
- Days in the month calendar show the total time worked first, with the difference below.
- Over/under colors now show how far you are from target in either direction. Green means close to target, amber noticeably off, red far over or far under. The ranges grow with the period (day, week, month, year, balance).
- The year heatmap uses the same scale.
- "Add widget to home screen" in Settings → Notifications & Wi-Fi places the widget without going through the launcher.
- Tapping anywhere on a settings row now toggles its switch, not just the switch itself.

### Fixes

- Clocking in on Android opened the system "Alarms & reminders" settings page. Reminders are now scheduled without needing that permission.
- The Android notification showed "Since 1:00 AM" instead of the actual clock-in time, and timed breaks didn't count down in it.
- Wi-Fi clock-in stopped working after it had triggered once. Android releases this kind of network trigger after each use, so PunchClock now re-arms it when you leave the work Wi-Fi, when the app opens, and at least every 15 minutes.

## [0.2.2] - 2026-09-27

### Features

- Swiping between weeks, months and years is animated. The view follows your finger, the next period slides in beside it, and a short swipe springs back.
- The arrow buttons and the arrow keys play the same slide. Switching between week, month and year crossfades.
- Animations turn off when the system asks for reduced motion.

## [0.2.1] - 2026-09-27

### Features

- The year calendar can color each day by how much you worked over or under target, from red through grey to green, with a legend. A toggle switches back to the colors by day type.

## [0.2.0] - 2026-09-27

### Features

- Manual entries can include a break duration without exact break times, for when you know when you came and left but not when you took the break.
- "Target time" fills a manual entry so the day's target is met, including the legal minimum break.
- Days without known times can be filled with their target time in one tap from the day sheet, or for several selected days at once in the calendar.
- New setting for your usual start time, used when filling days with their target time.
- Long press on a day in the calendar starts multi-select.
- The arrow keys change the period on desktop.
- Days before the tracking start count toward the balance once you record something for them, so past entries show their over or under time.

### Fixes

- Swiping in the calendar and stats didn't work on Android.
- The label field in the absence sheet cleared itself while typing.
- The "set balance" field could be reset while typing.
- The German "Einstellungen" tab label was cut off on narrow phones; the tab is now called "Optionen".

## [0.1.0] - 2026-09-27

First release.

### Features

- Clock in, clock out and breaks with one tap each, as often as needed per day. Timed breaks end by themselves.
- A live overview of today: progress toward the target, the time you're done, today's break, the week at a glance and your overtime balance.
- Weekly target hours, per weekday if needed. Changes apply from a date, so past days keep their old target.
- German public holidays per state.
- Absences: vacation, comp time taken from overtime, sick days, special leave and other. Full or half days, with a label, for several days at once.
- Vacation account with entitlement, automatic carry-over and an expiry date.
- Overtime balance with a starting value, a "set balance" action and corrections such as paid-out overtime.
- Comments per entry and per day, and full manual editing with undo.
- Week, month and year calendar views, and stats with charts and averages.
- Export as a PDF timesheet, CSV per day or per entry, and iCal for absences.
- Backup and restore through one file, for moving to another device.
- Rounding of stamps to 5, 10 or 15 minutes.
- Hints for the German working time act (ArbZG), with optional automatic deduction of missing breaks.
- English and German, light and dark mode, and a desktop layout with a sidebar.
- Android:
  - a notification while clocked in, with a live timer and Break and Clock out buttons
  - a reminder if you forget to clock out
  - automatic clock in and out on your work Wi-Fi
  - broadcast intents for Tasker and similar apps
