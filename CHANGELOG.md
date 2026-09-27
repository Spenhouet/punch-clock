# Changelog

Each release on GitHub uses the matching section below as its release notes. Add changes under "Unreleased" as you make them; the release workflow fails if the tagged version has no section.

## [Unreleased]

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
