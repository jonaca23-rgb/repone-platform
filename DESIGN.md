---
name: RepOne
description: One dark, broadcast-grade system for running a CrossFit-style competition, from the scoring floor to the on-air graphics.
colors:
  arena-black: "#0a0a0a"
  console-gray: "#161618"
  rail-gray: "#1f1f22"
  hairline: "#2a2a2e"
  floodlight-white: "#fafafa"
  booth-gray: "#a1a1aa"
  repone-red: "#e0122f"
  signal-red: "#ff4d63"
  alarm-red: "#f04438"
  alarm-red-fill: "#d92d20"
  go-green: "#22c55e"
  go-green-text: "#4ade80"
  hold-amber: "#f59e0b"
  hold-amber-text: "#fbbf24"
  broadcast-black: "#0a0a0a"
  broadcast-white: "#ffffff"
  broadcast-red: "#e0122f"
  broadcast-slate: "#1c1c1e"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, Arial, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.025em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "0.025em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  numeral:
    fontFamily: "Barlow Condensed, Arial Narrow, Arial, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "tnum"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.repone-red}"
    textColor: "{colors.broadcast-white}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 10px"
  button-touch:
    backgroundColor: "{colors.repone-red}"
    textColor: "{colors.broadcast-white}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "0 24px"
  button-outline:
    backgroundColor: "{colors.arena-black}"
    textColor: "{colors.floodlight-white}"
    rounded: "{rounded.md}"
    height: "36px"
  button-ghost:
    textColor: "{colors.floodlight-white}"
    rounded: "{rounded.md}"
    height: "36px"
  button-destructive:
    backgroundColor: "{colors.alarm-red-fill}"
    textColor: "{colors.broadcast-white}"
    rounded: "{rounded.md}"
    height: "36px"
  card:
    backgroundColor: "{colors.console-gray}"
    textColor: "{colors.floodlight-white}"
    rounded: "{rounded.xl}"
    padding: "24px"
  input:
    backgroundColor: "{colors.arena-black}"
    textColor: "{colors.floodlight-white}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "4px 10px"
  input-operator:
    backgroundColor: "{colors.arena-black}"
    textColor: "{colors.floodlight-white}"
    rounded: "{rounded.md}"
    height: "44px"
  badge-success:
    backgroundColor: "{colors.go-green}"
    textColor: "{colors.go-green-text}"
    rounded: "{rounded.pill}"
    height: "20px"
  badge-warning:
    backgroundColor: "{colors.hold-amber}"
    textColor: "{colors.hold-amber-text}"
    rounded: "{rounded.pill}"
    height: "20px"
  event-tab:
    textColor: "{colors.booth-gray}"
    height: "44px"
    padding: "0 12px"
  event-tab-active:
    textColor: "{colors.floodlight-white}"
    height: "44px"
  overlay-panel:
    backgroundColor: "{colors.broadcast-black}"
    textColor: "{colors.broadcast-white}"
    rounded: "0px"
---

# Design System: RepOne

## Overview

**Creative North Star: "The Broadcast Booth"**

RepOne looks like the inside of a sports network's production truck: black glass, white type, one red that means "live". The same identity runs from the 1920×1080 overlays an audience sees on video to the phone a scorekeeper holds on a loud, bright competition floor. The app is never a light office tool with a dark mode; there is one dark theme, defined once on `:root`, and every screen sits on it.

The product is an operating tool first (PRODUCT.md: "Event day first"). Density is moderate and calm: surfaces separate by tone, not by shadow; type does the hierarchy; red is rationed so it still reads as a signal. Expression lives in the condensed uppercase display type and the red, not in decoration. Screens used live (scoring, production, commentary) are glanceable, with 44 to 64px touch targets and 16px inputs so phones never zoom.

Every area has its own shell on the same tokens: a sidebar for organizers, an operator top bar with event tabs for producers, scorekeepers and commentators, a top bar plus phone tab bar for athletes, and a public shell for spectators. Overlays are the exception that proves the rule: no shadcn, no shells, no focus rings, just the four broadcast tokens and the display font over a transparent page.

**Key Characteristics:**
- One dark theme on `:root`; no `.dark` class, no theme switcher.
- Tonal layering (black, console, rail) instead of shadows.
- RepOne red for fills and "live", a lighter signal red for red text.
- Barlow Condensed, uppercase, for headings, numbers and on-air type; Inter for everything you read.
- Every text pair is at least 4.5:1, every focus ring and UI border at least 3:1 (checked by `src/lib/design/contrast.test.ts`).
- A shell per area, one account menu everywhere.

## Colors

A near-black stage with white type and a single red, plus green and amber reserved for status.

### Primary
- **RepOne Red** (#e0122f, `--primary`): the brand fill. Primary buttons, the active event tab's underline, lane-number tiles, the active sidebar marker, the "live" heat highlight. White text on it only (`--primary-foreground` #ffffff).
- **Signal Red** (#ff4d63, `--brand-text`, `--ring`): red as *text* and as the focus ring. RepOne Red as text fails AA on the dark surfaces, so any red word (division names, "Following live heat", inline links) uses Signal Red.

### Tertiary (status)
- **Alarm Red** (#f04438, `--destructive`): destructive text and invalid-field borders on dark.
- **Alarm Red Fill** (#d92d20, `--destructive-fill`): filled destructive buttons and dialog confirm actions; white text on it is 4.83:1, where white on Alarm Red is not.
- **Go Green** (#22c55e, `--success`) with **Go Green Text** (#4ade80, `--success-text`): paid, recorded, connected, live dots. Fills and borders use the base at 10 to 40% opacity; words use the text tone.
- **Hold Amber** (#f59e0b, `--warning`) with **Hold Amber Text** (#fbbf24, `--warning-text`): unpaid, pending, manual adjustment, "not connected" notices. Same split as green.

### Neutral
- **Arena Black** (#0a0a0a, `--background`): the page. Also input and outline-button fill.
- **Console Gray** (#161618, `--card`, `--popover`, `--sidebar`): cards, menus, dialogs, the sidebar, the operator top bar.
- **Rail Gray** (#1f1f22, `--muted`, `--secondary`, `--accent`): hover fills, secondary buttons, skeletons, the selected sidebar item.
- **Hairline** (#2a2a2e, `--border`, `--input`): every border and divider. The base layer applies it to all elements (`* { border-border }`), so a bare `border` is already correct.
- **Floodlight White** (#fafafa, `--foreground`): body text and headings.
- **Booth Gray** (#a1a1aa, `--muted-foreground`): descriptions, labels, inactive tabs, meta text. The dimmest text allowed.

### Broadcast (overlays only)
- **Broadcast Black** (#0a0a0a, `--broadcast-bg`), **Broadcast White** (#ffffff, `--broadcast-fg`), **Broadcast Red** (#e0122f, `--broadcast-accent`), **Broadcast Slate** (#1c1c1e, `--broadcast-muted`). Used through `bg-broadcast-*` / `text-broadcast-*` in `src/components/graphics/*` and `src/app/(overlay)/**`. They match the app values but are separate tokens so the app can change without moving what is on air.

### Named Rules
**The Signal Rule.** RepOne Red is a fill; Signal Red is a word. Never put `text-primary` or the base red on dark as running text.

**The No Fading Rule.** Never dim text with opacity (`text-white/50`, `text-foreground/40`). The only quieter text is `text-muted-foreground`. The UI guard rejects the opacity forms.

**The Status Pair Rule.** Green and amber come in pairs: the base for fills and borders at low opacity, the `-text` tone for words. A status badge is `border-success/40 bg-success/10 text-success-text` (or the warning equivalent).

## Typography

**Display Font:** Barlow Condensed 600/700 (with Arial Narrow, Arial), `--font-display`, `font-display`
**Body Font:** Inter variable (with system-ui), `--font-sans`, the default

**Character:** a condensed sports-graphics face for anything shouted or counted, set against a neutral, highly legible sans for anything read. Both are bundled from `src/fonts/` with `next/font/local`; no font CDN at build or runtime.

### Hierarchy
- **Display** (Barlow Condensed 700, 30px `text-3xl`, uppercase, `tracking-wide`): page titles via `PageHeader`, the scorekeeper and dashboard heat line ("WOD 2 · HEAT 6 / 9").
- **Headline** (Barlow Condensed 700, 24px `text-2xl`, uppercase): card titles on operator screens, start-page greeting, live-event names.
- **Title** (Inter 600, 16px): card and section titles in the admin area, athlete names in rows.
- **Body** (Inter 400, 16px, line-height 1.5): all running text. Descriptions cap at `max-w-prose`. Inputs are never below 16px (`text-base`, fixed at the component level).
- **Label** (Inter 500, 14px `text-sm`): buttons, tabs, form labels, table headers. Operator-screen labels and live-control buttons go uppercase with `tracking-wide`.
- **Numeral** (Barlow Condensed 700, `tabular-nums`): times, scores, ranks, money totals, lane numbers, the overlay timer. Numbers that update live never jitter.

### Named Rules
**The Shout Once Rule.** Uppercase condensed type is for one line per region (the page title, the heat line, a tile's number). Paragraphs, descriptions and form text stay in sentence-case Inter.

## Layout

Content is centered in a capped column: `max-w-5xl` on operator, public and athlete shells (athlete pages tighten to `max-w-3xl`), full width beside a 256px sidebar in admin. Page gutters are 16px on phones (`px-4`) and 24px from `sm` (`px-6`); vertical rhythm uses Tailwind's 4px scale, mostly 16 and 24px between blocks (`gap-4`, `gap-6`).

- **Top bars** are 56px (`h-14`) for operator, athlete and public shells and 48px (`h-12`) in admin, sticky, Console Gray with a Hairline bottom border, padded with `env(safe-area-inset-*)`.
- **Event tabs** sit under the operator top bar: a horizontally scrollable row, each tab at least 44px tall.
- **Phones:** the admin sidebar becomes a sheet opened from the top bar; athletes get a fixed bottom tab bar (`Home`, `Athletes`, `Messages`, each 56px tall) and the page pads for it; the account menu shows only the avatar.
- **Touch:** every control on operator and athlete screens is at least 44px; live controls (`size="touch"`) are at least 48px, 64px for the big production buttons.
- No page scrolls horizontally at 390px.

## Elevation & Depth

The system is flat and tonal. Depth comes from three surface steps (Arena Black page, Console Gray cards and bars, Rail Gray hover and selection) and one-pixel Hairline borders. Shadows exist only as shadcn's near-invisible `shadow-xs` on cards, inputs and outline buttons; on a black page they read as nothing, and nothing should rely on them. Menus, dialogs and sheets lift by being Console Gray over a dimmed page, not by a heavy shadow. Overlays are the opposite: on-air panels use `shadow-2xl` / `shadow-lg` so a graphic separates from arbitrary video behind it.

### Named Rules
**The Flat Floor Rule.** In the app, separate surfaces by tone and Hairline borders. Do not add shadows to signal importance; use red, size or position.

## Shapes

Softly rounded rectangles on a 10px base radius (`--radius: 0.625rem`): 8px for buttons and inputs (`rounded-md`), 10px for small containers (`rounded-lg`), 14px for cards (`rounded-xl`), full pills for badges and avatars. Lane-number tiles are small rounded squares in RepOne Red. Dashed Hairline borders mark empty states. Overlay graphics are square-cornered slabs with a red accent bar, the broadcast-package silhouette; keep them square.

## Components

### Buttons
Confident and literal: a verb on a solid shape.
- **Shape:** 8px radius (`rounded-md`), 1px transparent border, Inter 500 14px.
- **Primary:** RepOne Red fill, white text, 36px tall (`default`). Hover goes to 80% fill.
- **Touch:** `size="touch"`, at least 48px, 24px side padding, 16px uppercase with wide tracking. Live controls and primary phone actions.
- **Outline / Ghost / Secondary:** Arena Black with Hairline border; transparent with Rail Gray hover; Rail Gray fill. Navigation and secondary actions.
- **Destructive:** Alarm Red Fill with white text. Never a one-click action: destructive buttons live inside `ConfirmAction`.
- **Focus:** 3px Signal Red ring at full strength (`ring-3 ring-ring`) plus a ring-colored border. Press nudges 1px down.
- **Links as buttons:** `<Button asChild><Link/></Button>`.

### Chips / Badges
- **Style:** pill (`rounded-4xl`), 20px tall, 12px Inter 500. Status badges use the Status Pair Rule (paid, recorded: green; unpaid, pending: amber). Neutral tags (`INDIVIDUAL`, division names) use `outline`.

### Cards / Containers
- **Corner Style:** 14px (`rounded-xl`).
- **Background:** Console Gray on Arena Black.
- **Border:** a 1px inner ring (`ring-1 ring-foreground/10`); highlighted cards (the heat on air) switch to a RepOne Red border with a 10% red tint.
- **Internal Padding:** 24px (`--card-spacing`), 16px for `size="sm"`.
- **Shadow Strategy:** none to speak of; see Elevation.

### Inputs / Fields
- **Style:** Hairline border, Arena Black (`bg-input/30` over the page), 8px radius, 16px text, 36px tall by default and 44px (`h-11`) on operator and phone forms. Selects (Radix) match and their items are at least 44px.
- **Focus:** border turns Signal Red with a 3px Signal Red ring.
- **Error / Disabled:** `aria-invalid` turns the border Alarm Red with a faint red ring; the message sits under the field in Alarm Red. Disabled is 50% opacity.
- **Labels:** always a visible `<Label>` above the control (`grid gap-2`), never placeholder-only.

### Navigation
- **Admin sidebar:** Console Gray, 256px, collapsible to icons. Groups "Organization" and the open event's name, each item a lucide icon plus label in Inter 14px; the current item gets a Rail Gray fill and a RepOne Red left marker. On phones it is a sheet.
- **Event tabs (operator):** Inter 500 14px, Booth Gray; the current tab turns Floodlight White with a 2px RepOne Red underline and `aria-current="page"`.
- **Athlete bottom bar (phones):** three 56px tabs, icon over a 12px label, current in Floodlight White.
- **Account menu (every shell):** a ghost button with the avatar and the account name; it opens a Console Gray menu with `Home`, one item per module the account may open (lucide icon, label, detail line) and `Sign out`. Closes on Escape and outside click. Org members are called "Members" in the UI.
- **Skip link:** the first Tab stop on every shell, jumping to `main#main`.

### ConfirmAction (signature)
The one door to anything destructive or on-air-changing: delete, remove, refund, reset, finish heat, clear graphics. A trigger button opens an AlertDialog with a question title ("Finish Heat 6?"), one sentence saying what happens, `Cancel`, and a confirm button named for the action ("Finish heat", "Delete event"), in Alarm Red Fill when destructive. Cancel never acts; confirm acts exactly once. Never use `window.confirm`, and never wrap the action in a bare `<form action>` that Enter could submit.

### PageHeader and EmptyState
`PageHeader` is the top of every page: optional breadcrumb, Display title, a Booth Gray description, actions on the right (wrapping under on phones). `EmptyState` replaces bare "No X yet" text: a lucide icon, a Title-weight line, one sentence, and the next action, inside a dashed Hairline box.

### Broadcast graphics (overlays)
Square slabs of Broadcast Black (95% opacity in corner graphics, solid when full-screen) with Broadcast White Barlow Condensed type, a Broadcast Red accent bar or lane tile, and a heavy drop shadow. They render on a transparent body at 1920×1080 for OBS/vMix/YoloBox and must stay transparent: no page background, no shadcn, no focus rings, no portals.

## Do's and Don'ts

### Do:
- **Do** use the semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-brand-text`, `text-success-text`, `text-warning-text`) for every color in the app.
- **Do** keep text at 4.5:1 or more and focus rings and UI borders at 3:1 or more on Arena Black and Console Gray; add a pair to `contrast.test.ts` when you add a token.
- **Do** put destructive and on-air actions behind `ConfirmAction`.
- **Do** use `size="touch"` (48px minimum) for live controls and primary phone actions, and keep every operator and athlete control at least 44px.
- **Do** use `font-display` uppercase for page titles, heat lines and numbers, with `tabular-nums` on anything that updates live.
- **Do** give every page a `metadata` title (or `generateMetadata` when it depends on data) and every icon-only control an accessible name.
- **Do** use lucide icons in navigation.
- **Do** run `pnpm ui:guard` (part of `pnpm check`) and fix what it flags.

### Don't:
- **Don't** add a light theme, a `.dark` class or a theme switcher. There is one dark theme on `:root`.
- **Don't** dim text with opacity utilities (`text-white/50`, `text-foreground/40`) or use raw `text-white`, `text-black`, `bg-white` in the app; the guard rejects them.
- **Don't** use RepOne Red (`#e0122f`) as text on dark; use Signal Red (`text-brand-text`).
- **Don't** weaken focus rings (`ring-ring/50` measured about 2.3:1); rings are full strength.
- **Don't** bring back `.control-btn`, raw `<button>`, `<input>`, `<select>` or `window.confirm` in app code; use the `src/components/ui` and `src/components/app` components.
- **Don't** import shadcn components, shells or app colors into overlays; they use only `--broadcast-*` and `font-display`, on a transparent page.
- **Don't** shrink inputs below 16px, or put emoji in navigation.
