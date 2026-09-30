# PunchClock

Offline, single-user time tracker. Static SvelteKit app (no server) deployed to GitHub Pages as a PWA, and wrapped with Capacitor as an Android APK.

## Commands

- `bun run dev`: dev server
- `bun run check`: compiles Paraglide messages, then svelte-check
- `bun run lint`: eslint and prettier
- `bunx vitest --run`: unit tests (TZ is Europe/Berlin, IndexedDB via fake-indexeddb)
- `bunx playwright test`: e2e against a production build (`bun run preview`)
- `CAPACITOR=1 bun run build && bunx cap sync android`: web build for the APK

## Layout

- `src/lib/domain/`: pure logic, no Svelte. `calc.ts` holds `Ledger`, which computes day summaries, periods, balance and vacation from a `Data` snapshot. All rules live here and are unit tested.
- `src/lib/db/`: Dexie schema (`index.ts`), clock actions (`clock.ts`), CRUD (`entries.ts`), backup (`backup.ts`).
- `src/lib/state.svelte.ts`: `app` holds all data in memory via a Dexie `liveQuery`, plus a ticking `now`; `app.ledger` is derived.
- `src/lib/ui.svelte.ts`: global sheets (day, entry, absence) that open from any screen.
- `src/lib/stamp.ts`: UI entry point for clock actions (queued, undo toast, haptics).
- `src/lib/native/`: Capacitor bridge. `plugin.ts` is the JS contract for the Java plugin in `android/app/src/main/java/com/spenhouet/punchclock/`.
- `src/lib/export/`: PDF, CSV, iCal, file saving (share sheet on Android, download on web).
- `src/lib/sync/`: online backup. The backup is encrypted on the device (PBKDF2 + AES-GCM, `crypto.ts`) and stored in a secret GitHub gist (`gist.ts`); the token and derived key live in the `kv` row `sync`, outside any backup.
- `src/routes/`: Today (`/`), `/calendar`, `/stats`, `/settings/*`. Period and view are query params (`?view=month&d=2026-09-01`).
- `messages/{en,de}.json`: every UI string. Add both languages for each new key.

## Design

Read `DESIGN.md` before touching UI. After making changes, run `bun run lint` and fix all errors; it includes the `@shadcn/lint` design rules (no raw colors, no arbitrary values, no restyling of components, no inline styles except CSS custom properties).

## Releases

Add every user-facing change to `CHANGELOG.md` under "Unreleased" (Features / Fixes). To release: rename that section to the new version with the date, bump `version` in `package.json`, commit, then tag `vX.Y.Z` and push the tag. The Android Release workflow uses the section as the release notes and fails if it's missing.

## Conventions

- Times are epoch milliseconds, days are `YYYY-MM-DD` in local time. A segment counts toward its start day.
- Starting a break closes the work segment and opens a break segment. Work time is the sum of work segments; pause is the gap between the first start and last end.
- Target hours are versioned by `validFrom` so history never changes.
- Today counts toward the balance only when positive (or as far as comp time was booked); see `Ledger.contribution`.
- Components in `src/lib/components/ui/` come from shadcn-svelte. bits-ui sets `data-state`, so use `data-[state=open]:` style variants, not `data-open:`.
