# Design system foundation and shells — Design

**Date:** 2026-10-02
**Status:** design approved in conversation (four sections); awaiting review of this written spec.
**Branch:** `feat/design-system`, from `staging` (which includes #8 and #10–#13).
**Sub-project 1 of 7** from the UI/UX audit (`.impeccable-audit/AUDIT.md`, scored 11/20). The later sub-projects each get their own spec:
- 2: scorekeeper
- 3: production
- 4: admin data screens
- 5: athlete and live
- 6: commentator
- 7: overlays

**Product context:** `PRODUCT.md`. Key points:
- it is RepOneLive's in-house tool;
- the UI is in English;
- one dark theme;
- the logos, RepOne red and the broadcast look are binding;
- event day comes first;
- the target is WCAG 2.1 AA.

## Goal

Give the whole app one dark RepOne theme built on shadcn/ui, with semantic tokens that pass AA. Every area gets the shell that fits its job, and every screen moves onto the shared components and global states. This sub-project does not redesign any screen's content.

**Success means:**
- no AA contrast failures and Lighthouse accessibility ≥ 95 on one screen per area;
- no one-click destructive actions and no `window.confirm`;
- every route has its own title, a `<main>`, loading and error states, and touch targets ≥ 44px on operator and athlete screens;
- `.control-btn`, copy-pasted input classes, hard-coded status colors and nav emojis are gone;
- `/impeccable audit` improves on 11/20.

## Non-goals

- Redesigning screen content and layouts. That belongs to sub-projects 2–6: payments table, scorekeeper drawer, production board, athlete tabs, commentator grid.
- Overlay visuals (sub-project 7). Overlays only get their colors moved into a broadcast token block.
- A light theme or a theme switcher.
- Any database, auth or permission change.

## 1. Theme and tokens

- **Approach:** shadcn/ui is the only component system. It is installed with the shadcn CLI (Tailwind 4, React 19, Next 16) and its components are copied into `src/components/ui/`. Its CSS variables become the semantic layer.
- **One dark theme:**
  - The dark values live in `:root`. There is no `.dark` class and no switcher, which shadcn's theming supports.
  - `globals.css` keeps the `--repone-*` brand palette as the source and maps the semantic tokens onto it.
- **Semantic tokens** (starting values; the contrast test in §4 is the arbiter):

| Token | Value | Use |
|---|---|---|
| `--background` | `#0a0a0a` | page |
| `--card`, `--popover` | `#161618` | surfaces |
| `--muted` / `--secondary` / `--accent` | `#1f1f22` | secondary surfaces, hover |
| `--foreground`, `--card-foreground` | `#fafafa` | text |
| `--muted-foreground` | `#a1a1aa` | secondary text, ≥ 4.5:1 on `--card` |
| `--primary` | `#e0122f` (RepOne red) | primary buttons and fills |
| `--primary-foreground` | `#ffffff` | text on red |
| `--brand-text` | `#ff4d63` | red **text** on dark surfaces (links, emphasis), ≥ 4.5:1 on `--card` |
| `--destructive` | `#f04438` | delete/remove, distinct from brand red |
| `--success` / `--warning` (+ `-foreground`) | green and amber, AA as text | saved/live, pending/unpaid |
| `--border`, `--input` | `#2a2a2e` | borders |
| `--ring` | `#ff4d63` | visible focus ring |
| `--sidebar-*` | derived from the above | shadcn Sidebar |

- **Typography:**
  - Fonts are bundled with `next/font/local` and served from our own domain, with no CDN at build or at runtime. This keeps the reliability rule (`(app)/layout.tsx` comment).
  - **Barlow Condensed** (600/700) is the display face for headings and numbers, with `tabular-nums` on numbers. **Inter** (variable) is the body face. Both are OFL. The `.woff2` files are committed under `src/fonts/`, with their license files.
  - They are exposed as `--font-display` and `--font-sans`. The base size is 16px, and form inputs are never below 16px.
- **Sizes:** Button sizes are `sm`, `default`, `lg` and `touch`. `touch` is min-height 48px, and 64px for the live controls. Operator and athlete screens use `touch` for primary actions.
- **Icons:** `lucide-react` replaces the emojis in navigation.
- **Overlays:**
  - A separate `--broadcast-*` block holds the overlays' colors. It shares the brand palette and nothing else.
  - The overlays keep their components and do not use shadcn.

## 2. Components and global states

- **shadcn components installed now** (only what this sub-project uses):
  - Button, Input, Textarea, Label, Field, Select, Checkbox, Switch
  - Card, Badge, Table, Tabs, Separator, Avatar, Skeleton
  - Dialog, AlertDialog, Sheet, DropdownMenu, Tooltip
  - Sidebar, Breadcrumb
  - Sonner

  DataTable, Drawer, ToggleGroup and Command are added by the sub-projects that need them.
- **RepOne pieces** in `src/components/app/`:
  - **`ConfirmAction`:** a trigger that opens an AlertDialog naming the target and the consequence, then runs a server action. Its props are `{ title, description, confirmLabel, action, variant }`. It replaces every one-click delete/remove/refund/status change and every `window.confirm`.
  - **`PageHeader`:** title, description, actions and optional breadcrumb.
  - **`EmptyState`:** icon, message and one action.
  - **`FormMessage` / `useActionToast`:** report a server action's success or failure inline or as a toast.
- **Global states:**
  - Every shell renders `<main id="main">` and a "Skip to content" link.
  - A title template `"%s · RepOne"`. Every page sets `metadata` or `generateMetadata`.
  - `loading.tsx` with Skeletons in each area: admin, producer, dashboard, scorekeeper, commentator, athlete, live.
  - `error.tsx` per area, dark, with "Try again", and a dark `not-found.tsx` for `(app)`.
  - One `<Toaster />` in the `(app)` root layout.
  - A visible focus ring on every control. `outline-none` without a replacement focus style is not allowed.

## 3. Shells

All shells share a **module switcher and account menu**. They are built with DropdownMenu on the existing `userModules()` and replace the `<details>` AccountMenu, so they close on Escape and on an outside click. The shells live in `src/components/shells/` and are used by each area's `layout.tsx`. The existing guards (`requireModule`, the per-event checks) stay.

| Shell | Routes | Structure |
|---|---|---|
| **Admin** | `/admin/**` | shadcn **Sidebar**: collapsible to icons on desktop, a Sheet on mobile. See the details below the table. |
| **Operator** | `/producer/**`, `/dashboard/**`, `/scorekeeper/**`, `/commentator/**` | A compact top bar with the logo, the current module, the event name on event routes, event **Tabs** with an active state and `aria-current` (producer, commentator), and the switcher and account on the right. No sidebar. On mobile the tabs scroll horizontally. |
| **Athlete** | `/athlete/**` | A minimal header (logo, avatar menu) plus a **bottom tab bar** on mobile: Home, Athletes, Messages with an unread dot. On desktop it is a top bar. The name appears once. |
| **Live** | `/live/**` | A header with the logo and the YouTube link as the single CTA. "Sign in" moves to the footer. |
| **Auth** | `(auth)` | Unchanged structure (a centered card), rebuilt with Card, Field and Button. |
| **Start page** | `/` signed in | A Card grid with an icon and a distinct description per module. "Create my athlete profile" becomes a secondary Button. |
| **Overlays** | `/overlay/**` | No shell and no shadcn. Unchanged. |

**Admin sidebar details:**
- **Organization group:** Events, Circuits, Athletes, Check-In, Teams, Sponsors, **Members** (renamed from "Team"), and Messages with an unread badge.
- **Event group:** under `/admin/events/[eventId]` it shows Overview, Venues, Divisions, Athletes, WODs, Heats, Staff, Fees, Payments and Statement.
- **Breadcrumb** in the content header.
- **Footer:** the module switcher and the account menu.
- The five red module "pills" in the current header go away.

The admin shell adds `src/app/(app)/admin/events/[eventId]/layout.tsx`. It loads the event once for the event group and breadcrumb, which replaces the per-page event queries that exist only for back links.

## 4. Migration, tests and delivery

**Migration.** Every existing route, about 60, moves into its shell and onto the shared components:
- buttons, inputs, selects, checkboxes, cards, badges, alerts and empty states;
- every destructive action gets `ConfirmAction`;
- every page gets a title.

Each screen's content and arrangement stay as they are. At the end, `.control-btn`, `.control-btn-red`, `.control-btn-outline`, the copy-pasted input class strings, hard-coded status colors (`text-green-700`, `bg-red-50`, …) and the nav emojis are removed. Overlays only move their colors to `--broadcast-*`.

**Order.** Each step leaves the app working:
1. shadcn, theme, fonts and the base components;
2. RepOne pieces and global states;
3. admin shell and admin screens;
4. operator shell, then producer, dashboard, scorekeeper and commentator screens;
5. athlete shell, live, auth and the start page;
6. cleanup, plus the guard script.

**Tests:**
- `pnpm check` (lint, types, tests, format) and `pnpm build`.
- Unit tests:
  - `ConfirmAction`: the action runs only after confirming, and cancel leaves no side effect;
  - the module switcher's item list;
  - a **contrast test** that computes WCAG ratios for every text/background token pair and requires ≥ 4.5:1 (≥ 3:1 for large display text and UI borders/focus).
- A **guard script**, part of `pnpm check`, fails if `control-btn`, `window.confirm`, listed hard-coded color utilities, or `outline-none` without a focus-visible style reappear in `src/app` or `src/components` (overlays excluded).
- **Browser:** a `verify-repone` run per role at 1440 and 390, plus Lighthouse on one screen per area (accessibility ≥ 95, zero contrast failures).
- `/impeccable audit` at the end, compared with 11/20.
- The existing `db:*` checks keep passing; nothing touches the database.

**Delivery:**
- **PR:** `feat/design-system` → `staging`. If it grows too large, split it into one PR per order step.
- **Docs:** `PRODUCT.md` goes in with the first commit. At the end, `/impeccable document` writes **DESIGN.md** from the resulting system, so later sub-projects follow it.
