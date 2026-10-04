# Admin Data Screens and Feature Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every admin list becomes a searchable `DataTable`, every create/edit a `FormDialog` (Drawer on a phone), every long record a `DetailHeader` + `LinkTabs`, and every admin action returns `ActionResult`. The pieces are shared and documented, so later features (venue display) are assembled from them.

**Architecture:** Server components keep loading data. Each screen hands plain rows to one client `*Table.tsx` (columns, row actions, dialogs). Mutations go through `useServerAction` (TanStack Query) on server actions that return `ActionResult` via `safeAction`. Dialogs are Radix on desktop and a Base UI Drawer with `VirtualKeyboardProvider` below 640px.

**Tech Stack:** Next.js 16.3 (App Router, server actions), React 19.2, Supabase, zod 4, shadcn/ui (radix-vega), `@tanstack/react-query` 5, `@tanstack/react-table` 9, `@base-ui/react` (Drawer only), Vitest 4 + Testing Library (jsdom per file).

**Spec:** `docs/superpowers/specs/2026-10-04-admin-data-screens-design.md`
**Screen inventory (read the section for your screen before editing it):** `docs/superpowers/plans/2026-10-04-admin-data-screens-inventory.md`
**Reference implementation (sibling repo, read-only):** `/Users/cfboy/Documents/GitHub/school-schedule`

## Global Constraints

- Branch `feat/admin-data-screens` from `origin/staging`; every PR targets `staging` (`gh pr create --base staging`). Agents never merge.
- `pnpm check` (lint, typecheck, test, format:check, ui:guard) passes before every commit. The one pre-existing lint warning in `.verify/…/repro2.mjs` is not ours; nothing else may warn.
- Stage files by name (never `git add -A`). Commit titles are plain sentences saying what is now true (no `feat:`), with a body explaining why, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- No database, RLS or permission changes. No migrations.
- UI copy is English. One dark theme; tokens only (`ui:guard` enforces it). Touch targets ≥ 44px below `sm`.
- Dialog → Drawer breakpoint is `(max-width: 639px)` (Tailwind `sm`).
- DataTable page size is 25. Low-priority columns hide below `md`.
- Dates and times go through `src/lib/time.ts` (`America/Puerto_Rico`, `Intl`, no date-fns).
- **Do not install `vaul`.** The Drawer is `@base-ui/react/drawer`.
- Forms default to native `FormData` + the existing zod schema; TanStack Form is not added in this plan.
- Browser runs (Chrome DevTools MCP or Playwright) must close their pages and browsers when done.
- Dev stack: `pnpm dev` on :3200, logins `*@repone.test` / `Repone1234!` (admin is `admin@repone.test`). Never run `pnpm env:local --force`.
- Next.js 16 differs from training data: read `node_modules/next/dist/docs/` before using an unfamiliar API.

## Rulings (decisions this plan makes where the spec is silent)

1. **Client-side table model.** Admin lists are tens to a few hundred rows and are already loaded by the server component, so `DataTable` filters, sorts and paginates on the client (TanStack Table v9 client pipeline). school-schedule's URL-driven server pagination is not copied. *Cost if wrong:* a list that grows past ~2,000 rows needs a server-paginated variant later; the column definitions carry over.
2. **`safeAction` instead of rewriting every `parseForm` call.** `ValidationError` gains `fieldErrors`; `safeAction(fn)` converts `ValidationError`, `NotAuthorizedError`, `InviteError` and BetterAuth `APIError` into `{ ok: false, … }` and rethrows anything else (including Next redirects). This delivers the spec's "non-throwing parseForm" through one wrapper. *Cost if wrong:* none functional; a later refactor could inline it.
3. **Migrated actions do not call `redirect()`.** `createEvent`, `deleteEvent`, `createCircuit`, `deleteCircuit` and `saveHeatResults` return `ok({ href })` and the client navigates with `router.push(href)`. A redirect inside a TanStack mutation would surface as an error. *Cost if wrong:* one extra client line per redirecting action.
4. **The existing `FormResult` (`team.ts`, `eventStaff.ts`, `registrations.ts`, `lanes.ts`) becomes `ActionResult`.** The `_previous`/`_prevState` parameters used by `useActionState` are dropped as those screens move to `useServerAction`.
5. **"Card list" guard** is a per-file rule on admin `page.tsx` files: `<Card` is rejected unless the line (or the comment line above it) carries `ui-guard-ignore: <reason>`. Event overview count cards and Statement summary cards carry that marker.

## Review Focus

1. **A phone with the keyboard up (390×400):** opening any FormDialog and focusing its last field must leave the submit button visible and tappable. Pinned by the Task 5 browser check and repeated in every PR's verification task.
2. **A failure that is not a validation error** (duplicate exclusive category, athlete already registered, "organization must keep an owner"): the dialog stays open and shows the message; nothing navigates to the error screen. Pinned by each migrated action's unit test plus `FormDialog`'s "failure keeps it open" test (Task 6).
3. **Double submit** (double-click "Save", or Enter twice): the action runs once. Pinned by `useServerAction` test "ignores a second submit while pending" (Task 3) and `SubmitButton` disabled state (Task 6).
4. **An action that used to redirect** (create event, delete circuit): after success the browser lands on the same page it did before. Pinned by the action tests asserting `data.href` (Tasks 15, 17, 31) and the PR browser checks.
5. **Search that matches nothing / a list that starts empty:** the table shows the screen's `EmptyState` (with its action) for an empty list, and "No results." with a "Clear search" button for an empty search. Pinned by `DataTable` tests (Task 8).

---

## File map

**Create (Part 1 — foundations):**
- `src/app/(app)/providers.tsx` — `QueryClientProvider` (+ `TooltipProvider` if not already global).
- `src/lib/action-result.ts` — `ActionResult`, `FieldErrors`, `ok`, `fail`.
- `src/lib/actions/safeAction.ts` — `safeAction(fn)`, `toFailure(err)`.
- `src/lib/use-server-action.ts` — `useServerAction`, `ActionError`.
- `src/lib/time.ts` — `formatDay`, `formatDayRange`, `formatDateTime`, `formatTime`.
- `src/lib/use-media-query.ts` — `useMediaQuery`.
- `src/components/ui/drawer.tsx` — Base UI Drawer.
- `src/components/ui/responsive-dialog.tsx` — Dialog ≥640px / Drawer below.
- `src/components/app/FormDialog.tsx`, `SubmitButton.tsx`, `FormField.tsx`, `FormAlert.tsx`.
- `src/lib/row-actions.ts` — `RowAction`, `RowActionSet`, `rowActionLayout`.
- `src/components/app/RowActions.tsx` — `RowActions`, `useEntityDialogs`.
- `src/lib/data-table.ts` — `dataTableFeatures`, `dataTableColumns`, column meta type.
- `src/components/app/data-table/DataTable.tsx`, `TableToolbar.tsx`, `TablePagination.tsx`.
- `src/components/app/DetailHeader.tsx`, `LinkTabs.tsx`.
- `src/app/(app)/admin/sponsors/SponsorsTable.tsx`, `SponsorForm.tsx`.
- Tests next to each file (`*.test.ts(x)`).

**Modify (Part 1):** `package.json`, `src/app/(app)/layout.tsx`, `src/lib/validation/form.ts`, `src/lib/actions/inviteResult.ts`, `src/components/ui/dialog.tsx`, `src/components/ui/alert-dialog.tsx`, `src/components/app/ConfirmAction.tsx`, `src/components/app/ActionSwitch.tsx`, `src/lib/actions/sponsors.ts`, `src/app/(app)/admin/sponsors/page.tsx`, the five `toLocale…` call sites, `src/lib/design/uiGuard.ts`, `scripts/ui-guard.ts`.

**Parts 2–4:** one `*Table.tsx` (+ form components) per screen folder, the action files listed per task, `DESIGN.md`.

---

## Screen migration recipe (used by every task in Parts 2–4)

Each screen task names its columns, filters, toolbar buttons, row actions and actions. Apply them with these steps, in order. The Sponsors pilot (Task 12) is the worked example of every step.

1. **Read** the screen's section in the inventory and the current `page.tsx`.
2. **Actions first (TDD).** For each action the task lists, write a test in `src/lib/actions/<file>.test.ts` (pattern: Task 12 Step 1) asserting its known failure returns `{ ok: false, message: "<exact message>" }` and success returns `{ ok: true }` (or `data.href` for a former redirect). Run it, see it fail. Then convert the action: wrap the body in `safeAction`, replace each `throw new Error("<user message>")` with `return fail("<user message>")`, replace `redirect(x)` with `return ok({ href: x })`, end with `return ok()`, and declare the return type `Promise<ActionResult>` (or `Promise<ActionResult<{ href: string }>>`). `expectChanged(...)` and DB `throw new Error(error.message)` stay (they are unexpected). Add the file to `ACTION_RESULT_FILES` in `src/lib/design/uiGuard.ts`. Run the test, see it pass.
3. **Update every caller** the inventory lists for those actions (inside and outside admin) so nothing calls them with the old signature. `pnpm typecheck` finds them.
4. **Client table.** Create `<Screen>Table.tsx` (`"use client"`) exporting a component that takes plain serializable rows plus ids it needs. Define columns with `dataTableColumns<Row>()`; set `meta: { priority: "low" }` on low-priority columns and `meta: { rowActions: true }` on the actions column. Render `<DataTable … />` with the task's search, filters, toolbar and `empty`.
5. **Forms.** Each create/edit form becomes a client component rendered inside `FormDialog`. It builds `FormData` from the `<form>` and calls `mutation.mutate(formData)`; fields use `FormField` with `errors={fieldErrors?.[name]}`; the footer has `SubmitButton`; a form-level failure shows in `FormAlert`. Default values for edit come from the row.
6. **Row actions** use `RowActions`: the task names `primary`, `secondary` and `destructive`. Dialogs opened from the menu live outside it via `useEntityDialogs`. Every destructive entry opens `ConfirmAction` (controlled `open`), keeping today's title/description/confirm label from the inventory.
7. **Page.** `page.tsx` keeps its data loading, maps rows to the plain row type, and renders `PageHeader` + `<Screen>Table`. Remove the inline form `Card`, the card list and now-unused imports.
8. **Verify:** `pnpm check`; then in the browser at 1440 and 390: list renders, search and a filter work, create, edit and delete (where they exist) succeed with a toast, a forced validation error (submit a required field blank after removing `required` via DevTools, or a duplicate) shows under its field. Close the browser pages.
9. **Commit** the screen with a plain-sentence title, e.g. `Divisions are a table with create in a dialog`.

---

# Part 1 — Foundations + Sponsors pilot (PR 1)

### Task 1: Dependencies and the query provider

**Files:**
- Modify: `package.json` (via pnpm)
- Create: `src/app/(app)/providers.tsx`
- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**
- Produces: `<Providers>` wrapping every `(app)` page in a `QueryClientProvider`; `useServerAction` (Task 3) depends on it.

- [ ] **Step 1: Install**

Run: `pnpm add @tanstack/react-query@^5 @tanstack/react-table@^9 @base-ui/react@^1`
Expected: three dependencies added; `pnpm-lock.yaml` updated; no `vaul`.

- [ ] **Step 2: Create the provider**

```tsx
// src/app/(app)/providers.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * The read path is server-rendered, so TanStack Query has one job here:
 * mutations (server actions) with pending, error and success state. Nothing
 * prefetches or hydrates server data.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 3: Wrap the layout**

In `src/app/(app)/layout.tsx` import `{ Providers } from "./providers"` and change the body to:

```tsx
<body className="min-h-full flex flex-col bg-background text-foreground">
  <Providers>{children}</Providers>
  <Toaster />
</body>
```

- [ ] **Step 4: Check and commit**

Run: `pnpm check` → passes. Run `pnpm build` → succeeds.

```bash
git add package.json pnpm-lock.yaml "src/app/(app)/providers.tsx" "src/app/(app)/layout.tsx"
git commit -m "The app has TanStack Query, TanStack Table and Base UI available" -m "Foundations for the admin data screens: mutations run through TanStack Query, lists through TanStack Table, and the phone drawer through Base UI." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: ActionResult, field errors and safeAction

**Files:**
- Create: `src/lib/action-result.ts`, `src/lib/actions/safeAction.ts`, `src/lib/actions/safeAction.test.ts`
- Modify: `src/lib/validation/form.ts` (`ValidationError`, `parseForm`, `parseArg`), `src/lib/validation/form.test.ts`, `src/lib/actions/inviteResult.ts`

**Interfaces:**
- Produces:
  - `type FieldErrors = Record<string, string[]>`
  - `type ActionResult<T = undefined> = ({ ok: true; message?: string } & (T extends undefined ? object : { data: T })) | { ok: false; message: string; fieldErrors?: FieldErrors }`
  - `ok(): ActionResult`, `ok<T>(data: T): ActionResult<T>`, `okMessage(message: string): ActionResult`
  - `fail(message: string, fieldErrors?: FieldErrors): { ok: false; message: string; fieldErrors?: FieldErrors }`
  - `safeAction<R extends ActionResult<any>>(fn: () => Promise<R>): Promise<R | ActionFailure>` where `ActionFailure = Extract<ActionResult, { ok: false }>`
  - `toFailure(err: unknown): ActionFailure` (rethrows unknown errors)
  - `ValidationError` gains `readonly fieldErrors: FieldErrors`.

- [ ] **Step 1: Failing tests**

Add to `src/lib/validation/form.test.ts`:

```ts
import { z } from "zod";
import { field, parseForm, ValidationError } from "./form";

describe("parseForm field errors", () => {
  it("names every invalid field, first message first", () => {
    const schema = z.object({ name: field.text("Name"), email: field.text("Email") });
    const fd = new FormData();
    fd.set("name", "");
    fd.set("email", "");
    try {
      parseForm(schema, fd);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const v = err as ValidationError;
      expect(v.message).toBe("Name is required.");
      expect(v.fieldErrors).toEqual({ name: ["Name is required."], email: ["Email is required."] });
    }
  });
});
```

Create `src/lib/actions/safeAction.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fail, ok } from "@/lib/action-result";
import { NotAuthorizedError } from "@/lib/auth/guards";
import { ValidationError } from "@/lib/validation/form";
import { safeAction } from "./safeAction";

describe("safeAction", () => {
  it("passes a result through", async () => {
    expect(await safeAction(async () => ok())).toEqual({ ok: true });
    expect(await safeAction(async () => fail("Nope"))).toEqual({ ok: false, message: "Nope" });
  });

  it("turns a validation error into field errors", async () => {
    const result = await safeAction(async () => {
      throw new ValidationError("Name is required.", { name: ["Name is required."] });
    });
    expect(result).toEqual({
      ok: false,
      message: "Name is required.",
      fieldErrors: { name: ["Name is required."] },
    });
  });

  it("turns a refusal into a message", async () => {
    const result = await safeAction(async () => {
      throw new NotAuthorizedError("Only an admin or event director can do that.");
    });
    expect(result).toEqual({ ok: false, message: "Only an admin or event director can do that." });
  });

  it("rethrows anything unexpected, including Next's redirect", async () => {
    await expect(safeAction(async () => { throw new Error("db down"); })).rejects.toThrow("db down");
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/admin;307;" });
    await expect(safeAction(async () => { throw redirect; })).rejects.toBe(redirect);
  });
});
```

- [ ] **Step 2: Run them, expect failure**

Run: `pnpm vitest run src/lib/validation/form.test.ts src/lib/actions/safeAction.test.ts`
Expected: FAIL (`fieldErrors` undefined; `@/lib/action-result` not found).

- [ ] **Step 3: Implement**

```ts
// src/lib/action-result.ts
/**
 * What every server action returns. Expected failures ("an athlete with this
 * email already exists") are values, not throws: Next.js redacts thrown
 * messages in production, while a returned value crosses the network intact.
 * Unexpected errors still throw and reach the area's error screen.
 */
export type FieldErrors = Record<string, string[]>;

export type ActionFailure = { ok: false; message: string; fieldErrors?: FieldErrors };

export type ActionResult<T = undefined> =
  | ({ ok: true; message?: string } & (T extends undefined ? object : { data: T }))
  | ActionFailure;

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(...args: [] | [T]) {
  return args.length === 0 ? { ok: true as const } : { ok: true as const, data: args[0] };
}

/** Success with words for the person, e.g. "Invitation sent." */
export function okMessage(message: string): ActionResult {
  return { ok: true, message };
}

export function fail(message: string, fieldErrors?: FieldErrors): ActionFailure {
  return fieldErrors ? { ok: false, message, fieldErrors } : { ok: false, message };
}
```

In `src/lib/validation/form.ts` replace `ValidationError`, `parseForm` and `parseArg` with:

```ts
import type { FieldErrors } from "@/lib/action-result";

export class ValidationError extends Error {
  readonly fieldErrors: FieldErrors;
  constructor(message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

function toValidationError(issues: z.core.$ZodIssue[]): ValidationError {
  const fieldErrors: FieldErrors = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (!key) continue;
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return new ValidationError(issues[0]?.message ?? "Some of the input isn't valid.", fieldErrors);
}

export function parseForm<S extends z.ZodType>(schema: S, formData: FormData): z.infer<S> {
  const raw: Record<string, FormDataEntryValue> = {};
  for (const [key, value] of formData.entries()) {
    if (!(key in raw)) raw[key] = value;
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw toValidationError(result.error.issues);
  return result.data;
}

export function parseArg<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw toValidationError(result.error.issues);
  return result.data;
}
```

(If `z.core.$ZodIssue` does not resolve in the installed zod 4, use `z.ZodError["issues"][number]`.)

```ts
// src/lib/actions/safeAction.ts
import { APIError } from "better-auth/api";
import { type ActionFailure, type ActionResult, fail } from "@/lib/action-result";
import { NotAuthorizedError } from "@/lib/auth/guards";
import { InviteError } from "@/lib/auth/invite";
import { ValidationError } from "@/lib/validation/form";

const MUST_KEEP_OWNER = new Set([
  "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER",
  "YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER",
]);

/** An expected failure, as a value; anything else (a bug, a redirect) is rethrown. */
export function toFailure(err: unknown): ActionFailure {
  if (err instanceof ValidationError) {
    return Object.keys(err.fieldErrors).length > 0
      ? fail(err.message, err.fieldErrors)
      : fail(err.message);
  }
  if (err instanceof NotAuthorizedError || err instanceof InviteError) return fail(err.message);
  if (err instanceof APIError) {
    const code = String(err.body?.code ?? "");
    if (MUST_KEEP_OWNER.has(code)) return fail("The organization must keep an owner.");
    return fail(err.body?.message ?? err.message);
  }
  throw err;
}

/**
 * The body of every migrated server action:
 *   export async function createX(fd: FormData): Promise<ActionResult> {
 *     return safeAction(async () => { …; return ok(); });
 *   }
 * Guards and parseForm keep throwing; this turns their errors into results.
 */
export async function safeAction<R extends ActionResult<unknown>>(
  fn: () => Promise<R>,
): Promise<R | ActionFailure> {
  try {
    return await fn();
  } catch (err) {
    return toFailure(err);
  }
}
```

Make `src/lib/actions/inviteResult.ts`'s `failure(error)` delegate: `export function failure(error: unknown): FormResult { return toFailure(error); }` and delete its now-unused `MUST_KEEP_OWNER` and imports (keep `inviteMessage`). `FormResult` stays until Tasks 18/24 remove it.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/lib/validation src/lib/actions`
Expected: PASS, including the existing `form.test.ts` cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/action-result.ts src/lib/actions/safeAction.ts src/lib/actions/safeAction.test.ts src/lib/validation/form.ts src/lib/validation/form.test.ts src/lib/actions/inviteResult.ts
git commit -m "Server actions can report failures as values with per-field errors" -m "Next.js redacts thrown messages in production, so an admin saw a generic error screen instead of the reason. ActionResult carries the message and the zod field errors back intact; safeAction converts the guards' and parseForm's errors and rethrows the unexpected." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: useServerAction

**Files:**
- Create: `src/lib/use-server-action.ts`, `src/lib/use-server-action.test.tsx`

**Interfaces:**
- Consumes: `ActionResult`, `FieldErrors` (Task 2); `QueryClientProvider` (Task 1).
- Produces:
  - `class ActionError extends Error { readonly fieldErrors: FieldErrors }`
  - `useServerAction<TInput, R extends ActionResult<any>>(action: (input: TInput) => Promise<R>, options?: { success?: string | ((data, input) => string); refresh?: boolean; toastErrors?: boolean; onSuccess?; onError? })` → TanStack `UseMutationResult<Data<R>, ActionError, TInput>`
  - `fieldErrorsOf(error: unknown): FieldErrors | undefined`

- [ ] **Step 1: Failing test**

```tsx
// src/lib/use-server-action.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/action-result";
import { fieldErrorsOf, useServerAction } from "./use-server-action";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

function Harness({
  action,
  toastErrors,
}: {
  action: (n: number) => Promise<ActionResult>;
  toastErrors?: boolean;
}) {
  const m = useServerAction(action, { success: "Saved", toastErrors });
  return (
    <div>
      <button type="button" onClick={() => m.mutate(1)}>Go</button>
      <p>{m.isPending ? "pending" : "idle"}</p>
      <p>{fieldErrorsOf(m.error)?.name?.[0] ?? ""}</p>
    </div>
  );
}

function renderWith(ui: React.ReactNode) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useServerAction", () => {
  it("toasts success and refreshes", async () => {
    renderWith(<Harness action={async () => ({ ok: true })} />);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Saved"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("toasts a failure and does not refresh", async () => {
    renderWith(<Harness action={async () => ({ ok: false, message: "Nope" })} />);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nope"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps field errors and stays quiet when the form shows them", async () => {
    renderWith(
      <Harness
        toastErrors={false}
        action={async () => ({ ok: false, message: "Name is required.", fieldErrors: { name: ["Name is required."] } })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    await waitFor(() => expect(screen.getByText("Name is required.")).toBeTruthy());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts the server's own success words when the caller gives none", async () => {
    function Bare() {
      const m = useServerAction(async () => ({ ok: true as const, message: "Invitation sent." }));
      return <button type="button" onClick={() => m.mutate(undefined)}>Invite</button>;
    }
    renderWith(<Bare />);
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Invitation sent."));
  });

  it("ignores a second submit while pending", async () => {
    let resolve!: (r: ActionResult) => void;
    const action = vi.fn(() => new Promise<ActionResult>((r) => { resolve = r; }));
    renderWith(<Harness action={action} />);
    const go = screen.getByRole("button", { name: "Go" });
    await userEvent.click(go);
    await userEvent.click(go);
    resolve({ ok: true });
    await waitFor(() => expect(screen.getByText("idle")).toBeTruthy());
    expect(action).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run, expect failure** — `pnpm vitest run src/lib/use-server-action.test.tsx` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/lib/use-server-action.ts
"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ActionResult, FieldErrors } from "@/lib/action-result";

/** A failed action, as TanStack Query sees it: the message plus its field errors. */
export class ActionError extends Error {
  readonly fieldErrors: FieldErrors;
  constructor(message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = "ActionError";
    this.fieldErrors = fieldErrors;
  }
}

export function fieldErrorsOf(error: unknown): FieldErrors | undefined {
  return error instanceof ActionError ? error.fieldErrors : undefined;
}

type AnyResult = ActionResult<unknown>;
type Data<R> = Extract<R, { ok: true }> extends { data: infer D } ? D : undefined;

type Options<TInput, R> = Omit<UseMutationOptions<Data<R>, ActionError, TInput>, "mutationFn"> & {
  /** Toast on success. Omit for none. */
  success?: string | ((data: Data<R>, input: TInput) => string);
  /** Re-render server components after success (default true). */
  refresh?: boolean;
  /** Toast failures (default true). A form showing errors inline passes false. */
  toastErrors?: boolean;
};

/**
 * Runs a server action as a TanStack Query mutation. The one place that knows
 * a failure arrives as `{ ok: false }`: it becomes an ActionError so
 * isPending, error and mutateAsync behave as callers expect. A second call
 * while one is in flight is ignored.
 */
export function useServerAction<TInput, R extends AnyResult>(
  action: (input: TInput) => Promise<R>,
  {
    success,
    refresh = true,
    toastErrors = true,
    onSuccess,
    onError,
    ...options
  }: Options<TInput, R> = {},
) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const inFlight = useRef(false);
  // The server's own success words ("Invitation sent."), used when the caller sets no `success`.
  const serverMessage = useRef<string | undefined>(undefined);

  const mutation = useMutation<Data<R>, ActionError, TInput>({
    ...options,
    mutationFn: async (input) => {
      const result = await action(input);
      if (!result.ok) throw new ActionError(result.message, result.fieldErrors);
      serverMessage.current = result.message;
      return ("data" in result ? result.data : undefined) as Data<R>;
    },
    onSuccess: async (data, input, context, mutationCtx) => {
      const words = success
        ? typeof success === "function" ? success(data, input) : success
        : serverMessage.current;
      if (words) toast.success(words);
      await onSuccess?.(data, input, context, mutationCtx);
      if (refresh) startTransition(() => router.refresh());
    },
    onError: (error, input, context, mutationCtx) => {
      if (toastErrors) toast.error(error.message);
      onError?.(error, input, context, mutationCtx);
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  const mutate: typeof mutation.mutate = (input, opts) => {
    if (inFlight.current) return;
    inFlight.current = true;
    mutation.mutate(input, opts);
  };

  return { ...mutation, mutate };
}
```

(If `onSuccess`/`onError` callback arity differs in the installed `@tanstack/react-query`, match the installed `UseMutationOptions` signature.)

- [ ] **Step 4: Run** — `pnpm vitest run src/lib/use-server-action.test.tsx` → PASS.

- [ ] **Step 5: Commit** — `git add src/lib/use-server-action.ts src/lib/use-server-action.test.tsx` and commit "Server actions run as mutations that toast, refresh and keep field errors".

---

### Task 4: lib/time

**Files:**
- Create: `src/lib/time.ts`, `src/lib/time.test.ts`
- Modify: `src/app/(app)/admin/page.tsx:28-38`, `src/app/(app)/live/page.tsx:36-44`, `src/app/(app)/admin/messages/[counterpartId]/page.tsx:55`, `src/app/(app)/athlete/page.tsx:239`, `src/app/(app)/athlete/messages/[counterpartId]/page.tsx:83`

**Interfaces:**
- Produces: `TIME_ZONE = "America/Puerto_Rico"`, `formatDay(iso: string): string` ("Oct 4, 2026"), `formatDayRange(start: string | null, end: string | null, sep = " — "): string` ("Date TBD" when no start), `formatDateTime(at: string | Date): string` ("Oct 4, 2026, 3:05 PM"), `formatTime(at: string | Date): string` ("3:05 PM").

- [ ] **Step 1: Failing test**

```ts
// src/lib/time.test.ts
import { describe, expect, it } from "vitest";
import { formatDateTime, formatDay, formatDayRange, formatTime } from "./time";

describe("time", () => {
  it("formats a calendar day without shifting it", () => {
    expect(formatDay("2026-10-04")).toBe("Oct 4, 2026");
  });
  it("formats ranges", () => {
    expect(formatDayRange(null, null)).toBe("Date TBD");
    expect(formatDayRange("2026-10-04", "2026-10-04")).toBe("Oct 4, 2026");
    expect(formatDayRange("2026-10-04", "2026-10-05")).toBe("Oct 4, 2026 — Oct 5, 2026");
  });
  it("shows instants in Puerto Rico time, across midnight UTC", () => {
    // 2026-10-05T02:30Z is 10:30 PM on Oct 4 in Puerto Rico (UTC-4).
    expect(formatDateTime("2026-10-05T02:30:00Z")).toBe("Oct 4, 2026, 10:30 PM");
    expect(formatTime("2026-10-05T02:30:00Z")).toBe("10:30 PM");
  });
});
```

- [ ] **Step 2: Run** → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/lib/time.ts
/** Every date and time RepOne shows is Puerto Rico time, formatted by Intl. */
export const TIME_ZONE = "America/Puerto_Rico";

const day = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
});
const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE,
});
const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE });

/** A calendar day ("2026-10-04") as written, never shifted by a time zone. */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return day.format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatDayRange(start: string | null, end: string | null, sep = " — "): string {
  if (!start) return "Date TBD";
  if (!end || end === start) return formatDay(start);
  return `${formatDay(start)}${sep}${formatDay(end)}`;
}

export function formatDateTime(at: string | Date): string {
  return dateTime.format(typeof at === "string" ? new Date(at) : at).replace(" at ", ", ");
}

export function formatTime(at: string | Date): string {
  return time.format(typeof at === "string" ? new Date(at) : at);
}
```

- [ ] **Step 4: Replace the five call sites.** In `admin/page.tsx` delete `formatDateRange` and use `formatDayRange(e.starts_on, e.ends_on)`. In `live/page.tsx` replace the local `fmt`/`dateRange` with `formatDayRange`. In the three message pages replace `new Date(x).toLocaleString()` with `formatDateTime(x)`. Run `grep -rn "toLocale" src` → no matches.

- [ ] **Step 5: Run** `pnpm vitest run src/lib/time.test.ts` → PASS; `pnpm check` → passes. Commit "Dates and times are shown in Puerto Rico time from one module".

---

### Task 5: Dialog clamp, Base UI Drawer and ResponsiveDialog

**Files:**
- Modify: `src/components/ui/dialog.tsx:56`, `src/components/ui/alert-dialog.tsx:53`
- Create: `src/lib/use-media-query.ts`, `src/components/ui/drawer.tsx`, `src/components/ui/responsive-dialog.tsx`, `src/components/ui/responsive-dialog.test.tsx`

**Interfaces:**
- Produces: `useMediaQuery(query: string): boolean`; `ResponsiveDialog({ open?, onOpenChange?, children })`, `ResponsiveDialogTrigger({ children: ReactElement })`, `ResponsiveDialogContent`, `ResponsiveDialogHeader`, `ResponsiveDialogTitle`, `ResponsiveDialogDescription`, `ResponsiveDialogBody`, `ResponsiveDialogFooter`, `ResponsiveDialogClose({ children: ReactElement })`; `COMPACT_QUERY = "(max-width: 639px)"`.

- [ ] **Step 1: Clamp the dialogs.** In `dialog.tsx` line 56 add `max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain` to the `DialogContent` class string (after `grid`), with this comment above the `className`:

```tsx
// max-h + overflow are load-bearing: a centred dialog taller than the
// viewport (a phone with the keyboard up) otherwise puts its submit button
// below the fold, and a tap there hits the overlay and closes it unsaved.
```

Do the same for `AlertDialogContent` in `alert-dialog.tsx` line 53 with the comment `// Clamped like DialogContent: a confirmation whose buttons are off-screen cannot be confirmed.`

- [ ] **Step 2: `useMediaQuery`** — copy `/Users/cfboy/Documents/GitHub/school-schedule/lib/use-media-query.ts` verbatim to `src/lib/use-media-query.ts`.

- [ ] **Step 3: Drawer** — copy `/Users/cfboy/Documents/GitHub/school-schedule/components/ui/drawer.tsx` verbatim to `src/components/ui/drawer.tsx`, then change its `import { cn } from "cn";` to `import { cn } from "@/lib/utils";`. Keep `DrawerVirtualKeyboardProvider`. Change the overlay's `bg-black/10` to `bg-background/80` (RepOne's guard forbids `bg-black`).

- [ ] **Step 4: Failing test**

```tsx
// src/components/ui/responsive-dialog.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import {
  ResponsiveDialog, ResponsiveDialogBody, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogTrigger,
} from "./responsive-dialog";

function mockViewport(width: number) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(max-width: 639px)" ? width <= 639 : false,
    media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
}

function Example() {
  return (
    <ResponsiveDialog>
      <ResponsiveDialogTrigger><Button>Open</Button></ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader><ResponsiveDialogTitle>Add sponsor</ResponsiveDialogTitle></ResponsiveDialogHeader>
        <ResponsiveDialogBody>Body</ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("ResponsiveDialog", () => {
  it("is a dialog on a desktop", async () => {
    mockViewport(1440);
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="drawer-popup"]')).toBeNull();
  });
  it("is a drawer on a phone", async () => {
    mockViewport(390);
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(document.querySelector('[data-slot="drawer-popup"]')).toBeTruthy();
    expect(screen.getByText("Add sponsor")).toBeTruthy();
  });
});
```

Run: `pnpm vitest run src/components/ui/responsive-dialog.test.tsx` → FAIL (module not found).

- [ ] **Step 5: ResponsiveDialog** — copy `/Users/cfboy/Documents/GitHub/school-schedule/components/ui/responsive-dialog.tsx` to `src/components/ui/responsive-dialog.tsx` and adapt it to RepOne's **Radix** Dialog:
  - `import { cn } from "@/lib/utils";` and `import { useMediaQuery } from "@/lib/use-media-query";`
  - Remove `onOpenChangeComplete` and `showSwipeHandle` props (Radix has no `onOpenChangeComplete`; RepOne passes `showSwipeHandle` always): `<Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>` and `<Dialog open={open} onOpenChange={onOpenChange}>`.
  - Radix triggers take `asChild`, Base UI takes `render`:

```tsx
function ResponsiveDialogTrigger({ children }: { children: React.ReactElement }) {
  return useCompact("ResponsiveDialogTrigger") ? (
    <DrawerTrigger render={children} />
  ) : (
    <DialogTrigger asChild>{children}</DialogTrigger>
  );
}

function ResponsiveDialogClose({ children }: { children: React.ReactElement }) {
  return useCompact("ResponsiveDialogClose") ? (
    <DrawerClose render={children} />
  ) : (
    <DialogClose asChild>{children}</DialogClose>
  );
}
```

  - Base UI's `onOpenChange` passes `(open, eventDetails)`; wrap it: `onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}`.
  - Keep `ResponsiveDialogBody`'s compact classes (`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-6`) and its comment.
  - Export `COMPACT_QUERY`.

- [ ] **Step 6: Run** the test → PASS. `pnpm check` → passes.

- [ ] **Step 7: Browser check of the keyboard case** (dev server on :3200). Temporarily render `<Example />` is not needed: this is verified on Sponsors in Task 12 Step 8. Here, only confirm `pnpm build` succeeds (Base UI and Radix coexist).

- [ ] **Step 8: Commit** the five files: "Dialogs fit a phone with its keyboard up and become drawers below 640px".

---

### Task 6: FormDialog, SubmitButton, FormField, FormAlert

**Files:**
- Create: `src/components/app/FormDialog.tsx`, `SubmitButton.tsx`, `FormField.tsx`, `FormAlert.tsx`, `FormDialog.test.tsx`

**Interfaces:**
- Consumes: ResponsiveDialog (Task 5), `useServerAction`, `fieldErrorsOf` (Task 3).
- Produces:
  - `FormDialog({ trigger?: ReactElement; title: string; description?: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void; children: (close: () => void) => ReactNode })`
  - `SubmitButton({ pending: boolean; pendingLabel: string; disabled?: boolean; children })`
  - `FormField({ label: string; name: string; errors?: string[]; description?: string; children: (control: { id: string; name: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode })`
  - `FormAlert({ error: unknown })` — shows the message of an `ActionError` that has no field errors (or any non-field message).

- [ ] **Step 1: Failing test**

```tsx
// src/components/app/FormDialog.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/action-result";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert } from "./FormAlert";
import { FormDialog } from "./FormDialog";
import { FormField } from "./FormField";
import { SubmitButton } from "./SubmitButton";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

function NameForm({ action, close, initial }: { action: (fd: FormData) => Promise<ActionResult>; close: () => void; initial: string }) {
  const m = useServerAction(action, { success: "Saved", toastErrors: false, onSuccess: close });
  const errors = fieldErrorsOf(m.error);
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(new FormData(e.currentTarget)); }}>
      <FormField label="Name" name="name" errors={errors?.name}>
        {(control) => <Input {...control} defaultValue={initial} />}
      </FormField>
      <FormAlert error={m.error} />
      <SubmitButton pending={m.isPending} pendingLabel="Saving…">Save</SubmitButton>
    </form>
  );
}

function setup(action: (fd: FormData) => Promise<ActionResult>, initial = "Hoka") {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <FormDialog trigger={<Button>Edit</Button>} title="Edit sponsor">
        {(close) => <NameForm action={action} close={close} initial={initial} />}
      </FormDialog>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

afterEach(cleanup);

describe("FormDialog", () => {
  it("closes after a successful save", async () => {
    const user = setup(async () => ({ ok: true }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("stays open and shows the field error on failure", async () => {
    const user = setup(async () => ({ ok: false, message: "Name is required.", fieldErrors: { name: ["Name is required."] } }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Name is required."));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe("true");
  });

  it("shows a form-level failure", async () => {
    const user = setup(async () => ({ ok: false, message: "Another active sponsor already holds that category." }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Another active sponsor already holds that category.")).toBeTruthy());
  });

  it("reopens with the current values, not a draft", async () => {
    const user = setup(async () => ({ ok: true }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Draft");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Hoka");
  });
});
```

Run → FAIL (modules not found).

- [ ] **Step 2: Implement**

`FormDialog.tsx`: copy `/Users/cfboy/Documents/GitHub/school-schedule/components/form-dialog.tsx` verbatim (it already matches the interface above), keeping its comment.

```tsx
// src/components/app/SubmitButton.tsx
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A form's submit button: disabled with a spinner and a "…ing" label while saving. */
export function SubmitButton({
  pending, pendingLabel, disabled, children,
}: { pending: boolean; pendingLabel: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" disabled={pending || disabled} className="max-sm:w-full">
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {pending ? pendingLabel : children}
    </Button>
  );
}
```

```tsx
// src/components/app/FormField.tsx
"use client";

import { useId } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

/**
 * A labelled control with its server-side errors under it. The control gets
 * id, name, aria-invalid and aria-describedby from here, so a screen reader
 * reads the error with the field.
 */
export function FormField({
  label, name, errors, description, children,
}: {
  label: string;
  name: string;
  errors?: string[];
  description?: string;
  children: (control: { id: string; name: string; "aria-invalid"?: true; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const invalid = Boolean(errors?.length);
  const describedBy = [description ? descriptionId : null, invalid ? errorId : null].filter(Boolean).join(" ");
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children({ id, name, ...(invalid ? { "aria-invalid": true as const } : {}), ...(describedBy ? { "aria-describedby": describedBy } : {}) })}
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      {invalid ? <FieldError id={errorId} errors={errors?.map((message) => ({ message }))} /> : null}
    </Field>
  );
}
```

Selects: `SelectTrigger` gets `id`/`aria-*` from `control`, and `Select` gets `name={control.name}`. Checkbox: `<Checkbox id={control.id} name={control.name} />`.

```tsx
// src/components/app/FormAlert.tsx
import { fieldErrorsOf } from "@/lib/use-server-action";

/** A failure that belongs to no single field, shown above the form's buttons. */
export function FormAlert({ error }: { error: unknown }) {
  if (!(error instanceof Error)) return null;
  const fields = fieldErrorsOf(error);
  if (fields && Object.keys(fields).length > 0) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {error.message}
    </p>
  );
}
```

- [ ] **Step 3: Run** `pnpm vitest run src/components/app/FormDialog.test.tsx` → PASS. Commit the five files: "Create and edit forms share one dialog, one submit button and inline errors".

---

### Task 7: RowActions

**Files:**
- Create: `src/lib/row-actions.ts`, `src/lib/row-actions.test.ts`, `src/components/app/RowActions.tsx`

**Interfaces:**
- Produces: `type RowAction = { label: string; icon?: LucideIcon; href?: string; onSelect?: () => void; disabled?: boolean; hint?: string }`; `type RowActionSet = { primary?: RowAction; secondary?: RowAction[]; destructive?: RowAction[] }`; `rowActionLayout(set): { button: string | null; menu: string[] }`; `RowActions(props: RowActionSet & { label: string; compact?: boolean })`; `useEntityDialogs<Key extends string>(initial?: Key | null): { show(key): () => void; props(key): { open: boolean; onOpenChange(next: boolean): void } }`.

- [ ] **Step 1: Failing test**

```ts
// src/lib/row-actions.test.ts
import { describe, expect, it } from "vitest";
import { rowActionLayout } from "./row-actions";

describe("rowActionLayout", () => {
  it("puts the primary action on a button and destructive ones last, set apart", () => {
    expect(
      rowActionLayout({
        primary: { label: "Mark paid" },
        secondary: [{ label: "Waive" }, { label: "Edit payment" }],
        destructive: [{ label: "Refund" }],
      }),
    ).toEqual({ button: "Mark paid", menu: ["Waive", "Edit payment", "—", "Refund"] });
  });
  it("has no separator without both groups", () => {
    expect(rowActionLayout({ destructive: [{ label: "Delete" }] })).toEqual({ button: null, menu: ["Delete"] });
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement** — copy `/Users/cfboy/Documents/GitHub/school-schedule/lib/row-actions.ts` verbatim to `src/lib/row-actions.ts`; copy `/Users/cfboy/Documents/GitHub/school-schedule/components/row-actions.tsx` to `src/components/app/RowActions.tsx` with: imports from `@/lib/row-actions` and `@/lib/utils`; RepOne's `Button` has no `icon-lg`/`icon-sm` sizes — use `size="icon"` and add `className="size-11 md:size-9"` on the "⋯" trigger (44px on a phone); `DropdownMenuItem` `variant="destructive"` must exist in RepOne's `dropdown-menu.tsx` (it does in shadcn radix-vega; if not, use `className="text-destructive"`). Translate nothing — RepOne's labels come from callers.

- [ ] **Step 3: Run** → PASS. Commit "Row actions are one button plus a menu, destructive last".

---

### Task 8: DataTable

**Files:**
- Create: `src/lib/data-table.ts`, `src/components/app/data-table/DataTable.tsx`, `TableToolbar.tsx`, `TablePagination.tsx`, `DataTable.test.tsx`

**Interfaces:**
- Consumes: `EmptyState`, `Input`, `Select`, `Button`, `Table*` from `@/components/ui/table`.
- Produces:
  - `dataTableFeatures` (TanStack v9 `tableFeatures` with column filtering, global filtering, sorting, pagination and their client row models), `type DataTableFeatures`.
  - `dataTableColumns<TData>()` → typed column helper.
  - Column `meta`: `{ className?: string; priority?: "low"; rowActions?: true }`.
  - `type DataTableFilter = { columnId: string; label: string; allLabel: string; options: readonly (readonly [value: string, label: string])[] }`
  - `DataTable<TData>({ columns, data, getRowId, search?: { label: string; placeholder: string }, filters?: DataTableFilter[], toolbar?: ReactNode, empty: ReactNode, initialSorting?: { id: string; desc: boolean }[], pageSize?: number })`

- [ ] **Step 1: Read the installed v9 docs** for exact export names: `node_modules/@tanstack/table-core/skills/{core,table-features,global-filtering,column-filtering,sorting,pagination}/SKILL.md`. Names used below (`createFilteredRowModel`, `createSortedRowModel`, `createPaginatedRowModel`, `filterFn_includesString`, `filterFn_equals`, `sortFn_alphanumeric`, `sortFn_text`, `sortFn_basic`) must be checked there; use the installed names if any differ.

- [ ] **Step 2: Failing test**

```tsx
// src/components/app/data-table/DataTable.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { dataTableColumns } from "@/lib/data-table";
import { DataTable } from "./DataTable";

type Row = { id: string; name: string; tier: string };
const col = dataTableColumns<Row>();
const columns = [
  col.accessor("name", { header: "Sponsor" }),
  col.accessor("tier", { header: "Tier", filterFn: "equals", meta: { priority: "low" } }),
];
const rows: Row[] = Array.from({ length: 30 }, (_, i) => ({
  id: String(i), name: i === 0 ? "Hoka" : `Sponsor ${String(i).padStart(2, "0")}`, tier: i % 2 ? "logo" : "wod",
}));

function setup(data = rows) {
  render(
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      search={{ label: "Search sponsors", placeholder: "Search…" }}
      filters={[{ columnId: "tier", label: "Tier", allLabel: "All tiers", options: [["logo", "Logo"], ["wod", "WOD"]] }]}
      empty={<p>No sponsors yet</p>}
    />,
  );
  return userEvent.setup();
}

const bodyRows = () => within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");

afterEach(cleanup);

describe("DataTable", () => {
  it("pages at 25 rows", () => {
    setup();
    expect(bodyRows()).toHaveLength(25);
    expect(screen.getByText("30 results")).toBeTruthy();
  });
  it("searches", async () => {
    const user = setup();
    await user.type(screen.getByRole("searchbox", { name: "Search sponsors" }), "hoka");
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText("Hoka")).toBeTruthy();
  });
  it("says so when a search matches nothing, and clears it", async () => {
    const user = setup();
    await user.type(screen.getByRole("searchbox", { name: "Search sponsors" }), "zzz");
    expect(screen.getByText("No results.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(bodyRows()).toHaveLength(25);
  });
  it("shows the empty state for an empty list", () => {
    setup([]);
    expect(screen.getByText("No sponsors yet")).toBeTruthy();
  });
  it("sorts by a column header", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /Sponsor/ }));
    expect(within(bodyRows()[0]).getByText("Hoka")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Sponsor/ }));
    expect(within(bodyRows()[0]).getByText("Sponsor 29")).toBeTruthy();
  });
  it("hides low-priority columns below md", () => {
    setup();
    const tierHeader = screen.getByRole("columnheader", { name: /Tier/ });
    expect(tierHeader.className).toContain("max-md:hidden");
  });
});
```

(The filter Select is exercised in the browser; Radix Select is unreliable in jsdom.)

Run → FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/data-table.ts
import {
  columnFilteringFeature, createColumnHelper, createFilteredRowModel, createPaginatedRowModel,
  createSortedRowModel, filterFn_equals, filterFn_includesString, globalFilteringFeature, metaHelper,
  rowPaginationFeature, rowSortingFeature, sortFn_alphanumeric, sortFn_basic, sortFn_text, tableFeatures,
} from "@tanstack/react-table";

/**
 * The feature set every admin list shares. Admin lists are tens to a few
 * hundred rows, already loaded by the server component, so search, filters,
 * sorting and pagination run on the client.
 */
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString, equals: filterFn_equals },
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  columnMeta: metaHelper<{
    /** Classes for the column's header and cells. */
    className?: string;
    /** "low": hidden below md, so a phone shows only what matters. */
    priority?: "low";
    /** The row's actions column (`RowActions`). */
    rowActions?: true;
  }>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

export function dataTableColumns<TData extends object>() {
  return createColumnHelper<DataTableFeatures, TData>();
}
```

```tsx
// src/components/app/data-table/TableToolbar.tsx
/** The row above a table: search and filters on the left, the primary action on the right; stacks on a phone. */
export function TableToolbar({ children, actions }: { children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
```

```tsx
// src/components/app/data-table/TablePagination.tsx
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TablePagination({
  total, page, pageCount, onPrevious, onNext,
}: { total: number; page: number; pageCount: number; onPrevious: () => void; onNext: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground tabular-nums">{total === 1 ? "1 result" : `${total} results`}</p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPrevious} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft aria-hidden /> Previous
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">{page} / {pageCount}</span>
          <Button variant="outline" size="sm" onClick={onNext} disabled={page >= pageCount} aria-label="Next page">
            Next <ChevronRight aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
```

`DataTable.tsx` (`"use client"`):
  - `useTable({ features: dataTableFeatures, columns, data, getRowId, globalFilterFn: "includesString", getColumnCanGlobalFilter: (c) => !c.columnDef.meta?.rowActions, initialState: { pagination: { pageIndex: 0, pageSize: pageSize ?? 25 }, sorting: initialSorting ?? [] } })`.
  - Search: when `search` is given, an `Input type="search" aria-label={search.label}` bound to `table.setGlobalFilter`; its value from `table.getState().globalFilter ?? ""`.
  - Filters: one shadcn `Select` per filter (`SelectTrigger aria-label={label}` with `className="w-full sm:w-auto"`), first item value `"all"` labelled `allLabel`; on change `table.getColumn(columnId)?.setFilterValue(v === "all" ? undefined : v)`.
  - Toolbar: `<TableToolbar actions={toolbar}>` with search and filters as children.
  - Header cells: when `header.column.getCanSort()`, render a `Button variant="ghost" size="sm"` with the header text and an `ArrowUpDown`/`ArrowUp`/`ArrowDown` icon (`aria-hidden`), `onClick={header.column.getToggleSortingHandler()}`; set `aria-sort` on the `TableHead`. Columns opt out with `enableSorting: false` (actions column).
  - Column classes: `cn(meta?.priority === "low" && "max-md:hidden", meta?.rowActions ? ROW_ACTIONS_CELL : PHONE_CELL, meta?.className)` on both `TableHead` and `TableCell`. Copy `PHONE_CELL` and `ROW_ACTIONS_CELL` (and their long comment) from `/Users/cfboy/Documents/GitHub/school-schedule/components/data-table/data-table.tsx`; keep the `@container` frame.
  - Body: rows from `table.getRowModel().rows`. Empty: if `data.length === 0` render one full-width cell with `empty`; else if no rows match render "No results." plus `<Button variant="link" onClick={() => { table.setGlobalFilter(""); table.resetColumnFilters(); }}>Clear search</Button>`.
  - Footer: `<TablePagination total={table.getFilteredRowModel().rows.length} page={pageIndex + 1} pageCount={table.getPageCount()} onPrevious={() => table.previousPage()} onNext={() => table.nextPage()} />`.
  - Render with `<table.FlexRender header={header} />` / `<table.FlexRender cell={cell} />` as in the school-schedule DataTable.

- [ ] **Step 4: Run** `pnpm vitest run src/components/app/data-table` → PASS. Commit the five files: "Admin lists share one searchable, sortable, paginated table".

---

### Task 9: ConfirmAction and ActionSwitch understand ActionResult

**Files:**
- Modify: `src/components/app/ConfirmAction.tsx`, `src/components/app/ConfirmAction.test.tsx`, `src/components/app/ActionSwitch.tsx`
- Create: `src/components/app/ActionSwitch.test.tsx`

**Interfaces:**
- Consumes: `ActionResult`.
- Produces: `ConfirmAction.onConfirm: () => Promise<unknown>` — a resolved `{ ok: false, message }` now counts as a failure (toast, stays open); `{ ok: true, data: { href } }` navigates with `router.push(href)`. `ActionSwitch.action: (next: boolean) => Promise<unknown>` — a resolved `{ ok: false }` flips back and toasts.

- [ ] **Step 1: Failing tests.** Add to `ConfirmAction.test.tsx` (add `vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push, refresh: vi.fn() }) }))` with `const push = vi.hoisted(() => vi.fn())` at the top):

```tsx
it("treats a returned failure like a thrown one", async () => {
  const onConfirm = vi.fn().mockResolvedValue({ ok: false, message: "That person isn't on this team." });
  render(<ConfirmAction trigger="Remove" title="Remove?" description="d" confirmLabel="Remove it" onConfirm={onConfirm} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Remove" }));
  await user.click(screen.getByRole("button", { name: "Remove it" }));
  await waitFor(() => expect(toastError).toHaveBeenCalledWith("That person isn't on this team."));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
});

it("goes where a successful result says", async () => {
  const onConfirm = vi.fn().mockResolvedValue({ ok: true, data: { href: "/admin" } });
  render(<ConfirmAction trigger="Delete" title="Delete?" description="d" confirmLabel="Delete it" onConfirm={onConfirm} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Delete" }));
  await user.click(screen.getByRole("button", { name: "Delete it" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
});
```

Create `ActionSwitch.test.tsx` with one test: `action` resolving `{ ok: false, message: "Another active sponsor already holds this sponsor's exclusive category." }` → after clicking the switch, `toast.error` is called with that message and the switch's `aria-checked` returns to `"false"`.

Run → FAIL.

- [ ] **Step 2: Implement.** In `ConfirmAction.handleConfirm`, after `const result = await onConfirm();` add:

```ts
if (isFailure(result)) {
  toast.error(result.message);
  return; // stays open to retry
}
const href = hrefOf(result);
setOpen(false);
if (href) router.push(href);
```

with local helpers (also used by ActionSwitch — put them in `src/lib/action-result.ts` and export them):

```ts
export function isFailure(value: unknown): value is ActionFailure {
  return typeof value === "object" && value !== null && (value as { ok?: unknown }).ok === false;
}
export function hrefOf(value: unknown): string | undefined {
  const data = (value as { ok?: boolean; data?: { href?: unknown } } | null)?.data;
  return (value as { ok?: boolean } | null)?.ok === true && typeof data?.href === "string" ? data.href : undefined;
}
```

`ConfirmAction` gets `const router = useRouter();` from `next/navigation`. In `ActionSwitch`, after `const result = await action(next);` add `if (isFailure(result)) { toast.error(result.message); setOptimistic(checked); }` — the optimistic value also reverts when the transition ends because `checked` is unchanged.

- [ ] **Step 3: Run** `pnpm vitest run src/components/app` → PASS (old and new tests). Commit: "Confirmations and switches understand returned failures and destinations".

---

### Task 10: DetailHeader and LinkTabs

**Files:**
- Create: `src/components/app/DetailHeader.tsx`, `src/components/app/LinkTabs.tsx`, `src/components/app/LinkTabs.test.tsx`, `src/lib/tabs.ts`

**Interfaces:**
- Produces:
  - `DetailHeader({ title: string; subtitle?: ReactNode; media?: ReactNode; actions?: ReactNode; breadcrumb?: ReactNode })` — server-safe; title is the page `h1` (`font-display text-3xl uppercase`), media is an avatar/icon slot, actions sit right and wrap below on a phone.
  - `LinkTabs({ tabs: readonly { value: string; label: string }[]; current: string; children: ReactNode; label: string })` — `"use client"`; renders shadcn `Tabs` with `value={current}`; each `TabsTrigger` is `asChild` around a `Link href={`?tab=${value}`} scroll={false}`; the list scrolls horizontally on a phone (`max-sm:overflow-x-auto`). Pages read `searchParams.tab`, validate it against their tab list (default first), and render only the current tab's content inside `TabsContent value={current}`.

- [ ] **Step 1: Failing test** (`LinkTabs.test.tsx`, jsdom, mock `next/link` to a plain `<a>`): renders three tabs with `current="performance"`; asserts the "Performance" tab has `aria-selected="true"` and that the "Profile" link's `href` is `?tab=profile`.

- [ ] **Step 2: Implement both components**

```tsx
// src/components/app/DetailHeader.tsx
/** The top of a long record: media, the page's h1, a subtitle, and its actions. */
export function DetailHeader({
  title, subtitle, media, actions, breadcrumb,
}: { title: string; subtitle?: React.ReactNode; media?: React.ReactNode; actions?: React.ReactNode; breadcrumb?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      {breadcrumb}
      <div className="flex flex-wrap items-center gap-4">
        {media ? <div className="shrink-0">{media}</div> : null}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-balance">{title}</h1>
          {subtitle ? <p className="mt-1 text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div> : null}
      </div>
    </div>
  );
}
```

```tsx
// src/components/app/LinkTabs.tsx
"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Tabs whose state is the URL (?tab=), so a tab can be linked, shared and
 * gone back to. The page validates `current` and renders only that tab.
 */
export function LinkTabs({
  tabs, current, label, children,
}: { tabs: readonly { value: string; label: string }[]; current: string; label: string; children: React.ReactNode }) {
  return (
    <Tabs value={current}>
      <TabsList aria-label={label} className="max-sm:w-full max-sm:justify-start max-sm:overflow-x-auto">
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value} asChild className="max-sm:min-h-11">
            <Link href={`?tab=${t.value}`} scroll={false}>{t.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={current} className="pt-4">{children}</TabsContent>
    </Tabs>
  );
}
```

```ts
// src/lib/tabs.ts — plain module, so server pages can call it
/** The requested tab if it exists, else the first. */
export function pickTab<T extends string>(tabs: readonly { value: T }[], requested: string | undefined): T {
  return tabs.find((t) => t.value === requested)?.value ?? tabs[0].value;
}
```

- [ ] **Step 3: Run** → PASS. Commit: "Long records have a shared header and linkable tabs".

---

### Task 11: Guard rules for actions and vaul

**Files:**
- Modify: `src/lib/design/uiGuard.ts`, `src/lib/design/uiGuard.test.ts`, `scripts/ui-guard.ts`

**Interfaces:**
- Produces: `ACTION_RESULT_FILES: readonly string[]` (repo-relative paths; starts empty, each migration appends), rule ids `action-throw` and `vaul`; rules may declare `appliesTo?: (file: string) => boolean`.

- [ ] **Step 1: Failing tests** in `uiGuard.test.ts`:

```ts
it("rejects a user-facing throw in a migrated action file", () => {
  const file = "src/lib/actions/example.ts";
  expect(checkSource(file, 'throw new Error("Nope.");', [file]).map((v) => v.rule)).toEqual(["action-throw"]);
  expect(checkSource(file, "throw new Error(error.message);", [file])).toEqual([]);
  expect(checkSource("src/lib/actions/other.ts", 'throw new Error("Nope.");', [file])).toEqual([]);
});
it("rejects vaul", () => {
  expect(rules('import { Drawer } from "vaul";')).toEqual(["vaul"]);
});
```

(`checkSource(file, text, actionFiles = ACTION_RESULT_FILES)` gains the optional third parameter so tests don't depend on the live list.)

- [ ] **Step 2: Implement**: extend the rule type with `appliesTo?: (file: string, ctx: { actionFiles: readonly string[] }) => boolean`; add

```ts
{ id: "action-throw", pattern: /\bthrow new (?:Validation)?Error\(\s*["'`]/, message: "Return fail(\"…\") from a migrated action; throwing loses the message in production.", appliesTo: (file, { actionFiles }) => actionFiles.includes(file) },
{ id: "vaul", pattern: /from ["']vaul["']/, message: "Use the Base UI Drawer in src/components/ui/drawer.tsx." },
```

and `export const ACTION_RESULT_FILES: readonly string[] = [];`. In `scripts/ui-guard.ts` add `src/lib/actions` to the default roots and pass repo-relative paths to `checkSource`.

- [ ] **Step 3: Run** `pnpm vitest run src/lib/design && pnpm ui:guard` → PASS / clean. Commit: "The guard keeps migrated actions from throwing user messages and keeps vaul out".

---

### Task 12: Sponsors pilot

**Files:**
- Modify: `src/lib/actions/sponsors.ts`, `src/app/(app)/admin/sponsors/page.tsx`, `src/lib/design/uiGuard.ts` (`ACTION_RESULT_FILES`)
- Create: `src/lib/actions/sponsors.test.ts`, `src/lib/actions/testing/fakeSupabase.ts`, `src/app/(app)/admin/sponsors/SponsorsTable.tsx`, `src/app/(app)/admin/sponsors/SponsorForm.tsx`, `src/app/(app)/admin/sponsors/tiers.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–11.
- Produces: `createSponsor(formData: FormData): Promise<ActionResult>`, `toggleSponsorActive(sponsorId: string, active: boolean): Promise<ActionResult>`; `fakeSupabase(responses)` test helper (used by every later action test); `TIER_LABELS` moved to `tiers.ts`.

- [ ] **Step 1: The fake Supabase helper + failing action tests**

```ts
// src/lib/actions/testing/fakeSupabase.ts
import { vi } from "vitest";

type Response = { data?: unknown; error?: { message: string; code?: string } | null };

/**
 * A chainable stand-in for the Supabase query builder. Each awaited query
 * resolves to the next response for its table, in call order:
 *   fakeSupabase({ sponsors: [{ error: { message: "… sponsors_category_exclusive_uidx …" } }] })
 * `calls` records [table, method, args] for assertions.
 */
export function fakeSupabase(responses: Record<string, Response[]>) {
  const calls: Array<[string, string, unknown[]]> = [];
  const queues = Object.fromEntries(Object.entries(responses).map(([t, r]) => [t, [...r]]));
  function builder(table: string) {
    const next = () => queues[table]?.shift() ?? { data: null, error: null };
    const proxy: Record<string, unknown> = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === "then") {
          const r = next();
          return (resolve: (v: unknown) => void) => resolve({ data: r.data ?? null, error: r.error ?? null });
        }
        return (...args: unknown[]) => { calls.push([table, prop, args]); return proxy; };
      },
    });
    return proxy;
  }
  return { client: { from: vi.fn((table: string) => builder(table)) }, calls };
}
```

```ts
// src/lib/actions/sponsors.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireOrgManager: async () => ({ organizationId: "org-1" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createSponsor, toggleSponsorActive } from "./sponsors";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("createSponsor", () => {
  it("reports a missing name on its field", async () => {
    db.current = fakeSupabase({}).client;
    expect(await createSponsor(form({ business_name: "" }))).toEqual({
      ok: false, message: "Business name is required.", fieldErrors: { business_name: ["Business name is required."] },
    });
  });
  it("reports an exclusive category already held", async () => {
    db.current = fakeSupabase({
      events: [{ data: { id: "ev-1" } }],
      sponsors: [{ error: { message: 'duplicate key value violates unique constraint "sponsors_category_exclusive_uidx"' } }],
    }).client;
    expect(await createSponsor(form({ business_name: "Hoka", category: "Shoes", category_exclusive: "on", event_id: "00000000-0000-0000-0000-000000000010" }))).toEqual({
      ok: false, message: 'Another active sponsor already holds exclusive category "Shoes" for this event.',
    });
  });
  it("adds a sponsor", async () => {
    db.current = fakeSupabase({ sponsors: [{ error: null }] }).client;
    expect(await createSponsor(form({ business_name: "Hoka" }))).toEqual({ ok: true });
  });
});

describe("toggleSponsorActive", () => {
  it("reports the exclusive-category clash", async () => {
    db.current = fakeSupabase({ sponsors: [{ error: { message: "sponsors_category_exclusive_uidx" } }] }).client;
    expect(await toggleSponsorActive("s-1", true)).toEqual({
      ok: false, message: "Another active sponsor already holds this sponsor's exclusive category.",
    });
  });
});
```

Run: `pnpm vitest run src/lib/actions/sponsors.test.ts` → FAIL (actions throw / return undefined).

(If `field.optionalId` rejects the sample event id format, use a uuid the schema accepts — read `src/lib/validation/form.ts`.)

- [ ] **Step 2: Convert the actions**

```ts
export async function createSponsor(formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    const f = parseForm(SponsorForm, formData);
    const supabase = await createClient();

    if (f.event_id) {
      const { data: event, error: eventError } = await supabase
        .from("events").select("id").eq("id", f.event_id).eq("organization_id", organizationId).maybeSingle();
      if (eventError) throw new Error(eventError.message);
      if (!event) return fail("That event doesn't belong to your organization.", { event_id: ["Choose one of your events."] });
    }

    const { error } = await supabase.from("sponsors").insert({
      organization_id: organizationId, business_name: f.business_name, tier: f.tier, category: f.category,
      category_exclusive: f.category_exclusive, website: f.website, event_id: f.event_id,
    });
    if (error) {
      if (error.message.includes("sponsors_category_exclusive_uidx")) {
        return fail(`Another active sponsor already holds exclusive category "${f.category}" for this event.`);
      }
      throw new Error(error.message);
    }
    revalidatePath("/admin/sponsors");
    return ok();
  });
}

export async function toggleSponsorActive(sponsorId: string, active: boolean): Promise<ActionResult> {
  return safeAction(async () => {
    const { organizationId } = await requireOrgManager();
    if (typeof active !== "boolean") return fail("Invalid sponsor status.");
    const supabase = await createClient();
    const res = await supabase.from("sponsors").update({ active }).eq("id", sponsorId).eq("organization_id", organizationId).select("id");
    if (res.error?.message.includes("sponsors_category_exclusive_uidx")) {
      return fail("Another active sponsor already holds this sponsor's exclusive category.");
    }
    expectChanged(res, "update the sponsor");
    revalidatePath("/admin/sponsors");
    return ok();
  });
}
```

Imports: `import { type ActionResult, fail, ok } from "@/lib/action-result";` and `import { safeAction } from "./safeAction";`. Append `"src/lib/actions/sponsors.ts"` to `ACTION_RESULT_FILES`.

Run the test → PASS.

- [ ] **Step 3: tiers.ts** — move `TIER_LABELS` from the page to `src/app/(app)/admin/sponsors/tiers.ts` (`export const TIER_LABELS: Record<SponsorTier, string> = {…}` unchanged) plus `export const TIER_OPTIONS = Object.entries(TIER_LABELS) as [SponsorTier, string][];`.

- [ ] **Step 4: SponsorForm.tsx**

```tsx
"use client";

import { createSponsor } from "@/lib/actions/sponsors";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { NONE } from "@/lib/validation/none";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIER_OPTIONS } from "./tiers";

export function SponsorForm({ events, close }: { events: { id: string; name: string }[]; close: () => void }) {
  const save = useServerAction(createSponsor, { success: "Sponsor added", toastErrors: false, onSuccess: close });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }}
    >
      <FormField label="Business name" name="business_name" errors={errors?.business_name}>
        {(c) => <Input {...c} required autoComplete="organization" />}
      </FormField>
      <FormField label="Tier" name="tier" errors={errors?.tier}>
        {({ name, ...c }) => (
          <Select name={name} defaultValue="logo_sponsor">
            <SelectTrigger {...c} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIER_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField label="Event" name="event_id" errors={errors?.event_id}>
        {({ name, ...c }) => (
          <Select name={name} defaultValue={NONE}>
            <SelectTrigger {...c} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All events</SelectItem>
              {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField label="Category" name="category" errors={errors?.category}>
        {(c) => <Input {...c} placeholder="Physical Therapy" />}
      </FormField>
      <div className="flex items-center gap-2">
        <Checkbox id="sponsor-exclusive" name="category_exclusive" />
        <Label htmlFor="sponsor-exclusive">Category exclusive</Label>
      </div>
      <FormField label="Website" name="website" errors={errors?.website}>
        {(c) => <Input {...c} type="url" inputMode="url" placeholder="https://" />}
      </FormField>
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel="Adding…">Add sponsor</SubmitButton>
    </form>
  );
}
```

(If `type="url"` would reject values the schema accepts today, keep `type="text"` — the field must accept what it accepted before.)

- [ ] **Step 5: SponsorsTable.tsx**

```tsx
"use client";

import { BadgeDollarSign, Plus } from "lucide-react";
import type { SponsorTier } from "@/lib/db/database.types";
import { toggleSponsorActive } from "@/lib/actions/sponsors";
import { dataTableColumns } from "@/lib/data-table";
import { ActionSwitch } from "@/components/app/ActionSwitch";
import { DataTable } from "@/components/app/data-table/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { FormDialog } from "@/components/app/FormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SponsorForm } from "./SponsorForm";
import { TIER_LABELS, TIER_OPTIONS } from "./tiers";

export type SponsorRow = {
  id: string; business_name: string; tier: SponsorTier; category: string | null;
  category_exclusive: boolean; active: boolean; eventName: string;
};

const col = dataTableColumns<SponsorRow>();

const columns = [
  col.accessor("business_name", {
    header: "Sponsor",
    cell: ({ row }) => (
      <span className="flex flex-wrap items-center gap-2 font-semibold">
        {row.original.business_name}
        {row.original.category_exclusive ? (
          <Badge variant="outline" className="uppercase text-brand-text">Exclusive · {row.original.category}</Badge>
        ) : null}
      </span>
    ),
  }),
  col.accessor("tier", { header: "Tier", filterFn: "equals", cell: ({ getValue }) => TIER_LABELS[getValue()] }),
  col.accessor("category", { header: "Category", meta: { priority: "low" }, cell: ({ getValue }) => getValue() ?? "—" }),
  col.accessor("eventName", { header: "Event", meta: { priority: "low" } }),
  col.accessor((r) => (r.active ? "active" : "inactive"), {
    id: "active",
    header: "Active",
    filterFn: "equals",
    enableSorting: false,
    cell: ({ row }) => (
      <ActionSwitch
        checked={row.original.active}
        action={toggleSponsorActive.bind(null, row.original.id)}
        label={`${row.original.business_name} active`}
      />
    ),
  }),
];

export function SponsorsTable({ rows, events }: { rows: SponsorRow[]; events: { id: string; name: string }[] }) {
  const add = (
    <FormDialog
      title="Add sponsor"
      description='Category-exclusive sponsors (e.g. "Official Physical Therapy Partner") are enforced per event.'
      trigger={<Button><Plus aria-hidden /> Add sponsor</Button>}
    >
      {(close) => <SponsorForm events={events} close={close} />}
    </FormDialog>
  );
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      search={{ label: "Search sponsors", placeholder: "Search sponsors…" }}
      filters={[
        { columnId: "tier", label: "Tier", allLabel: "All tiers", options: TIER_OPTIONS },
        { columnId: "active", label: "Status", allLabel: "Active and inactive", options: [["active", "Active"], ["inactive", "Inactive"]] },
      ]}
      toolbar={add}
      empty={<EmptyState icon={BadgeDollarSign} title="No sponsors yet" description="Add your first sponsor." action={add} />}
    />
  );
}
```

- [ ] **Step 6: page.tsx** — keep the two queries; build rows and render:

```tsx
const eventName = new Map((events ?? []).map((e) => [e.id, e.name]));
const rows: SponsorRow[] = (sponsors ?? []).map((s) => ({
  id: s.id, business_name: s.business_name, tier: s.tier as SponsorTier, category: s.category,
  category_exclusive: s.category_exclusive, active: s.active,
  eventName: s.event_id ? (eventName.get(s.event_id) ?? "Unknown event") : "All events",
}));
return (
  <div className="flex flex-col gap-6">
    <PageHeader title="Sponsors" description="RepOneLive inventory tiers. Category exclusivity is enforced per event." />
    <SponsorsTable rows={rows} events={events ?? []} />
  </div>
);
```

Remove the old form, card list and unused imports.

- [ ] **Step 7: Check** — `pnpm check` → passes; `pnpm build` → succeeds.

- [ ] **Step 8: Browser verification** (dev server on :3200, sign in as `admin@repone.test`):
  1. 1440×900 `/admin/sponsors`: table renders; search "a" filters; Tier filter narrows; sort by Sponsor toggles. Screenshot `.verify/admin-pr1/sponsors-1440.png`.
  2. "Add sponsor" opens a centered dialog; submit with name only → toast "Sponsor added", dialog closes, row appears.
  3. Create two exclusive sponsors with category "Shoes" for the same event → second shows "Another active sponsor already holds exclusive category "Shoes" for this event." inside the dialog; dialog stays open. Screenshot `sponsors-error-1440.png`.
  4. Remove `required` from the name input in DevTools and submit blank → "Business name is required." under the field.
  5. 390×844: toolbar stacks, Category and Event columns hidden, the "Add sponsor" opens a bottom drawer. Screenshot `sponsors-390.png`.
  6. **Keyboard case, 390×400:** open the drawer, focus Website (last field) → the "Add sponsor" submit button is visible (scroll inside the drawer body allowed) and tapping it saves. Screenshot `sponsors-keyboard-390x400.png`.
  7. Toggle a sponsor active off and on → toasts; a clash reverts the switch with the message.
  8. Close every page and the browser. Delete the test sponsors through the UI or `psql` on the local DB.

- [ ] **Step 9: Commit** — stage the files listed above: "Sponsors are a searchable table with add in a dialog that is a drawer on a phone".

### Task 13: PR 1

- [ ] **Step 1:** `pnpm check && pnpm build` → pass. Run all db checks: `pnpm db:rls-check && pnpm db:authz-check` (and the others in `package.json` `db:*`) → pass.
- [ ] **Step 2:** `git push -u origin feat/admin-data-screens`.
- [ ] **Step 3:** Open the PR:

```bash
gh pr create --base staging --title "Admin has shared table, dialog and action foundations, piloted on Sponsors" --body "<what/why/how-verified; foundations list; Sponsors before/after; the 390×400 keyboard result; screenshots from .verify/admin-pr1 (drag into the PR description); test counts>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 4:** Stop and report the PR link. Parts 2–4 continue on new branches from updated `staging` after it merges: `feat/admin-org-lists`, `feat/admin-event-lists`, `feat/admin-details`.

---

# Part 2 — Organization lists (PR 2, branch `feat/admin-org-lists`)

Each task follows the **Screen migration recipe**. Inventory sections are named per task.

### Task 14: Members (`/admin/team`)

**Files:** `src/lib/actions/team.ts` (+ `team.test.ts`), `src/app/(app)/admin/team/page.tsx`, create `MembersTable.tsx`, `InviteMemberForm.tsx`.
**Inventory:** "/admin/team".
**Actions:** `inviteTeamMember(formData)`, `resendTeamInvite(userId)`, `removeTeamRole(memberId, role)` → `ActionResult` (drop `_previous`; `inviteMessage` returns `okMessage(...)`/`fail(...)`). Tests: "That person isn't on this team.", "The organization must keep an owner." (APIError code `YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER`), success message "Invitation sent." surfaced as `message`.
**Columns:** Member (name; email under it when different) · Roles (one Badge per role, high) · Status (Pending/Active) · Joined (`formatDay`, low).
**Search:** name/email. **Filters:** role (ORG_ROLES labels), status (pending/active).
**Toolbar:** "Invite member" → FormDialog (`email`, `role` Select of INVITABLE). Success toast uses the returned `message`.
**Row actions:** primary "Resend invite" (only when pending); secondary none; destructive one "Remove <Role>" per role, each a ConfirmAction (title `Remove <role> from <name>?`, description as today).
**Then:** delete `InviteByEmailForm`/`InlineActionButton`/`ConfirmFormResultAction` usages here; keep `src/components/InviteForms.tsx` until Task 24 removes the last user, then delete it.

### Task 15: Events (`/admin`)

**Files:** `src/lib/actions/events.ts`, `src/lib/actions/org.ts` (+ tests), `src/app/(app)/admin/page.tsx`, `DeleteEventButton.tsx`, create `EventsTable.tsx`, `NewEventForm.tsx`, `CoverPhotoForm.tsx`, `BootstrapOrgForm.tsx`.
**Inventory:** "/admin".
**Actions:** `bootstrapOrganization`, `createEvent` (→ `ok({ href: "/admin/events/<id>" })`), `uploadEventCoverPhoto`, `removeEventCoverPhoto`, `deleteEvent` (→ `ok({ href: "/admin" })`), `updateEventStatus` (used in Task 32; convert now). Tests: "Circuit name is required when starting a new circuit." on `new_circuit_name`; createEvent success returns `data.href`; deleteEvent returns `{ href: "/admin" }`.
**Columns:** Event (cover thumbnail 40×40 + name, links to `/admin/events/<id>`) · Status (Badge) · Dates (`formatDayRange`) · Circuit (low).
**Search:** name. **Filters:** status (draft/scheduled/live/completed/archived), circuit.
**Initial sort:** none (server order: newest first).
**Toolbar:** "New event" → FormDialog with today's fields; on success `router.push(data.href)` (use `onSuccess` in `useServerAction`, `refresh: false`).
**Row actions:** primary "Open" (href); secondary "Change cover photo" (FormDialog with file input; `uploadEventCoverPhoto`); destructive "Remove cover photo" (only when present), "Delete event" (ConfirmAction with today's text; `DeleteEventButton` becomes a thin wrapper used by the overview page).
**Bootstrap form:** when there is no organization, `BootstrapOrgForm` (client, `useServerAction`) replaces the page as today.

### Task 16: Athletes (`/admin/athletes`)

**Files:** `src/lib/actions/athletes.ts` (create/delete only now; the rest in Task 29) (+ tests), `athletes/page.tsx`, create `AthletesTable.tsx`, `AthleteForm.tsx` (shared with Task 29's Edit).
**Inventory:** "/admin/athletes".
**Actions:** `createAthlete`, `deleteAthlete`. Tests: duplicate email → "An athlete with this email already exists in your organization." with `fieldErrors.email`; duplicate phone → message on `phone`.
**Columns:** Athlete (avatar + name, link to detail) · Affiliate · Age category (computed as today) · Gender (low).
**Search:** name, affiliate. **Filters:** gender, age category.
**Toolbar:** "Add athlete" → FormDialog (today's fields; `type="email"`, `type="tel"`, `inputMode` set).
**Row actions:** primary "Open" (href); destructive "Remove" (ConfirmAction, today's text).

### Task 17: Circuits (`/admin/circuits`)

**Files:** `src/lib/actions/circuits.ts` (create/delete now; add/remove event in Task 30) (+ tests), `circuits/page.tsx`, create `CircuitsTable.tsx`, `CircuitForm.tsx`.
**Inventory:** "/admin/circuits".
**Actions:** `createCircuit` (→ `ok({ href: "/admin/circuits/<id>" })`), `deleteCircuit` (→ `ok({ href: "/admin/circuits" })`).
**Columns:** Circuit (link) · Events (count) · Season (`formatDayRange(starts_on, ends_on, " → ")`) · Description (low; now shown).
**Search:** name. **Toolbar:** "New circuit" → FormDialog; on success navigate to `data.href`.
**Row actions:** primary "Open"; destructive "Delete circuit" (ConfirmAction).

### Task 18: Teams (`/admin/teams`)

**Files:** `src/lib/actions/teams.ts` (+ tests), `teams/page.tsx`, create `TeamsTable.tsx`, `TeamForm.tsx`, `AddRosterMemberForm.tsx`.
**Inventory:** "/admin/teams".
**Actions:** `createTeam`, `deleteTeam`, `addTeamMember`, `removeTeamMember`. Tests: "That athlete is already on this team's roster.", "Headcount must be a whole number." on `team_size`.
**Columns:** Team (name + affiliate under it) · Format · Roster (Badges with names; each Badge has an X button opening a ConfirmAction "Remove <athlete> from <team>?") · Spots (`M / N`, low).
**Search:** name, affiliate, roster names. **Filters:** format (pair/team/custom).
**Toolbar:** "New team" → FormDialog.
**Row actions:** primary "Add to roster" (FormDialog with the athlete Select; disabled with hint "Everyone is on the roster" when none available); destructive "Delete team".

### Task 19: PR 2

Same as Task 13 with: screenshots in `.verify/admin-pr2/` (each screen at 1440 and 390, one create/edit/delete flow on Teams, the 390×400 keyboard check on "New event"), branch `feat/admin-org-lists`, title "Organization lists in admin are tables with dialogs for create and edit". Stop at the PR link.

---

# Part 3 — Event lists (PR 3, branch `feat/admin-event-lists`)

### Task 20: Divisions

**Files:** `src/lib/actions/divisions.ts` (+ tests), `EV/divisions/page.tsx`, create `DivisionsTable.tsx`.
**Inventory:** "/admin/events/[eventId]/divisions". **Actions:** `createDivision`, `deleteDivision`.
**Columns:** Division. **Toolbar:** "Add division" → FormDialog (`name`). **Row actions:** destructive "Remove" (ConfirmAction, today's warning). No search (short list): omit `search`.

### Task 21: Venues

**Files:** `src/lib/actions/venues.ts` (+ tests), `EV/venues/page.tsx`, create `VenuesTable.tsx`.
**Inventory:** ".../venues". **Actions:** `addFloor` (test: "That venue doesn't belong to this event.").
**Columns:** Venue · Floors (Badges in `sort_order`). No search. **Row actions:** primary "Add floor" → FormDialog (`name`, placeholder "Floor B"). Add an `EmptyState` "No venues yet" (none exists today).

### Task 22: WODs

**Files:** `src/lib/actions/wods.ts` (+ tests), `EV/wods/page.tsx`, create `WodsTable.tsx`, `WodForm.tsx` (create and edit).
**Inventory:** ".../wods". **Actions:** `createWod`, `updateWod`, `deleteWod`.
**Columns:** WOD · Scoring · Time cap (`N min` or "—") · Tie-break (low) · Description (low, truncated with `title`).
**Search:** name. **Filter:** scoring type. **Toolbar:** "Add WOD". **Row actions:** primary "Edit" (FormDialog with the row's values; keep the hidden `rules` input); destructive "Remove".

### Task 23: Fees

**Files:** `src/lib/actions/fees.ts` (+ tests), `EV/fees/page.tsx`, create `FeesTable.tsx`, `FeeForm.tsx`.
**Inventory:** ".../fees". **Actions:** `createFeeSchedule` (tests: "Enter a valid fee amount." on `amount_dollars`), `toggleFeeScheduleActive`, `deleteFeeSchedule`.
**Columns:** Fee (name + Add-on Badge) · Amount (`$x.xx`, tabular) · Division · Entry type · Description (low) · Active (ActionSwitch).
**Filters:** active, division, entry type. **Toolbar:** "Add fee". **Row actions:** destructive "Delete".

### Task 24: Staff

**Files:** `src/lib/actions/eventStaff.ts` (+ tests), `EV/staff/page.tsx`, create `StaffTable.tsx`, `InviteStaffForm.tsx`; delete `src/components/InviteForms.tsx` when unused.
**Inventory:** ".../staff". **Actions:** `inviteEventStaff(role, eventId, formData)`, `resendEventInvite(eventId, userId)`, `removeEventScorekeeper|Producer|Commentator(eventId, assignmentId)`. Tests: "They have already signed in; there's nothing to resend."
**One table:** Name (email under it) · Role (Scorekeeper/Producer/Commentator) · Role label (low) · Status (Pending/Active).
**Filter:** role. **Toolbar:** "Invite staff" → FormDialog with `role` Select (scorekeeper/producer/commentator), `email`, and `roleLabel` shown only when role is commentator; the form calls `inviteEventStaff(role, eventId, fd)` with the chosen role.
**Row actions:** primary "Resend invite" (pending only); destructive "Remove from event" (ConfirmAction).

### Task 25: Event athletes (registrations)

**Files:** `src/lib/actions/registrations.ts` (+ tests), `EV/athletes/page.tsx`, `EV/athletes/RegisterForms.tsx` → split into `RegisterAthleteForm.tsx`, `RegisterTeamForm.tsx`, create `RegistrationsTable.tsx`.
**Inventory:** ".../athletes". **Actions:** `registerAthlete(eventId, formData)`, `registerTeam(eventId, formData)` (drop `_prevState`; return `fail(...)` instead of `{ error }`), `removeRegistration`. Tests: "This athlete is already registered in this division/category."; the division cookie is still set on success.
**Columns:** Competitor (name + affiliate) · Type (Individual / entry format) · Division · Bib (tabular) · Age category (low).
**Search:** name, bib. **Filters:** division, type. **Initial sort:** division order, then name.
**Toolbar:** "Register athlete" and "Register team" → two FormDialogs (today's fields and empty-state links). **Row actions:** destructive "Remove".

### Task 26: Payments

**Files:** `src/lib/actions/payments.ts` (+ tests), `EV/payments/page.tsx`, create `PaymentsTable.tsx`, `PaymentForm.tsx`.
**Inventory:** ".../payments". **Actions:** `updateRegistrationPayment`, `markPaymentStatus`, `markPaymentStatusForCheckin` (Task 34 uses it; convert now). Tests: "Enter a valid amount." on `amount_dollars`; "That registration isn't part of this event."
**Above the table:** keep the online-payments banner and the Collected / Outstanding cards.
**Columns:** Competitor · Type (low) · Division · Bib (low) · Status (Badge with today's styles) · Amount · Method (low) · Notes (low).
**Search:** name, bib, notes. **Filters:** status, division, type.
**Row actions:** primary "Mark paid" (hidden when paid); secondary "Waive", "Edit payment" (FormDialog with today's five fields, defaults from the row); destructive "Refunded", "Reset to unpaid" (ConfirmAction, today's text).

### Task 27: Heats

**Files:** `src/lib/actions/heats.ts` (`createHeat`, `deleteHeat`, `generateHeats`) (+ tests), `EV/heats/page.tsx`, create `HeatsTable.tsx`, `GenerateHeatsForm.tsx`, `AddHeatForm.tsx`.
**Inventory:** ".../heats". Tests: generateHeats "Heats already exist for this WOD/Division — …" and "No registered athletes/teams found for this division — register participants first."
**Columns:** Heat ("<WOD> — Heat n / N", link) · Status (Completed / Next up / Pending) · Division · Floor · Start (`formatTime`, low) · Lanes (low).
**Filters:** WOD, division, floor, status. **Default order:** today's running order (pass rows pre-sorted; no `initialSorting`).
**Toolbar:** "Generate heats" (primary) and "Add single heat" (outline) → FormDialogs with today's fields; `datetime-local` stays native. Keep the "Not ready for heats yet" EmptyState with its links.
**Row actions:** primary "Open"; destructive "Remove".

### Task 28: PR 3

Same as Task 13 with screenshots in `.verify/admin-pr3/` (every screen at 1440 and 390; Payments "Edit payment" round-trip; the 390×400 keyboard check on "Edit payment"), branch `feat/admin-event-lists`, title "Event lists in admin are tables with dialogs for create and edit".

---

# Part 4 — Details and the rest (PR 4, branch `feat/admin-details`)

### Task 29: Athlete detail

**Files:** `src/lib/actions/athletes.ts` (remaining: `updateAthleteProfile`, `saveAthleteLifts`, `upsertAthleteBenchmark`, `deleteAthleteBenchmark`, `uploadAthletePhoto`, `removeAthletePhoto`) (+ tests), `athletes/[athleteId]/page.tsx`, create the tab sections `ProfileTab.tsx`, `PerformanceTab.tsx` (lifts form + benchmarks table), `CompetitionsTab.tsx`.
**Inventory:** "/admin/athletes/[athleteId]". Tests: "<Label> must be a time like mm:ss." on that lift's field.
**Header:** `DetailHeader` — avatar (photo), name, subtitle "affiliate · age category", actions: "Edit profile" (FormDialog reusing `AthleteForm` from Task 16 with defaults), "Check-in QR" (Dialog showing the QR at 220px + "Open Check-In screen" link), "Message" (link, or disabled with today's hint), photo menu (Upload/Remove photo).
**Tabs (`?tab=`):** Profile (read-only definition list: email, phone, date of birth, gender, affiliate) · Performance (lifts form inline — it is the content of the tab, saved with `SubmitButton`; benchmarks as a small `DataTable` without search, toolbar "Add benchmark" FormDialog, row destructive "Remove") · Competitions (`DataTable`: Event, Division, Overall, Points, per-WOD placements as Badges; no search).

### Task 30: Circuit detail

**Files:** `src/lib/actions/circuits.ts` (`addEventToCircuit`, `removeEventFromCircuit`) (+ tests), `circuits/[circuitId]/page.tsx`, create `CircuitEventsTable.tsx`.
**Header:** `DetailHeader` (name, subtitle description + season), actions "Public leaderboard" (new tab), "Add event" (FormDialog; disabled with hint when no standalone events).
**Tabs:** Events (`DataTable`: Event link, Status, Dates; row destructive "Remove from circuit") · Standings (today's per-division leaderboard tables, unchanged, with a division `Select` above when more than one).

### Task 31: Heat detail

**Files:** `src/lib/actions/lanes.ts` (`assignLane(eventId, heatId, laneId, formData)`), `src/lib/actions/results.ts` (`saveHeatResults` → `ok({ href })`) (+ tests), `EV/heats/[heatId]/page.tsx`, `LaneAssignmentForm.tsx`.
**Decision (spec §1 rule):** `LaneAssignmentForm` stays FormData + zod — each lane is a single Select saved on its own, not a growing list. It moves from `useActionState` to `useServerAction`.
**Header:** `DetailHeader` ("<WOD> — Heat n / N", subtitle "division · floor · scoring · cap"), actions Previous/Next heat links.
**Tabs:** Lanes (one row per lane: lane number, athlete Select, Save; conflict styling unchanged) · Results (today's bulk form unchanged in content; submit via `useServerAction`; on success navigate to `data.href`) · Standings (small `DataTable`: Place, Athlete, Points; only if rows).
Tests: lanes "This athlete is already assigned to Lane {n} in this heat ({category}) — remove them from that lane first."; results returns `data.href === "/admin/events/<eventId>/heats"`.

### Task 32: Event overview

**Files:** `EV/page.tsx`, `DeleteEventButton.tsx`, create `EventStatusControl.tsx`.
**Header:** `DetailHeader` (event name, dates via `formatDayRange(…, " → ")`, circuit link), actions "Public leaderboard", "Delete event".
**Body:** the status control (today's buttons; Live and Archived keep ConfirmAction) via `useServerAction(updateEventStatus…)`; a grid of section cards **with counts** (registrations, divisions, WODs, heats, fees, unpaid registrations) — load counts with `select("id", { count: "exact", head: true })` per table in `Promise.all`. Cards carry `{/* ui-guard-ignore: overview count cards link to sections */}`.

### Task 33: Statement

**Files:** `src/lib/actions/expenses.ts` (+ tests), `EV/statement/page.tsx`, create `ExpensesTable.tsx`, `ExpenseForm.tsx`.
Keep the three summary cards (marked `ui-guard-ignore: statement summary`) and the by-category Badges. Expense log → `DataTable`: Date (`formatDay`), Category, Description, Amount, Notes (low); filter category; toolbar "Add expense"; row destructive "Remove". Test: "Enter a valid expense amount." on `amount_dollars`.

### Task 34: Check-in

**Files:** `checkin/[athleteId]/page.tsx`, create `CheckinActions.tsx`.
Keep both layouts. "Mark paid" and "Waive" become buttons calling `markPaymentStatusForCheckin` through `useServerAction` (toast "Marked paid" / "Waived"); "Reset to unpaid" keeps ConfirmAction. No other change.

### Task 35: The card-list guard

**Files:** `src/lib/design/uiGuard.ts`, `uiGuard.test.ts`.
- [ ] Failing test: `checkSource("src/app/(app)/admin/teams/page.tsx", "<Card>")` → `["admin-card-list"]`; with `{/* ui-guard-ignore: summary */}` on the line above → `[]`; the same line in `src/components/x.tsx` → `[]`.
- [ ] Rule: `{ id: "admin-card-list", pattern: /<Card\b/, message: "Admin lists are DataTables; mark a deliberate card with ui-guard-ignore.", appliesTo: (f) => /^src\/app\/\(app\)\/admin\/.*page\.tsx$/.test(f) }`.
- [ ] `pnpm ui:guard` → clean (fix any page that still renders a list as cards). Commit.

### Task 36: DESIGN.md guide

Add a section **"Building an admin screen"** to `DESIGN.md`:
- the decision table (list → `DataTable`; create/edit → `FormDialog`; long record → `DetailHeader` + `LinkTabs`; destructive → `ConfirmAction`; on/off → `ActionSwitch`);
- the action contract (`safeAction`, `ok`, `fail`, `ok({ href })`, no `redirect()`, no user-facing `throw`), with the Sponsors files as the reference;
- the forms rule (FormData + zod by default; TanStack Form only for growing lists, dependent fields, or live validation; same schema);
- the phone rules (Drawer below 640px, 44px targets, low-priority columns, the 390×400 keyboard check);
- the checklist from the Screen migration recipe.

### Task 37: Audit, Lighthouse and PR 4

- [ ] `/impeccable audit` scoped to `src/app/(app)/admin`; compare with `.impeccable-audit/re-audit/admin`; fix any P0/P1 it finds in this branch.
- [ ] Lighthouse (Chrome DevTools MCP `lighthouse_audit`) on `/admin/events/<seed>/payments` and `/admin/athletes/<seed>` at 1440 and 390: accessibility ≥ 95.
- [ ] Screenshots in `.verify/admin-pr4/`: each detail screen at 1440 and 390, each tab, the 390×400 keyboard check on "Edit profile".
- [ ] `grep -rn "useActionState" src/app/\(app\)/admin` → nothing; every admin-called action file is in `ACTION_RESULT_FILES`.
- [ ] Same as Task 13 with branch `feat/admin-details`, title "Admin details are headers with linkable tabs and every admin action returns a result". Stop at the PR link.
