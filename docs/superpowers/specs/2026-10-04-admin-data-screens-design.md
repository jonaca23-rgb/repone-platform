# Admin data screens and the feature foundations — Design

**Date:** 2026-10-04
**Status:** design approved in conversation (three sections); awaiting review of this written spec.
**Branch:** `feat/admin-data-screens`, from `staging`.
**Sub-project 2 of 7** from the UI/UX audit (`.impeccable-audit/AUDIT.md`). Sub-project 1, the design-system foundation, shipped in #14 and #15. This sub-project comes before scorekeeper, production, commentator, athlete/live and overlays, at the owner's choice. The reason: it lays the pieces every later feature is built from, starting with the venue display's sponsor packages (`docs/superpowers/plans/2026-10-02-venue-display-mvp.md`).

**Context:**
- `PRODUCT.md`, `DESIGN.md`;
- the foundation spec (`2026-10-02-design-system-foundation-design.md`);
- the stack alignment with the sibling repo `school-schedule`, decided 2026-09-29: ActionResult, useServerAction on TanStack Query, shared wrappers, DataTable, `lib/time`.

## Goal

Admin works the way a laptop operator expects on event day:
- every list is a searchable table;
- every create and edit is a dialog, or a drawer on a phone;
- every long record is a header with tabs;
- every failure says what went wrong, next to the field that caused it.

The pieces that make this true are shared and documented, so a new admin feature is assembled from them rather than designed again.

**Success means:**
- No admin list is a stack of cards.
- No create or edit form sits inline at the top of a page.
- No validation failure reaches an error screen.
- Every action an admin screen calls returns `ActionResult`.
- On a 390×400 viewport (a phone with the keyboard up), every form's submit button is visible and works.
- Lighthouse accessibility is ≥ 95 on Payments and on the athlete detail.
- `DESIGN.md` has a "Building an admin screen" guide that the sponsor packages can follow without new patterns.

## Non-goals

- Changing what a screen shows or edits, business rules, the database, or permissions.
- The admin shell: the sidebar, breadcrumb and event group stay as shipped in #14.
- Messages: the chat is redesigned once, for admin and athlete, in the athlete/live sub-project.
- Actions outside admin (scorekeeper, production, commentator, athlete). They move to `ActionResult` in their own sub-projects. The exception is an action admin also calls (see §3).
- TanStack Form as the default (see §1, Forms).

## 1. Foundations

**Today:**
- 43 admin forms post straight to server actions that `throw`.
- A validation failure replaces the page with the area's error screen.
- In production, Next.js redacts thrown messages, so even that screen loses the reason.

Each piece below is adapted from `school-schedule`, restyled to RepOne's tokens.

| Piece | Location | Contract |
|---|---|---|
| `ActionResult<T>` | `src/lib/action-result.ts` | `{ ok: true, data? } \| { ok: false, message, fieldErrors? }`. Expected failures are values, not throws, so the message crosses the network intact. Unexpected errors still throw. |
| `parseForm` | `src/lib/validation/form.ts` (existing) | Gains a non-throwing form that returns `{ ok: false, message, fieldErrors }` from the zod issues. The throwing form stays for the actions not yet migrated. |
| `useServerAction` | `src/lib/use-server-action.ts` | Runs an action as a TanStack Query mutation. `ok: false` becomes an Error. Options: `success` toast, `refresh` (default on, `router.refresh()`), `onSuccess`, `onError`. When the caller passes its own `onError`, no toast is shown. A `QueryClientProvider` goes in the `(app)` root layout. |
| `Drawer` | `src/components/ui/drawer.tsx` | **Base UI** (`@base-ui/react/drawer`) with `VirtualKeyboardProvider`, which keeps the focused field above the iPhone keyboard. **Not vaul.** vaul is unmaintained and does not solve the keyboard. The rest of `ui/` stays Radix; the two coexist, as they do in school-schedule. |
| `ResponsiveDialog` | `src/components/ui/responsive-dialog.tsx` | One API: a Dialog at ≥ 640px, a bottom Drawer below. Its parts mirror Dialog's: Content, Header, Title, Description, Body, Footer, Close. |
| Dialog clamp | `ui/dialog.tsx`, `ui/alert-dialog.tsx` | Content is limited to the viewport height and its body scrolls, so a tall dialog never puts its button off-screen. This is school-schedule commit `fd5bd28`; it also covers `ConfirmAction`. |
| `FormDialog` | `src/components/app/FormDialog.tsx` | A trigger plus a ResponsiveDialog. The child gets `close()`. Closing unmounts the form, so reopening starts from the record's current values. This is the only shape a create or edit takes. |
| `SubmitButton` | `src/components/app/SubmitButton.tsx` | Shows a spinner and is disabled while pending. |
| `FieldError` wiring | in `field.tsx` usage | `fieldErrors[name]` renders under its field with `aria-invalid` and `aria-describedby`. The form-level `message` shows above the footer. |
| `RowActions` | `src/components/app/RowActions.tsx` | The "⋯" menu per row: Edit (opens a FormDialog), extra actions, and Delete through `ConfirmAction`. |
| `DataTable` | `src/components/app/data-table/*` | Built on TanStack Table, with: search; column filters (Select); sorting; pagination (25 per page); an `EmptyState` with one action; a toolbar slot for the primary "+ New" button; an optional row link. Columns carry a `priority`, and below `md` the low-priority ones hide (no horizontal page scroll). |
| `DetailHeader` | `src/components/app/DetailHeader.tsx` | Avatar or icon, title, subtitle, and actions on the right. Edit opens a FormDialog. |
| `LinkTabs` | `src/components/app/LinkTabs.tsx` | shadcn Tabs synced to `?tab=`, so a tab is linkable and Back works. On a phone the tabs scroll sideways. |
| `lib/time` | `src/lib/time.ts` | Dates and times through `Intl` in `America/Puerto_Rico`, with no date-fns. It replaces the five scattered `toLocale…` calls. |

**New dependencies:** `@tanstack/react-query`, `@tanstack/react-table`, `@base-ui/react`.

**Forms:**
- **The default is native `FormData` plus the zod schema,** validated on the server by `parseForm`, with errors returned as `fieldErrors`.
- **Use TanStack Form only when a form needs it.** That means a growing list (lane assignment, team members, later a sponsor package's items), fields that depend on each other, or live validation where a late error is costly.
- **Both use the same zod schema.** TanStack Form takes it in `validators`, and the server validates it again.
- **In admin, only `LaneAssignmentForm` is a candidate.** It is decided by this rule when the heat screens move.

## 2. Screens

| Pattern | Screens |
|---|---|
| **DataTable + FormDialog** | Organization: Events, Athletes, Circuits, Teams, Sponsors, Members. Event: Divisions, Venues, WODs, Fees, Staff, Athletes (registrations), Payments, Heats. |
| **DetailHeader + LinkTabs** | Athlete: Profile · Performance · Competitions · Messages. Circuit: Events · Standings. Heat: Lanes · Results. Event overview: a summary of counts, each linking to its section. |
| **Keep their layout, move onto the pieces** | Statement: a report whose income and expense lists become `Table`. Check-in: the verdict panel already reads at a glance, so only its actions and confirms move. |
| **Out of scope** | Messages (see Non-goals). |

Each screen keeps its fields and content. A screen's inline create form moves into a FormDialog behind the toolbar's "+ New" button. Its cards become table rows, and its per-card buttons move into `RowActions`.

## 3. Actions

- An action moves to `ActionResult` in the same PR as the screen that calls it.
- When another area also calls that action (for example `athletes.ts` from the athlete area), that caller is updated in the same PR, so nothing is left half-migrated.
- Expected failures become `ok: false` with the user-facing message the code already writes, for example "Another active sponsor already holds exclusive category …". Auth and guard failures keep their current redirect or throw behaviour.
- `revalidatePath` stays; `useServerAction`'s refresh complements it.
- After PR 4, every action an admin screen calls returns `ActionResult`, and `ui:guard` enforces it for those files.

## 4. Delivery

There are four PRs against `staging`. Each leaves the app working, and each carries screenshots at 1440 and 390 in its description.

1. **Foundations + Sponsors pilot.** Every piece in §1, with Sponsors as the first screen moved. It is small, and the venue display's packages grow from it, so any flaw in the foundation shows up on one screen.
2. **Organization lists:** Events, Athletes, Circuits, Teams, Members.
3. **Event lists:** Divisions, Venues, WODs, Fees, Staff, Athletes (registrations), Payments, Heats.
4. **Details and the rest:**
   - Athlete, Circuit, Heat and Event overview details, plus Statement and the Check-in actions;
   - the `ui:guard` rules;
   - the `DESIGN.md` guide;
   - the admin audit.

## 5. Tests

**Unit (Vitest):**
- **`useServerAction`:** `ok: false` shows an error toast and doesn't refresh; `ok: true` shows the success toast and refreshes; a caller's `onError` suppresses the toast.
- **`parseForm`:** the non-throwing form returns `fieldErrors` per field.
- **`DataTable`:** search, filter, sort, empty state, and hidden low-priority columns below `md`.
- **`FormDialog`:**
  - it closes only after a successful save;
  - a failure keeps it open and shows the message;
  - reopening shows the current values, not a draft.
- **`ResponsiveDialog`:** Drawer below 640px, Dialog above.
- **`lib/time`:** Puerto Rico formats, including an event that crosses midnight.
- **Each migrated action:** returns `ok: false` with the right message for its known failure, e.g. an exclusive category already held.

**Database:** the existing `db:*` checks keep passing. Nothing here changes the schema.

**Guard:** `ui:guard` fails on:
- a `throw` of a user-facing error in a migrated action file;
- an import of `vaul`;
- a page under `src/app/(app)/admin` that renders a list as cards instead of `DataTable`. This rule lands in PR 4, with an allow-list for the overview's count cards.

**Browser:** run per PR, closing pages and browsers when done.
- Each moved screen at 1440 and 390.
- Create, edit and delete on one screen.
- A forced validation error shows under its field, not on an error screen.
- **The keyboard check:** at 390×400, open a form in the Drawer, focus the last field, and confirm the submit button is visible and saves.

**End of PR 4:**
- `/impeccable audit` on admin, compared with the re-audit.
- Lighthouse on Payments and on the athlete detail: accessibility ≥ 95.
- `pnpm check` and `pnpm build` pass.

## 6. What later sub-projects inherit

- `ActionResult`, `useServerAction`, `FormDialog`, `ResponsiveDialog`, `Drawer`, `RowActions`, `DataTable`, `DetailHeader`, `LinkTabs` and `lib/time` are the building blocks for scorekeeper (its Drawer entry), production, commentator, athlete/live and the venue display.
- Each later sub-project moves its own actions to `ActionResult` and uses these pieces instead of new ones.
