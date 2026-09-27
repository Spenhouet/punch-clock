# PunchClock design system

PunchClock should feel calm and obvious. One screen answers "am I clocked in, how long today, what's my balance", and every frequent action is one tap away. This file lists the rules that keep the UI consistent. `bun run lint` enforces most of them through [`@shadcn/lint`](https://github.com/shadcn-ui/lint); the rest are review rules.

## Principles

1. **Short click paths.** Frequent actions (clock in, clock out, break) take one tap. Rare actions (edit, absence, export) take three at most. Never hide a frequent action behind a menu.
2. **Numbers first.** Durations and balances are the content. Show them large, in tabular figures, with color only where it carries meaning (a positive or negative balance).
3. **One way to do a thing.** Use the shared components listed below. Don't hand-build a second version of a tile, sheet or list row.
4. **Undo over confirm.** Reversible actions show an undo toast. Confirmation dialogs are only for destructive, irreversible actions (restore backup, delete all data).
5. **Mobile first, desktop aware.** Design at 360 to 430 px wide, then use extra width on desktop for more columns, never for stretched content.

## Tokens

All tokens live in `src/app.css`. Use them through Tailwind classes. Raw palette colors (`bg-teal-600`), hex values and arbitrary values (`p-[13px]`) are lint errors.

### Color

Semantic tokens, each with a light and a dark value:

| Token                                            | Use                                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `background`, `foreground`                       | Page                                                                                                  |
| `card`, `popover`                                | Surfaces and sheets                                                                                   |
| `muted`, `muted-foreground`                      | Inactive fills, secondary text                                                                        |
| `primary`, `primary-foreground`                  | Brand teal: primary actions, work time, active navigation                                             |
| `secondary`, `accent`                            | Quiet buttons and hover fills                                                                         |
| `destructive`                                    | Delete and error                                                                                      |
| `positive`, `warning`, `negative`                | Distance from target, either direction: on target, somewhat off, far off (see `src/lib/deviation.ts`) |
| `break`, `break-foreground`                      | Breaks: timer ring, break entries, the Resume button                                                  |
| `vacation`, `comp`, `sick`, `special`, `holiday` | Absence types and public holidays. Always paired with a text label                                    |
| `border`, `input`, `ring`                        | Lines, field borders, focus ring                                                                      |

Rules:

- Color never carries meaning alone. Every absence dot sits next to its label, and every delta shows a sign (`+0:30`, `−0:15`).
- Over/under colors mean distance from target, not direction: green when close to target, amber when noticeably off, red when far over or far under. Working far too much is as much a problem as working too little. Bands grow with the period (day ±30/±90 min, week ±1:30/±4 h, month ±3/±10 h, year and balance ±10/±40 h). Use `Delta` with the right `scale`, or `deviationLevel` for fills.
- Where a day shows time, the total worked time comes first and the difference second, smaller.
- Opacity modifiers on tokens are fine for tints: `bg-primary/12` (selected nav), `bg-break/12` (warning notice), `bg-holiday/15`.
- Text on a colored fill uses the matching `*-foreground` token, or `text-background` on absence colors so it flips correctly in dark mode.

### Typography

System font stack. Scale:

| Class                  | Size      | Use                                                |
| ---------------------- | --------- | -------------------------------------------------- |
| `text-2xs`             | 10 px     | Chart axis labels, month cell deltas               |
| `text-caption`         | 11 px     | Tab bar labels, weekday headers                    |
| `text-xs`              | 12 px     | Meta text, tile labels, hints under fields         |
| `text-sm`              | 14 px     | Default UI text, buttons                           |
| `text-body`            | 15 px     | List row labels in settings                        |
| `text-lg`              | 18 px     | Tile values, sheet titles                          |
| `text-xl`, `text-2xl`  | 20, 24 px | Page titles (`text-xl` mobile, `text-2xl` desktop) |
| `text-3xl`, `text-4xl` | 30, 36 px | Hero balance                                       |
| `text-display`         | 44 px     | The live timer on Today                            |

- Every number that changes or lines up in columns gets the `tabular` utility.
- New text size tokens must also be registered in `src/lib/utils.ts` (`extendTailwindMerge`). Otherwise `cn()` mistakes them for colors and drops them next to a color class.
- Weights: `font-medium` for labels and buttons, `font-semibold` for values and titles. No bold.
- Section headings in settings are `text-xs font-semibold uppercase tracking-wide text-muted-foreground` (see `Group`).

### Spacing and layout

- Page gutter: `px-4` on mobile, `md:px-8` on desktop. The layout sets it; pages don't add their own.
- Vertical rhythm: `gap-3` between cards on mobile, `md:gap-4` on desktop, `gap-6` between settings groups.
- Card padding: `p-3` for tiles, `p-4` for content sections, `p-2` for lists whose rows bring their own padding.
- Content width: `max-w-lg` on mobile, `md:max-w-5xl` on desktop. Settings pages cap at `md:max-w-2xl`.
- Touch targets are at least 40 px (`h-10`, `size-10`). The primary clock buttons are 64 px (`Button size="xl"`).

### Shape and elevation

| Radius                     | Use                                             |
| -------------------------- | ----------------------------------------------- |
| `rounded-xs` (4 px)        | Chart bars, year-grid cells                     |
| `rounded-md`, `rounded-lg` | Small chips inside cards, inputs                |
| `rounded-xl`               | List rows, notices, muted tiles, calendar cells |
| `rounded-2xl`              | Cards (`surface`), big buttons                  |
| `rounded-3xl`              | Sheets                                          |
| `rounded-full`             | Pills, status dots, avatar-like icons           |

- `surface` is the only card style: `rounded-2xl bg-card shadow-xs ring-1 ring-border`. Use the utility; don't retype the classes.
- Shadows: `shadow-xs` on surfaces, `shadow-lg` only on the hero balance card, `shadow-xl` only on floating buttons (`Button size="fab"`) and sheets.

### Motion

- `transition-colors` for hover and press states, `transition-all` for data changes (ring, bars).
- Sheets slide from the bottom on mobile and fade/slide in centered on desktop (`Sheet`).
- Period changes go through `Swipeable`: the view follows the finger, the neighboring period rides along, and on release the old period slides out while the new one slides in (about 200 to 340 ms, ease-out). Buttons and arrow keys play the same slide; switching week/month/year crossfades. Motion is off when the system asks for reduced motion.
- No looping animation except the pulsing status dot while clocked in.

### Inline styles

Inline `style` is a lint error, with one exception: CSS custom properties for data-driven geometry. Set the variable inline and read it with a Tailwind class:

```svelte
<div class="h-(--fill) bg-primary" style="--fill: {pct}%"></div>
```

Safe-area insets use the utilities `pt-safe`, `pt-safe-<n>`, `pb-safe` and `mb-safe`.

## Components

`src/lib/components/ui/` holds shadcn-svelte primitives. `src/lib/components/app/` holds the app's own building blocks. Check here before writing markup.

| Need                                     | Use                                                                                                                                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action                                   | `Button` with a variant (`default`, `secondary`, `outline`, `ghost`, `destructive`, `link`, `break`) and a size (`sm`, `default`, `lg`, `xl` for the clock buttons, `fab` for floating actions, `icon*`) |
| Single figure (label over value)         | `StatTile` (`tone`: `surface`, `muted`, `primary`; `align`: `start`, `center`)                                                                                                                           |
| Signed duration                          | `Delta` (colors by sign, always shows `+`/`−`)                                                                                                                                                           |
| One-line status (holiday, absence, hint) | `Notice` (`tone`: `neutral`, `holiday`, `warning`; `dot` for a token color)                                                                                                                              |
| Panel                                    | an element with `surface`                                                                                                                                                                                |
| Bottom sheet / dialog                    | `Sheet` (editing), `Confirm` (destructive confirmation only)                                                                                                                                             |
| Two to four options                      | `Segmented`                                                                                                                                                                                              |
| Settings list                            | `Group` with `Row` children                                                                                                                                                                              |
| Form field with label                    | `Field` wrapping `Input`, `Textarea`, `NativeSelect` or `HoursInput`                                                                                                                                     |
| Durations entered by the user            | `HoursInput` (accepts `7:30` and `7.5`)                                                                                                                                                                  |
| Period switching                         | `PeriodNav` plus `Segmented` for week/month/year, content wrapped in `Swipeable`                                                                                                                         |
| Worked/target/difference row             | `SummaryStrip`                                                                                                                                                                                           |
| Page title bar                           | `PageHeader` (sticky, optional back link and actions)                                                                                                                                                    |
| Charts                                   | `BarChart`, `LineChart`, `ProgressRing`                                                                                                                                                                  |

Component rules (enforced by `shadcn/no-restyle`):

- Pages may add layout classes to a component (`flex-1`, `w-full`, `mt-2`, grid placement). They may not change its padding, typography, color, shape or effects. If a new look is needed, add a variant to the component and document it here.
- New variants go into the component's `tv()` definition, not into call sites.

## Navigation

- Below `md`: bottom tab bar (Today, Calendar, Stats, Settings), sheets slide up from the bottom.
- From `md`: left sidebar with the same four entries and a mini clock (status, timer, clock buttons) on every page except Today. Sheets are centered dialogs.
- Calendar and stats keep the period in the URL (`?view=month&d=2026-09-01`). Swiping left and right (or the arrow keys on desktop) changes the period, tapping the title jumps to today. Long press on a day starts multi-select.
- The Android back button closes an open sheet first, then goes back, then leaves the app.

## Content

- Every string lives in `messages/en.json` and `messages/de.json`. Add both languages.
- Durations are `h:mm` (`7:45`), balances are signed (`+12:30`). Dates follow the locale: `Wed, Sep 23` in English, `Mi., 23. Sep.` in German.
- Write labels as short nouns or verbs ("Clock in", "Mark 3 days"). Hints explain consequences in one sentence ("The day's target stays, so your balance goes down.").

## Checklist for UI changes

1. `bun run lint` passes (design rules included).
2. Light and dark mode both checked.
3. Checked at 390 px and at 1440 px wide.
4. Both languages fit without truncating key labels.
5. Frequent actions still take one tap.
