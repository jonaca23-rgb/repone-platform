# Athlete portal and messages: design

**Date:** 2026-10-04
**Status:** design approved in conversation (6b of the 6a/6b split, with live thread refresh). This written spec is waiting for review.
**Branch:** `feat/athlete-messages`, from `staging`. The PR targets `staging`.
**Sub-project 6b of 7** from the UI/UX audit (`public-auth-athlete/report.md`). It builds on:
- sub-project 2's `ActionResult`, `safeAction`, `useServerAction`, `FormField`, `FormAlert`, `ConfirmAction` and `LinkTabs`/`pickTab`;
- the existing `AthleteShell`, which already has the bottom tab bar.

## Goal

An athlete's phone is their event-day tool. It shows:
- the check-in QR first, without scrolling past forms;
- their stats and history one tap away;
- forms that say what went wrong next to the field, instead of throwing to an error screen;
- a chat that works like a chat for athletes and staff alike: it opens on the newest message, shows that a message is sending, and shows new messages as they arrive.

**Success means:**
- `/athlete` opens on a **Check-in** tab whose first content is the QR. **Stats** and **History** are tabs (`?tab=`).
- Saving lifts or a benchmark, removing a benchmark, liking, adding an athlete and onboarding all return `ActionResult`, and a failure shows inline. No portal form reaches the error boundary on a validation failure.
- `myLifts.ts`, `social.ts`, `messages.ts` and the onboarding action (moved to `src/lib/actions/onboarding.ts`) are on `ACTION_RESULT_FILES`.
- The athlete and admin threads use the same `MessageThread` and `MessageComposer`. The thread scrolls to the newest message on open and when a message arrives, and new incoming messages appear without a reload.
- Every target is at least 44px on both the athlete and admin message screens.

## Non-goals

- The QR's content, check-in logic, registrations and payments.
- The directory list and detail layouts. They're already rows with avatars. Only their forms and the like button change.
- Notifications beyond the existing unread badge.
- Message editing, deleting, attachments, typing indicators and read receipts.
- The admin Messages *list* layout beyond 44px rows.

## 1. Actions on `ActionResult`

Every action below is wrapped in `safeAction`. Guards and `parseForm` keep throwing, and `safeAction` converts what they throw. Database errors still throw. No action throws a literal message, and none calls `redirect()`.

| Action | Change |
|---|---|
| `saveMyLifts(fd)` | Returns `ok()`. When every field is blank, returns `fail("Enter at least one lift or time to save.")` instead of returning silently. |
| `upsertMyBenchmark(fd)` | Returns `ok()`. |
| `deleteMyBenchmark(id)` | Returns `ok()`. |
| `toggleLike(athleteId, type, id)` | Returns `ok()`. The literal `ValidationError` throw becomes `fail(...)`, and the `NotAuthorizedError` literal becomes `fail("That item doesn't exist, or isn't this athlete's.")`. |
| `createAthleteFromPortal(fd)` | Returns `ok({ href: "/athlete/directory/<id>" })` instead of calling `redirect`. The not-onboarded case returns `fail(...)`. A write error returns `fail(friendlyAthleteWriteError(error))`. |
| `sendMessage(recipientId, fd)` | Returns `ok()`. RLS code 42501 returns `fail("You can't message this person.")`. |
| `completeAthleteOnboarding(fd)` | Moves from `app/(app)/athlete/actions.ts` to `src/lib/actions/onboarding.ts`. Its signature becomes `(formData) => ActionResult<{ href: string }>`, it returns `ok({ href: "/athlete" })`, and an RPC error returns `fail(friendlyAthleteWriteError(error))`. |

Anything else exported from `athlete/actions.ts` moves with it. When the old file is empty, it is deleted.

All four files join `ACTION_RESULT_FILES`.

## 2. Athlete home: `/athlete`

The page keeps its six parallel queries. The `PageHeader` ("Welcome, {firstName}") stays. Under it, `LinkTabs` with `pickTab` (`?tab=`; default `checkin`) renders one of three tabs.

**Check-in** (default):
1. the QR card, first;
2. the registrations list;
3. Current leaderboard status.

**Stats:**
1. **My lifts & run times**: a client `LiftsForm` using `useServerAction(saveMyLifts)`, `FormField` per input, `FormAlert`, and a `SubmitButton`. On success it toasts "Lifts saved."
2. **My benchmark workouts**:
   - a client `BenchmarkForm` with name and result, in a grid that stacks on a phone, with a full-width Save on a phone. On success it toasts "Benchmark saved." and clears.
   - the list, with Remove through `ConfirmAction`, unchanged except that it now handles a returned failure.

**History:**
1. Recent activity;
2. My competition history.

Today's markup for every section is kept. This is a reorganisation, not a restyle. One exception: the benchmark row becomes `grid gap-3 sm:grid-cols-[1fr_1fr_auto]` (audit #5).

## 3. Messages: shared thread and composer

New client components live in `src/components/messages/`.

- **`MessageThread({ messages, counterpartName })`.** Renders today's athlete `<ol>` bubbles: sender as sr-only text, `formatDateTime`, and the empty line "No messages yet. Say hello."
  - After mount, and whenever the newest message id changes, it scrolls that message into view (`scrollIntoView({ block: "end" })`).
  - Each message is `{ id, body, createdAt, fromMe }`.
- **`MessageComposer({ recipientId, recipientName })`.**
  - A controlled `Textarea`: `min-h-11`, `max-h-40`, 2000 maximum, required, labelled "Message to {name}" (sr-only).
  - A Send `Button` (`size="touch"`) that shows "Sending…" and is disabled while pending.
  - Uses `useServerAction((fd) => sendMessage(recipientId, fd), { toastErrors: false })`. On success the textarea clears. On failure `FormAlert` shows the message and the text stays.
  - Enter submits; Shift+Enter adds a newline.
- **`useThreadRefresh(myUserId)`.** A wrapper over `useRefreshOnChanges([{ table: "messages", filter: \`recipient_id=eq.${myUserId}\` }])`. It lives inside a small client component, `ThreadLiveRefresh`, that each thread page renders. Any message to me refreshes the page. The server re-renders the thread and marks it read, as on open, and `MessageThread` scrolls to the new message.

### Athlete thread (`/athlete/messages/[counterpartId]`)

- Header unchanged.
- `<MessageThread>`.
- `<MessageComposer>` in today's sticky container: `bottom-[calc(4rem+safe-area)]` above the tab bar, `md:bottom-0`.
- `<ThreadLiveRefresh myUserId>`.

### Admin thread (`/admin/messages/[counterpartId]`)

- Its `PageHeader` and breadcrumb stay.
- Its hand-rolled bubbles and form are replaced by the same `MessageThread` and `MessageComposer`. The composer sits in a `sticky bottom-0` bar.
- `<ThreadLiveRefresh myUserId>`.

### Admin list (`/admin/messages`)

The rows get `min-h-14` and keep their layout.

## 4. Directory forms

- **`/athlete/directory/new`.** The form becomes a client `NewAthleteForm`:
  - `useServerAction(createAthleteFromPortal, { onSuccess: ({ href }) => router.push(href) })`;
  - a `FormField` for each field (the existing five), plus `FormAlert` and `SubmitButton`;
  - typed values survive a failure.
- **`LikeButton`.** Becomes a client component with `useServerAction(() => toggleLike(...))` and an optimistic pressed state:
  - a click flips `aria-pressed` and the count at once;
  - a failure reverts both, and the error is toasted.

## 5. Onboarding

`OnboardingForm` switches from `useActionState` to `useServerAction(completeAthleteOnboarding, { toastErrors: false, onSuccess: ({ href }) => router.push(href) })`. It keeps the hand-submitted `FormData` (typed values survive), shows field errors through `FormField`, and shows the form-level error through `FormAlert`.

It also adds `autoComplete` to the fields (audit #13):
- `given-name` and `family-name`;
- `organization` on affiliate;
- `email`, `tel` and `bday`.

The copy and the gender options are unchanged.

## 6. Testing

**Unit tests (actions, with `fakeSupabase`)**

- `saveMyLifts`: all blank returns the fail message; a valid lift returns `ok`.
- `sendMessage`: a 42501 error returns the "can't message" failure; success returns `ok`.
- `toggleLike`: a bad target returns a failure.
- `createAthleteFromPortal`: returns `{ href }`.
- `completeAthleteOnboarding`: an RPC error returns a failure; success returns `{ href: "/athlete" }`.
- `uiGuard`: the four files are on the list, and `pnpm ui:guard` passes.

**Component tests (jsdom)**

- `MessageComposer`:
  - sends the typed body, clears on success, and shows "Sending…" while pending;
  - keeps the text and shows the error on failure;
  - Enter sends and Shift+Enter doesn't.
- `MessageThread`: calls `scrollIntoView` on mount and again when a newer message is added.
- `LiftsForm`: shows the all-blank failure inline.
- `LikeButton`: flips at once and reverts on failure.

**Browser** (`.verify/athlete/`)

Signed in as `athlete@repone.test` at 390×844:
- the Check-in tab opens with the QR visible without scrolling (`home-390.png`);
- Stats: save a lift, then fail one (letters in a time field) and check the inline error; add and remove a benchmark;
- History tab;
- a thread:
  - opens at the newest message;
  - send a message and see "Sending…";
  - as admin (`admin@repone.test`) in a second context, reply, and check that it appears on the athlete's open thread without a reload (`thread-live.png`).
- admin thread at 1440: same components, composer sticky (`admin-thread-1440.png`);
- `/athlete/directory/new` with a duplicate email, or another failing value, shows the error inline;
- a like toggles;
- Lighthouse accessibility ≥ 95 on `/athlete` (mobile) and on the athlete thread (mobile).

Afterwards, remove test messages, benchmarks, lifts and likes, and any athlete created, from the local DB, and close the browser pages.
