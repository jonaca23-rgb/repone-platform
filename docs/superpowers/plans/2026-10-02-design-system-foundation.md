# Design System Foundation and Shells — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the whole RepOne app one dark theme on shadcn/ui, with semantic AA tokens, bundled fonts and shared states, a shell per area, and every screen moved onto them. Screen content is not redesigned.

**Architecture:**
- **Tokens and theme:** shadcn/ui is installed with its CLI. Its CSS variables are re-valued as one dark RepOne theme in `:root` and feed Tailwind 4 through `@theme inline`.
- **Shared layers:** RepOne-specific pieces live in `src/components/app/`, and one shell per area lives in `src/components/shells/`. Each area's `layout.tsx` renders its shell.
- **Migration:** each area is migrated with one class-mapping table and proven done by a guard script (`scripts/ui-guard.ts`), scoped to that area's folders.
- **Overlays:** untouched apart from fonts and color tokens.

**Tech Stack:**
- Next.js 16.3 App Router, React 19.2, Tailwind 4
- shadcn/ui (CLI `shadcn@latest`) on Radix, `lucide-react`, `sonner`
- `next/font/local` (Barlow Condensed and Inter, OFL)
- vitest, plus `@testing-library/react` and `jsdom` for component tests

**Spec:** `docs/superpowers/specs/2026-10-02-design-system-foundation-design.md`. Read it first; `PRODUCT.md` is the product context. The visual reference is https://claude.ai/artifact/SBCQo9pD1BSndXQFrAz3ge (static mockup).

## Global Constraints

- **Branch:** `feat/design-system` (from `staging`). It ends in one PR against `staging`.
- **Theme:** one dark theme only. Dark values go in `:root`: no `.dark` class, no theme switcher, no `next-themes`.
- **Token values** (starting values; the contrast test is the arbiter):
  - `--background` #0a0a0a
  - `--card` and `--popover` #161618
  - `--muted`, `--secondary` and `--accent` #1f1f22
  - `--foreground` #fafafa
  - `--muted-foreground` #a1a1aa
  - `--primary` #e0122f, with `--primary-foreground` #ffffff
  - `--brand-text` #ff4d63
  - `--destructive` #f04438
  - `--success` #22c55e with `--success-text` #4ade80
  - `--warning` #f59e0b with `--warning-text` #fbbf24
  - `--border` and `--input` #2a2a2e
  - `--ring` #ff4d63
- **Contrast:** text pairs must be ≥ 4.5:1. Large display text and UI borders or focus must be ≥ 3:1.
- **Fonts:**
  - Bundled with `next/font/local` from `src/fonts/`, with no CDN at build or runtime.
  - **Barlow Condensed** 600/700 is `--font-display`. **Inter** variable is `--font-sans`.
  - The OFL license files are committed next to the fonts.
- **Sizes:**
  - The base font is 16px, and form inputs are never below 16px (`text-base`).
  - Button sizes are `sm`, `default`, `lg` and `touch`. `touch` is min-height 48px, and 64px for live controls.
  - Touch targets on operator and athlete screens are ≥ 44px.
- **Icons:** `lucide-react`. No emojis in navigation.
- **Overlays** (`src/app/(overlay)/**`, `src/components/graphics/**`): no shadcn and no shells. They only get the fonts and the `--broadcast-*` color tokens.
- **No database, auth or permission changes.** The guards `requireModule` and the per-event checks stay as they are.
- **UI copy** is in English. "Team" (org members) is renamed to **"Members"** in the UI only; the route `/admin/team` stays.
- **Every commit:**
  - `pnpm check` passes. It already runs lint, typecheck, tests and the format check.
  - Stage files by name.
  - The title is a plain sentence, with a body explaining why.
  - The message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Next 16:** APIs differ from older training data. Check `node_modules/next/dist/docs/` for metadata title templates, `loading.tsx`, `error.tsx` and `not-found.tsx` before using them (AGENTS.md).

## Review Focus

1. **A screen half-migrated mid-plan.** Dark-themed components inside the still-light admin area produce dark text on dark backgrounds, or the reverse. Every task must leave its own area fully readable. Areas not yet migrated keep their current look. *Test:* each area task ends with the scoped guard passing, plus a 1440/390 screenshot check of that area (Tasks 4-8).
2. **Destructive actions submitted by Enter or by a script, bypassing the dialog.** `ConfirmAction` must be the only path to the action. No `<form action={remove}>` wrapper may remain around a delete button. *Test:* Task 2's `ConfirmAction` tests (cancel never calls; confirm calls exactly once, including on a double click) and the guard rule against `confirm(`.
3. **Forms losing values or submit names after moving to shadcn Select, Checkbox or Switch.** Radix controls only post a value when given `name`. A migrated form must still post every field a server action reads. *Test:* Tasks 4-8 each run their area's existing db check, or submit one form in the browser and confirm the saved value.
4. **Keyboard use.** The sidebar, DropdownMenus, Dialogs and Tabs must be reachable and operable by keyboard, with a visible focus ring. The account menu must close on Escape. *Test:* the Task 3 `ModuleMenu` test (opens, lists modules, closes on Escape), and the Task 9 Lighthouse accessibility ≥ 95 per area.
5. **Contrast regressions from opacity utilities** (`text-white/40`, `text-foreground/50`), which compute below AA on dark. *Test:* the guard rule bans `text-(white|black|foreground)/[1-5]0`, and the Task 1 contrast test covers the token pairs.

---

## File Structure

| File | Responsibility |
|---|---|
| `components.json`, `src/lib/utils.ts` (new, from the shadcn CLI) | shadcn config, `cn()` |
| `src/app/globals.css` (rewrite) | brand palette, semantic tokens, `@theme inline`, broadcast tokens, base layer |
| `src/fonts/*.woff2`, `src/fonts/OFL-*.txt`, `src/app/fonts.ts` (new) | bundled fonts and their `next/font/local` definitions |
| `src/lib/design/contrast.ts` + `.test.ts` (new) | WCAG contrast math and the token-pair test reading `globals.css` |
| `src/components/ui/*` (new, from the CLI) | shadcn components |
| `scripts/ui-guard.ts` + `src/lib/design/uiGuard.ts` + `.test.ts` (new) | rules that fail on old patterns, with a path scope |
| `src/components/app/ConfirmAction.tsx` + `.test.tsx` | AlertDialog-guarded action |
| `src/components/app/PageHeader.tsx`, `EmptyState.tsx`, `useActionToast.ts`, `SkipLink.tsx` | shared page pieces |
| `src/components/app/ModuleMenu.tsx` + `moduleMenuItems.ts` + tests | module switcher and account menu (replaces `AccountMenu.tsx`) |
| `src/components/shells/AdminShell.tsx`, `AdminSidebar.tsx` | admin sidebar shell |
| `src/components/shells/OperatorShell.tsx`, `EventTabs.tsx` | operator top bar and event tabs |
| `src/components/shells/AthleteShell.tsx`, `AthleteBottomNav.tsx` | athlete header and bottom nav |
| `src/components/shells/PublicShell.tsx` | live (public) header and footer |
| `src/app/(app)/admin/events/[eventId]/layout.tsx` (new) | loads the event once for the sidebar's Event group and the breadcrumb |
| `loading.tsx` / `error.tsx` per area, `(app)/not-found.tsx` | global states |

---

### Task 1: shadcn, tokens, fonts and contrast test

**Files:**
- Create: `components.json`, `src/lib/utils.ts`, `src/components/ui/*`, `src/fonts/*`, `src/app/fonts.ts`, `src/lib/design/contrast.ts`, `src/lib/design/contrast.test.ts`
- Modify: `src/app/globals.css`, `src/app/(app)/layout.tsx`, `src/app/(auth)/layout.tsx`, `src/app/(overlay)/layout.tsx`, `package.json`, `vitest.config.mts`

**Interfaces:**
- Produces:
  - `cn(...inputs)` from `@/lib/utils`
  - `@/components/ui/{button,input,textarea,label,field,select,checkbox,switch,card,badge,table,tabs,separator,avatar,skeleton,dialog,alert-dialog,sheet,dropdown-menu,tooltip,sidebar,breadcrumb,sonner}`
  - Button `size` includes `"touch"`
  - Tailwind colors `background, foreground, card, muted, muted-foreground, primary, brand-text, destructive, success, success-text, warning, warning-text, border, input, ring`
  - `font-display`, `font-sans`
  - `fontVariables` (string of the two font CSS variable classes) from `@/app/fonts`
  - `contrastRatio(hexA, hexB): number`

- [ ] **Step 1: Branch check.** Run `git branch --show-current`. It must print `feat/design-system`.

- [ ] **Step 2: Write the failing contrast test** `src/lib/design/contrast.test.ts`

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, rootTokens } from "./contrast";

const tokens = rootTokens(readFileSync("src/app/globals.css", "utf8"));

describe("contrastRatio", () => {
  it("matches WCAG reference values", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });
});

describe("theme tokens meet WCAG AA", () => {
  const text: Array<[string, string]> = [
    ["--foreground", "--background"],
    ["--foreground", "--card"],
    ["--muted-foreground", "--background"],
    ["--muted-foreground", "--card"],
    ["--muted-foreground", "--muted"],
    ["--brand-text", "--background"],
    ["--brand-text", "--card"],
    ["--primary-foreground", "--primary"],
    ["--destructive", "--card"],
    ["--success-text", "--card"],
    ["--warning-text", "--card"],
  ];
  it.each(text)("%s on %s is at least 4.5:1", (fg, bg) => {
    expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it("the focus ring is at least 3:1 against the page", () => {
    expect(contrastRatio(tokens["--ring"], tokens["--background"])).toBeGreaterThanOrEqual(3);
  });
});
```

  Also set `include: ["src/**/*.test.ts", "src/**/*.test.tsx"]` in `vitest.config.mts`.

- [ ] **Step 3: Run it and confirm it fails.** Run `pnpm vitest run src/lib/design/contrast.test.ts`. Expected: FAIL, because `./contrast` doesn't exist.

- [ ] **Step 4: Implement** `src/lib/design/contrast.ts`

```ts
/** WCAG 2.x relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The `--name: #rrggbb;` declarations of the first `:root { … }` block, so the
 * contrast test reads the real theme instead of a copy that can drift.
 */
export function rootTokens(css: string): Record<string, string> {
  const block = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2].toLowerCase();
  return out;
}
```

- [ ] **Step 5: Install shadcn.**

  Run `pnpm dlx shadcn@latest init`. Accept the Tailwind 4 / New York defaults, with base color neutral, CSS variables yes, and the aliases `@/components`, `@/components/ui`, `@/lib/utils`. It creates `components.json` and `src/lib/utils.ts`, adds dependencies (`tailwind-merge`, `class-variance-authority`, `tw-animate-css`, `lucide-react`), and rewrites `globals.css`. If it asks about the React 19 peer flag, choose `--legacy-peer-deps` only when pnpm refuses.

  Then add the components:

  ```bash
  pnpm dlx shadcn@latest add button input textarea label field select checkbox switch card badge table tabs separator avatar skeleton dialog alert-dialog sheet dropdown-menu tooltip sidebar breadcrumb sonner
  ```

  If `field` isn't in the registry for this CLI version, skip it and use `label` + `input` (note it in the report).

- [ ] **Step 6: Theme `globals.css`.** Replace the CLI's `:root` and `.dark` blocks.
  - Keep its `@import "tailwindcss"`, `@import "tw-animate-css"` and `@custom-variant` lines.
  - Delete the `.dark { … }` block entirely.
  - Make the **first** `:root` block exactly:

```css
:root {
  /* RepOne brand palette — the source the semantic tokens map onto. */
  --repone-black: #0a0a0a;
  --repone-white: #ffffff;
  --repone-red: #e0122f;
  --repone-red-dark: #a80d24;
  --repone-gray: #1c1c1e;
  --repone-gray-light: #6b6b6f;

  /* One dark theme (PRODUCT.md). Values checked by src/lib/design/contrast.test.ts. */
  --background: #0a0a0a;
  --foreground: #fafafa;
  --card: #161618;
  --card-foreground: #fafafa;
  --popover: #161618;
  --popover-foreground: #fafafa;
  --primary: #e0122f;
  --primary-foreground: #ffffff;
  --secondary: #1f1f22;
  --secondary-foreground: #fafafa;
  --muted: #1f1f22;
  --muted-foreground: #a1a1aa;
  --accent: #1f1f22;
  --accent-foreground: #fafafa;
  --destructive: #f04438;
  --brand-text: #ff4d63;
  --success: #22c55e;
  --success-text: #4ade80;
  --warning: #f59e0b;
  --warning-text: #fbbf24;
  --border: #2a2a2e;
  --input: #2a2a2e;
  --ring: #ff4d63;
  --radius: 0.625rem;
  --sidebar: #161618;
  --sidebar-foreground: #fafafa;
  --sidebar-primary: #e0122f;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #1f1f22;
  --sidebar-accent-foreground: #fafafa;
  --sidebar-border: #2a2a2e;
  --sidebar-ring: #ff4d63;

  /* Broadcast overlays share only the palette (no shadcn there). */
  --broadcast-bg: #0a0a0a;
  --broadcast-fg: #ffffff;
  --broadcast-accent: #e0122f;
  --broadcast-muted: #1c1c1e;
  color-scheme: dark;
}
```

  In the CLI's `@theme inline` block:
  - Keep every `--color-*: var(--*)` mapping it generated.
  - Add `--color-brand-text`, `--color-success`, `--color-success-text`, `--color-warning`, `--color-warning-text`, the `--color-repone-*` six and the `--color-broadcast-*` four.
  - Set `--font-sans: var(--font-inter), system-ui, sans-serif;` and `--font-display: var(--font-barlow), "Arial Narrow", Arial, sans-serif;`.

  Keep the existing `.control-btn*` rules and `.overlay-transparent` for now; Task 9 deletes them. The `@layer base` `body` rule keeps working as today. Do **not** change `(app)` area colors in this task (Review Focus 1).

- [ ] **Step 7: Fonts.**
  - Run `pnpm add -D @fontsource/barlow-condensed @fontsource-variable/inter`.
  - Copy `node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2`, `…-700-normal.woff2` and `node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2` into `src/fonts/`.
  - Copy each package's `LICENSE` to `src/fonts/OFL-BarlowCondensed.txt` and `src/fonts/OFL-Inter.txt`.
  - Then `pnpm remove @fontsource/barlow-condensed @fontsource-variable/inter`.
  - Create `src/app/fonts.ts`:

```ts
import localFont from "next/font/local";

// Bundled and served from our own origin: no font CDN at build or runtime
// (broadcast reliability). Barlow Condensed for display and numbers, Inter for text.
export const barlow = localFont({
  src: [
    { path: "../fonts/barlow-condensed-latin-600-normal.woff2", weight: "600" },
    { path: "../fonts/barlow-condensed-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-barlow",
  display: "swap",
});

export const inter = localFont({
  src: "../fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  display: "swap",
});

export const fontVariables = `${barlow.variable} ${inter.variable}`;
```

  Add `className={fontVariables}` (merged with the existing classes) to the `<html>` of `(app)/layout.tsx`, `(auth)/layout.tsx` and `(overlay)/layout.tsx`. In `(app)/layout.tsx`, delete the comment that says no fonts are loaded and replace it with one line pointing at `src/app/fonts.ts`.

- [ ] **Step 8: Button `touch` size.** In `src/components/ui/button.tsx`, add to the `size` variants: `touch: "min-h-12 px-6 text-base uppercase tracking-wide"`.

- [ ] **Step 9: Sonner without next-themes.** In `src/components/ui/sonner.tsx`, remove the `useTheme` import and usage and pass `theme="dark"`. Then run `pnpm remove next-themes` if the CLI added it.

- [ ] **Step 10: Run.** Run `pnpm vitest run src/lib/design/contrast.test.ts`; expect PASS. If a pair fails, adjust only that token's value and re-run. Then run `pnpm check && pnpm build`.

  With `pnpm dev`, open `/admin`, `/producer`, `/login` and `/overlay/<floor>/timer`. Every area must look as before, except that the fonts are now Barlow and Inter. Overlays must stay transparent.

- [ ] **Step 11: Commit.** Use the title "shadcn, the dark RepOne tokens and bundled fonts are in place". Stage `components.json`, `src/lib/utils.ts`, `src/components/ui`, `src/fonts`, `src/app/fonts.ts`, `src/lib/design/contrast.*`, `src/app/globals.css`, the three root layouts, `vitest.config.mts`, `package.json` and `pnpm-lock.yaml`.

### Task 2: Shared pieces, the guard, and global states

**Files:**
- Create:
  - `src/components/app/ConfirmAction.tsx` + `.test.tsx`
  - `src/components/app/PageHeader.tsx`, `EmptyState.tsx`, `SkipLink.tsx`, `useActionToast.ts`
  - `src/lib/design/uiGuard.ts` + `.test.ts`, `scripts/ui-guard.ts`
- Modify: `src/app/(app)/layout.tsx` (Toaster, title template), `src/app/(app)/not-found.tsx`, `src/app/(app)/error.tsx`, `package.json` (`ui:guard` script), `vitest.config.mts`

**Interfaces:**
- Consumes: `cn`, `@/components/ui/{alert-dialog,button,sonner}` (Task 1).
- Produces:

```ts
// ConfirmAction.tsx (client)
export function ConfirmAction(props: {
  trigger: React.ReactNode;           // label inside the trigger Button
  title: string;                      // "Remove Heat 3?"
  description: string;                // what happens, plainly
  confirmLabel: string;               // "Remove heat"
  onConfirm: () => Promise<unknown>;  // the server action, bound
  variant?: "destructive" | "default";
  triggerVariant?: "destructive" | "ghost" | "outline" | "link";
  triggerSize?: "sm" | "default" | "touch";
}): React.JSX.Element;
// PageHeader.tsx
export function PageHeader(props: { title: string; description?: string; actions?: React.ReactNode; breadcrumb?: React.ReactNode }): React.JSX.Element;
// EmptyState.tsx
export function EmptyState(props: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode }): React.JSX.Element;
// SkipLink.tsx
export function SkipLink(): React.JSX.Element; // href="#main"
// useActionToast.ts (client)
export function useActionToast(): (label: string, action: () => Promise<unknown>) => Promise<void>; // toast.success(label) or toast.error(message)
// uiGuard.ts
export interface GuardViolation { file: string; line: number; rule: string; text: string }
export const GUARD_RULES: Array<{ id: string; pattern: RegExp; message: string }>;
export function checkSource(file: string, source: string): GuardViolation[];
```

- [ ] **Step 1: Test dependencies.** Run `pnpm add -D @testing-library/react @testing-library/user-event jsdom`. Component tests opt into jsdom with a first-line comment `// @vitest-environment jsdom`.

- [ ] **Step 2: Write the failing tests.**

  `src/components/app/ConfirmAction.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmAction } from "./ConfirmAction";

function setup() {
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  render(
    <ConfirmAction
      trigger="Remove"
      title="Remove Heat 3?"
      description="Its lanes and results are deleted."
      confirmLabel="Remove heat"
      onConfirm={onConfirm}
    />,
  );
  return { onConfirm, user: userEvent.setup() };
}

describe("ConfirmAction", () => {
  it("does nothing until confirmed", async () => {
    const { onConfirm, user } = setup();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Its lanes and results are deleted.")).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("cancel closes without running the action", async () => {
    const { onConfirm, user } = setup();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("confirm runs the action exactly once, even on a double click", async () => {
    const { onConfirm, user } = setup();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.dblClick(screen.getByRole("button", { name: "Remove heat" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
```

  `src/lib/design/uiGuard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkSource } from "./uiGuard";

const rules = (src: string) => checkSource("x.tsx", src).map((v) => v.rule);

describe("ui guard", () => {
  it("flags the old button and confirm patterns", () => {
    expect(rules(`<button className="control-btn control-btn-red">`)).toContain("control-btn");
    expect(rules(`if (!window.confirm("Delete?")) return;`)).toContain("confirm");
  });
  it("flags light-theme and hard-coded status colours", () => {
    expect(rules(`<p className="text-black/50">`)).toContain("light-colour");
    expect(rules(`<div className="bg-repone-white">`)).toContain("light-colour");
    expect(rules(`<span className="text-green-700">`)).toContain("status-colour");
  });
  it("flags dimmed text that fails AA", () => {
    expect(rules(`<p className="text-white/40">`)).toContain("dim-text");
    expect(rules(`<p className="text-foreground/50">`)).toContain("dim-text");
    expect(rules(`<p className="text-white/80">`)).not.toContain("dim-text");
  });
  it("flags raw form controls outside components/ui, except hidden inputs", () => {
    expect(rules(`<select name="x">`)).toContain("raw-control");
    expect(rules(`<input name="email" />`)).toContain("raw-control");
    expect(rules(`<input type="hidden" name="id" value={id} />`)).not.toContain("raw-control");
  });
  it("flags outline-none without a focus-visible style, and nav emojis", () => {
    expect(rules(`className="outline-none border"`)).toContain("focus");
    expect(rules(`className="outline-none focus-visible:ring-2"`)).not.toContain("focus");
    expect(rules(`<Link>🏠 Home</Link>`)).toContain("emoji");
  });
  it("passes clean shadcn code", () => {
    expect(rules(`<Button variant="destructive" size="touch">Save</Button>`)).toEqual([]);
  });
});
```

  Run `pnpm vitest run src/components/app src/lib/design/uiGuard.test.ts`. Expected: FAIL, because the modules don't exist.

- [ ] **Step 3: Implement the guard** `src/lib/design/uiGuard.ts`

```ts
export interface GuardViolation { file: string; line: number; rule: string; text: string }

/**
 * Patterns the design system replaced (docs/superpowers/specs/
 * 2026-10-02-design-system-foundation-design.md §4). Overlays and
 * components/graphics are out of scope; components/ui is shadcn's own code.
 */
export const GUARD_RULES = [
  { id: "control-btn", pattern: /\bcontrol-btn\b/, message: "Use <Button> (size=\"touch\" for live controls)." },
  { id: "confirm", pattern: /\b(?:window\.)?confirm\(/, message: "Use <ConfirmAction>." },
  { id: "light-colour", pattern: /\b(?:text|bg|border)-(?:black|white)(?:\/\d+)?\b(?![\w-])|\bbg-repone-white\b|\btext-repone-black\b/, message: "Use theme tokens (foreground, card, border, muted-foreground…)." },
  { id: "status-colour", pattern: /\b(?:text|bg|border)-(?:green|red|amber|yellow|blue|emerald|orange)-\d{2,3}\b/, message: "Use success / warning / destructive / brand-text tokens." },
  { id: "dim-text", pattern: /\btext-(?:white|black|foreground)\/[1-5]0\b/, message: "Below AA on dark: use text-muted-foreground." },
  { id: "raw-control", pattern: /<(?:select|textarea)\b|<input\b(?![^>]*type=["']hidden["'])/, message: "Use the shadcn Input/Select/Textarea/Checkbox/Switch." },
  { id: "focus", pattern: /\boutline-none\b(?![^"'`]*focus-visible:)/, message: "Keep a visible focus style (focus-visible:ring…)." },
  { id: "emoji", pattern: /[\u{1F300}-\u{1FAFF}]/u, message: "Use a lucide-react icon." },
] as const;

export function checkSource(file: string, source: string): GuardViolation[] {
  const out: GuardViolation[] = [];
  source.split("\n").forEach((text, i) => {
    for (const r of GUARD_RULES) if (r.pattern.test(text)) out.push({ file, line: i + 1, rule: r.id, text: text.trim() });
  });
  return out;
}
```

  `bg-white` must stay allowed where it is legitimately white: the check-in QR background in `athlete/page.tsx`, and sponsor logos on white. Mark those lines with an inline `// ui-guard-ignore: <reason>` comment. Make `checkSource` skip any line containing `ui-guard-ignore` and the line right after such a comment line.

  The script `scripts/ui-guard.ts`:

```ts
// Fails when a design-system-replaced pattern reappears (pnpm ui:guard [paths…]).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { checkSource, GUARD_RULES } from "../src/lib/design/uiGuard";

const SKIP = ["src/components/ui", "src/components/graphics", "src/app/(overlay)"];
const roots = process.argv.slice(2).length ? process.argv.slice(2) : ["src/app", "src/components"];

function* files(p: string): Generator<string> {
  if (SKIP.some((s) => p.startsWith(s))) return;
  if (statSync(p).isDirectory()) for (const f of readdirSync(p)) yield* files(join(p, f));
  else if (/\.(tsx|ts)$/.test(p) && !/\.test\.tsx?$/.test(p)) yield p;
}

const violations = roots.flatMap((r) => [...files(r)].flatMap((f) => checkSource(f, readFileSync(f, "utf8"))));
const message = Object.fromEntries(GUARD_RULES.map((r) => [r.id, r.message]));
for (const v of violations) console.log(`${v.file}:${v.line}  [${v.rule}] ${message[v.rule]}\n    ${v.text}`);
console.log(violations.length ? `\n${violations.length} violation(s).` : "ui-guard: clean");
process.exit(violations.length ? 1 : 0);
```

  Add the `package.json` script `"ui:guard": "tsx scripts/ui-guard.ts"`. Do **not** add it to `check` yet (Task 9).

- [ ] **Step 4: Implement `ConfirmAction`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * The only way to run a destructive or hard-to-undo action: it names what is
 * affected and what happens, and runs the action once, after the person
 * confirms. Failures surface as a toast; the dialog stays open to retry.
 */
export function ConfirmAction({
  trigger, title, description, confirmLabel, onConfirm,
  variant = "destructive", triggerVariant = "ghost", triggerSize = "sm",
}: {
  trigger: React.ReactNode; title: string; description: string; confirmLabel: string;
  onConfirm: () => Promise<unknown>; variant?: "destructive" | "default";
  triggerVariant?: "destructive" | "ghost" | "outline" | "link"; triggerSize?: "sm" | "default" | "touch";
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirm(e: React.MouseEvent) {
    e.preventDefault(); // keep the dialog open until the action settles
    if (pending) return;
    start(async () => {
      try {
        await onConfirm();
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That didn't go through. Try again.");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant={triggerVariant} size={triggerSize}>{trigger}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            disabled={pending}
            className={variant === "destructive" ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
          >
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

  A double click runs the action once, because the second click lands while `pending` is true. If the test still sees 2 calls, add a `useRef` "in flight" flag set synchronously before `start`.

- [ ] **Step 5: The other pieces.**

```tsx
// src/components/app/PageHeader.tsx
export function PageHeader({ title, description, actions, breadcrumb }: {
  title: string; description?: string; actions?: React.ReactNode; breadcrumb?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {breadcrumb}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-balance">{title}</h1>
          {description ? <p className="mt-1 max-w-prose text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
```

```tsx
// src/components/app/EmptyState.tsx
import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, description, action }: {
  icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      {Icon ? <Icon className="size-8 text-muted-foreground" aria-hidden /> : null}
      <p className="font-semibold">{title}</p>
      {description ? <p className="max-w-prose text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}
```

```tsx
// src/components/app/SkipLink.tsx
export function SkipLink() {
  return (
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
      Skip to content
    </a>
  );
}
```

```ts
// src/components/app/useActionToast.ts
"use client";
import { toast } from "sonner";

/** Runs a server action and reports it: "Saved." on success, the error otherwise. */
export function useActionToast() {
  return async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
      toast.success(label);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't go through. Try again.");
    }
  };
}
```

- [ ] **Step 6: Global states in `(app)`.**
  - **`(app)/layout.tsx`:**
    - Set the metadata title to `{ default: "RepOne", template: "%s · RepOne" }`.
    - Render `<Toaster />` (from `@/components/ui/sonner`) at the end of `<body>`.
  - **`(app)/not-found.tsx`:** rewrite it dark, centered, with `EmptyState` (icon `SearchX`, title "Page not found", description "It may have moved or you may not have access.", action a `Button asChild` linking to `/`).
  - **`(app)/error.tsx`:**
    - Replace `control-btn` and `text-black/*` with `Button` and `text-muted-foreground`.
    - Wrap it in a `bg-background text-foreground min-h-screen` container, so it reads on any area.
  - **`(overlay)/error.tsx`:** keep it as is.

- [ ] **Step 7: Run.** Run `pnpm vitest run src/components/app src/lib/design` and expect PASS. Then `pnpm ui:guard src/components/app` must print `ui-guard: clean`, and `pnpm check` must pass.

- [ ] **Step 8: Commit.** Use the title "A confirm dialog, page header, empty state, toasts and a guard against the old UI patterns exist".

### Task 3: The module and account menu

**Files:**
- Create: `src/components/app/ModuleMenu.tsx`, `src/components/app/moduleMenuItems.ts` + `.test.ts`, `src/components/app/ModuleMenu.test.tsx`
- Delete: `src/components/AccountMenu.tsx`, after replacing its users (layouts) in Tasks 4-7. Until then, keep it.

**Interfaces:**
- Consumes: `Module`, `ModuleKind` from `@/lib/auth/modules`; `userModules()` from `@/lib/auth/userModules`; `getAuthSession()`; `signOut` from `@/lib/auth/actions`; `leaveAfterIdentityChange` from `@/lib/auth/identityChange`.
- Produces:

```ts
// moduleMenuItems.ts (pure)
export interface MenuItem { href: string; label: string; detail?: string; icon: ModuleKind | "home"; current: boolean }
export function moduleMenuItems(modules: Module[], currentKind: ModuleKind | null): MenuItem[]; // Home first, then modules in order; current marked
// ModuleMenu.tsx
export async function ModuleMenu(props: { current: ModuleKind | null; align?: "start" | "end"; side?: "top" | "bottom" }): Promise<React.JSX.Element | null>; // server: loads session + modules
export function ModuleMenuView(props: { name: string; email: string; items: MenuItem[]; align?: "start" | "end"; side?: "top" | "bottom" }): React.JSX.Element; // client
```

- [ ] **Step 1: Write the failing tests.**

```ts
// moduleMenuItems.test.ts
import { describe, expect, it } from "vitest";
import { moduleMenuItems } from "./moduleMenuItems";

const modules = [
  { kind: "admin", href: "/admin", label: "Admin", detail: "RepOneLive" },
  { kind: "scorekeeper", href: "/scorekeeper", label: "Scorekeeper", detail: "Aprieta" },
] as const;

describe("moduleMenuItems", () => {
  it("lists Home first, then every module, marking the current one", () => {
    const items = moduleMenuItems([...modules], "scorekeeper");
    expect(items.map((i) => i.label)).toEqual(["Home", "Admin", "Scorekeeper"]);
    expect(items.filter((i) => i.current).map((i) => i.label)).toEqual(["Scorekeeper"]);
  });
  it("with no current module nothing is marked", () => {
    expect(moduleMenuItems([...modules], null).some((i) => i.current)).toBe(false);
  });
});
```

```tsx
// ModuleMenu.test.tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ModuleMenuView } from "./ModuleMenu";

describe("ModuleMenuView", () => {
  it("opens, lists modules with the current one marked, and closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <ModuleMenuView
        name="Ada Admin"
        email="admin@repone.test"
        items={[
          { href: "/", label: "Home", icon: "home", current: false },
          { href: "/admin", label: "Admin", detail: "RepOneLive", icon: "admin", current: true },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Ada Admin/ }));
    expect(screen.getByRole("menuitem", { name: /Admin/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("menuitem", { name: /Sign out/ })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
```

  Run `pnpm vitest run src/components/app/moduleMenuItems.test.ts src/components/app/ModuleMenu.test.tsx`. Expected: FAIL.

- [ ] **Step 2: Implement.**

```ts
// moduleMenuItems.ts
import type { Module, ModuleKind } from "@/lib/auth/modules";

export interface MenuItem { href: string; label: string; detail?: string; icon: ModuleKind | "home"; current: boolean }

/** Home, then the person's modules (lib/auth/modules order), the current one marked. */
export function moduleMenuItems(modules: Module[], currentKind: ModuleKind | null): MenuItem[] {
  return [
    { href: "/", label: "Home", icon: "home", current: false },
    ...modules.map((m) => ({ href: m.href, label: m.label, detail: m.detail, icon: m.kind, current: m.kind === currentKind })),
  ];
}
```

```tsx
// ModuleMenu.tsx
import { getAuthSession } from "@/lib/auth/session";
import { userModules } from "@/lib/auth/userModules";
import type { ModuleKind } from "@/lib/auth/modules";
import { moduleMenuItems } from "./moduleMenuItems";
import { ModuleMenuView } from "./ModuleMenuView";

/** Module switcher + account menu, shared by every shell. */
export async function ModuleMenu({ current, align = "end", side = "bottom" }: {
  current: ModuleKind | null; align?: "start" | "end"; side?: "top" | "bottom";
}) {
  const [session, modules] = await Promise.all([getAuthSession(), userModules()]);
  if (!session) return null;
  return (
    <ModuleMenuView name={session.name || session.email} email={session.email}
      items={moduleMenuItems(modules, current)} align={align} side={side} />
  );
}
export { ModuleMenuView } from "./ModuleMenuView";
```

  Create `src/components/app/ModuleMenuView.tsx` (client):
  - **Trigger:** a `Button` with variant ghost and size default, containing an `Avatar` with the initials and the name, plus `ChevronDown`.
  - **Content:** a `DropdownMenu` with a `DropdownMenuLabel` (name and email), then one `DropdownMenuItem asChild` per item, each wrapping a `Link`.
    - Set `aria-current="page"` when `current`.
    - Icons: `House`, `LayoutDashboard` (admin), `Radio` (producer), `ClipboardList` (scorekeeper), `Mic` (commentator), `User` (athlete).
    - Show the detail as muted small text.
  - **Footer:** a `DropdownMenuSeparator`, then a "Sign out" item. It runs `await signOut()` and then `leaveAfterIdentityChange("/login")`, the same as `SignOutButton` today.

  Point the test's import at `./ModuleMenuView`, or keep the re-export above. Either way, the test imports `ModuleMenuView` from `./ModuleMenu`.

- [ ] **Step 3: Run.** The tests above PASS, `pnpm ui:guard src/components/app` is clean, and `pnpm check` passes.

- [ ] **Step 4: Commit.** Use the title "One module and account menu replaces the details dropdown".

### Migration rules (used by Tasks 4-8)

Apply these to every file in the task's area. The task is done when `pnpm ui:guard <area paths>` prints `ui-guard: clean` and the area looks right at 1440 and 390.

| Old | New |
|---|---|
| `<button className="control-btn …">`, `rounded-md bg-repone-red …` buttons, `.control-btn-outline` | `<Button>` (`variant` default/outline/ghost/destructive/secondary; `size="touch"` for live controls and primary phone actions; `asChild` with `<Link>` for links styled as buttons) |
| delete / remove / refund / status-change buttons (one click), `window.confirm(...)` | `<ConfirmAction trigger=… title="Remove Heat 3?" description="…what happens…" confirmLabel="Remove heat" onConfirm={action.bind(null, …)} />`. Remove any `<form action={…}>` that wrapped the old button (Review Focus 2). |
| `<input …>` (text, number, email, date, file, tel) | `<Input …>`, same `name`, `defaultValue`, `required`, `inputMode` (plus `className="text-base"` if any override shrinks it) |
| `<textarea>` | `<Textarea>` |
| `<select name="x" defaultValue=…>` + `<option>` | shadcn `<Select name="x" defaultValue=…>` + `SelectTrigger` / `SelectValue` / `SelectContent` / `SelectItem`. **`name` is required** so the form still posts it (Review Focus 3). Keep the empty "none" option as an item value `"__none"` and map it back in the server action if that action reads `""`; otherwise keep a native `<select>` for that one control with `// ui-guard-ignore: posts "" for none`. |
| `<input type="checkbox" name=…>` | `<Checkbox name=… defaultChecked=…>`; use `<Switch>` for on/off settings (active, capped) |
| labels as `<label className="flex flex-col…">Text <input/></label>` | `<div className="grid gap-2"><Label htmlFor=id>Text</Label><Input id=id …/></div>` (or `Field` if installed) |
| bordered/filled boxes (`rounded-xl bg-repone-gray`, `rounded-lg border border-black/10`) | `<Card>` (`CardHeader`/`CardTitle`/`CardContent`) |
| status pills (paid, live, pending…) | `<Badge>` with `className` from tokens: success → `border-success/40 bg-success/10 text-success-text`, warning → `border-warning/40 bg-warning/10 text-warning-text` |
| `text-black/NN`, `text-white/40-60` | `text-muted-foreground`; `text-black`/`text-white` → `text-foreground` |
| `bg-white`, `bg-repone-white`, `bg-black/40` inputs | `bg-card` / `bg-background` (inputs come styled) |
| `border-black/10`, `border-white/10` | `border-border` |
| `text-repone-red` on text | `text-brand-text` (fills stay `bg-primary`) |
| `text-green-*`, `text-amber-*`, `bg-red-50`… | `text-success-text`, `text-warning-text`, `bg-destructive/10 text-destructive` |
| page `<h1>` + intro paragraph + header buttons | `<PageHeader title description actions />` |
| bare "No X yet" text | `<EmptyState icon=… title=… description=… action=… />` |
| tables built from `div` rows of label/value | leave the structure as is (redesign is sub-project 4+); only restyle with tokens |
| emoji in nav | lucide icon |

Every page also gets `export const metadata = { title: "<Page name>" }`, or `generateMetadata` when the title depends on data (event name, athlete name).

### Task 4: Admin shell and admin pages

**Files:**
- Create: `src/components/shells/AdminShell.tsx`, `src/components/shells/AdminSidebar.tsx`, `src/app/(app)/admin/events/[eventId]/layout.tsx`, `src/app/(app)/admin/loading.tsx`, `src/app/(app)/admin/error.tsx`
- Modify: `src/app/(app)/admin/layout.tsx` and every `page.tsx`/component under `src/app/(app)/admin/**` (21 files use old patterns today), plus `src/components/MessagesNavLink.tsx` if the sidebar uses it.

**Interfaces:**
- Consumes: `ModuleMenu` (Task 3); `PageHeader`, `ConfirmAction`, `EmptyState` (Task 2); `requireModule`, `getSessionContext`, `orgCan`, `getUnreadCount` (existing).
- Produces:

```tsx
export function AdminShell(props: { unreadCount: number; canManageMembers: boolean; children: React.ReactNode }): React.JSX.Element;
// AdminSidebar (client): reads usePathname() to mark the active item and to show the Event group when the path is /admin/events/[eventId]/…
export function AdminSidebar(props: { unreadCount: number; canManageMembers: boolean; event: { id: string; name: string } | null; menu: React.ReactNode }): React.JSX.Element;
```

- [ ] **Step 1: Failing guard.** Run `pnpm ui:guard "src/app/(app)/admin"`. Expected: a list of violations (record the count in the report).

- [ ] **Step 2: Shell.**
  - `AdminShell` renders `SidebarProvider` → `AdminSidebar` → `SidebarInset`, all wrapped in a container with `bg-background text-foreground min-h-screen` (this area turns dark here, Review Focus 1).
  - Inside `SidebarInset`:
    - a top bar (`SidebarTrigger`, a `Separator`, then a slot the pages fill with a Breadcrumb through `PageHeader`);
    - `<main id="main" className="flex-1 p-4 md:p-6">{children}</main>`;
    - `SkipLink` first.
  - `AdminSidebar` uses `Sidebar collapsible="icon"`:
    - **Header:** the logo (`/repone-logo.png`, linking to `/`).
    - **Group "Organization":** Events `/admin` (`CalendarDays`), Circuits `/admin/circuits` (`Route`), Athletes `/admin/athletes` (`Users`), Check-In `/admin/checkin` (`ScanLine`), Teams `/admin/teams` (`UsersRound`), Sponsors `/admin/sponsors` (`BadgeDollarSign`), Members `/admin/team` (`ShieldCheck`, only if `canManageMembers`), Messages `/admin/messages` (`MessageSquare`) with a `SidebarMenuBadge` showing `unreadCount` when it is above 0.
    - **Group `<event name>`:** only when `event` is set. Overview, Venues, Divisions, Athletes, WODs, Heats, Staff, Fees, Payments and Statement, each linking to `/admin/events/[id]/<slug>` (Overview is `/admin/events/[id]`).
    - **Active state:** `isActive` on the exact match; for Events, also on `/admin/events/**` when no deeper item matches. Set `aria-current="page"` on the active link.
    - **Footer:** the `menu` slot, rendering `<ModuleMenu current="admin" side="top" align="start" />`.
  - `src/app/(app)/admin/events/[eventId]/layout.tsx` (server):
    - Loads `events.id, name` for the param with `createClient()`; `notFound()` if it is missing.
    - Provides the event to the sidebar by rendering its children inside a small client context provider `AdminEventProvider` (in `AdminSidebar.tsx`'s module) that `AdminSidebar` reads.
    - Alternative: the sidebar fetches by id from `usePathname`. Choose the provider. Record the choice in the report.
  - `admin/layout.tsx` keeps `requireModule("admin")`, computes `unreadCount` and `canManageMembers = orgCan(ctx, { member: ["create"] })`, and renders `<AdminShell …>{children}</AdminShell>`. Remove the old header, NAV and the five module pills.

- [ ] **Step 3: Migrate every admin page** with the Migration rules.
  - Replace per-page "← Back to event" links with a `Breadcrumb` in `PageHeader` (Events / <event> / <page>).
  - Remove the per-page event queries that existed only for those links, if the page doesn't otherwise use the event.
  - Wrap every destructive action in `ConfirmAction`: Remove heat, Remove athlete, Delete circuit, Remove division, Delete team, member role ×, Remove staff, Refunded, event status change to Live or Archived (title "Set Aprieta Entry Level to Live?"), and the existing `DeleteEventButton`, which is rewritten on `ConfirmAction`.
  - Give each page its `metadata` title (Events, Circuits, Athletes, Check-In, Teams, Sponsors, Members, Messages, and for event pages `<Page> · <event name>` via `generateMetadata`).

- [ ] **Step 4: States.**
  - `admin/loading.tsx`: a `Skeleton` page header plus three `Skeleton` rows.
  - `admin/error.tsx`: the `(app)/error.tsx` content in the admin layout, using the same component. Import and re-export it.

- [ ] **Step 5: Verify.**
  - `pnpm ui:guard "src/app/(app)/admin"` prints clean, and `pnpm check` passes.
  - `pnpm db:authz-check && pnpm db:invite-check && pnpm db:rls-check` pass (no behavior change).
  - With `pnpm dev`, as admin@ at 1440 and 390: the sidebar works (collapse, mobile Sheet), the active item is marked, and the event group appears inside an event.
  - Submit one form per changed control type (Select: generate heats or add-to-roster; Checkbox/Switch: sponsor active; Input: create division) and confirm the saved value (Review Focus 3).
  - A delete shows the dialog and Cancel keeps the row.

- [ ] **Step 6: Commit.** Use the title "Admin runs in a dark sidebar shell with event navigation and confirmed deletes".

### Task 5: Operator shell, producer and dashboard

**Files:**
- Create: `src/components/shells/OperatorShell.tsx`, `src/components/shells/EventTabs.tsx`, and `loading.tsx` + `error.tsx` in `producer/` and `dashboard/`
- Modify: `src/app/(app)/producer/layout.tsx`, `producer/events/[eventId]/layout.tsx`, `dashboard/layout.tsx`, and every page and component under `producer/**` and `dashboard/**` (including `DashboardClient.tsx`)

**Interfaces:**
- Consumes: `ModuleMenu`, `SkipLink`, `ConfirmAction` and the migration rules.
- Produces:

```tsx
export function OperatorShell(props: { module: "producer" | "scorekeeper" | "commentator"; moduleLabel: string; eventName?: string; tabs?: React.ReactNode; children: React.ReactNode }): React.JSX.Element;
// EventTabs (client): marks the active tab from usePathname(), aria-current="page", horizontally scrollable on mobile
export function EventTabs(props: { items: Array<{ href: string; label: string }>; ariaLabel: string }): React.JSX.Element;
```

- [ ] **Step 1: Failing guard.** Run `pnpm ui:guard "src/app/(app)/producer" "src/app/(app)/dashboard"`.

- [ ] **Step 2: Shell.**
  - `OperatorShell` is a `min-h-screen bg-background text-foreground` container containing:
    - `SkipLink`;
    - a sticky top bar (`border-b border-border bg-card`, safe-area aware) with the logo linking to `/`, the module label, `eventName` (if given) in `font-display`, and `<ModuleMenu current={module} />` on the right;
    - the `tabs` slot under the bar;
    - `<main id="main" className="flex-1">{children}</main>`.
  - `producer/events/[eventId]/layout.tsx` keeps its access check and passes `tabs={<EventTabs ariaLabel="Event" items={[Overview → dashboard, Production, Broadcast, Scores, Heats, Sponsors, Commentary]} />}`. `/dashboard/[floorId]` uses `module="producer"` and `moduleLabel="Production"`.
  - Remove the old headers and their 🏠 / module links.

- [ ] **Step 3: Migrate pages and `DashboardClient`.**
  - Live controls use `<Button size="touch" className="min-h-16">`.
  - The graphics buttons become `Button`s with `aria-pressed={state.active_graphic === key}`, and `variant="default"` when pressed, otherwise `"secondary"`.
  - Reset timer and Clear graphics go through `ConfirmAction` with `variant="default"` (titles "Reset the timer?" and "Clear all graphics from air?").
  - The lower-third athlete picker becomes a shadcn `Select` with a visible `Label` "Lower third athlete" (it is client state, no `name` needed).
  - The connection dot gets a text label ("Live" / "Reconnecting…") next to it.
  - The "No heat is on air" banner (PR #13) stays, restyled with tokens.

- [ ] **Step 4: States.** Add `loading.tsx` (Skeleton) and `error.tsx` (re-exporting `(app)/error`) to `producer/` and `dashboard/`.

- [ ] **Step 5: Verify.**
  - The guard is clean and `pnpm check` passes.
  - As producer@ at 1024×768 and 390: put the heat on air, show and clear a graphic (the confirm appears), start, pause and reset the timer, and check `/overlay/<floor>/program` follows. Then restore `broadcast_state` (`current_heat_id` null, `active_graphic` none, timer idle at duration 0) with the same psql update used before.
  - `pnpm db:timer-check` passes.

- [ ] **Step 6: Commit.** Use the title "Production runs in the operator shell with pressed-state graphics and confirmed resets".

### Task 6: Scorekeeper and commentator on the operator shell

**Files:**
- Modify: `src/app/(app)/scorekeeper/layout.tsx`, `commentator/layout.tsx`, `commentator/events/[eventId]/layout.tsx`, and every page and component under `scorekeeper/**` and `commentator/**` (including `ScoreKeeperClient.tsx` and `CommentatorClient.tsx`)
- Create: `loading.tsx` + `error.tsx` in `scorekeeper/` and `commentator/`

**Interfaces:**
- Consumes: `OperatorShell` and `EventTabs` (Task 5), `ConfirmAction`, and the migration rules.

- [ ] **Step 1: Failing guard.** Run `pnpm ui:guard "src/app/(app)/scorekeeper" "src/app/(app)/commentator"`.

- [ ] **Step 2: Shells.**
  - The scorekeeper uses `OperatorShell module="scorekeeper" moduleLabel="Scorekeeper"`, with no tabs.
  - The commentator event layout passes `EventTabs` (Dashboard, Lanes, Athletes, Heats, WODs, Leaderboard). The **Notes** tab is removed from the tabs, because the page is a "not built yet" placeholder; the route stays.
  - The event name appears once (in the bar). Remove the duplicate `h1` in `CommentatorClient`.

- [ ] **Step 3: Migrate.**
  - In `ScoreKeeperClient`:
    - Inputs become `Input className="h-12 text-base"`.
    - The `mm:ss` field gets `inputMode="text"` with `pattern="[0-9]{1,2}:[0-9]{2}"` and the placeholder `3:45`. Today it uses `inputMode="decimal"`, whose phone keypad has no colon. The full split-entry Drawer is sub-project 2.
    - Capped and Manual adjustment become `Switch` with a `name`.
    - Status becomes a `Select` with a `name`.
    - Finish heat and Leave heat use `ConfirmAction` (replacing `window.confirm`).
    - Save gets `size="touch"`.
    - The connection dot gets a text label with `aria-live="polite"`.
  - In `CommentatorClient`, add `min-w-0` on the select label and make the select `w-full` (it overflowed at 390). Use `Card` for the lane cards.

- [ ] **Step 4: States.** Add `loading.tsx` and `error.tsx` for both areas.

- [ ] **Step 5: Verify.**
  - The guard is clean and `pnpm check` passes.
  - As scorekeeper@ at 390 and 820: type `3:45` with the on-screen keyboard (in DevTools mobile emulation, check that the field accepts the colon), save one lane, finish the heat through the dialog, and confirm the saved result. Then delete it with psql (results for the seed heat) and recompute nothing else.
  - As commentator@ at 1440 and 390: no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`), and the tabs show the active one.

- [ ] **Step 6: Commit.** Use the title "Scorekeeper and commentator run in the operator shell with phone-sized inputs".

### Task 7: Athlete shell and athlete pages

**Files:**
- Create: `src/components/shells/AthleteShell.tsx`, `src/components/shells/AthleteBottomNav.tsx`, `athlete/loading.tsx`, `athlete/error.tsx`
- Modify: `src/app/(app)/athlete/layout.tsx` and every page and component under `athlete/**`, `src/components/AthleteDirectoryList.tsx`, `src/components/LikeButton.tsx`, `src/components/MessagesNavLink.tsx`

**Interfaces:**
- Consumes: `ModuleMenu`, `SkipLink`, `EmptyState`, `ConfirmAction`, and the migration rules.
- Produces:

```tsx
export function AthleteShell(props: { signedIn: boolean; unreadCount: number; children: React.ReactNode }): React.JSX.Element;
export function AthleteBottomNav(props: { unreadCount: number }): React.JSX.Element; // client; Home /athlete, Athletes /athlete/directory, Messages /athlete/messages; active from usePathname
```

- [ ] **Step 1: Failing guard.** Run `pnpm ui:guard "src/app/(app)/athlete" src/components/AthleteDirectoryList.tsx src/components/LikeButton.tsx src/components/MessagesNavLink.tsx`.

- [ ] **Step 2: Shell.**
  - The header is one row: the logo and, when signed in, `<ModuleMenu current="athlete" />` (an avatar-style trigger).
  - `AthleteBottomNav` is fixed to the bottom on `md:hidden`, with `pb-[env(safe-area-inset-bottom)]`. Each item is at least 56px tall, uses lucide icons (`House`, `Users`, `MessageSquare` with an unread dot) and sets `aria-current`.
  - On `md+` the same three links show inline in the header.
  - `main` gets `pb-20 md:pb-6` so content clears the bar.
  - Signed out (the onboarding edge), there is no nav.
  - The name is no longer printed twice.

- [ ] **Step 3: Migrate pages.**
  - On `/athlete`, the QR check-in card moves first. Its white background stays white with `// ui-guard-ignore: QR needs a white quiet zone`.
  - Remove the duplicate Messages/Directory buttons that repeated the nav.
  - Benchmark/lift forms use a `grid gap-3 sm:grid-cols-[1fr_1fr_auto]` with a full-width Save on phones.
  - "Remove" on a benchmark gets `ConfirmAction`.
  - Inputs are `h-11 text-base`, with `autoComplete` on onboarding (`given-name`, `family-name`, `email`, `tel`, `bday`).
  - The message thread page puts the composer in a sticky footer (`sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0`) with a labeled `Textarea`.

- [ ] **Step 4: States.** Add `athlete/loading.tsx` (Skeleton card list) and `athlete/error.tsx`.

- [ ] **Step 5: Verify.**
  - The guard is clean and `pnpm check` passes.
  - As athlete@ at 390: header and nav measure ≥ 44px targets (script: every `a, button` in the nav has `getBoundingClientRect().height >= 44`), there is no horizontal scroll, the QR shows first, and a message sends.
  - As new-athlete@: onboarding renders inside the shell and its form keeps values on a duplicate-phone error.

- [ ] **Step 6: Commit.** Use the title "Athletes get a one-line header and a bottom tab bar on phones".

### Task 8: Live, auth and the start page

**Files:**
- Create: `src/components/shells/PublicShell.tsx`, `live/loading.tsx`, `live/error.tsx`
- Modify: `src/app/(app)/live/layout.tsx` and pages and components under `live/**`; `src/app/(auth)/**` (`layout.tsx`, the forms) and `src/components/auth/*`; `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `ModuleMenu`, `SkipLink`, `EmptyState`, and the migration rules.
- Produces: `export function PublicShell(props: { children: React.ReactNode }): React.JSX.Element;`

- [ ] **Step 1: Failing guard.** Run `pnpm ui:guard "src/app/(app)/live" "src/app/(auth)" src/components/auth "src/app/(app)/page.tsx"`.

- [ ] **Step 2: PublicShell and live.**
  - The header has the logo and the YouTube link as the single primary `Button` (`asChild`, external link with `rel="noopener noreferrer"`).
  - The footer has "Organizer sign in" linking to `/login` (muted).
  - `main#main`.
  - Live pages: the connection dot gets a text label. The standings `table` becomes shadcn `Table` inside `overflow-x-auto`. Empty texts become `EmptyState`.

- [ ] **Step 3: Auth.**
  - `(auth)/layout.tsx` gets `bg-background text-foreground` and `main#main` around children.
  - The forms use `Card`, `Label`, `Input` (`h-11 text-base`) and `Button`.
  - Errors use `text-destructive` with `role="alert"`, and the "Create one" or "Forgot" links use `text-brand-text`.
  - The `/invite` page with no token reads "This invitation link is missing its code." with a link back to `/login`. With an expired token it keeps the expired text.
  - Add `metadata.description` to the auth layout.

- [ ] **Step 4: Start page.**
  - Signed in: a `Card` grid where each card has the module's lucide icon (same mapping as `ModuleMenuView`), `label`, a distinct one-line description per kind and `detail`:
    - admin: "Events, athletes, payments and staff"
    - producer: "Run the broadcast"
    - scorekeeper: "Enter results on the floor"
    - commentator: "Lanes, athletes and standings at a glance"
    - athlete: "Your check-in, lifts and messages"
  - "Create my athlete profile" is a `Button variant="outline"` (not red) when it sits next to module cards. Keep the existing big primary button only on the empty start page.
  - Signed out: the public landing restyled (one primary "Live leaderboard", "Sign in" as outline).
  - Replace the black-box logo `<img>` with `next/image` where it is the same asset (keep `alt="RepOne"`).

- [ ] **Step 5: States.** Add `live/loading.tsx` and `live/error.tsx`.

- [ ] **Step 6: Verify.**
  - The guard is clean and `pnpm check` passes.
  - Signed out at 390: `/`, `/live`, `/live/<seed event>`, `/login`, `/signup`, `/forgot-password`, `/invite` (no token) render dark and readable.
  - Signed in as admin@ and new-athlete@: the start page renders cards or the empty state.
  - `pnpm db:auth-check` passes (with the dev server up).

- [ ] **Step 7: Commit.** Use the title "Live, sign-in and the start page use the dark system".

### Task 9: Cleanup, overlay tokens, proof and docs

**Files:**
- Modify:
  - `src/app/globals.css` (delete `.control-btn*` and `.overlay-transparent`)
  - `src/app/(app)/layout.tsx` (body `bg-background text-foreground`)
  - `package.json` (`check` adds `pnpm ui:guard`)
  - `src/components/graphics/*.tsx` (colors to `broadcast-*` tokens)
  - `.claude/skills/verify-repone/**` (recipes for the new shells)
- Delete: `src/components/AccountMenu.tsx`, `src/components/SignOutButton.tsx` (if unused)
- Create: `DESIGN.md` (via `/impeccable document`)

- [ ] **Step 1: Whole-repo guard first (RED).** `pnpm ui:guard` with no paths must list only the remaining stragglers. Fix each with the Migration rules: `(app)/error.tsx`, `not-found`, any shared component.

- [ ] **Step 2: Remove the old system.**
  - Delete the `.control-btn`, `.control-btn-red`, `.control-btn-outline` and `.overlay-transparent` rules.
  - Set the `(app)` body to `bg-background text-foreground`.
  - Delete `AccountMenu.tsx` and any now-unused `SignOutButton.tsx` (grep first).
  - Set `"check": "pnpm lint && pnpm typecheck && pnpm test && pnpm format:check && pnpm ui:guard"`.
  - `pnpm check` must pass.

- [ ] **Step 3: Overlay tokens.** In `src/components/graphics/*`, replace `bg-repone-black`, `text-repone-white` and `bg-repone-red` with `bg-broadcast-bg`, `text-broadcast-fg` and `bg-broadcast-accent`, which have the same values. `font-[family-name:var(--font-display)]` becomes `font-display`. Check `/overlay/<floor>/{timer,heat,lanes,leaderboard,program}` are still transparent (`getComputedStyle(document.body).backgroundColor === "rgba(0, 0, 0, 0)"`) and look the same.

- [ ] **Step 4: Proof.**
  - **verify-repone:** run the skill per role (admin, producer, scorekeeper, commentator, athlete, new-athlete, signed out) at 1440 and 390. Screenshots go to `.verify/<date>-design-system/`.
  - **Lighthouse:** one screen per area: `/admin/events/<id>/payments`, `/dashboard/<floor>`, `/scorekeeper/<floor>`, `/commentator/events/<id>/dashboard`, `/athlete`, `/live/<id>`, `/login`. Accessibility must be ≥ 95 with zero `color-contrast` failures. Record the scores.
  - **Database checks:** all `db:*` checks pass (`pnpm db:rls-check`, `authz`, `auth`, `invite`, `token`, `standings`, `timer`; space them for the sign-in rate limit).
  - **Build:** `pnpm build` passes.

- [ ] **Step 5: Re-audit and DESIGN.md.** Run `/impeccable audit` (whole app) and record the new score against 11/20 in the PR. Then run `/impeccable document` to write `DESIGN.md` from the shipped system.

- [ ] **Step 6: Docs and commit.**
  - Update the verify-repone recipes: "staff land on `/`, admin has a sidebar, operator shells have tabs", and a Members rename note.
  - Commit with the title "The old UI classes are gone and the guard keeps them out".
  - Commit DESIGN.md separately: "DESIGN.md records the RepOne dark system".

- [ ] **Step 7: PR.**
  - `git push -u origin feat/design-system`, then `gh pr create --base staging`.
  - Title: "RepOne runs on one dark shadcn system with a shell per area".
  - Body: why (audit 11/20), what (tokens, fonts, components, shells, guard), screenshots paths, Lighthouse table, re-audit score, "no data changes", and the follow-up sub-projects 2-7.
  - End the body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
  - Stop at the PR link.
